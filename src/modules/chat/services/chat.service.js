"use strict";

const {
  NotFoundError,
  ForbiddenError,
} = require("../../../common/errors/http-error");
const { prisma } = require("../../../prisma/client");
const { aiChatService } = require("../../ai/services/ai-chat.service");
const { chatRepository } = require("../repositories/chat.repository");

// ─── Service ──────────────────────────────────────────────────────────────────

class ChatService {
  // ══════════════════════════════════════════════════════════════════════════
  //  Conversation operations
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new conversation for the authenticated user.
   *
   * @param {string} userId
   * @param {string|undefined} title  Optional; defaults to "New Chat".
   * @returns {Promise<Conversation>}
   */
  createConversation(userId, title) {
    const safeTitle = (title ?? "New Chat").trim() || "New Chat";
    return chatRepository.createConversation(userId, safeTitle);
  }

  /**
   * List all active conversations for a user with pagination.
   * Each item includes message count and last-message preview.
   *
   * @param {string} userId
   * @param {{ limit?: number, offset?: number }} pagination
   */
  listConversations(userId, pagination = {}) {
    return chatRepository.listConversations(userId, pagination);
  }

  /**
   * Return a single conversation, enforcing ownership.
   *
   * @param {string} userId
   * @param {string} conversationId
   */
  async getConversation(userId, conversationId) {
    const conv = await chatRepository.findConversation(conversationId, userId);
    if (!conv) throw new NotFoundError("Conversation not found");
    return conv;
  }

  /**
   * Rename a conversation.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} title
   */
  async renameConversation(userId, conversationId, title) {
    await this._requireOwnership(userId, conversationId);
    return chatRepository.updateConversation(conversationId, {
      title: title.trim(),
    });
  }

  /**
   * Soft-delete: mark the conversation as archived.
   * Archived conversations are excluded from the default list.
   *
   * @param {string} userId
   * @param {string} conversationId
   */
  async archiveConversation(userId, conversationId) {
    await this._requireOwnership(userId, conversationId);
    return chatRepository.updateConversation(conversationId, {
      status: "archived",
    });
  }

  /**
   * Hard-delete a conversation and all its messages (cascades via FK).
   * Irreversible — use archiveConversation for soft-delete.
   *
   * @param {string} userId
   * @param {string} conversationId
   */
  async deleteConversation(userId, conversationId) {
    await this._requireOwnership(userId, conversationId);
    await chatRepository.deleteConversation(conversationId);
    return { deleted: true, conversationId };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Message operations
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Retrieve messages for a conversation with offset pagination.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @param {{ limit?: number, offset?: number }} pagination
   */
  async listMessages(userId, conversationId, pagination = {}) {
    await this._requireOwnership(userId, conversationId);
    return chatRepository.listMessages(conversationId, pagination);
  }

  /**
   * Cursor-based history load — "load messages before X".
   * Used for infinite-scroll going upward in the chat UI.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @param {{ cursor?: string, limit?: number }} opts
   *   cursor — id of the oldest message already rendered on the client
   */
  async listMessagesBefore(userId, conversationId, opts = {}) {
    await this._requireOwnership(userId, conversationId);
    return chatRepository.listMessagesBefore(conversationId, opts);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Send message  (core orchestration)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Process an inbound user message:
   *
   *  1. Validate conversation ownership.
   *  2. Persist the user message (status: completed).
   *  3. Create a placeholder assistant message (status: processing).
   *  4. Forward chat history to the external AI chatbot service.
   *  5. Update the placeholder with the external response.
   *  6. Stamp conversation.lastMessageAt.
   *
   * Steps 3-7 keep the user message always saved even if AI fails.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} content
   * @returns {Promise<SendMessageResult>}
   */
  async sendMessage(userId, conversationId, content) {
    // ── 1. Ownership check ───────────────────────────────────────────────────
    await this._requireOwnership(userId, conversationId);

    // ── 2. Persist user message ──────────────────────────────────────────────
    const userMessage = await chatRepository.createMessage({
      conversationId,
      userId,
      role: "user",
      content: content.trim(),
      status: "completed",
    });

    // ── 3. Create processing placeholder for assistant ───────────────────────
    const placeholder = await chatRepository.createMessage({
      conversationId,
      userId,
      role: "assistant",
      content: "", // filled in after AI responds
      status: "processing",
    });

    // ── 4-5. External AI chatbot call ────────────────────────────────────────
    const { assistantMessage, aiReply } = await this._runAiPipeline({
      userId,
      conversationId,
      placeholderId: placeholder.id,
    });

    // ── 6. If AI failed, mark user message as failed too ──────────────────────
    let finalUserMessage = userMessage;
    if (aiReply?.error) {
      finalUserMessage = await chatRepository.updateMessage(userMessage.id, {
        status: "failed",
      });
    }

    // ── 7. Stamp conversation ────────────────────────────────────────────────
    await chatRepository.touchConversation(conversationId);

    return {
      userMessage: finalUserMessage,
      assistantMessage,
      aiReply,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Private helpers
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ensure the conversation exists and belongs to userId.
   * Throws NotFoundError otherwise (we use 404, not 403, to avoid leaking
   * whether the conversation exists at all).
   *
   * @param {string} userId
   * @param {string} conversationId
   * @returns {Promise<Conversation>}
   */
  async _requireOwnership(userId, conversationId) {
    const conv = await chatRepository.findConversation(conversationId, userId);
    if (!conv) throw new NotFoundError("Conversation not found");
    return conv;
  }

  /**
   * @param {{ userId: string, conversationId: string, placeholderId: string }} opts
   * @returns {Promise<{ assistantMessage, aiReply }>}
   */
  async _runAiPipeline({ userId, conversationId, placeholderId }) {
    let assistantContent = "";
    let aiReply = { error: "AI_CHATBOT_UNAVAILABLE" };

    try {
      const messages = await chatRepository.getRecentMessages(conversationId, 20);
      const completedMessages = messages.filter(
        (message) => message.status === "completed" && message.content,
      );

      aiReply = await aiChatService.generateReply(completedMessages, { 
        userId,
        conversationId
      });

      if (!aiReply.error) {
        assistantContent = aiReply.content;
      }
    } catch (err) {
      console.error("[Chat] AI pipeline error:", err.message);
    }

    const assistantMessage = await chatRepository.updateMessage(placeholderId, {
      content: assistantContent,
      status: aiReply.error ? "failed" : "completed",
      metadata: {
        ...(aiReply
          ? {
              ai: {
                model: aiReply.model,
                latencyMs: aiReply.latencyMs,
                external: true,
                error: aiReply.error ?? null,
              },
            }
          : {}),
      },
    });

    return { assistantMessage, aiReply };
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

const chatService = new ChatService();
module.exports = { chatService };

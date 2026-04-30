"use strict";

const {
  NotFoundError,
} = require("../../../common/errors/http-error");
const { aiChatService } = require("../../ai/services/ai-chat.service");
const { chatRepository } = require("../repositories/chat.repository");

// ─── Service ──────────────────────────────────────────────────────────────────

class ChatService {
  /**
   * Create a new conversation.
   * @param {string} userId
   * @param {string} title
   */
  async createConversation(userId, title) {
    return chatRepository.createConversation(userId, title);
  }

  /**
   * Get all conversations for a user, ordered by most recent.
   */
  async getUserConversations(userId) {
    return chatRepository.getUserConversations(userId);
  }

  /**
   * Get a conversation's history formatted as turns.
   */
  async getConversationTurns(userId, conversationId, limit = 50) {
    await this._requireOwnership(userId, conversationId);

    const messages = await chatRepository.getRecentMessages(conversationId, limit * 2);
    
    // getRecentMessages returns messages ordered by createdAt DESC (newest first).
    // To build turns correctly, we reverse them so oldest comes first.
    const reversedMessages = messages.reverse();
    
    const turns = [];
    let currentTurn = null;

    for (const msg of reversedMessages) {
      if (msg.status !== 'completed') continue;

      if (msg.role === 'user') {
        if (currentTurn) turns.push(currentTurn);
        currentTurn = { user: msg.content, assistant: null };
      } else if (msg.role === 'assistant' && currentTurn) {
        currentTurn.assistant = msg.content;
      }
    }

    if (currentTurn) turns.push(currentTurn);

    return turns;
  }

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

const chatService = new ChatService();
module.exports = { chatService };

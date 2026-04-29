"use strict";

const {
  NotFoundError,
  ForbiddenError,
} = require("../../../common/errors/http-error");
const { prisma } = require("../../../prisma/client");
const { env } = require("../../../config/env");
const { aiService } = require("../../ai/services/ai.service");
const {
  contextBuilderService,
} = require("../../ai/services/context-builder.service");
const { aiChatService } = require("../../ai/services/ai-chat.service");
const { chatRepository } = require("../repositories/chat.repository");

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum AI confidence required to auto-save a parsed transaction. */
const TRANSACTION_CONFIDENCE_THRESHOLD = 0.5;

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
   *  4. Build the AI context (history + memory hints).
   *  5. Optionally auto-detect and save a financial transaction.
   *  6. Generate the assistant reply.
   *  7. Update the placeholder with the final content (status: completed).
   *  8. Stamp conversation.lastMessageAt.
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

    // ── 4-7. AI pipeline (isolated — never throws to the caller) ─────────────
    const { assistantMessage, transactionResult } = await this._runAiPipeline({
      userId,
      conversationId,
      content,
      placeholderId: placeholder.id,
    });

    // ── 8. Stamp conversation ────────────────────────────────────────────────
    await chatRepository.touchConversation(conversationId);

    return {
      userMessage,
      assistantMessage,
      transactionResult,
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
   * Builds the AI context using ContextBuilderService.
   * Fetches last 15 messages, top global memory, and top conversation memory
   * in parallel, applies the token budget, and returns a merged object.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @returns {Promise<AiContext>}
   */
  async _buildAiContext(userId, conversationId) {
    const context = await contextBuilderService.buildContext(
      conversationId,
      userId,
    );

    // Derive the defaultCurrency from global memory (key: "default_currency")
    // or fall back to the first preference fact, then hard-default to "USD".
    const currencyFact = context.globalMemory.find(
      (f) => f.key === "default_currency",
    );
    const defaultCurrency =
      (typeof currencyFact?.value === "string" ? currencyFact.value : null) ??
      "USD";

    return {
      // Raw built context — used by toOpenAiMessages / toSystemPrompt
      _raw: context,

      // Convenience fields used by _detectTransaction and _buildAssistantReply
      defaultCurrency,

      // Flat history array for the AI  [{ role, content }, ...]
      history: context.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),

      // Memory hints as flat key→value pairs for the AI parse call
      memoryHints: context.globalMemory.map((f) => ({ [f.key]: f.value })),
    };
  }

  /**
   * Attempt to detect and save a financial transaction from the user message.
   * Returns null silently if parsing fails or confidence is too low.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} content
   * @param {AiContext} ctx
   * @returns {Promise<TransactionResult|null>}
   */
  async _detectTransaction(userId, conversationId, content, ctx) {
    // Quick pre-filter: skip if there are no digits in the message.
    if (!/\d/.test(content)) return null;

    try {
      const parsed = await aiService.parseTransaction({
        text: content,
        defaultCurrency: ctx.defaultCurrency,
        memoryHints: ctx.memoryHints,
      });

      // Reject incomplete or low-confidence results
      if (
        !parsed.amount ||
        !parsed.type ||
        !parsed.category ||
        parsed.confidence < TRANSACTION_CONFIDENCE_THRESHOLD
      ) {
        return null;
      }

      // Persist raw note + transaction atomically
      const [rawNote, tx] = await prisma.$transaction([
        prisma.rawNote.create({
          data: {
            userId,
            conversationId,
            content,
            status: "parsed",
            parsedResult: parsed,
            confidence: parsed.confidence,
          },
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount: parsed.amount,
            currency: parsed.currency ?? ctx.defaultCurrency,
            category: parsed.category,
            item: parsed.item ?? null,
            quantity: parsed.quantity ?? null,
            type: parsed.type,
            source: "ai_parsed",
            rawText: content,
            confidence: parsed.confidence,
          },
        }),
      ]);

      return { parsed, transactionId: tx.id };
    } catch (err) {
      // Log but do not propagate — transaction detection is best-effort.
      console.error("[Chat] Transaction detection failed:", err.message);
      return null;
    }
  }

  /**
   * Build the assistant's reply text given the AI context and an optional
   * transaction that was just auto-saved.
   *
   * @param {AiContext}           ctx
   * @param {TransactionResult|null} transactionResult
   * @returns {string}
   */
  /**
   * Build a short transaction-confirmation prefix to prepend to the AI reply
   * when a transaction was auto-detected and saved.
   *
   * Keeping this separate from the AI reply lets the AI speak naturally while
   * we still show the user a structured confirmation.
   *
   * @param {TransactionResult} transactionResult
   * @returns {string}
   */
  _buildTransactionPrefix(transactionResult) {
    const { parsed } = transactionResult;
    const typeLabel = parsed.type === "expense" ? "مصروف" : "دخل";
    const itemLabel = parsed.item ? ` (${parsed.item})` : "";
    const confidence = Math.round(parsed.confidence * 100);

    return (
      `✅ تم تسجيل المعاملة:\n` +
      `• النوع: ${typeLabel}\n` +
      `• المبلغ: ${parsed.amount} ${parsed.currency}\n` +
      `• الفئة: ${parsed.category}${itemLabel}\n` +
      `• الثقة: ${confidence}%\n\n`
    );
  }

  /**
   * Full AI pipeline — runs after the user message is saved.
   *
   * Always resolves — never throws.  The placeholder message is always
   * updated so the user receives a response even on partial failures.
   *
   * Pipeline
   * ────────
   * Step 1 — contextBuilderService.buildContext()
   *           Fetches last 15 messages + top global memory +
   *           top conversation memory in parallel, applies token budget.
   *
   * Step 2 — _detectTransaction()  (best-effort, parallel-safe)
   *           If the message contains digits and the AI confidence is high
   *           enough, a RawNote + Transaction are saved atomically.
   *
   * Step 3 — contextBuilderService.toOpenAiMessages()
   *           Converts the context object into the OpenAI messages array
   *           [{ role: "system", content }, ...history].
   *
   * Step 4 — aiChatService.generateReply()
   *           Calls the OpenAI Chat Completions API with retry +
   *           exponential back-off.  Falls back to a mock reply when
   *           no API key is configured or all retries are exhausted.
   *
   * Step 5 — chatRepository.updateMessage()
   *           Replaces the placeholder (status: processing) with the
   *           final content (status: completed).
   *
   * @param {{ userId: string, conversationId: string, content: string, placeholderId: string }} opts
   * @returns {Promise<{ assistantMessage, transactionResult, aiReply, contextMeta }>}
   */
  async _runAiPipeline({ userId, conversationId, content, placeholderId }) {
    let assistantContent =
      "عذراً، حدث خطأ أثناء معالجة رسالتك. يرجى المحاولة مرة أخرى.";
    let transactionResult = null;
    let aiReply = null;
    let contextMeta = null;

    try {
      // ── Step 1: Build context ────────────────────────────────────────────
      const ctx = await this._buildAiContext(userId, conversationId);
      contextMeta = ctx._raw?.meta ?? null;

      // ── Step 2: Transaction detection (best-effort, never blocks reply) ──
      transactionResult = await this._detectTransaction(
        userId,
        conversationId,
        content,
        ctx,
      );

      // ── Step 3: Convert context → OpenAI messages array ──────────────────
      // toOpenAiMessages() injects a system prompt (persona + memory facts)
      // followed by the last N conversation messages in chronological order.
      const openAiMessages = ctx._raw
        ? contextBuilderService.toOpenAiMessages(ctx._raw)
        : [
            {
              role: "system",
              content:
                "You are a smart financial assistant. Help the user track expenses and income.",
            },
            { role: "user", content },
          ];

      if (env.nodeEnv === "development") {
        console.debug(
          `[Chat] Sending ${openAiMessages.length} messages to AI` +
            (contextMeta?.truncated ? " [TRUNCATED]" : ""),
        );
      }

      // ── Step 4: Generate AI reply ─────────────────────────────────────────
      aiReply = await aiChatService.generateReply(openAiMessages, { userId });

      // Try parsing JSON out of aiReply.content
      let parsedJson = null;
      try {
        const jsonMatch = aiReply.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // failed to parse
      }

      // Prepend structured transaction confirmation if one was saved
      const prefix = transactionResult ? this._buildTransactionPrefix(transactionResult) : "";
      
      if (parsedJson) {
        parsedJson.message = prefix + parsedJson.message;
        assistantContent = JSON.stringify(parsedJson);
      } else {
        assistantContent = JSON.stringify({
          message: prefix + aiReply.content,
          insights: [],
          actions: []
        });
      }

    } catch (err) {
      console.error("[Chat] AI pipeline error:", err.message);
      // assistantContent already holds the fallback error string
    }

    // ── Step 5: Persist the final assistant message ───────────────────────
    // Always runs — ensures the placeholder is never left as "processing".
    const assistantMessage = await chatRepository.updateMessage(placeholderId, {
      content: assistantContent,
      status: "completed",
      metadata: {
        ...(transactionResult ? { transactionResult } : {}),
        ...(aiReply
          ? {
              ai: {
                model: aiReply.model,
                mock: aiReply.mock,
                latencyMs: aiReply.latencyMs,
                attempts: aiReply.attempts,
                usage: aiReply.usage,
              },
            }
          : {}),
        ...(contextMeta ? { contextMeta } : {}),
      },
    });

    return { assistantMessage, transactionResult, aiReply, contextMeta };
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

const chatService = new ChatService();
module.exports = { chatService };

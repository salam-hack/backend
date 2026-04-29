"use strict";

/**
 * ContextBuilderService
 *
 * Aggregates all data the AI needs before generating a reply:
 *   1. Last N messages from the conversation  (chat history)
 *   2. Top global memory facts for the user   (long-term preferences)
 *   3. Top conversation memory facts           (short-term context)
 *
 * All three sources are fetched in parallel then merged into a single
 * context object with helper methods to format it for the OpenAI API.
 *
 * Design goals
 * ────────────
 * • Never throw for a missing memory — partial context is still useful.
 * • Stay within a configurable token budget to avoid overloading the model.
 * • Keep the public API simple: one call in, one object out.
 */

const { prisma } = require("../../../prisma/client");
const { NotFoundError } = require("../../../common/errors/http-error");

// ─── Tuneable limits ──────────────────────────────────────────────────────────

const DEFAULTS = {
  /** Maximum number of recent messages to include. */
  maxMessages: 15,

  /** Maximum global memory facts to include. */
  maxGlobalMemory: 10,

  /** Maximum conversation memory facts to include. */
  maxConversationMemory: 8,

  /**
   * Soft token budget for the entire context.
   * When exceeded, older messages are trimmed first, then low-confidence
   * memory entries are dropped until the budget is met.
   *
   * Rough heuristic: 1 token ≈ 3.5 characters (conservative for Arabic).
   */
  tokenBudget: 6000,

  /**
   * Minimum confidence score for a memory fact to be included.
   * Facts below this threshold are excluded even if slots remain.
   */
  minMemoryConfidence: 0.4,
};

// ─── Token estimator ──────────────────────────────────────────────────────────

/**
 * Rough token count estimate.
 * Uses the conservative 3.5-chars-per-token ratio which works reasonably
 * well for mixed Arabic/English text without an actual tokeniser.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 3.5);
}

/**
 * Estimate tokens for an arbitrary value (string, object, array, …).
 * Objects are serialised to JSON before counting.
 *
 * @param {unknown} value
 * @returns {number}
 */
function estimateValueTokens(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return estimateTokens(value);
  return estimateTokens(JSON.stringify(value));
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ContextBuilderService {
  // ══════════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build a complete AI context for the given conversation.
   *
   * @param {string} conversationId
   * @param {string} userId          Owner of the conversation.
   * @param {object} [opts]          Override any of the DEFAULTS.
   * @param {number} [opts.maxMessages]
   * @param {number} [opts.maxGlobalMemory]
   * @param {number} [opts.maxConversationMemory]
   * @param {number} [opts.tokenBudget]
   * @param {number} [opts.minMemoryConfidence]
   *
   * @returns {Promise<AiContext>}
   *
   * @throws {NotFoundError} if the conversation does not belong to userId.
   *
   * @example
   * const ctx = await contextBuilderService.buildContext(conversationId, userId);
   * const messages = contextBuilderService.toOpenAiMessages(ctx);
   * const reply = await openai.chat.completions.create({ model, messages });
   */
  async buildContext(conversationId, userId, opts = {}) {
    const cfg = { ...DEFAULTS, ...opts };

    // ── Validate ownership ────────────────────────────────────────────────
    const conversation = await this._fetchConversation(conversationId, userId);

    // ── Fetch all sources in parallel ─────────────────────────────────────
    const [rawMessages, rawGlobal, rawConversation, rawSummary] = await Promise.all([
      this._fetchMessages(conversationId, cfg.maxMessages),
      this._fetchGlobalMemory(userId, cfg.maxGlobalMemory, cfg.minMemoryConfidence),
      this._fetchConversationMemory(conversationId, cfg.maxConversationMemory, cfg.minMemoryConfidence),
      this._fetchSummaryMemory(userId),
    ]);

    // ── Apply token budget ────────────────────────────────────────────────
    const { messages, globalMemory, conversationMemory, summaryMemory, truncated } =
      this._applyTokenBudget(rawMessages, rawGlobal, rawConversation, rawSummary, cfg.tokenBudget);

    // ── Assemble final context object ─────────────────────────────────────
    const context = {
      // ── Identity ──────────────────────────────────────────────────────
      conversationId,
      userId,
      builtAt: new Date().toISOString(),

      // ── Conversation metadata ─────────────────────────────────────────
      conversation: {
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
      },

      // ── Chat history (oldest → newest, ready for AI) ──────────────────
      messages,

      // ── Long-term user preferences / habits ───────────────────────────
      globalMemory,

      // ── Short-term context specific to this conversation ──────────────
      conversationMemory,

      // ── Condensed insights / summary ──────────────────────────────────
      summaryMemory,

      // ── Diagnostics ──────────────────────────────────────────────────
      meta: {
        messageCount: messages.length,
        globalMemoryCount: globalMemory.length,
        conversationMemoryCount: conversationMemory.length,
        summaryMemoryCount: summaryMemory.length,
        estimatedTokens: this._estimateContextTokens(
          messages,
          globalMemory,
          conversationMemory,
          summaryMemory
        ),
        tokenBudget: cfg.tokenBudget,
        truncated,
      },
    };

    return context;
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Format the context as an OpenAI-compatible messages array.
   *
   * Structure:
   *   [ { role: "system", content: <system prompt> },
   *     { role: "user"|"assistant", content: "..." },
   *     ...  ]
   *
   * The system message injects memory and user preferences.
   * The history messages follow in chronological order.
   *
   * @param {AiContext} context  Output of buildContext().
   * @returns {{ role: string, content: string }[]}
   */
  toOpenAiMessages(context) {
    const systemContent = this._buildSystemPrompt(context);

    const historyMessages = context.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return [{ role: "system", content: systemContent }, ...historyMessages];
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render only the system-prompt string (memory + instructions).
   * Useful for debugging or custom AI integrations.
   *
   * @param {AiContext} context
   * @returns {string}
   */
  toSystemPrompt(context) {
    return this._buildSystemPrompt(context);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Private — data fetching
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Verify the conversation exists and belongs to the user.
   *
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<Conversation>}
   */
  async _fetchConversation(conversationId, userId) {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: {
        id: true,
        title: true,
        status: true,
        lastMessageAt: true,
      },
    });

    if (!conv) {
      throw new NotFoundError(
        `Conversation ${conversationId} not found or does not belong to user`,
      );
    }

    return conv;
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the last `limit` messages, returned oldest-first for AI prompting.
   *
   * @param {string} conversationId
   * @param {number} limit
   * @returns {Promise<MessageItem[]>}
   */
  async _fetchMessages(conversationId, limit) {
    // Fetch newest-first so we get the *last* limit messages,
    // then reverse so the AI receives them oldest-first.
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        // Exclude placeholder messages that are still processing
        status: { not: "processing" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return rows
      .reverse()
      .map((m) => ({
        id: m.id,
        role: m.role,        // "user" | "assistant" | "system" | "tool"
        content: m.content,
        createdAt: m.createdAt,
      }));
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the user's top global memory facts, sorted by confidence (highest
   * first). Facts below minConfidence are excluded.
   *
   * @param {string} userId
   * @param {number} limit
   * @param {number} minConfidence
   * @returns {Promise<MemoryFact[]>}
   */
  async _fetchGlobalMemory(userId, limit, minConfidence) {
    const rows = await prisma.globalMemory.findMany({
      where: {
        userId,
        confidence: { gte: minConfidence },
      },
      orderBy: [
        { confidence: "desc" },  // highest confidence first
        { updatedAt: "desc" },   // tie-break: most recently updated
      ],
      take: limit,
      select: {
        id: true,
        key: true,
        value: true,
        type: true,
        confidence: true,
        source: true,
        updatedAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      type: r.type,
      confidence: r.confidence,
      source: r.source,
      updatedAt: r.updatedAt,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the top conversation-scoped memory facts.
   * Expired facts are automatically excluded.
   *
   * @param {string} conversationId
   * @param {number} limit
   * @param {number} minConfidence
   * @returns {Promise<MemoryFact[]>}
   */
  async _fetchConversationMemory(conversationId, limit, minConfidence) {
    const now = new Date();

    const rows = await prisma.conversationMemory.findMany({
      where: {
        conversationId,
        confidence: { gte: minConfidence },
        // Include entries with no expiry OR a future expiry
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: [
        { confidence: "desc" },
        { updatedAt: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        key: true,
        value: true,
        type: true,
        confidence: true,
        expiresAt: true,
        updatedAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      type: r.type,
      confidence: r.confidence,
      expiresAt: r.expiresAt,
      updatedAt: r.updatedAt,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the latest user summary memory.
   *
   * @param {string} userId
   * @returns {Promise<any[]>}
   */
  async _fetchSummaryMemory(userId) {
    const rows = await prisma.summaryMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 2, // Take recent overall or current month
      select: {
        period: true,
        summaryText: true,
        metrics: true,
      },
    });

    return rows.map(r => ({
      period: r.period,
      summaryText: r.summaryText,
      metrics: r.metrics
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Private — token budget management
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ensure the combined context fits within the token budget.
   *
   * Trimming priority (least valuable dropped first):
   *   1. Oldest messages             — chat history is most expendable
   *   2. Low-confidence global facts — global memory is secondary
   *   3. Low-confidence conv. facts  — conversation memory is most valuable
   *   (Summary is kept as priority)
   *
   * @param {MessageItem[]}  messages
   * @param {MemoryFact[]}   globalMemory
   * @param {MemoryFact[]}   conversationMemory
   * @param {any[]}          summaryMemory
   * @param {number}         budget
   * @returns {{ messages, globalMemory, conversationMemory, summaryMemory, truncated: boolean }}
   */
  _applyTokenBudget(messages, globalMemory, conversationMemory, summaryMemory, budget) {
    let truncated = false;

    // Work on shallow copies so we don't mutate inputs
    let msgs  = [...messages];
    let gMem  = [...globalMemory];
    let cMem  = [...conversationMemory];
    let sMem  = [...summaryMemory];

    // ── Helper: measure current usage ─────────────────────────────────────
    const measure = () =>
      this._estimateContextTokens(msgs, gMem, cMem, sMem);

    // ── 1. Trim oldest messages ────────────────────────────────────────────
    while (msgs.length > 1 && measure() > budget) {
      msgs.shift();   // remove oldest message
      truncated = true;
    }

    // ── 2. Trim lowest-confidence global memory ────────────────────────────
    while (gMem.length > 0 && measure() > budget) {
      gMem.pop();     // already sorted confidence desc, so pop = lowest
      truncated = true;
    }

    // ── 3. Trim lowest-confidence conversation memory ──────────────────────
    while (cMem.length > 0 && measure() > budget) {
      cMem.pop();
      truncated = true;
    }

    // ── 4. Trim summary memory if desperately needed ───────────────────────
    while (sMem.length > 0 && measure() > budget) {
      sMem.pop();
      truncated = true;
    }

    return {
      messages: msgs,
      globalMemory: gMem,
      conversationMemory: cMem,
      summaryMemory: sMem,
      truncated,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Estimate the total token count for all context sections.
   *
   * @param {MessageItem[]} messages
   * @param {MemoryFact[]}  globalMemory
   * @param {MemoryFact[]}  conversationMemory
   * @param {any[]}         summaryMemory
   * @returns {number}
   */
  _estimateContextTokens(messages, globalMemory, conversationMemory, summaryMemory) {
    let total = 0;

    for (const m of messages) {
      total += estimateTokens(m.content) + 4; // +4 for role overhead
    }

    for (const f of globalMemory) {
      total += estimateTokens(f.key) + estimateValueTokens(f.value) + 6;
    }

    for (const f of conversationMemory) {
      total += estimateTokens(f.key) + estimateValueTokens(f.value) + 6;
    }

    for (const s of summaryMemory) {
      total += estimateTokens(s.period) + estimateTokens(s.summaryText) + estimateValueTokens(s.metrics) + 6;
    }

    return total;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Private — prompt formatting
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build the system prompt string from memory sections.
   *
   * Format injected into the AI:
   * ┌─────────────────────────────────────────────────────────────┐
   * │ You are a smart financial assistant …                        │
   * │                                                             │
   * │ ## User Preferences                                         │
   * │ - default_currency: SAR                                     │
   * │ - preferred_language: arabic                                │
   * │                                                             │
   * │ ## Conversation Context                                     │
   * │ - current_topic: grocery tracking                           │
   * └─────────────────────────────────────────────────────────────┘
   *
   * @param {AiContext} context
   * @returns {string}
   */
  _buildSystemPrompt(context) {
    const lines = [];

    // ── Time awareness ────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    // ── Base persona ──────────────────────────────────────────────────────
    lines.push(
      "You are a smart financial assistant that helps users track their expenses and income.",
      "Extract transaction data when mentioned. Respond concisely in the user's language.",
      "Always format your response as a valid JSON object matching this structure:",
      '{"message": "your main response text to the user", "insights": ["insight 1", "insight 2"], "actions": ["action 1"]}',
      "Do NOT use markdown code blocks around the JSON. Return only the raw JSON.",
      `Today's date is: ${today}.`
    );

    // ── Global memory section ─────────────────────────────────────────────
    if (context.globalMemory.length > 0) {
      lines.push("", "## User Preferences & Memory");
      for (const fact of context.globalMemory) {
        const value =
          typeof fact.value === "object"
            ? JSON.stringify(fact.value)
            : String(fact.value);
        lines.push(`- ${fact.key}: ${value}`);
      }
    }

    // ── Conversation memory section ───────────────────────────────────────
    if (context.conversationMemory.length > 0) {
      lines.push("", "## Current Conversation Context");
      for (const fact of context.conversationMemory) {
        const value =
          typeof fact.value === "object"
            ? JSON.stringify(fact.value)
            : String(fact.value);
        lines.push(`- ${fact.key}: ${value}`);
      }
    }

    // ── Summary memory section ────────────────────────────────────────────
    if (context.summaryMemory.length > 0) {
      lines.push("", "## High-Level Summaries");
      for (const s of context.summaryMemory) {
        lines.push(`- Period: ${s.period}`);
        lines.push(`  Summary: ${s.summaryText}`);
        if (s.metrics) lines.push(`  Metrics: ${JSON.stringify(s.metrics)}`);
      }
    }

    // ── Diagnostic footnote (only in non-production) ──────────────────────
    if (process.env.NODE_ENV !== "production") {
      lines.push(
        "",
        `<!-- context: ${context.meta.messageCount} msgs, ` +
          `${context.meta.globalMemoryCount} global facts, ` +
          `${context.meta.conversationMemoryCount} conv facts, ` +
          `~${context.meta.estimatedTokens} tokens` +
          (context.meta.truncated ? " [TRUNCATED]" : "") +
          " -->",
      );
    }

    return lines.join("\n");
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

const contextBuilderService = new ContextBuilderService();
module.exports = { contextBuilderService, ContextBuilderService };

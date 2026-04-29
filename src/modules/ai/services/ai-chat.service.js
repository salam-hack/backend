"use strict";

/**
 * AiChatService
 *
 * Handles conversational AI completions using the OpenAI Chat Completions API.
 * This is distinct from AiService (which only does transaction extraction).
 *
 * Responsibilities
 * ────────────────
 * • Accept an OpenAI-compatible messages array from ContextBuilderService.
 * • Call the Chat Completions API with retry + exponential back-off.
 * • Track token usage per call.
 * • Fall back to a deterministic mock reply when no API key is configured
 *   (dev / test environments).
 * • Never throw to the caller — always resolve with a reply object.
 *
 * Usage
 * ─────
 *   const messages = contextBuilderService.toOpenAiMessages(context);
 *   const reply    = await aiChatService.generateReply(messages, { userId });
 *   // reply.content  → string sent back to the user
 *   // reply.usage    → { promptTokens, completionTokens, totalTokens }
 *   // reply.mock     → true when the mock fallback was used
 */

const OpenAI = require("openai");
const { env } = require("../../../config/env");

// ─── Tuneable constants ───────────────────────────────────────────────────────

/** Maximum number of retry attempts on transient errors. */
const MAX_RETRIES = 3;

/** Base delay (ms) for the first retry; doubles on each attempt. */
const RETRY_BASE_DELAY_MS = 500;

/** OpenAI API errors that are worth retrying (transient). */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Hard ceiling on completion tokens to avoid runaway costs. */
const MAX_COMPLETION_TOKENS = 1024;

/** Model temperature — lower = more deterministic / focused answers. */
const TEMPERATURE = 0.5;

// ─── Mock replies (used when OPENAI_API_KEY is absent) ────────────────────────

const MOCK_REPLIES = [
  "تم استلام رسالتك. كيف يمكنني مساعدتك في تتبع مصروفاتك اليوم؟",
  "أنا هنا لمساعدتك في تنظيم أموالك. هل تريد تسجيل معاملة جديدة؟",
  "يمكنني مساعدتك في تتبع المصروفات والدخل. فقط أخبرني بالتفاصيل.",
  "حسناً، هل هناك معاملة مالية تريد تسجيلها أو استفسار عن ميزانيتك؟",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decide whether an OpenAI API error is transient and worth retrying.
 * @param {unknown} err
 * @returns {boolean}
 */
function isRetryable(err) {
  if (!err || typeof err !== "object") return false;

  // OpenAI SDK surfaces status on the error object
  const status = err.status ?? err.statusCode ?? err.response?.status;
  if (status && RETRYABLE_STATUS_CODES.has(Number(status))) return true;

  // Network-level errors (no status)
  const code = err.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND")
    return true;

  return false;
}

/**
 * Pick a deterministic mock reply based on the last user message content
 * so that repeated calls with the same message return the same mock.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {string}
 */
function pickMockReply(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const seed = lastUser ? lastUser.content.length : 0;
  return MOCK_REPLIES[seed % MOCK_REPLIES.length];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class AiChatService {
  constructor() {
    /**
     * The OpenAI client instance — null when no API key is configured.
     * All callers must check this.client before making API calls.
     * @type {import("openai").OpenAI | null}
     */
    this.client = (env.openAiApiKey || env.openAiBaseUrl)
      ? new OpenAI({
          apiKey: env.openAiApiKey || "dummy-key-for-local",
          baseURL: env.openAiBaseUrl || undefined,
        })
      : null;

    /** In-memory token usage accumulator (reset on process restart). */
    this._usageStats = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCalls: 0,
      totalErrors: 0,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Generate an AI reply for a conversation.
   *
   * Always resolves — never rejects.  On unrecoverable failure the mock
   * fallback is returned so the user always gets a response.
   *
   * @param {Array<{ role: string, content: string }>} messages
   *   Full message array from ContextBuilderService.toOpenAiMessages().
   *   Must contain at least one { role: "user" } entry.
   *
   * @param {object}  [opts]
   * @param {string}  [opts.userId]       For logging / audit.
   * @param {string}  [opts.model]        Override the default model.
   * @param {number}  [opts.maxTokens]    Override MAX_COMPLETION_TOKENS.
   * @param {number}  [opts.temperature]  Override TEMPERATURE.
   *
   * @returns {Promise<AiReply>}
   *
   * @typedef {object} AiReply
   * @property {string}  content            The assistant's reply text.
   * @property {object}  usage              Token counts.
   * @property {number}  usage.promptTokens
   * @property {number}  usage.completionTokens
   * @property {number}  usage.totalTokens
   * @property {string}  model              Model that produced the reply.
   * @property {boolean} mock               True when the mock fallback was used.
   * @property {number}  latencyMs          Wall-clock time of the API call.
   * @property {number}  attempts           Number of attempts made.
   */
  async generateReply(messages, opts = {}) {
    // ── Validate input ────────────────────────────────────────────────────
    if (!Array.isArray(messages) || messages.length === 0) {
      return this._mockReply(messages, "Empty messages array", 0);
    }

    // ── Use mock when no client is configured ─────────────────────────────
    if (!this.client) {
      return this._mockReply(messages, "No API key configured", 0);
    }

    // ── Call OpenAI with retry ─────────────────────────────────────────────
    const model = opts.model ?? env.openAiModel;
    const maxTokens = opts.maxTokens ?? MAX_COMPLETION_TOKENS;
    const temperature = opts.temperature ?? TEMPERATURE;

    const startMs = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      attempt++;

      try {
        const response = await this.client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });

        // ── Success path ───────────────────────────────────────────────────
        const choice = response.choices?.[0];
        const content = choice?.message?.content?.trim() ?? "";

        if (!content) {
          // The model returned an empty reply — treat as a soft failure
          // and use the mock rather than returning blank to the user.
          console.warn("[AiChat] Empty content from model, using mock");
          return this._mockReply(messages, "Empty model response", attempt);
        }

        const usage = {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        };

        // ── Update in-memory stats ─────────────────────────────────────────
        this._trackUsage(usage);

        const latencyMs = Date.now() - startMs;
        this._log("info", opts.userId, { model, attempt, latencyMs, ...usage });

        return {
          content,
          usage,
          model,
          mock: false,
          latencyMs,
          attempts: attempt,
        };
      } catch (err) {
        lastError = err;
        this._usageStats.totalErrors++;

        const retryable = isRetryable(err);
        const isLastAttempt = attempt >= MAX_RETRIES;

        this._log("warn", opts.userId, {
          attempt,
          retryable,
          status: err.status ?? "unknown",
          message: err.message,
        });

        if (!retryable || isLastAttempt) break;

        // ── Exponential back-off ───────────────────────────────────────────
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    // ── All retries exhausted ─────────────────────────────────────────────
    console.error(
      `[AiChat] All ${MAX_RETRIES} attempts failed:`,
      lastError?.message,
    );
    return this._mockReply(messages, lastError?.message ?? "Unknown error", attempt);
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return the accumulated token usage stats since process start.
   * Useful for admin dashboards / cost monitoring.
   *
   * @returns {object}
   */
  getUsageStats() {
    return { ...this._usageStats };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Private helpers
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build a mock reply for dev/test environments or when the AI fails.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {string} reason   Why the mock is being used (for logging).
   * @param {number} attempts How many API attempts were made before falling back.
   * @returns {AiReply}
   */
  _mockReply(messages, reason, attempts) {
    if (reason && env.nodeEnv !== "production") {
      console.debug(`[AiChat] Mock reply — reason: ${reason}`);
    }

    return {
      content: pickMockReply(messages),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      mock: true,
      latencyMs: 0,
      attempts,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Accumulate token usage into the in-memory stats object.
   * @param {{ promptTokens, completionTokens, totalTokens }} usage
   */
  _trackUsage(usage) {
    this._usageStats.totalPromptTokens += usage.promptTokens;
    this._usageStats.totalCompletionTokens += usage.completionTokens;
    this._usageStats.totalCalls++;
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Structured logger — uses console.info/warn in dev, suppressed in prod
   * unless it's a warning.
   *
   * @param {"info"|"warn"|"error"} level
   * @param {string|undefined}      userId
   * @param {object}                data
   */
  _log(level, userId, data) {
    if (level === "info" && env.nodeEnv === "production") return;

    const prefix = `[AiChat]${userId ? ` user=${userId}` : ""}`;
    const payload = JSON.stringify(data);

    if (level === "warn") console.warn(prefix, payload);
    else console.log(prefix, payload);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

const aiChatService = new AiChatService();
module.exports = { aiChatService, AiChatService };

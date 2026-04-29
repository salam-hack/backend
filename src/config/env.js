"use strict";

require("dotenv").config();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read a required string env variable.
 * Throws a descriptive error at startup if it is missing or empty.
 *
 * @param {string} key
 * @returns {string}
 */
function required(key) {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[ENV] Missing required environment variable: "${key}"\n` +
        `      Copy .env.example to .env and fill in all required values.`,
    );
  }
  return value.trim();
}

/**
 * Read an optional string env variable with a fallback default.
 *
 * @param {string} key
 * @param {string} defaultValue
 * @returns {string}
 */
function optional(key, defaultValue) {
  const value = process.env[key];
  return value && value.trim() !== "" ? value.trim() : defaultValue;
}

/**
 * Read an optional integer env variable with a fallback default.
 * Throws if the value is present but not a valid integer.
 *
 * @param {string} key
 * @param {number} defaultValue
 * @returns {number}
 */
function optionalInt(key, defaultValue) {
  const raw = process.env[key];
  if (!raw || raw.trim() === "") return defaultValue;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed)) {
    throw new Error(
      `[ENV] Environment variable "${key}" must be an integer, got: "${raw}"`,
    );
  }
  return parsed;
}

/**
 * Read an optional boolean env variable.
 * Accepts "true" / "1" as true, anything else as false.
 *
 * @param {string} key
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function optionalBool(key, defaultValue) {
  const raw = process.env[key];
  if (!raw || raw.trim() === "") return defaultValue;
  return raw.trim() === "true" || raw.trim() === "1";
}

// ─── Build env object ─────────────────────────────────────────────────────────

/**
 * All application configuration, sourced exclusively from environment variables.
 *
 * Rules
 * ─────
 * • `required()` — must be present; process exits with a clear message if not.
 * • `optional()` — safe default is used when absent.
 * • No logic that changes behaviour should live here — just raw config values.
 *
 * Add every new env variable here; never read `process.env` directly in
 * application code.
 */
const env = Object.freeze({
  // ── Runtime ──────────────────────────────────────────────────────────────
  nodeEnv: optional("NODE_ENV", "development"),
  port: optionalInt("PORT", 3000),

  // ── Computed flags (derived — not read from env directly) ─────────────────
  get isProduction() {
    return this.nodeEnv === "production";
  },
  get isDevelopment() {
    return this.nodeEnv === "development";
  },
  get isTest() {
    return this.nodeEnv === "test";
  },

  // ── Database ──────────────────────────────────────────────────────────────
  databaseUrl: required("DATABASE_URL"),

  // ── JWT ───────────────────────────────────────────────────────────────────
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: optional("JWT_ACCESS_EXPIRES_IN", "15m"),
  jwtRefreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "30d"),

  // ── App defaults ──────────────────────────────────────────────────────────
  defaultCurrency: optional("DEFAULT_CURRENCY", "EGP"),

  // ── CORS ──────────────────────────────────────────────────────────────────
  /**
   * Comma-separated list of allowed origins, e.g.:
   *   CORS_ORIGINS=https://app.example.com,https://admin.example.com
   * Leave empty to allow all origins (development only).
   */
  corsOrigins: optional("CORS_ORIGINS", ""),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  /** Requests per minute for general API routes. */
  rateLimitGeneral: optionalInt("RATE_LIMIT_GENERAL", 120),

  /** Requests per minute for auth routes (stricter). */
  rateLimitAuth: optionalInt("RATE_LIMIT_AUTH", 20),

  // ── OpenAI ────────────────────────────────────────────────────────────────
  /** Optional — AI features degrade gracefully when absent. */
  openAiApiKey: optional("OPENAI_API_KEY", ""),
  openAiBaseUrl: optional("OPENAI_BASE_URL", ""),
  openAiModel: optional("OPENAI_MODEL", "gpt-4o-mini"),
});

// ─── Validate insecure defaults in production ─────────────────────────────────

if (env.isProduction) {
  const insecureDefaults = [
    ["JWT_ACCESS_SECRET", env.jwtAccessSecret, "change-me-access-secret"],
    ["JWT_REFRESH_SECRET", env.jwtRefreshSecret, "change-me-refresh-secret"],
  ];

  for (const [key, value, insecureValue] of insecureDefaults) {
    if (value === insecureValue) {
      throw new Error(
        `[ENV] "${key}" is set to its insecure default value in production.\n` +
          `      Generate a strong random secret and set it in your environment.`,
      );
    }
  }

  if (!env.corsOrigins) {
    console.warn(
      "[ENV] Warning: CORS_ORIGINS is not set in production. " +
        "All origins are allowed, which may be a security risk.",
    );
  }
}

module.exports = { env };

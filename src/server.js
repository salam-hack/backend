"use strict";

// ─── Load env first — before any other module reads process.env ───────────────
require("dotenv").config();

const http = require("http");

// env validation runs on require — will throw and exit if required vars missing
const { env } = require("./config/env");
const { app } = require("./app");
const { prisma } = require("./prisma/client");

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * How long (ms) to wait for in-flight requests to finish before forcing
 * the process to exit during graceful shutdown.
 */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * How long (ms) to wait for each dependency health-check during startup
 * before marking it as failed.
 */
const STARTUP_CHECK_TIMEOUT_MS = 5_000;

// ─── Server instance ──────────────────────────────────────────────────────────

const server = http.createServer(app);

// Keep-alive and headers timeout — protect against Slowloris attacks
server.keepAliveTimeout = 65_000; // slightly above AWS ELB's 60 s
server.headersTimeout = 66_000; // must be > keepAliveTimeout

// ══════════════════════════════════════════════════════════════════════════════
//  Startup — validate dependencies before accepting traffic
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Run a promise with a timeout.
 * Rejects with a descriptive error when the deadline is exceeded.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number}     ms
 * @param {string}     label   Human-readable name for error messages.
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} check timed out after ${ms} ms`)),
      ms,
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

/**
 * Verify the PostgreSQL connection.
 * @returns {Promise<void>}
 */
async function checkDatabase() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  log("info", "[DB]      PostgreSQL connected ✓");
}


/**
 * Run all startup checks.
 * Critical checks (database) abort startup on failure.
 *
 * @returns {Promise<void>}
 */
async function runStartupChecks() {
  log("info", "[STARTUP] Running dependency checks…");

  // ── Critical: PostgreSQL ──────────────────────────────────────────────────
  try {
    await withTimeout(checkDatabase(), STARTUP_CHECK_TIMEOUT_MS, "Database");
  } catch (err) {
    log("error", `[DB]      FAILED — ${err.message}`);
    throw new Error("Cannot connect to PostgreSQL. Aborting startup.");
  }

  // ── Optional: AI services configured ──────────────────────────────────────
  log("info", `[AI]      AI Chatbot URL: ${env.aiChatbotUrl}`);
  log("info", `[AI]      AI Parser URL: ${env.aiParserUrl}`);

  log("info", "[STARTUP] All checks passed ✓");
}

// ══════════════════════════════════════════════════════════════════════════════
//  Graceful shutdown
// ══════════════════════════════════════════════════════════════════════════════

/** True once a shutdown has been initiated — prevents duplicate runs. */
let isShuttingDown = false;

/**
 * Gracefully stop the server:
 *  1. Stop accepting new connections.
 *  2. Wait for in-flight requests to finish (up to SHUTDOWN_TIMEOUT_MS).
 *  3. Close the Prisma connection.
 *  4. Exit with the given code.
 *
 * @param {string} signal  Signal or reason that triggered the shutdown.
 * @param {number} code    Process exit code (0 = clean, 1 = error).
 */
async function shutdown(signal, code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log("info", `\n[SHUTDOWN] Received ${signal}. Shutting down gracefully…`);

  // Force-exit if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    log("error", "[SHUTDOWN] Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Don't let this timer keep the process alive
  forceExitTimer.unref();

  try {
    // Stop accepting new HTTP connections; wait for existing ones to finish
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    log("info", "[SHUTDOWN] HTTP server closed ✓");

    // Close the database connection pool
    await prisma.$disconnect();
    log("info", "[SHUTDOWN] Database disconnected ✓");

    clearTimeout(forceExitTimer);
    log("info", "[SHUTDOWN] Goodbye.");
    process.exit(code);
  } catch (err) {
    log("error", `[SHUTDOWN] Error during shutdown: ${err.message}`);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Process signal & error handlers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * SIGTERM — sent by Docker / Kubernetes / systemd when stopping the container.
 */
process.on("SIGTERM", () => shutdown("SIGTERM", 0));

/**
 * SIGINT — sent by Ctrl+C in the terminal.
 */
process.on("SIGINT", () => shutdown("SIGINT", 0));

/**
 * SIGUSR2 — sent by nodemon when restarting.
 * We need to shut down cleanly before nodemon restarts the process.
 */
process.once("SIGUSR2", async () => {
  await shutdown("SIGUSR2 (nodemon restart)", 0);
  process.kill(process.pid, "SIGUSR2");
});

/**
 * unhandledRejection — a Promise was rejected with no .catch() handler.
 * Log it and exit so the process manager restarts the app rather than
 * leaving it running in an unknown state.
 */
process.on("unhandledRejection", (reason) => {
  log("error", "[PROCESS] Unhandled promise rejection:");
  console.error(reason);
  shutdown("unhandledRejection", 1);
});

/**
 * uncaughtException — a synchronous error was thrown outside a try/catch.
 * This is always fatal — the process state is undefined after this point.
 */
process.on("uncaughtException", (err) => {
  log("error", `[PROCESS] Uncaught exception: ${err.message}`);
  console.error(err.stack);
  shutdown("uncaughtException", 1);
});

// ══════════════════════════════════════════════════════════════════════════════
//  Logger helper  (keeps server.js free of a logging dependency)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal structured logger for startup / shutdown messages.
 * Uses console so it works without any third-party library.
 *
 * @param {"info"|"warn"|"error"} level
 * @param {string}                message
 */
function log(level, message) {
  const ts = new Date().toISOString();
  if (level === "error") {
    console.error(`${ts} ERROR ${message}`);
  } else if (level === "warn") {
    console.warn(`${ts} WARN  ${message}`);
  } else {
    console.log(`${ts} INFO  ${message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Bootstrap
// ══════════════════════════════════════════════════════════════════════════════

async function bootstrap() {
  // ── 1. Validate dependencies ────────────────────────────────────────────────
  await runStartupChecks();

  // ── 2. Start the HTTP server ────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    server.listen(env.port, (err) => (err ? reject(err) : resolve()));

    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${env.port} is already in use. ` +
              `Set a different PORT in your .env file.`,
          ),
        );
      } else {
        reject(err);
      }
    });
  });
}

bootstrap().catch((err) => {
  log("error", `[STARTUP] Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

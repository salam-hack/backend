"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const { env } = require("./config/env");
const { errorHandler } = require("./common/middleware/error-handler");
const { notFoundHandler } = require("./common/middleware/not-found-handler");

const { usersRouter } = require("./modules/users/controllers/users.controller");
const { aiToolsRouter } = require("./modules/ai/controllers/ai-tools.controller");
const { homeRouter } = require("./modules/home/controllers/home.controller");
const { chatRouter } = require("./modules/chat/controllers/chat.controller");

 // ─── App instance ─────────────────────────────────────────────────────────────

const app = express();

// ─── Trust proxy (required for rate-limit + IP detection behind load balancer) ─

app.set("trust proxy", 1);

// ══════════════════════════════════════════════════════════════════════════════
//  1.  SECURITY HEADERS  (helmet)
// ══════════════════════════════════════════════════════════════════════════════

app.use(
  helmet({
    // Prevent browsers from sniffing the content-type
    noSniff: true,
    // Only allow the app to be framed by same origin
    frameguard: { action: "sameorigin" },
    // Enforce HTTPS in production
    hsts: env.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    // Disable the X-Powered-By header (hide Express)
    hidePoweredBy: true,
    // Relaxed CSP — tighten per-project as needed
    contentSecurityPolicy: env.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
  }),
);

// ══════════════════════════════════════════════════════════════════════════════
//  2.  CORS - DISABLED FOR TESTING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * CORS DISABLED: Allow all origins for easy testing
 */
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-User-Id"],
  exposedHeaders: ["X-Request-ID"],
  maxAge: 86_400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ══════════════════════════════════════════════════════════════════════════════
//  3.  REQUEST ID  (trace every request through logs)
// ══════════════════════════════════════════════════════════════════════════════

app.use((req, res, next) => {
  // Honour an incoming X-Request-ID (from a gateway / client) or generate one
  const requestId =
    (req.headers["x-request-id"] || "").trim() || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
//  4.  LOGGING  (morgan)
// ══════════════════════════════════════════════════════════════════════════════

// Custom token: attach request ID to every log line
morgan.token("request-id", (req) => req.requestId);
morgan.token("user-id", (req) => req.user?.userId ?? "-");

const morganFormat = env.isProduction
  ? // JSON-like structured line for log aggregators (Datadog, CloudWatch, …)
    ':remote-addr - :user-id [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" id=:request-id time=:response-time ms'
  : // Human-readable in development
    "[:request-id] :method :url :status :response-time ms";

app.use(morgan(morganFormat));

// ══════════════════════════════════════════════════════════════════════════════
//  5.  BODY PARSING
// ══════════════════════════════════════════════════════════════════════════════

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ══════════════════════════════════════════════════════════════════════════════
//  6.  RATE LIMITING - DISABLED FOR TESTING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * RATE LIMITING DISABLED: No limits for easy testing
 */

// Create unlimited rate limiters (effectively disabled)
const generalLimiter = (req, res, next) => next(); // No limit
const authLimiter = (req, res, next) => next();    // No limit
const aiLimiter = (req, res, next) => next();      // No limit

// No rate limiting applied to any routes

// ══════════════════════════════════════════════════════════════════════════════
//  7.  HEALTH CHECKS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /health
 *
 * Shallow liveness probe — used by Docker / Kubernetes to confirm the
 * process is running.  Returns 200 immediately with no DB check.
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: env.nodeEnv,
  });
});

/**
 * GET /health/ready
 *
 * Deep readiness probe — checks every critical dependency.
 * Returns 200 only when the app is fully ready to serve traffic.
 * Used by load balancers to decide whether to route requests here.
 */
app.get("/health/ready", async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // ── PostgreSQL ────────────────────────────────────────────────────────────
  try {
    const { prisma } = require("./prisma/client");
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok" };
  } catch (err) {
    allHealthy = false;
    checks.database = { status: "error", message: err.message };
  }

  // ── AI Services (external) ────────────────────────────────────────────────
  checks.ai = {
    status: "ok",
    chatbot_url: env.aiChatbotUrl,
    parser_url: env.aiParserUrl,
  };

  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status: allHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  8.  API ROUTES  v1
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Route registry
 * ──────────────
 * AUTHENTICATION DISABLED: All endpoints are now publicly accessible.
 * User context is provided via X-User-Id header or defaults to test user.
 *
 * RATE LIMITING DISABLED: No rate limits for easy testing.
 * CORS DISABLED: All origins allowed.
 */

// ── Home Dashboard ────────────────────────────────────────────────────────────
app.use("/api/home", homeRouter);

// ── Public Transaction Endpoints ───────────────────────────────────────────────

// Public endpoints for frontend
app.post(
  "/api/transactions/add-manual",
  require("express").json(),
  async (req, res) => {
    const { asyncHandler } = require('./common/middleware/async-handler');
    const { successResponse } = require('./common/utils/response');
    const { transactionsService } = require('./modules/transactions/services/transactions.service');

    // Simple validation
    const { userId, title, amount, type, categoryId, date } = req.body;
    if (!userId || !title || !amount || !type || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const data = await transactionsService.addManual(userId, req.body);
      res.status(201).json({
        success: true,
        data: {
          id: data.id,
          title: data.item || data.notes || 'Transaction',
          amount: Number(data.amount),
          currency: data.currency,
          type: data.type,
          categoryId,
          date: data.transactionDate.toISOString().split('T')[0],
          transactionDate: data.transactionDate.toISOString(),
        },
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/transactions/parse-ai",
  require("express").json(),
  async (req, res) => {
    const { transactionsService } = require('./modules/transactions/services/transactions.service');

    const message = req.body.message ?? req.body.text;
    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    try {
      const data = await transactionsService.parseAi(message);
      res.json(data);
    } catch (err) {
      res.status(503).json({ error: "AI_PARSER_UNAVAILABLE" });
    }
  }
);

app.get(
  "/api/transactions/categories",
  async (req, res) => {
    const { transactionsService } = require('./modules/transactions/services/transactions.service');

    try {
      const categories = transactionsService.getCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  "/api/transactions/all",
  async (req, res) => {
    const { prisma } = require('./prisma/client');
    const { getCategoryId, getCategoryName } = require('./modules/transactions/constants/categories');

    try {
      const { userId, limit = '50', offset = '0', type, category, categoryId, from, to } = req.query;
      const limitNum = parseInt(limit, 10) || 50;
      const offsetNum = parseInt(offset, 10) || 0;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Build where clause
      const where = { userId };
      if (type) where.type = type;
      if (category) where.category = category;
      if (categoryId) where.category = getCategoryName(categoryId) || categoryId;
      if (from || to) {
        where.transactionDate = {};
        if (from) where.transactionDate.gte = new Date(from);
        if (to) where.transactionDate.lte = new Date(to);
      }

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        take: limitNum,
        skip: offsetNum,
        select: {
          id: true,
          amount: true,
          currency: true,
          category: true,
          item: true,
          quantity: true,
          type: true,
          source: true,
          rawText: true,
          confidence: true,
          notes: true,
          transactionDate: true,
          createdAt: true,
          rawNote: {
            select: {
              content: true,
              status: true
            }
          }
        }
      });

      // Get total count for pagination
      const total = await prisma.transaction.count({ where });

      const formattedTransactions = transactions.map(tx => ({
        id: tx.id,
        title: tx.item || tx.notes || 'Transaction',
        amount: Number(tx.amount),
        currency: tx.currency,
        type: tx.type,
        categoryId: getCategoryId(tx.category) || 'EXP_OTHER',
        item: tx.item,
        quantity: tx.quantity,
        source: tx.source,
        rawText: tx.rawText,
        confidence: tx.confidence,
        notes: tx.notes,
        date: tx.transactionDate.toISOString().split('T')[0],
        time: tx.transactionDate.toISOString().split('T')[1].split('.')[0],
        transactionDate: tx.transactionDate.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        rawNote: tx.rawNote ? {
          content: tx.rawNote.content,
          status: tx.rawNote.status,
        } : null,
      }));

      res.json({
        success: true,
        data: {
          transactions: formattedTransactions,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < total,
          },
          filters: { type, category, categoryId, from, to },
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  "/api/financial/savings-analysis",
  async (req, res) => {
    const { transactionsService } = require('./modules/transactions/services/transactions.service');
    const { prisma } = require('./prisma/client');

    try {
      const { userId, months = '3' } = req.query;
      const monthsNum = parseInt(months, 10) || 3;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const savingsData = await transactionsService.calculateSavingsRate(userId, monthsNum);

      res.json({
        success: true,
        data: savingsData,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Users ─────────────────────────────────────────────────────────────────────
app.use("/internal/v1/users", usersRouter);

// ── AI Internal Tools ─────────────────────────────────────────────────────────
app.use("/internal/ai-tools", aiToolsRouter);
app.use("/api/chat", chatRouter);



// ══════════════════════════════════════════════════════════════════════════════
//  9.  FALLBACK HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// 404 — must come after all valid routes
app.use(notFoundHandler);

// Global error handler — must be last and must have 4 params
// eslint-disable-next-line no-unused-vars
app.use(errorHandler);

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { app };

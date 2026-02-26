import { env } from "./config/env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { startCrons } from "./services/cron.service.js";
import apiRoutes from "./routes/index.js";
import webhookRoutes from "./routes/webhook.routes.js";

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(morgan("short"));

// ---------------------------------------------------------------------------
// Webhook routes — mounted BEFORE express.json() so they get the raw body.
// Stripe webhook signature verification requires the raw request body.
// ---------------------------------------------------------------------------
app.use("/api/webhooks", webhookRoutes);

// ---------------------------------------------------------------------------
// JSON body parser — applied AFTER webhook routes
// ---------------------------------------------------------------------------
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API v1 routes
// ---------------------------------------------------------------------------
app.use("/api/v1", apiRoutes);

// ---------------------------------------------------------------------------
// Global error handler (must be last middleware)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`Vintus Performance API running on port ${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);

  // Start cron jobs
  startCrons();
});

export default app;

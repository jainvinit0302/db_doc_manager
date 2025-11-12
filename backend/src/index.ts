// ============================================
// backend/src/index.ts
// ============================================
import express from "express";
import cors from "cors";
import { router as dbdocRouter } from "./routes/dbdoc.route.js";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure logs directory exists
if (!fs.existsSync("logs")) fs.mkdirSync("logs");

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ type: ["text/*", "application/x-yaml"], limit: "10mb" }));

// Health check
app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Main DBDoc routes
app.use("/api/dbdoc", dbdocRouter);

// Global error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      errors: [err.message || "Internal Server Error"],
    });
  }
);

app.listen(PORT, () => {
  console.log(`🚀 DBDocManager backend running at http://localhost:${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
});
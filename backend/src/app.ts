// backend/src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import validateRouter from "./routes/validate";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 🔧 Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

// Validation route
app.use("/api/validate", validateRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 404 fallback
app.use("*", (_req, res) => res.status(404).json({ error: "Route not found" }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
  });
}

export default app;

// backend/src/routes/validate.ts
import express, { Request, Response } from "express";
import DBDocValidator from "../validator/validator";

const router = express.Router();
const validator = new DBDocValidator();

/**
 * POST /api/validate
 * Accepts JSON DSL and returns validation result.
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const dsl = req.body;
    const result = validator.validate(dsl);
    res.json(result);
  } catch (err: any) {
    console.error("❌ Validation error:", err);
    res.status(500).json({ error: err?.message || "Validation failed" });
  }
});

export default router;

import express from "express";
import { parseDbDoc } from "../core/parser.js";
import { validateDbDoc } from "../core/validator.js";
import { normalizeDbDoc } from "../core/normalizer.js";

const router = express.Router();

router.post("/parse-validate", (req, res) => {
  try {
    const input = req.body;
    const parsed = parseDbDoc(input);
    validateDbDoc(parsed);
    const normalized = normalizeDbDoc(parsed);

    res.json({ status: "success", parsed, normalized });
  } catch (err: any) {
    res.status(400).json({ status: "error", message: err.message });
  }
});

export default router;

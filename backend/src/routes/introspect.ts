// backend/src/routes/introspect.ts
import express from "express";
import { extractPostgresSchema } from "../schemaExtractors/postgres";
import { extractMongoSchema } from "../schemaExtractors/mongo";
import { relationalToDbdoc, mongoToDbdocSource } from "../converters";

const router = express.Router();

router.post("/introspect", async (req, res) => {
  const { kind, engine, conn, db, schema, collection } = req.body;

  try {
    if (kind === "relational" && engine === "postgres") {
      const dump = await extractPostgresSchema(conn);
      const result = relationalToDbdoc(db, engine, dump);
      res.json(result);
    } else if (kind === "mongodb") {
      const dump = await extractMongoSchema(conn, db, collection);
      const result = mongoToDbdocSource(collection, conn, db, collection, dump);
      res.json(result);
    } else {
      res.status(400).json({ error: "Unsupported database type or engine" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

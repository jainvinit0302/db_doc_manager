import * as express from "express";
import * as cors from "cors";
import { validateDSL } from "./parser";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("🚀 DBDocManager API is running! Use /api/validate to validate DSL files.");
});

app.get("/api/validate", (req, res) => {
  validateDSL("./.dbdoc/retail_dw.yaml");
  res.json({ status: "ok", message: "DSL validated successfully" });
});

app.listen(3000, () => {
  console.log("🚀 Backend API running at http://localhost:3000");
});

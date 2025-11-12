// backend/src/index.ts
import express from "express";
import cors from "cors";
import introspectRouter from "./routes/introspect";

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use("/api", introspectRouter);

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});

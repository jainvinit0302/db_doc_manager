import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dbdocRouter from "./routes/dbdoc.route.js";

const app = express();
app.use(cors());
app.use(bodyParser.text({ type: "text/plain" }));

app.use("/api", dbdocRouter);

app.get("/", (_, res) => res.send("DBDocManager Backend Running ✅"));

const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

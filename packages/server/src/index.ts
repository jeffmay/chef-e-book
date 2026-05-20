import express from "express";
import { syncRouter } from "./routes/sync.js";

const port = Number(process.env["PORT"] ?? 3001);

const app = express();
app.use(express.json());
app.use("/sync", syncRouter);

app.listen(port, () => {
  console.log(`Recipe Book sync server listening on port ${port}`);
});

import express from "express";
import { syncRouter } from "./routes/sync.js";

const PORT = Number(process.env["PORT"] ?? 3001);

const app = express();
app.use(express.json());
app.use("/sync", syncRouter);

app.listen(PORT, () => {
  console.log(`Recipe Book sync server listening on port ${PORT}`);
});

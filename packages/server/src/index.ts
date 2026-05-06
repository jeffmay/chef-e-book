import express from "express";
import { sync_router } from "./routes/sync.js";

const PORT = Number(process.env["PORT"] ?? 3001);

const app = express();
app.use(express.json());
app.use("/sync", sync_router);

app.listen(PORT, () => {
  console.log(`Recipe Book sync server listening on port ${PORT}`);
});

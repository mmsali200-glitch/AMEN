import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./router.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3001"], credentials: true }));
app.use(express.json({ limit: "10mb" }));

// tRPC
app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Health check
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist", "client");
  app.use(express.static(distPath));
  app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, () => {
  console.log(`\n🚀 CFO Intelligence System`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   API:  http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./router.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const app = express();

// ── Global error handlers — prevent crashes ────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[CRASH PREVENTED] uncaughtException:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[CRASH PREVENTED] unhandledRejection:", reason);
});

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));

// tRPC
app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Health check
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString(), uptime: process.uptime() }));

// Frontend
const possiblePaths = [
  path.join(__dirname, "..", "dist", "client"),
  path.join(process.cwd(), "dist", "client"),
];
let distPath = "";
for (const p of possiblePaths) {
  if (fs.existsSync(p)) { distPath = p; break; }
}
if (distPath) {
  app.use(express.static(distPath));
  app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));
  console.log("✓ Serving frontend from:", distPath);
}

// ── Background sync jobs ───────────────────────────────────────────────────
const syncJobs: Record<string, any> = {};

app.post("/bg-sync/start", express.json(), async (req, res) => {
  const { companyId, odooCompanyId, dateFrom, dateTo } = req.body;
  const jobId = `${companyId}-${Date.now()}`;
  syncJobs[jobId] = { status:"running", logs:[], progress:0, done:false };
  res.json({ jobId });

  (async () => {
    try {
      const { runFullSync } = await import("./sync.js");
      await runFullSync({
        companyId: Number(companyId),
        odooCompanyId: Number(odooCompanyId),
        dateFrom, dateTo,
        onProgress: (msg: string) => {
          syncJobs[jobId].logs.push(`[${new Date().toLocaleTimeString("ar")}] ${msg}`);
          const pct = msg.match(/(\d+)%/);
          if (pct) syncJobs[jobId].progress = Number(pct[1]);
          if (syncJobs[jobId].logs.length > 200)
            syncJobs[jobId].logs = syncJobs[jobId].logs.slice(-100);
        }
      });
      syncJobs[jobId].status = "done";
      syncJobs[jobId].done = true;
      syncJobs[jobId].progress = 100;
      syncJobs[jobId].logs.push(`[${new Date().toLocaleTimeString("ar")}] ✅ اكتملت المزامنة`);
    } catch(e: any) {
      syncJobs[jobId].status = "error";
      syncJobs[jobId].done = true;
      syncJobs[jobId].error = e.message;
      syncJobs[jobId].logs.push(`[${new Date().toLocaleTimeString("ar")}] ❌ ${e.message}`);
    }
  })().catch(err => console.error("[BG-SYNC]", err.message));
});

app.get("/bg-sync/status/:jobId", (req, res) => {
  const job = syncJobs[req.params.jobId];
  res.json(job ? { found: true, ...job } : { found: false });
});

// Diagnostic
app.get("/diag-sales/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const dbPath = path.join(__dirname, "..", "data", "cfo.db");
    const client = createClient({ url: `file:${dbPath}` });
    const cid = parseInt(req.params.companyId) || 0;
    const al  = await client.execute(`SELECT count(*) n FROM analytic_lines WHERE company_id=${cid}`).catch(()=>({rows:[{n:0}]}));
    const rev = await client.execute(`SELECT count(*) n, min(date) mn, max(date) mx FROM journal_entry_lines WHERE company_id=${cid} AND account_type='revenue'`).catch(()=>({rows:[{}]}));
    res.json({ analytic_lines:(al.rows[0] as any)?.n||0, revenue_lines:(rev.rows[0] as any)?.n||0, dates:{from:(rev.rows[0] as any)?.mn,to:(rev.rows[0] as any)?.mx} });
  } catch(e:any) { res.json({ error: e.message }); }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 CFO Intelligence System`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   API:  http://localhost:${PORT}/trpc`);
  console.log(`   App:  http://localhost:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Run seeds safely after server starts
  setTimeout(() => {
    import("./seed_bawaba.js").then(({ seedBawaba, fixOdooUrls }) => {
      seedBawaba().catch(e => console.error("[Seed]", e.message));
      fixOdooUrls().catch(e => console.error("[Fix]",  e.message));
    }).catch(e => console.error("[Import seed]", e.message));
  }, 2000);
});

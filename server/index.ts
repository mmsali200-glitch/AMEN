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

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));

// tRPC API
app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Health check
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Serve frontend - check multiple possible paths
const possiblePaths = [
  path.join(__dirname, "..", "dist", "client"),
  path.join(process.cwd(), "dist", "client"),
  path.join(__dirname, "dist", "client"),
];

let distPath = "";
for (const p of possiblePaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
    distPath = p;
    break;
  }
}

if (distPath) {
  console.log(`✓ Serving frontend from: ${distPath}`);
  app.use(express.static(distPath));
  app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));
} else {
  console.log("⚠ Frontend not built yet — API only mode");
  console.log("  Checked paths:", possiblePaths);
  app.get("/", (_, res) => res.json({ 
    message: "CFO Intelligence API is running", 
    status: "ok",
    hint: "Frontend not found. Run: npm run build"
  }));
}

app.listen(PORT, () => {
  console.log(`\n🚀 CFO Intelligence System`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   API:  http://localhost:${PORT}/trpc`);
  console.log(`   App:  http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || "development"}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

// Direct Odoo test endpoint (debug)
app.post("/odoo-test", async (req, res) => {
  try {
    const { url, database, username, password } = req.body;
    const testUrl = url.replace(/\/$/, "");
    const response = await fetch(`${testUrl}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 1,
        params: { db: database, login: username, password }
      }),
    });
    const data = await response.json();
    res.json({ raw: data, uid: data?.result?.uid, error: data?.error });
  } catch (e: any) {
    res.json({ error: e.message });
  }
});

// Quick data check - no auth needed for debugging
app.get("/check/:companyId", async (req, res) => {
  try {
    const cid = parseInt(req.params.companyId);
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
    const dbPath = path.join(__dirname2, "..", "data", "cfo.db");
    const client = createClient({ url: `file:${dbPath}` });

    const entries = await client.execute(`SELECT count(*) as n FROM journal_entries WHERE company_id=${cid}`);
    const lines   = await client.execute(`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${cid}`);
    const noDates = await client.execute(`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${cid} AND (date IS NULL OR date='')`);
    const types   = await client.execute(`SELECT account_type, count(*) as n, sum(debit) as d, sum(credit) as cr FROM journal_entry_lines WHERE company_id=${cid} GROUP BY account_type`);
    const sample  = await client.execute(`SELECT id,journal_entry_id,account_code,account_type,debit,credit,date FROM journal_entry_lines WHERE company_id=${cid} LIMIT 3`);
    const companies = await client.execute(`SELECT id,name FROM companies ORDER BY id`);
    const cfgs    = await client.execute(`SELECT company_id, odoo_company_id, odoo_company_name FROM odoo_configs WHERE company_id=${cid}`);

    res.json({
      company_id: cid,
      all_companies: companies.rows,
      odoo_config: cfgs.rows[0] || null,
      journal_entries: entries.rows[0]?.n,
      journal_lines: lines.rows[0]?.n,
      lines_no_date: noDates.rows[0]?.n,
      type_breakdown: types.rows,
      sample_lines: sample.rows,
    });
  } catch(e:any) {
    res.json({ error: e.message });
  }
});

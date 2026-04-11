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

// ── Data Check & Auto-Fix Endpoint ──────────────────────────────────────────
app.get("/check/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const dbPath = path2.join(__d, "..", "data", "cfo.db");
    const client = createClient({ url: `file:${dbPath}` });
    const cid = parseInt(req.params.companyId) || 0;

    const companies  = await client.execute("SELECT id,name FROM companies ORDER BY id");
    const entries    = await client.execute(`SELECT count(*) as n FROM journal_entries WHERE company_id=${cid}`);
    const lines      = await client.execute(`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${cid}`);
    const noDates    = await client.execute(`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${cid} AND (date IS NULL OR date='')`);
    const noType     = await client.execute(`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${cid} AND (account_type IS NULL OR account_type='' OR account_type='other')`);
    const types      = await client.execute(`SELECT account_type, count(*) as n, round(sum(debit),2) as d, round(sum(credit),2) as c FROM journal_entry_lines WHERE company_id=${cid} GROUP BY account_type ORDER BY n DESC`);
    const dates      = await client.execute(`SELECT min(date) as mn, max(date) as mx FROM journal_entry_lines WHERE company_id=${cid}`);
    const sample     = await client.execute(`SELECT id,journal_entry_id,account_code,account_type,round(debit,2) as debit,round(credit,2) as credit,date FROM journal_entry_lines WHERE company_id=${cid} LIMIT 5`);
    const coaCnt     = await client.execute(`SELECT count(*) as n FROM accounts_coa WHERE company_id=${cid}`).catch(()=>({rows:[{n:0}]}));
    const odoCfg     = await client.execute(`SELECT url,database,odoo_company_id,odoo_company_name FROM odoo_configs WHERE company_id=${cid} LIMIT 1`).catch(()=>({rows:[]}));

    res.json({
      all_companies:   companies.rows,
      odoo_config:     odoCfg.rows[0] || null,
      coa_count:       coaCnt.rows[0]?.n || 0,
      journal_entries: entries.rows[0]?.n || 0,
      journal_lines:   lines.rows[0]?.n || 0,
      lines_no_date:   noDates.rows[0]?.n || 0,
      lines_no_type:   noType.rows[0]?.n || 0,
      date_range:      dates.rows[0] || {},
      type_breakdown:  types.rows,
      sample_lines:    sample.rows,
      is_healthy:      (Number(lines.rows[0]?.n)||0) > 0 && (Number(noDates.rows[0]?.n)||0) === 0,
    });
  } catch(e:any) { res.json({ error: e.message }); }
});

// ── Auto Fix: fill missing dates & account types ──────────────────────────────
app.post("/fix/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const client = createClient({ url: `file:${path2.join(__d, "..", "data", "cfo.db")}` });
    const cid = parseInt(req.params.companyId) || 0;

    // Fix 1: Fill missing dates from parent journal_entries
    const fix1 = await client.execute(`
      UPDATE journal_entry_lines
      SET date = (SELECT date FROM journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id)
      WHERE company_id=${cid} AND (date IS NULL OR date='')`);

    // Fix 2: Classify account_type by code prefix
    const nullType = await client.execute(`SELECT id, account_code, account_name FROM journal_entry_lines WHERE company_id=${cid} AND (account_type IS NULL OR account_type='' OR account_type='other') LIMIT 2000`);
    let fixed2 = 0;
    for (const r of nullType.rows) {
      const code = String(r.account_code||"");
      const name = String(r.account_name||"").toLowerCase();
      let t = "other";
      if (code.startsWith("1"))      t = "assets";
      else if (code.startsWith("2")) t = "liabilities";
      else if (code.startsWith("3")) t = "equity";
      else if (code.startsWith("4")) t = (name.includes("تكلفة")||name.includes("cost"))?"cogs":"revenue";
      else if (code.startsWith("5")) t = "cogs";
      else if (code.startsWith("6")) t = "expenses";
      else if (code.startsWith("7")) t = "other_income";
      else if (code.startsWith("8")) t = "other_expenses";
      if (t !== "other") { await client.execute(`UPDATE journal_entry_lines SET account_type='${t}' WHERE id=${r.id}`); fixed2++; }
    }

    res.json({ fixed_dates: fix1.rowsAffected||0, fixed_types: fixed2, message:"✅ تم الإصلاح" });
  } catch(e:any) { res.json({ error: e.message }); }
});

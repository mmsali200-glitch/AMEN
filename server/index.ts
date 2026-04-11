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

// ── Deep Sync Diagnostic ─────────────────────────────────────────────────────
app.get("/diagnose/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const client = createClient({ url: `file:${path2.join(__d, "..", "data", "cfo.db")}` });
    const cid = parseInt(req.params.companyId) || 0;
    const report: any = { company_id: cid, steps: [] };

    const step = (name: string, data: any) => {
      report.steps.push({ name, ...data });
      console.log(`[DIAG] ${name}:`, JSON.stringify(data).slice(0,150));
    };

    // Step 1: company exists?
    const co = await client.execute(`SELECT * FROM companies WHERE id=${cid} LIMIT 1`);
    step("1_company", { found: co.rows.length > 0, data: co.rows[0] || null });
    if (!co.rows.length) { return res.json(report); }

    // Step 2: odoo config exists?
    const cfg = await client.execute(`SELECT url,database,odoo_company_id,odoo_company_name,is_connected FROM odoo_configs WHERE company_id=${cid} LIMIT 1`).catch(()=>({rows:[]}));
    step("2_odoo_config", { found: cfg.rows.length > 0, data: cfg.rows[0] || null });
    if (!cfg.rows.length) { return res.json(report); }

    // Step 3: journal_entries count
    const je = await client.execute(`SELECT count(*) as n FROM journal_entries WHERE company_id=${cid}`);
    step("3_journal_entries", { count: je.rows[0]?.n || 0 });

    // Step 4: journal_entry_lines count
    const jl = await client.execute(`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${cid}`);
    step("4_journal_lines", { count: jl.rows[0]?.n || 0, problem: Number(jl.rows[0]?.n||0)===0 ? "LINES EMPTY!" : "OK" });

    // Step 5: sample entries (do they have odoo_move_id?)
    const sample = await client.execute(`SELECT id, odoo_move_id, name, date, total_debit FROM journal_entries WHERE company_id=${cid} LIMIT 3`);
    step("5_sample_entries", { rows: sample.rows });

    // Step 6: accounts_coa
    const coa = await client.execute(`SELECT count(*) as n FROM accounts_coa WHERE company_id=${cid}`).catch(()=>({rows:[{n:"TABLE NOT FOUND"}]}));
    step("6_accounts_coa", { count: coa.rows[0]?.n });

    // Step 7: try live Odoo test
    if (cfg.rows.length && cfg.rows[0].url) {
      const { OdooConnector } = await import("./odoo.js");
      const cfgRow = cfg.rows[0] as any;
      const dbRows = await client.execute(`SELECT username, password FROM odoo_configs WHERE company_id=${cid} LIMIT 1`);
      const dbRow = dbRows.rows[0] as any;
      try {
        const conn = new OdooConnector(cfgRow.url, cfgRow.database, dbRow.username, dbRow.password);
        await conn.authenticate();
        step("7_odoo_auth", { success: true, uid: conn.uid, version: conn.getVersionString() });

        // Get one journal entry and its lines
        const odooCompanyId = Number(cfgRow.odoo_company_id) || 1;
        const moves = await conn.getJournalEntries(odooCompanyId, "2024-01-01", "2024-12-31", 3, 0);
        step("8_odoo_moves_sample", { count: moves.length, sample: moves.slice(0,2).map((m:any)=>({id:m.id,name:m.name,date:m.date})) });

        if (moves.length > 0) {
          const lines = await conn.getJournalLines([moves[0].id]);
          step("9_odoo_lines_sample", {
            move_id: moves[0].id,
            lines_count: lines.length,
            sample: lines.slice(0,2).map((l:any)=>({
              account: l.account_id,
              debit: l.debit,
              credit: l.credit,
              date: l.date,
              move_id: l.move_id
            }))
          });
        }
      } catch(e:any) {
        step("7_odoo_auth", { success: false, error: e.message });
      }
    }

    res.json(report);
  } catch(e:any) { res.json({ error: e.message, stack: e.stack?.slice(0,300) }); }
});

// ── Fix Lines: fill account data from accounts_coa ───────────────────────────
app.post("/fix-lines/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const client = createClient({ url: `file:${path2.join(__d, "..", "data", "cfo.db")}` });
    const cid = parseInt(req.params.companyId) || 0;

    // Check what we have
    const sample = await client.execute(`
      SELECT id, account_code, account_name, account_type, debit, credit
      FROM journal_entry_lines WHERE company_id=${cid} LIMIT 5`);
    
    const noCode = await client.execute(`
      SELECT count(*) as n FROM journal_entry_lines 
      WHERE company_id=${cid} AND (account_code IS NULL OR account_code='' OR account_code='0000')`);
    
    const noType = await client.execute(`
      SELECT count(*) as n FROM journal_entry_lines 
      WHERE company_id=${cid} AND (account_type IS NULL OR account_type='' OR account_type='other')`);

    res.json({
      sample_lines: sample.rows,
      no_account_code: noCode.rows[0]?.n || 0,
      no_account_type: noType.rows[0]?.n || 0,
    });
  } catch(e:any) { res.json({ error: e.message }); }
});

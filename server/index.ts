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


// ══ Diagnostic Endpoints ═══════════════════════════════════════════════════════

// فحص شامل لكل الشركات
app.get("/check", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const client = createClient({ url: `file:${path2.join(__d, "..", "data", "cfo.db")}` });

    const cos = await client.execute("SELECT id,name FROM companies ORDER BY id");
    const result: any[] = [];

    for (const co of cos.rows) {
      const cid = co.id;
      const e   = await client.execute(`SELECT count(*) n FROM journal_entries WHERE company_id=${cid}`);
      const l   = await client.execute(`SELECT count(*) n FROM journal_entry_lines WHERE company_id=${cid}`);
      const cfg = await client.execute(`SELECT odoo_company_id, odoo_company_name, url, database FROM odoo_configs WHERE company_id=${cid} LIMIT 1`).catch(()=>({rows:[]}));
      const grp = await client.execute(`SELECT cgm.odoo_company_id, cgm.odoo_company_name FROM company_group_members cgm WHERE cgm.company_id=${cid} LIMIT 1`).catch(()=>({rows:[]}));
      const types = await client.execute(`SELECT account_type, count(*) n FROM journal_entry_lines WHERE company_id=${cid} GROUP BY account_type ORDER BY n DESC`).catch(()=>({rows:[]}));
      const dates = await client.execute(`SELECT min(date) mn, max(date) mx FROM journal_entry_lines WHERE company_id=${cid}`).catch(()=>({rows:[{}]}));

      result.push({
        id: cid, name: co.name,
        entries: e.rows[0]?.n || 0,
        lines: l.rows[0]?.n || 0,
        odoo_config: cfg.rows[0] || null,
        group_member: grp.rows[0] || null,
        type_breakdown: types.rows,
        date_range: dates.rows[0] || {},
        status: Number(l.rows[0]?.n||0) > 0 ? "✅ جاهز" : Number(e.rows[0]?.n||0) > 0 ? "⚠️ قيود بدون سطور" : "❌ لا بيانات"
      });
    }

    // Group info
    const groups = await client.execute("SELECT g.id, g.name, g.odoo_url, g.odoo_database, g.is_connected FROM company_groups g").catch(()=>({rows:[]}));
    const members = await client.execute("SELECT cgm.group_id, cgm.company_id, cgm.odoo_company_id, cgm.odoo_company_name, c.name as co_name FROM company_group_members cgm LEFT JOIN companies c ON c.id=cgm.company_id").catch(()=>({rows:[]}));

    res.json({ companies: result, groups: groups.rows, members: members.rows });
  } catch(e:any) { res.json({ error: e.message }); }
});

// فحص شركة واحدة
app.get("/check/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const client = createClient({ url: `file:${path2.join(__d, "..", "data", "cfo.db")}` });
    const cid = parseInt(req.params.companyId)||0;

    const co    = await client.execute(`SELECT * FROM companies WHERE id=${cid} LIMIT 1`);
    const cfg   = await client.execute(`SELECT * FROM odoo_configs WHERE company_id=${cid} LIMIT 1`).catch(()=>({rows:[]}));
    const grp   = await client.execute(`SELECT cgm.*, cg.name grp_name, cg.odoo_url, cg.odoo_database, cg.odoo_username, cg.odoo_password FROM company_group_members cgm JOIN company_groups cg ON cg.id=cgm.group_id WHERE cgm.company_id=${cid} LIMIT 1`).catch(()=>({rows:[]}));
    const e     = await client.execute(`SELECT count(*) n FROM journal_entries WHERE company_id=${cid}`);
    const l     = await client.execute(`SELECT count(*) n FROM journal_entry_lines WHERE company_id=${cid}`);
    const types = await client.execute(`SELECT account_type, count(*) n, round(sum(debit),2) d, round(sum(credit),2) c FROM journal_entry_lines WHERE company_id=${cid} GROUP BY account_type ORDER BY n DESC`).catch(()=>({rows:[]}));
    const dates = await client.execute(`SELECT min(date) mn, max(date) mx FROM journal_entry_lines WHERE company_id=${cid}`).catch(()=>({rows:[{}]}));
    const sample = await client.execute(`SELECT id,account_code,account_name,account_type,debit,credit,date FROM journal_entry_lines WHERE company_id=${cid} ORDER BY id LIMIT 5`).catch(()=>({rows:[]}));

    res.json({
      company: co.rows[0]||null,
      odoo_config: cfg.rows[0]||null,
      group_config: grp.rows[0]||null,
      entries: e.rows[0]?.n||0,
      lines: l.rows[0]?.n||0,
      type_breakdown: types.rows,
      date_range: dates.rows[0]||{},
      sample_lines: sample.rows,
      diagnosis: Number(l.rows[0]?.n||0)>0 ? "✅ بيانات جاهزة" : Number(e.rows[0]?.n||0)>0 ? "⚠️ قيود موجودة بدون سطور - أعد المزامنة" : "❌ لا توجد بيانات - ابدأ المزامنة"
    });
  } catch(e:any) { res.json({ error: e.message }); }
});

// إصلاح تلقائي
app.post("/fix/:companyId", async (req, res) => {
  try {
    const { createClient } = await import("@libsql/client");
    const path2 = await import("path");
    const { fileURLToPath: ftu } = await import("url");
    const __d = path2.dirname(ftu(import.meta.url));
    const client = createClient({ url: `file:${path2.join(__d, "..", "data", "cfo.db")}` });
    const cid = parseInt(req.params.companyId)||0;

    // Fix 1: dates
    const r1 = await client.execute(`UPDATE journal_entry_lines SET date=(SELECT date FROM journal_entries WHERE journal_entries.id=journal_entry_lines.journal_entry_id) WHERE company_id=${cid} AND (date IS NULL OR date='')`);

    // Fix 2: account_type by code
    const nullType = await client.execute(`SELECT id,account_code,account_name FROM journal_entry_lines WHERE company_id=${cid} AND (account_type IS NULL OR account_type='' OR account_type='other') LIMIT 3000`);
    let fixed2=0;
    for (const r of nullType.rows) {
      const code=String(r.account_code||""); let t="other";
      if(code.startsWith("1"))t="assets"; else if(code.startsWith("2"))t="liabilities";
      else if(code.startsWith("3"))t="equity"; else if(code.startsWith("4"))t="revenue";
      else if(code.startsWith("5"))t="cogs"; else if(code.startsWith("6"))t="expenses";
      else if(code.startsWith("7"))t="other_income"; else if(code.startsWith("8"))t="other_expenses";
      if(t!=="other"){await client.execute(`UPDATE journal_entry_lines SET account_type='${t}' WHERE id=${r.id}`);fixed2++;}
    }
    res.json({ fixed_dates: r1.rowsAffected||0, fixed_types: fixed2 });
  } catch(e:any) { res.json({ error: e.message }); }
});

// مزامنة من command line
app.post("/sync/:companyId/:odooCompanyId", async (req, res) => {
  try {
    const { runFullSync } = await import("./sync.js");
    const cid = parseInt(req.params.companyId)||0;
    const oid = parseInt(req.params.odooCompanyId)||0;
    const { dateFrom="2024-01-01", dateTo="2024-12-31" } = req.body||{};
    const logs: string[] = [];
    const result = await runFullSync({
      companyId: cid, odooCompanyId: oid,
      dateFrom, dateTo,
      onProgress: (msg) => { logs.push(msg); console.log("[SYNC]", msg); }
    });
    res.json({ success:true, ...result, logs });
  } catch(e:any) { res.json({ error: e.message }); }
});

import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const ODOO_URL  = "https://habbaba-giftgates.odoo.com";
const ODOO_DB   = "habbaba-giftgates-main-10032787";
const ODOO_USER = "admin@admin.com";
const ODOO_PASS = "KMM9999";

function getDb() {
  const __d = path.dirname(fileURLToPath(import.meta.url));
  return createClient({ url: `file:${path.join(__d, "..", "data", "cfo.db")}` });
}

async function odooCall(method: string, model: string, args: any[], kwargs: any = {}) {
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc:"2.0", method:"call", id:1, params:{ model, method, args, kwargs } })
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
}

export async function seedBawaba() {
  const db = getDb();
  try {
    // ── 1. إنشاء الجداول ─────────────────────────────────────────────────────
    await db.execute(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, industry TEXT, currency TEXT DEFAULT 'KWD', fiscal_year_start TEXT, tax_number TEXT, address TEXT, contact_email TEXT, contact_phone TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});
    await db.execute(`CREATE TABLE IF NOT EXISTS odoo_configs (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER UNIQUE, url TEXT, database TEXT, username TEXT, password TEXT, odoo_version TEXT, is_connected INTEGER DEFAULT 0, last_tested_at TEXT, created_at TEXT DEFAULT (datetime('now')), odoo_company_id INTEGER, odoo_company_name TEXT)`).catch(()=>{});
    await db.execute(`CREATE TABLE IF NOT EXISTS user_company_access (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, company_id INTEGER, role TEXT, permissions TEXT, allowed_reports TEXT, status TEXT DEFAULT 'active', assigned_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});

    // ── 2. إنشاء شركة البوابة ─────────────────────────────────────────────────
    const existing = await db.execute("SELECT id FROM companies WHERE name='البوابة' LIMIT 1");
    let companyId: number;

    if (existing.rows.length > 0) {
      companyId = Number((existing.rows[0] as any).id);
      console.log("[SEED] ✅ البوابة موجودة ID:", companyId);
    } else {
      const u = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
      const uid = (u.rows[0] as any)?.id || 1;
      const ins = await db.execute({
        sql: `INSERT INTO companies (name, currency, industry, created_by, created_at) VALUES ('البوابة','KWD','retail',?,datetime('now'))`,
        args: [uid]
      });
      companyId = Number(ins.lastInsertRowid);
      console.log("[SEED] ✅ تم إنشاء البوابة ID:", companyId);
    }

    // ── 3. حفظ إعدادات Odoo ───────────────────────────────────────────────────
    await db.execute({
      sql: `INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password, is_connected, odoo_company_id, odoo_company_name, created_at) VALUES (?,?,?,?,?,0,1,'البوابة',datetime('now'))`,
      args: [companyId, ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASS]
    });

    // ── 4. منح الصلاحيات ──────────────────────────────────────────────────────
    const u1 = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
    const uid1 = (u1.rows[0] as any)?.id || 1;
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, status, created_at) VALUES (?,?,'cfo_admin','active',datetime('now'))`,
      args: [uid1, companyId]
    }).catch(()=>{});

    // ── 5. تحقق هل تمت المزامنة مسبقاً ──────────────────────────────────────
    const hasData = await db.execute(`SELECT count(*) n FROM journal_entries WHERE company_id=${companyId}`).catch(()=>({rows:[{n:0}]}));
    const entryCount = Number((hasData.rows[0] as any)?.n || 0);

    if (entryCount > 0) {
      console.log(`[SEED] ✅ البوابة لديها ${entryCount} قيد — لا حاجة للمزامنة`);
      return;
    }

    // ── 6. اكتشاف شركات Odoo ─────────────────────────────────────────────────
    console.log("[SEED] 🔗 الاتصال بـ Odoo لاكتشاف الشركات...");

    let uid: number;
    try {
      uid = await odooCall("authenticate", "res.users", [ODOO_DB, ODOO_USER, ODOO_PASS, {}]);
      if (!uid) throw new Error("فشل تسجيل الدخول");
      console.log("[SEED] ✅ تم الاتصال بـ Odoo, uid:", uid);
    } catch(e: any) {
      console.log("[SEED] ⚠️ لا يمكن الاتصال بـ Odoo الآن:", e.message);
      return;
    }

    // اكتشاف الشركات
    const companies = await odooCall("search_read", "res.company", [[]], { fields:["id","name"], uid }).catch(()=>[]) as any[];
    console.log("[SEED] شركات Odoo:", companies.map((c:any)=>c.name).join(", "));

    // اختيار الشركة المناسبة
    const targetCo = companies.find((c:any) =>
      c.name.includes("Gift") || c.name.includes("البوابة") || c.name.includes("Habbaba")
    ) || companies[0];

    if (!targetCo) { console.log("[SEED] ⚠️ لا توجد شركات في Odoo"); return; }

    const odooCompanyId = targetCo.id;
    console.log(`[SEED] 🎯 سيتم مزامنة: "${targetCo.name}" (ID: ${odooCompanyId})`);

    // تحديث الـ Odoo company ID الصحيح
    await db.execute({
      sql: `UPDATE odoo_configs SET odoo_company_id=?, odoo_company_name=? WHERE company_id=?`,
      args: [odooCompanyId, targetCo.name, companyId]
    });

    // ── 7. تشغيل المزامنة في الخلفية ─────────────────────────────────────────
    console.log("[SEED] 🚀 بدء المزامنة التلقائية في الخلفية...");
    const thisYear = new Date().getFullYear();

    // نشغّل في الخلفية بدون await حتى لا يتأخر startup
    import("./sync.js").then(({ runFullSync }) => {
      runFullSync({
        companyId,
        odooCompanyId,
        dateFrom: `${thisYear - 1}-01-01`,
        dateTo:   new Date().toISOString().split("T")[0],
        onProgress: (msg: string) => console.log("[AUTO-SYNC]", msg)
      }).then(result => {
        console.log(`[SEED] ✅ اكتملت المزامنة التلقائية: ${result.entries} قيد | ${result.lines} سطر`);
      }).catch(e => {
        console.error("[SEED] ❌ فشلت المزامنة التلقائية:", e.message);
      });
    }).catch(e => console.error("[SEED] import error:", e.message));

    console.log("[SEED] ⏳ المزامنة تعمل في الخلفية — التطبيق جاهز الآن");

  } catch(e: any) {
    console.error("[SEED] ❌ خطأ:", e.message);
  }
}

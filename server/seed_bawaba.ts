
// ── seed_bawaba.ts — يُشغَّل تلقائياً عند بدء الخادم ──────────────────────
// يضيف شركة البوابة مع إعدادات Odoo إذا لم تكن موجودة

import { getDbClient } from "./db.js";

const db = getDbClient();

export async function seedBawaba() {
  try {
    // تأكد من وجود الجداول
    await db.execute(`CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      industry TEXT, currency TEXT DEFAULT 'KWD',
      fiscal_year_start TEXT, tax_number TEXT, address TEXT,
      contact_email TEXT, contact_phone TEXT,
      created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});

    await db.execute(`CREATE TABLE IF NOT EXISTS odoo_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER UNIQUE,
      url TEXT, database TEXT, username TEXT, password TEXT,
      odoo_version TEXT, is_connected INTEGER DEFAULT 0,
      last_tested_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      odoo_company_id INTEGER, odoo_company_name TEXT)`).catch(()=>{});

    await db.execute(`CREATE TABLE IF NOT EXISTS user_company_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      company_id INTEGER, role TEXT, permissions TEXT,
      allowed_reports TEXT, status TEXT DEFAULT 'active',
      assigned_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});

    // إضافة شركة البوابة
    const existing = await db.execute("SELECT id FROM companies WHERE name='البوابة' LIMIT 1").catch(()=>({rows:[]}));

    let companyId: number;
    if (existing.rows.length > 0) {
      companyId = Number(existing.rows[0].id);
      console.log("✅ شركة البوابة موجودة مسبقاً ID:", companyId);
    } else {
      // جلب أول مستخدم
      const user1 = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
      const uid = user1.rows[0]?.id || 1;

      const ins = await db.execute({
        sql: `INSERT INTO companies (name, currency, industry, created_by, created_at)
              VALUES ('البوابة', 'KWD', 'retail', ?, datetime('now'))`,
        args: [uid]
      });
      companyId = Number(ins.lastInsertRowid);
      console.log("✅ تم إنشاء شركة البوابة ID:", companyId);
    }

    // حفظ إعدادات Odoo
    await db.execute({
      sql: `INSERT OR REPLACE INTO odoo_configs
            (company_id, url, database, username, password, is_connected, odoo_company_id, odoo_company_name, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
      args: [
        companyId,
        "https://habbaba-giftgates.odoo.com",
        "habbaba-giftgates-main-10032787",
        "admin@admin.com",
        "KMM9999",
        1,
        "البوابة"
      ]
    });
    console.log("✅ تم حفظ إعدادات Odoo لشركة البوابة");

    // منح الصلاحيات
    const user1a = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
    const uid1 = user1a.rows[0]?.id || 1;
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, status, created_at)
            VALUES (?, ?, 'cfo_admin', 'active', datetime('now'))`,
      args: [uid1, companyId]
    }).catch(()=>{});
    console.log("✅ تم منح صلاحيات البوابة للمستخدم الرئيسي");

  } catch(e: any) {
    console.error("seedBawaba error:", e.message);
  }
}

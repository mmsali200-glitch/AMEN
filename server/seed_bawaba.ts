import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

export async function seedBawaba() {
  try {
    const __d = path.dirname(fileURLToPath(import.meta.url));
    const dbPath = path.join(__d, "..", "data", "cfo.db");
    const db = createClient({ url: `file:${dbPath}` });

    // Tables
    await db.execute(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, industry TEXT, currency TEXT DEFAULT 'KWD', fiscal_year_start TEXT, tax_number TEXT, address TEXT, contact_email TEXT, contact_phone TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});
    await db.execute(`CREATE TABLE IF NOT EXISTS odoo_configs (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER UNIQUE, url TEXT, database TEXT, username TEXT, password TEXT, odoo_version TEXT, is_connected INTEGER DEFAULT 0, last_tested_at TEXT, created_at TEXT DEFAULT (datetime('now')), odoo_company_id INTEGER, odoo_company_name TEXT)`).catch(()=>{});
    await db.execute(`CREATE TABLE IF NOT EXISTS user_company_access (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, company_id INTEGER, role TEXT, permissions TEXT, allowed_reports TEXT, status TEXT DEFAULT 'active', assigned_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});

    // شركة البوابة
    const existing = await db.execute("SELECT id FROM companies WHERE name='البوابة' LIMIT 1").catch(()=>({rows:[]}));
    let companyId: number;

    if (existing.rows.length > 0) {
      companyId = Number((existing.rows[0] as any).id);
      console.log("✅ البوابة موجودة ID:", companyId);
    } else {
      const user1 = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
      const uid = (user1.rows[0] as any)?.id || 1;
      const ins = await db.execute({ sql:`INSERT INTO companies (name, currency, industry, created_by, created_at) VALUES ('البوابة', 'KWD', 'retail', ?, datetime('now'))`, args:[uid] });
      companyId = Number(ins.lastInsertRowid);
      console.log("✅ تم إنشاء البوابة ID:", companyId);
    }

    // Odoo config
    await db.execute({
      sql: `INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password, is_connected, odoo_company_id, odoo_company_name, created_at) VALUES (?,?,?,?,?,0,?,?,datetime('now'))`,
      args: [companyId, "https://habbaba-giftgates.odoo.com", "habbaba-giftgates-main-10032787", "admin@admin.com", "KMM9999", 1, "البوابة"]
    });
    console.log("✅ Odoo config محفوظ");

    // Access
    const u1 = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
    const uid1 = (u1.rows[0] as any)?.id || 1;
    await db.execute({ sql:`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, status, created_at) VALUES (?,?,'cfo_admin','active',datetime('now'))`, args:[uid1, companyId] }).catch(()=>{});
    console.log("✅ صلاحيات ممنوحة");


    // ── إضافة شركة اختبار (نسخة من البوابة) ─────────────────────────────
    // شركة الخليج للتجارة = نفس Odoo لكن كشركة اختبار
    const khalij = await db.execute("SELECT id FROM companies WHERE id=1 LIMIT 1").catch(()=>({rows:[]}));
    if (khalij.rows.length > 0) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password, is_connected, odoo_company_id, odoo_company_name, created_at) VALUES (?,?,?,?,?,0,?,?,datetime('now'))`,
        args: [1, "https://habbaba-giftgates.odoo.com", "habbaba-giftgates-main-10032787", "admin@admin.com", "KMM9999", 1, "Gift Gate (اختبار)"]
      });
      const u1b = await db.execute("SELECT id FROM users LIMIT 1").catch(()=>({rows:[{id:1}]}));
      const uid1b = (u1b.rows[0] as any)?.id || 1;
      await db.execute({ sql:`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, status, created_at) VALUES (?,1,'cfo_admin','active',datetime('now'))`, args:[uid1b] }).catch(()=>{});
      console.log("✅ شركة الخليج مهيأة للاختبار (نفس Odoo)");
    }
  } catch(e: any) {
    console.error("seedBawaba error:", e.message);
  }
}

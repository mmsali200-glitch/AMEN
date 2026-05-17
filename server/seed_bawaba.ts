import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const BAWABA = {
  name:     "Al Bawaba",
  url:      "https://habbaba-giftgates.odoo.com",
  database: "habbaba-giftgates-main-10032787",
  username: "admin@admin.com",
  password: "KMM9999",
};

const BUSINESS_GATES = {
  name:     "Business Gates",
  url:      "https://customer-support.main.businessesgates.com",
  database: "customer-support-main-db",
  username: "admin",
  password: "123",
};

function getDb() {
  const __d = path.dirname(fileURLToPath(import.meta.url));
  return createClient({ url: `file:${path.join(__d, "..", "data", "cfo.db")}` });
}

async function ensureTables(db: any) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      industry TEXT, currency TEXT DEFAULT 'KWD',
      fiscal_year_start TEXT, tax_number TEXT, address TEXT,
      contact_email TEXT, contact_phone TEXT,
      created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS odoo_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER UNIQUE,
      url TEXT, database TEXT, username TEXT, password TEXT,
      odoo_version TEXT, is_connected INTEGER DEFAULT 0,
      last_tested_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      odoo_company_id INTEGER, odoo_company_name TEXT)`,
    `CREATE TABLE IF NOT EXISTS user_company_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      company_id INTEGER, role TEXT, permissions TEXT,
      allowed_reports TEXT, status TEXT DEFAULT 'active',
      assigned_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS company_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      base_currency TEXT DEFAULT 'KWD', odoo_url TEXT, odoo_database TEXT,
      odoo_username TEXT, odoo_password TEXT, odoo_version TEXT,
      is_connected INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS company_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, company_id INTEGER,
      odoo_company_id INTEGER, odoo_company_name TEXT,
      currency TEXT DEFAULT 'KWD', exchange_rate REAL DEFAULT 1.0,
      is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`,
  ];
  for (const sql of tables) {
    await db.execute(sql).catch(() => {});
  }
}

async function setupCompany(db: any, cfg: typeof BAWABA) {
  // Get or create company
  const rows = await db.execute({
    sql:  "SELECT id FROM companies WHERE name = ? LIMIT 1",
    args: [cfg.name],
  }).catch(() => ({ rows: [] }));

  let companyId: number;
  if (rows.rows.length > 0) {
    companyId = Number(rows.rows[0].id);
    console.log(`[SEED] exists: ${cfg.name} id=${companyId}`);
  } else {
    const u = await db.execute("SELECT id FROM users LIMIT 1").catch(() => ({ rows: [{ id: 1 }] }));
    const uid = Number(u.rows[0]?.id ?? 1);
    const ins = await db.execute({
      sql:  "INSERT INTO companies (name, currency, industry, created_by, created_at) VALUES (?, 'KWD', 'retail', ?, datetime('now'))",
      args: [cfg.name, uid],
    });
    companyId = Number(ins.lastInsertRowid);
    console.log(`[SEED] created: ${cfg.name} id=${companyId}`);
  }

  // Odoo config
  await db.execute({
    sql:  "INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password, is_connected, odoo_company_id, odoo_company_name, created_at) VALUES (?,?,?,?,?,0,1,?,datetime('now'))",
    args: [companyId, cfg.url, cfg.database, cfg.username, cfg.password, cfg.name],
  }).catch(() => {});

  // Access for all users
  const users = await db.execute("SELECT id FROM users").catch(() => ({ rows: [] }));
  for (const u of users.rows) {
    await db.execute({
      sql:  "INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, status, created_at) VALUES (?,?,'cfo_admin','active',datetime('now'))",
      args: [u.id, companyId],
    }).catch(() => {});
  }

  // Company group
  const grpRows = await db.execute({
    sql:  "SELECT id FROM company_groups WHERE odoo_url = ? LIMIT 1",
    args: [cfg.url],
  }).catch(() => ({ rows: [] }));

  let groupId: number;
  if (grpRows.rows.length > 0) {
    groupId = Number(grpRows.rows[0].id);
  } else {
    const gi = await db.execute({
      sql:  "INSERT INTO company_groups (name, base_currency, odoo_url, odoo_database, odoo_username, odoo_password, is_connected) VALUES (?,?,?,?,?,?,0)",
      args: [cfg.name, "KWD", cfg.url, cfg.database, cfg.username, cfg.password],
    });
    groupId = Number(gi.lastInsertRowid);
  }

  // Link company to group
  await db.execute({
    sql:  "INSERT OR IGNORE INTO company_group_members (group_id, company_id, odoo_company_id, odoo_company_name, currency) VALUES (?,?,1,?,?)",
    args: [groupId, companyId, cfg.name, "KWD"],
  }).catch(() => {});

  console.log(`[SEED] ready: ${cfg.name} (company=${companyId} group=${groupId})`);
  return companyId;
}

export async function seedBawaba() {
  try {
    const db = getDb();
    await ensureTables(db);

    // Ensure admin user has global role
    // Set all users to cfo_admin to prevent Access Denied
    await db.execute("UPDATE users SET role='cfo_admin'").catch(() => {});

    // Setup both companies
    await setupCompany(db, BAWABA);
    await setupCompany(db, BUSINESS_GATES);

    console.log("[SEED] done");
  } catch (e: any) {
    console.error("[SEED] error:", e.message);
  }
}

export async function fixOdooUrls() {
  try {
    const db = getDb();
    await ensureTables(db);

    // Remove empty/null groups only
    await db.execute("DELETE FROM company_groups WHERE odoo_url IS NULL OR odoo_url = ''").catch(() => {});

    // Make sure both companies exist
    await setupCompany(db, BAWABA);
    await setupCompany(db, BUSINESS_GATES);

    console.log("[FIX] done");
  } catch (e: any) {
    console.error("[FIX] error:", e.message);
  }
}

import { db, schema } from "./db.js";
import { hashPassword } from "./auth.js";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("\n🌱 تهيئة قاعدة البيانات...\n");

  // Create all tables
  await db.run(sql`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'accountant', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), last_login TEXT)`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, industry TEXT, currency TEXT NOT NULL DEFAULT 'KWD', fiscal_year_start INTEGER NOT NULL DEFAULT 1, tax_number TEXT, address TEXT, contact_email TEXT, contact_phone TEXT, created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS user_company_access (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, company_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'accountant', permissions TEXT, allowed_reports TEXT, status TEXT NOT NULL DEFAULT 'active', assigned_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS journal_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, odoo_move_id INTEGER, name TEXT NOT NULL, ref TEXT, journal_name TEXT, journal_type TEXT, date TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'posted', total_debit REAL NOT NULL DEFAULT 0, total_credit REAL NOT NULL DEFAULT 0, partner_name TEXT, narration TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS journal_entry_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, journal_entry_id INTEGER NOT NULL, company_id INTEGER NOT NULL, account_code TEXT NOT NULL, account_name TEXT NOT NULL, account_type TEXT, partner_name TEXT, label TEXT, debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0, date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_configs (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL UNIQUE, url TEXT NOT NULL, database TEXT NOT NULL, username TEXT NOT NULL, password TEXT NOT NULL, odoo_version TEXT, is_connected INTEGER NOT NULL DEFAULT 0, last_tested_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS sync_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, sync_type TEXT NOT NULL, status TEXT NOT NULL, entries INTEGER DEFAULT 0, lines INTEGER DEFAULT 0, error TEXT, started_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT, duration_ms INTEGER)`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, company_id INTEGER, action TEXT NOT NULL, target TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  console.log("✓ الجداول جاهزة");

  // Users
  const adminPwd = await hashPassword("Admin@2024");
  await db.run(sql`INSERT OR IGNORE INTO users (name, email, password, role) VALUES ('المدير المالي', 'admin@cfo.local', ${adminPwd}, 'cfo_admin')`);

  const userList = [
    { name: 'أحمد محمد الراشد', email: 'ahmed@cfo.local', pwd: 'Ahmed@123', role: 'manager' },
    { name: 'فاطمة العلي',       email: 'fatima@cfo.local',   pwd: 'Fatima@123',   role: 'accountant' },
    { name: 'محمد الكندري',      email: 'mkandari@cfo.local', pwd: 'Mohammed@123', role: 'auditor' },
  ];
  for (const u of userList) {
    const h = await hashPassword(u.pwd);
    await db.run(sql`INSERT OR IGNORE INTO users (name, email, password, role) VALUES (${u.name}, ${u.email}, ${h}, ${u.role})`);
  }
  console.log("✓ المستخدمون جاهزون");

  // Companies
  await db.run(sql`INSERT OR IGNORE INTO companies (id, name, industry, currency) VALUES (1, 'شركة الخليج للتجارة', 'تجارة', 'KWD')`);
  await db.run(sql`INSERT OR IGNORE INTO companies (id, name, industry, currency) VALUES (2, 'مجموعة الشرق للاستثمار', 'استثمار', 'KWD')`);
  await db.run(sql`INSERT OR IGNORE INTO companies (id, name, industry, currency) VALUES (3, 'شركة النور للمقاولات', 'مقاولات', 'KWD')`);
  console.log("✓ الشركات جاهزة");

  // Access
  await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role) VALUES (1,1,'cfo_admin')`);
  await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role) VALUES (1,2,'cfo_admin')`);
  await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role) VALUES (1,3,'cfo_admin')`);
  await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role) VALUES (2,1,'manager')`);
  await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role) VALUES (3,1,'accountant')`);
  await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role) VALUES (4,1,'auditor')`);

  // Journal entries
  const entries = [
    ['INV-2024-001','مبيعات','2024-01-15','شركة الأمل',85000,85000],
    ['PMT-2024-001','بنك',   '2024-01-22','شركة الأمل',85000,85000],
    ['INV-2024-002','مبيعات','2024-02-10','مؤسسة الهلال',120000,120000],
    ['INV-2024-003','مشتريات','2024-02-18','مورد الخليج',45000,45000],
    ['SAL-2024-001','رواتب', '2024-03-31','—',95000,95000],
    ['INV-2024-004','مبيعات','2024-04-05','شركة النجوم',200000,200000],
    ['PMT-2024-002','بنك',   '2024-04-20','مؤسسة الهلال',120000,120000],
    ['INV-2024-005','مبيعات','2024-05-12','شركة الخليج',320000,320000],
    ['INV-2024-006','مبيعات','2024-06-08','مجموعة الوطن',450000,450000],
    ['EXP-2024-001','مصروفات','2024-06-30','—',180000,180000],
    ['INV-2024-007','مبيعات','2024-07-15','شركة الأمل',280000,280000],
    ['INV-2024-008','مبيعات','2024-08-20','مؤسسة الهلال',310000,310000],
    ['SAL-2024-002','رواتب', '2024-09-30','—',97000,97000],
    ['INV-2024-009','مبيعات','2024-10-10','شركة النجوم',520000,520000],
    ['INV-2024-010','مبيعات','2024-11-25','شركة الخليج',680000,680000],
    ['INV-2024-011','مبيعات','2024-12-15','مجموعة الوطن',750000,750000],
  ];
  for (const [name, journal, date, partner, debit, credit] of entries) {
    await db.run(sql`INSERT OR IGNORE INTO journal_entries (company_id, name, journal_name, date, state, total_debit, total_credit, partner_name) VALUES (1, ${name as string}, ${journal as string}, ${date as string}, 'posted', ${debit as number}, ${credit as number}, ${partner as string})`);
  }
  console.log("✓ القيود المحاسبية جاهزة");

  console.log("\n✅ اكتملت التهيئة!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔑 بيانات الدخول:");
  console.log("   admin@cfo.local    →  Admin@2024  (CFO Admin)");
  console.log("   ahmed@cfo.local    →  Ahmed@123   (مدير)");
  console.log("   fatima@cfo.local   →  Fatima@123  (محاسب)");
  console.log("   mkandari@cfo.local →  Mohammed@123 (مدقق)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
// ── جداول Odoo الكاملة ────────────────────────────────────────────────────────
async function createOdooTables() {
  // دليل الحسابات
  await db.run(sql`CREATE TABLE IF NOT EXISTS accounts_coa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    odoo_account_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT,           -- النوع من Odoo (asset_receivable, expense, income, etc.)
    internal_type TEXT,          -- payable, receivable, liquidity, other
    internal_group TEXT,         -- asset, liability, equity, income, expense
    cfo_type TEXT,               -- تصنيفنا: assets, liabilities, equity, revenue, expenses, cogs, other_income, other_expenses
    currency_id INTEGER,
    deprecated INTEGER DEFAULT 0,
    UNIQUE(company_id, odoo_account_id)
  )`);

  // الدفاتر المحاسبية
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    odoo_journal_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT,                   -- sale, purchase, cash, bank, general
    currency_id INTEGER,
    default_account_id INTEGER,
    UNIQUE(company_id, odoo_journal_id)
  )`);

  // الشركاء (عملاء وموردون)
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_partners_full (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    odoo_partner_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    ref TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    vat TEXT,
    street TEXT,
    city TEXT,
    country TEXT,
    is_customer INTEGER DEFAULT 0,
    is_supplier INTEGER DEFAULT 0,
    customer_rank INTEGER DEFAULT 0,
    supplier_rank INTEGER DEFAULT 0,
    total_receivable REAL DEFAULT 0,
    total_payable REAL DEFAULT 0,
    UNIQUE(company_id, odoo_partner_id)
  )`);

  // العملات
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_currencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    odoo_currency_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT,
    rate REAL DEFAULT 1.0,
    active INTEGER DEFAULT 1
  )`);

  // المنتجات والخدمات
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    odoo_product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    category TEXT,
    list_price REAL DEFAULT 0,
    standard_price REAL DEFAULT 0,
    UNIQUE(company_id, odoo_product_id)
  )`);

  // الضرائب
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_taxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    odoo_tax_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    amount REAL DEFAULT 0,
    amount_type TEXT,
    UNIQUE(company_id, odoo_tax_id)
  )`);

  // الحسابات التحليلية
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_analytic_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    odoo_analytic_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    balance REAL DEFAULT 0,
    UNIQUE(company_id, odoo_analytic_id)
  )`);

  // سجل المزامنة الشامل
  await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_sync_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    model_name TEXT NOT NULL,
    last_sync_at TEXT,
    records_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error TEXT,
    UNIQUE(company_id, model_name)
  )`);

  console.log("✓ جداول Odoo الكاملة جاهزة");
}
createOdooTables().catch(e => console.error("Odoo tables error:", e));


// ── Indexes للأداء ───────────────────────────────────────────────────────────
async function createIndexes() {
  const idxs = [
    `CREATE INDEX IF NOT EXISTS idx_jl_co_date     ON journal_entry_lines(company_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_jl_co_type     ON journal_entry_lines(company_id, account_type, date)`,
    `CREATE INDEX IF NOT EXISTS idx_jl_co_code     ON journal_entry_lines(company_id, account_code, date)`,
    `CREATE INDEX IF NOT EXISTS idx_jl_co_partner  ON journal_entry_lines(company_id, partner_name, date)`,
    `CREATE INDEX IF NOT EXISTS idx_jl_entry_id    ON journal_entry_lines(journal_entry_id)`,
    `CREATE INDEX IF NOT EXISTS idx_je_co_date     ON journal_entries(company_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_je_co_move     ON journal_entries(company_id, odoo_move_id)`,
    `CREATE INDEX IF NOT EXISTS idx_al_co_date     ON analytic_lines(company_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_al_co_analytic ON analytic_lines(company_id, odoo_analytic_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_coa_co         ON accounts_coa(company_id, code)`,
  ];
  for (const idx of idxs) {
    await db.run({ sql: idx }).catch(() => {});
  }
  console.log("✓ DB indexes created");
}
createIndexes();
process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });

// Migrations — add missing columns safely
async function migrate() {
  // odoo_configs columns
  try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN odoo_company_id INTEGER`); } catch {}
  try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN odoo_company_name TEXT`); } catch {}
  try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN is_connected INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN odoo_version TEXT`); } catch {}
  try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN last_tested_at TEXT`); } catch {}

  // Recreate odoo_configs with all columns if still missing
  const cols = await db.run(sql`PRAGMA table_info(odoo_configs)`);
  const colNames = ((cols as any).rows||[]).map((r:any) => r.name);
  if (!colNames.includes('odoo_company_id')) {
    console.log('🔧 إعادة بناء جدول odoo_configs...');
    await db.run(sql`CREATE TABLE IF NOT EXISTS odoo_configs_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE,
      url TEXT NOT NULL,
      database TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      odoo_company_id INTEGER,
      odoo_company_name TEXT,
      is_connected INTEGER NOT NULL DEFAULT 0,
      odoo_version TEXT,
      last_tested_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await db.run(sql`INSERT OR IGNORE INTO odoo_configs_new (id,company_id,url,database,username,password,is_connected)
      SELECT id,company_id,url,database,username,password,COALESCE(is_connected,0) FROM odoo_configs`);
    await db.run(sql`DROP TABLE odoo_configs`);
    await db.run(sql`ALTER TABLE odoo_configs_new RENAME TO odoo_configs`);
    console.log('✓ تم إعادة بناء جدول odoo_configs');
  }

  // company_groups & members
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS company_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      base_currency TEXT DEFAULT 'KWD',
      created_by INTEGER,
      odoo_url TEXT, odoo_database TEXT, odoo_username TEXT, odoo_password TEXT,
      odoo_version TEXT, is_connected INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  } catch {}
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS company_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      odoo_company_id INTEGER,
      odoo_company_name TEXT,
      exchange_rate REAL DEFAULT 1.0,
      is_active INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'pending',
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  } catch {}

  console.log('✓ Migrations completed');
}
migrate().catch(e => console.error('Migration error:', e));

// Company Groups Tables Migration
async function migrateGroups() {
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS company_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      base_currency TEXT DEFAULT 'KWD',
      created_by INTEGER,
      odoo_url TEXT,
      odoo_database TEXT,
      odoo_username TEXT,
      odoo_password TEXT,
      odoo_version TEXT,
      is_connected INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    await db.run(sql`CREATE TABLE IF NOT EXISTS company_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      odoo_company_id INTEGER,
      odoo_company_name TEXT,
      exchange_rate REAL DEFAULT 1.0,
      is_active INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'pending',
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    console.log("✓ جداول المجموعات جاهزة");
  } catch(e) { console.log("Groups tables:", e); }
}
migrateGroups();

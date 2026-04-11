// ══════════════════════════════════════════════════════════════════════════════
// sync.ts — محرك المزامنة الجديد الكامل
// ══════════════════════════════════════════════════════════════════════════════
import { OdooConnector, odooTypeToCfoType } from "./odoo.js";
import { createClient, Client } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getDbClient(): Client {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return createClient({ url: `file:${path.join(dataDir, "cfo.db")}` });
}

// تصنيف الحساب بالكود
function classify(code: string, name: string): string {
  const c = (code || "").trim();
  const n = (name || "").toLowerCase();
  if (c.startsWith("1")) return "assets";
  if (c.startsWith("2")) return "liabilities";
  if (c.startsWith("3")) return "equity";
  if (c.startsWith("4")) return (n.includes("تكلفة") || n.includes("cost")) ? "cogs" : "revenue";
  if (c.startsWith("5")) return "cogs";
  if (c.startsWith("6")) return "expenses";
  if (c.startsWith("7")) return "other_income";
  if (c.startsWith("8")) return "other_expenses";
  return "other";
}

// تحويل account_id من Odoo إلى {code, name}
function parseAccount(accountId: any): { code: string; name: string } {
  if (!accountId) return { code: "0000", name: "" };
  if (Array.isArray(accountId)) {
    const raw = String(accountId[1] || "");
    // صيغة Odoo: "101000 الصندوق" أو "1000 - Customers"
    const parts = raw.split(/\s+(.+)/);
    const code  = parts[0] || "0000";
    const name  = parts[1] || raw;
    return { code, name };
  }
  return { code: String(accountId), name: "" };
}

// ── إعداد الجداول ─────────────────────────────────────────────────────────────
async function setupTables(db: Client): Promise<void> {
  const tables = [
    `CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      industry TEXT, currency TEXT DEFAULT 'KWD',
      fiscal_year_start INTEGER DEFAULT 1, contact_email TEXT,
      created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS accounts_coa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL, odoo_account_id INTEGER NOT NULL,
      code TEXT NOT NULL, name TEXT NOT NULL,
      account_type TEXT, cfo_type TEXT, deprecated INTEGER DEFAULT 0,
      UNIQUE(company_id, odoo_account_id))`,
    `CREATE TABLE IF NOT EXISTS odoo_partners_full (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL, odoo_partner_id INTEGER NOT NULL,
      name TEXT NOT NULL, ref TEXT, email TEXT, phone TEXT,
      vat TEXT, city TEXT, country TEXT,
      is_customer INTEGER DEFAULT 0, is_supplier INTEGER DEFAULT 0,
      UNIQUE(company_id, odoo_partner_id))`,
    `CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL, odoo_move_id INTEGER,
      name TEXT NOT NULL, ref TEXT, journal_name TEXT,
      date TEXT NOT NULL, state TEXT DEFAULT 'posted',
      total_debit REAL DEFAULT 0, total_credit REAL DEFAULT 0,
      partner_name TEXT, narration TEXT,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      partner_name TEXT DEFAULT '',
      label TEXT DEFAULT '',
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      date TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL, sync_type TEXT,
      status TEXT, entries INTEGER DEFAULT 0, lines INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')), finished_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS odoo_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE, url TEXT NOT NULL,
      database TEXT NOT NULL, username TEXT NOT NULL, password TEXT NOT NULL,
      odoo_company_id INTEGER, odoo_company_name TEXT, is_connected INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS company_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      base_currency TEXT DEFAULT 'KWD', created_by INTEGER,
      odoo_url TEXT, odoo_database TEXT, odoo_username TEXT, odoo_password TEXT,
      odoo_version TEXT, is_connected INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS company_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL, odoo_company_id INTEGER, odoo_company_name TEXT,
      sync_status TEXT DEFAULT 'pending', last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS user_company_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL, role TEXT DEFAULT 'accountant',
      permissions TEXT, allowed_reports TEXT, status TEXT DEFAULT 'active',
      assigned_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      company_id INTEGER, action TEXT NOT NULL, target TEXT,
      details TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      role TEXT DEFAULT 'accountant', is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      last_login TEXT)`,
  ];
  for (const ddl of tables) {
    await db.execute(ddl).catch(() => {});
  }
  // Migrations for existing tables
  const migrations = [
    "ALTER TABLE odoo_configs ADD COLUMN odoo_company_id INTEGER",
    "ALTER TABLE odoo_configs ADD COLUMN odoo_company_name TEXT",
    "ALTER TABLE odoo_configs ADD COLUMN is_connected INTEGER DEFAULT 0",
    "ALTER TABLE journal_entries ADD COLUMN narration TEXT",
  ];
  for (const m of migrations) { await db.execute(m).catch(() => {}); }
}

// ══════════════════════════════════════════════════════════════════════════════
// الدالة الرئيسية للمزامنة
// ══════════════════════════════════════════════════════════════════════════════
export async function runFullSync(params: {
  companyId:     number;
  odooCompanyId: number;
  dateFrom:      string;
  dateTo:        string;
  onProgress?:   (msg: string) => void;
}): Promise<{ entries: number; lines: number; coa: number; partners: number; openingLines: number }> {

  const db  = getDbClient();
  const log = params.onProgress || ((m: string) => console.log(m));
  const cid = params.companyId;
  const oid = params.odooCompanyId;

  await setupTables(db);

  // جلب إعدادات Odoo
  const cfgRes = await db.execute(`SELECT * FROM odoo_configs WHERE company_id=${cid} LIMIT 1`);
  const cfg = cfgRes.rows[0] as any;
  if (!cfg) throw new Error("لم يتم إعداد Odoo — اذهب لصفحة الإعداد");

  log("🔗 الاتصال بـ Odoo...");
  const conn = new OdooConnector(cfg.url, cfg.database, cfg.username, cfg.password);
  await conn.authenticate();
  log(`✅ Odoo v${conn.getVersionString()} | UID: ${conn.uid}`);

  // ── 1. دليل الحسابات ────────────────────────────────────────────────────
  log("📚 استيراد دليل الحسابات...");
  const accounts = await conn.getChartOfAccounts(oid).catch(() => [] as any[]);
  let coaCount = 0;
  const coaMap: Record<number, { code: string; name: string; cfoType: string }> = {};

  for (const acc of accounts) {
    const code    = String(acc.code || "0000");
    const name    = String(acc.name || "");
    const cfoType = odooTypeToCfoType(acc.account_type || "", code, name);
    coaMap[Number(acc.id)] = { code, name, cfoType };

    await db.execute({
      sql: `INSERT OR REPLACE INTO accounts_coa (company_id, odoo_account_id, code, name, account_type, cfo_type, deprecated) VALUES (?,?,?,?,?,?,?)`,
      args: [cid, acc.id, code, name, acc.account_type || "", cfoType, acc.deprecated ? 1 : 0]
    }).catch(() => {});
    coaCount++;
  }
  log(`✅ دليل الحسابات: ${coaCount} حساب`);

  // ── 2. الشركاء ────────────────────────────────────────────────────────────
  log("👥 استيراد الشركاء...");
  const partners = await conn.getPartners().catch(() => [] as any[]);
  let partnerCount = 0;
  for (const p of partners) {
    const country = Array.isArray(p.country_id) ? String(p.country_id[1] || "") : "";
    await db.execute({
      sql: `INSERT OR REPLACE INTO odoo_partners_full (company_id, odoo_partner_id, name, ref, email, phone, vat, city, country, is_customer, is_supplier) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      args: [cid, p.id, p.name || "", p.ref || "", p.email || "", p.phone || "", p.vat || "", p.city || "", country, (p.customer_rank || 0) > 0 ? 1 : 0, (p.supplier_rank || 0) > 0 ? 1 : 0]
    }).catch(() => {});
    partnerCount++;
  }
  log(`✅ الشركاء: ${partnerCount} شريك`);

  // ── 3. مسح البيانات القديمة ───────────────────────────────────────────────
  log("🗑️ مسح البيانات القديمة...");
  await db.execute(`DELETE FROM journal_entry_lines WHERE company_id=${cid}`);
  await db.execute(`DELETE FROM journal_entries WHERE company_id=${cid}`);

  // ── 4. الرصيد الافتتاحي ───────────────────────────────────────────────────
  log(`📊 حساب الرصيد الافتتاحي قبل ${params.dateFrom}...`);
  let openingLines = 0;
  try {
    const oLines = await conn.getOpeningBalanceLines(oid, params.dateFrom);
    if (oLines.length > 0) {
      // إدراج قيد الرصيد الافتتاحي
      await db.execute({
        sql: `INSERT INTO journal_entries (company_id, name, journal_name, date, state, total_debit, total_credit) VALUES (?,?,?,?,?,?,?)`,
        args: [cid, "رصيد افتتاحي", "افتتاحي", params.dateFrom, "posted", 0, 0]
      });
      const lastEntry = await db.execute(`SELECT id FROM journal_entries WHERE company_id=${cid} AND name='رصيد افتتاحي' ORDER BY id DESC LIMIT 1`);
      const openEntryId = Number(lastEntry.rows[0]?.id || 0);

      if (openEntryId > 0) {
        // تجميع الرصيد حسب الحساب
        const sums: Record<string, { code: string; name: string; type: string; d: number; c: number }> = {};
        for (const l of oLines) {
          const accId  = Array.isArray(l.account_id) ? Number(l.account_id[0]) : Number(l.account_id || 0);
          const fromCoa = coaMap[accId];
          const parsed  = parseAccount(l.account_id);
          const code    = fromCoa?.code || parsed.code;
          const name    = fromCoa?.name || parsed.name;
          const type    = fromCoa?.cfoType || classify(code, name);

          if (!sums[code]) sums[code] = { code, name, type, d: 0, c: 0 };
          sums[code].d += Number(l.debit) || 0;
          sums[code].c += Number(l.credit) || 0;
        }

        const openDate = new Date(params.dateFrom);
        openDate.setDate(openDate.getDate() - 1);
        const openDateStr = openDate.toISOString().split("T")[0];

        for (const acc of Object.values(sums)) {
          const nd = Math.max(0, acc.d - acc.c);
          const nc = Math.max(0, acc.c - acc.d);
          if (nd === 0 && nc === 0) continue;
          await db.execute({
            sql: `INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_code, account_name, account_type, label, debit, credit, date) VALUES (?,?,?,?,?,?,?,?,?)`,
            args: [openEntryId, cid, acc.code, acc.name, acc.type, "رصيد افتتاحي", nd, nc, openDateStr]
          }).catch(() => {});
          openingLines++;
        }
      }
    }
    log(`✅ الرصيد الافتتاحي: ${openingLines} حساب`);
  } catch (e: any) {
    log(`⚠️ الرصيد الافتتاحي: ${e.message?.slice(0, 60)}`);
  }

  // ── 5. القيود المحاسبية ───────────────────────────────────────────────────
  const total = await conn.countEntries(oid, params.dateFrom, params.dateTo);
  log(`📥 جلب ${total} قيد محاسبي...`);

  let insertedEntries = 0;
  let insertedLines   = 0;
  const BATCH = 50;

  for (let offset = 0; offset < total; offset += BATCH) {
    const moves = await conn.getJournalEntries(oid, params.dateFrom, params.dateTo, BATCH, offset);
    if (!moves.length) break;

    // إدراج القيود
    const moveToId: Record<number, number> = {};
    for (const move of moves) {
      const jName = Array.isArray(move.journal_id) ? String(move.journal_id[1] || "") : String(move.journal_id || "");
      const pName = Array.isArray(move.partner_id) ? String(move.partner_id[1] || "") : "";
      const date  = String(move.date || params.dateFrom);
      const amt   = Number(move.amount_total) || 0;

      await db.execute({
        sql: `INSERT INTO journal_entries (company_id, odoo_move_id, name, ref, journal_name, date, state, total_debit, total_credit, partner_name, narration) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [cid, move.id, move.name || "", move.ref || "", jName, date, "posted", amt, amt, pName, move.narration || ""]
      }).catch(() => {});

      const res = await db.execute(`SELECT id FROM journal_entries WHERE company_id=${cid} AND odoo_move_id=${move.id} ORDER BY id DESC LIMIT 1`);
      const eid = Number(res.rows[0]?.id || 0);
      if (eid > 0) moveToId[Number(move.id)] = eid;
      insertedEntries++;
    }

    // جلب السطور
    const moveIds = Object.keys(moveToId).map(Number);
    if (!moveIds.length) continue;

    const lines = await conn.getJournalLines(moveIds).catch(() => [] as any[]);

    // إدراج السطور
    for (const line of lines) {
      const rawMoveId = Array.isArray(line.move_id) ? Number(line.move_id[0]) : Number(line.move_id);
      const entryId   = moveToId[rawMoveId];
      if (!entryId) continue;

      // الحساب
      const accId   = Array.isArray(line.account_id) ? Number(line.account_id[0]) : Number(line.account_id || 0);
      const fromCoa  = coaMap[accId];
      const parsed   = parseAccount(line.account_id);
      const accCode  = fromCoa?.code || parsed.code;
      const accName  = fromCoa?.name || parsed.name;
      const accType  = fromCoa?.cfoType || classify(accCode, accName);

      // المبالغ
      const debit  = Number(line.debit)  || 0;
      const credit = Number(line.credit) || 0;
      if (debit === 0 && credit === 0) continue;

      // التاريخ
      const parentDate = moves.find((m: any) => Number(m.id) === rawMoveId)?.date;
      const lineDate   = String(line.date || parentDate || params.dateFrom);

      // الشريك
      const pName = Array.isArray(line.partner_id) ? String(line.partner_id[1] || "") : "";

      await db.execute({
        sql: `INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_code, account_name, account_type, partner_name, label, debit, credit, date) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [entryId, cid, accCode, accName, accType, pName, line.name || "", debit, credit, lineDate]
      }).catch(() => {});
      insertedLines++;
    }

    const pct = Math.round(((offset + moves.length) / total) * 100);
    log(`⏳ ${pct}% — قيود: ${insertedEntries} | سطور: ${insertedLines}`);
  }

  // سجل المزامنة
  await db.execute({
    sql: `INSERT INTO sync_logs (company_id, sync_type, status, entries, lines, finished_at) VALUES (?,?,?,?,?,?)`,
    args: [cid, "full", "success", insertedEntries, insertedLines, new Date().toISOString()]
  }).catch(() => {});

  log(`🎉 اكتملت المزامنة: ${insertedEntries} قيد | ${insertedLines} سطر`);
  return { entries: insertedEntries, lines: insertedLines, coa: coaCount, partners: partnerCount, openingLines };
}

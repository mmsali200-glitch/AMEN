import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  name:      text("name").notNull(),
  email:     text("email").notNull().unique(),
  password:  text("password").notNull(),
  role:      text("role").notNull().default("accountant"),
  isActive:  integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  lastLogin: text("last_login"),
});

export const companies = sqliteTable("companies", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  name:            text("name").notNull(),
  industry:        text("industry"),
  currency:        text("currency").notNull().default("KWD"),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1),
  taxNumber:       text("tax_number"),
  address:         text("address"),
  contactEmail:    text("contact_email"),
  contactPhone:    text("contact_phone"),
  createdBy:       integer("created_by"),
  createdAt:       text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const userCompanyAccess = sqliteTable("user_company_access", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  userId:         integer("user_id").notNull(),
  companyId:      integer("company_id").notNull(),
  role:           text("role").notNull().default("accountant"),
  permissions:    text("permissions"),
  allowedReports: text("allowed_reports"),
  status:         text("status").notNull().default("active"),
  assignedBy:     integer("assigned_by"),
  createdAt:      text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const journalEntries = sqliteTable("journal_entries", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  companyId:   integer("company_id").notNull(),
  odooMoveId:  integer("odoo_move_id"),
  name:        text("name").notNull(),
  ref:         text("ref"),
  journalName: text("journal_name"),
  journalType: text("journal_type"),
  date:        text("date").notNull(),
  state:       text("state").notNull().default("posted"),
  totalDebit:  real("total_debit").notNull().default(0),
  totalCredit: real("total_credit").notNull().default(0),
  partnerName: text("partner_name"),
  narration:   text("narration"),
  createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const journalEntryLines = sqliteTable("journal_entry_lines", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  journalEntryId: integer("journal_entry_id").notNull(),
  companyId:      integer("company_id").notNull(),
  accountCode:    text("account_code").notNull(),
  accountName:    text("account_name").notNull(),
  accountType:    text("account_type"),
  partnerName:    text("partner_name"),
  label:          text("label"),
  debit:          real("debit").notNull().default(0),
  credit:         real("credit").notNull().default(0),
  date:           text("date").notNull(),
  createdAt:      text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const odooConfigs = sqliteTable("odoo_configs", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  companyId:    integer("company_id").notNull().unique(),
  url:          text("url").notNull(),
  database:     text("database").notNull(),
  username:     text("username").notNull(),
  password:     text("password").notNull(),
  odooVersion:  text("odoo_version"),
  isConnected:  integer("is_connected").notNull().default(0),
  lastTestedAt: text("last_tested_at"),
  createdAt:    text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const syncLogs = sqliteTable("sync_logs", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  companyId:  integer("company_id").notNull(),
  syncType:   text("sync_type").notNull(),
  status:     text("status").notNull(),
  entries:    integer("entries").default(0),
  lines:      integer("lines").default(0),
  error:      text("error"),
  startedAt:  text("started_at").notNull().default(sql`(datetime('now'))`),
  finishedAt: text("finished_at"),
  durationMs: integer("duration_ms"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  userId:    integer("user_id"),
  companyId: integer("company_id"),
  action:    text("action").notNull(),
  target:    text("target"),
  details:   text("details"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

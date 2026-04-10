import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db, schema } from "./db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, getUserFromToken } from "./auth.js";
import { OdooConnector } from "./odoo.js";

export async function createContext({ req }: { req: any }) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  const user = token ? await getUserFromToken(token) : null;
  return { user, req };
}

type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "cfo_admin") throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح" });
  return next({ ctx });
});

// Helper: classify account
function classifyAccount(code: string, name: string): string {
  if (code.startsWith("1")) return "assets";
  if (code.startsWith("2")) return "liabilities";
  if (code.startsWith("3")) return "equity";
  if (code.startsWith("4")) return (name.includes("تكلفة")||name.toLowerCase().includes("cost")) ? "cogs" : "revenue";
  if (code.startsWith("5")) return "cogs";
  if (code.startsWith("6")) return "expenses";
  if (code.startsWith("7")) return "other_income";
  if (code.startsWith("8")) return "other_expenses";
  return "other";
}

// ── Auth ───────────────────────────────────────────────────────────────────────
const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (!user || !user.isActive) throw new TRPCError({ code:"UNAUTHORIZED", message:"البريد أو كلمة المرور غير صحيحة" });
      const valid = await comparePassword(input.password, user.password);
      if (!valid) throw new TRPCError({ code:"UNAUTHORIZED", message:"البريد أو كلمة المرور غير صحيحة" });
      await db.update(schema.users).set({ lastLogin: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(schema.users.id, user.id));
      const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
      return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code:"NOT_FOUND" });
    const access = await db.select({ companyId: schema.userCompanyAccess.companyId, role: schema.userCompanyAccess.role })
      .from(schema.userCompanyAccess).where(and(eq(schema.userCompanyAccess.userId, user.id), eq(schema.userCompanyAccess.status,"active")));
    return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLogin: user.lastLogin, companyAccess: access };
  }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
      if (!await comparePassword(input.currentPassword, user!.password)) throw new TRPCError({ code:"BAD_REQUEST", message:"كلمة المرور الحالية غير صحيحة" });
      await db.update(schema.users).set({ password: await hashPassword(input.newPassword), updatedAt: new Date().toISOString() }).where(eq(schema.users.id, ctx.user.id));
      return { success: true };
    }),
});

// ── Company ────────────────────────────────────────────────────────────────────
const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "cfo_admin") return db.select().from(schema.companies).orderBy(desc(schema.companies.id));
    const access = await db.select({ companyId: schema.userCompanyAccess.companyId }).from(schema.userCompanyAccess)
      .where(and(eq(schema.userCompanyAccess.userId, ctx.user.id), eq(schema.userCompanyAccess.status,"active")));
    if (!access.length) return [];
    const ids = access.map(a => a.companyId);
    return db.select().from(schema.companies).where(sql`id IN (${ids.join(",")})`);
  }),
  create: adminProcedure
    .input(z.object({ name:z.string().min(2), industry:z.string().optional(), currency:z.string().default("KWD"), contactEmail:z.string().optional(), contactPhone:z.string().optional(), address:z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [co] = await db.insert(schema.companies).values({ ...input, createdBy: ctx.user.id }).returning();
      await db.insert(schema.userCompanyAccess).values({ userId: ctx.user.id, companyId: co.id, role:"cfo_admin", assignedBy: ctx.user.id });
      await db.insert(schema.auditLogs).values({ userId: ctx.user.id, companyId: co.id, action:"create_company", target: co.name });
      return co;
    }),
  delete: adminProcedure
    .input(z.object({ id:z.number() }))
    .mutation(async ({ input }) => { await db.delete(schema.companies).where(eq(schema.companies.id, input.id)); return { success:true }; }),
});

// ── Users ──────────────────────────────────────────────────────────────────────
const usersRouter = router({
  list: adminProcedure.query(async () => {
    const users = await db.select({ id:schema.users.id, name:schema.users.name, email:schema.users.email, role:schema.users.role, isActive:schema.users.isActive, createdAt:schema.users.createdAt, lastLogin:schema.users.lastLogin }).from(schema.users).orderBy(desc(schema.users.id));
    const access = await db.select().from(schema.userCompanyAccess);
    return users.map(u => ({ ...u, companyAccess: access.filter(a => a.userId === u.id) }));
  }),
  create: adminProcedure
    .input(z.object({ name:z.string().min(2), email:z.string().email(), password:z.string().min(8), role:z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (existing.length) throw new TRPCError({ code:"BAD_REQUEST", message:"البريد الإلكتروني مستخدم" });
      const [user] = await db.insert(schema.users).values({ ...input, password: await hashPassword(input.password) }).returning();
      await db.insert(schema.auditLogs).values({ userId: ctx.user.id, action:"create_user", target: user.email });
      return { id:user.id, name:user.name, email:user.email, role:user.role };
    }),
  update: adminProcedure
    .input(z.object({ id:z.number(), name:z.string().optional(), role:z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).optional(), isActive:z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, isActive, ...rest } = input;
      const data: any = { ...rest, updatedAt: new Date().toISOString() };
      if (isActive !== undefined) data.isActive = isActive ? 1 : 0;
      await db.update(schema.users).set(data).where(eq(schema.users.id, id));
      return { success:true };
    }),
  delete: adminProcedure
    .input(z.object({ id:z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) throw new TRPCError({ code:"BAD_REQUEST", message:"لا يمكنك حذف حسابك" });
      await db.delete(schema.users).where(eq(schema.users.id, input.id));
      return { success:true };
    }),
  grantAccess: adminProcedure
    .input(z.object({ userId:z.number(), companyId:z.number(), role:z.string().default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      await db.run(sql`INSERT OR REPLACE INTO user_company_access (user_id, company_id, role, assigned_by, status) VALUES (${input.userId}, ${input.companyId}, ${input.role}, ${ctx.user.id}, 'active')`);
      return { success:true };
    }),
});

// ── Odoo ───────────────────────────────────────────────────────────────────────
const odooRouter = router({
  saveConfig: protectedProcedure
    .input(z.object({ companyId:z.number(), url:z.string(), database:z.string(), username:z.string(), password:z.string() }))
    .mutation(async ({ input }) => {
      await db.run(sql`INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password) VALUES (${input.companyId}, ${input.url}, ${input.database}, ${input.username}, ${input.password})`);
      return { success:true };
    }),

  getConfig: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const result = await db.select().from(schema.odooConfigs).where(eq(schema.odooConfigs.companyId, input.companyId)).limit(1);
      return result[0] || null;
    }),

  testConnection: protectedProcedure
    .input(z.object({ url:z.string(), database:z.string(), username:z.string(), password:z.string() }))
    .mutation(async ({ input }) => {
      const conn = new OdooConnector(input.url, input.database, input.username, input.password);
      const uid = await conn.authenticate();
      const version = await conn.getVersion();
      const companies = await conn.getCompanies();
      return { success:true, uid, version, companies };
    }),

  syncJournals: protectedProcedure
    .input(z.object({ companyId:z.number(), odooCompanyId:z.number().nullable(), dateFrom:z.string(), dateTo:z.string(), syncType:z.string().default("incremental") }))
    .mutation(async ({ input }) => {
      // Get Odoo config
      const configs = await db.select().from(schema.odooConfigs).where(eq(schema.odooConfigs.companyId, input.companyId)).limit(1);
      if (!configs.length) throw new TRPCError({ code:"NOT_FOUND", message:"لم يتم إعداد Odoo لهذه الشركة" });
      const cfg = configs[0];

      const conn = new OdooConnector(cfg.url, cfg.database, cfg.username, cfg.password);
      await conn.authenticate();

      // Count total
      const total = await conn.countEntries(input.odooCompanyId, input.dateFrom, input.dateTo);

      // Full sync: clear existing
      if (input.syncType === "full") {
        await db.run(sql`DELETE FROM journal_entry_lines WHERE company_id = ${input.companyId}`);
        await db.run(sql`DELETE FROM journal_entries WHERE company_id = ${input.companyId}`);
      }

      let inserted = 0;
      const batchSize = 100;
      let offset = 0;

      while (offset < total) {
        const moves = await conn.getJournalEntries(input.odooCompanyId, input.dateFrom, input.dateTo, batchSize, offset);
        if (!moves.length) break;

        for (const move of moves) {
          // Upsert journal entry
          await db.run(sql`INSERT OR REPLACE INTO journal_entries (company_id, odoo_move_id, name, ref, journal_name, date, state, total_debit, total_credit, partner_name) VALUES (${input.companyId}, ${move.id}, ${move.name}, ${move.ref||""}, ${Array.isArray(move.journal_id)?move.journal_id[1]||"":""}, ${move.date}, 'posted', ${move.amount_total||0}, ${move.amount_total||0}, ${Array.isArray(move.partner_id)?move.partner_id[1]||"":""})`);
        }

        // Get lines for this batch
        const moveIds = moves.map((m: any) => m.id);
        const lines = await conn.getJournalLines(moveIds);

        for (const line of lines) {
          const entryResult = await db.select({ id: schema.journalEntries.id }).from(schema.journalEntries)
            .where(and(eq(schema.journalEntries.companyId, input.companyId), eq(schema.journalEntries.odooMoveId as any, line.move_id[0])))
            .limit(1);
          if (!entryResult.length) continue;
          const accountCode = Array.isArray(line.account_id) ? line.account_id[1]?.split(" ")[0] || "0000" : "0000";
          const accountName = Array.isArray(line.account_id) ? line.account_id[1]?.replace(/^\S+\s/, "") || "" : "";
          const accountType = classifyAccount(accountCode, accountName);
          await db.run(sql`INSERT OR IGNORE INTO journal_entry_lines (journal_entry_id, company_id, account_code, account_name, account_type, partner_name, label, debit, credit, date) VALUES (${entryResult[0].id}, ${input.companyId}, ${accountCode}, ${accountName}, ${accountType}, ${Array.isArray(line.partner_id)?line.partner_id[1]||"":""}, ${line.name||""}, ${line.debit||0}, ${line.credit||0}, ${line.date||""})`);
        }

        inserted += moves.length;
        offset += batchSize;
      }

      // Log
      await db.run(sql`INSERT INTO sync_logs (company_id, sync_type, status, entries, finished_at) VALUES (${input.companyId}, ${input.syncType}, 'success', ${inserted}, ${new Date().toISOString()})`);

      return { success:true, total, inserted };
    }),

  getSyncProgress: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const [log] = await db.select().from(schema.syncLogs).where(eq(schema.syncLogs.companyId, input.companyId)).orderBy(desc(schema.syncLogs.startedAt)).limit(1);
      const [{ entries }] = await db.select({ entries: sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      const [{ lines }] = await db.select({ lines: sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId));
      return { lastSync: log || null, totalEntries: entries, totalLines: lines };
    }),
});

// ── Journal ────────────────────────────────────────────────────────────────────
const journalRouter = router({
  listEntries: protectedProcedure
    .input(z.object({ companyId:z.number(), page:z.number().default(1), limit:z.number().default(20) }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;
      const entries = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId)).orderBy(desc(schema.journalEntries.date)).limit(input.limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      return { entries, total: count, page: input.page, pages: Math.ceil(count / input.limit) };
    }),

  syncStatus: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const [lastSync] = await db.select().from(schema.syncLogs).where(eq(schema.syncLogs.companyId, input.companyId)).orderBy(desc(schema.syncLogs.startedAt)).limit(1);
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      const [{ lines }] = await db.select({ lines: sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId));
      return { lastSync, totalEntries: total, totalLines: lines };
    }),

  trialBalance: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const opening = await db.select({
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        accountType: schema.journalEntryLines.accountType,
        openDebit: sql<number>`sum(debit)`,
        openCredit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} < ${input.dateFrom}`))
        .groupBy(schema.journalEntryLines.accountCode);

      const movement = await db.select({
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        accountType: schema.journalEntryLines.accountType,
        mvtDebit: sql<number>`sum(debit)`,
        mvtCredit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`))
        .groupBy(schema.journalEntryLines.accountCode);

      const map: Record<string,any> = {};
      for (const o of opening) map[o.accountCode] = { accountCode:o.accountCode, accountName:o.accountName, accountType:o.accountType||classifyAccount(o.accountCode, o.accountName), openDebit:o.openDebit||0, openCredit:o.openCredit||0, mvtDebit:0, mvtCredit:0 };
      for (const m of movement) {
        if (!map[m.accountCode]) map[m.accountCode] = { accountCode:m.accountCode, accountName:m.accountName, accountType:m.accountType||classifyAccount(m.accountCode, m.accountName), openDebit:0, openCredit:0 };
        map[m.accountCode].mvtDebit = m.mvtDebit||0;
        map[m.accountCode].mvtCredit = m.mvtCredit||0;
      }
      return Object.values(map).map((r:any) => ({
        ...r,
        closingDebit: Math.max(0, (r.openDebit - r.openCredit) + (r.mvtDebit - r.mvtCredit)),
        closingCredit: Math.max(0, (r.openCredit - r.openDebit) + (r.mvtCredit - r.mvtDebit)),
      })).sort((a,b) => a.accountCode.localeCompare(b.accountCode));
    }),

  incomeStatement: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select({
        accountType: schema.journalEntryLines.accountType,
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        debit: sql<number>`sum(debit)`,
        credit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`))
        .groupBy(schema.journalEntryLines.accountCode);

      let revenue=0, cogs=0, expenses=0, otherIncome=0, otherExpenses=0;
      const details: Record<string,any[]> = { revenue:[], cogs:[], expenses:[], other_income:[], other_expenses:[] };

      for (const r of rows) {
        const type = r.accountType || classifyAccount(r.accountCode, r.accountName);
        const net = (r.credit||0) - (r.debit||0);
        if (type==="revenue") { revenue += net; details.revenue.push({...r, net}); }
        else if (type==="cogs") { cogs += Math.abs(net); details.cogs.push({...r, net:Math.abs(net)}); }
        else if (type==="expenses") { expenses += Math.abs(net); details.expenses.push({...r, net:Math.abs(net)}); }
        else if (type==="other_income") { otherIncome += net; details.other_income.push({...r, net}); }
        else if (type==="other_expenses") { otherExpenses += Math.abs(net); details.other_expenses.push({...r, net:Math.abs(net)}); }
      }

      const grossProfit = revenue - cogs;
      const operatingProfit = grossProfit - expenses;
      const netProfit = operatingProfit + otherIncome - otherExpenses;

      return { revenue, cogs, grossProfit, expenses, operatingProfit, otherIncome, otherExpenses, netProfit, details };
    }),

  balanceSheet: protectedProcedure
    .input(z.object({ companyId:z.number(), asOf:z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select({
        accountType: schema.journalEntryLines.accountType,
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        debit: sql<number>`sum(debit)`,
        credit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} <= ${input.asOf}`))
        .groupBy(schema.journalEntryLines.accountCode);

      let assets=0, liabilities=0, equity=0;
      const details: Record<string,any[]> = { assets:[], liabilities:[], equity:[] };

      for (const r of rows) {
        const type = r.accountType || classifyAccount(r.accountCode, r.accountName);
        const debit = r.debit||0; const credit = r.credit||0;
        if (type==="assets") { const v=debit-credit; if(v!==0){assets+=v; details.assets.push({...r,value:v});} }
        else if (type==="liabilities") { const v=credit-debit; if(v!==0){liabilities+=v; details.liabilities.push({...r,value:v});} }
        else if (type==="equity") { const v=credit-debit; if(v!==0){equity+=v; details.equity.push({...r,value:v});} }
      }

      return { assets, liabilities, equity, totalLiabilitiesEquity: liabilities+equity, details };
    }),

  generalLedger: protectedProcedure
    .input(z.object({ companyId:z.number(), accountCode:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const opening = await db.select({
        debit: sql<number>`sum(debit)`, credit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), eq(schema.journalEntryLines.accountCode, input.accountCode), sql`${schema.journalEntryLines.date} < ${input.dateFrom}`));

      const openingBalance = (opening[0]?.debit||0) - (opening[0]?.credit||0);

      const lines = await db.select({
        id: schema.journalEntryLines.id,
        date: schema.journalEntryLines.date,
        label: schema.journalEntryLines.label,
        partnerName: schema.journalEntryLines.partnerName,
        debit: schema.journalEntryLines.debit,
        credit: schema.journalEntryLines.credit,
        entryName: schema.journalEntries.name,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), eq(schema.journalEntryLines.accountCode, input.accountCode), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`))
        .orderBy(schema.journalEntryLines.date);

      let balance = openingBalance;
      const linesWithBalance = lines.map(l => { balance += (l.debit||0) - (l.credit||0); return {...l, balance}; });
      return { openingBalance, lines: linesWithBalance };
    }),

  getAccounts: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      return db.select({ accountCode: schema.journalEntryLines.accountCode, accountName: schema.journalEntryLines.accountName })
        .from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId))
        .groupBy(schema.journalEntryLines.accountCode).orderBy(schema.journalEntryLines.accountCode);
    }),

  monthlyAnalysis: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const dateFrom = `${input.year}-${String(m).padStart(2,"0")}-01`;
        const dateTo = `${input.year}-${String(m).padStart(2,"0")}-31`;
        const rows = await db.select({
          accountType: schema.journalEntryLines.accountType,
          debit: sql<number>`sum(debit)`,
          credit: sql<number>`sum(credit)`,
        }).from(schema.journalEntryLines)
          .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
          .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} >= ${dateFrom}`, sql`${schema.journalEntryLines.date} <= ${dateTo}`))
          .groupBy(schema.journalEntryLines.accountType);

        let revenue=0, expenses=0, cogs=0;
        for (const r of rows) {
          if (r.accountType==="revenue") revenue += (r.credit||0)-(r.debit||0);
          else if (r.accountType==="expenses") expenses += (r.debit||0)-(r.credit||0);
          else if (r.accountType==="cogs") cogs += (r.debit||0)-(r.credit||0);
        }
        months.push({ month:m, revenue, expenses: expenses+cogs, profit: revenue-expenses-cogs });
      }
      return months;
    }),

  partnerStatement: protectedProcedure
    .input(z.object({ companyId:z.number(), partnerName:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const lines = await db.select({
        date: schema.journalEntryLines.date,
        label: schema.journalEntryLines.label,
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        debit: schema.journalEntryLines.debit,
        credit: schema.journalEntryLines.credit,
        entryName: schema.journalEntries.name,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), eq(schema.journalEntryLines.partnerName, input.partnerName), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`))
        .orderBy(schema.journalEntryLines.date);

      let balance = 0;
      const linesWithBalance = lines.map(l => { balance += (l.debit||0)-(l.credit||0); return {...l, balance}; });
      return { lines: linesWithBalance, finalBalance: balance };
    }),

  getPartners: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      return db.select({ partnerName: schema.journalEntryLines.partnerName })
        .from(schema.journalEntryLines).where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`partner_name != '' AND partner_name IS NOT NULL`))
        .groupBy(schema.journalEntryLines.partnerName).orderBy(schema.journalEntryLines.partnerName);
    }),
});

// ── AI ─────────────────────────────────────────────────────────────────────────
const aiRouter = router({
  analyze: protectedProcedure
    .input(z.object({ companyId:z.number(), companyName:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .mutation(async ({ input }) => {
      const income = await db.select({
        accountType: schema.journalEntryLines.accountType,
        debit: sql<number>`sum(debit)`,
        credit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`))
        .groupBy(schema.journalEntryLines.accountType);

      let revenue=0, expenses=0, cogs=0, assets=0, liabilities=0;
      for (const r of income) {
        if (r.accountType==="revenue") revenue += (r.credit||0)-(r.debit||0);
        else if (r.accountType==="expenses") expenses += (r.debit||0)-(r.credit||0);
        else if (r.accountType==="cogs") cogs += (r.debit||0)-(r.credit||0);
        else if (r.accountType==="assets") assets += (r.debit||0)-(r.credit||0);
        else if (r.accountType==="liabilities") liabilities += (r.credit||0)-(r.debit||0);
      }
      const netProfit = revenue - cogs - expenses;
      const margin = revenue > 0 ? ((netProfit/revenue)*100).toFixed(1) : "0";

      const prompt = `أنت مستشار مالي خبير متخصص في تحليل البيانات المالية. قدّم تقريراً مالياً احترافياً باللغة العربية (400 كلمة كحد أقصى) لشركة "${input.companyName}" للفترة من ${input.dateFrom} إلى ${input.dateTo}.

البيانات المالية الفعلية من النظام:
- إجمالي الإيرادات: ${revenue.toLocaleString("ar")} 
- تكلفة المبيعات: ${cogs.toLocaleString("ar")}
- مجمل الربح: ${(revenue-cogs).toLocaleString("ar")}
- المصروفات التشغيلية: ${expenses.toLocaleString("ar")}
- صافي الربح: ${netProfit.toLocaleString("ar")}
- هامش الربح الصافي: ${margin}%
- إجمالي الأصول: ${assets.toLocaleString("ar")}
- إجمالي الالتزامات: ${liabilities.toLocaleString("ar")}

اكتب التقرير بهذا الهيكل:
١) التقييم العام للوضع المالي (فقرة)
٢) نقاط القوة الرئيسية (3 نقاط)  
٣) مجالات تحتاج إلى تحسين (2 نقطة)
٤) التوصيات الاستراتيجية (3 توصيات)

استخدم أرقاماً دقيقة من البيانات المذكورة في التحليل.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1200, messages:[{ role:"user", content:prompt }] }),
      });
      const data = await res.json();
      return { report: data.content?.[0]?.text || "حدث خطأ في توليد التقرير" };
    }),

  chat: protectedProcedure
    .input(z.object({ companyId:z.number(), companyName:z.string(), message:z.string(), history:z.array(z.object({ role:z.string(), content:z.string() })) }))
    .mutation(async ({ input }) => {
      const income = await db.select({
        accountType: schema.journalEntryLines.accountType,
        debit: sql<number>`sum(debit)`,
        credit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(eq(schema.journalEntryLines.companyId, input.companyId))
        .groupBy(schema.journalEntryLines.accountType);

      let revenue=0, expenses=0, cogs=0, assets=0, liabilities=0, equity=0;
      for (const r of income) {
        if (r.accountType==="revenue") revenue += (r.credit||0)-(r.debit||0);
        else if (r.accountType==="expenses") expenses += (r.debit||0)-(r.credit||0);
        else if (r.accountType==="cogs") cogs += (r.debit||0)-(r.credit||0);
        else if (r.accountType==="assets") assets += (r.debit||0)-(r.credit||0);
        else if (r.accountType==="liabilities") liabilities += (r.credit||0)-(r.debit||0);
        else if (r.accountType==="equity") equity += (r.credit||0)-(r.debit||0);
      }
      const netProfit = revenue - cogs - expenses;

      const systemPrompt = `أنت مستشار مالي ذكي لشركة "${input.companyName}". البيانات المالية الحالية من قاعدة البيانات:
- الإيرادات: ${revenue.toLocaleString()}
- تكلفة المبيعات: ${cogs.toLocaleString()}  
- المصروفات: ${expenses.toLocaleString()}
- صافي الربح: ${netProfit.toLocaleString()}
- هامش الربح: ${revenue>0?((netProfit/revenue)*100).toFixed(1):0}%
- الأصول: ${assets.toLocaleString()}
- الالتزامات: ${liabilities.toLocaleString()}
- حقوق الملكية: ${equity.toLocaleString()}
أجب باللغة العربية بشكل مختصر ومهني (150 كلمة كحد أقصى). استخدم الأرقام الفعلية في إجاباتك.`;

      const messages = [...input.history.map(h => ({ role: h.role as "user"|"assistant", content: h.content })), { role:"user" as const, content: input.message }];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:600, system:systemPrompt, messages }),
      });
      const data = await res.json();
      return { reply: data.content?.[0]?.text || "حدث خطأ" };
    }),
});

// ── Audit ──────────────────────────────────────────────────────────────────────
const auditRouter = router({
  getLogs: adminProcedure
    .input(z.object({ limit:z.number().default(100) }))
    .query(async ({ input }) => {
      return db.select({ id:schema.auditLogs.id, action:schema.auditLogs.action, target:schema.auditLogs.target, createdAt:schema.auditLogs.createdAt, userName:schema.users.name })
        .from(schema.auditLogs).leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
        .orderBy(desc(schema.auditLogs.createdAt)).limit(input.limit);
    }),
});

// ── App Router ─────────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: authRouter,
  company: companyRouter,
  users: usersRouter,
  odoo: odooRouter,
  journal: journalRouter,
  ai: aiRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db, schema } from "./db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, getUserFromToken } from "./auth.js";
import { OdooConnector } from "./odoo.js";

export async function createContext({ req }: { req: any }) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = token ? await getUserFromToken(token) : null;
  return { user, req };
}
type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "cfo_admin") throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح" });
  return next({ ctx });
});

function classifyAccount(code: string, name: string): string {
  if (code.startsWith("1")) return "assets";
  if (code.startsWith("2")) return "liabilities";
  if (code.startsWith("3")) return "equity";
  if (code.startsWith("4")) {
    if (name.includes("تكلفة") || name.toLowerCase().includes("cost")) return "cogs";
    return "revenue";
  }
  if (code.startsWith("5")) return "cogs";
  if (code.startsWith("6")) return "expenses";
  if (code.startsWith("7")) return "other_income";
  if (code.startsWith("8")) return "other_expenses";
  return "other";
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (!user || !user.isActive) throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة" });
      if (!await comparePassword(input.password, user.password)) throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة" });
      await db.run(sql`UPDATE users SET last_login=${new Date().toISOString()} WHERE id=${user.id}`);
      return { token: signToken({ userId: user.id, email: user.email, role: user.role, name: user.name }), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const access = await db.select({ companyId: schema.userCompanyAccess.companyId, role: schema.userCompanyAccess.role }).from(schema.userCompanyAccess).where(and(eq(schema.userCompanyAccess.userId, user.id), eq(schema.userCompanyAccess.status, "active")));
    return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLogin: user.lastLogin, companyAccess: access };
  }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
      if (!await comparePassword(input.currentPassword, user!.password)) throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور الحالية غير صحيحة" });
      await db.run(sql`UPDATE users SET password=${await hashPassword(input.newPassword)} WHERE id=${ctx.user.id}`);
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY
// ─────────────────────────────────────────────────────────────────────────────
const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "cfo_admin") return db.select().from(schema.companies).orderBy(desc(schema.companies.id));
    const access = await db.select({ companyId: schema.userCompanyAccess.companyId }).from(schema.userCompanyAccess).where(and(eq(schema.userCompanyAccess.userId, ctx.user.id), eq(schema.userCompanyAccess.status, "active")));
    if (!access.length) return [];
    return db.select().from(schema.companies).where(sql`id IN (${access.map(a=>a.companyId).join(",")})`);
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(2), industry: z.string().optional(), currency: z.string().default("KWD"), contactEmail: z.string().email().optional(), contactPhone: z.string().optional(), address: z.string().optional(), taxNumber: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [co] = await db.insert(schema.companies).values({ ...input, createdBy: ctx.user.id }).returning();
      await db.insert(schema.userCompanyAccess).values({ userId: ctx.user.id, companyId: co.id, role: "cfo_admin", assignedBy: ctx.user.id });
      await db.insert(schema.auditLogs).values({ userId: ctx.user.id, companyId: co.id, action: "create_company", target: co.name });
      return co;
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), industry: z.string().optional(), currency: z.string().optional(), contactEmail: z.string().optional(), contactPhone: z.string().optional(), address: z.string().optional(), taxNumber: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(schema.companies).set(data).where(eq(schema.companies.id, id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(schema.companies).where(eq(schema.companies.id, input.id));
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
const usersRouter = router({
  list: adminProcedure.query(async () => {
    const users = await db.select({ id:schema.users.id, name:schema.users.name, email:schema.users.email, role:schema.users.role, isActive:schema.users.isActive, createdAt:schema.users.createdAt, lastLogin:schema.users.lastLogin }).from(schema.users).orderBy(desc(schema.users.id));
    const access = await db.select().from(schema.userCompanyAccess);
    return users.map(u => ({ ...u, companyAccess: access.filter(a => a.userId === u.id) }));
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      if ((await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1)).length)
        throw new TRPCError({ code: "BAD_REQUEST", message: "البريد الإلكتروني مستخدم" });
      const [user] = await db.insert(schema.users).values({ ...input, password: await hashPassword(input.password) }).returning();
      await db.insert(schema.auditLogs).values({ userId: ctx.user.id, action: "create_user", target: user.email });
      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), role: z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, isActive, ...rest } = input;
      const data: any = { ...rest };
      if (isActive !== undefined) data.isActive = isActive ? 1 : 0;
      await db.update(schema.users).set(data).where(eq(schema.users.id, id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك حذف حسابك" });
      await db.delete(schema.users).where(eq(schema.users.id, input.id));
      return { success: true };
    }),

  grantAccess: adminProcedure
    .input(z.object({ userId: z.number(), companyId: z.number(), role: z.string().default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      await db.run(sql`INSERT OR REPLACE INTO user_company_access (user_id,company_id,role,assigned_by,status) VALUES (${input.userId},${input.companyId},${input.role},${ctx.user.id},'active')`);
      return { success: true };
    }),

  revokeAccess: adminProcedure
    .input(z.object({ userId: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      await db.update(schema.userCompanyAccess).set({ status:"revoked" }).where(and(eq(schema.userCompanyAccess.userId,input.userId),eq(schema.userCompanyAccess.companyId,input.companyId)));
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// ODOO CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const odooConfigRouter = router({
  save: protectedProcedure
    .input(z.object({ companyId: z.number(), url: z.string().url(), database: z.string(), username: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      await db.run(sql`INSERT OR REPLACE INTO odoo_configs (company_id,url,database,username,password) VALUES (${input.companyId},${input.url},${input.database},${input.username},${input.password})`);
      return { success: true };
    }),

  get: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const [cfg] = await db.select({ id:schema.odooConfigs.id, companyId:schema.odooConfigs.companyId, url:schema.odooConfigs.url, database:schema.odooConfigs.database, username:schema.odooConfigs.username, isConnected:schema.odooConfigs.isConnected, odooVersion:schema.odooConfigs.odooVersion, lastTestedAt:schema.odooConfigs.lastTestedAt }).from(schema.odooConfigs).where(eq(schema.odooConfigs.companyId,input.companyId)).limit(1);
      return cfg || null;
    }),

  delete: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(schema.odooConfigs).where(eq(schema.odooConfigs.companyId, input.companyId));
      return { success: true };
    }),

  // اختبار الاتصال واكتشاف الشركات
  testConnection: protectedProcedure
    .input(z.object({ companyId: z.number(), url: z.string(), database: z.string(), username: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const connector = new OdooConnector({ url:input.url, database:input.database, username:input.username, password:input.password });
      const result = await connector.testConnection();
      // حفظ الإعدادات بعد النجاح
      await db.run(sql`INSERT OR REPLACE INTO odoo_configs (company_id,url,database,username,password,is_connected,odoo_version,last_tested_at) VALUES (${input.companyId},${input.url},${input.database},${input.username},${input.password},1,${result.version},${new Date().toISOString()})`);
      return { success: true, version: result.version, companies: result.companies };
    }),

  discoverCompanies: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const [cfg] = await db.select().from(schema.odooConfigs).where(eq(schema.odooConfigs.companyId,input.companyId)).limit(1);
      if (!cfg) throw new TRPCError({ code:"NOT_FOUND", message:"لا يوجد إعداد Odoo لهذه الشركة" });
      const connector = new OdooConnector({ url:cfg.url, database:cfg.database, username:cfg.username, password:cfg.password });
      await connector.authenticate();
      return connector.discoverCompanies();
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL
// ─────────────────────────────────────────────────────────────────────────────
const journalRouter = router({
  listEntries: protectedProcedure
    .input(z.object({ companyId:z.number(), page:z.number().default(1), limit:z.number().default(20) }))
    .query(async ({ input }) => {
      const offset = (input.page-1)*input.limit;
      const entries = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.companyId,input.companyId)).orderBy(desc(schema.journalEntries.date)).limit(input.limit).offset(offset);
      const [{ count }] = await db.select({ count:sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId,input.companyId));
      return { entries, total:count, page:input.page, pages:Math.ceil(count/input.limit) };
    }),

  syncStatus: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const [lastSync] = await db.select().from(schema.syncLogs).where(eq(schema.syncLogs.companyId,input.companyId)).orderBy(desc(schema.syncLogs.startedAt)).limit(1);
      const [{ total }] = await db.select({ total:sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId,input.companyId));
      const [{ lines }] = await db.select({ lines:sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId,input.companyId));
      return { lastSync, totalEntries:total, totalLines:lines };
    }),

  // ── المزامنة الحقيقية من Odoo ──────────────────────────────────────────────
  syncFromOdoo: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      odooCompanyId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      syncType: z.enum(["full","incremental"]).default("incremental"),
      postedOnly: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const [cfg] = await db.select().from(schema.odooConfigs).where(eq(schema.odooConfigs.companyId,input.companyId)).limit(1);
      if (!cfg) throw new TRPCError({ code:"NOT_FOUND", message:"أضف إعدادات Odoo أولاً من صفحة ربط Odoo" });

      const startTime = Date.now();
      let totalEntries = 0;
      let totalLines = 0;

      // إذا مزامنة كاملة — احذف القديم
      if (input.syncType === "full") {
        await db.run(sql`DELETE FROM journal_entry_lines WHERE company_id=${input.companyId}`);
        await db.run(sql`DELETE FROM journal_entries WHERE company_id=${input.companyId}`);
      }

      // آخر write_date للمزامنة التزايدية
      let lastWriteDate: string | undefined;
      if (input.syncType === "incremental") {
        const [lastSync] = await db.select().from(schema.syncLogs).where(eq(schema.syncLogs.companyId,input.companyId)).orderBy(desc(schema.syncLogs.startedAt)).limit(1);
        if (lastSync?.finishedAt) lastWriteDate = lastSync.finishedAt;
      }

      const connector = new OdooConnector({ url:cfg.url, database:cfg.database, username:cfg.username, password:cfg.password });
      await connector.authenticate();
      await connector.detectVersion();

      // جلب دفعات من 50
      const batchSize = 50;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { entries } = await connector.fetchJournalEntries({
          companyId: input.odooCompanyId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          lastWriteDate,
          postedOnly: input.postedOnly,
          limit: batchSize,
          offset,
        });

        if (entries.length === 0) { hasMore = false; break; }

        for (const entry of entries) {
          // إدراج القيد
          try {
            await db.run(sql`INSERT OR IGNORE INTO journal_entries 
              (company_id,odoo_move_id,name,ref,journal_name,journal_type,date,state,total_debit,total_credit,partner_name,narration)
              VALUES (${input.companyId},${entry.odooMoveId},${entry.name},${entry.ref},${entry.journalName},${entry.journalType},${entry.date},${entry.state},${entry.totalDebit},${entry.totalCredit},${entry.partnerName},${entry.narration})`);

            const [inserted] = await db.select({ id:schema.journalEntries.id }).from(schema.journalEntries).where(and(eq(schema.journalEntries.companyId,input.companyId),eq(schema.journalEntries.odooMoveId as any,entry.odooMoveId))).limit(1);

            if (inserted) {
              for (const line of entry.lines) {
                try {
                  await db.run(sql`INSERT OR IGNORE INTO journal_entry_lines
                    (journal_entry_id,company_id,odoo_line_id,account_code,account_name,partner_name,label,debit,credit,date)
                    VALUES (${inserted.id},${input.companyId},${line.odooLineId},${line.accountCode},${line.accountName},${line.partnerName},${line.label},${line.debit},${line.credit},${line.date})`);
                  totalLines++;
                } catch { /* تجاهل السطور المكررة */ }
              }
              totalEntries++;
            }
          } catch { /* تجاهل القيود المكررة */ }
        }

        offset += batchSize;
        if (entries.length < batchSize) hasMore = false;
      }

      const duration = Date.now() - startTime;
      await db.insert(schema.syncLogs).values({ companyId:input.companyId, syncType:input.syncType, status:"success", entries:totalEntries, lines:totalLines, finishedAt:new Date().toISOString(), durationMs:duration });

      return { success:true, totalEntries, totalLines, durationMs:duration };
    }),

  // ── رفع ميزان المراجعة من Excel ───────────────────────────────────────────
  uploadTrialBalance: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      dateFrom: z.string(),
      dateTo: z.string(),
      entries: z.array(z.object({
        accountCode: z.string(),
        accountName: z.string(),
        openingDebit: z.number().default(0),
        openingCredit: z.number().default(0),
        mvtDebit: z.number().default(0),
        mvtCredit: z.number().default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      // احذف القيود القديمة لنفس الفترة
      await db.run(sql`DELETE FROM journal_entry_lines WHERE company_id=${input.companyId} AND date >= ${input.dateFrom} AND date <= ${input.dateTo}`);
      await db.run(sql`DELETE FROM journal_entries WHERE company_id=${input.companyId} AND date >= ${input.dateFrom} AND date <= ${input.dateTo} AND journal_name='ميزان مراجعة'`);

      let count = 0;
      // إنشاء قيد واحد للرصيد الافتتاحي
      for (const entry of input.entries) {
        const [je] = await db.insert(schema.journalEntries).values({
          companyId: input.companyId,
          name: `TB-${entry.accountCode}-${input.dateFrom}`,
          journalName: "ميزان مراجعة",
          journalType: "general",
          date: input.dateFrom,
          state: "posted",
          totalDebit: entry.openingDebit + entry.mvtDebit,
          totalCredit: entry.openingCredit + entry.mvtCredit,
        }).returning();

        if (entry.openingDebit > 0 || entry.openingCredit > 0) {
          await db.run(sql`INSERT INTO journal_entry_lines (journal_entry_id,company_id,account_code,account_name,debit,credit,date,label)
            VALUES (${je.id},${input.companyId},${entry.accountCode},${entry.accountName},${entry.openingDebit},${entry.openingCredit},${input.dateFrom},'رصيد افتتاحي')`);
        }
        if (entry.mvtDebit > 0 || entry.mvtCredit > 0) {
          await db.run(sql`INSERT INTO journal_entry_lines (journal_entry_id,company_id,account_code,account_name,debit,credit,date,label)
            VALUES (${je.id},${input.companyId},${entry.accountCode},${entry.accountName},${entry.mvtDebit},${entry.mvtCredit},${input.dateTo},'حركة الفترة')`);
        }
        count++;
      }

      await db.insert(schema.auditLogs).values({ companyId:input.companyId, action:"upload_trial_balance", target:`${count} حساب - ${input.dateFrom}` });
      return { success:true, accounts:count };
    }),

  clearData: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .mutation(async ({ input }) => {
      await db.run(sql`DELETE FROM journal_entry_lines WHERE company_id=${input.companyId}`);
      await db.run(sql`DELETE FROM journal_entries WHERE company_id=${input.companyId}`);
      return { success:true };
    }),

  // ── ميزان المراجعة 6 أعمدة ──────────────────────────────────────────────
  trialBalance: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const opening = await db.select({ accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, openingDebit:sql<number>`COALESCE(sum(debit),0)`, openingCredit:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} < ${input.dateFrom}`)).groupBy(schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName);

      const movement = await db.select({ accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, mvtDebit:sql<number>`COALESCE(sum(debit),0)`, mvtCredit:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`,sql`${schema.journalEntryLines.date} <= ${input.dateTo}`)).groupBy(schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName);

      const map: Record<string,any> = {};
      for (const o of opening) map[o.accountCode] = { accountCode:o.accountCode, accountName:o.accountName, openingDebit:o.openingDebit||0, openingCredit:o.openingCredit||0, mvtDebit:0, mvtCredit:0 };
      for (const m of movement) {
        if (!map[m.accountCode]) map[m.accountCode] = { accountCode:m.accountCode, accountName:m.accountName, openingDebit:0, openingCredit:0 };
        map[m.accountCode].mvtDebit = m.mvtDebit||0;
        map[m.accountCode].mvtCredit = m.mvtCredit||0;
      }
      return Object.values(map).map((r:any) => {
        const openBal = (r.openingDebit||0)-(r.openingCredit||0);
        const closBal = openBal + (r.mvtDebit||0) - (r.mvtCredit||0);
        return { ...r, accountType:classifyAccount(r.accountCode,r.accountName), closingDebit:closBal>0?closBal:0, closingCredit:closBal<0?Math.abs(closBal):0 };
      }).sort((a,b)=>a.accountCode.localeCompare(b.accountCode));
    }),

  // ── قائمة الدخل ──────────────────────────────────────────────────────────
  incomeStatement: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string(), prevDateFrom:z.string().optional(), prevDateTo:z.string().optional() }))
    .query(async ({ input }) => {
      const get = async (from:string, to:string) => db.select({ accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, totalDebit:sql<number>`COALESCE(sum(debit),0)`, totalCredit:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} >= ${from}`,sql`${schema.journalEntryLines.date} <= ${to}`)).groupBy(schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName);
      const cur = await get(input.dateFrom,input.dateTo);
      const prv = input.prevDateFrom&&input.prevDateTo ? await get(input.prevDateFrom,input.prevDateTo) : [];
      const prvMap:Record<string,any> = {};
      for (const p of prv) prvMap[p.accountCode] = p;
      return cur.map(r => {
        const type = classifyAccount(r.accountCode,r.accountName);
        const net = (r.totalCredit||0)-(r.totalDebit||0);
        const p = prvMap[r.accountCode];
        const prevNet = p ? (p.totalCredit||0)-(p.totalDebit||0) : 0;
        return { accountCode:r.accountCode, accountName:r.accountName, type, amount:net, prevAmount:prevNet };
      }).filter(r=>["revenue","cogs","expenses","other_income","other_expenses"].includes(r.type)).sort((a,b)=>a.accountCode.localeCompare(b.accountCode));
    }),

  // ── الميزانية العمومية ───────────────────────────────────────────────────
  balanceSheet: protectedProcedure
    .input(z.object({ companyId:z.number(), asOf:z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select({ accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, totalDebit:sql<number>`COALESCE(sum(debit),0)`, totalCredit:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} <= ${input.asOf}`)).groupBy(schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName);
      return rows.map(r => ({ accountCode:r.accountCode, accountName:r.accountName, type:classifyAccount(r.accountCode,r.accountName), balance:(r.totalDebit||0)-(r.totalCredit||0) })).filter(r=>["assets","liabilities","equity"].includes(r.type)).sort((a,b)=>a.accountCode.localeCompare(b.accountCode));
    }),

  // ── دفتر الأستاذ ─────────────────────────────────────────────────────────
  generalLedger: protectedProcedure
    .input(z.object({ companyId:z.number(), accountCode:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const [ob] = await db.select({ d:sql<number>`COALESCE(sum(debit),0)`, c:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntryLines.accountCode,input.accountCode),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} < ${input.dateFrom}`));
      const openingBalance = ((ob?.d||0)-(ob?.c||0));
      const lines = await db.select({ id:schema.journalEntryLines.id, date:schema.journalEntryLines.date, label:schema.journalEntryLines.label, partnerName:schema.journalEntryLines.partnerName, debit:schema.journalEntryLines.debit, credit:schema.journalEntryLines.credit, entryName:schema.journalEntries.name, journalName:schema.journalEntries.journalName }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntryLines.accountCode,input.accountCode),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`,sql`${schema.journalEntryLines.date} <= ${input.dateTo}`)).orderBy(schema.journalEntryLines.date);
      let running = openingBalance;
      return { openingBalance, lines:lines.map(l=>{ running+=(l.debit||0)-(l.credit||0); return {...l,balance:running}; }), closingBalance:running };
    }),

  // ── التحليل الشهري ────────────────────────────────────────────────────────
  monthlyAnalysis: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const rows = await db.select({ month:sql<string>`strftime('%m',${schema.journalEntryLines.date})`, accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, d:sql<number>`COALESCE(sum(debit),0)`, c:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`strftime('%Y',${schema.journalEntryLines.date})=${String(input.year)}`)).groupBy(sql`strftime('%m',${schema.journalEntryLines.date})`,schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName);
      const months:Record<string,{rev:number,exp:number,cogs:number}> = {};
      for (let m=1;m<=12;m++) months[String(m).padStart(2,"0")]={rev:0,exp:0,cogs:0};
      for (const r of rows) {
        const type = classifyAccount(r.accountCode,r.accountName);
        const m = r.month; if (!months[m]) continue;
        if (type==="revenue") months[m].rev += (r.c||0)-(r.d||0);
        if (type==="expenses") months[m].exp += (r.d||0)-(r.c||0);
        if (type==="cogs") months[m].cogs += (r.d||0)-(r.c||0);
      }
      const names = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      return Object.entries(months).map(([k,v])=>({ month:names[parseInt(k)-1], monthNum:parseInt(k), revenue:Math.max(0,v.rev), expenses:Math.max(0,v.exp+v.cogs), profit:Math.max(0,v.rev-v.exp-v.cogs), margin:v.rev>0?Math.round(((v.rev-v.exp-v.cogs)/v.rev)*100):0 }));
    }),

  // ── النسب المالية ─────────────────────────────────────────────────────────
  ratios: protectedProcedure
    .input(z.object({ companyId:z.number(), asOf:z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select({ accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, d:sql<number>`COALESCE(sum(debit),0)`, c:sql<number>`COALESCE(sum(credit),0)` }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.date} <= ${input.asOf}`)).groupBy(schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName);
      const T = { assets:0,curAssets:0,cash:0,inv:0,rec:0,liab:0,curLiab:0,equity:0,rev:0,cogs:0,exp:0,netInc:0 };
      for (const r of rows) {
        const type = classifyAccount(r.accountCode,r.accountName);
        const bal = (r.d||0)-(r.c||0);
        if (type==="assets") { T.assets+=bal; if(r.accountCode.startsWith("11")){T.curAssets+=bal;T.cash+=bal;} if(r.accountCode.startsWith("12")){T.curAssets+=bal;T.rec+=bal;} if(r.accountCode.startsWith("13")){T.curAssets+=bal;T.inv+=bal;} }
        if (type==="liabilities") { T.liab+=Math.abs(bal); if(r.accountCode.startsWith("21"))T.curLiab+=Math.abs(bal); }
        if (type==="equity") T.equity+=Math.abs(bal);
        if (type==="revenue") T.rev+=(r.c||0)-(r.d||0);
        if (type==="cogs") T.cogs+=bal;
        if (type==="expenses") T.exp+=bal;
      }
      T.netInc = T.rev-T.cogs-T.exp;
      const s=(n:number,d:number)=>d>0?Math.round((n/d)*100)/100:0;
      const p=(n:number,d:number)=>d>0?Math.round((n/d)*1000)/10:0;
      return { totals:T, ratios:{ currentRatio:s(T.curAssets,T.curLiab), quickRatio:s(T.curAssets-T.inv,T.curLiab), cashRatio:s(T.cash,T.curLiab), grossMargin:p(T.rev-T.cogs,T.rev), netMargin:p(T.netInc,T.rev), roa:p(T.netInc,T.assets), roe:p(T.netInc,T.equity), debtToAssets:p(T.liab,T.assets), debtToEquity:s(T.liab,T.equity) } };
    }),

  // ── قائمة الحسابات ────────────────────────────────────────────────────────
  accounts: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      return db.select({ accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId,input.companyId)).groupBy(schema.journalEntryLines.accountCode,schema.journalEntryLines.accountName).orderBy(schema.journalEntryLines.accountCode);
    }),

  // ── كشف حساب شريك ────────────────────────────────────────────────────────
  partnerStatement: protectedProcedure
    .input(z.object({ companyId:z.number(), partnerName:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const lines = await db.select({ date:schema.journalEntryLines.date, entryName:schema.journalEntries.name, journalName:schema.journalEntries.journalName, label:schema.journalEntryLines.label, accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName, debit:schema.journalEntryLines.debit, credit:schema.journalEntryLines.credit }).from(schema.journalEntryLines).innerJoin(schema.journalEntries,eq(schema.journalEntryLines.journalEntryId,schema.journalEntries.id)).where(and(eq(schema.journalEntryLines.companyId,input.companyId),eq(schema.journalEntries.state,"posted"),sql`${schema.journalEntryLines.partner_name} LIKE ${'%'+input.partnerName+'%'}`,sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`,sql`${schema.journalEntryLines.date} <= ${input.dateTo}`)).orderBy(schema.journalEntryLines.date);
      let running = 0;
      return lines.map(l=>{ running+=(l.debit||0)-(l.credit||0); return {...l,balance:running}; });
    }),

  // ── الشركاء ───────────────────────────────────────────────────────────────
  partners: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      return db.select({ partnerName:schema.journalEntryLines.partnerName }).from(schema.journalEntryLines).where(and(eq(schema.journalEntryLines.companyId,input.companyId),sql`partner_name IS NOT NULL AND partner_name != ''`)).groupBy(schema.journalEntryLines.partnerName).orderBy(schema.journalEntryLines.partnerName);
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────────────────────────────────────
const auditRouter = router({
  getLogs: adminProcedure
    .input(z.object({ limit:z.number().default(50) }))
    .query(async ({ input }) => {
      return db.select({ id:schema.auditLogs.id, action:schema.auditLogs.action, target:schema.auditLogs.target, createdAt:schema.auditLogs.createdAt, userName:schema.users.name, userEmail:schema.users.email }).from(schema.auditLogs).leftJoin(schema.users,eq(schema.auditLogs.userId,schema.users.id)).orderBy(desc(schema.auditLogs.createdAt)).limit(input.limit);
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// APP ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: authRouter,
  company: companyRouter,
  users: usersRouter,
  odooConfig: odooConfigRouter,
  journal: journalRouter,
  audit: auditRouter,
});
export type AppRouter = typeof appRouter;

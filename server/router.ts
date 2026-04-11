import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db, schema } from "./db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, getUserFromToken } from "./auth.js";
import { OdooConnector, odooTypeToCfoType } from "./odoo.js";

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
  if (!ctx.user) throw new TRPCError({ code:"UNAUTHORIZED", message:"يجب تسجيل الدخول" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "cfo_admin") throw new TRPCError({ code:"FORBIDDEN", message:"غير مصرح" });
  return next({ ctx });
});

function classifyAccount(code: string, name: string): string {
  const c = code.trim();
  if (c.startsWith("1")) return "assets";
  if (c.startsWith("2")) return "liabilities";
  if (c.startsWith("3")) return "equity";
  if (c.startsWith("4")) return (name.includes("تكلفة")||name.toLowerCase().includes("cost")||name.toLowerCase().includes("cogs")) ? "cogs" : "revenue";
  if (c.startsWith("5")) return "cogs";
  if (c.startsWith("6")) return "expenses";
  if (c.startsWith("7")) return "other_income";
  if (c.startsWith("8")) return "other_expenses";
  return "other";
}

// ── Auth ───────────────────────────────────────────────────────────────────────
const authRouter = router({
  login: publicProcedure
    .input(z.object({ email:z.string().email(), password:z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (!user || !user.isActive) throw new TRPCError({ code:"UNAUTHORIZED", message:"البريد أو كلمة المرور غير صحيحة" });
      if (!await comparePassword(input.password, user.password)) throw new TRPCError({ code:"UNAUTHORIZED", message:"البريد أو كلمة المرور غير صحيحة" });
      await db.update(schema.users).set({ lastLogin:new Date().toISOString(), updatedAt:new Date().toISOString() }).where(eq(schema.users.id, user.id));
      return { token:signToken({ userId:user.id, email:user.email, role:user.role, name:user.name }), user:{ id:user.id, name:user.name, email:user.email, role:user.role } };
    }),
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code:"NOT_FOUND" });
    const access = await db.select({ companyId:schema.userCompanyAccess.companyId, role:schema.userCompanyAccess.role }).from(schema.userCompanyAccess).where(and(eq(schema.userCompanyAccess.userId, user.id), eq(schema.userCompanyAccess.status,"active")));
    return { id:user.id, name:user.name, email:user.email, role:user.role, isActive:user.isActive, lastLogin:user.lastLogin, companyAccess:access };
  }),
  changePassword: protectedProcedure
    .input(z.object({ currentPassword:z.string(), newPassword:z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
      if (!await comparePassword(input.currentPassword, user!.password)) throw new TRPCError({ code:"BAD_REQUEST", message:"كلمة المرور الحالية غير صحيحة" });
      await db.update(schema.users).set({ password:await hashPassword(input.newPassword), updatedAt:new Date().toISOString() }).where(eq(schema.users.id, ctx.user.id));
      return { success:true };
    }),
});

// ── Company ────────────────────────────────────────────────────────────────────
const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role==="cfo_admin") return db.select().from(schema.companies).orderBy(desc(schema.companies.id));
    const access = await db.select({ companyId:schema.userCompanyAccess.companyId }).from(schema.userCompanyAccess).where(and(eq(schema.userCompanyAccess.userId, ctx.user.id), eq(schema.userCompanyAccess.status,"active")));
    if (!access.length) return [];
    return db.select().from(schema.companies).where(sql`id IN (${access.map(a=>a.companyId).join(",")})`);
  }),

  create: adminProcedure
    .input(z.object({ name:z.string().min(2), industry:z.string().optional(), currency:z.string().default("KWD"), contactEmail:z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [co] = await db.insert(schema.companies).values({ ...input, createdBy:ctx.user.id }).returning();
      await db.insert(schema.userCompanyAccess).values({ userId:ctx.user.id, companyId:co.id, role:"cfo_admin", assignedBy:ctx.user.id });
      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, companyId:co.id, action:"create_company", target:co.name });
      return co;
    }),

  // تعديل بيانات الشركة
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      industry: z.string().optional(),
      currency: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.update(schema.companies).set(data).where(eq(schema.companies.id, id));
      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, companyId:id, action:"update_company", target:input.name||"" });
      return { success:true };
    }),

  // ملخص ما سيُحذف قبل الحذف
  deleteSummary: adminProcedure
    .input(z.object({ id:z.number() }))
    .query(async ({ input }) => {
      const [co] = await db.select().from(schema.companies).where(eq(schema.companies.id, input.id)).limit(1);
      const [{ entries }] = await db.select({ entries:sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.id));
      const [{ lines }] = await db.select({ lines:sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.id));
      const [{ users }] = await db.select({ users:sql<number>`count(*)` }).from(schema.userCompanyAccess).where(eq(schema.userCompanyAccess.companyId, input.id));
      const syncRows = await db.run(sql`SELECT count(*) as cnt FROM sync_logs WHERE company_id=${input.id}`);
      const odooRows = await db.run(sql`SELECT count(*) as cnt FROM odoo_configs WHERE company_id=${input.id}`);
      return {
        company: co,
        counts: {
          journalEntries: entries,
          journalLines: lines,
          userAccess: users,
          syncLogs: (syncRows as any).rows?.[0]?.cnt || 0,
          odooConfigs: (odooRows as any).rows?.[0]?.cnt || 0,
        }
      };
    }),

  // حذف الشركة مع جميع بياناتها
  delete: adminProcedure
    .input(z.object({ id:z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [co] = await db.select().from(schema.companies).where(eq(schema.companies.id, input.id)).limit(1);
      if (!co) throw new TRPCError({ code:"NOT_FOUND", message:"الشركة غير موجودة" });

      // حذف بالترتيب (FK constraints)
      // 1. سطور القيود
      await db.delete(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.id));
      // 2. القيود المحاسبية
      await db.delete(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.id));
      // 3. سجلات المزامنة
      await db.run(sql`DELETE FROM sync_logs WHERE company_id=${input.id}`);
      // 4. إعدادات Odoo
      await db.run(sql`DELETE FROM odoo_configs WHERE company_id=${input.id}`);
      // 5. صلاحيات المستخدمين
      await db.delete(schema.userCompanyAccess).where(eq(schema.userCompanyAccess.companyId, input.id));
      // 6. عضوية المجموعات
      await db.run(sql`DELETE FROM company_group_members WHERE company_id=${input.id}`);
      // 7. سجل المراجعة للشركة
      await db.run(sql`DELETE FROM audit_logs WHERE company_id=${input.id}`);
      // 8. الشركة نفسها
      await db.delete(schema.companies).where(eq(schema.companies.id, input.id));

      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, action:"delete_company", target:co.name, details:`حذف شامل لجميع بيانات الشركة` });
      return { success:true, deletedCompany:co.name };
    }),

  // حذف بيانات الشركة فقط (بدون حذف الشركة نفسها)
  clearData: adminProcedure
    .input(z.object({ id:z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.delete(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.id));
      await db.delete(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.id));
      await db.run(sql`DELETE FROM sync_logs WHERE company_id=${input.id}`);
      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, companyId:input.id, action:"clear_company_data", target:"جميع البيانات المحاسبية" });
      return { success:true };
    }),
});

// ── Users ──────────────────────────────────────────────────────────────────────
const usersRouter = router({
  list: adminProcedure.query(async () => {
    const users = await db.select({ id:schema.users.id, name:schema.users.name, email:schema.users.email, role:schema.users.role, isActive:schema.users.isActive, createdAt:schema.users.createdAt, lastLogin:schema.users.lastLogin }).from(schema.users).orderBy(desc(schema.users.id));
    const access = await db.select().from(schema.userCompanyAccess);
    return users.map(u=>({ ...u, companyAccess:access.filter(a=>a.userId===u.id) }));
  }),
  create: adminProcedure
    .input(z.object({ name:z.string().min(2), email:z.string().email(), password:z.string().min(8), role:z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      if ((await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1)).length) throw new TRPCError({ code:"BAD_REQUEST", message:"البريد مستخدم بالفعل" });
      const [user] = await db.insert(schema.users).values({ ...input, password:await hashPassword(input.password) }).returning();
      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, action:"create_user", target:user.email });
      return { id:user.id, name:user.name, email:user.email, role:user.role };
    }),
  update: adminProcedure
    .input(z.object({ id:z.number(), name:z.string().optional(), role:z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).optional(), isActive:z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, isActive, ...rest } = input;
      const data: any = { ...rest, updatedAt:new Date().toISOString() };
      if (isActive !== undefined) data.isActive = isActive ? 1 : 0;
      await db.update(schema.users).set(data).where(eq(schema.users.id, id));
      return { success:true };
    }),
  delete: adminProcedure
    .input(z.object({ id:z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id===ctx.user.id) throw new TRPCError({ code:"BAD_REQUEST", message:"لا يمكنك حذف حسابك" });
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

  // حفظ الإعدادات
  saveConfig: protectedProcedure
    .input(z.object({ companyId:z.number(), url:z.string(), database:z.string(), username:z.string(), password:z.string(), odooCompanyId:z.number().optional(), odooCompanyName:z.string().optional() }))
    .mutation(async ({ input }) => {
      await db.run(sql`INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password, odoo_company_id, odoo_company_name, is_connected) VALUES (${input.companyId}, ${input.url}, ${input.database}, ${input.username}, ${input.password}, ${input.odooCompanyId||null}, ${input.odooCompanyName||null}, 1)`);
      return { success:true };
    }),

  // قراءة الإعدادات
  getConfig: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const rows = await db.run(sql`SELECT
        id, company_id as companyId,
        url, database, username, password,
        odoo_company_id as odooCompanyId,
        odoo_company_name as odooCompanyName,
        is_connected as isConnected,
        odoo_version as odooVersion
      FROM odoo_configs WHERE company_id = ${input.companyId} LIMIT 1`);
      return (rows as any).rows?.[0] || null;
    }),

  // اختبار الاتصال وجلب الشركات
  testAndDiscover: protectedProcedure
    .input(z.object({ url:z.string(), database:z.string(), username:z.string(), password:z.string() }))
    .mutation(async ({ input }) => {
      const conn = new OdooConnector(input.url, input.database, input.username, input.password);
      await conn.authenticate();
      const version = conn.getVersionString();
      const companies = await conn.getCompanies();
      return {
        success: true,
        uid: conn.uid,
        version,
        companies: companies.map((c:any) => ({
          id: c.id,
          name: c.name,
          currency: Array.isArray(c.currency_id) ? c.currency_id[1] : c.currency_id,
          city: c.city || "",
          vat: c.vat || "",
        }))
      };
    }),

  // مزامنة الحركات مع الرصيد الافتتاحي الصحيح
  syncJournals: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      odooCompanyId: z.number().nullable().optional(),
      dateFrom: z.string(),
      dateTo: z.string(),
      syncType: z.string().default("incremental"),
      includeOpeningBalance: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      // جلب إعدادات Odoo
      const cfgRows = await db.run(sql`SELECT * FROM odoo_configs WHERE company_id = ${input.companyId} LIMIT 1`);
      const cfg = (cfgRows as any).rows?.[0];
      if (!cfg) throw new TRPCError({ code:"NOT_FOUND", message:"لم يتم إعداد Odoo لهذه الشركة — اذهب لصفحة الإعداد" });

      // استخدام odooCompanyId من الإعدادات إذا لم يُرسَل
      const resolvedOdooCompanyId = input.odooCompanyId ??
        cfg.odoo_company_id ?? cfg.odooCompanyId ?? null;

      const conn = new OdooConnector(cfg.url, cfg.database, cfg.username, cfg.password);
      await conn.authenticate();

      const startTime = Date.now();
      let totalInserted = 0;
      let openingLinesCount = 0;

      // مسح البيانات القديمة إذا كانت مزامنة كاملة
      if (input.syncType === "full") {
        await db.run(sql`DELETE FROM journal_entry_lines WHERE company_id = ${input.companyId}`);
        await db.run(sql`DELETE FROM journal_entries WHERE company_id = ${input.companyId}`);
      }

      // ── 1. مزامنة الرصيد الافتتاحي (ما قبل الفترة) ──────────────────────
      if (input.includeOpeningBalance) {
        const openingLines = await conn.getOpeningBalanceLines(resolvedOdooCompanyId as number, input.dateFrom);
        openingLinesCount = openingLines.length;

        if (openingLines.length > 0) {
          // إنشاء قيد واحد للرصيد الافتتاحي
          const existingOpening = await db.run(sql`SELECT id FROM journal_entries WHERE company_id = ${input.companyId} AND name = 'رصيد افتتاحي' LIMIT 1`);
          let openingEntryId: number;

          if ((existingOpening as any).rows?.length) {
            openingEntryId = (existingOpening as any).rows[0].id;
            await db.run(sql`DELETE FROM journal_entry_lines WHERE journal_entry_id = ${openingEntryId}`);
          } else {
            const res = await db.run(sql`INSERT INTO journal_entries (company_id, name, journal_name, date, state, total_debit, total_credit) VALUES (${input.companyId}, 'رصيد افتتاحي', 'افتتاحي', ${input.dateFrom}, 'posted', 0, 0) RETURNING id`);
            openingEntryId = (res as any).rows?.[0]?.id || (res as any).lastInsertRowid;
          }

          // تجميع الرصيد الافتتاحي حسب الحساب
          const accountSums: Record<string, { code:string, name:string, debit:number, credit:number }> = {};
          for (const line of openingLines) {
            const accountCode = Array.isArray(line.account_id) ? line.account_id[1]?.split(" ")[0] || "0000" : "0000";
            const accountName = Array.isArray(line.account_id) ? (line.account_id[1]||"").replace(/^\S+\s/, "") : "";
            if (!accountSums[accountCode]) accountSums[accountCode] = { code:accountCode, name:accountName, debit:0, credit:0 };
            accountSums[accountCode].debit += line.debit || 0;
            accountSums[accountCode].credit += line.credit || 0;
          }

          // إدراج سطور الرصيد الافتتاحي (فقط الحسابات ذات رصيد)
          for (const acc of Object.values(accountSums)) {
            const netDebit = Math.max(0, acc.debit - acc.credit);
            const netCredit = Math.max(0, acc.credit - acc.debit);
            if (netDebit === 0 && netCredit === 0) continue;
            const accountType = classifyAccount(acc.code, acc.name);
            // الرصيد الافتتاحي يُخزّن بتاريخ يوم قبل الفترة
            const openingDate = new Date(input.dateFrom);
            openingDate.setDate(openingDate.getDate() - 1);
            const openingDateStr = openingDate.toISOString().split("T")[0];
            await db.run(sql`INSERT OR IGNORE INTO journal_entry_lines (journal_entry_id, company_id, account_code, account_name, account_type, label, debit, credit, date) VALUES (${openingEntryId}, ${input.companyId}, ${acc.code}, ${acc.name}, ${accountType}, 'رصيد افتتاحي', ${netDebit}, ${netCredit}, ${openingDateStr})`);
          }
        }
      }

      // ── 2. مزامنة حركات الفترة ────────────────────────────────────────────
      const total = await conn.countEntries(resolvedOdooCompanyId as number, input.dateFrom, input.dateTo);
      const batchSize = 100;
      let offset = 0;

      while (offset < total) {
        const moves = await conn.getJournalEntries(resolvedOdooCompanyId as number, input.dateFrom, input.dateTo, batchSize, offset);
        if (!moves.length) break;

        for (const move of moves) {
          const journalName = Array.isArray(move.journal_id) ? move.journal_id[1] || "" : "";
          const partnerName = Array.isArray(move.partner_id) ? move.partner_id[1] || "" : "";
          await db.run(sql`INSERT OR REPLACE INTO journal_entries (company_id, odoo_move_id, name, ref, journal_name, date, state, total_debit, total_credit, partner_name) VALUES (${input.companyId}, ${move.id}, ${move.name}, ${move.ref||""}, ${journalName}, ${move.date}, 'posted', ${move.amount_total||0}, ${move.amount_total||0}, ${partnerName})`);
        }

        // جلب سطور القيود
        const moveIds = moves.map((m:any) => m.id);
        const lines = await conn.getJournalLines(moveIds);

        // بناء map سريع لـ move.id → entry.id
        const moveToEntry: Record<number, number> = {};
        for (const move of moves) {
          const entryRow = await db.run(sql`SELECT id FROM journal_entries WHERE company_id = ${input.companyId} AND odoo_move_id = ${move.id} LIMIT 1`);
          const entryId = (entryRow as any).rows?.[0]?.id;
          if (entryId) moveToEntry[move.id] = entryId;
        }

        for (const line of lines) {
          const moveId = Array.isArray(line.move_id) ? line.move_id[0] : line.move_id;
          const entryId = moveToEntry[moveId];
          if (!entryId) continue;

          const accountCode = Array.isArray(line.account_id) ? (line.account_id[1]||"").split(" ")[0] || "0000" : "0000";
          const accountName = Array.isArray(line.account_id) ? (line.account_id[1]||"").replace(/^\S+\s+/, "") : "";
          const accountType = classifyAccount(accountCode, accountName);
          const partnerName = Array.isArray(line.partner_id) ? line.partner_id[1] || "" : "";
          // التاريخ: من السطر أو من القيد الأب
          const lineDate = line.date || (moves.find((m:any)=>m.id===moveId)?.date) || input.dateFrom;

          await db.run(sql`INSERT OR IGNORE INTO journal_entry_lines
            (journal_entry_id, company_id, account_code, account_name, account_type, partner_name, label, debit, credit, date)
            VALUES (${entryId}, ${input.companyId}, ${accountCode}, ${accountName}, ${accountType}, ${partnerName}, ${line.name||""}, ${line.debit||0}, ${line.credit||0}, ${lineDate})`);
        }

        totalInserted += moves.length;
        offset += batchSize;
      }

      // تسجيل المزامنة
      await db.run(sql`INSERT INTO sync_logs (company_id, sync_type, status, entries, finished_at, duration_ms) VALUES (${input.companyId}, ${input.syncType}, 'success', ${totalInserted}, ${new Date().toISOString()}, ${Date.now()-startTime})`);

      return { success:true, total, inserted:totalInserted, openingLines:openingLinesCount };
    }),

  // مزامنة شاملة لكل الجداول من Odoo
  fullSync: protectedProcedure
    .input(z.object({
      companyId:     z.number(),
      odooCompanyId: z.number(),
      dateFrom:      z.string(),
      dateTo:        z.string(),
      models:        z.array(z.string()).default(["coa","journals","partners","currencies","entries"]),
    }))
    .mutation(async ({ input }) => {
      const cfgRows = await db.run(sql`SELECT * FROM odoo_configs WHERE company_id = ${input.companyId} LIMIT 1`);
      const cfg = (cfgRows as any).rows?.[0];
      if (!cfg) throw new TRPCError({ code:"NOT_FOUND", message:"لم يتم إعداد Odoo — اذهب لصفحة الإعداد وربط الشركة" });

      // ── إنشاء كل الجداول اللازمة ──────────────────────────────────────────
      const createTables = [
        `CREATE TABLE IF NOT EXISTS accounts_coa (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL, odoo_account_id INTEGER NOT NULL,
          code TEXT NOT NULL, name TEXT NOT NULL,
          account_type TEXT, internal_type TEXT, internal_group TEXT, cfo_type TEXT,
          currency_id INTEGER, deprecated INTEGER DEFAULT 0,
          UNIQUE(company_id, odoo_account_id))`,
        `CREATE TABLE IF NOT EXISTS odoo_journals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL, odoo_journal_id INTEGER NOT NULL,
          name TEXT NOT NULL, code TEXT, type TEXT,
          UNIQUE(company_id, odoo_journal_id))`,
        `CREATE TABLE IF NOT EXISTS odoo_partners_full (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL, odoo_partner_id INTEGER NOT NULL,
          name TEXT NOT NULL, ref TEXT, email TEXT, phone TEXT,
          vat TEXT, city TEXT, country TEXT,
          is_customer INTEGER DEFAULT 0, is_supplier INTEGER DEFAULT 0,
          customer_rank INTEGER DEFAULT 0, supplier_rank INTEGER DEFAULT 0,
          UNIQUE(company_id, odoo_partner_id))`,
        `CREATE TABLE IF NOT EXISTS odoo_sync_registry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL, model_name TEXT NOT NULL,
          last_sync_at TEXT, records_count INTEGER DEFAULT 0, status TEXT DEFAULT 'pending',
          UNIQUE(company_id, model_name))`,
      ];
      for (const ddl of createTables) {
        try { await db.run(sql`${ddl}`); } catch(e:any) { console.log("DDL warn:", e.message?.slice(0,60)); }
      }

      const conn = new OdooConnector(cfg.url, cfg.database, cfg.username, cfg.password);
      await conn.authenticate();

      const results: Record<string,number> = {};

      // ── 1. دليل الحسابات ──────────────────────────────────────────────────
      if (input.models.includes("coa")) {
        const accounts = await conn.getChartOfAccounts(input.odooCompanyId);
        let n = 0;
        for (const acc of accounts) {
          const cfoType = odooTypeToCfoType(acc.account_type||"", acc.code||"", acc.name||"");
          try {
            await db.run(sql`INSERT OR REPLACE INTO accounts_coa
              (company_id, odoo_account_id, code, name, account_type, cfo_type, deprecated)
              VALUES (${input.companyId}, ${acc.id}, ${acc.code||""}, ${acc.name||""},
                      ${acc.account_type||""}, ${cfoType}, ${acc.deprecated?1:0})`);
            n++;
          } catch {}
        }
        results.coa = n;
        try { await db.run(sql`INSERT OR REPLACE INTO odoo_sync_registry (company_id, model_name, last_sync_at, records_count, status) VALUES (${input.companyId}, 'account.account', ${new Date().toISOString()}, ${n}, 'done')`); } catch {}
      }

      // ── 2. الدفاتر ────────────────────────────────────────────────────────
      if (input.models.includes("journals")) {
        const journals = await conn.getJournals(input.odooCompanyId);
        for (const j of journals) {
          try {
            await db.run(sql`INSERT OR REPLACE INTO odoo_journals
              (company_id, odoo_journal_id, name, code, type)
              VALUES (${input.companyId}, ${j.id}, ${j.name||""}, ${j.code||""}, ${j.type||""})`);
          } catch {}
        }
        results.journals = journals.length;
      }

      // ── 3. الشركاء ────────────────────────────────────────────────────────
      if (input.models.includes("partners")) {
        const partners = await conn.getPartners();
        let n = 0;
        for (const p of partners) {
          try {
            const country = Array.isArray(p.country_id) ? p.country_id[1]||"" : "";
            await db.run(sql`INSERT OR REPLACE INTO odoo_partners_full
              (company_id, odoo_partner_id, name, ref, email, phone, vat, city, country, is_customer, is_supplier, customer_rank, supplier_rank)
              VALUES (${input.companyId}, ${p.id}, ${p.name||""}, ${p.ref||""},
                      ${p.email||""}, ${p.phone||""}, ${p.vat||""}, ${p.city||""}, ${country},
                      ${(p.customer_rank||0)>0?1:0}, ${(p.supplier_rank||0)>0?1:0},
                      ${p.customer_rank||0}, ${p.supplier_rank||0})`);
            n++;
          } catch {}
        }
        results.partners = n;
      }

      // ── 4. القيود المحاسبية ───────────────────────────────────────────────
      if (input.models.includes("entries")) {

        // تحميل دليل الحسابات في memory
        const coaMap: Record<number,{code:string,name:string,cfoType:string}> = {};
        try {
          const coaRows = await db.run(sql`SELECT odoo_account_id, code, name, cfo_type FROM accounts_coa WHERE company_id=${input.companyId}`);
          for (const r of (coaRows as any).rows||[]) {
            coaMap[Number(r.odoo_account_id)] = { code:r.code||"0000", name:r.name||"", cfoType:r.cfo_type||"other" };
          }
        } catch {}

        // مسح القديم
        await db.run(sql`DELETE FROM journal_entry_lines WHERE company_id = ${input.companyId}`);
        await db.run(sql`DELETE FROM journal_entries WHERE company_id = ${input.companyId}`);

        // ── الرصيد الافتتاحي ───────────────────────────────────────────────
        let openingLines = 0;
        try {
          const oLines = await conn.getOpeningBalanceLines(input.odooCompanyId, input.dateFrom);
          openingLines = oLines.length;

          if (oLines.length > 0) {
            // إدراج قيد الرصيد الافتتاحي
            await db.run(sql`INSERT INTO journal_entries
              (company_id, name, journal_name, date, state, total_debit, total_credit)
              VALUES (${input.companyId}, 'رصيد افتتاحي', 'افتتاحي', ${input.dateFrom}, 'posted', 0, 0)`);
            const openRes = await db.run(sql`SELECT id FROM journal_entries WHERE company_id=${input.companyId} AND name='رصيد افتتاحي' ORDER BY id DESC LIMIT 1`);
            const openEntryId = (openRes as any).rows?.[0]?.id;

            if (openEntryId) {
              // تجميع الرصيد الافتتاحي حساباً حساباً
              const accSums: Record<string,{code:string,name:string,type:string,d:number,c:number}> = {};
              for (const l of oLines) {
                const accId = Array.isArray(l.account_id) ? Number(l.account_id[0]) : Number(l.account_id);
                const info  = coaMap[accId] || (() => {
                  const raw  = Array.isArray(l.account_id) ? String(l.account_id[1]||"") : "";
                  const code = raw.split(" ")[0] || "0000";
                  const name = raw.replace(/^\S+\s+/,"") || "";
                  return { code, name, cfoType: odooTypeToCfoType("", code, name) };
                })();
                if (!accSums[info.code]) accSums[info.code] = { code:info.code, name:info.name, type:info.cfoType, d:0, c:0 };
                accSums[info.code].d += Number(l.debit)||0;
                accSums[info.code].c += Number(l.credit)||0;
              }

              // تاريخ يوم قبل بداية الفترة
              const openDate = new Date(input.dateFrom);
              openDate.setDate(openDate.getDate()-1);
              const openDateStr = openDate.toISOString().split("T")[0];

              for (const acc of Object.values(accSums)) {
                const nd = Math.max(0, acc.d - acc.c);
                const nc = Math.max(0, acc.c - acc.d);
                if (nd === 0 && nc === 0) continue;
                try {
                  await db.run(sql`INSERT INTO journal_entry_lines
                    (journal_entry_id, company_id, account_code, account_name, account_type, label, debit, credit, date)
                    VALUES (${openEntryId}, ${input.companyId}, ${acc.code}, ${acc.name}, ${acc.type},
                            'رصيد افتتاحي', ${nd}, ${nc}, ${openDateStr})`);
                } catch {}
              }
            }
          }
        } catch(e:any) { console.log("Opening balance warn:", e.message?.slice(0,80)); }

        // ── استيراد القيود والسطور ─────────────────────────────────────────
        const total = await conn.countEntries(input.odooCompanyId, input.dateFrom, input.dateTo);
        let inserted = 0;
        const batchSize = 100;

        for (let offset = 0; offset < total; offset += batchSize) {
          const moves = await conn.getJournalEntries(input.odooCompanyId, input.dateFrom, input.dateTo, batchSize, offset);
          if (!moves.length) break;

          // إدراج القيود
          const moveToEntryId: Record<number,number> = {};
          for (const move of moves) {
            const jName = Array.isArray(move.journal_id) ? String(move.journal_id[1]||"") : "";
            const pName = Array.isArray(move.partner_id) ? String(move.partner_id[1]||"") : "";
            const mDate = String(move.date||input.dateFrom);
            try {
              await db.run(sql`INSERT OR REPLACE INTO journal_entries
                (company_id, odoo_move_id, name, ref, journal_name, date, state, total_debit, total_credit, partner_name, narration)
                VALUES (${input.companyId}, ${move.id}, ${move.name||""}, ${move.ref||""},
                        ${jName}, ${mDate}, 'posted',
                        ${Number(move.amount_total)||0}, ${Number(move.amount_total)||0},
                        ${pName}, ${move.narration||""})`);

              const eRes = await db.run(sql`SELECT id FROM journal_entries WHERE company_id=${input.companyId} AND odoo_move_id=${move.id} LIMIT 1`);
              const eId  = (eRes as any).rows?.[0]?.id;
              if (eId) moveToEntryId[move.id] = Number(eId);
            } catch {}
          }

          // إدراج السطور
          const moveIds = moves.map((m:any) => m.id as number);
          let lines: any[] = [];
          try { lines = await conn.getJournalLines(moveIds); } catch {}

          for (const line of lines) {
            const moveId = Array.isArray(line.move_id) ? Number(line.move_id[0]) : Number(line.move_id);
            const entryId = moveToEntryId[moveId];
            if (!entryId) continue;

            const accId  = Array.isArray(line.account_id) ? Number(line.account_id[0]) : 0;
            const info   = coaMap[accId] || (() => {
              const raw  = Array.isArray(line.account_id) ? String(line.account_id[1]||"") : "";
              const code = raw.split(" ")[0] || "0000";
              const name = raw.replace(/^\S+\s+/,"") || "";
              return { code, name, cfoType: odooTypeToCfoType("", code, name) };
            })();

            const pName   = Array.isArray(line.partner_id) ? String(line.partner_id[1]||"") : "";
            const lineDate = String(line.date || moves.find((m:any)=>m.id===moveId)?.date || input.dateFrom);

            try {
              await db.run(sql`INSERT OR IGNORE INTO journal_entry_lines
                (journal_entry_id, company_id, account_code, account_name, account_type, partner_name, label, debit, credit, date)
                VALUES (${entryId}, ${input.companyId}, ${info.code}, ${info.name}, ${info.cfoType},
                        ${pName}, ${line.name||""}, ${Number(line.debit)||0}, ${Number(line.credit)||0}, ${lineDate})`);
            } catch {}
          }
          inserted += moves.length;
        }

        results.entries      = inserted;
        results.openingLines = openingLines;
        results.total        = total;

        // سجل المزامنة
        try {
          await db.run(sql`INSERT OR REPLACE INTO odoo_sync_registry
            (company_id, model_name, last_sync_at, records_count, status)
            VALUES (${input.companyId}, 'account.move', ${new Date().toISOString()}, ${inserted}, 'done')`);
          await db.run(sql`INSERT INTO sync_logs
            (company_id, sync_type, status, entries, finished_at)
            VALUES (${input.companyId}, 'full', 'success', ${inserted}, ${new Date().toISOString()})`);
        } catch {}
      }

      return { success:true, ...results };
    }),


  // سجل المزامنة لكل النماذج
  getSyncRegistry: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const rows = await db.run(sql`SELECT * FROM odoo_sync_registry WHERE company_id=${input.companyId} ORDER BY last_sync_at DESC`);
      return (rows as any).rows || [];
    }),

  // قائمة الشركاء من قاعدة البيانات المحلية
  getPartnersList: protectedProcedure
    .input(z.object({ companyId:z.number(), type:z.string().optional() }))
    .query(async ({ input }) => {
      const where = input.type === "customer" ? sql`AND is_customer=1`
                  : input.type === "supplier" ? sql`AND is_supplier=1`
                  : sql``;
      const rows = await db.run(sql`SELECT * FROM odoo_partners_full WHERE company_id=${input.companyId} ${where} ORDER BY name LIMIT 500`);
      return (rows as any).rows || [];
    }),

  // دليل الحسابات المحلي
  getCoaList: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const rows = await db.run(sql`SELECT * FROM accounts_coa WHERE company_id=${input.companyId} AND deprecated=0 ORDER BY code`);
      return (rows as any).rows || [];
    }),

  getSyncStatus: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const logRows = await db.run(sql`SELECT * FROM sync_logs WHERE company_id = ${input.companyId} ORDER BY started_at DESC LIMIT 1`);
      const lastSync = (logRows as any).rows?.[0] || null;
      const [{ total }] = await db.select({ total:sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      const [{ lines }] = await db.select({ lines:sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId));
      return { lastSync, totalEntries:total, totalLines:lines };
    }),
});

// ── Journal ────────────────────────────────────────────────────────────────────
const journalRouter = router({

  // قائمة القيود مع pagination
  listEntries: protectedProcedure
    .input(z.object({ companyId:z.number(), page:z.number().default(1), limit:z.number().default(20) }))
    .query(async ({ input }) => {
      const offset = (input.page-1)*input.limit;
      const rows = await db.run(sql`
        SELECT * FROM journal_entries
        WHERE company_id=${input.companyId}
        ORDER BY date DESC, id DESC
        LIMIT ${input.limit} OFFSET ${offset}`);
      const cnt = await db.run(sql`SELECT count(*) as n FROM journal_entries WHERE company_id=${input.companyId}`);
      const total = Number((cnt as any).rows?.[0]?.n)||0;
      return { entries:(rows as any).rows||[], total, page:input.page, pages:Math.ceil(total/input.limit) };
    }),

  // حالة المزامنة
  syncStatus: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const logRes = await db.run(sql`SELECT * FROM sync_logs WHERE company_id=${input.companyId} ORDER BY started_at DESC LIMIT 1`);
      const lastSync = (logRes as any).rows?.[0]||null;
      const eCnt = await db.run(sql`SELECT count(*) as n FROM journal_entries WHERE company_id=${input.companyId}`);
      const lCnt = await db.run(sql`SELECT count(*) as n FROM journal_entry_lines WHERE company_id=${input.companyId}`);
      return { lastSync, totalEntries:Number((eCnt as any).rows?.[0]?.n)||0, totalLines:Number((lCnt as any).rows?.[0]?.n)||0 };
    }),

  // ميزان المراجعة 6 أعمدة
  trialBalance: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const cid = input.companyId, dF = input.dateFrom, dT = input.dateTo;

      // الرصيد الافتتاحي = كل السطور قبل بداية الفترة
      const openRes = await db.run(sql`
        SELECT account_code, account_name, account_type,
               SUM(debit) as od, SUM(credit) as oc
        FROM journal_entry_lines
        WHERE company_id=${cid} AND date < ${dF}
        GROUP BY account_code`);

      // حركة الفترة (باستثناء قيد رصيد افتتاحي)
      const mvtRes = await db.run(sql`
        SELECT jl.account_code, jl.account_name, jl.account_type,
               SUM(jl.debit) as md, SUM(jl.credit) as mc
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id=${cid}
          AND jl.date >= ${dF} AND jl.date <= ${dT}
          AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
        GROUP BY jl.account_code`);

      const map: Record<string,any> = {};
      for (const r of (openRes as any).rows||[]) {
        const code = String(r.account_code||"");
        map[code] = {
          accountCode:code, accountName:r.account_name||"",
          accountType:r.account_type||classifyAccount(code,r.account_name||""),
          openDebit:Number(r.od)||0, openCredit:Number(r.oc)||0, mvtDebit:0, mvtCredit:0
        };
      }
      for (const r of (mvtRes as any).rows||[]) {
        const code = String(r.account_code||"");
        if (!map[code]) map[code] = {
          accountCode:code, accountName:r.account_name||"",
          accountType:r.account_type||classifyAccount(code,r.account_name||""),
          openDebit:0, openCredit:0
        };
        map[code].mvtDebit  = Number(r.md)||0;
        map[code].mvtCredit = Number(r.mc)||0;
      }

      return Object.values(map)
        .filter((r:any)=>r.openDebit||r.openCredit||r.mvtDebit||r.mvtCredit)
        .map((r:any)=>{
          const netO = r.openDebit-r.openCredit, netM = r.mvtDebit-r.mvtCredit, netC = netO+netM;
          return {...r, openingBalance:netO, closingBalance:netC,
                  closingDebit:netC>0?netC:0, closingCredit:netC<0?Math.abs(netC):0};
        }).sort((a:any,b:any)=>String(a.accountCode).localeCompare(String(b.accountCode)));
    }),

  // قائمة الدخل
  incomeStatement: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const res = await db.run(sql`
        SELECT jl.account_type, jl.account_code, jl.account_name,
               SUM(jl.debit) as debit, SUM(jl.credit) as credit
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id=${input.companyId}
          AND jl.date >= ${input.dateFrom} AND jl.date <= ${input.dateTo}
          AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
        GROUP BY jl.account_code`);

      let revenue=0,cogs=0,expenses=0,otherIncome=0,otherExpenses=0;
      const details:Record<string,any[]> = {revenue:[],cogs:[],expenses:[],other_income:[],other_expenses:[]};

      for (const r of (res as any).rows||[]) {
        const type = r.account_type || classifyAccount(r.account_code||"", r.account_name||"");
        const d=Number(r.debit)||0, c=Number(r.credit)||0;
        const row = { accountCode:r.account_code, accountName:r.account_name, accountType:type, debit:d, credit:c };
        if (type==="revenue")         { revenue       += c-d; details.revenue.push({...row,net:c-d}); }
        else if (type==="cogs")       { cogs          += d-c; details.cogs.push({...row,net:d-c}); }
        else if (type==="expenses")   { expenses      += d-c; details.expenses.push({...row,net:d-c}); }
        else if (type==="other_income")    { otherIncome    += c-d; details.other_income.push({...row,net:c-d}); }
        else if (type==="other_expenses")  { otherExpenses  += d-c; details.other_expenses.push({...row,net:d-c}); }
      }
      const grossProfit=revenue-cogs, operatingProfit=grossProfit-expenses, netProfit=operatingProfit+otherIncome-otherExpenses;
      return { revenue,cogs,grossProfit,expenses,operatingProfit,otherIncome,otherExpenses,netProfit,details };
    }),

  // الميزانية العمومية
  balanceSheet: protectedProcedure
    .input(z.object({ companyId:z.number(), asOf:z.string() }))
    .query(async ({ input }) => {
      const res = await db.run(sql`
        SELECT jl.account_type, jl.account_code, jl.account_name,
               SUM(jl.debit) as debit, SUM(jl.credit) as credit
        FROM journal_entry_lines jl
        WHERE jl.company_id=${input.companyId} AND jl.date <= ${input.asOf}
        GROUP BY jl.account_code`);

      let assets=0, liabilities=0, equity=0;
      const details:Record<string,any[]> = {assets:[],liabilities:[],equity:[]};

      for (const r of (res as any).rows||[]) {
        const type = r.account_type || classifyAccount(r.account_code||"", r.account_name||"");
        const d=Number(r.debit)||0, c=Number(r.credit)||0;
        const row = { accountCode:r.account_code, accountName:r.account_name, accountType:type };
        if (type==="assets")      { const v=d-c; if(v!==0){assets+=v;      details.assets.push({...row,value:v});} }
        else if (type==="liabilities") { const v=c-d; if(v!==0){liabilities+=v; details.liabilities.push({...row,value:v});} }
        else if (type==="equity") { const v=c-d; if(v!==0){equity+=v;      details.equity.push({...row,value:v});} }
      }
      return { assets, liabilities, equity, totalLiabilitiesEquity:liabilities+equity, details };
    }),

  // دفتر الأستاذ العام
  generalLedger: protectedProcedure
    .input(z.object({ companyId:z.number(), accountCode:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      // الرصيد الافتتاحي
      const opRes = await db.run(sql`
        SELECT SUM(debit) as d, SUM(credit) as c
        FROM journal_entry_lines
        WHERE company_id=${input.companyId} AND account_code=${input.accountCode} AND date < ${input.dateFrom}`);
      const opD=Number((opRes as any).rows?.[0]?.d)||0, opC=Number((opRes as any).rows?.[0]?.c)||0;
      const openingBalance = opD - opC;

      // حركات الفترة
      const lRes = await db.run(sql`
        SELECT jl.id, jl.date, jl.label, jl.partner_name, jl.debit, jl.credit, je.name as entry_name
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id=${input.companyId} AND jl.account_code=${input.accountCode}
          AND jl.date >= ${input.dateFrom} AND jl.date <= ${input.dateTo}
          AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
        ORDER BY jl.date, jl.id`);

      let balance = openingBalance;
      const lines = ((lRes as any).rows||[]).map((l:any) => {
        balance += (Number(l.debit)||0) - (Number(l.credit)||0);
        return { id:l.id, date:l.date, label:l.label||"", partnerName:l.partner_name||"",
                 debit:Number(l.debit)||0, credit:Number(l.credit)||0,
                 entryName:l.entry_name||"", balance };
      });
      return { openingBalance, lines };
    }),

  // التحليل الشهري
  monthlyAnalysis: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const res = await db.run(sql`
        SELECT substr(jl.date,6,2) as m, jl.account_type,
               SUM(jl.debit) as d, SUM(jl.credit) as c
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id=${input.companyId}
          AND jl.date >= ${input.year+'-01-01'} AND jl.date <= ${input.year+'-12-31'}
          AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
        GROUP BY m, jl.account_type`);

      const months = Array.from({length:12},(_,i)=>({month:i+1,revenue:0,expenses:0,profit:0}));
      for (const r of (res as any).rows||[]) {
        const mi = parseInt(String(r.m||"0"))-1;
        if (mi<0||mi>11) continue;
        const type = r.account_type||"";
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (type==="revenue")                     months[mi].revenue  += c-d;
        else if (type==="expenses"||type==="cogs") months[mi].expenses += d-c;
      }
      months.forEach(m=>m.profit=m.revenue-m.expenses);
      return months;
    }),

  // كشف حساب شريك
  partnerStatement: protectedProcedure
    .input(z.object({ companyId:z.number(), partnerName:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const opRes = await db.run(sql`
        SELECT SUM(debit) as d, SUM(credit) as c
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id=${input.companyId} AND jl.partner_name=${input.partnerName}
          AND jl.date < ${input.dateFrom} AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')`);
      const opBalance = (Number((opRes as any).rows?.[0]?.d)||0) - (Number((opRes as any).rows?.[0]?.c)||0);

      const lRes = await db.run(sql`
        SELECT jl.date, jl.label, jl.account_code, jl.account_name, jl.debit, jl.credit, je.name as entry_name
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id=${input.companyId} AND jl.partner_name=${input.partnerName}
          AND jl.date >= ${input.dateFrom} AND jl.date <= ${input.dateTo}
          AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
        ORDER BY jl.date, jl.id`);

      let balance = opBalance;
      const lines = ((lRes as any).rows||[]).map((l:any) => {
        balance += (Number(l.debit)||0)-(Number(l.credit)||0);
        return { date:l.date, label:l.label||"", accountCode:l.account_code, accountName:l.account_name,
                 debit:Number(l.debit)||0, credit:Number(l.credit)||0, entryName:l.entry_name||"", balance };
      });
      return { openingBalance:opBalance, lines, finalBalance:balance };
    }),

  // الحسابات المتاحة
  getAccounts: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const res = await db.run(sql`
        SELECT DISTINCT account_code, account_name, account_type
        FROM journal_entry_lines WHERE company_id=${input.companyId}
        ORDER BY account_code`);
      return (res as any).rows||[];
    }),

  // الشركاء المتاحين
  getPartners: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const res = await db.run(sql`
        SELECT DISTINCT partner_name
        FROM journal_entry_lines
        WHERE company_id=${input.companyId} AND partner_name IS NOT NULL AND partner_name != ''
        ORDER BY partner_name`);
      return (res as any).rows||[];
    }),
});


// ── AI ─────────────────────────────────────────────────────────────────────────
const aiRouter = router({
  analyze: protectedProcedure
    .input(z.object({ companyId:z.number(), companyName:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .mutation(async ({ input }) => {
      const income = await db.select({ accountType:schema.journalEntryLines.accountType, debit:sql<number>`sum(debit)`, credit:sql<number>`sum(credit)` })
        .from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`, sql`${schema.journalEntries.name} != 'رصيد افتتاحي'`))
        .groupBy(schema.journalEntryLines.accountType);

      let revenue=0,expenses=0,cogs=0,assets=0,liabilities=0;
      for (const r of income) {
        if (r.accountType==="revenue") revenue+=(r.credit||0)-(r.debit||0);
        else if (r.accountType==="expenses") expenses+=(r.debit||0)-(r.credit||0);
        else if (r.accountType==="cogs") cogs+=(r.debit||0)-(r.credit||0);
        else if (r.accountType==="assets") assets+=(r.debit||0)-(r.credit||0);
        else if (r.accountType==="liabilities") liabilities+=(r.credit||0)-(r.debit||0);
      }
      const netProfit=revenue-cogs-expenses;
      const margin=revenue>0?((netProfit/revenue)*100).toFixed(1):"0";

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1200, messages:[{ role:"user", content:`أنت مستشار مالي خبير. قدّم تقريراً مالياً احترافياً باللغة العربية (400 كلمة) لشركة "${input.companyName}" للفترة من ${input.dateFrom} إلى ${input.dateTo}.\n\nالبيانات الفعلية:\n- الإيرادات: ${revenue.toLocaleString()}\n- تكلفة المبيعات: ${cogs.toLocaleString()}\n- مجمل الربح: ${(revenue-cogs).toLocaleString()}\n- المصروفات التشغيلية: ${expenses.toLocaleString()}\n- صافي الربح: ${netProfit.toLocaleString()}\n- هامش الربح: ${margin}%\n- الأصول: ${assets.toLocaleString()}\n- الالتزامات: ${liabilities.toLocaleString()}\n\nاكتب: ١) التقييم العام ٢) نقاط القوة (3) ٣) مجالات التحسين (2) ٤) التوصيات (3)` }] }),
      });
      const d = await res.json();
      return { report:d.content?.[0]?.text || "حدث خطأ" };
    }),

  chat: protectedProcedure
    .input(z.object({ companyId:z.number(), companyName:z.string(), message:z.string(), history:z.array(z.object({ role:z.string(), content:z.string() })) }))
    .mutation(async ({ input }) => {
      const rows = await db.select({ accountType:schema.journalEntryLines.accountType, debit:sql<number>`sum(debit)`, credit:sql<number>`sum(credit)` })
        .from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`${schema.journalEntries.name} != 'رصيد افتتاحي'`))
        .groupBy(schema.journalEntryLines.accountType);

      let revenue=0,expenses=0,cogs=0,assets=0,liabilities=0,equity=0;
      for (const r of rows) {
        if (r.accountType==="revenue") revenue+=(r.credit||0)-(r.debit||0);
        else if (r.accountType==="expenses") expenses+=(r.debit||0)-(r.credit||0);
        else if (r.accountType==="cogs") cogs+=(r.debit||0)-(r.credit||0);
        else if (r.accountType==="assets") assets+=(r.debit||0)-(r.credit||0);
        else if (r.accountType==="liabilities") liabilities+=(r.credit||0)-(r.debit||0);
        else if (r.accountType==="equity") equity+=(r.credit||0)-(r.debit||0);
      }
      const netProfit=revenue-cogs-expenses;
      const sys = `مستشار مالي ذكي لشركة "${input.companyName}". البيانات الفعلية: إيرادات ${revenue.toLocaleString()}, تكلفة ${cogs.toLocaleString()}, مصروفات ${expenses.toLocaleString()}, صافي ربح ${netProfit.toLocaleString()}, هامش ${revenue>0?((netProfit/revenue)*100).toFixed(1):0}%, أصول ${assets.toLocaleString()}, التزامات ${liabilities.toLocaleString()}. أجب بالعربية باختصار مهني (150 كلمة).`;

      const msgs = [...input.history.slice(-10).map(h=>({ role:h.role as "user"|"assistant", content:h.content })), { role:"user" as const, content:input.message }];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:600, system:sys, messages:msgs }),
      });
      const d = await res.json();
      return { reply:d.content?.[0]?.text || "حدث خطأ" };
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


// ── Company Groups (الشركات القابضة) ─────────────────────────────────────────
const groupsRouter = router({

  // قائمة المجموعات
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.run(sql`SELECT * FROM company_groups ORDER BY id DESC`);
    return (rows as any).rows || [];
  }),

  // إنشاء مجموعة جديدة
  create: adminProcedure
    .input(z.object({ name:z.string().min(2), description:z.string().optional(), baseCurrency:z.string().default("KWD") }))
    .mutation(async ({ input, ctx }) => {
      const res = await db.run(sql`INSERT INTO company_groups (name, description, base_currency, created_by) VALUES (${input.name}, ${input.description||""}, ${input.baseCurrency}, ${ctx.user.id}) RETURNING *`);
      const group = (res as any).rows?.[0] || { id:(res as any).lastInsertRowid, ...input };
      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, action:"create_group", target:input.name });
      return group;
    }),

  // حفظ إعدادات Odoo للمجموعة
  saveOdooConfig: adminProcedure
    .input(z.object({ groupId:z.number(), url:z.string(), database:z.string(), username:z.string(), password:z.string() }))
    .mutation(async ({ input }) => {
      await db.run(sql`UPDATE company_groups SET odoo_url=${input.url}, odoo_database=${input.database}, odoo_username=${input.username}, odoo_password=${input.password}, updated_at=${new Date().toISOString()} WHERE id=${input.groupId}`);
      return { success:true };
    }),

  // اختبار الاتصال واكتشاف الشركات
  testAndDiscover: adminProcedure
    .input(z.object({ groupId:z.number() }))
    .mutation(async ({ input }) => {
      const rows = await db.run(sql`SELECT * FROM company_groups WHERE id = ${input.groupId} LIMIT 1`);
      const group = (rows as any).rows?.[0];
      if (!group) throw new TRPCError({ code:"NOT_FOUND", message:"المجموعة غير موجودة" });
      if (!group.odoo_url) throw new TRPCError({ code:"BAD_REQUEST", message:"لم يتم إدخال بيانات Odoo بعد" });

      const conn = new OdooConnector(group.odoo_url, group.odoo_database, group.odoo_username, group.odoo_password);
      await conn.authenticate();
      const version = conn.getVersionString();
      const companies = await conn.getCompanies();

      // تحديث حالة الاتصال
      await db.run(sql`UPDATE company_groups SET is_connected=1, odoo_version=${version}, updated_at=${new Date().toISOString()} WHERE id=${input.groupId}`);

      return {
        success: true,
        version,
        companies: companies.map((c:any) => ({
          id: c.id,
          name: c.name,
          currency: Array.isArray(c.currency_id) ? c.currency_id[1] : "",
          city: c.city || "",
          vat: c.vat || "",
          street: c.street || "",
        }))
      };
    }),

  // ربط شركات Odoo بالمجموعة وإنشاؤها في النظام
  linkCompanies: adminProcedure
    .input(z.object({
      groupId: z.number(),
      companies: z.array(z.object({
        odooId: z.number(),
        name: z.string(),
        currency: z.string().default("KWD"),
        industry: z.string().optional(),
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const groupRows = await db.run(sql`SELECT * FROM company_groups WHERE id = ${input.groupId} LIMIT 1`);
      const group = (groupRows as any).rows?.[0];
      if (!group) throw new TRPCError({ code:"NOT_FOUND" });

      const created = [];
      for (const c of input.companies) {
        // تحقق إذا الشركة موجودة بالفعل
        const existing = await db.run(sql`SELECT id FROM company_group_members WHERE group_id=${input.groupId} AND odoo_company_id=${c.odooId} LIMIT 1`);
        if ((existing as any).rows?.length) {
          created.push({ odooId:c.odooId, name:c.name, status:"already_exists" });
          continue;
        }

        // إنشاء شركة في النظام
        const [newCo] = await db.insert(schema.companies).values({
          name: c.name,
          currency: c.currency || "KWD",
          industry: c.industry || "",
          createdBy: ctx.user.id,
        }).returning();

        // إعطاء المدير صلاحية الوصول
        await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, assigned_by, status) VALUES (${ctx.user.id}, ${newCo.id}, 'cfo_admin', ${ctx.user.id}, 'active')`);

        // نسخ إعدادات Odoo من المجموعة للشركة
        await db.run(sql`INSERT OR REPLACE INTO odoo_configs (company_id, url, database, username, password, odoo_company_id, odoo_company_name, is_connected) VALUES (${newCo.id}, ${group.odoo_url}, ${group.odoo_database}, ${group.odoo_username}, ${group.odoo_password}, ${c.odooId}, ${c.name}, 1)`);

        // ربط الشركة بالمجموعة
        await db.run(sql`INSERT INTO company_group_members (group_id, company_id, odoo_company_id, odoo_company_name, sync_status) VALUES (${input.groupId}, ${newCo.id}, ${c.odooId}, ${c.name}, 'pending')`);

        created.push({ odooId:c.odooId, companyId:newCo.id, name:c.name, status:"created" });
      }

      return { success:true, created };
    }),

  // قراءة أعضاء المجموعة مع حالة المزامنة
  getMembers: protectedProcedure
    .input(z.object({ groupId:z.number() }))
    .query(async ({ input }) => {
      const rows = await db.run(sql`
        SELECT
          m.*,
          c.name as company_name,
          c.currency,
          c.industry,
          (SELECT count(*) FROM journal_entries je WHERE je.company_id = m.company_id) as entry_count,
          (SELECT count(*) FROM journal_entry_lines jl WHERE jl.company_id = m.company_id) as line_count,
          (SELECT started_at FROM sync_logs sl WHERE sl.company_id = m.company_id ORDER BY started_at DESC LIMIT 1) as last_sync
        FROM company_group_members m
        JOIN companies c ON c.id = m.company_id
        WHERE m.group_id = ${input.groupId}
        ORDER BY m.id
      `);
      return (rows as any).rows || [];
    }),

  // ربط شركة واحدة (للتقدم التدريجي)
  linkSingleCompany: adminProcedure
    .input(z.object({
      groupId: z.number(),
      odooId: z.number(),
      name: z.string(),
      currency: z.string().default("KWD"),
      industry: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const groupRows = await db.run(sql`SELECT * FROM company_groups WHERE id = ${input.groupId} LIMIT 1`);
      const group = (groupRows as any).rows?.[0];
      if (!group) throw new TRPCError({ code:"NOT_FOUND" });

      // هل الشركة موجودة؟
      const existing = await db.run(sql`SELECT cgm.company_id, c.name FROM company_group_members cgm JOIN companies c ON c.id=cgm.company_id WHERE cgm.group_id=${input.groupId} AND cgm.odoo_company_id=${input.odooId} LIMIT 1`);
      if ((existing as any).rows?.length) {
        return { status:"already_exists", companyId:(existing as any).rows[0].company_id, name:input.name };
      }

      // 1. إنشاء الشركة في النظام
      const [newCo] = await db.insert(schema.companies).values({
        name: input.name, currency: input.currency,
        industry: input.industry || "", createdBy: ctx.user.id,
      }).returning();

      // 2. صلاحيات المستخدم الحالي
      await db.run(sql`INSERT OR IGNORE INTO user_company_access (user_id, company_id, role, assigned_by, status) VALUES (${ctx.user.id}, ${newCo.id}, 'cfo_admin', ${ctx.user.id}, 'active')`);

      // 3. نسخ إعدادات Odoo — مع ضمان وجود الأعمدة
      // أولاً: تأكد من وجود الأعمدة الجديدة
      try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN odoo_company_id INTEGER`); } catch {}
      try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN odoo_company_name TEXT`); } catch {}
      try { await db.run(sql`ALTER TABLE odoo_configs ADD COLUMN is_connected INTEGER DEFAULT 0`); } catch {}

      // ثانياً: INSERT بالقيم
      await db.run(sql`DELETE FROM odoo_configs WHERE company_id=${newCo.id}`);
      await db.run(sql`INSERT INTO odoo_configs (company_id, url, database, username, password, odoo_company_id, odoo_company_name, is_connected) VALUES (${newCo.id}, ${group.odoo_url}, ${group.odoo_database}, ${group.odoo_username}, ${group.odoo_password}, ${input.odooId}, ${input.name}, 1)`);

      // 4. ربط بالمجموعة
      await db.run(sql`INSERT INTO company_group_members (group_id, company_id, odoo_company_id, odoo_company_name, sync_status) VALUES (${input.groupId}, ${newCo.id}, ${input.odooId}, ${input.name}, 'pending')`);

      // 5. سجل المراجعة
      await db.insert(schema.auditLogs).values({ userId:ctx.user.id, companyId:newCo.id, action:"link_company_to_group", target:input.name });

      return { status:"created", companyId:newCo.id, name:input.name };
    }),

  // حذف مجموعة
  delete: adminProcedure
    .input(z.object({ id:z.number() }))
    .mutation(async ({ input }) => {
      await db.run(sql`DELETE FROM company_group_members WHERE group_id=${input.id}`);
      await db.run(sql`DELETE FROM company_groups WHERE id=${input.id}`);
      return { success:true };
    }),

  // تحديث حالة المزامنة لعضو
  updateSyncStatus: adminProcedure
    .input(z.object({ groupId:z.number(), companyId:z.number(), status:z.string() }))
    .mutation(async ({ input }) => {
      await db.run(sql`UPDATE company_group_members SET sync_status=${input.status}, last_sync_at=${new Date().toISOString()} WHERE group_id=${input.groupId} AND company_id=${input.companyId}`);
      return { success:true };
    }),
});


// ── Debug / Verify ─────────────────────────────────────────────────────────────
const debugRouter = router({
  // فحص حالة البيانات لشركة
  checkData: protectedProcedure
    .input(z.object({ companyId:z.number() }))
    .query(async ({ input }) => {
      const [entries]  = await db.select({ n:sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      const [lines]    = await db.select({ n:sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId));
      const [nullDate] = await db.select({ n:sql<number>`count(*)` }).from(schema.journalEntryLines).where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`(date IS NULL OR date = '')`));
      const [nullEntry]= await db.select({ n:sql<number>`count(*)` }).from(schema.journalEntryLines).where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`journal_entry_id NOT IN (SELECT id FROM journal_entries WHERE company_id=${input.companyId})`));

      const sampleLines = await db.select({
        id: schema.journalEntryLines.id,
        entryId: schema.journalEntryLines.journalEntryId,
        accountCode: schema.journalEntryLines.accountCode,
        accountType: schema.journalEntryLines.accountType,
        debit: schema.journalEntryLines.debit,
        credit: schema.journalEntryLines.credit,
        date: schema.journalEntryLines.date,
      }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId)).limit(5);

      const typeBreakdown = await db.select({
        accountType: schema.journalEntryLines.accountType,
        cnt: sql<number>`count(*)`,
        totalDebit: sql<number>`sum(debit)`,
        totalCredit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId)).groupBy(schema.journalEntryLines.accountType);

      const co = await db.select().from(schema.companies).where(eq(schema.companies.id, input.companyId)).limit(1);
      const cfg = await db.run(sql`SELECT company_id, url, odoo_company_id, odoo_company_name FROM odoo_configs WHERE company_id=${input.companyId} LIMIT 1`);

      return {
        company: co[0] || null,
        odooConfig: (cfg as any).rows?.[0] || null,
        journalEntries: entries.n,
        journalLines: lines.n,
        linesWithNoDate: nullDate.n,
        linesWithNoEntry: nullEntry.n,
        sampleLines,
        typeBreakdown,
        isHealthy: entries.n > 0 && lines.n > 0 && nullDate.n === 0,
      };
    }),

  // إصلاح التواريخ الفارغة في journal_entry_lines
  fixDates: adminProcedure
    .input(z.object({ companyId:z.number() }))
    .mutation(async ({ input }) => {
      // نسخ التاريخ من journal_entries إلى journal_entry_lines الفارغة
      const result = await db.run(sql`
        UPDATE journal_entry_lines
        SET date = (SELECT date FROM journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id)
        WHERE company_id = ${input.companyId}
        AND (date IS NULL OR date = '')
      `);
      return { fixed:(result as any).rowsAffected || 0 };
    }),

  // إصلاح account_type الفارغ
  fixAccountTypes: adminProcedure
    .input(z.object({ companyId:z.number() }))
    .mutation(async ({ input }) => {
      const lines = await db.select({ id:schema.journalEntryLines.id, accountCode:schema.journalEntryLines.accountCode, accountName:schema.journalEntryLines.accountName })
        .from(schema.journalEntryLines)
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), sql`(account_type IS NULL OR account_type = '' OR account_type = 'other')`));

      let fixed = 0;
      for (const line of lines) {
        const type = classifyAccount(line.accountCode, line.accountName||"");
        if (type !== "other") {
          await db.update(schema.journalEntryLines).set({ accountType:type }).where(eq(schema.journalEntryLines.id, line.id));
          fixed++;
        }
      }
      return { fixed };
    }),
});
export const appRouter = router({
  auth: authRouter,
  company: companyRouter,
  users: usersRouter,
  odoo: odooRouter,
  journal: journalRouter,
  ai: aiRouter,
  audit: auditRouter,
  groups: groupsRouter,
  debug: debugRouter,
});
export type AppRouter = typeof appRouter;

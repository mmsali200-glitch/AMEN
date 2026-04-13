import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db, schema } from "./db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, getUserFromToken } from "./auth.js";
import { OdooConnector, odooTypeToCfoType } from "./odoo.js";
import { runFullSync } from "./sync.js";

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

  // مزامنة شاملة باستخدام المحرك الجديد
  fullSync: protectedProcedure
    .input(z.object({
      companyId:     z.number(),
      odooCompanyId: z.number(),
      dateFrom:      z.string(),
      dateTo:        z.string(),
      models:        z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const logs: string[] = [];
      const result = await runFullSync({
        companyId:     input.companyId,
        odooCompanyId: input.odooCompanyId,
        dateFrom:      input.dateFrom,
        dateTo:        input.dateTo,
        onProgress:    (msg) => { logs.push(msg); console.log("[SYNC]", msg); }
      });
      return { success: true, ...result, logs };
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

      let assets=0, liabilities=0, equity=0, netProfit=0;
      const details:Record<string,any[]> = {assets:[],liabilities:[],equity:[]};

      for (const r of (res as any).rows||[]) {
        const type = r.account_type || classifyAccount(r.account_code||"", r.account_name||"");
        const d=Number(r.debit)||0, c=Number(r.credit)||0;
        const row = { accountCode:r.account_code, accountName:r.account_name, accountType:type };
        if (type==="assets")           { const v=d-c; if(v!==0){assets+=v; details.assets.push({...row,value:v});} }
        else if (type==="liabilities") { const v=c-d; if(v!==0){liabilities+=v; details.liabilities.push({...row,value:v});} }
        else if (type==="equity")      { const v=c-d; if(v!==0){equity+=v; details.equity.push({...row,value:v});} }
        // الأرباح المحتجزة تُضاف لحقوق الملكية
        else if (type==="revenue")     netProfit += c-d;
        else if (type==="cogs"||type==="expenses"||type==="other_expenses") netProfit -= d-c;
        else if (type==="other_income") netProfit += c-d;
      }
      // إضافة صافي الربح كعنصر في حقوق الملكية
      if (netProfit !== 0) {
        equity += netProfit;
        details.equity.push({ accountCode:"", accountName:"الأرباح المحتجزة", accountType:"equity", value:netProfit });
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

  // سطور قيد واحد — مع جلب بيانات الحساب من COA إذا كانت فارغة
  getEntryLines: protectedProcedure
    .input(z.object({ entryId:z.number(), companyId:z.number() }))
    .query(async ({ input }) => {
      const res = await db.run(sql`
        SELECT
          jl.id,
          COALESCE(NULLIF(jl.account_code,''), NULLIF(jl.account_code,'0000'), coa.code, '—') as account_code,
          COALESCE(NULLIF(jl.account_name,''), coa.name, '—') as account_name,
          COALESCE(NULLIF(jl.account_type,''), NULLIF(jl.account_type,'other'), coa.cfo_type, 'other') as account_type,
          COALESCE(jl.partner_name, '') as partner_name,
          COALESCE(jl.label, '') as label,
          jl.debit, jl.credit, jl.date
        FROM journal_entry_lines jl
        LEFT JOIN accounts_coa coa ON coa.company_id=jl.company_id AND coa.code=jl.account_code
        WHERE jl.journal_entry_id=${input.entryId}
          AND jl.company_id=${input.companyId}
        ORDER BY jl.id`);

      // تصنيف أي حساب لم يُصنَّف
      const lines = ((res as any).rows||[]).map((l:any)=>({
        ...l,
        account_type: l.account_type && l.account_type !== 'other'
          ? l.account_type
          : classifyAccount(String(l.account_code||''), String(l.account_name||'')),
      }));

      return { lines };
    }),


  // ══════════════════════════════════════════════════════════════════════════
  // 🎯 نظام تنبيهات الميزانية ومراكز التكلفة
  // ══════════════════════════════════════════════════════════════════════════

  // إنشاء/تحديث هدف مركز تكلفة
  upsertCostCenterTarget: protectedProcedure
    .input(z.object({
      companyId:        z.number(),
      analyticId:       z.number(),
      centerName:       z.string(),
      year:             z.number(),
      plannedExpenses:  z.number().default(0),
      targetRevenue:    z.number().default(0),
      alertExpPct:      z.number().default(80),
      alertRevPct:      z.number().default(70),
      notes:            z.string().optional(),
      monthlyTargets:   z.array(z.object({ month:z.number(), expenses:z.number(), revenue:z.number() })).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.run(sql`CREATE TABLE IF NOT EXISTS cost_center_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL, analytic_id INTEGER NOT NULL,
        center_name TEXT NOT NULL, year INTEGER NOT NULL,
        planned_expenses REAL DEFAULT 0, target_revenue REAL DEFAULT 0,
        alert_exp_pct REAL DEFAULT 80, alert_rev_pct REAL DEFAULT 70,
        notes TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(company_id, analytic_id, year))`).catch(()=>{});
      await db.run(sql`CREATE TABLE IF NOT EXISTS cost_center_monthly_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, target_id INTEGER NOT NULL,
        month INTEGER NOT NULL, planned_expenses REAL DEFAULT 0, target_revenue REAL DEFAULT 0,
        UNIQUE(target_id, month))`).catch(()=>{});
      await db.run(sql`CREATE TABLE IF NOT EXISTS budget_alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
        analytic_id INTEGER, center_name TEXT, alert_type TEXT, severity TEXT,
        message TEXT, actual_value REAL, planned_value REAL, pct_used REAL,
        channel TEXT DEFAULT 'in-app', is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});

      await db.run(sql`INSERT OR REPLACE INTO cost_center_targets
        (company_id, analytic_id, center_name, year, planned_expenses, target_revenue, alert_exp_pct, alert_rev_pct, notes, is_active)
        VALUES (${input.companyId}, ${input.analyticId}, ${input.centerName}, ${input.year},
                ${input.plannedExpenses}, ${input.targetRevenue}, ${input.alertExpPct}, ${input.alertRevPct},
                ${input.notes||""}, 1)`);

      if (input.monthlyTargets?.length) {
        const idRes = await db.run(sql`SELECT id FROM cost_center_targets WHERE company_id=${input.companyId} AND analytic_id=${input.analyticId} AND year=${input.year} LIMIT 1`);
        const tid = (idRes as any).rows?.[0]?.id;
        if (tid) {
          for (const m of input.monthlyTargets) {
            await db.run(sql`INSERT OR REPLACE INTO cost_center_monthly_targets (target_id, month, planned_expenses, target_revenue) VALUES (${tid}, ${m.month}, ${m.expenses}, ${m.revenue})`);
          }
        }
      }
      return { success: true };
    }),

  // حذف هدف
  deleteCostCenterTarget: protectedProcedure
    .input(z.object({ companyId:z.number(), analyticId:z.number(), year:z.number() }))
    .mutation(async ({ input }) => {
      await db.run(sql`DELETE FROM cost_center_targets WHERE company_id=${input.companyId} AND analytic_id=${input.analyticId} AND year=${input.year}`);
      return { success: true };
    }),

  // قائمة الأهداف مع الأداء الفعلي
  getCostCenterTargets: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      await db.run(sql`CREATE TABLE IF NOT EXISTS cost_center_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, analytic_id INTEGER NOT NULL, center_name TEXT NOT NULL, year INTEGER NOT NULL, planned_expenses REAL DEFAULT 0, target_revenue REAL DEFAULT 0, alert_exp_pct REAL DEFAULT 80, alert_rev_pct REAL DEFAULT 70, notes TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), UNIQUE(company_id, analytic_id, year))`).catch(()=>{});

      const targets = await db.run(sql`
        SELECT t.*, GROUP_CONCAT(m.month||':'||m.planned_expenses||':'||m.target_revenue) as monthly_data
        FROM cost_center_targets t
        LEFT JOIN cost_center_monthly_targets m ON m.target_id = t.id
        WHERE t.company_id = ${input.companyId} AND t.year = ${input.year} AND t.is_active = 1
        GROUP BY t.id ORDER BY t.planned_expenses DESC`).catch(()=>({rows:[]}));

      const dF = `${input.year}-01-01`, dT = `${input.year}-12-31`;

      // جلب الأداء الفعلي من analytic_lines
      const actuals = await db.run(sql`
        SELECT odoo_analytic_id, account_type,
               SUM(credit-debit) as amount
        FROM analytic_lines
        WHERE company_id=${input.companyId} AND date>=${dF} AND date<=${dT}
        GROUP BY odoo_analytic_id, account_type`).catch(()=>({rows:[]}));

      const actualsMap: Record<number, {rev:number, exp:number}> = {};
      for (const r of (actuals as any).rows||[]) {
        const id = Number(r.odoo_analytic_id);
        if (!actualsMap[id]) actualsMap[id] = {rev:0, exp:0};
        if (r.account_type==="revenue"||r.account_type==="other_income") actualsMap[id].rev += Number(r.amount)||0;
        else if (r.account_type==="expenses"||r.account_type==="cogs") actualsMap[id].exp += Math.abs(Number(r.amount)||0);
      }

      // fallback من journal_entry_lines إذا لا توجد analytic_lines
      if (Object.keys(actualsMap).length === 0) {
        const fbActuals = await db.run(sql`
          SELECT jl.account_code as analytic_id, jl.account_type,
                 SUM(jl.credit-jl.debit) as amount
          FROM journal_entry_lines jl
          LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
          WHERE jl.company_id=${input.companyId} AND jl.date>=${dF} AND jl.date<=${dT}
            AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
          GROUP BY jl.account_code, jl.account_type`).catch(()=>({rows:[]}));
        for (const r of (fbActuals as any).rows||[]) {
          const id = Number(r.analytic_id)||0;
          if (!actualsMap[id]) actualsMap[id] = {rev:0, exp:0};
          if (r.account_type==="revenue"||r.account_type==="other_income") actualsMap[id].rev += Number(r.amount)||0;
          else if (r.account_type==="expenses"||r.account_type==="cogs") actualsMap[id].exp += Math.abs(Number(r.amount)||0);
        }
      }

      const results = ((targets as any).rows||[]).map((t:any) => {
        const actual = actualsMap[Number(t.analytic_id)] || {rev:0, exp:0};
        const expPct = t.planned_expenses > 0 ? (actual.exp / t.planned_expenses * 100) : 0;
        const revPct = t.target_revenue > 0 ? (actual.rev / t.target_revenue * 100) : 0;

        // مستوى التنبيه
        let expStatus = "ok", revStatus = "ok";
        if (expPct >= 100) expStatus = "exceeded";
        else if (expPct >= (t.alert_exp_pct||80)) expStatus = "warning";
        else if (expPct >= 50) expStatus = "info";
        if (revPct < 50 && t.target_revenue > 0) revStatus = "warning";
        if (revPct < 30 && t.target_revenue > 0) revStatus = "critical";

        // تنبؤ بنهاية السنة
        const dayOfYear = Math.ceil((new Date().getTime() - new Date(`${input.year}-01-01`).getTime()) / 86400000);
        const yearProgress = dayOfYear / 365;
        const forecastExp = yearProgress > 0 ? actual.exp / yearProgress : 0;
        const forecastRev = yearProgress > 0 ? actual.rev / yearProgress : 0;

        // أداء مصفوفة
        const matrix = expStatus !== "exceeded" && revPct >= 100 ? "excellent"
          : expStatus !== "exceeded" && revPct < 100 ? "rev_needed"
          : expStatus === "exceeded" && revPct >= 100 ? "monitor"
          : "danger";

        // Monthly parse
        const monthly = (t.monthly_data||"").split(",").filter(Boolean).map((s:string)=>{
          const [m, pe, tr] = s.split(":");
          return { month:Number(m), planned_expenses:Number(pe), target_revenue:Number(tr) };
        });

        return {
          id: t.id, analyticId: t.analytic_id, centerName: t.center_name, year: t.year,
          plannedExpenses: t.planned_expenses, targetRevenue: t.target_revenue,
          alertExpPct: t.alert_exp_pct, alertRevPct: t.alert_rev_pct, notes: t.notes,
          actualExpenses: actual.exp, actualRevenue: actual.rev,
          expPct: Math.round(expPct*10)/10, revPct: Math.round(revPct*10)/10,
          expStatus, revStatus, matrix,
          forecastExp: Math.round(forecastExp), forecastRev: Math.round(forecastRev),
          varExp: actual.exp - t.planned_expenses, varRev: actual.rev - t.target_revenue,
          netProfit: actual.rev - actual.exp, plannedProfit: t.target_revenue - t.planned_expenses,
          monthly,
        };
      });

      // إجماليات
      const totals = results.reduce((s:any, r:any) => ({
        plannedExp: s.plannedExp + r.plannedExpenses, actualExp: s.actualExp + r.actualExpenses,
        targetRev:  s.targetRev  + r.targetRevenue,  actualRev: s.actualRev  + r.actualRevenue,
        exceeded:   s.exceeded + (r.expStatus==="exceeded"?1:0),
        revMissed:  s.revMissed + (r.revStatus!=="ok"?1:0),
      }), { plannedExp:0, actualExp:0, targetRev:0, actualRev:0, exceeded:0, revMissed:0 });

      return { targets: results, totals };
    }),

  // سجل التنبيهات
  getAlertHistory: protectedProcedure
    .input(z.object({ companyId:z.number(), limit:z.number().default(50) }))
    .query(async ({ input }) => {
      await db.run(sql`CREATE TABLE IF NOT EXISTS budget_alert_history (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, analytic_id INTEGER, center_name TEXT, alert_type TEXT, severity TEXT, message TEXT, actual_value REAL, planned_value REAL, pct_used REAL, channel TEXT DEFAULT 'in-app', is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});
      const res = await db.run(sql`SELECT * FROM budget_alert_history WHERE company_id=${input.companyId} ORDER BY created_at DESC LIMIT ${input.limit}`).catch(()=>({rows:[]}));
      return (res as any).rows||[];
    }),

  // تسجيل تنبيه
  recordAlert: protectedProcedure
    .input(z.object({ companyId:z.number(), analyticId:z.number().optional(), centerName:z.string(), alertType:z.string(), severity:z.string(), message:z.string(), actualValue:z.number().optional(), plannedValue:z.number().optional(), pctUsed:z.number().optional() }))
    .mutation(async ({ input }) => {
      await db.run(sql`CREATE TABLE IF NOT EXISTS budget_alert_history (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, analytic_id INTEGER, center_name TEXT, alert_type TEXT, severity TEXT, message TEXT, actual_value REAL, planned_value REAL, pct_used REAL, channel TEXT DEFAULT 'in-app', is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`).catch(()=>{});
      await db.run(sql`INSERT INTO budget_alert_history (company_id, analytic_id, center_name, alert_type, severity, message, actual_value, planned_value, pct_used) VALUES (${input.companyId}, ${input.analyticId||0}, ${input.centerName}, ${input.alertType}, ${input.severity}, ${input.message}, ${input.actualValue||0}, ${input.plannedValue||0}, ${input.pctUsed||0})`);
      return { success: true };
    }),

  // فحص تلقائي وإرسال التنبيهات
  checkAndFireAlerts: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .mutation(async ({ input }) => {
      const cid = input.companyId, yr = input.year;
      const dF = `${yr}-01-01`, dT = `${yr}-12-31`;

      // جلب الأهداف والأداء الفعلي
      const targets = await db.run(sql`SELECT * FROM cost_center_targets WHERE company_id=${cid} AND year=${yr} AND is_active=1`).catch(()=>({rows:[]}));
      const actuals = await db.run(sql`
        SELECT odoo_analytic_id, account_type, SUM(credit-debit) as amount
        FROM analytic_lines WHERE company_id=${cid} AND date>=${dF} AND date<=${dT}
        GROUP BY odoo_analytic_id, account_type`).catch(()=>({rows:[]}));

      const actualsMap:Record<number,{rev:number,exp:number}> = {};
      for (const r of (actuals as any).rows||[]) {
        const id=Number(r.odoo_analytic_id); if(!actualsMap[id])actualsMap[id]={rev:0,exp:0};
        if(r.account_type==="revenue"||r.account_type==="other_income")actualsMap[id].rev+=Number(r.amount)||0;
        else if(r.account_type==="expenses"||r.account_type==="cogs")actualsMap[id].exp+=Math.abs(Number(r.amount)||0);
      }

      const dayOfYear = Math.ceil((new Date().getTime()-new Date(`${yr}-01-01`).getTime())/86400000);
      const yearPct   = dayOfYear/365;
      const fired:string[] = [];

      for (const t of (targets as any).rows||[]) {
        const actual = actualsMap[Number(t.analytic_id)]||{rev:0,exp:0};
        const expPct  = t.planned_expenses>0?actual.exp/t.planned_expenses*100:0;
        const revPct  = t.target_revenue>0?actual.rev/t.target_revenue*100:0;

        // فحص المصروفات
        let severity:string|null = null, msg = "";
        if (expPct>=100)  { severity="emergency"; msg=`🚨 تجاوز ميزانية المصروفات ${expPct.toFixed(0)}% — ${t.center_name}`; }
        else if(expPct>=(t.alert_exp_pct||80)) { severity="critical"; msg=`⚠️ اقتراب من حد الميزانية ${expPct.toFixed(0)}% — ${t.center_name}`; }
        else if(expPct>=70) { severity="warning"; msg=`⚠️ استهلاك 70%+ من الميزانية — ${t.center_name}`; }

        if (severity) {
          // تحقق إذا لم يُرسل نفس التنبيه اليوم
          const today = new Date().toISOString().split("T")[0];
          const dup = await db.run(sql`SELECT id FROM budget_alert_history WHERE company_id=${cid} AND analytic_id=${t.analytic_id} AND severity=${severity} AND date(created_at)=${today} LIMIT 1`).catch(()=>({rows:[]}));
          if (!(dup as any).rows?.length) {
            await db.run(sql`INSERT INTO budget_alert_history (company_id, analytic_id, center_name, alert_type, severity, message, actual_value, planned_value, pct_used) VALUES (${cid}, ${t.analytic_id}, ${t.center_name}, 'expenses', ${severity}, ${msg}, ${actual.exp}, ${t.planned_expenses}, ${expPct})`);
            fired.push(msg);
          }
        }

        // تنبؤ بنهاية السنة
        if (yearPct > 0.1) {
          const forecastExp = actual.exp / yearPct;
          if (forecastExp > t.planned_expenses * 1.15) {
            const excessPct = ((forecastExp-t.planned_expenses)/t.planned_expenses*100).toFixed(0);
            const predMsg = `📈 تنبؤ: ميزانية ${t.center_name} ستتجاوز الحد بـ ${excessPct}% بنهاية السنة`;
            const today = new Date().toISOString().split("T")[0];
            const dup2 = await db.run(sql`SELECT id FROM budget_alert_history WHERE company_id=${cid} AND analytic_id=${t.analytic_id} AND alert_type='forecast' AND date(created_at)=${today} LIMIT 1`).catch(()=>({rows:[]}));
            if (!(dup2 as any).rows?.length) {
              await db.run(sql`INSERT INTO budget_alert_history (company_id, analytic_id, center_name, alert_type, severity, message, actual_value, planned_value, pct_used) VALUES (${cid}, ${t.analytic_id}, ${t.center_name}, 'forecast', 'warning', ${predMsg}, ${forecastExp}, ${t.planned_expenses}, ${forecastExp/t.planned_expenses*100})`);
              fired.push(predMsg);
            }
          }
        }

        // تنبيه الإيرادات القاصرة
        if (yearPct > 0.5 && t.target_revenue > 0 && revPct < 50) {
          const revMsg = `💰 ${t.center_name}: الإيرادات ${revPct.toFixed(0)}% من الهدف في منتصف السنة`;
          const today  = new Date().toISOString().split("T")[0];
          const dup3 = await db.run(sql`SELECT id FROM budget_alert_history WHERE company_id=${cid} AND analytic_id=${t.analytic_id} AND alert_type='revenue' AND date(created_at)=${today} LIMIT 1`).catch(()=>({rows:[]}));
          if (!(dup3 as any).rows?.length) {
            await db.run(sql`INSERT INTO budget_alert_history (company_id, analytic_id, center_name, alert_type, severity, message, actual_value, planned_value, pct_used) VALUES (${cid}, ${t.analytic_id}, ${t.center_name}, 'revenue', 'warning', ${revMsg}, ${actual.rev}, ${t.target_revenue}, ${revPct})`);
            fired.push(revMsg);
          }
        }
      }

      return { fired, count: fired.length };
    }),

  // الملخص اليومي الصباحي
  dailySummary: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const unread = await db.run(sql`SELECT count(*) n FROM budget_alert_history WHERE company_id=${input.companyId} AND is_read=0`).catch(()=>({rows:[{n:0}]}));
      const exceeded = await db.run(sql`SELECT count(*) n FROM budget_alert_history WHERE company_id=${input.companyId} AND severity='emergency' AND is_read=0`).catch(()=>({rows:[{n:0}]}));
      return {
        unreadAlerts: Number((unread as any).rows?.[0]?.n||0),
        emergencyCount: Number((exceeded as any).rows?.[0]?.n||0),
      };
    }),

  // تحديد تنبيه كمقروء
  markAlertRead: protectedProcedure
    .input(z.object({ companyId:z.number(), alertId:z.number().optional() }))
    .mutation(async ({ input }) => {
      if (input.alertId) {
        await db.run(sql`UPDATE budget_alert_history SET is_read=1 WHERE id=${input.alertId}`);
      } else {
        await db.run(sql`UPDATE budget_alert_history SET is_read=1 WHERE company_id=${input.companyId}`);
      }
      return { success: true };
    }),

  // ══ تقرير المبيعات اليومية حسب مراكز التكلفة ════════════════════════════
  dailySalesReport: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      dateFrom:  z.string(),
      dateTo:    z.string(),
      compareFrom: z.string().optional(), // فترة المقارنة (السنة الماضية)
      compareTo:   z.string().optional(),
      accountTypes: z.array(z.string()).default(["revenue","other_income"]),
    }))
    .query(async ({ input }) => {
      const { companyId: cid, dateFrom: dF, dateTo: dT } = input;

      // بناء lookup شامل للحسابات التحليلية من جميع الشركات
      const allAnalytic = await db.run(sql`
        SELECT odoo_analytic_id, name, code
        FROM analytic_accounts
        ORDER BY name`).catch(()=>({rows:[]}));

      const analyticLookup: Record<number, {name:string, code:string}> = {};
      for (const r of (allAnalytic as any).rows||[]) {
        analyticLookup[Number(r.odoo_analytic_id)] = {
          name: r.name || `مركز #${r.odoo_analytic_id}`,
          code: r.code || ""
        };
      }

      // جلب الحركات اليومية من analytic_lines حسب مركز التكلفة
      const inTypes = input.accountTypes.map(t => `'${t}'`).join(',');
      const rows = await db.run(sql`
        SELECT
          al.date,
          al.odoo_analytic_id,
          al.analytic_name,
          SUM(al.credit - al.debit) as amount,
          COUNT(*) as txn_count
        FROM analytic_lines al
        WHERE al.company_id = ${cid}
          AND al.date >= ${dF}
          AND al.date <= ${dT}
          AND al.account_type IN (${inTypes})
        GROUP BY al.date, al.odoo_analytic_id
        ORDER BY al.date, al.odoo_analytic_id`).catch(()=>({rows:[]}));

      // إذا لا توجد analytic_lines، جرّب من journal_entry_lines بطريقتين
      const mainRows = (rows as any).rows || [];
      let finalRows = mainRows;

      if (mainRows.length === 0) {
        // محاولة 1: group by partner_name (الشريك = العميل / المشروع)
        const fbRows1 = await db.run(sql`
          SELECT
            jl.date,
            COALESCE(NULLIF(jl.partner_name,''), jl.account_code) as odoo_analytic_id,
            COALESCE(NULLIF(jl.partner_name,''), jl.account_name) as analytic_name,
            SUM(jl.credit - jl.debit) as amount,
            COUNT(*) as txn_count
          FROM journal_entry_lines jl
          LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
          WHERE jl.company_id = ${cid}
            AND jl.date >= ${dF}
            AND jl.date <= ${dT}
            AND jl.account_type IN (${inTypes})
            AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
          GROUP BY jl.date, COALESCE(NULLIF(jl.partner_name,''), jl.account_code)
          ORDER BY jl.date, amount DESC`).catch(()=>({rows:[]}));

        if ((fbRows1 as any).rows?.length > 0) {
          finalRows = (fbRows1 as any).rows;
        } else {
          // محاولة 2: group by journal_name (نوع الدفتر)
          const fbRows2 = await db.run(sql`
            SELECT
              jl.date,
              je.journal_name as odoo_analytic_id,
              je.journal_name as analytic_name,
              SUM(jl.credit - jl.debit) as amount,
              COUNT(*) as txn_count
            FROM journal_entry_lines jl
            LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
            WHERE jl.company_id = ${cid}
              AND jl.date >= ${dF}
              AND jl.date <= ${dT}
              AND jl.account_type IN (${inTypes})
              AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
            GROUP BY jl.date, je.journal_name
            ORDER BY jl.date, amount DESC`).catch(()=>({rows:[]}));
          finalRows = (fbRows2 as any).rows || [];
        }
      }

      // بناء المصفوفة: { date -> { centerId -> amount } }
      const dateMap: Record<string, Record<string, number>> = {};
      const centerSet: Set<string> = new Set();
      const centerNames: Record<string, {name:string, code:string}> = {};

      for (const r of finalRows) {
        const date     = String(r.date);
        const centerId = String(r.odoo_analytic_id);
        const amount   = Number(r.amount) || 0;
        if (amount <= 0) continue;

        if (!dateMap[date]) dateMap[date] = {};
        dateMap[date][centerId] = (dateMap[date][centerId] || 0) + amount;
        centerSet.add(centerId);

        if (!centerNames[centerId]) {
          const fromLookup = analyticLookup[Number(centerId)];
          centerNames[centerId] = {
            name: fromLookup?.name || String(r.analytic_name || `مركز ${centerId}`),
            code: fromLookup?.code || ""
          };
        }
      }

      // حساب إجمالي كل مركز لترتيب المراكز
      const centerTotals: Record<string, number> = {};
      for (const [, dayData] of Object.entries(dateMap)) {
        for (const [ctr, amt] of Object.entries(dayData)) {
          centerTotals[ctr] = (centerTotals[ctr] || 0) + amt;
        }
      }
      const centers = [...centerSet]
        .sort((a, b) => (centerTotals[b]||0) - (centerTotals[a]||0));

      // قائمة الأيام المرتبة
      const dates = Object.keys(dateMap).sort();

      // إجمالي MTD لكل مركز
      const mtdByCtr: Record<string,number> = {};
      for (const cid2 of centers) mtdByCtr[cid2] = centerTotals[cid2] || 0;
      const grandTotal = Object.values(mtdByCtr).reduce((s,v)=>s+v,0);

      // إجمالي يومي
      const dailyTotal: Record<string,number> = {};
      for (const [date, dayData] of Object.entries(dateMap)) {
        dailyTotal[date] = Object.values(dayData).reduce((s,v)=>s+v,0);
      }

      // بيانات المقارنة (السنة الماضية) — اختياري
      let compareData: Record<string, number> = {};
      if (input.compareFrom && input.compareTo) {
        const cmpRows = await db.run(sql`
          SELECT al.odoo_analytic_id, SUM(al.credit - al.debit) as amount
          FROM analytic_lines al
          WHERE al.company_id = ${cid}
            AND al.date >= ${input.compareFrom}
            AND al.date <= ${input.compareTo}
            AND al.account_type IN (${inTypes})
          GROUP BY al.odoo_analytic_id`).catch(()=>({rows:[]}));
        for (const r of (cmpRows as any).rows||[]) {
          compareData[String(r.odoo_analytic_id)] = Number(r.amount)||0;
        }
      }

      return {
        source: mainRows.length > 0 ? "analytic_lines" : "journal_entry_lines",
        centers,
        centerNames,
        dates,
        dateMap,
        mtdByCtr,
        dailyTotal,
        grandTotal,
        compareData,
        centerTotals,
      };
    }),

  // ── اسماء المراكز التحليلية (للاختيار في الفلتر) ──────────────────────
  analyticCenterList: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const rows = await db.run(sql`
        SELECT DISTINCT odoo_analytic_id, analytic_name, account_type
        FROM analytic_lines
        WHERE company_id = ${input.companyId}
          AND account_type IN ('revenue','other_income')
        GROUP BY odoo_analytic_id
        ORDER BY SUM(credit-debit) DESC
        LIMIT 50`).catch(()=>({rows:[]}));

      const all = await db.run(sql`
        SELECT odoo_analytic_id, name, code FROM analytic_accounts ORDER BY name`).catch(()=>({rows:[]}));
      const lookup: Record<number,{name:string,code:string}> = {};
      for (const r of (all as any).rows||[]) {
        lookup[Number(r.odoo_analytic_id)] = {name:r.name||"",code:r.code||""};
      }

      return ((rows as any).rows||[]).map((r:any) => ({
        id: r.odoo_analytic_id,
        name: lookup[Number(r.odoo_analytic_id)]?.name || r.analytic_name || `مركز ${r.odoo_analytic_id}`,
        code: lookup[Number(r.odoo_analytic_id)]?.code || "",
      }));
    }),

  // ── Pre-computed Dashboard Summary (fast) ───────────────────────────────
  dashboardSummary: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const dF = `${input.year}-01-01`, dT = `${input.year}-12-31`;
      // Single query for all metrics (replaces 3 separate queries)
      const res = await db.run(sql`
        SELECT
          jl.account_type,
          SUM(jl.debit)   as d,
          SUM(jl.credit)  as c,
          count(*)        as n
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
        WHERE jl.company_id=${input.companyId}
          AND jl.date>=${dF} AND jl.date<=${dT}
          AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
        GROUP BY jl.account_type`);

      let rev=0,cogs=0,exp=0,assets=0,liab=0;
      for (const r of (res as any).rows||[]) {
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (r.account_type==="revenue")      rev   +=c-d;
        else if (r.account_type==="cogs")    cogs  +=d-c;
        else if (r.account_type==="expenses")exp   +=d-c;
        else if (r.account_type==="assets")  assets+=d-c;
        else if (r.account_type==="liabilities") liab+=c-d;
      }

      const eCnt = await db.run(sql`SELECT count(*) n, max(date) mx, min(date) mn FROM journal_entries WHERE company_id=${input.companyId}`);
      const lCnt = await db.run(sql`SELECT count(*) n FROM journal_entry_lines WHERE company_id=${input.companyId}`);

      return {
        revenue:rev, cogs, expenses:exp, netProfit:rev-cogs-exp,
        grossProfit:rev-cogs, grossMargin:rev>0?(rev-cogs)/rev*100:0,
        netMargin:rev>0?(rev-cogs-exp)/rev*100:0,
        assets, liabilities:liab, equity:assets-liab,
        totalEntries:Number((eCnt as any).rows?.[0]?.n)||0,
        totalLines:Number((lCnt as any).rows?.[0]?.n)||0,
        dateRange:{ from:(eCnt as any).rows?.[0]?.mn, to:(eCnt as any).rows?.[0]?.mx },
      };
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

  // ── تقرير شيخوخة الديون (Aging Report) ─────────────────────────────────
  agingReport: protectedProcedure
    .input(z.object({ companyId:z.number(), asOf:z.string(), type:z.string().default("receivable") }))
    .query(async ({ input }) => {
      const cid = input.companyId, dt = input.asOf;
      // حسابات المدينين (1xxx) أو الدائنين (2xxx)
      const prefix = input.type === "receivable" ? "1" : "2";

      const rows = await db.run(sql`
        SELECT
          jl.partner_name,
          jl.account_code, jl.account_name,
          jl.date,
          SUM(jl.debit - jl.credit) as balance,
          CAST(julianday(${dt}) - julianday(jl.date) AS INTEGER) as days_outstanding
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.company_id = ${cid}
          AND jl.date <= ${dt}
          AND jl.account_code LIKE ${prefix + '%'}
          AND (je.name IS NULL OR je.name != 'رصيد افتتاحي')
          AND jl.partner_name IS NOT NULL AND jl.partner_name != ''
        GROUP BY jl.partner_name, jl.account_code, jl.date
        HAVING ABS(balance) > 0.01
        ORDER BY days_outstanding DESC`);

      // تجميع بالشريك + تصنيف حسب الفئة الزمنية
      const partners: Record<string, any> = {};
      for (const r of (rows as any).rows || []) {
        const key = String(r.partner_name || "");
        const days = Number(r.days_outstanding) || 0;
        const bal  = Number(r.balance) || 0;
        if (!partners[key]) partners[key] = { name:key, current:0, d30:0, d60:0, d90:0, d90plus:0, total:0 };
        partners[key].total += bal;
        if (days <= 30)       partners[key].current += bal;
        else if (days <= 60)  partners[key].d30 += bal;
        else if (days <= 90)  partners[key].d60 += bal;
        else if (days <= 180) partners[key].d90 += bal;
        else                  partners[key].d90plus += bal;
      }

      const list = Object.values(partners)
        .filter((p:any) => Math.abs(p.total) > 0.01)
        .sort((a:any, b:any) => Math.abs(b.total) - Math.abs(a.total));

      const totals = list.reduce((t:any, p:any) => ({
        current:   t.current   + p.current,
        d30:       t.d30       + p.d30,
        d60:       t.d60       + p.d60,
        d90:       t.d90       + p.d90,
        d90plus:   t.d90plus   + p.d90plus,
        total:     t.total     + p.total,
      }), { current:0, d30:0, d60:0, d90:0, d90plus:0, total:0 });

      return { type:input.type, asOf:dt, partners:list, totals };
    }),

  // ── DuPont Analysis ───────────────────────────────────────────────────────
  dupont: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const dF = `${input.year}-01-01`, dT = `${input.year}-12-31`;
      const income = await db.run(sql`
        SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c
        FROM journal_entry_lines jl LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
        WHERE jl.company_id=${input.companyId} AND jl.date>=${dF} AND jl.date<=${dT}
          AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
        GROUP BY jl.account_type`);
      const bs = await db.run(sql`
        SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c
        FROM journal_entry_lines jl WHERE jl.company_id=${input.companyId} AND jl.date<=${dT}
        GROUP BY jl.account_type`);

      let rev=0, cogs=0, exp=0, assets=0, equity=0, liab=0, profit=0;
      for (const r of (income as any).rows||[]) {
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (r.account_type==="revenue") rev+=c-d;
        else if (r.account_type==="cogs") cogs+=d-c;
        else if (r.account_type==="expenses") exp+=d-c;
      }
      profit = rev - cogs - exp;
      for (const r of (bs as any).rows||[]) {
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (r.account_type==="assets") assets+=d-c;
        else if (r.account_type==="liabilities") liab+=c-d;
        else if (r.account_type==="equity") equity+=c-d;
      }
      equity += profit;

      const netMargin    = rev > 0 ? profit/rev : 0;
      const assetTurnover = assets > 0 ? rev/assets : 0;
      const leverage      = equity > 0 ? assets/equity : 0;
      const roe           = netMargin * assetTurnover * leverage;

      return {
        revenue:rev, netProfit:profit, assets, equity, liab,
        netMargin: netMargin*100, assetTurnover, leverage,
        roa: assets>0?profit/assets*100:0,
        roe: roe*100,
        grossMargin: rev>0?(rev-cogs)/rev*100:0,
        operatingMargin: rev>0?(rev-cogs-exp)/rev*100:0,
        debtRatio: assets>0?liab/assets*100:0,
        equityMultiplier: leverage,
      };
    }),

  // ── Altman Z-Score ────────────────────────────────────────────────────────
  altmanZScore: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const dT = `${input.year}-12-31`, dF = `${input.year}-01-01`;
      const bs = await db.run(sql`SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c FROM journal_entry_lines jl WHERE jl.company_id=${input.companyId} AND jl.date<=${dT} GROUP BY jl.account_type`);
      const inc = await db.run(sql`SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c FROM journal_entry_lines jl LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id WHERE jl.company_id=${input.companyId} AND jl.date>=${dF} AND jl.date<=${dT} AND (je.name IS NULL OR je.name!='رصيد افتتاحي') GROUP BY jl.account_type`);

      let assets=0, liab=0, equity=0, rev=0, cogs=0, exp=0;
      for (const r of (bs as any).rows||[]) {
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (r.account_type==="assets") assets+=d-c;
        else if (r.account_type==="liabilities") liab+=c-d;
        else if (r.account_type==="equity") equity+=c-d;
      }
      for (const r of (inc as any).rows||[]) {
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (r.account_type==="revenue") rev+=c-d;
        else if (r.account_type==="cogs") cogs+=d-c;
        else if (r.account_type==="expenses") exp+=d-c;
      }
      const netProfit = rev - cogs - exp;
      equity += netProfit;
      const workingCapital = assets * 0.4 - liab * 0.6; // تقدير
      const retainedEarnings = netProfit * 0.7;
      const ebit = netProfit * 1.3;
      const marketEquity = equity;

      const x1 = assets > 0 ? workingCapital/assets : 0;
      const x2 = assets > 0 ? retainedEarnings/assets : 0;
      const x3 = assets > 0 ? ebit/assets : 0;
      const x4 = liab > 0 ? marketEquity/liab : 0;
      const x5 = assets > 0 ? rev/assets : 0;

      const z = 1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5;

      const zone = z > 2.99 ? "safe" : z > 1.81 ? "grey" : "distress";
      const zoneLabel = zone==="safe"?"✅ منطقة آمنة":zone==="grey"?"⚠️ منطقة رمادية":"❌ منطقة الضائقة";

      return {
        z: Number(z.toFixed(3)), zone, zoneLabel,
        x1:Number((x1*100).toFixed(2)), x2:Number((x2*100).toFixed(2)),
        x3:Number((x3*100).toFixed(2)), x4:Number((x4*100).toFixed(2)),
        x5:Number((x5).toFixed(3)),
        assets, equity, liab, rev, netProfit,
        components: [
          {label:"رأس المال العامل / الأصول (×1.2)",   value:x1, weight:1.2},
          {label:"الأرباح المحتجزة / الأصول (×1.4)",  value:x2, weight:1.4},
          {label:"EBIT / الأصول (×3.3)",               value:x3, weight:3.3},
          {label:"حقوق الملكية / الديون (×0.6)",       value:x4, weight:0.6},
          {label:"المبيعات / الأصول (×1.0)",            value:x5, weight:1.0},
        ]
      };
    }),

  // ── Smart Alerts ──────────────────────────────────────────────────────────
  smartAlerts: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number() }))
    .query(async ({ input }) => {
      const dT = `${input.year}-12-31`, dF = `${input.year}-01-01`;
      const prevDT = `${input.year-1}-12-31`, prevDF = `${input.year-1}-01-01`;
      const alerts: any[] = [];

      const getMetrics = async (from:string, to:string) => {
        const rows = await db.run(sql`SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c FROM journal_entry_lines jl LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id WHERE jl.company_id=${input.companyId} AND jl.date>=${from} AND jl.date<=${to} AND (je.name IS NULL OR je.name!='رصيد افتتاحي') GROUP BY jl.account_type`);
        let r=0,co=0,e=0;
        for (const row of (rows as any).rows||[]) {
          const d=Number(row.d)||0,c=Number(row.c)||0;
          if (row.account_type==="revenue") r+=c-d;
          else if (row.account_type==="cogs") co+=d-c;
          else if (row.account_type==="expenses") e+=d-c;
        }
        return { rev:r, cogs:co, exp:e, profit:r-co-e };
      };

      const cur  = await getMetrics(dF, dT);
      const prev = await getMetrics(prevDF, prevDT);

      // تغيير الإيرادات
      if (prev.rev > 0) {
        const revChg = ((cur.rev - prev.rev)/prev.rev)*100;
        if (revChg < -10) alerts.push({ level:"danger", icon:"📉", title:"انخفاض الإيرادات", msg:`انخفضت الإيرادات بنسبة ${Math.abs(revChg).toFixed(1)}% مقارنة بالعام السابق`, value:revChg.toFixed(1)+"%" });
        else if (revChg > 20) alerts.push({ level:"success", icon:"📈", title:"نمو قوي في الإيرادات", msg:`نمت الإيرادات بنسبة ${revChg.toFixed(1)}% مقارنة بالعام السابق`, value:revChg.toFixed(1)+"%" });
      }

      // الربحية
      if (cur.rev > 0) {
        const margin = (cur.profit/cur.rev)*100;
        if (cur.profit < 0) alerts.push({ level:"danger", icon:"❌", title:"شركة خاسرة", msg:`صافي خسارة ${Math.abs(cur.profit).toLocaleString('ar')} — يتطلب مراجعة عاجلة`, value: margin.toFixed(1)+"%" });
        else if (margin < 5) alerts.push({ level:"warning", icon:"⚠️", title:"هامش ربح منخفض", msg:`هامش الربح ${margin.toFixed(1)}% أقل من المعيار (10%)`, value: margin.toFixed(1)+"%" });
        else if (margin > 30) alerts.push({ level:"success", icon:"🏆", title:"هامش ربح ممتاز", msg:`هامش الربح ${margin.toFixed(1)}% يتجاوز المعيار`, value: margin.toFixed(1)+"%" });
      }

      // نسبة المصروفات
      if (cur.rev > 0) {
        const expRatio = ((cur.exp)/cur.rev)*100;
        if (expRatio > 60) alerts.push({ level:"warning", icon:"💸", title:"مصروفات مرتفعة", msg:`المصروفات ${expRatio.toFixed(1)}% من الإيرادات — تجاوزت 60%`, value: expRatio.toFixed(1)+"%" });
      }

      // مقارنة مع العام السابق - المصروفات
      if (prev.exp > 0) {
        const expChg = ((cur.exp - prev.exp)/prev.exp)*100;
        if (expChg > 25) alerts.push({ level:"warning", icon:"📊", title:"ارتفاع المصروفات", msg:`ارتفعت المصروفات بنسبة ${expChg.toFixed(1)}% مقارنة بالعام السابق`, value: expChg.toFixed(1)+"%" });
      }

      if (!alerts.length) alerts.push({ level:"success", icon:"✅", title:"الأداء المالي جيد", msg:"لا توجد تنبيهات بالغة — استمر في المراقبة الدورية", value:"OK" });

      return { alerts, year:input.year, currentMetrics:cur, prevMetrics:prev };
    }),

  // ── تحليل الشركة شهرياً بالتفصيل
  monthlyDetail: protectedProcedure
    .input(z.object({ companyId:z.number(), year:z.number(), month:z.number() }))
    .query(async ({ input }) => {
      const dF = `${input.year}-${String(input.month).padStart(2,"0")}-01`;
      const dT = `${input.year}-${String(input.month).padStart(2,"0")}-31`;

      // الإيرادات تفصيلياً
      const rev = await db.run(sql`
        SELECT jl.account_code, jl.account_name, jl.partner_name,
               SUM(jl.credit-jl.debit) as amount
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
        WHERE jl.company_id=${input.companyId} AND jl.account_type='revenue'
          AND jl.date>=${dF} AND jl.date<=${dT}
          AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
        GROUP BY jl.account_code, jl.partner_name
        ORDER BY amount DESC LIMIT 20`);

      // المصروفات تفصيلياً
      const exp = await db.run(sql`
        SELECT jl.account_code, jl.account_name, jl.partner_name,
               SUM(jl.debit-jl.credit) as amount
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
        WHERE jl.company_id=${input.companyId}
          AND jl.account_type IN ('expenses','cogs','other_expenses')
          AND jl.date>=${dF} AND jl.date<=${dT}
          AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
        GROUP BY jl.account_code, jl.partner_name
        ORDER BY amount DESC LIMIT 20`);

      // إجماليات
      const totals = await db.run(sql`
        SELECT jl.account_type,
               SUM(jl.debit) d, SUM(jl.credit) c
        FROM journal_entry_lines jl
        LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
        WHERE jl.company_id=${input.companyId}
          AND jl.date>=${dF} AND jl.date<=${dT}
          AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
        GROUP BY jl.account_type`);

      let revenue=0, cogs=0, expenses=0, otherIncome=0;
      for (const r of (totals as any).rows||[]) {
        const d=Number(r.d)||0, c=Number(r.c)||0;
        if (r.account_type==="revenue")      revenue    += c-d;
        else if (r.account_type==="cogs")    cogs       += d-c;
        else if (r.account_type==="expenses")expenses   += d-c;
        else if (r.account_type==="other_income") otherIncome += c-d;
      }

      return {
        revenue, cogs, expenses, otherIncome,
        grossProfit: revenue-cogs,
        netProfit: revenue-cogs-expenses+otherIncome,
        revenueDetail:  (rev as any).rows||[],
        expenseDetail:  (exp as any).rows||[],
      };
    }),

  // مقارنة شركات متعددة - شهرياً
  multiCompanyMonthly: protectedProcedure
    .input(z.object({ companyIds:z.array(z.number()), year:z.number() }))
    .query(async ({ input }) => {
      const results: Record<number, any[]> = {};
      for (const cid of input.companyIds) {
        const rows = await db.run(sql`
          SELECT substr(jl.date,6,2) m, jl.account_type,
                 SUM(jl.debit) d, SUM(jl.credit) c
          FROM journal_entry_lines jl
          LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
          WHERE jl.company_id=${cid}
            AND jl.date>=${input.year+'-01-01'}
            AND jl.date<=${input.year+'-12-31'}
            AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
          GROUP BY m, jl.account_type ORDER BY m`);

        const months = Array.from({length:12},(_,i)=>({month:i+1,revenue:0,expenses:0,profit:0,cogs:0}));
        for (const r of (rows as any).rows||[]) {
          const mi=parseInt(String(r.m||"0"))-1;
          if(mi<0||mi>11) continue;
          const d=Number(r.d)||0, c=Number(r.c)||0;
          if(r.account_type==="revenue") months[mi].revenue+=c-d;
          else if(r.account_type==="cogs") months[mi].cogs+=d-c;
          else if(r.account_type==="expenses") months[mi].expenses+=d-c;
        }
        months.forEach(m=>m.profit=m.revenue-m.cogs-m.expenses);
        results[cid] = months;
      }
      return results;
    }),

  // ملخص مقارنة شركات - سنوي
  multiCompanySummary: protectedProcedure
    .input(z.object({ companyIds:z.array(z.number()), year:z.number() }))
    .query(async ({ input }) => {
      const results = [];
      for (const cid of input.companyIds) {
        const co = await db.select().from(schema.companies).where(eq(schema.companies.id, cid)).limit(1);
        const rows = await db.run(sql`
          SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c
          FROM journal_entry_lines jl
          LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
          WHERE jl.company_id=${cid}
            AND jl.date>=${input.year+'-01-01'}
            AND jl.date<=${input.year+'-12-31'}
            AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
          GROUP BY jl.account_type`);

        let revenue=0,cogs=0,expenses=0,otherIncome=0;
        const bsRows = await db.run(sql`
          SELECT jl.account_type, SUM(jl.debit) d, SUM(jl.credit) c
          FROM journal_entry_lines jl
          WHERE jl.company_id=${cid} AND jl.date<=${input.year+'-12-31'}
          GROUP BY jl.account_type`);
        let assets=0,liab=0,equity=0;

        for (const r of (rows as any).rows||[]) {
          const d=Number(r.d)||0, c=Number(r.c)||0;
          if(r.account_type==="revenue") revenue+=c-d;
          else if(r.account_type==="cogs") cogs+=d-c;
          else if(r.account_type==="expenses") expenses+=d-c;
          else if(r.account_type==="other_income") otherIncome+=c-d;
        }
        for (const r of (bsRows as any).rows||[]) {
          const d=Number(r.d)||0, c=Number(r.c)||0;
          if(r.account_type==="assets") assets+=d-c;
          else if(r.account_type==="liabilities") liab+=c-d;
          else if(r.account_type==="equity") equity+=c-d;
        }
        const netProfit=revenue-cogs-expenses+otherIncome;
        results.push({
          companyId:cid, companyName:co[0]?.name||"شركة "+cid,
          revenue, cogs, expenses, netProfit,
          grossProfit:revenue-cogs, grossMargin:revenue>0?(revenue-cogs)/revenue*100:0,
          netMargin:revenue>0?netProfit/revenue*100:0,
          assets, liabilities:liab, equity:equity+netProfit,
          roa:assets>0?netProfit/assets*100:0,
          roe:(equity+netProfit)>0?netProfit/(equity+netProfit)*100:0,
        });
      }
      return results;
    }),

  // ── تحليل المراكز التحليلية ──────────────────────────────────────────────

  // قائمة المراكز التحليلية مع ملخص مالي
  analyticCenters: protectedProcedure
    .input(z.object({ companyId:z.number(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const { companyId:cid, dateFrom:dF, dateTo:dT } = input;

      // بناء lookup شامل للحسابات التحليلية من جميع الشركات المرتبطة
      const allAnalytic = await db.run(sql`SELECT odoo_analytic_id, name, code FROM analytic_accounts`).catch(()=>({rows:[]}));
      const analyticLookup: Record<number,{name:string,code:string}> = {};
      for (const r of (allAnalytic as any).rows||[]) {
        analyticLookup[Number(r.odoo_analytic_id)] = { name:r.name||"", code:r.code||"" };
      }

      // تأكد من وجود الجداول
      await db.run(sql`CREATE TABLE IF NOT EXISTS analytic_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
        odoo_analytic_id INTEGER NOT NULL, name TEXT NOT NULL, code TEXT,
        UNIQUE(company_id, odoo_analytic_id))`).catch(()=>{});
      await db.run(sql`CREATE TABLE IF NOT EXISTS analytic_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
        journal_entry_line_id INTEGER, journal_entry_id INTEGER,
        odoo_analytic_id INTEGER NOT NULL, analytic_name TEXT NOT NULL,
        account_code TEXT, account_name TEXT, account_type TEXT,
        partner_name TEXT, label TEXT, date TEXT, percentage REAL DEFAULT 100,
        debit REAL DEFAULT 0, credit REAL DEFAULT 0, amount REAL DEFAULT 0)`).catch(()=>{});

      // هل توجد بيانات تحليلية؟
      const alCnt = await db.run(sql`SELECT count(*) n FROM analytic_lines WHERE company_id=${cid}`).catch(()=>({rows:[{n:0}]}));
      const hasAnalytic = Number((alCnt as any).rows?.[0]?.n||0) > 0;

      if (!hasAnalytic) {
        // بديل: بناء التحليل من journal_entry_lines مباشرة عبر account_code prefix
        const rows = await db.run(sql`
          SELECT
            CASE
              WHEN jl.account_code LIKE '6%' THEN 'مصروفات تشغيلية'
              WHEN jl.account_code LIKE '5%' THEN 'تكلفة مبيعات'
              WHEN jl.account_code LIKE '4%' THEN 'إيرادات'
              WHEN jl.account_code LIKE '7%' THEN 'إيرادات أخرى'
              WHEN jl.account_code LIKE '8%' THEN 'مصروفات أخرى'
              ELSE 'أخرى'
            END as center_name,
            jl.account_type,
            SUM(jl.debit) d, SUM(jl.credit) c, count(*) n
          FROM journal_entry_lines jl
          LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
          WHERE jl.company_id=${cid} AND jl.date>=${dF} AND jl.date<=${dT}
            AND jl.account_type IN ('revenue','cogs','expenses','other_income','other_expenses')
            AND (je.name IS NULL OR je.name!='رصيد افتتاحي')
          GROUP BY center_name, jl.account_type
          ORDER BY SUM(jl.debit+jl.credit) DESC`);

        // تجميع حسب المركز
        const centers: Record<string,any> = {};
        for (const r of (rows as any).rows||[]) {
          const k = String(r.center_name);
          if (!centers[k]) centers[k] = { name:analyticLookup[Number(k)]?.name||k, code:analyticLookup[Number(k)]?.code||"", revenue:0, cogs:0, expenses:0, otherIncome:0, lines:0 };
          const d=Number(r.d)||0, c=Number(r.c)||0;
          centers[k].lines += Number(r.n)||0;
          if (r.account_type==="revenue")       centers[k].revenue     += c-d;
          else if (r.account_type==="cogs")     centers[k].cogs        += d-c;
          else if (r.account_type==="expenses") centers[k].expenses    += d-c;
          else if (r.account_type==="other_income")   centers[k].revenue  += c-d;
          else if (r.account_type==="other_expenses") centers[k].expenses += d-c;
        }
        const result = Object.values(centers).map((c:any) => ({
          ...c,
          grossProfit: c.revenue - c.cogs,
          netProfit:   c.revenue - c.cogs - c.expenses,
          totalCost:   c.cogs + c.expenses,
          margin:      c.revenue>0 ? (c.revenue-c.cogs-c.expenses)/c.revenue*100 : 0,
        })).sort((a:any,b:any)=>b.totalCost-a.totalCost);
        return { source:"account_prefix", centers:result };
      }

      // مصدر حقيقي: analytic_lines
      const rows = await db.run(sql`
        SELECT
          odoo_analytic_id, analytic_name,
          account_type,
          SUM(debit) d, SUM(credit) c, count(*) n
        FROM analytic_lines
        WHERE company_id=${cid} AND date>=${dF} AND date<=${dT}
        GROUP BY odoo_analytic_id, account_type
        ORDER BY odoo_analytic_id`);

      const centers: Record<string,any> = {};
      for (const r of (rows as any).rows||[]) {
        const k = String(r.odoo_analytic_id);
        // الاسم: من analytic_accounts أولاً، ثم من السطر مباشرة
        const realName = analyticLookup[Number(r.odoo_analytic_id)]?.name || String(r.analytic_name||"");
        const realCode = analyticLookup[Number(r.odoo_analytic_id)]?.code || "";
        if (!centers[k]) centers[k] = {
          id:r.odoo_analytic_id,
          name: realName || `مركز #${r.odoo_analytic_id}`,
          code: realCode,
          revenue:0, cogs:0, expenses:0, otherIncome:0, lines:0
        };
        const d=Number(r.d)||0, c=Number(r.c)||0;
        centers[k].lines += Number(r.n)||0;
        if (r.account_type==="revenue")       centers[k].revenue     += c-d;
        else if (r.account_type==="cogs")     centers[k].cogs        += d-c;
        else if (r.account_type==="expenses") centers[k].expenses    += d-c;
        else if (r.account_type==="other_income")   centers[k].revenue  += c-d;
        else if (r.account_type==="other_expenses") centers[k].expenses += d-c;
      }
      const result = Object.values(centers).map((c:any) => ({
        ...c,
        grossProfit: c.revenue - c.cogs,
        netProfit:   c.revenue - c.cogs - c.expenses,
        totalCost:   c.cogs + c.expenses,
        margin:      c.revenue>0?(c.revenue-c.cogs-c.expenses)/c.revenue*100:0,
      })).sort((a:any,b:any)=>b.totalCost-a.totalCost);
      return { source:"analytic_distribution", centers:result };
    }),

  // تفاصيل مركز تحليلي واحد
  analyticCenterDetail: protectedProcedure
    .input(z.object({ companyId:z.number(), centerId:z.string(), dateFrom:z.string(), dateTo:z.string() }))
    .query(async ({ input }) => {
      const { companyId:cid, centerId, dateFrom:dF, dateTo:dT } = input;
      const rows = await db.run(sql`
        SELECT account_code, account_name, account_type, partner_name,
               SUM(debit) d, SUM(credit) c, count(*) n
        FROM analytic_lines
        WHERE company_id=${cid} AND odoo_analytic_id=${centerId}
          AND date>=${dF} AND date<=${dT}
        GROUP BY account_code, partner_name
        ORDER BY SUM(debit+credit) DESC LIMIT 50`).catch(()=>({rows:[]}));
      return (rows as any).rows||[];
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

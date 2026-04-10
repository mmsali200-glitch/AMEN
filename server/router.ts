import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import { db, schema } from "./db.js";
import { eq, and, desc, like, sql, gte, lte } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, getUserFromToken } from "./auth.js";

// Context
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
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "cfo_admin") throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح لك بهذه العملية" });
  return next({ ctx });
});

// ── Auth Router ────────────────────────────────────────────────────────────────
const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (!user || !user.isActive) throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      const valid = await comparePassword(input.password, user.password);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      // Update last login
      await db.update(schema.users).set({ lastLogin: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(schema.users.id, user.id));
      const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
      return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const access = await db.select({ companyId: schema.userCompanyAccess.companyId, role: schema.userCompanyAccess.role })
      .from(schema.userCompanyAccess).where(and(eq(schema.userCompanyAccess.userId, user.id), eq(schema.userCompanyAccess.status, "active")));
    return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLogin: user.lastLogin, companyAccess: access };
  }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
      const valid = await comparePassword(input.currentPassword, user!.password);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور الحالية غير صحيحة" });
      const hashed = await hashPassword(input.newPassword);
      await db.update(schema.users).set({ password: hashed, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, ctx.user.id));
      return { success: true };
    }),
});

// ── Company Router ─────────────────────────────────────────────────────────────
const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "cfo_admin") {
      return db.select().from(schema.companies).orderBy(desc(schema.companies.id));
    }
    const access = await db.select({ companyId: schema.userCompanyAccess.companyId })
      .from(schema.userCompanyAccess)
      .where(and(eq(schema.userCompanyAccess.userId, ctx.user.id), eq(schema.userCompanyAccess.status, "active")));
    if (!access.length) return [];
    const ids = access.map(a => a.companyId);
    return db.select().from(schema.companies).where(sql`id IN (${ids.join(",")})`);
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(2), industry: z.string().optional(), currency: z.string().default("KWD"), contactEmail: z.string().email().optional(), contactPhone: z.string().optional(), address: z.string().optional(), taxNumber: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [co] = await db.insert(schema.companies).values({ ...input, createdBy: ctx.user.id }).returning();
      // Give creator access
      await db.insert(schema.userCompanyAccess).values({ userId: ctx.user.id, companyId: co.id, role: "cfo_admin", assignedBy: ctx.user.id });
      await db.insert(schema.auditLogs).values({ userId: ctx.user.id, companyId: co.id, action: "create_company", target: co.name });
      return co;
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(2).optional(), industry: z.string().optional(), currency: z.string().optional(), contactEmail: z.string().optional(), contactPhone: z.string().optional(), address: z.string().optional() }))
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

// ── Users Router ───────────────────────────────────────────────────────────────
const usersRouter = router({
  list: adminProcedure.query(async () => {
    const users = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, isActive: schema.users.isActive, createdAt: schema.users.createdAt, lastLogin: schema.users.lastLogin }).from(schema.users).orderBy(desc(schema.users.id));
    const access = await db.select().from(schema.userCompanyAccess);
    return users.map(u => ({ ...u, companyAccess: access.filter(a => a.userId === u.id) }));
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (existing.length) throw new TRPCError({ code: "BAD_REQUEST", message: "البريد الإلكتروني مستخدم بالفعل" });
      const hashed = await hashPassword(input.password);
      const [user] = await db.insert(schema.users).values({ ...input, password: hashed }).returning();
      await db.insert(schema.auditLogs).values({ userId: ctx.user.id, action: "create_user", target: user.email });
      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), role: z.enum(["cfo_admin","manager","accountant","auditor","partner","custom"]).optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(schema.users).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك حذف حسابك الخاص" });
      await db.delete(schema.users).where(eq(schema.users.id, input.id));
      return { success: true };
    }),

  grantAccess: adminProcedure
    .input(z.object({ userId: z.number(), companyId: z.number(), role: z.string().default("accountant") }))
    .mutation(async ({ input, ctx }) => {
      await db.insert(schema.userCompanyAccess).values({ ...input, assignedBy: ctx.user.id }).onConflictDoUpdate({ target: [schema.userCompanyAccess.userId, schema.userCompanyAccess.companyId], set: { role: input.role, status: "active" } });
      return { success: true };
    }),

  revokeAccess: adminProcedure
    .input(z.object({ userId: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      await db.update(schema.userCompanyAccess).set({ status: "revoked" }).where(and(eq(schema.userCompanyAccess.userId, input.userId), eq(schema.userCompanyAccess.companyId, input.companyId)));
      return { success: true };
    }),
});

// ── Journal Router ─────────────────────────────────────────────────────────────
const journalRouter = router({
  listEntries: protectedProcedure
    .input(z.object({ companyId: z.number(), page: z.number().default(1), limit: z.number().default(20), search: z.string().optional(), journalType: z.string().optional(), state: z.string().optional() }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;
      let query = db.select().from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      const entries = await db.select().from(schema.journalEntries)
        .where(eq(schema.journalEntries.companyId, input.companyId))
        .orderBy(desc(schema.journalEntries.date))
        .limit(input.limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      return { entries, total: count, page: input.page, pages: Math.ceil(count / input.limit) };
    }),

  syncStatus: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const [lastSync] = await db.select().from(schema.syncLogs)
        .where(eq(schema.syncLogs.companyId, input.companyId))
        .orderBy(desc(schema.syncLogs.startedAt)).limit(1);
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(schema.journalEntries).where(eq(schema.journalEntries.companyId, input.companyId));
      const [{ lines }] = await db.select({ lines: sql<number>`count(*)` }).from(schema.journalEntryLines).where(eq(schema.journalEntryLines.companyId, input.companyId));
      return { lastSync, totalEntries: total, totalLines: lines };
    }),

  trialBalance: protectedProcedure
    .input(z.object({ companyId: z.number(), dateFrom: z.string(), dateTo: z.string() }))
    .query(async ({ input }) => {
      // Opening balances (before dateFrom)
      const opening = await db.select({
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        openingDebit: sql<number>`sum(debit)`,
        openingCredit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), eq(schema.journalEntries.state, "posted"), sql`${schema.journalEntryLines.date} < ${input.dateFrom}`))
        .groupBy(schema.journalEntryLines.accountCode, schema.journalEntryLines.accountName);

      // Period movement
      const movement = await db.select({
        accountCode: schema.journalEntryLines.accountCode,
        accountName: schema.journalEntryLines.accountName,
        mvtDebit: sql<number>`sum(debit)`,
        mvtCredit: sql<number>`sum(credit)`,
      }).from(schema.journalEntryLines)
        .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
        .where(and(eq(schema.journalEntryLines.companyId, input.companyId), eq(schema.journalEntries.state, "posted"), sql`${schema.journalEntryLines.date} >= ${input.dateFrom}`, sql`${schema.journalEntryLines.date} <= ${input.dateTo}`))
        .groupBy(schema.journalEntryLines.accountCode, schema.journalEntryLines.accountName);

      // Merge
      const map: Record<string, any> = {};
      for (const o of opening) {
        map[o.accountCode] = { accountCode: o.accountCode, accountName: o.accountName, openingDebit: o.openingDebit || 0, openingCredit: o.openingCredit || 0, mvtDebit: 0, mvtCredit: 0 };
      }
      for (const m of movement) {
        if (!map[m.accountCode]) map[m.accountCode] = { accountCode: m.accountCode, accountName: m.accountName, openingDebit: 0, openingCredit: 0 };
        map[m.accountCode].mvtDebit = m.mvtDebit || 0;
        map[m.accountCode].mvtCredit = m.mvtCredit || 0;
      }
      return Object.values(map).map((r: any) => ({
        ...r,
        closingDebit: Math.max(0, (r.openingDebit - r.openingCredit) + (r.mvtDebit - r.mvtCredit)),
        closingCredit: Math.max(0, (r.openingCredit - r.openingDebit) + (r.mvtCredit - r.mvtDebit)),
      })).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    }),
});

// ── Audit Router ───────────────────────────────────────────────────────────────
const auditRouter = router({
  getLogs: adminProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      return db.select({
        id: schema.auditLogs.id, action: schema.auditLogs.action, target: schema.auditLogs.target,
        details: schema.auditLogs.details, createdAt: schema.auditLogs.createdAt,
        userName: schema.users.name, userEmail: schema.users.email,
      }).from(schema.auditLogs)
        .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
        .orderBy(desc(schema.auditLogs.createdAt)).limit(input.limit);
    }),
});

// ── App Router ─────────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: authRouter,
  company: companyRouter,
  users: usersRouter,
  journal: journalRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;

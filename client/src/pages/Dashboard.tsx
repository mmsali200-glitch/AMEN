import { useState } from "react";
import { trpc } from "../lib/trpc";

const T = { bg:"#F0F4FA",surface:"#FFFFFF",surface2:"#F7F9FC",border:"#E2E8F0",primary:"#2563EB",primaryLight:"#DBEAFE",teal:"#0D9488",green:"#059669",red:"#DC2626",amber:"#D97706",purple:"#7C3AED",text:"#1E293B",textSec:"#475569",muted:"#94A3B8" };

const NAV = [
  { s:"الرئيسية", items:[{id:"dashboard",label:"لوحة التحكم",icon:"▦"}] },
  { s:"القوائم المالية", items:[{id:"trial-balance",label:"ميزان المراجعة",icon:"⊟"},{id:"income",label:"قائمة الدخل",icon:"▲"},{id:"balance-sheet",label:"الميزانية العمومية",icon:"⊞"}] },
  { s:"الدفاتر المحاسبية", items:[{id:"journal-entries",label:"القيود المحاسبية",icon:"◫"},{id:"general-ledger",label:"دفتر الأستاذ",icon:"◨"}] },
  { s:"التحليل المالي", items:[{id:"ratios",label:"النسب المالية",icon:"◎"},{id:"monthly",label:"التحليل الشهري",icon:"▣"}] },
  { s:"الذكاء الاصطناعي", items:[{id:"advisor",label:"المستشار AI ✦",icon:"✦"},{id:"chatbot",label:"شات بوت مالي",icon:"◈"}] },
  { s:"الإدارة", items:[{id:"users",label:"المستخدمون",icon:"◎"},{id:"companies",label:"الشركات",icon:"⊞"},{id:"audit-log",label:"سجل النشاط",icon:"≡"}] },
];

const roleLabels: Record<string,{l:string,bg:string,c:string}> = {
  cfo_admin:{l:"CFO Admin",bg:"#DBEAFE",c:"#1D4ED8"},
  manager:{l:"مدير",bg:"#D1FAE5",c:"#065F46"},
  accountant:{l:"محاسب",bg:"#FEF3C7",c:"#92400E"},
  auditor:{l:"مدقق",bg:"#EDE9FE",c:"#5B21B6"},
  partner:{l:"شريك",bg:"#FCE7F3",c:"#9D174D"},
  custom:{l:"مخصص",bg:"#F1F5F9",c:"#475569"},
};
const fmt = (n:number) => new Intl.NumberFormat("ar").format(Math.round(n));

// ── Sub-pages ─────────────────────────────────────────────────────────────────

function UsersManagement({ currentUser }: { currentUser: any }) {
  const { data: users, refetch } = trpc.users.list.useQuery();
  const { data: companies } = trpc.company.list.useQuery();
  const createUser = trpc.users.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); } });
  const updateUser = trpc.users.update.useMutation({ onSuccess: () => refetch() });
  const deleteUser = trpc.users.delete.useMutation({ onSuccess: () => refetch() });
  const grantAccess = trpc.users.grantAccess.useMutation({ onSuccess: () => refetch() });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "accountant" as any });
  const [error, setError] = useState("");
  const [showGrant, setShowGrant] = useState<number | null>(null);
  const [grantForm, setGrantForm] = useState({ companyId: 0, role: "accountant" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    createUser.mutate(form, { onError: err => setError(err.message) });
  };

  return (
    <div style={{ padding: "0 22px 28px", direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>إدارة المستخدمين</h2><p style={{ color: T.muted, fontSize: 12, margin: "2px 0 0" }}>{users?.length || 0} مستخدم مسجل</p></div>
        {currentUser.role === "cfo_admin" && <button onClick={() => setShowForm(!showForm)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ إضافة مستخدم</button>}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: T.surface, borderRadius: 10, padding: "18px 20px", border: `1px solid ${T.border}`, marginBottom: 14 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: T.text, margin: "0 0 12px" }}>مستخدم جديد</p>
          {error && <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 7, padding: "8px 12px", color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[["الاسم الكامل","name","text",form.name],["البريد الإلكتروني","email","email",form.email],["كلمة المرور (8+ أحرف)","password","password",form.password]].map(([l,k,type,val])=>(
              <div key={k as string}><label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>{l as string}</label><input type={type as string} value={val as string} onChange={e=>setForm(f=>({...f,[k as string]:e.target.value}))} required style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} /></div>
            ))}
            <div><label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>الدور</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as any}))} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12 }}>
                {Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={createUser.isPending} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: T.primary, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{createUser.isPending ? "جاري الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: 12 }}>إلغاء</button>
          </div>
        </form>
      )}

      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: T.bg }}>{["المستخدم","الدور","البريد الإلكتروني","الحالة","آخر دخول","الإجراءات"].map(h=><th key={h} style={{ padding: "10px 12px", textAlign: "right", color: T.textSec, fontWeight: 600, borderBottom: `1px solid ${T.border}`, fontSize: 11 }}>{h}</th>)}</tr></thead>
          <tbody>
            {users?.map((u, i) => {
              const rc = roleLabels[u.role] || roleLabels.custom;
              return (
                <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}`, background: i%2===0 ? T.surface : T.surface2 }}>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: T.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", color: T.primary, fontWeight: 700, fontSize: 13 }}>{u.name.charAt(0)}</div>
                      <span style={{ fontWeight: 600, color: T.text }}>{u.name}</span>
                      {u.id === currentUser.id && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: T.primaryLight, color: T.primary }}>أنت</span>}
                    </div>
                  </td>
                  <td style={{ padding: "11px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 18, background: rc.bg, color: rc.c, fontSize: 10, fontWeight: 600 }}>{rc.l}</span></td>
                  <td style={{ padding: "11px 12px", color: T.textSec, direction: "ltr" }}>{u.email}</td>
                  <td style={{ padding: "11px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 18, background: u.isActive ? "#D1FAE5" : "#FEE2E2", color: u.isActive ? "#065F46" : "#991B1B", fontSize: 10, fontWeight: 600 }}>{u.isActive ? "نشط" : "غير نشط"}</span></td>
                  <td style={{ padding: "11px 12px", color: T.muted, fontSize: 11 }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("ar") : "—"}</td>
                  <td style={{ padding: "11px 12px" }}>
                    {currentUser.role === "cfo_admin" && u.id !== currentUser.id && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => updateUser.mutate({ id: u.id, isActive: !u.isActive })} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: 10 }}>
                          {u.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                        <button onClick={() => { if (confirm(`حذف ${u.name}؟`)) deleteUser.mutate({ id: u.id }); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#FFF5F5", color: T.red, cursor: "pointer", fontSize: 10 }}>حذف</button>
                        <button onClick={() => setShowGrant(showGrant === u.id ? null : u.id)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${T.teal}40`, background: `${T.teal}10`, color: T.teal, cursor: "pointer", fontSize: 10 }}>صلاحيات</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grant access modal */}
      {showGrant !== null && (
        <div style={{ background: T.surface, borderRadius: 10, padding: "16px 18px", border: `1px solid ${T.teal}`, marginTop: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: T.teal, margin: "0 0 10px" }}>منح صلاحية وصول للشركة</p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>الشركة</label>
              <select value={grantForm.companyId} onChange={e=>setGrantForm(f=>({...f,companyId:parseInt(e.target.value)}))} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12 }}>
                <option value={0}>اختر شركة...</option>
                {companies?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>الدور</label>
              <select value={grantForm.role} onChange={e=>setGrantForm(f=>({...f,role:e.target.value}))} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12 }}>
                {Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
            <button disabled={!grantForm.companyId} onClick={() => { grantAccess.mutate({ userId: showGrant!, companyId: grantForm.companyId, role: grantForm.role }); setShowGrant(null); }} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: T.teal, color: "#fff", cursor: grantForm.companyId ? "pointer" : "default", fontSize: 12, fontWeight: 600, opacity: grantForm.companyId ? 1 : 0.5 }}>منح</button>
            <button onClick={() => setShowGrant(null)} style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: 12 }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompaniesPage({ currentUser }: { currentUser: any }) {
  const { data: companies, refetch } = trpc.company.list.useQuery();
  const createCo = trpc.company.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); } });
  const deleteCo = trpc.company.delete.useMutation({ onSuccess: () => refetch() });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", currency: "KWD", contactEmail: "" });
  const [error, setError] = useState("");

  return (
    <div style={{ padding: "0 22px 28px", direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>إدارة الشركات</h2><p style={{ color: T.muted, fontSize: 12, margin: "2px 0 0" }}>{companies?.length || 0} شركة مسجلة</p></div>
        {currentUser.role === "cfo_admin" && <button onClick={() => setShowForm(!showForm)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ شركة جديدة</button>}
      </div>

      {showForm && (
        <form onSubmit={e=>{e.preventDefault();setError("");createCo.mutate(form as any,{onError:err=>setError(err.message)});}} style={{ background: T.surface, borderRadius: 10, padding: "18px 20px", border: `1px solid ${T.border}`, marginBottom: 14 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: T.text, margin: "0 0 12px" }}>بيانات الشركة الجديدة</p>
          {error && <div style={{ background: "#FEE2E2", borderRadius: 7, padding: "8px 12px", color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[["اسم الشركة","name","text",form.name],["القطاع","industry","text",form.industry],["البريد الإلكتروني","contactEmail","email",form.contactEmail]].map(([l,k,type,val])=>(
              <div key={k as string}><label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>{l as string}</label><input type={type as string} value={val as string} onChange={e=>setForm((f:any)=>({...f,[k as string]:e.target.value}))} required={k==="name"} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}/></div>
            ))}
            <div><label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>العملة</label>
              <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12 }}>
                {["KWD","SAR","AED","USD","EUR","GBP"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={createCo.isPending} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: T.primary, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{createCo.isPending ? "جاري الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: 12 }}>إلغاء</button>
          </div>
        </form>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {companies?.map((co, i) => (
          <div key={co.id} style={{ background: T.surface, borderRadius: 12, padding: "18px 20px", border: `1px solid ${T.border}`, borderTop: `3px solid ${[T.primary,T.teal,T.purple,T.amber][i%4]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${[T.primary,T.teal,T.purple,T.amber][i%4]}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
              <span style={{ padding: "2px 8px", borderRadius: 18, background: T.primaryLight, color: T.primary, fontSize: 10, fontWeight: 600 }}>{co.currency}</span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>{co.name}</h3>
            <p style={{ color: T.muted, fontSize: 12, margin: "0 0 12px" }}>{co.industry || "—"}</p>
            <div style={{ fontSize: 11, color: T.textSec, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <p style={{ margin: "0 0 3px" }}>📅 {new Date(co.createdAt).toLocaleDateString("ar")}</p>
              {co.contactEmail && <p style={{ margin: 0, direction: "ltr", textAlign: "right" }}>✉ {co.contactEmail}</p>}
            </div>
            {currentUser.role === "cfo_admin" && (
              <button onClick={() => { if (confirm(`حذف شركة "${co.name}"؟ سيتم حذف جميع البيانات.`)) deleteCo.mutate({ id: co.id }); }}
                style={{ marginTop: 10, padding: "5px 12px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FFF5F5", color: T.red, cursor: "pointer", fontSize: 10, width: "100%" }}>
                حذف الشركة
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogPage() {
  const { data: logs } = trpc.audit.getLogs.useQuery({ limit: 100 });
  const actionColors: Record<string,string> = { create_company: T.teal, create_user: T.primary, delete_company: T.red, delete_user: T.red };
  return (
    <div style={{ padding: "0 22px 28px", direction: "rtl" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 14px" }}>سجل النشاط</h2>
      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: T.bg }}>{["الوقت","المستخدم","الإجراء","التفاصيل"].map(h=><th key={h} style={{ padding: "10px 12px", textAlign: "right", color: T.textSec, fontWeight: 600, borderBottom: `1px solid ${T.border}`, fontSize: 11 }}>{h}</th>)}</tr></thead>
          <tbody>
            {logs?.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}`, background: i%2===0 ? T.surface : T.surface2 }}>
                <td style={{ padding: "9px 12px", color: T.muted, fontSize: 11 }}>{new Date(l.createdAt).toLocaleString("ar")}</td>
                <td style={{ padding: "9px 12px", color: T.text, fontWeight: 500 }}>{l.userName || "النظام"}</td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 18, background: `${actionColors[l.action] || T.muted}20`, color: actionColors[l.action] || T.muted, fontSize: 10, fontWeight: 600 }}>{l.action}</span>
                </td>
                <td style={{ padding: "9px 12px", color: T.textSec }}>{l.target || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JournalEntriesPage({ companyId }: { companyId: number }) {
  const [page, setPage] = useState(1);
  const { data } = trpc.journal.listEntries.useQuery({ companyId, page, limit: 20 }, { enabled: !!companyId });
  if (!companyId) return <div style={{ padding: 40, textAlign: "center", color: T.muted }}>اختر شركة أولاً</div>;
  return (
    <div style={{ padding: "0 22px 28px", direction: "rtl" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 14px" }}>القيود المحاسبية</h2>
      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: T.bg }}>{["رقم القيد","التاريخ","الدفتر","الشريك","مدين","دائن","الحالة"].map(h=><th key={h} style={{ padding: "10px 12px", textAlign: "right", color: T.textSec, fontWeight: 600, borderBottom: `1px solid ${T.border}`, fontSize: 11 }}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.entries.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}`, background: i%2===0 ? T.surface : T.surface2 }}>
                <td style={{ padding: "9px 12px", color: T.primary, fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{e.name}</td>
                <td style={{ padding: "9px 12px", color: T.textSec }}>{e.date}</td>
                <td style={{ padding: "9px 12px" }}><span style={{ padding: "2px 7px", borderRadius: 18, background: T.primaryLight, color: T.primary, fontSize: 10 }}>{e.journalName || "—"}</span></td>
                <td style={{ padding: "9px 12px", color: T.text }}>{e.partnerName || "—"}</td>
                <td style={{ padding: "9px 12px", color: T.teal, fontWeight: 600 }}>{fmt(e.totalDebit)}</td>
                <td style={{ padding: "9px 12px", color: T.red, fontWeight: 600 }}>{fmt(e.totalCredit)}</td>
                <td style={{ padding: "9px 12px" }}><span style={{ padding: "2px 7px", borderRadius: 18, background: "#D1FAE5", color: "#065F46", fontSize: 10 }}>{e.state}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.muted }}>الصفحة {data.page} من {data.pages} ({data.total} قيد)</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: 11 }}>←</button>
            <button onClick={() => setPage(p => Math.min(data.pages, p+1))} disabled={page === data.pages} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: 11 }}>→</button>
          </div>
        </div>}
      </div>
    </div>
  );
}

function OverviewDashboard({ companyId, companies }: { companyId: number; companies: any[] }) {
  const co = companies.find(c => c.id === companyId);
  const { data: syncStatus } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled: !!companyId });

  const kpis = [
    { l: "إجمالي القيود", v: syncStatus?.totalEntries?.toString() || "0", icon: "📋", c: T.primary },
    { l: "سطور القيود", v: syncStatus?.totalLines?.toString() || "0", icon: "≡", c: T.teal },
    { l: "الشركة الحالية", v: co?.name?.slice(0, 12) || "—", icon: "🏢", c: T.purple },
    { l: "العملة", v: co?.currency || "KWD", icon: "💰", c: T.amber },
  ];

  return (
    <div style={{ padding: "0 22px 28px", direction: "rtl" }}>
      <div style={{ marginBottom: 16 }}><h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>لوحة التحكم</h2>{co && <p style={{ color: T.muted, fontSize: 13, margin: "2px 0 0" }}>{co.name} — {co.industry}</p>}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
        {kpis.map((k,i) => (
          <div key={i} style={{ background: T.surface, borderRadius: 10, padding: "16px 18px", border: `1px solid ${T.border}`, borderTop: `3px solid ${k.c}`, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 24 }}>{k.icon}</span>
            <div><p style={{ color: T.muted, fontSize: 11, margin: "0 0 4px" }}>{k.l}</p><p style={{ fontSize: 18, fontWeight: 700, color: k.c, margin: 0 }}>{k.v}</p></div>
          </div>
        ))}
      </div>
      {!companyId && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 8 }}><span>⚠</span><p style={{ color: "#92400E", fontSize: 12, margin: 0 }}>اختر شركة من القائمة الجانبية للبدء في تحليل البيانات المالية.</p></div>}
    </div>
  );
}

function ProfilePage({ user, onLogout }: { user: any; onLogout: () => void }) {
  const changePassword = trpc.auth.changePassword.useMutation();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const rc = roleLabels[user.role] || roleLabels.custom;

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setMsg("كلمات المرور غير متطابقة"); return; }
    changePassword.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword }, {
      onSuccess: () => setMsg("✓ تم تغيير كلمة المرور بنجاح"),
      onError: err => setMsg("⚠ " + err.message),
    });
  };

  return (
    <div style={{ padding: "0 22px 28px", direction: "rtl", maxWidth: 480 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>ملف المستخدم</h2>
      <div style={{ background: T.surface, borderRadius: 10, padding: "20px 22px", border: `1px solid ${T.border}`, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: T.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: T.primary }}>{user.name.charAt(0)}</div>
          <div><p style={{ fontWeight: 700, color: T.text, margin: 0, fontSize: 16 }}>{user.name}</p><p style={{ color: T.muted, fontSize: 12, margin: "2px 0 0", direction: "ltr" }}>{user.email}</p></div>
          <span style={{ padding: "3px 10px", borderRadius: 18, background: rc.bg, color: rc.c, fontSize: 11, fontWeight: 600, marginRight: "auto" }}>{rc.l}</span>
        </div>
        <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>وصول إلى {user.companyAccess?.length || 0} شركة</p>
      </div>

      <form onSubmit={handleChange} style={{ background: T.surface, borderRadius: 10, padding: "20px 22px", border: `1px solid ${T.border}`, marginBottom: 14 }}>
        <p style={{ fontWeight: 600, fontSize: 13, color: T.text, margin: "0 0 12px" }}>تغيير كلمة المرور</p>
        {msg && <div style={{ padding: "8px 12px", borderRadius: 7, background: msg.includes("✓") ? "#ECFDF5" : "#FEE2E2", color: msg.includes("✓") ? "#065F46" : T.red, fontSize: 12, marginBottom: 10 }}>{msg}</div>}
        {[["كلمة المرور الحالية","currentPassword",form.currentPassword],["كلمة المرور الجديدة","newPassword",form.newPassword],["تأكيد كلمة المرور","confirm",form.confirm]].map(([l,k,v])=>(
          <div key={k as string} style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>{l as string}</label>
            <input type="password" value={v as string} onChange={e=>setForm(f=>({...f,[k as string]:e.target.value}))} required style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}/>
          </div>
        ))}
        <button type="submit" disabled={changePassword.isPending} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: T.primary, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{changePassword.isPending ? "جاري الحفظ..." : "حفظ"}</button>
      </form>

      <button onClick={onLogout} style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid #FCA5A5", background: "#FFF5F5", color: T.red, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>تسجيل الخروج</button>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(true);
  const [exp, setExp] = useState<Record<string,boolean>>(() => Object.fromEntries(NAV.map(s => [s.s, true])));
  const { data: companies } = trpc.company.list.useQuery();
  const [companyId, setCompanyId] = useState<number>(0);

  const allItems = NAV.flatMap(s => s.items);
  const label = allItems.find(i => i.id === page)?.label || page;
  const rc = roleLabels[user.role] || roleLabels.custom;

  // Set default company
  if (!companyId && companies?.length) setCompanyId(companies[0].id);

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <OverviewDashboard companyId={companyId} companies={companies || []} />;
      case "journal-entries": return <JournalEntriesPage companyId={companyId} />;
      case "users": return user.role === "cfo_admin" ? <UsersManagement currentUser={user} /> : <div style={{ padding: 40, textAlign: "center", color: T.muted }}>غير مصرح</div>;
      case "companies": return user.role === "cfo_admin" ? <CompaniesPage currentUser={user} /> : <div style={{ padding: 40, textAlign: "center", color: T.muted }}>غير مصرح</div>;
      case "audit-log": return user.role === "cfo_admin" ? <AuditLogPage /> : <div style={{ padding: 40, textAlign: "center", color: T.muted }}>غير مصرح</div>;
      case "profile": return <ProfilePage user={user} onLogout={onLogout} />;
      default: return (
        <div style={{ padding: "50px 22px", textAlign: "center", direction: "rtl" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24 }}>🔧</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1E293B", margin: "0 0 5px" }}>{label}</h3>
          <p style={{ color: "#94A3B8", fontSize: 12 }}>هذه الصفحة قيد التطوير — ستكون متاحة قريباً</p>
        </div>
      );
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F0F4FA", fontFamily: "'Cairo','Segoe UI',sans-serif", overflow: "hidden" }}>
      <style>{`*{box-sizing:border-box;} ::-webkit-scrollbar{width:3px;height:3px;} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px;} @keyframes spin{to{transform:rotate(360deg)}} button,input,select{font-family:inherit;}`}</style>

      {/* Sidebar */}
      <aside style={{ width: open ? 248 : 0, background: "#0F172A", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.22s ease" }}>
        <div style={{ minWidth: 248, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Logo */}
          <div style={{ padding: "16px 12px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, direction: "rtl" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>م</div>
              <div><p style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 12, margin: 0 }}>المستشار المالي</p><p style={{ color: "#64748B", fontSize: 9, margin: 0 }}>CFO Intelligence v4</p></div>
            </div>
          </div>

          {/* Company selector */}
          {companies && companies.length > 0 && (
            <div style={{ padding: "9px 10px 7px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ color: "#64748B", fontSize: 9, margin: "0 2px 4px", direction: "rtl", fontWeight: 700, letterSpacing: "0.05em" }}>الشركة الحالية</p>
              <select value={companyId} onChange={e => setCompanyId(parseInt(e.target.value))} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "#E2E8F0", fontSize: 11, cursor: "pointer", direction: "rtl" }}>
                {companies.map(c => <option key={c.id} value={c.id} style={{ background: "#1E293B", color: "#E2E8F0" }}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: "auto", padding: "5px 0" }}>
            {NAV.map(sec => (
              <div key={sec.s}>
                <button onClick={() => setExp(p => ({ ...p, [sec.s]: !p[sec.s] }))} style={{ width: "100%", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", direction: "rtl" }}>
                  <span style={{ color: "#64748B", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{sec.s}</span>
                  <span style={{ color: "#64748B", fontSize: 8 }}>{exp[sec.s] ? "▼" : "▶"}</span>
                </button>
                {exp[sec.s] && sec.items.map(item => (
                  <button key={item.id} onClick={() => setPage(item.id)} style={{ width: "100%", padding: "7px 9px 7px 12px", display: "flex", alignItems: "center", gap: 7, background: page === item.id ? "rgba(37,99,235,0.18)" : "transparent", border: "none", borderRight: `2px solid ${page === item.id ? T.primary : "transparent"}`, cursor: "pointer", direction: "rtl", transition: "all 0.1s" }}>
                    <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0, opacity: 0.65 }}>{item.icon}</span>
                    <span style={{ fontSize: 11, color: page === item.id ? "#E2E8F0" : "#94A3B8", fontWeight: page === item.id ? 600 : 400, flex: 1 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* User */}
          <div style={{ padding: "9px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", direction: "rtl", display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }} onClick={() => setPage("profile")}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{user.name.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#E2E8F0", fontSize: 11, fontWeight: 600, margin: 0 }}>{user.name}</p>
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: rc.bg + "40", color: rc.c }}>{rc.l}</span>
            </div>
            <span style={{ color: "#475569", fontSize: 10 }}>⚙</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{ height: 52, background: "#FFFFFF", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button onClick={() => setOpen(o => !o)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: "#F0F4FA", cursor: "pointer", fontSize: 14, color: T.textSec, lineHeight: 1 }}>☰</button>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{label}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ padding: "2px 8px", borderRadius: 18, background: "#ECFDF5", color: "#065F46", fontSize: 10, fontWeight: 700 }}>● نظام حقيقي</span>
            <button onClick={onLogout} style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: "#FFF5F5", color: T.red, cursor: "pointer", fontSize: 11 }}>خروج</button>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: "auto", paddingTop: 18 }}>{renderPage()}</main>
      </div>
    </div>
  );
}

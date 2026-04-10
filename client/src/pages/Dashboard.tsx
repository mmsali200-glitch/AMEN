import { useState } from "react";
import { trpc } from "../lib/trpc";

// ── ألوان التصميم الفاتح ──────────────────────────────────────────────────────
const C = {
  bg:          "#F8FAFF",        // خلفية عامة زرقاء فاتحة جداً
  sidebar:     "#FFFFFF",        // الشريط الجانبي أبيض
  sidebarBorder:"#E8EFFE",       // حدود الشريط
  surface:     "#FFFFFF",        // البطاقات
  surface2:    "#F8FAFF",        // سطح ثانوي
  border:      "#E2E8F0",        // حدود عامة
  primary:     "#2563EB",        // أزرق رئيسي
  primaryLight:"#EFF6FF",        // أزرق فاتح جداً
  primarySoft: "#DBEAFE",        // أزرق فاتح
  teal:        "#0D9488",        // أخضر مزرق
  tealLight:   "#F0FDFA",
  green:       "#059669",
  greenLight:  "#ECFDF5",
  red:         "#DC2626",
  redLight:    "#FEF2F2",
  amber:       "#D97706",
  amberLight:  "#FFFBEB",
  purple:      "#7C3AED",
  purpleLight: "#F5F3FF",
  text:        "#1E293B",        // نص داكن
  textSec:     "#475569",        // نص ثانوي
  muted:       "#94A3B8",        // نص خافت
  navActive:   "#EFF6FF",        // خلفية العنصر النشط
  navText:     "#64748B",        // نص القائمة
  navActiveText:"#2563EB",       // نص العنصر النشط
};

const fmt = (n:number) => new Intl.NumberFormat("ar").format(Math.round(n));

const NAV = [
  { s:"الرئيسية",        items:[{id:"dashboard",     label:"لوحة التحكم",       icon:"📊"}] },
  { s:"القوائم المالية", items:[{id:"trial-balance",  label:"ميزان المراجعة",    icon:"⚖️"},{id:"income",label:"قائمة الدخل",icon:"📈"},{id:"balance-sheet",label:"الميزانية العمومية",icon:"🏦"}] },
  { s:"الدفاتر",         items:[{id:"journal-entries",label:"القيود المحاسبية",  icon:"📋"},{id:"general-ledger",label:"دفتر الأستاذ",icon:"📒"}] },
  { s:"التحليل",         items:[{id:"ratios",         label:"النسب المالية",     icon:"📉"},{id:"monthly",label:"التحليل الشهري",icon:"📅"}] },
  { s:"الذكاء الاصطناعي",items:[{id:"advisor",        label:"المستشار AI ✦",     icon:"🤖"},{id:"chatbot",label:"شات بوت مالي",icon:"💬"}] },
  { s:"الإدارة",         items:[{id:"users",          label:"المستخدمون",        icon:"👥"},{id:"companies",label:"الشركات",icon:"🏢"},{id:"audit-log",label:"سجل النشاط",icon:"🔍"}] },
];

const roleLabels: Record<string,{l:string,bg:string,c:string}> = {
  cfo_admin:  {l:"CFO Admin", bg:"#EFF6FF", c:"#2563EB"},
  manager:    {l:"مدير",      bg:"#ECFDF5", c:"#059669"},
  accountant: {l:"محاسب",     bg:"#FFFBEB", c:"#D97706"},
  auditor:    {l:"مدقق",      bg:"#F5F3FF", c:"#7C3AED"},
  partner:    {l:"شريك",      bg:"#FDF2F8", c:"#DB2777"},
  custom:     {l:"مخصص",      bg:"#F8FAFC", c:"#64748B"},
};

// ── لوحة التحكم ───────────────────────────────────────────────────────────────
function OverviewDashboard({ companyId, companies }:{ companyId:number; companies:any[] }) {
  const co = companies.find(c => c.id === companyId);
  const { data: sync } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });

  const cards = [
    { l:"القيود المحاسبية", v: sync?.totalEntries?.toLocaleString("ar") || "0", icon:"📋", bg:C.primaryLight, ic:C.primary },
    { l:"سطور القيود",      v: sync?.totalLines?.toLocaleString("ar") || "0",   icon:"📄", bg:C.tealLight,    ic:C.teal },
    { l:"الشركة الحالية",   v: co?.name?.slice(0,14) || "—",                    icon:"🏢", bg:C.purpleLight,  ic:C.purple },
    { l:"العملة",           v: co?.currency || "KWD",                            icon:"💰", bg:C.amberLight,   ic:C.amber },
  ];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>لوحة التحكم</h2>
        {co && <p style={{ color:C.muted, fontSize:13, margin:"3px 0 0" }}>{co.name} — {co.industry}</p>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:20 }}>
        {cards.map((k,i) => (
          <div key={i} style={{ background:C.surface, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.border}`, display:"flex", gap:14, alignItems:"center", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{k.icon}</div>
            <div>
              <p style={{ color:C.muted, fontSize:11, margin:"0 0 3px", fontWeight:500 }}>{k.l}</p>
              <p style={{ fontSize:17, fontWeight:700, color:k.ic, margin:0 }}>{k.v}</p>
            </div>
          </div>
        ))}
      </div>

      {!companyId && (
        <div style={{ background:C.amberLight, border:`1px solid #FDE68A`, borderRadius:12, padding:"14px 18px", display:"flex", gap:10 }}>
          <span>⚠️</span>
          <p style={{ color:"#92400E", fontSize:13, margin:0 }}>اختر شركة من القائمة للبدء في تحليل البيانات المالية.</p>
        </div>
      )}

      {/* Welcome banner */}
      <div style={{ background:"linear-gradient(135deg,#2563EB,#0D9488)", borderRadius:16, padding:"22px 24px", marginTop:16, color:"#fff" }}>
        <h3 style={{ fontSize:16, fontWeight:800, margin:"0 0 6px" }}>مرحباً بك في المستشار المالي ✦</h3>
        <p style={{ fontSize:13, opacity:0.85, margin:"0 0 14px", lineHeight:1.7 }}>نظام ذكاء مالي متكامل — ابدأ بتحليل البيانات المالية لشركتك الآن</p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {["ميزان المراجعة","القيود المحاسبية","النسب المالية","المستشار AI"].map(t=>(
            <span key={t} style={{ padding:"4px 12px", borderRadius:20, background:"rgba(255,255,255,0.2)", fontSize:11, fontWeight:600 }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── القيود المحاسبية ──────────────────────────────────────────────────────────
function JournalEntriesPage({ companyId }:{ companyId:number }) {
  const [page, setPage] = useState(1);
  const { data } = trpc.journal.listEntries.useQuery({ companyId, page, limit:20 }, { enabled:!!companyId });

  if (!companyId) return (
    <div style={{ padding:50, textAlign:"center", direction:"rtl" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
      <p style={{ color:C.muted }}>اختر شركة أولاً</p>
    </div>
  );

  const jColors: Record<string,{bg:string,c:string}> = {
    مبيعات:  {bg:"#EFF6FF",c:"#2563EB"},
    بنك:     {bg:"#ECFDF5",c:"#059669"},
    مشتريات: {bg:"#FFFBEB",c:"#D97706"},
    رواتب:   {bg:"#F5F3FF",c:"#7C3AED"},
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:"0 0 16px" }}>القيود المحاسبية</h2>
      <div style={{ background:C.surface, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:C.primaryLight }}>
              {["رقم القيد","التاريخ","الدفتر","الشريك","مدين","دائن","الحالة"].map(h=>(
                <th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e,i) => {
              const jc = jColors[e.journalName||""] || {bg:"#F8FAFC",c:"#64748B"};
              return (
                <tr key={e.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:C.surface2, transition:"background 0.1s" }}>
                  <td style={{ padding:"9px 12px", color:C.primary, fontWeight:700, fontFamily:"monospace", fontSize:11 }}>{e.name}</td>
                  <td style={{ padding:"9px 12px", color:C.textSec }}>{e.date}</td>
                  <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 8px", borderRadius:18, background:jc.bg, color:jc.c, fontSize:10, fontWeight:600 }}>{e.journalName||"—"}</span></td>
                  <td style={{ padding:"9px 12px", color:C.text }}>{e.partnerName||"—"}</td>
                  <td style={{ padding:"9px 12px", color:C.teal, fontWeight:600 }}>{fmt(e.totalDebit)}</td>
                  <td style={{ padding:"9px 12px", color:C.red, fontWeight:600 }}>{fmt(e.totalCredit)}</td>
                  <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 8px", borderRadius:18, background:C.greenLight, color:C.green, fontSize:10, fontWeight:600 }}>{e.state}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && (
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface2 }}>
            <span style={{ fontSize:11, color:C.muted }}>الصفحة {data.page} من {data.pages} ({data.total} قيد)</span>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, color:C.textSec, cursor:"pointer", fontSize:11 }}>←</button>
              <button onClick={()=>setPage(p=>Math.min(data.pages,p+1))} disabled={page===data.pages} style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, color:C.textSec, cursor:"pointer", fontSize:11 }}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── إدارة المستخدمين ──────────────────────────────────────────────────────────
function UsersManagement({ currentUser }:{ currentUser:any }) {
  const { data:users, refetch } = trpc.users.list.useQuery();
  const { data:companies } = trpc.company.list.useQuery();
  const createUser = trpc.users.create.useMutation({ onSuccess:()=>{ refetch(); setShowForm(false); setError(""); } });
  const updateUser = trpc.users.update.useMutation({ onSuccess:()=>refetch() });
  const deleteUser = trpc.users.delete.useMutation({ onSuccess:()=>refetch() });
  const grantAccess = trpc.users.grantAccess.useMutation({ onSuccess:()=>refetch() });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"accountant" as any });
  const [error, setError] = useState("");
  const [showGrant, setShowGrant] = useState<number|null>(null);
  const [grantForm, setGrantForm] = useState({ companyId:0, role:"accountant" });

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>إدارة المستخدمين</h2>
          <p style={{ color:C.muted, fontSize:12, margin:"2px 0 0" }}>{users?.length||0} مستخدم</p>
        </div>
        {currentUser.role==="cfo_admin" && (
          <button onClick={()=>setShowForm(!showForm)} style={{ padding:"8px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>+ إضافة مستخدم</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={e=>{e.preventDefault();setError("");createUser.mutate(form,{onError:err=>setError(err.message)});}} style={{ background:C.primaryLight, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.primarySoft}`, marginBottom:16 }}>
          <p style={{ fontWeight:700, fontSize:13, color:C.primary, margin:"0 0 12px" }}>➕ مستخدم جديد</p>
          {error && <div style={{ background:C.redLight, border:`1px solid #FECACA`, borderRadius:8, padding:"8px 12px", color:C.red, fontSize:12, marginBottom:10 }}>{error}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {([["الاسم","name","text",form.name],["البريد الإلكتروني","email","email",form.email],["كلمة المرور","password","password",form.password]] as any[]).map(([l,k,type,val])=>(
              <div key={k}><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:4, fontWeight:600 }}>{l}</label>
                <input type={type} value={val} onChange={(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}))} required style={{ width:"100%", padding:"8px 11px", borderRadius:8, border:`1.5px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
            ))}
            <div><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:4, fontWeight:600 }}>الدور</label>
              <select value={form.role} onChange={e=>setForm((f:any)=>({...f,role:e.target.value}))} style={{ width:"100%", padding:"8px 11px", borderRadius:8, border:`1.5px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12 }}>
                {Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button type="submit" disabled={createUser.isPending} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{createUser.isPending?"جاري...":"حفظ"}</button>
            <button type="button" onClick={()=>setShowForm(false)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </form>
      )}

      <div style={{ background:C.surface, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:C.primaryLight }}>
              {["المستخدم","الدور","البريد","الحالة","آخر دخول","إجراءات"].map(h=>(
                <th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users?.map((u,i)=>{
              const rc=roleLabels[u.role]||roleLabels.custom;
              return (
                <tr key={u.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:C.surface2 }}>
                  <td style={{ padding:"11px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:34, height:34, borderRadius:10, background:rc.bg, display:"flex", alignItems:"center", justifyContent:"center", color:rc.c, fontWeight:800, fontSize:14 }}>{u.name.charAt(0)}</div>
                      <span style={{ fontWeight:600, color:C.text }}>{u.name}</span>
                      {u.id===currentUser.id && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:10, background:C.primarySoft, color:C.primary, fontWeight:700 }}>أنت</span>}
                    </div>
                  </td>
                  <td style={{ padding:"11px 12px" }}><span style={{ padding:"3px 9px", borderRadius:18, background:rc.bg, color:rc.c, fontSize:10, fontWeight:700 }}>{rc.l}</span></td>
                  <td style={{ padding:"11px 12px", color:C.textSec, direction:"ltr", fontSize:11 }}>{u.email}</td>
                  <td style={{ padding:"11px 12px" }}><span style={{ padding:"3px 9px", borderRadius:18, background:u.isActive?C.greenLight:C.redLight, color:u.isActive?C.green:C.red, fontSize:10, fontWeight:700 }}>{u.isActive?"● نشط":"○ غير نشط"}</span></td>
                  <td style={{ padding:"11px 12px", color:C.muted, fontSize:11 }}>{u.lastLogin?new Date(u.lastLogin).toLocaleDateString("ar"):"—"}</td>
                  <td style={{ padding:"11px 12px" }}>
                    {currentUser.role==="cfo_admin" && u.id!==currentUser.id && (
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>updateUser.mutate({id:u.id,isActive:!u.isActive})} style={{ padding:"3px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:C.surface, color:C.textSec, cursor:"pointer", fontSize:10 }}>{u.isActive?"تعطيل":"تفعيل"}</button>
                        <button onClick={()=>{if(confirm(`حذف ${u.name}؟`))deleteUser.mutate({id:u.id})}} style={{ padding:"3px 8px", borderRadius:6, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:10 }}>حذف</button>
                        <button onClick={()=>setShowGrant(showGrant===u.id?null:u.id)} style={{ padding:"3px 8px", borderRadius:6, border:`1px solid #99F6E4`, background:C.tealLight, color:C.teal, cursor:"pointer", fontSize:10 }}>صلاحية</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showGrant!==null && (
        <div style={{ background:C.tealLight, borderRadius:12, padding:"14px 18px", border:`1px solid #99F6E4`, marginTop:12 }}>
          <p style={{ fontWeight:700, fontSize:12, color:C.teal, margin:"0 0 10px" }}>منح صلاحية وصول للشركة</p>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
            <div style={{ flex:2 }}>
              <label style={{ display:"block", fontSize:11, color:C.teal, marginBottom:3, fontWeight:600 }}>الشركة</label>
              <select value={grantForm.companyId} onChange={e=>setGrantForm(f=>({...f,companyId:parseInt(e.target.value)}))} style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:`1px solid #99F6E4`, background:"#fff", color:C.text, fontSize:12 }}>
                <option value={0}>اختر شركة...</option>
                {companies?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ display:"block", fontSize:11, color:C.teal, marginBottom:3, fontWeight:600 }}>الدور</label>
              <select value={grantForm.role} onChange={e=>setGrantForm(f=>({...f,role:e.target.value}))} style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:`1px solid #99F6E4`, background:"#fff", color:C.text, fontSize:12 }}>
                {Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
            <button disabled={!grantForm.companyId} onClick={()=>{grantAccess.mutate({userId:showGrant!,companyId:grantForm.companyId,role:grantForm.role});setShowGrant(null);}} style={{ padding:"7px 16px", borderRadius:8, border:"none", background:C.teal, color:"#fff", cursor:grantForm.companyId?"pointer":"default", fontSize:12, fontWeight:700, opacity:grantForm.companyId?1:0.5 }}>منح</button>
            <button onClick={()=>setShowGrant(null)} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── الشركات ───────────────────────────────────────────────────────────────────
function CompaniesPage({ currentUser }:{ currentUser:any }) {
  const { data:companies, refetch } = trpc.company.list.useQuery();
  const createCo = trpc.company.create.useMutation({ onSuccess:()=>{ refetch(); setShowForm(false); } });
  const deleteCo = trpc.company.delete.useMutation({ onSuccess:()=>refetch() });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", industry:"", currency:"KWD", contactEmail:"" });
  const [error, setError] = useState("");

  const colors = [C.primary, C.teal, C.purple, C.amber];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div><h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>إدارة الشركات</h2><p style={{ color:C.muted, fontSize:12, margin:"2px 0 0" }}>{companies?.length||0} شركة</p></div>
        {currentUser.role==="cfo_admin" && <button onClick={()=>setShowForm(!showForm)} style={{ padding:"8px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>+ شركة جديدة</button>}
      </div>

      {showForm && (
        <form onSubmit={e=>{e.preventDefault();setError("");createCo.mutate(form as any,{onError:err=>setError(err.message)});}} style={{ background:C.primaryLight, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.primarySoft}`, marginBottom:16 }}>
          <p style={{ fontWeight:700, fontSize:13, color:C.primary, margin:"0 0 12px" }}>🏢 شركة جديدة</p>
          {error && <div style={{ background:C.redLight, borderRadius:8, padding:"8px 12px", color:C.red, fontSize:12, marginBottom:10 }}>{error}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {([["اسم الشركة","name","text",form.name],["القطاع","industry","text",form.industry],["البريد","contactEmail","email",form.contactEmail]] as any[]).map(([l,k,type,val])=>(
              <div key={k}><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:4, fontWeight:600 }}>{l}</label><input type={type} value={val} onChange={(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}))} required={k==="name"} style={{ width:"100%", padding:"8px 11px", borderRadius:8, border:`1.5px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
            ))}
            <div><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:4, fontWeight:600 }}>العملة</label>
              <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{ width:"100%", padding:"8px 11px", borderRadius:8, border:`1.5px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12 }}>
                {["KWD","SAR","AED","USD","EUR","GBP"].map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button type="submit" disabled={createCo.isPending} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{createCo.isPending?"جاري...":"حفظ"}</button>
            <button type="button" onClick={()=>setShowForm(false)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </form>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {companies?.map((co,i)=>(
          <div key={co.id} style={{ background:C.surface, borderRadius:16, padding:"20px 22px", border:`1px solid ${C.border}`, borderTop:`3px solid ${colors[i%4]}`, boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`${colors[i%4]}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏢</div>
              <span style={{ padding:"3px 9px", borderRadius:18, background:`${colors[i%4]}15`, color:colors[i%4], fontSize:10, fontWeight:700 }}>{co.currency}</span>
            </div>
            <h3 style={{ fontSize:14, fontWeight:800, color:C.text, margin:"0 0 4px" }}>{co.name}</h3>
            <p style={{ color:C.muted, fontSize:12, margin:"0 0 12px" }}>{co.industry||"—"}</p>
            <div style={{ fontSize:11, color:C.textSec, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
              <p style={{ margin:"0 0 3px" }}>📅 {new Date(co.createdAt).toLocaleDateString("ar")}</p>
              {co.contactEmail && <p style={{ margin:0, direction:"ltr", textAlign:"right" }}>✉ {co.contactEmail}</p>}
            </div>
            {currentUser.role==="cfo_admin" && (
              <button onClick={()=>{if(confirm(`حذف "${co.name}"؟`))deleteCo.mutate({id:co.id})}} style={{ marginTop:10, padding:"5px 12px", borderRadius:7, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:10, width:"100%" }}>حذف الشركة</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── سجل النشاط ────────────────────────────────────────────────────────────────
function AuditLogPage() {
  const { data:logs } = trpc.audit.getLogs.useQuery({ limit:100 });
  const colors: Record<string,string> = { create_company:C.teal, create_user:C.primary, delete_company:C.red, delete_user:C.red };
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:"0 0 16px" }}>سجل النشاط 🔍</h2>
      <div style={{ background:C.surface, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:C.primaryLight }}>{["الوقت","المستخدم","الإجراء","التفاصيل"].map(h=><th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
          <tbody>
            {logs?.map((l,i)=>(
              <tr key={l.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:C.surface2 }}>
                <td style={{ padding:"9px 12px", color:C.muted, fontSize:11 }}>{new Date(l.createdAt).toLocaleString("ar")}</td>
                <td style={{ padding:"9px 12px", color:C.text, fontWeight:600 }}>{l.userName||"النظام"}</td>
                <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 8px", borderRadius:18, background:`${colors[l.action]||C.muted}15`, color:colors[l.action]||C.muted, fontSize:10, fontWeight:600 }}>{l.action}</span></td>
                <td style={{ padding:"9px 12px", color:C.textSec }}>{l.target||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ملف المستخدم ──────────────────────────────────────────────────────────────
function ProfilePage({ user, onLogout }:{ user:any; onLogout:()=>void }) {
  const changePassword = trpc.auth.changePassword.useMutation();
  const [form, setForm] = useState({ currentPassword:"", newPassword:"", confirm:"" });
  const [msg, setMsg] = useState("");
  const rc = roleLabels[user.role]||roleLabels.custom;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl", maxWidth:480 }}>
      <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:"0 0 18px" }}>ملف المستخدم 👤</h2>

      <div style={{ background:C.surface, borderRadius:16, padding:"22px", border:`1px solid ${C.border}`, marginBottom:16, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${rc.bg},${rc.c}30)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:800, color:rc.c }}>{user.name.charAt(0)}</div>
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:800, color:C.text, margin:0, fontSize:16 }}>{user.name}</p>
            <p style={{ color:C.muted, fontSize:12, margin:"2px 0 0", direction:"ltr" }}>{user.email}</p>
          </div>
          <span style={{ padding:"4px 12px", borderRadius:18, background:rc.bg, color:rc.c, fontSize:11, fontWeight:700 }}>{rc.l}</span>
        </div>
        <p style={{ fontSize:12, color:C.textSec, margin:0 }}>✅ وصول إلى {user.companyAccess?.length||0} شركة</p>
      </div>

      <form onSubmit={e=>{e.preventDefault();if(form.newPassword!==form.confirm){setMsg("كلمات المرور غير متطابقة");return;}changePassword.mutate({currentPassword:form.currentPassword,newPassword:form.newPassword},{onSuccess:()=>setMsg("✓ تم التغيير بنجاح"),onError:err=>setMsg("⚠ "+err.message)});}} style={{ background:C.surface, borderRadius:16, padding:"22px", border:`1px solid ${C.border}`, marginBottom:16, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
        <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 14px" }}>🔑 تغيير كلمة المرور</p>
        {msg && <div style={{ padding:"8px 12px", borderRadius:8, background:msg.includes("✓")?C.greenLight:C.redLight, color:msg.includes("✓")?C.green:C.red, fontSize:12, marginBottom:12 }}>{msg}</div>}
        {([["كلمة المرور الحالية","currentPassword",form.currentPassword],["كلمة المرور الجديدة","newPassword",form.newPassword],["تأكيد كلمة المرور","confirm",form.confirm]] as any[]).map(([l,k,v])=>(
          <div key={k} style={{ marginBottom:10 }}>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:3, fontWeight:600 }}>{l}</label>
            <input type="password" value={v} onChange={(e:any)=>setForm(f=>({...f,[k]:e.target.value}))} required style={{ width:"100%", padding:"8px 11px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/>
          </div>
        ))}
        <button type="submit" disabled={changePassword.isPending} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{changePassword.isPending?"جاري...":"حفظ"}</button>
      </form>

      <button onClick={onLogout} style={{ width:"100%", padding:"12px", borderRadius:12, border:`1.5px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:13, fontWeight:700 }}>🚪 تسجيل الخروج</button>
    </div>
  );
}

function Placeholder({ title }:{ title:string }) {
  return (
    <div style={{ padding:"60px 24px", textAlign:"center", direction:"rtl" }}>
      <div style={{ width:64, height:64, borderRadius:18, background:C.primaryLight, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:28 }}>🔧</div>
      <h3 style={{ fontSize:17, fontWeight:700, color:C.text, margin:"0 0 6px" }}>{title}</h3>
      <p style={{ color:C.muted, fontSize:12 }}>هذه الصفحة قيد التطوير</p>
    </div>
  );
}

// ── الـ Dashboard الرئيسي ──────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }:{ user:any; onLogout:()=>void }) {
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(true);
  const [exp, setExp] = useState<Record<string,boolean>>(()=>Object.fromEntries(NAV.map(s=>[s.s,true])));
  const { data:companies } = trpc.company.list.useQuery();
  const [companyId, setCompanyId] = useState(0);

  if (!companyId && companies?.length) setCompanyId(companies[0].id);

  const allItems = NAV.flatMap(s=>s.items);
  const label = allItems.find(i=>i.id===page)?.label || page;
  const rc = roleLabels[user.role]||roleLabels.custom;

  const renderPage = () => {
    switch(page) {
      case "dashboard":      return <OverviewDashboard companyId={companyId} companies={companies||[]} />;
      case "journal-entries":return <JournalEntriesPage companyId={companyId} />;
      case "users":          return user.role==="cfo_admin" ? <UsersManagement currentUser={user}/> : <Placeholder title="غير مصرح"/>;
      case "companies":      return user.role==="cfo_admin" ? <CompaniesPage currentUser={user}/> : <Placeholder title="غير مصرح"/>;
      case "audit-log":      return user.role==="cfo_admin" ? <AuditLogPage/> : <Placeholder title="غير مصرح"/>;
      case "profile":        return <ProfilePage user={user} onLogout={onLogout}/>;
      default:               return <Placeholder title={label}/>;
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:"'Cairo','Segoe UI',sans-serif", overflow:"hidden" }}>
      <style>{`*{box-sizing:border-box;} ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px;} button,input,select{font-family:inherit;} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width:open?252:0, background:C.sidebar, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden", transition:"width 0.22s ease", borderLeft:`1px solid ${C.sidebarBorder}`, boxShadow:"2px 0 16px rgba(37,99,235,0.06)" }}>
        <div style={{ minWidth:252, display:"flex", flexDirection:"column", height:"100%" }}>

          {/* Logo */}
          <div style={{ padding:"18px 16px 14px", borderBottom:`1px solid ${C.sidebarBorder}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, direction:"rtl" }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#2563EB,#0D9488)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16, flexShrink:0, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>م</div>
              <div>
                <p style={{ color:C.text, fontWeight:800, fontSize:13, margin:0 }}>المستشار المالي</p>
                <p style={{ color:C.muted, fontSize:9, margin:0 }}>CFO Intelligence v4</p>
              </div>
            </div>
          </div>

          {/* Company Selector */}
          {companies && companies.length>0 && (
            <div style={{ padding:"10px 12px 8px", borderBottom:`1px solid ${C.sidebarBorder}` }}>
              <p style={{ color:C.muted, fontSize:9, margin:"0 2px 5px", direction:"rtl", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>الشركة</p>
              <select value={companyId} onChange={e=>setCompanyId(parseInt(e.target.value))} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.primaryLight, color:C.primary, fontSize:11, cursor:"pointer", direction:"rtl", fontWeight:600 }}>
                {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
            {NAV.map(sec=>(
              <div key={sec.s}>
                <button onClick={()=>setExp(p=>({...p,[sec.s]:!p[sec.s]}))} style={{ width:"100%", padding:"6px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"transparent", border:"none", cursor:"pointer", direction:"rtl" }}>
                  <span style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" }}>{sec.s}</span>
                  <span style={{ color:C.muted, fontSize:8 }}>{exp[sec.s]?"▼":"▶"}</span>
                </button>
                {exp[sec.s] && sec.items.map(item=>(
                  <button key={item.id} onClick={()=>setPage(item.id)} style={{ width:"100%", padding:"8px 10px 8px 14px", display:"flex", alignItems:"center", gap:8, background:page===item.id?C.navActive:"transparent", border:"none", borderRight:`3px solid ${page===item.id?C.primary:"transparent"}`, cursor:"pointer", direction:"rtl", transition:"all 0.12s", margin:"1px 0" }}>
                    <span style={{ fontSize:14, width:20, textAlign:"center", flexShrink:0 }}>{item.icon}</span>
                    <span style={{ fontSize:12, color:page===item.id?C.navActiveText:C.navText, fontWeight:page===item.id?700:500, flex:1 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* User */}
          <div onClick={()=>setPage("profile")} style={{ padding:"12px 14px", borderTop:`1px solid ${C.sidebarBorder}`, direction:"rtl", display:"flex", gap:9, alignItems:"center", cursor:"pointer", background:"transparent", transition:"background 0.15s" }}
            onMouseEnter={e=>(e.currentTarget.style.background=C.primaryLight)}
            onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
            <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${rc.bg},${rc.c}30)`, display:"flex", alignItems:"center", justifyContent:"center", color:rc.c, fontWeight:800, fontSize:14, flexShrink:0 }}>{user.name.charAt(0)}</div>
            <div style={{ flex:1 }}>
              <p style={{ color:C.text, fontSize:12, fontWeight:700, margin:0 }}>{user.name}</p>
              <span style={{ fontSize:9, padding:"1px 7px", borderRadius:8, background:rc.bg, color:rc.c, fontWeight:700 }}>{rc.l}</span>
            </div>
            <span style={{ color:C.muted, fontSize:11 }}>⚙</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        {/* Header */}
        <header style={{ height:56, background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", flexShrink:0, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setOpen(o=>!o)} style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.primaryLight, cursor:"pointer", fontSize:14, color:C.primary, lineHeight:1, fontWeight:700 }}>☰</button>
            <span style={{ fontSize:14, color:C.text, fontWeight:700 }}>{label}</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ padding:"3px 10px", borderRadius:18, background:C.greenLight, color:C.green, fontSize:10, fontWeight:700 }}>● مباشر</span>
            <span style={{ padding:"3px 10px", borderRadius:18, background:C.primaryLight, color:C.primary, fontSize:10, fontWeight:600 }}>2024</span>
            <button onClick={onLogout} style={{ padding:"5px 12px", borderRadius:8, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:11, fontWeight:600 }}>خروج</button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:"auto", paddingTop:20 }}>{renderPage()}</main>
      </div>
    </div>
  );
}

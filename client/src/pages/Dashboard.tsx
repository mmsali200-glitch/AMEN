import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";

const C = { bg:"#F8FAFF", sidebar:"#FFFFFF", border:"#E2E8F0", primary:"#2563EB", primaryLight:"#EFF6FF", primarySoft:"#DBEAFE", teal:"#0D9488", tealLight:"#F0FDFA", green:"#059669", greenLight:"#ECFDF5", red:"#DC2626", redLight:"#FEF2F2", amber:"#D97706", amberLight:"#FFFBEB", purple:"#7C3AED", purpleLight:"#F5F3FF", text:"#1E293B", textSec:"#475569", muted:"#94A3B8" };
const fmt = (n:number) => new Intl.NumberFormat("ar").format(Math.round(n));
const fmtM = (n:number) => n>=1000000?`${(n/1000000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(0)}K`:fmt(n);
const ARMonths = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const roleLabels: Record<string,{l:string,bg:string,c:string}> = {
  cfo_admin:{l:"CFO Admin",bg:"#EFF6FF",c:"#2563EB"},manager:{l:"مدير",bg:"#ECFDF5",c:"#059669"},
  accountant:{l:"محاسب",bg:"#FFFBEB",c:"#D97706"},auditor:{l:"مدقق",bg:"#F5F3FF",c:"#7C3AED"},
  partner:{l:"شريك",bg:"#FDF2F8",c:"#DB2777"},custom:{l:"مخصص",bg:"#F8FAFC",c:"#64748B"},
};
const NAV = [
  { s:"الرئيسية",        items:[{id:"dashboard",      label:"لوحة التحكم",        icon:"📊"}]},
  { s:"ربط Odoo",        items:[{id:"odoo-wizard",    label:"إعداد وربط + مزامنة", icon:"🔗"}]},
  { s:"الدفاتر",         items:[{id:"journal-entries",label:"القيود المحاسبية",   icon:"📋"},{id:"general-ledger",label:"دفتر الأستاذ",icon:"📒"},{id:"partner-statement",label:"كشف حساب شريك",icon:"👤"}]},
  { s:"القوائم المالية", items:[{id:"trial-balance",  label:"ميزان المراجعة",     icon:"⚖️"},{id:"income",label:"قائمة الدخل",icon:"📈"},{id:"balance-sheet",label:"الميزانية العمومية",icon:"🏦"},{id:"cashflow",label:"التدفقات النقدية",icon:"💵"}]},
  { s:"التحليل",         items:[{id:"ratios",         label:"النسب المالية",      icon:"📉"},{id:"monthly",label:"التحليل الشهري",icon:"📅"}]},
  { s:"الذكاء AI",       items:[{id:"advisor",        label:"المستشار AI ✦",      icon:"🤖"},{id:"chatbot",label:"شات بوت مالي",icon:"💬"}]},
  { s:"الإدارة",         items:[{id:"holding",label:"الشركات القابضة",icon:"🏛️"},{id:"users",label:"المستخدمون",icon:"👥"},{id:"companies",label:"الشركات",icon:"🏢"},{id:"audit-log",label:"سجل النشاط",icon:"🔍"}]},
];

// ── Shared Components ──────────────────────────────────────────────────────────
const Card = ({ children, style={} }:any) => <div style={{ background:C.sidebar, borderRadius:14, border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)", ...style }}>{children}</div>;
const PageTitle = ({ title, sub="" }:any) => <div style={{ marginBottom:18 }}><h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>{title}</h2>{sub && <p style={{ color:C.muted, fontSize:12, margin:"3px 0 0" }}>{sub}</p>}</div>;
const Badge = ({ label, bg, color }:any) => <span style={{ padding:"2px 10px", borderRadius:20, background:bg, color, fontSize:10, fontWeight:700 }}>{label}</span>;
const Spinner = () => <div style={{ width:16, height:16, border:"2px solid rgba(37,99,235,0.2)", borderTopColor:C.primary, borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>;
const NoData = ({ text="لا توجد بيانات — قم بمزامنة Odoo أولاً" }:any) => <div style={{ padding:60, textAlign:"center", direction:"rtl" }}><div style={{ fontSize:40, marginBottom:12 }}>📭</div><p style={{ color:C.muted, fontSize:13 }}>{text}</p></div>;

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashboardPage({ companyId, co }:any) {
  const { data:sync } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });
  const year = new Date().getFullYear();
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${year}-01-01`, dateTo:`${year}-12-31` }, { enabled:!!companyId && (sync?.totalEntries||0)>0 });

  const kpis = [
    { l:"إجمالي الإيرادات",    v:fmtM(income?.revenue||0),    icon:"💰", bg:C.primaryLight, c:C.primary },
    { l:"صافي الربح",          v:fmtM(income?.netProfit||0),   icon:"📈", bg:C.greenLight,   c:C.green },
    { l:"القيود المحاسبية",    v:fmt(sync?.totalEntries||0),   icon:"📋", bg:C.tealLight,    c:C.teal },
    { l:"هامش الربح",          v:`${income?.revenue ? ((income.netProfit/income.revenue)*100).toFixed(1) : 0}%`, icon:"📊", bg:C.amberLight, c:C.amber },
  ];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="لوحة التحكم" sub={co?.name ? `${co.name} — ${co.industry || ""}` : "اختر شركة للبدء"} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:18 }}>
        {kpis.map((k,i) => (
          <Card key={i} style={{ padding:"18px 20px" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ width:44, height:44, borderRadius:12, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{k.icon}</div>
              <div><p style={{ color:C.muted, fontSize:11, margin:"0 0 3px", fontWeight:500 }}>{k.l}</p><p style={{ fontSize:18, fontWeight:800, color:k.c, margin:0 }}>{k.v}</p></div>
            </div>
          </Card>
        ))}
      </div>

      {!companyId ? (
        <Card style={{ padding:"28px 24px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>👆</div>
          <p style={{ color:C.textSec, fontWeight:600, margin:"0 0 6px" }}>اختر شركة من القائمة أعلاه</p>
          <p style={{ color:C.muted, fontSize:12, margin:0 }}>ثم قم بمزامنة بيانات Odoo لعرض التحليلات</p>
        </Card>
      ) : (sync?.totalEntries||0) === 0 ? (
        <Card style={{ background:"linear-gradient(135deg,#EFF6FF,#F0FDFA)", padding:"28px 24px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔗</div>
          <p style={{ color:C.primary, fontWeight:700, margin:"0 0 6px", fontSize:16 }}>لا توجد بيانات بعد</p>
          <p style={{ color:C.textSec, fontSize:13, margin:"0 0 16px" }}>قم بمزامنة Odoo لاستيراد القيود المحاسبية وعرض التقارير المالية</p>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
            {["إعداد Odoo","مزامنة الحركات","ميزان المراجعة","قائمة الدخل"].map(t=>(
              <span key={t} style={{ padding:"5px 12px", borderRadius:18, background:"rgba(37,99,235,0.1)", color:C.primary, fontSize:12, fontWeight:600 }}>{t}</span>
            ))}
          </div>
        </Card>
      ) : (
        <Card style={{ background:"linear-gradient(135deg,#2563EB,#0D9488)", padding:"22px 24px" }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:"#fff", margin:"0 0 6px" }}>✅ البيانات محملة بنجاح</h3>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.85)", margin:"0 0 12px" }}>{fmt(sync?.totalEntries||0)} قيد | {fmt(sync?.totalLines||0)} سطر محاسبي</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {[{l:"الإيرادات",v:fmtM(income?.revenue||0)},{l:"المصروفات",v:fmtM((income?.expenses||0)+(income?.cogs||0))},{l:"صافي الربح",v:fmtM(income?.netProfit||0)}].map((s,i)=>(
              <div key={i} style={{ textAlign:"center", padding:"10px", borderRadius:8, background:"rgba(255,255,255,0.15)" }}>
                <p style={{ color:"#fff", fontSize:14, fontWeight:800, margin:"0 0 2px" }}>{s.v}</p>
                <p style={{ color:"rgba(255,255,255,0.75)", fontSize:10, margin:0 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Odoo Setup ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// 🔗 معالج Odoo الموحّد — إعداد + ربط + مزامنة في شاشة واحدة
// ══════════════════════════════════════════════════════════════════════════════
type WizardStep = "group"|"odoo"|"discover"|"select"|"link"|"sync"|"done";

function OdooWizardPage({ companyId, co }:any) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep]               = useState<WizardStep>("group");
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [odooForm, setOdooForm]       = useState({
    url:"https://onesolutionc-roma.odoo.com",
    database:"onesolutionc-roma-main-17095422",
    username:"admin@admin.com", password:"KMM9999"
  });
  const [discovered,  setDiscovered]  = useState<any[]>([]);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [linked,      setLinked]      = useState<any[]>([]);
  const [linkLog,     setLinkLog]     = useState<{msg:string,ok:boolean}[]>([]);
  const [linkPct,     setLinkPct]     = useState(0);
  const [linking,     setLinking]     = useState(false);
  const [syncLog,     setSyncLog]     = useState<{msg:string,type:string}[]>([]);
  const [syncPct,     setSyncPct]     = useState(0);
  const [syncing,     setSyncing]     = useState(false);
  const [syncDone,    setSyncDone]    = useState(false);
  const [syncResult,  setSyncResult]  = useState<any>(null);
  const [syncType,    setSyncType]    = useState("full");
  const [dateFrom,    setDateFrom]    = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo,      setDateTo]      = useState(`${new Date().getFullYear()}-12-31`);
  const [incOpening,  setIncOpening]  = useState(true);
  const [error,       setError]       = useState("");
  const linkLogRef = useRef<HTMLDivElement>(null);
  const syncLogRef = useRef<HTMLDivElement>(null);

  // ── Queries & mutations ────────────────────────────────────────────────────
  const { data:groups,  refetch:refetchGroups } = (trpc as any).groups.list.useQuery();
  const { data:sync,    refetch:refetchSync    } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });
  const createGroup  = (trpc as any).groups.create.useMutation();
  const saveOdoo     = (trpc as any).groups.saveOdooConfig.useMutation();
  const testDiscover = (trpc as any).groups.testAndDiscover.useMutation();
  const linkSingle   = (trpc as any).groups.linkSingleCompany.useMutation();
  const syncMut      = trpc.odoo.syncJournals.useMutation();

  useEffect(() => { linkLogRef.current?.scrollTo(0,linkLogRef.current.scrollHeight); }, [linkLog]);
  useEffect(() => { syncLogRef.current?.scrollTo(0,syncLogRef.current.scrollHeight); }, [syncLog]);

  const addLinkLog = (msg:string, ok=true) => setLinkLog(l=>[...l,{msg,ok}]);
  const addSyncLog = (msg:string, type="info") => setSyncLog(l=>[...l,{msg:`[${new Date().toLocaleTimeString("ar")}] ${msg}`,type}]);

  const toggleSelect = (id:number) => {
    setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  };

  // ── Step helpers ───────────────────────────────────────────────────────────
  const handleSelectGroup = (g:any) => {
    setActiveGroup(g);
    setOdooForm({ url:g.odoo_url||"", database:g.odoo_database||"", username:g.odoo_username||"", password:g.odoo_password||"" });
  };

  const handleCreateAndNext = async (name:string) => {
    setError("");
    createGroup.mutate({ name, baseCurrency:"KWD" }, {
      onSuccess:(g:any)=>{ setActiveGroup(g); setStep("odoo"); refetchGroups(); },
      onError:(e:any)=>setError(e.message)
    });
  };

  const handleSaveOdoo = async () => {
    if (!activeGroup) return;
    setError("");
    await saveOdoo.mutateAsync({ groupId:activeGroup.id, ...odooForm });
    setStep("discover");
  };

  const handleDiscover = () => {
    if (!activeGroup) return;
    setError(""); setDiscovered([]);
    testDiscover.mutate({ groupId:activeGroup.id }, {
      onSuccess:(d:any)=>{ setDiscovered(d.companies); setStep("select"); },
      onError:(e:any)=>setError(e.message)
    });
  };

  const handleLink = async () => {
    const toLink = discovered.filter((c:any)=>selected.has(c.id));
    if (!toLink.length || !activeGroup) return;
    setStep("link"); setLinking(true); setLinkLog([]); setLinkPct(0); setLinked([]);

    const results:any[] = [];
    for (let i=0; i<toLink.length; i++) {
      const c = toLink[i];
      const base = Math.round((i/toLink.length)*100);

      addLinkLog(`─────── شركة ${i+1}/${toLink.length} ───────`, true);
      setLinkPct(base+5);
      await new Promise(r=>setTimeout(r,300));

      addLinkLog(`📝 إنشاء سجل: ${c.name}`);
      setLinkPct(base+15); await new Promise(r=>setTimeout(r,250));

      addLinkLog(`🔑 إعطاء صلاحيات المستخدم`);
      setLinkPct(base+25); await new Promise(r=>setTimeout(r,250));

      addLinkLog(`🔗 نسخ إعدادات Odoo (ID: ${c.id})`);
      setLinkPct(base+35); await new Promise(r=>setTimeout(r,250));

      try {
        const res = await linkSingle.mutateAsync({ groupId:activeGroup.id, odooId:c.id, name:c.name, currency:c.currency||"KWD" });
        addLinkLog(`✅ ${c.name} — ${res.status==="created"?"تم الإنشاء":"موجودة مسبقاً"}`);
        results.push({ ...res, name:c.name });
      } catch(e:any) {
        addLinkLog(`❌ خطأ: ${e.message}`, false);
        results.push({ status:"error", name:c.name });
      }
      setLinkPct(Math.round(((i+1)/toLink.length)*100));
    }

    setLinked(results);
    addLinkLog("─────────────────────────────", true);
    addLinkLog(`🎉 اكتملت عملية الربط — ${results.filter(r=>r.status==="created").length} شركة جديدة`);
    setLinking(false);
    refetchGroups();
  };

  const handleSync = async (targetCompanyId: number, odooCompanyId: number, companyName: string) => {
    setSyncing(true); setSyncDone(false); setSyncLog([]); setSyncPct(0); setSyncResult(null);

    const steps:[number,string,string][] = [
      [8,  `🔗 الاتصال بـ Odoo — شركة: ${companyName}`,"info"],
      [20, "✅ تم تسجيل الدخول بنجاح","success"],
      [30, "📊 حساب الأرصدة الافتتاحية لجميع الحسابات...","info"],
      [45, "📥 استيراد القيود المحاسبية من Odoo...","info"],
      [62, "⚙️ معالجة السطور وتصنيف الحسابات...","info"],
      [78, "💾 حفظ البيانات في قاعدة البيانات...","info"],
      [90, "🔄 تحديث حالة المزامنة...","info"],
    ];
    let si=0;
    const iv = setInterval(()=>{ if(si<steps.length){ const [p,m,t]=steps[si]; setSyncPct(p); addSyncLog(m,t); si++; } },900);

    syncMut.mutate({ companyId:targetCompanyId, odooCompanyId, dateFrom, dateTo, syncType, includeOpeningBalance:incOpening }, {
      onSuccess:(d:any)=>{ clearInterval(iv); setSyncPct(100); addSyncLog(`✅ ${d.inserted} قيد | رصيد افتتاحي: ${d.openingLines} سطر`,"success"); setSyncResult(d); setSyncDone(true); setSyncing(false); refetchSync(); },
      onError:(e:any)=>{ clearInterval(iv); addSyncLog(`❌ ${e.message}`,"error"); setSyncing(false); }
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEPS CONFIG
  const STEPS = [
    {id:"group",   label:"المجموعة القابضة", icon:"🏛️"},
    {id:"odoo",    label:"بيانات Odoo",       icon:"🔌"},
    {id:"discover",label:"اكتشاف الشركات",   icon:"🔍"},
    {id:"select",  label:"اختيار الشركات",   icon:"☑️"},
    {id:"link",    label:"ربط وإنشاء",        icon:"🔗"},
    {id:"sync",    label:"المزامنة",          icon:"🔄"},
  ];
  const stepIdx = STEPS.findIndex(s=>s.id===step);

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="🔗 إعداد وربط Odoo + المزامنة" sub="خطوات متتالية من الربط حتى استيراد البيانات"/>

      {/* ── Step Indicator ── */}
      {step!=="done" && (
        <div style={{ display:"flex", alignItems:"center", marginBottom:22, overflowX:"auto", padding:"2px 0" }}>
          {STEPS.map((s,i)=>{
            const done    = i < stepIdx;
            const active  = s.id===step||s.id==="link"&&step==="link";
            const current = i===stepIdx;
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:done?14:16, fontWeight:700,
                    background:done?C.teal:current?C.primary:"#F1F5F9",
                    color:done||current?"#fff":C.muted,
                    boxShadow:current?`0 0 0 3px ${C.primarySoft}`:"none",
                    transition:"all 0.3s" }}>
                    {done?"✓":s.icon}
                  </div>
                  <span style={{ fontSize:9, color:done?C.teal:current?C.primary:C.muted, fontWeight:done||current?700:400, whiteSpace:"nowrap" }}>{s.label}</span>
                </div>
                {i<STEPS.length-1 && (
                  <div style={{ width:32, height:2, background:done?C.teal:C.border, margin:"0 4px", marginBottom:14, borderRadius:1, transition:"background 0.3s", flexShrink:0 }}/>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <div style={{ padding:"10px 14px", borderRadius:8, background:C.redLight, border:`1px solid #FECACA`, color:C.red, fontSize:12, marginBottom:14 }}>⚠️ {error}</div>}

      {/* ══ STEP 1: Group ══════════════════════════════════════════════════════ */}
      {step==="group" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {/* existing groups */}
          <Card style={{ padding:"20px" }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>🏛️ مجموعاتك القابضة</p>
            {(!groups||groups.length===0) ? (
              <div style={{ padding:"20px", textAlign:"center", color:C.muted, fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🏛️</div>
                لا توجد مجموعات — أنشئ واحدة جديدة
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
                {groups.map((g:any)=>(
                  <button key={g.id} onClick={()=>{handleSelectGroup(g);setStep("odoo");}}
                    style={{ padding:"12px 14px", borderRadius:10, border:`1.5px solid ${activeGroup?.id===g.id?C.primary:C.border}`, background:activeGroup?.id===g.id?C.primaryLight:"#fff", cursor:"pointer", textAlign:"right", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"all 0.15s" }}>
                    <div>
                      <p style={{ fontWeight:700, color:activeGroup?.id===g.id?C.primary:C.text, margin:"0 0 3px", fontSize:13 }}>{g.name}</p>
                      <p style={{ color:C.muted, fontSize:11, margin:0 }}>{g.is_connected?"✅ متصل بـ Odoo":"○ غير متصل"} | {g.odoo_database?.slice(0,22)||"—"}</p>
                    </div>
                    <span style={{ color:C.primary, fontSize:16 }}>←</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* create new */}
          <Card style={{ padding:"20px" }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>✨ إنشاء مجموعة جديدة</p>
            {(() => {
              const [n,setN] = useState("");
              return (
                <>
                  <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>اسم المجموعة القابضة</label>
                  <input value={n} onChange={e=>setN(e.target.value)} placeholder="مثال: مجموعة الخليج القابضة"
                    onKeyDown={e=>e.key==="Enter"&&n.trim()&&handleCreateAndNext(n)}
                    style={{ width:"100%", padding:"10px 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13, outline:"none", marginBottom:12, boxSizing:"border-box" as any }}/>
                  <button onClick={()=>n.trim()&&handleCreateAndNext(n)} disabled={!n.trim()||createGroup.isPending}
                    style={{ width:"100%", padding:"11px", borderRadius:10, border:"none", background:!n.trim()?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                    {createGroup.isPending?"جاري الإنشاء...":"إنشاء والمتابعة ←"}
                  </button>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {/* ══ STEP 2: Odoo Config ════════════════════════════════════════════════ */}
      {step==="odoo" && (
        <Card style={{ padding:"24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <p style={{ fontWeight:800, fontSize:15, color:C.text, margin:0 }}>🔌 بيانات اتصال Odoo</p>
              {activeGroup && <p style={{ color:C.muted, fontSize:12, margin:"3px 0 0" }}>المجموعة: <strong style={{ color:C.primary }}>{activeGroup.name}</strong></p>}
            </div>
            <button onClick={()=>setStep("group")} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:11 }}>← تغيير المجموعة</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {[["رابط الخادم (URL)","url","text"],["اسم قاعدة البيانات","database","text"],["اسم المستخدم","username","email"],["كلمة المرور","password","password"]].map(([l,k,t])=>(
              <div key={k as string}>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>{l as string}</label>
                <input type={t as string} value={(odooForm as any)[k as string]} onChange={e=>setOdooForm((f:any)=>({...f,[k as string]:e.target.value}))}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none", direction:"ltr", textAlign:"left", boxSizing:"border-box" as any }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSaveOdoo} disabled={saveOdoo.isPending}
              style={{ padding:"11px 28px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
              {saveOdoo.isPending?"جاري الحفظ...":"حفظ والمتابعة ←"}
            </button>
          </div>
        </Card>
      )}

      {/* ══ STEP 3: Discover ══════════════════════════════════════════════════ */}
      {step==="discover" && (
        <Card style={{ padding:"36px 24px", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>🔍</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, margin:"0 0 10px" }}>اكتشاف الشركات في Odoo</h3>
          <p style={{ color:C.textSec, fontSize:14, margin:"0 0 6px" }}>{activeGroup?.name}</p>
          <p style={{ color:C.muted, fontSize:12, margin:"0 0 24px" }}>{odooForm.url}</p>
          {testDiscover.isPending ? (
            <div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", alignItems:"center", marginBottom:14 }}>
                <div style={{ width:20, height:20, border:`3px solid ${C.primaryLight}`, borderTopColor:C.primary, borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                <span style={{ fontSize:14, color:C.primary, fontWeight:600 }}>جاري الاتصال بـ Odoo وقراءة الشركات...</span>
              </div>
              <div style={{ background:"#F1F5F9", borderRadius:8, height:6, maxWidth:320, margin:"0 auto", overflow:"hidden" }}>
                <div style={{ width:"60%", height:"100%", background:`linear-gradient(90deg,${C.primary},${C.teal})`, borderRadius:8, animation:"pulse 1s ease-in-out infinite" }}/>
              </div>
            </div>
          ) : (
            <button onClick={handleDiscover}
              style={{ padding:"14px 40px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:15, fontWeight:700, boxShadow:"0 4px 14px rgba(37,99,235,0.3)" }}>
              🔍 اكتشف الشركات الآن
            </button>
          )}
          <button onClick={()=>setStep("odoo")} style={{ display:"block", margin:"14px auto 0", padding:"6px 14px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>← رجوع</button>
        </Card>
      )}

      {/* ══ STEP 4: Select ════════════════════════════════════════════════════ */}
      {step==="select" && (
        <>
          <Card style={{ padding:"14px 18px", marginBottom:12, background:C.greenLight, border:`1px solid #A7F3D0` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <p style={{ fontWeight:700, color:C.green, margin:0 }}>✅ تم اكتشاف {discovered.length} شركة في Odoo</p>
              <span style={{ padding:"3px 12px", borderRadius:18, background:"rgba(255,255,255,0.7)", color:C.green, fontSize:12, fontWeight:700 }}>{selected.size} مختارة</span>
            </div>
          </Card>
          <Card style={{ padding:"16px 20px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:0 }}>🏢 اختر الشركات المطلوبة</p>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setSelected(new Set(discovered.map((c:any)=>c.id)))} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.primary}`, background:C.primaryLight, color:C.primary, cursor:"pointer", fontSize:11, fontWeight:600 }}>تحديد الكل</button>
                <button onClick={()=>setSelected(new Set())} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:11 }}>إلغاء الكل</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:10 }}>
              {discovered.map((c:any)=>(
                <div key={c.id} onClick={()=>toggleSelect(c.id)}
                  style={{ padding:"13px 15px", borderRadius:10, border:`2px solid ${selected.has(c.id)?C.primary:C.border}`, background:selected.has(c.id)?C.primaryLight:"#fff", cursor:"pointer", transition:"all 0.12s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700, color:selected.has(c.id)?C.primary:C.text, margin:"0 0 4px", fontSize:13 }}>{c.name}</p>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {c.currency&&<Badge label={c.currency} bg={selected.has(c.id)?C.primarySoft:"#F1F5F9"} color={selected.has(c.id)?C.primary:C.textSec}/>}
                        {c.city&&<span style={{ fontSize:10, color:C.muted }}>📍{c.city}</span>}
                        <span style={{ fontSize:10, color:C.muted }}>ID:{c.id}</span>
                      </div>
                    </div>
                    <div style={{ width:20, height:20, borderRadius:4, border:`2px solid ${selected.has(c.id)?C.primary:C.muted}`, background:selected.has(c.id)?C.primary:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {selected.has(c.id)&&<span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={()=>setStep("discover")} style={{ padding:"10px 18px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>← رجوع</button>
            <button onClick={handleLink} disabled={selected.size===0}
              style={{ padding:"11px 28px", borderRadius:10, border:"none", background:selected.size===0?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:selected.size===0?"default":"pointer", fontSize:14, fontWeight:700 }}>
              ربط {selected.size} شركة مختارة →
            </button>
          </div>
        </>
      )}

      {/* ══ STEP 5: Linking Progress ══════════════════════════════════════════ */}
      {step==="link" && (
        <Card style={{ padding:"24px" }}>
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <p style={{ fontWeight:800, fontSize:15, color:C.text, margin:0 }}>{linking?"🔗 جاري ربط الشركات...":"✅ اكتمل الربط!"}</p>
              <span style={{ fontSize:13, color:linking?C.primary:C.green, fontWeight:700 }}>{linkPct}%</span>
            </div>
            <div style={{ background:"#F1F5F9", borderRadius:8, height:10, overflow:"hidden" }}>
              <div style={{ width:`${linkPct}%`, height:"100%", background:linking?"linear-gradient(90deg,#2563EB,#0D9488)":"linear-gradient(90deg,#059669,#0D9488)", borderRadius:8, transition:"width 0.4s ease" }}/>
            </div>
          </div>

          <div style={{ background:"#0F172A", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
            <div style={{ padding:"9px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", gap:4 }}>
                <div style={{ width:9,height:9,borderRadius:"50%",background:"#EF4444" }}/><div style={{ width:9,height:9,borderRadius:"50%",background:"#F59E0B" }}/><div style={{ width:9,height:9,borderRadius:"50%",background:"#10B981" }}/>
              </div>
              <span style={{ fontSize:11, color:"#64748B", fontFamily:"monospace" }}>cfo-system — ربط الشركات</span>
            </div>
            <div ref={linkLogRef} style={{ padding:"12px 14px", maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
              {linkLog.map((l,i)=>(
                <p key={i} style={{ fontSize:11, margin:0, fontFamily:"monospace", color:l.msg.startsWith("─")?"#1E3A5F":l.msg.includes("✅")?"#34D399":l.msg.includes("❌")?"#F87171":l.msg.includes("📝")||l.msg.includes("🔗")||l.msg.includes("🔑")?"#60A5FA":"#CBD5E1" }}>{l.msg}</p>
              ))}
              {linking && <span style={{ fontSize:12, color:"#2563EB" }}>$ <span style={{ animation:"blink 1s step-end infinite", display:"inline-block", width:7, height:14, background:"#2563EB", verticalAlign:"middle" }}/></span>}
            </div>
          </div>

          {!linking && linked.length>0 && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8, marginBottom:16 }}>
                {linked.map((c:any,i:number)=>(
                  <div key={i} style={{ padding:"10px 12px", borderRadius:9, background:c.status==="created"?C.greenLight:c.status==="already_exists"?C.primaryLight:C.redLight, border:`1px solid ${c.status==="created"?"#A7F3D0":c.status==="already_exists"?C.primarySoft:"#FECACA"}` }}>
                    <p style={{ fontWeight:700, color:c.status==="created"?C.green:c.status==="already_exists"?C.primary:C.red, margin:"0 0 2px", fontSize:12 }}>{c.name}</p>
                    <p style={{ color:C.textSec, fontSize:10, margin:0 }}>{c.status==="created"?"✅ تم الإنشاء":c.status==="already_exists"?"◉ موجودة مسبقاً":"❌ خطأ"}</p>
                  </div>
                ))}
              </div>
              <button onClick={()=>setStep("sync")}
                style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
                🔄 المتابعة إلى المزامنة ←
              </button>
            </>
          )}
        </Card>
      )}

      {/* ══ STEP 6: Sync ══════════════════════════════════════════════════════ */}
      {step==="sync" && (
        <>
          {/* Company sync cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:14 }}>
            {linked.filter(l=>l.status==="created"||l.status==="already_exists").map((l:any)=>(
              <SyncCard key={l.companyId} linkedItem={l} dateFrom={dateFrom} dateTo={dateTo} syncType={syncType} incOpening={incOpening} onSync={handleSync}/>
            ))}
          </div>

          {/* Global sync settings */}
          <Card style={{ padding:"18px 20px" }}>
            <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 14px" }}>⚙️ إعدادات المزامنة (تنطبق على كل الشركات)</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              <div>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>نوع المزامنة</label>
                <select value={syncType} onChange={e=>setSyncType(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
                  <option value="full">كاملة — من الصفر</option>
                  <option value="incremental">تزايدية — الجديد فقط</option>
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>من تاريخ</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى تاريخ</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
              </div>
            </div>
            <label onClick={()=>setIncOpening(o=>!o)} style={{ display:"flex", gap:10, padding:"10px 12px", borderRadius:8, border:`1px solid ${incOpening?C.primary:C.border}`, background:incOpening?C.primaryLight:C.bg, cursor:"pointer", marginTop:12 }}>
              <div style={{ width:16,height:16,borderRadius:3,border:`2px solid ${incOpening?C.primary:C.muted}`,background:incOpening?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1 }}>
                {incOpening&&<span style={{ color:"#fff",fontSize:10,fontWeight:800 }}>✓</span>}
              </div>
              <span style={{ fontSize:12, color:incOpening?C.primary:C.text, fontWeight:600 }}>تضمين الرصيد الافتتاحي (مهم لصحة ميزان المراجعة)</span>
            </label>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sync Card (per company) ────────────────────────────────────────────────────
function SyncCard({ linkedItem, dateFrom, dateTo, syncType, incOpening, onSync }:any) {
  const { data:status, refetch } = trpc.journal.syncStatus.useQuery({ companyId:linkedItem.companyId }, { enabled:!!linkedItem.companyId });
  const [log,   setLog]   = useState<{msg:string,type:string}[]>([]);
  const [pct,   setPct]   = useState(0);
  const [busy,  setBusy]  = useState(false);
  const [done,  setDone]  = useState(false);
  const [res,   setRes]   = useState<any>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const syncMut = trpc.odoo.syncJournals.useMutation();

  useEffect(()=>{ logRef.current?.scrollTo(0,logRef.current.scrollHeight); },[log]);
  const add = (msg:string, type="info") => setLog(l=>[...l,{msg:`[${new Date().toLocaleTimeString("ar")}] ${msg}`,type}]);

  const doSync = async () => {
    setBusy(true); setDone(false); setLog([]); setPct(0); setRes(null);
    const steps:[number,string,string][] = [
      [10,"🔗 الاتصال بـ Odoo...","info"],[22,"✅ تم تسجيل الدخول","success"],
      [35,"📊 حساب الأرصدة الافتتاحية...","info"],[50,"📥 استيراد القيود...","info"],
      [65,"⚙️ معالجة السطور...","info"],[80,"💾 حفظ البيانات...","info"],
    ];
    let si=0;
    const iv=setInterval(()=>{ if(si<steps.length){ const[p,m,t]=steps[si]; setPct(p); add(m,t); si++; } },800);
    syncMut.mutate({ companyId:linkedItem.companyId, odooCompanyId:linkedItem.odooId, dateFrom, dateTo, syncType, includeOpeningBalance:incOpening },{
      onSuccess:(d:any)=>{ clearInterval(iv); setPct(100); add(`✅ ${d.inserted} قيد | رصيد افتتاحي: ${d.openingLines} سطر`,"success"); setRes(d); setDone(true); setBusy(false); refetch(); },
      onError:(e:any)=>{ clearInterval(iv); add(`❌ ${e.message}`,"error"); setBusy(false); }
    });
  };

  return (
    <Card style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 18px", display:"flex", gap:12, alignItems:"center", borderBottom:log.length>0?`1px solid ${C.border}`:"none" }}>
        <div style={{ width:40,height:40,borderRadius:11,background:"linear-gradient(135deg,#2563EB20,#0D948820)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>🏢</div>
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:800, color:C.text, margin:"0 0 3px", fontSize:14 }}>{linkedItem.name}</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Badge label={`Odoo ID: ${linkedItem.odooId}`} bg={C.primaryLight} color={C.primary}/>
            <Badge label={`${status?.totalEntries||0} قيد`} bg={status?.totalEntries?C.greenLight:"#F1F5F9"} color={status?.totalEntries?C.green:C.muted}/>
            {done && <Badge label="✅ مزامن" bg={C.greenLight} color={C.green}/>}
          </div>
        </div>
        {pct>0&&pct<100 && (
          <div style={{ flex:1, maxWidth:160 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ fontSize:10, color:C.muted }}>التقدم</span>
              <span style={{ fontSize:10, color:C.primary, fontWeight:700 }}>{pct}%</span>
            </div>
            <div style={{ background:"#F1F5F9", borderRadius:4, height:6 }}>
              <div style={{ width:`${pct}%`, height:"100%", background:"linear-gradient(90deg,#2563EB,#0D9488)", borderRadius:4, transition:"width 0.5s" }}/>
            </div>
          </div>
        )}
        {done && <Badge label="100% ✓" bg={C.greenLight} color={C.green}/>}
        <button onClick={doSync} disabled={busy}
          style={{ padding:"8px 18px", borderRadius:9, border:"none", background:busy?"#94A3B8":done?"linear-gradient(135deg,#059669,#0D9488)":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:busy?"default":"pointer", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {busy?<><Spinner/>مزامنة...</>:done?"🔄 إعادة المزامنة":"🔄 مزامنة"}
        </button>
      </div>
      {log.length>0 && (
        <div ref={logRef} style={{ padding:"10px 14px", maxHeight:130, overflowY:"auto", background:"#0F172A", display:"flex", flexDirection:"column", gap:3 }}>
          {log.map((l,i)=>(
            <p key={i} style={{ fontSize:10, margin:0, fontFamily:"monospace", color:l.type==="success"?"#34D399":l.type==="error"?"#F87171":"#94A3B8" }}>{l.msg}</p>
          ))}
          {busy&&<span style={{ fontSize:11, color:"#2563EB" }}>$ <span style={{ animation:"blink 1s step-end infinite", display:"inline-block", width:6, height:12, background:"#2563EB", verticalAlign:"middle" }}/></span>}
        </div>
      )}
    </Card>
  );
}


function TrialBalancePage({ companyId }:any) {
  const year = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`);
  const [dateTo, setDateTo] = useState(`${year}-12-31`);
  const { data, isLoading } = trpc.journal.trialBalance.useQuery({ companyId, dateFrom, dateTo }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="⚖️ ميزان المراجعة" sub="الأرصدة الافتتاحية والحركة والختامية" />
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text, outline:"none" }}/>
          <span style={{ color:C.muted }}>—</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text, outline:"none" }}/>
        </div>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : !data?.length ? <NoData/> : (
        <Card>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
              <thead>
                <tr style={{ background:C.primaryLight }}>
                  <th style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>الكود</th>
                  <th style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>اسم الحساب</th>
                  <th colSpan={2} style={{ padding:"11px 12px", textAlign:"center", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>الافتتاحي</th>
                  <th colSpan={2} style={{ padding:"11px 12px", textAlign:"center", color:C.teal, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>الحركة</th>
                  <th colSpan={2} style={{ padding:"11px 12px", textAlign:"center", color:C.purple, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>الختامي</th>
                </tr>
                <tr style={{ background:"#F8FAFF" }}>
                  <th colSpan={2} style={{ padding:"5px 12px" }}/>
                  {["مدين","دائن","مدين","دائن","مدين","دائن"].map((h,i)=>(
                    <th key={i} style={{ padding:"5px 10px", textAlign:"center", color:C.muted, fontWeight:600, fontSize:10, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r:any, i:number) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"8px 12px", color:C.muted, fontFamily:"monospace", fontSize:11, fontWeight:600 }}>{r.accountCode}</td>
                    <td style={{ padding:"8px 12px", color:C.text, fontWeight:500 }}>{r.accountName}</td>
                    {[r.openDebit,r.openCredit,r.mvtDebit,r.mvtCredit,r.closingDebit,r.closingCredit].map((v:number,j:number)=>(
                      <td key={j} style={{ padding:"8px 10px", textAlign:"center", color:v>0?C.text:C.muted, fontWeight:v>0?600:400 }}>{v>0?fmt(v):"—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
                  <td colSpan={2} style={{ padding:"11px 12px", color:C.primary, fontWeight:800, fontSize:13 }}>المجموع</td>
                  {[
                    data.reduce((s:number,r:any)=>s+(r.openDebit||0),0),
                    data.reduce((s:number,r:any)=>s+(r.openCredit||0),0),
                    data.reduce((s:number,r:any)=>s+(r.mvtDebit||0),0),
                    data.reduce((s:number,r:any)=>s+(r.mvtCredit||0),0),
                    data.reduce((s:number,r:any)=>s+(r.closingDebit||0),0),
                    data.reduce((s:number,r:any)=>s+(r.closingCredit||0),0),
                  ].map((v,j)=><td key={j} style={{ padding:"11px 10px", textAlign:"center", color:C.primary, fontWeight:800 }}>{fmt(v)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Income Statement ───────────────────────────────────────────────────────────
function IncomePage({ companyId }:any) {
  const year = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`);
  const [dateTo, setDateTo] = useState(`${year}-12-31`);
  const { data, isLoading } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom, dateTo }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const rows = data ? [
    { label:"إجمالي الإيرادات", value:data.revenue, type:"total", color:C.primary },
    { label:"تكلفة المبيعات", value:-data.cogs, type:"item" },
    { label:"مجمل الربح", value:data.grossProfit, type:"subtotal", color:C.teal },
    { label:"المصروفات التشغيلية", value:-data.expenses, type:"item" },
    { label:"الربح التشغيلي", value:data.operatingProfit, type:"subtotal", color:C.purple },
    { label:"إيرادات أخرى", value:data.otherIncome, type:"item" },
    { label:"مصروفات أخرى", value:-data.otherExpenses, type:"item" },
    { label:"صافي الربح", value:data.netProfit, type:"net", color:data.netProfit>=0?C.green:C.red },
  ] : [];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📈 قائمة الدخل" sub="نتائج الأعمال للفترة المحددة" />
        <div style={{ display:"flex", gap:8 }}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text, outline:"none" }}/>
          <span style={{ color:C.muted, alignSelf:"center" }}>—</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text, outline:"none" }}/>
        </div>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : !data ? <NoData/> : (
        <Card>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.primaryLight }}>
                <th style={{ padding:"12px 20px", textAlign:"right", color:C.primary, fontWeight:700 }}>البيان</th>
                <th style={{ padding:"12px 16px", textAlign:"center", color:C.primary, fontWeight:700 }}>المبلغ</th>
                <th style={{ padding:"12px 16px", textAlign:"center", color:C.primary, fontWeight:700 }}>النسبة %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = data.revenue > 0 ? Math.abs((r.value / data.revenue) * 100).toFixed(1) : "—";
                if (r.type === "net") return (
                  <tr key={i} style={{ background:r.value>=0?"linear-gradient(135deg,#ECFDF5,#F0FDFA)":"linear-gradient(135deg,#FEF2F2,#FFF1F2)", borderTop:`2px solid ${r.color}` }}>
                    <td style={{ padding:"14px 20px", fontWeight:800, color:r.color, fontSize:16 }}>{r.label}</td>
                    <td style={{ padding:"14px 16px", textAlign:"center", fontWeight:800, color:r.color, fontSize:16 }}>{fmt(Math.abs(r.value))}</td>
                    <td style={{ padding:"14px 16px", textAlign:"center", fontWeight:700, color:r.color }}>{pct}%</td>
                  </tr>
                );
                if (r.type === "total" || r.type === "subtotal") return (
                  <tr key={i} style={{ background:r.type==="total"?C.primaryLight:"#F8FAFF", borderTop:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 20px", fontWeight:700, color:r.color||C.primary }}>{r.label}</td>
                    <td style={{ padding:"11px 16px", textAlign:"center", fontWeight:700, color:r.color||C.primary }}>{fmt(Math.abs(r.value))}</td>
                    <td style={{ padding:"11px 16px", textAlign:"center", color:C.muted, fontSize:11 }}>{pct}%</td>
                  </tr>
                );
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"9px 20px 9px 36px", color:C.text }}>{r.label}</td>
                    <td style={{ padding:"9px 16px", textAlign:"center", color:r.value<0?C.red:C.text, fontWeight:500 }}>
                      {r.value<0?`(${fmt(Math.abs(r.value))})`:fmt(r.value)}
                    </td>
                    <td style={{ padding:"9px 16px", textAlign:"center", color:C.muted, fontSize:11 }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Balance Sheet ──────────────────────────────────────────────────────────────
function BalanceSheetPage({ companyId }:any) {
  const [asOf, setAsOf] = useState(`${new Date().getFullYear()}-12-31`);
  const { data, isLoading } = trpc.journal.balanceSheet.useQuery({ companyId, asOf }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  const Section = ({ title, items, total, color }:any) => (
    <div style={{ marginBottom:16 }}>
      <div style={{ padding:"10px 16px", background:color+"20", borderRadius:"8px 8px 0 0", borderBottom:`2px solid ${color}` }}>
        <span style={{ fontWeight:700, color, fontSize:14 }}>{title}</span>
        <span style={{ float:"left", fontWeight:800, color, fontSize:14 }}>{fmt(total)}</span>
      </div>
      {items?.sort((a:any,b:any)=>b.value-a.value).slice(0,8).map((item:any,i:number)=>(
        <div key={i} style={{ padding:"8px 16px 8px 24px", display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
          <span style={{ fontSize:12, color:C.text }}><span style={{ color:C.muted, fontSize:10, marginLeft:6 }}>{item.accountCode}</span>{item.accountName}</span>
          <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{fmt(item.value)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🏦 الميزانية العمومية" sub="المركز المالي كما في التاريخ المحدد" />
        <input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text, outline:"none" }}/>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : !data ? <NoData/> : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <Card style={{ padding:"16px 0", overflow:"hidden" }}>
            <Section title="الأصول" items={data.details?.assets} total={data.assets} color={C.primary}/>
            <div style={{ padding:"12px 16px", background:C.primaryLight, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontWeight:800, color:C.primary }}>إجمالي الأصول</span>
              <span style={{ fontWeight:800, color:C.primary, fontSize:16 }}>{fmt(data.assets)}</span>
            </div>
          </Card>
          <div>
            <Card style={{ padding:"16px 0", overflow:"hidden", marginBottom:14 }}>
              <Section title="الالتزامات" items={data.details?.liabilities} total={data.liabilities} color={C.red}/>
            </Card>
            <Card style={{ padding:"16px 0", overflow:"hidden" }}>
              <Section title="حقوق الملكية" items={data.details?.equity} total={data.equity} color={C.green}/>
              <div style={{ padding:"12px 16px", background:C.greenLight, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontWeight:800, color:C.green }}>الالتزامات + حقوق الملكية</span>
                <span style={{ fontWeight:800, color:C.green }}>{fmt(data.liabilities+data.equity)}</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── General Ledger ─────────────────────────────────────────────────────────────
function GeneralLedgerPage({ companyId }:any) {
  const year = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`);
  const [dateTo, setDateTo] = useState(`${year}-12-31`);
  const [selectedAccount, setSelectedAccount] = useState("");
  const { data:accounts } = trpc.journal.getAccounts.useQuery({ companyId }, { enabled:!!companyId });
  const { data, isLoading } = trpc.journal.generalLedger.useQuery({ companyId, accountCode:selectedAccount, dateFrom, dateTo }, { enabled:!!companyId && !!selectedAccount });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="📒 دفتر الأستاذ العام" sub="حركات حساب معين خلال فترة زمنية" />
      <Card style={{ padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ flex:2, minWidth:200 }}>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>اختر الحساب</label>
            <select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
              <option value="">— اختر حساباً —</option>
              {accounts?.map((a:any)=><option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>)}
            </select>
          </div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>من</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
        </div>
      </Card>
      {!selectedAccount ? <NoData text="اختر حساباً من القائمة أعلاه" /> : isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
            {[{l:"الرصيد الافتتاحي",v:data?.openingBalance||0,c:C.primary},{l:"إجمالي مدين",v:data?.lines?.reduce((s:number,l:any)=>s+(l.debit||0),0)||0,c:C.teal},{l:"الرصيد الختامي",v:data?.lines?.[data.lines.length-1]?.balance||0,c:C.purple}].map((s,i)=>(
              <Card key={i} style={{ padding:"12px 16px" }}><p style={{ color:C.muted, fontSize:10, margin:"0 0 3px" }}>{s.l}</p><p style={{ fontSize:16, fontWeight:800, color:s.c, margin:0 }}>{fmt(s.v)}</p></Card>
            ))}
          </div>
          <Card>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ background:C.primaryLight }}>{["التاريخ","المستند","البيان","الشريك","مدين","دائن","الرصيد"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>
                <tr style={{ background:"#EFF6FF", borderBottom:`1px solid ${C.border}` }}>
                  <td colSpan={4} style={{ padding:"8px 12px", color:C.primary, fontWeight:600, fontSize:11 }}>← رصيد افتتاحي</td>
                  <td style={{ padding:"8px 12px", color:C.primary, fontWeight:700 }}>{data?.openingBalance&&data.openingBalance>0?fmt(data.openingBalance):"—"}</td>
                  <td style={{ padding:"8px 12px", color:C.red, fontWeight:700 }}>{data?.openingBalance&&data.openingBalance<0?fmt(Math.abs(data.openingBalance)):"—"}</td>
                  <td style={{ padding:"8px 12px", color:C.primary, fontWeight:700 }}>{fmt(data?.openingBalance||0)}</td>
                </tr>
                {data?.lines?.map((l:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"8px 12px", color:C.textSec }}>{l.date}</td>
                    <td style={{ padding:"8px 12px", color:C.primary, fontFamily:"monospace", fontSize:11 }}>{l.entryName}</td>
                    <td style={{ padding:"8px 12px", color:C.text }}>{l.label||"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.textSec }}>{l.partnerName||"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.teal, fontWeight:l.debit>0?600:400 }}>{l.debit>0?fmt(l.debit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.red, fontWeight:l.credit>0?600:400 }}>{l.credit>0?fmt(l.credit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:l.balance>=0?C.primary:C.red, fontWeight:600 }}>{fmt(Math.abs(l.balance))} {l.balance>=0?"م":"د"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Monthly Analysis ───────────────────────────────────────────────────────────
function MonthlyPage({ companyId }:any) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  const maxVal = data ? Math.max(...data.map((m:any) => Math.max(m.revenue, m.expenses))) : 1;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📅 التحليل الشهري" sub="مقارنة الإيرادات والمصروفات والأرباح شهرياً" />
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text }}>
          {[2022,2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : !data ? <NoData/> : (
        <>
          <Card style={{ padding:"20px", marginBottom:14 }}>
            <div style={{ display:"flex", gap:16, alignItems:"flex-end", height:180, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
              {data.map((m:any, i:number) => (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:140 }}>
                    <div style={{ width:10, background:C.primary, borderRadius:"2px 2px 0 0", height:`${Math.max(2,(m.revenue/maxVal)*130)}px`, opacity:0.85 }}/>
                    <div style={{ width:10, background:C.amber, borderRadius:"2px 2px 0 0", height:`${Math.max(2,(m.expenses/maxVal)*130)}px`, opacity:0.85 }}/>
                    <div style={{ width:10, background:m.profit>=0?C.teal:C.red, borderRadius:"2px 2px 0 0", height:`${Math.max(2,(Math.abs(m.profit)/maxVal)*130)}px` }}/>
                  </div>
                  <span style={{ fontSize:9, color:C.muted, textAlign:"center" }}>{ARMonths[i].slice(0,3)}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:16, marginTop:10, justifyContent:"center" }}>
              {[{c:C.primary,l:"الإيرادات"},{c:C.amber,l:"المصروفات"},{c:C.teal,l:"الأرباح"}].map(s=>(
                <div key={s.l} style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:10, height:10, borderRadius:2, background:s.c }}/><span style={{ fontSize:11, color:C.textSec }}>{s.l}</span></div>
              ))}
            </div>
          </Card>
          <Card>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ background:C.primaryLight }}>{["الشهر","الإيرادات","المصروفات","صافي الربح","هامش %"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((m:any, i:number) => {
                  const margin = m.revenue>0?((m.profit/m.revenue)*100).toFixed(1):"0";
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                      <td style={{ padding:"9px 12px", fontWeight:600, color:C.text }}>{ARMonths[i]}</td>
                      <td style={{ padding:"9px 12px", color:C.primary, fontWeight:600 }}>{fmt(m.revenue)}</td>
                      <td style={{ padding:"9px 12px", color:C.amber, fontWeight:600 }}>{fmt(m.expenses)}</td>
                      <td style={{ padding:"9px 12px", color:m.profit>=0?C.green:C.red, fontWeight:700 }}>{fmt(m.profit)}</td>
                      <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 8px", borderRadius:18, background:parseFloat(margin)>10?C.greenLight:C.redLight, color:parseFloat(margin)>10?C.green:C.red, fontSize:10, fontWeight:700 }}>{margin}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Financial Ratios ───────────────────────────────────────────────────────────
function RatiosPage({ companyId }:any) {
  const year = new Date().getFullYear();
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${year}-01-01`, dateTo:`${year}-12-31` }, { enabled:!!companyId });
  const { data:balance } = trpc.journal.balanceSheet.useQuery({ companyId, asOf:`${year}-12-31` }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  if (!income || !balance) return <div style={{ textAlign:"center", padding:40 }}><Spinner/><p style={{ color:C.muted, marginTop:12 }}>جاري حساب النسب...</p></div>;

  const rev = income.revenue||1;
  const assets = balance.assets||1;
  const equity = balance.equity||1;
  const liabilities = balance.liabilities||0;
  const profit = income.netProfit||0;
  const gross = income.grossProfit||0;

  const ratios = [
    { cat:"الربحية", icon:"💹", items:[
      { name:"هامش الربح الإجمالي", value:`${((gross/rev)*100).toFixed(1)}%`, good:gross>0 },
      { name:"هامش الربح الصافي", value:`${((profit/rev)*100).toFixed(1)}%`, good:profit>0 },
      { name:"العائد على الأصول (ROA)", value:`${((profit/assets)*100).toFixed(1)}%`, good:profit>0 },
      { name:"العائد على حقوق الملكية (ROE)", value:`${((profit/equity)*100).toFixed(1)}%`, good:profit>0 },
    ]},
    { cat:"الرافعة المالية", icon:"⚖️", items:[
      { name:"نسبة الدين إلى الأصول", value:`${((liabilities/assets)*100).toFixed(1)}%`, good:liabilities/assets<0.5 },
      { name:"نسبة الدين إلى حقوق الملكية", value:equity>0?`${(liabilities/equity).toFixed(2)}x`:"—", good:liabilities/equity<1 },
    ]},
    { cat:"النشاط", icon:"🔄", items:[
      { name:"هامش الربح التشغيلي", value:`${((income.operatingProfit/rev)*100).toFixed(1)}%`, good:income.operatingProfit>0 },
      { name:"الإيرادات إلى الأصول", value:`${(rev/assets).toFixed(2)}x`, good:rev/assets>0.5 },
    ]},
  ];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="📉 النسب المالية" sub="تحليل شامل للأداء المالي" />
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {ratios.map((cat,ci)=>(
          <Card key={ci} style={{ padding:"18px 20px" }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>{cat.icon} {cat.cat}</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {cat.items.map((r,ri)=>(
                <div key={ri} style={{ padding:"14px 16px", borderRadius:10, background:r.good?C.greenLight:C.redLight, border:`1px solid ${r.good?"#A7F3D0":"#FECACA"}` }}>
                  <p style={{ fontSize:11, color:C.textSec, margin:"0 0 6px", fontWeight:500 }}>{r.name}</p>
                  <p style={{ fontSize:22, fontWeight:800, color:r.good?C.green:C.red, margin:"0 0 4px" }}>{r.value}</p>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:18, background:r.good?"#D1FAE5":"#FEE2E2", color:r.good?C.green:C.red, fontWeight:700 }}>{r.good?"✓ جيد":"⚠ يحتاج مراجعة"}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── AI Advisor ─────────────────────────────────────────────────────────────────
function AdvisorPage({ companyId, co }:any) {
  const year = new Date().getFullYear();
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const analyzeMutation = trpc.ai.analyze.useMutation();

  const handleAnalyze = () => {
    if (!companyId) return;
    setLoading(true); setReport("");
    analyzeMutation.mutate({ companyId, companyName:co?.name||"الشركة", dateFrom:`${year}-01-01`, dateTo:`${year}-12-31` }, {
      onSuccess: (data) => { setReport(data.report); setLoading(false); },
      onError: (err) => { setReport(`⚠️ خطأ: ${err.message}`); setLoading(false); }
    });
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <PageTitle title="🤖 المستشار المالي الذكي" sub={co?.name||"اختر شركة للبدء"} />
        <button onClick={handleAnalyze} disabled={loading||!companyId} style={{ padding:"10px 22px", borderRadius:10, border:"none", background:loading||!companyId?C.muted:"linear-gradient(135deg,#2563EB,#7C3AED)", color:"#fff", cursor:loading||!companyId?"default":"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:8, boxShadow:"0 4px 14px rgba(124,58,237,0.3)" }}>
          {loading?<><Spinner/>جاري التحليل...</>:"✦ توليد التقرير"}
        </button>
      </div>

      {!report && !loading && (
        <Card style={{ padding:"40px 24px", textAlign:"center", background:"linear-gradient(135deg,#F5F3FF,#EFF6FF)" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>🤖</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, margin:"0 0 8px" }}>المستشار المالي بالذكاء الاصطناعي</h3>
          <p style={{ color:C.textSec, fontSize:13, maxWidth:400, margin:"0 auto 20px", lineHeight:1.7 }}>يحلل بياناتك المالية الفعلية من قاعدة البيانات ويقدم تقريراً شاملاً مع التوصيات الاستراتيجية</p>
          <div style={{ display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
            {["تقييم الوضع المالي","نقاط القوة والضعف","التوصيات الاستراتيجية","تحليل الأداء"].map(t=>(
              <span key={t} style={{ padding:"5px 14px", borderRadius:18, background:"white", color:C.purple, fontSize:12, fontWeight:600, border:`1px solid ${C.purpleLight}` }}>{t}</span>
            ))}
          </div>
        </Card>
      )}

      {loading && (
        <Card style={{ padding:"60px 24px", textAlign:"center" }}>
          <div style={{ width:56, height:56, border:`4px solid ${C.primaryLight}`, borderTopColor:C.primary, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
          <p style={{ color:C.textSec, fontSize:14, fontWeight:600 }}>يحلل الذكاء الاصطناعي بياناتك المالية الفعلية...</p>
          <p style={{ color:C.muted, fontSize:12 }}>هذا قد يستغرق 10-20 ثانية</p>
        </Card>
      )}

      {report && (
        <Card style={{ padding:"24px 28px" }}>
          <div style={{ display:"flex", gap:12, marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#2563EB,#7C3AED)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:22, flexShrink:0 }}>🤖</div>
            <div><p style={{ fontWeight:800, color:C.text, margin:0, fontSize:15 }}>تقرير المستشار المالي الذكي</p><p style={{ color:C.muted, fontSize:12, margin:"2px 0 0" }}>{co?.name} — {new Date().toLocaleDateString("ar")}</p></div>
          </div>
          <div style={{ lineHeight:2, color:C.text, fontSize:14, whiteSpace:"pre-wrap" }}>{report}</div>
          <div style={{ marginTop:18, paddingTop:14, borderTop:`1px solid ${C.border}`, display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={handleAnalyze} style={{ padding:"7px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>↻ إعادة التحليل</button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── AI Chatbot ─────────────────────────────────────────────────────────────────
function ChatbotPage({ companyId, co }:any) {
  const [msgs, setMsgs] = useState([{ role:"assistant", content:`مرحباً! أنا مستشارك المالي الذكي لشركة ${co?.name||"الشركة"}. يمكنني تحليل بياناتك المالية الفعلية والإجابة على استفساراتك. كيف يمكنني مساعدتك؟` }]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chatMutation = trpc.ai.chat.useMutation();
  const sugg = ["ما هي الإيرادات الإجمالية؟","حلل هامش الربح","ما أكبر المصروفات؟","كيف أحسّن الربحية؟","قارن الأداء بالمعايير"];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = (text:string) => {
    if (!text.trim()||busy||!companyId) return;
    const newMsgs = [...msgs, { role:"user", content:text }];
    setMsgs(newMsgs); setInp(""); setBusy(true);
    chatMutation.mutate({ companyId, companyName:co?.name||"الشركة", message:text, history:msgs.slice(-10) }, {
      onSuccess: (data) => { setMsgs(m=>[...m, { role:"assistant", content:data.reply }]); setBusy(false); },
      onError: () => { setMsgs(m=>[...m, { role:"assistant", content:"⚠️ حدث خطأ في الاتصال." }]); setBusy(false); }
    });
  };

  return (
    <div style={{ padding:"0 24px 16px", direction:"rtl", display:"flex", flexDirection:"column", height:"calc(100vh - 76px)" }}>
      <PageTitle title="💬 شات بوت مالي" sub={co?.name||"اختر شركة للبدء"} />
      <Card style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
          {msgs.map((m,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-start":"flex-end", gap:8 }}>
              {m.role==="assistant" && <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#2563EB,#7C3AED)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15, marginTop:2 }}>🤖</div>}
              <div style={{ maxWidth:"78%", padding:"10px 14px", borderRadius:m.role==="user"?"14px 4px 14px 14px":"4px 14px 14px 14px", background:m.role==="user"?C.primarySoft:C.bg, color:C.text, fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{m.content}</div>
              {m.role==="user" && <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#0D9488,#059669)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14, marginTop:2 }}>أ</div>}
            </div>
          ))}
          {busy && <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#2563EB,#7C3AED)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15 }}>🤖</div>
            <div style={{ padding:"10px 14px", borderRadius:"4px 14px 14px 14px", background:C.bg, display:"flex", gap:4 }}>
              {[0,1,2].map(j=><div key={j} style={{ width:6, height:6, borderRadius:"50%", background:C.primary, animation:`bounce ${0.4+j*0.15}s ease-in-out infinite alternate` }}/>)}
            </div>
          </div>}
          <div ref={endRef}/>
        </div>
        {msgs.length===1 && <div style={{ padding:"0 20px 10px", display:"flex", flexWrap:"wrap", gap:6 }}>
          {sugg.map((s,i)=><button key={i} onClick={()=>send(s)} style={{ padding:"5px 12px", borderRadius:18, border:`1px solid ${C.primarySoft}`, background:C.primaryLight, color:C.primary, cursor:"pointer", fontSize:11, fontWeight:600 }}>{s}</button>)}
        </div>}
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
          <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(inp)} placeholder="اكتب سؤالك المالي هنا..." style={{ flex:1, padding:"9px 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13, outline:"none" }}/>
          <button onClick={()=>send(inp)} disabled={busy||!inp.trim()||!companyId} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontWeight:700, fontSize:16 }}>↑</button>
        </div>
      </Card>
    </div>
  );
}

// ── Partner Statement ──────────────────────────────────────────────────────────
function PartnerStatementPage({ companyId }:any) {
  const year = new Date().getFullYear();
  const [partner, setPartner] = useState("");
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`);
  const [dateTo, setDateTo] = useState(`${year}-12-31`);
  const { data:partners } = trpc.journal.getPartners.useQuery({ companyId }, { enabled:!!companyId });
  const { data, isLoading } = trpc.journal.partnerStatement.useQuery({ companyId, partnerName:partner, dateFrom, dateTo }, { enabled:!!companyId&&!!partner });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="👤 كشف حساب شريك" sub="عرض حركات عميل أو مورد خلال فترة" />
      <Card style={{ padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
          <div style={{ flex:2, minWidth:200 }}>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>اختر الشريك</label>
            <select value={partner} onChange={e=>setPartner(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
              <option value="">— اختر شريكاً —</option>
              {partners?.map((p:any)=><option key={p.partnerName} value={p.partnerName}>{p.partnerName}</option>)}
            </select>
          </div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>من</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
        </div>
      </Card>
      {!partner ? <NoData text="اختر شريكاً من القائمة أعلاه"/> : isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : (
        <>
          <Card style={{ padding:"14px 18px", marginBottom:12, background:data?.finalBalance>=0?C.greenLight:C.redLight, border:`1px solid ${data?.finalBalance>=0?"#A7F3D0":"#FECACA"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:14, color:data?.finalBalance>=0?C.green:C.red }}>الرصيد النهائي</span>
              <span style={{ fontWeight:800, fontSize:20, color:data?.finalBalance>=0?C.green:C.red }}>{fmt(Math.abs(data?.finalBalance||0))} {data?.finalBalance>=0?"مدين":"دائن"}</span>
            </div>
          </Card>
          <Card>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ background:C.primaryLight }}>{["التاريخ","المستند","البيان","الحساب","مدين","دائن","الرصيد"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>
                {data?.lines?.map((l:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"8px 12px", color:C.textSec }}>{l.date}</td>
                    <td style={{ padding:"8px 12px", color:C.primary, fontFamily:"monospace", fontSize:11 }}>{l.entryName}</td>
                    <td style={{ padding:"8px 12px", color:C.text }}>{l.label||"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.textSec, fontSize:11 }}>{l.accountCode} {l.accountName}</td>
                    <td style={{ padding:"8px 12px", color:C.teal, fontWeight:l.debit>0?600:400 }}>{l.debit>0?fmt(l.debit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.red, fontWeight:l.credit>0?600:400 }}>{l.credit>0?fmt(l.credit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:l.balance>=0?C.primary:C.red, fontWeight:600 }}>{fmt(Math.abs(l.balance))} {l.balance>=0?"م":"د"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Users ──────────────────────────────────────────────────────────────────────
function UsersPage({ currentUser }:any) {
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
        <PageTitle title="👥 إدارة المستخدمين" sub={`${users?.length||0} مستخدم مسجل`} />
        {currentUser.role==="cfo_admin" && <button onClick={()=>setShowForm(!showForm)} style={{ padding:"8px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>+ مستخدم جديد</button>}
      </div>

      {showForm && (
        <Card style={{ padding:"18px 20px", background:C.primaryLight, marginBottom:14, border:`1px solid ${C.primarySoft}` }}>
          {error && <div style={{ padding:"8px 12px", borderRadius:8, background:C.redLight, color:C.red, fontSize:12, marginBottom:10 }}>{error}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {([["الاسم","name","text"],["البريد","email","email"],["كلمة المرور","password","password"]] as any[]).map(([l,k,t])=>(
              <div key={k}><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:3, fontWeight:600 }}>{l}</label><input type={t} value={(form as any)[k]} onChange={(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}))} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
            ))}
            <div><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:3, fontWeight:600 }}>الدور</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as any}))} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12 }}>{Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>createUser.mutate(form,{onError:err=>setError(err.message)})} disabled={createUser.isPending} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{createUser.isPending?"...":"حفظ"}</button>
            <button onClick={()=>setShowForm(false)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </Card>
      )}

      <Card>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:C.primaryLight }}>{["المستخدم","الدور","البريد","الحالة","آخر دخول","إجراءات"].map(h=><th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
          <tbody>
            {users?.map((u:any,i:number)=>{
              const rc=roleLabels[u.role]||roleLabels.custom;
              return <tr key={u.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                <td style={{ padding:"11px 12px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:34, height:34, borderRadius:10, background:rc.bg, display:"flex", alignItems:"center", justifyContent:"center", color:rc.c, fontWeight:800, fontSize:14 }}>{u.name.charAt(0)}</div><span style={{ fontWeight:600, color:C.text }}>{u.name}</span>{u.id===currentUser.id&&<Badge label="أنت" bg={C.primarySoft} color={C.primary}/>}</div></td>
                <td style={{ padding:"11px 12px" }}><Badge label={rc.l} bg={rc.bg} color={rc.c}/></td>
                <td style={{ padding:"11px 12px", color:C.textSec, direction:"ltr", fontSize:11 }}>{u.email}</td>
                <td style={{ padding:"11px 12px" }}><Badge label={u.isActive?"● نشط":"○ غير نشط"} bg={u.isActive?C.greenLight:C.redLight} color={u.isActive?C.green:C.red}/></td>
                <td style={{ padding:"11px 12px", color:C.muted, fontSize:11 }}>{u.lastLogin?new Date(u.lastLogin).toLocaleDateString("ar"):"—"}</td>
                <td style={{ padding:"11px 12px" }}>
                  {currentUser.role==="cfo_admin"&&u.id!==currentUser.id&&<div style={{ display:"flex", gap:4 }}>
                    <button onClick={()=>updateUser.mutate({id:u.id,isActive:!u.isActive})} style={{ padding:"3px 8px", borderRadius:5, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:10 }}>{u.isActive?"تعطيل":"تفعيل"}</button>
                    <button onClick={()=>{if(confirm(`حذف ${u.name}؟`))deleteUser.mutate({id:u.id})}} style={{ padding:"3px 8px", borderRadius:5, border:"1px solid #FECACA", background:C.redLight, color:C.red, cursor:"pointer", fontSize:10 }}>حذف</button>
                    <button onClick={()=>setShowGrant(showGrant===u.id?null:u.id)} style={{ padding:"3px 8px", borderRadius:5, border:`1px solid #99F6E4`, background:C.tealLight, color:C.teal, cursor:"pointer", fontSize:10 }}>صلاحية</button>
                  </div>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </Card>

      {showGrant!==null && (
        <Card style={{ padding:"14px 18px", marginTop:12, background:C.tealLight, border:`1px solid #99F6E4` }}>
          <p style={{ fontWeight:700, fontSize:12, color:C.teal, margin:"0 0 10px" }}>منح صلاحية وصول</p>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
            <div style={{ flex:2 }}><label style={{ display:"block", fontSize:11, color:C.teal, marginBottom:3, fontWeight:600 }}>الشركة</label><select value={grantForm.companyId} onChange={e=>setGrantForm(f=>({...f,companyId:parseInt(e.target.value)}))} style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:`1px solid #99F6E4`, background:"#fff", color:C.text, fontSize:12 }}><option value={0}>اختر شركة...</option>{companies?.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div style={{ flex:1 }}><label style={{ display:"block", fontSize:11, color:C.teal, marginBottom:3, fontWeight:600 }}>الدور</label><select value={grantForm.role} onChange={e=>setGrantForm(f=>({...f,role:e.target.value}))} style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:`1px solid #99F6E4`, background:"#fff", color:C.text, fontSize:12 }}>{Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div>
            <button disabled={!grantForm.companyId} onClick={()=>{grantAccess.mutate({userId:showGrant!,companyId:grantForm.companyId,role:grantForm.role});setShowGrant(null);}} style={{ padding:"7px 14px", borderRadius:8, border:"none", background:C.teal, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, opacity:grantForm.companyId?1:0.5 }}>منح</button>
            <button onClick={()=>setShowGrant(null)} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Companies ─────────────────────────────────────────────────────────────────
function CompaniesPage({ currentUser }:any) {
  const { data:companies, refetch } = trpc.company.list.useQuery();
  const createCo  = trpc.company.create.useMutation({ onSuccess:()=>{ refetch(); setShowForm(false); } });
  const updateCo  = trpc.company.update.useMutation({ onSuccess:()=>{ refetch(); setEditId(null); } });
  const deleteCo  = trpc.company.delete.useMutation({ onSuccess:()=>{ refetch(); setDeleteModal(null); } });
  const clearData = trpc.company.clearData.useMutation({ onSuccess:()=>{ refetch(); setDeleteModal(null); } });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", industry:"", currency:"KWD", contactEmail:"" });
  const [editId, setEditId] = useState<number|null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [deleteModal, setDeleteModal] = useState<any>(null); // {id, name, mode}
  const [deleteStep, setDeleteStep] = useState<"confirm"|"summary">("confirm");
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const colors = [C.primary, C.teal, C.purple, C.amber, C.green, C.red];

  const startEdit = (co:any) => {
    setEditId(co.id);
    setEditForm({ name:co.name, industry:co.industry||"", currency:co.currency||"KWD", contactEmail:co.contactEmail||"", contactPhone:co.contactPhone||"", address:co.address||"", taxNumber:co.taxNumber||"" });
  };

  const openDeleteModal = async (co:any, mode:"data"|"company") => {
    setDeleteModal({ id:co.id, name:co.name, mode });
    setDeleteStep("confirm");
    setSummary(null);
  };

  const loadSummary = async () => {
    if (!deleteModal) return;
    setLoadingSummary(true);
    try {
      const res = await fetch(`/trpc/company.deleteSummary?input=${encodeURIComponent(JSON.stringify({ json:{ id:deleteModal.id } }))}`, {
        headers:{ Authorization:`Bearer ${localStorage.getItem("cfo_token")||""}` }
      });
      const d = await res.json();
      setSummary(d?.result?.data || d?.result);
    } catch {}
    setLoadingSummary(false);
    setDeleteStep("summary");
  };

  const confirmDelete = () => {
    if (!deleteModal) return;
    if (deleteModal.mode==="data") {
      clearData.mutate({ id:deleteModal.id });
    } else {
      deleteCo.mutate({ id:deleteModal.id });
    }
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🏢 إدارة الشركات" sub={`${companies?.length||0} شركة مسجلة`} />
        {currentUser.role==="cfo_admin" && (
          <button onClick={()=>setShowForm(!showForm)} style={{ padding:"8px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>
            + شركة جديدة
          </button>
        )}
      </div>

      {showForm && (
        <Card style={{ padding:"18px 20px", background:C.primaryLight, marginBottom:14, border:`1px solid ${C.primarySoft}` }}>
          <p style={{ fontWeight:700, fontSize:13, color:C.primary, margin:"0 0 12px" }}>🏢 شركة جديدة</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {([["اسم الشركة *","name","text"],["القطاع","industry","text"],["البريد الإلكتروني","contactEmail","email"]] as any[]).map(([l,k,t])=>(
              <div key={k}><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:3, fontWeight:600 }}>{l}</label>
                <input type={t} value={(form as any)[k]} onChange={(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}))} required={k==="name"} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
            ))}
            <div><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:3, fontWeight:600 }}>العملة</label>
              <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12 }}>
                {["KWD","SAR","AED","USD","EUR","GBP","QAR","BHD","OMR"].map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>createCo.mutate(form as any)} disabled={!form.name.trim()||createCo.isPending} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{createCo.isPending?"جاري...":"حفظ"}</button>
            <button onClick={()=>setShowForm(false)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {companies?.map((co:any, i:number) => (
          <Card key={co.id} style={{ overflow:"hidden" }}>
            {/* Company header */}
            <div style={{ padding:"16px 20px", display:"flex", gap:14, alignItems:"center", borderBottom: editId===co.id ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`${colors[i%6]}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🏢</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <p style={{ fontWeight:800, color:C.text, margin:0, fontSize:15 }}>{co.name}</p>
                  <Badge label={co.currency||"KWD"} bg={`${colors[i%6]}15`} color={colors[i%6]}/>
                  {co.industry && <Badge label={co.industry} bg="#F1F5F9" color={C.textSec}/>}
                </div>
                <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
                  {co.contactEmail && <span style={{ fontSize:11, color:C.muted }}>✉ {co.contactEmail}</span>}
                  {co.taxNumber && <span style={{ fontSize:11, color:C.muted }}>رقم ضريبي: {co.taxNumber}</span>}
                  <span style={{ fontSize:11, color:C.muted }}>📅 {new Date(co.createdAt).toLocaleDateString("ar")}</span>
                </div>
              </div>
              {currentUser.role==="cfo_admin" && (
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>editId===co.id?setEditId(null):startEdit(co)} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${editId===co.id?C.primary:C.border}`, background:editId===co.id?C.primaryLight:"#fff", color:editId===co.id?C.primary:C.textSec, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                    {editId===co.id?"✕ إغلاق":"✏️ تعديل"}
                  </button>
                  <button onClick={()=>openDeleteModal(co,"data")} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.amber}40`, background:C.amberLight, color:C.amber, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                    🗂️ مسح البيانات
                  </button>
                  <button onClick={()=>openDeleteModal(co,"company")} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                    🗑️ حذف الشركة
                  </button>
                </div>
              )}
            </div>

            {/* Edit form */}
            {editId===co.id && (
              <div style={{ padding:"18px 20px", background:"#F8FAFF" }}>
                <p style={{ fontWeight:700, fontSize:13, color:C.primary, margin:"0 0 14px" }}>✏️ تعديل بيانات الشركة</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
                  {([
                    ["اسم الشركة","name","text"],
                    ["القطاع","industry","text"],
                    ["العملة","currency","select"],
                    ["البريد الإلكتروني","contactEmail","email"],
                    ["رقم الهاتف","contactPhone","text"],
                    ["الرقم الضريبي","taxNumber","text"],
                    ["العنوان","address","text"],
                  ] as any[]).map(([l,k,t])=>(
                    <div key={k} style={{ gridColumn: k==="address"?"1/-1":"auto" }}>
                      <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:3, fontWeight:600 }}>{l}</label>
                      {t==="select" ? (
                        <select value={editForm[k]||""} onChange={(e:any)=>setEditForm((f:any)=>({...f,[k]:e.target.value}))} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.text, fontSize:12 }}>
                          {["KWD","SAR","AED","USD","EUR","GBP","QAR","BHD","OMR"].map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input type={t} value={editForm[k]||""} onChange={(e:any)=>setEditForm((f:any)=>({...f,[k]:e.target.value}))} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>updateCo.mutate({ id:co.id, ...editForm })} disabled={updateCo.isPending} style={{ padding:"9px 22px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                    {updateCo.isPending?"جاري الحفظ...":"✅ حفظ التغييرات"}
                  </button>
                  <button onClick={()=>setEditId(null)} style={{ padding:"9px 16px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>إلغاء</button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Delete / Clear Modal */}
      {deleteModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, direction:"rtl" }}>
          <Card style={{ padding:"28px 32px", maxWidth:480, width:"90%", position:"relative" }}>
            <button onClick={()=>setDeleteModal(null)} style={{ position:"absolute", top:14, left:14, background:"transparent", border:"none", fontSize:18, cursor:"pointer", color:C.muted }}>✕</button>

            {deleteStep==="confirm" && (
              <>
                <div style={{ textAlign:"center", marginBottom:20 }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>{deleteModal.mode==="data"?"🗂️":"⚠️"}</div>
                  <h3 style={{ fontSize:18, fontWeight:800, color:deleteModal.mode==="data"?C.amber:C.red, margin:"0 0 8px" }}>
                    {deleteModal.mode==="data"?"مسح بيانات الشركة":"حذف الشركة بالكامل"}
                  </h3>
                  <p style={{ color:C.textSec, fontSize:14, margin:0, lineHeight:1.7 }}>
                    {deleteModal.mode==="data"
                      ? <>سيتم مسح <strong>جميع القيود المحاسبية وسطورها وسجلات المزامنة</strong> للشركة <strong>"{deleteModal.name}"</strong> مع الاحتفاظ بالشركة نفسها</>
                      : <>سيتم حذف <strong>الشركة وجميع بياناتها</strong> بما في ذلك القيود والمستخدمين والإعدادات <strong>نهائياً</strong> ولا يمكن التراجع</>
                    }
                  </p>
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                  <button onClick={()=>setDeleteModal(null)} style={{ padding:"10px 22px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13, fontWeight:600 }}>إلغاء</button>
                  <button onClick={loadSummary} disabled={loadingSummary} style={{ padding:"10px 22px", borderRadius:9, border:"none", background:deleteModal.mode==="data"?C.amber:C.red, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                    {loadingSummary?<><Spinner/>جاري التحقق...</>:`عرض تفاصيل ${deleteModal.mode==="data"?"المسح":"الحذف"} ←`}
                  </button>
                </div>
              </>
            )}

            {deleteStep==="summary" && (
              <>
                <h3 style={{ fontSize:16, fontWeight:800, color:C.text, margin:"0 0 16px" }}>
                  📊 ملخص {deleteModal.mode==="data"?"البيانات التي ستُمسح":"البيانات التي ستُحذف"}
                </h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
                  {[
                    { label:"القيود المحاسبية", value:summary?.counts?.journalEntries||0, icon:"📋", color:C.primary },
                    { label:"سطور القيود", value:summary?.counts?.journalLines||0, icon:"📄", color:C.teal },
                    { label:"سجلات المزامنة", value:summary?.counts?.syncLogs||0, icon:"🔄", color:C.purple },
                    ...(deleteModal.mode==="company" ? [
                      { label:"صلاحيات المستخدمين", value:summary?.counts?.userAccess||0, icon:"👥", color:C.amber },
                      { label:"إعدادات Odoo", value:summary?.counts?.odooConfigs||0, icon:"🔗", color:C.green },
                    ] : []),
                  ].map((s,i)=>(
                    <div key={i} style={{ padding:"12px 14px", borderRadius:9, background:s.value>0?`${s.color}10`:"#F8FAFC", border:`1px solid ${s.value>0?s.color+"30":C.border}`, display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ fontSize:20 }}>{s.icon}</span>
                      <div>
                        <p style={{ fontSize:11, color:C.muted, margin:0 }}>{s.label}</p>
                        <p style={{ fontSize:18, fontWeight:800, color:s.value>0?s.color:C.muted, margin:0 }}>{s.value.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"12px 16px", borderRadius:9, background:deleteModal.mode==="data"?"#FFFBEB":C.redLight, border:`1px solid ${deleteModal.mode==="data"?"#FDE68A":"#FECACA"}`, marginBottom:18 }}>
                  <p style={{ color:deleteModal.mode==="data"?"#92400E":C.red, fontSize:13, margin:0, fontWeight:600 }}>
                    {deleteModal.mode==="data"
                      ? "⚠️ سيتم مسح هذه البيانات نهائياً — يمكنك إعادة المزامنة لاحقاً"
                      : "❌ سيتم حذف الشركة والمعلومات بالكامل — هذا الإجراء لا يمكن التراجع عنه"}
                  </p>
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button onClick={()=>setDeleteModal(null)} style={{ padding:"10px 20px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>إلغاء</button>
                  <button onClick={()=>setDeleteStep("confirm")} style={{ padding:"10px 16px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>← رجوع</button>
                  <button onClick={confirmDelete} disabled={deleteCo.isPending||clearData.isPending} style={{ padding:"10px 22px", borderRadius:9, border:"none", background:deleteModal.mode==="data"?C.amber:C.red, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}>
                    {deleteCo.isPending||clearData.isPending?<><Spinner/>جاري...</>:deleteModal.mode==="data"?"🗂️ تأكيد المسح":"🗑️ تأكيد الحذف النهائي"}
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}


// ── Audit Log ──────────────────────────────────────────────────────────────────
function AuditLogPage() {
  const { data:logs } = trpc.audit.getLogs.useQuery({ limit:100 });
  const colors: Record<string,string> = { create_company:C.teal, create_user:C.primary, delete_company:C.red, delete_user:C.red };
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="🔍 سجل النشاط" sub="جميع العمليات المسجلة في النظام" />
      <Card>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:C.primaryLight }}>{["الوقت","المستخدم","الإجراء","التفاصيل"].map(h=><th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
          <tbody>{logs?.map((l:any,i:number)=>(
            <tr key={l.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
              <td style={{ padding:"9px 12px", color:C.muted, fontSize:11 }}>{new Date(l.createdAt).toLocaleString("ar")}</td>
              <td style={{ padding:"9px 12px", color:C.text, fontWeight:600 }}>{l.userName||"النظام"}</td>
              <td style={{ padding:"9px 12px" }}><Badge label={l.action} bg={`${colors[l.action]||C.muted}20`} color={colors[l.action]||C.muted}/></td>
              <td style={{ padding:"9px 12px", color:C.textSec }}>{l.target||"—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────────
function ProfilePage({ user, onLogout }:any) {
  const changePassword = trpc.auth.changePassword.useMutation();
  const [form, setForm] = useState({ currentPassword:"", newPassword:"", confirm:"" });
  const [msg, setMsg] = useState("");
  const rc = roleLabels[user.role]||roleLabels.custom;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl", maxWidth:480 }}>
      <PageTitle title="👤 ملف المستخدم" />
      <Card style={{ padding:"22px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${rc.bg},${rc.c}30)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:800, color:rc.c }}>{user.name.charAt(0)}</div>
          <div style={{ flex:1 }}><p style={{ fontWeight:800, color:C.text, margin:0, fontSize:16 }}>{user.name}</p><p style={{ color:C.muted, fontSize:12, margin:"2px 0 0", direction:"ltr" }}>{user.email}</p></div>
          <Badge label={rc.l} bg={rc.bg} color={rc.c}/>
        </div>
        <p style={{ fontSize:12, color:C.textSec, margin:0 }}>✅ وصول إلى {user.companyAccess?.length||0} شركة</p>
      </Card>
      <form onSubmit={e=>{e.preventDefault();if(form.newPassword!==form.confirm){setMsg("كلمات المرور غير متطابقة");return;}changePassword.mutate({currentPassword:form.currentPassword,newPassword:form.newPassword},{onSuccess:()=>{setMsg("✓ تم التغيير بنجاح");setForm({currentPassword:"",newPassword:"",confirm:""});},onError:err=>setMsg("⚠ "+err.message)});}} style={{ marginBottom:14 }}>
        <Card style={{ padding:"22px" }}>
          <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 14px" }}>🔑 تغيير كلمة المرور</p>
          {msg&&<div style={{ padding:"8px 12px", borderRadius:8, background:msg.includes("✓")?C.greenLight:C.redLight, color:msg.includes("✓")?C.green:C.red, fontSize:12, marginBottom:12 }}>{msg}</div>}
          {([["كلمة المرور الحالية","currentPassword",form.currentPassword],["الجديدة","newPassword",form.newPassword],["تأكيد","confirm",form.confirm]] as any[]).map(([l,k,v])=>(
            <div key={k} style={{ marginBottom:10 }}><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:3, fontWeight:600 }}>{l}</label><input type="password" value={v} onChange={(e:any)=>setForm(f=>({...f,[k]:e.target.value}))} required style={{ width:"100%", padding:"8px 11px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
          ))}
          <button type="submit" disabled={changePassword.isPending} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{changePassword.isPending?"...":"حفظ"}</button>
        </Card>
      </form>
      <button onClick={onLogout} style={{ width:"100%", padding:"12px", borderRadius:12, border:`1.5px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:13, fontWeight:700 }}>🚪 تسجيل الخروج</button>
    </div>
  );
}


// ── Holding Companies (الشركات القابضة) ───────────────────────────────────────
function HoldingCompaniesPage({ currentUser }:any) {
  const utils = trpc.useUtils();
  const { data:groups, refetch } = (trpc as any).groups.list.useQuery();
  const createGroup = (trpc as any).groups.create.useMutation({ onSuccess:()=>{ refetch(); setStep("odoo"); } });
  const saveOdoo = (trpc as any).groups.saveOdooConfig.useMutation();
  const testDiscover = (trpc as any).groups.testAndDiscover.useMutation();
  const linkCompanies = (trpc as any).groups.linkCompanies.useMutation();
  const deleteGroup = (trpc as any).groups.delete.useMutation({ onSuccess:()=>refetch() });
  const getMembers = (trpc as any).groups.getMembers;

  // Wizard state
  const [step, setStep] = useState<"list"|"create"|"odoo"|"discover"|"select"|"confirm"|"done">("list");
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [groupForm, setGroupForm] = useState({ name:"", description:"", baseCurrency:"KWD" });
  const [odooForm, setOdooForm] = useState({ url:"https://onesolutionc-roma.odoo.com", database:"onesolutionc-roma-main-17095422", username:"admin@admin.com", password:"KMM9999" });
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState<any[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number|null>(null);
  const [error, setError] = useState("");

  const toggleSelect = (id:number) => {
    setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  };

  const handleCreateGroup = () => {
    if (!groupForm.name.trim()) return;
    createGroup.mutate(groupForm, {
      onSuccess:(g:any)=>{ setActiveGroup(g); setError(""); },
      onError:(e:any)=>setError(e.message)
    });
  };

  const handleSaveOdoo = async () => {
    if (!activeGroup) return;
    setError("");
    await saveOdoo.mutateAsync({ groupId:activeGroup.id, ...odooForm });
    setStep("discover");
  };

  const handleDiscover = () => {
    if (!activeGroup) return;
    setError("");
    testDiscover.mutate({ groupId:activeGroup.id }, {
      onSuccess:(data:any)=>{ setDiscovered(data.companies); setStep("select"); },
      onError:(e:any)=>{ setError(e.message); setStep("odoo"); }
    });
  };

  const [linkProgress, setLinkProgress] = useState<{step:string,done:boolean,error?:string}[]>([]);
  const [linkCurrent, setLinkCurrent] = useState(0);
  const linkSingle = (trpc as any).groups.linkSingleCompany.useMutation();

  const handleLink = async () => {
    if (!activeGroup || selected.size===0) return;
    setLinking(true);
    setStep("linking" as any);
    setLinked([]);
    setLinkProgress([]);
    setLinkCurrent(0);

    const toLink = discovered.filter((c:any)=>selected.has(c.id));
    const results:any[] = [];

    for (let i=0; i<toLink.length; i++) {
      const c = toLink[i];
      setLinkCurrent(i);
      const steps = [
        `📝 إنشاء سجل الشركة: ${c.name}`,
        `🔑 إعطاء صلاحيات المستخدم`,
        `🔗 نسخ إعدادات Odoo (ID: ${c.id})`,
        `🏛️ ربط بالمجموعة القابضة`,
        `✅ اكتملت: ${c.name}`,
      ];

      // Show steps progressively
      for (let s=0; s<steps.length-1; s++) {
        setLinkProgress(p => [...p, {step:steps[s], done:false}]);
        await new Promise(r=>setTimeout(r, 350));
        setLinkProgress(p => p.map((x,xi)=>xi===p.length-1?{...x,done:true}:x));
        await new Promise(r=>setTimeout(r, 150));
      }

      try {
        const res = await linkSingle.mutateAsync({ groupId:activeGroup.id, odooId:c.id, name:c.name, currency:c.currency||"KWD" });
        setLinkProgress(p => [...p, {step:steps[steps.length-1], done:true}]);
        results.push({ ...res, name:c.name });
      } catch(e:any) {
        setLinkProgress(p => [...p, {step:`❌ خطأ في ${c.name}: ${e.message}`, done:true, error:e.message}]);
        results.push({ status:"error", name:c.name, error:e.message });
      }

      if (i < toLink.length-1) {
        setLinkProgress(p => [...p, {step:"─────────────────────────", done:true}]);
      }
      await new Promise(r=>setTimeout(r, 200));
    }

    setLinked(results);
    setStep("done");
    setLinking(false);
    refetch();
  };

  const stepLabels = ["إنشاء المجموعة","ربط Odoo","اكتشاف الشركات","اختيار الشركات","تأكيد"];
  const stepIdx   = {list:-1,create:0,odoo:1,discover:2,select:3,confirm:4,done:5};

  if (step==="list") return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🏛️ الشركات القابضة" sub="إدارة مجموعات الشركات المرتبطة بـ Odoo" />
        {currentUser.role==="cfo_admin" && (
          <button onClick={()=>{ setStep("create"); setGroupForm({name:"",description:"",baseCurrency:"KWD"}); setActiveGroup(null); setDiscovered([]); setSelected(new Set()); setLinked([]); setError(""); }}
            style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>
            + شركة قابضة جديدة
          </button>
        )}
      </div>

      {(!groups||groups.length===0) ? (
        <Card style={{ padding:"48px 24px", textAlign:"center", background:"linear-gradient(135deg,#F8FAFF,#F0FDFA)" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>🏛️</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, margin:"0 0 8px" }}>لا توجد شركات قابضة بعد</h3>
          <p style={{ color:C.textSec, fontSize:13, maxWidth:380, margin:"0 auto 20px", lineHeight:1.7 }}>أنشئ شركة قابضة وربطها بقاعدة بيانات Odoo لاستيراد جميع الشركات التابعة لها</p>
          <button onClick={()=>setStep("create")} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>+ إنشاء أول شركة قابضة</button>
        </Card>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {groups.map((g:any) => (
            <GroupCard key={g.id} group={g} onExpand={setExpandedGroup} expanded={expandedGroup===g.id}
              onDelete={()=>{ if(confirm(`حذف "${g.name}"؟`)) deleteGroup.mutate({id:g.id}); }}
              onSync={()=>{ setActiveGroup(g); setOdooForm({url:g.odoo_url||"",database:g.odoo_database||"",username:g.odoo_username||"",password:g.odoo_password||""}); setStep("discover"); }}
              currentUser={currentUser}/>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      {/* Wizard Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle title="🏛️ إنشاء شركة قابضة جديدة" sub="اتبع الخطوات لربط Odoo واستيراد الشركات" />
        <button onClick={()=>{ setStep("list"); refetch(); }} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>← رجوع للقائمة</button>
      </div>

      {/* Steps indicator */}
      {step!=="done" && (
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {stepLabels.map((l,i) => {
            const cur = (stepIdx as any)[step]||0;
            const done = i < cur;
            const active = i===cur;
            return (
              <div key={i} style={{ flex:1, textAlign:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ flex:1, height:3, background:done?C.teal:i===0?"transparent":C.border, borderRadius:2 }}/>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:done?C.teal:active?C.primary:C.border, color:done||active?"#fff":C.muted, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {done?"✓":i+1}
                  </div>
                  <div style={{ flex:1, height:3, background:done||active?C.primary:C.border, borderRadius:2 }}/>
                </div>
                <p style={{ fontSize:9, color:active?C.primary:done?C.teal:C.muted, margin:"4px 0 0", fontWeight:active||done?700:400 }}>{l}</p>
              </div>
            );
          })}
        </div>
      )}

      {error && <div style={{ padding:"10px 14px", borderRadius:8, background:C.redLight, border:`1px solid #FECACA`, color:C.red, fontSize:12, marginBottom:14 }}>⚠️ {error}</div>}

      {/* Step: Create */}
      {step==="create" && (
        <Card style={{ padding:"24px" }}>
          <p style={{ fontWeight:700, fontSize:15, color:C.text, margin:"0 0 16px" }}>📝 بيانات الشركة القابضة</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>اسم الشركة القابضة *</label>
              <input value={groupForm.name} onChange={e=>setGroupForm(f=>({...f,name:e.target.value}))} placeholder="مثال: مجموعة الخليج القابضة" style={{ width:"100%", padding:"10px 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:14, outline:"none", boxSizing:"border-box" as any }}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>الوصف</label>
              <input value={groupForm.description} onChange={e=>setGroupForm(f=>({...f,description:e.target.value}))} placeholder="وصف اختياري" style={{ width:"100%", padding:"10px 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13, outline:"none", boxSizing:"border-box" as any }}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>العملة الأساسية</label>
              <select value={groupForm.baseCurrency} onChange={e=>setGroupForm(f=>({...f,baseCurrency:e.target.value}))} style={{ width:"100%", padding:"10px 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13 }}>
                {["KWD","SAR","AED","USD","EUR","GBP","QAR","BHD","OMR"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleCreateGroup} disabled={!groupForm.name.trim()||createGroup.isPending} style={{ padding:"11px 28px", borderRadius:10, border:"none", background:!groupForm.name.trim()?C.muted:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
            {createGroup.isPending?"جاري الإنشاء...":"إنشاء المجموعة ←"}
          </button>
        </Card>
      )}

      {/* Step: Odoo Config */}
      {step==="odoo" && activeGroup && (
        <Card style={{ padding:"24px" }}>
          <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:8, background:C.greenLight, border:`1px solid #A7F3D0` }}>
            <p style={{ color:C.green, fontWeight:700, margin:0 }}>✅ تم إنشاء المجموعة: <strong>{activeGroup.name}</strong></p>
          </div>
          <p style={{ fontWeight:700, fontSize:15, color:C.text, margin:"0 0 16px" }}>🔌 بيانات الاتصال بـ Odoo</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            {[
              ["رابط الخادم (URL)","url","text","https://onesolutionc-roma.odoo.com"],
              ["اسم قاعدة البيانات","database","text","onesolutionc-roma-main-17095422"],
              ["اسم المستخدم","username","email","admin@admin.com"],
              ["كلمة المرور","password","password","••••••••"],
            ].map(([l,k,type,ph])=>(
              <div key={k as string}>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>{l as string}</label>
                <input type={type as string} value={(odooForm as any)[k as string]} onChange={e=>setOdooForm((f:any)=>({...f,[k as string]:e.target.value}))} placeholder={ph as string}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none", direction:"ltr", textAlign:"left", boxSizing:"border-box" as any }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSaveOdoo} disabled={saveOdoo.isPending} style={{ padding:"11px 24px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
              {saveOdoo.isPending?"جاري الحفظ...":"حفظ والمتابعة ←"}
            </button>
          </div>
        </Card>
      )}

      {/* Step: Discover */}
      {step==="discover" && activeGroup && (
        <Card style={{ padding:"32px", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, margin:"0 0 8px" }}>اكتشاف الشركات في Odoo</h3>
          <p style={{ color:C.textSec, fontSize:14, margin:"0 0 24px", lineHeight:1.7 }}>
            سيتصل النظام بـ Odoo ويقرأ جميع الشركات الموجودة في قاعدة البيانات<br/>
            <span style={{ color:C.muted, fontSize:12 }}>{activeGroup.odoo_url || odooForm.url}</span>
          </p>
          <button onClick={handleDiscover} disabled={testDiscover.isPending} style={{ padding:"13px 36px", borderRadius:12, border:"none", background:testDiscover.isPending?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:15, fontWeight:700, display:"inline-flex", alignItems:"center", gap:10, boxShadow:"0 4px 14px rgba(37,99,235,0.3)" }}>
            {testDiscover.isPending ? <><Spinner/> جاري الاتصال واكتشاف الشركات...</> : "🔍 اكتشف الشركات الآن"}
          </button>
          {testDiscover.isPending && (
            <div style={{ marginTop:20, fontSize:13, color:C.muted }}>
              <p>جاري الاتصال بـ Odoo وقراءة الشركات...</p>
            </div>
          )}
        </Card>
      )}

      {/* Step: Select Companies */}
      {step==="select" && (
        <div>
          <Card style={{ padding:"18px 20px", marginBottom:14, background:C.greenLight, border:`1px solid #A7F3D0` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <p style={{ fontWeight:800, color:C.green, margin:0 }}>تم اكتشاف {discovered.length} شركة في Odoo</p>
                  <p style={{ color:"#065F46", fontSize:12, margin:0 }}>{activeGroup?.name}</p>
                </div>
              </div>
              <span style={{ padding:"4px 12px", borderRadius:18, background:"rgba(255,255,255,0.7)", color:C.green, fontSize:12, fontWeight:700 }}>{selected.size} مختارة</span>
            </div>
          </Card>

          <Card style={{ padding:"16px 20px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:0 }}>🏢 اختر الشركات التي تريد استيرادها:</p>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setSelected(new Set(discovered.map((c:any)=>c.id)))} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.primary}`, background:C.primaryLight, color:C.primary, cursor:"pointer", fontSize:11, fontWeight:600 }}>تحديد الكل</button>
                <button onClick={()=>setSelected(new Set())} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:11 }}>إلغاء الكل</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
              {discovered.map((c:any) => (
                <div key={c.id} onClick={()=>toggleSelect(c.id)} style={{ padding:"14px 16px", borderRadius:10, border:`2px solid ${selected.has(c.id)?C.primary:C.border}`, background:selected.has(c.id)?C.primaryLight:"#fff", cursor:"pointer", transition:"all 0.15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700, color:selected.has(c.id)?C.primary:C.text, margin:"0 0 4px", fontSize:13 }}>{c.name}</p>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {c.currency && <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:selected.has(c.id)?C.primarySoft:"#F1F5F9", color:selected.has(c.id)?C.primary:C.textSec }}>{c.currency}</span>}
                        {c.city && <span style={{ fontSize:10, color:C.muted }}>📍{c.city}</span>}
                        <span style={{ fontSize:10, color:C.muted }}>ID:{c.id}</span>
                      </div>
                      {c.vat && <p style={{ fontSize:10, color:C.muted, margin:"4px 0 0" }}>رقم ضريبي: {c.vat}</p>}
                    </div>
                    <div style={{ width:20, height:20, borderRadius:4, border:`2px solid ${selected.has(c.id)?C.primary:C.muted}`, background:selected.has(c.id)?C.primary:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {selected.has(c.id) && <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={()=>setStep("odoo")} style={{ padding:"10px 20px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>← رجوع</button>
            <button onClick={handleLink} disabled={selected.size===0||linking} style={{ padding:"11px 28px", borderRadius:10, border:"none", background:selected.size===0||linking?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:selected.size===0||linking?"default":"pointer", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
              {linking?<><Spinner/>جاري الإنشاء والربط...</>:`✅ ربط ${selected.size} شركة مختارة →`}
            </button>
          </div>
        </div>
      )}

      {/* Step: Linking Progress */}
      {(step as any)==="linking" && (
        <Card style={{ padding:"24px" }}>
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <p style={{ fontWeight:800, fontSize:15, color:C.text, margin:0 }}>🔄 جاري ربط الشركات بالمجموعة...</p>
              <span style={{ fontSize:13, color:C.primary, fontWeight:600 }}>
                {linkCurrent+1} / {selected.size}
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ background:"#F1F5F9", borderRadius:8, height:10, overflow:"hidden", marginBottom:4 }}>
              <div style={{ height:"100%", background:"linear-gradient(90deg,#2563EB,#0D9488)", borderRadius:8, transition:"width 0.4s ease", width:`${Math.round(((linkCurrent)/(selected.size||1))*100)}%` }}/>
            </div>
            <p style={{ fontSize:11, color:C.muted, margin:0 }}>{Math.round(((linkCurrent)/(selected.size||1))*100)}% مكتمل</p>
          </div>

          {/* Live log terminal */}
          <div style={{ background:"#0F172A", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#EF4444" }}/>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#F59E0B" }}/>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#10B981" }}/>
              </div>
              <span style={{ fontSize:11, color:"#64748B", fontFamily:"monospace" }}>cfo-system — عمليات الربط</span>
            </div>
            <div style={{ padding:"14px 16px", maxHeight:280, overflowY:"auto", display:"flex", flexDirection:"column", gap:5 }}>
              {linkProgress.map((item, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:item.error?"#F87171":item.done?"#34D399":"#60A5FA", flexShrink:0 }}>
                    {item.step.startsWith("─")?"":(item.done?(item.error?"✗":"✓"):"⟳")}
                  </span>
                  <span style={{ fontSize:12, color:item.step.startsWith("─")?"#1E3A5F":item.error?"#F87171":item.done?"#E2E8F0":"#94A3B8", fontFamily:"monospace", flex:1 }}>
                    {item.step}
                  </span>
                  {item.done && !item.error && !item.step.startsWith("─") && (
                    <span style={{ fontSize:10, color:"#34D399" }}>✓</span>
                  )}
                </div>
              ))}
              {/* Animated cursor */}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, color:"#2563EB" }}>$</span>
                <span style={{ width:8, height:14, background:"#2563EB", display:"inline-block", animation:"blink 1s step-end infinite" }}/>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step: Done */}
      {step==="done" && (
        <Card style={{ padding:"32px", textAlign:"center", background:"linear-gradient(135deg,#ECFDF5,#F0FDFA)" }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
          <h3 style={{ fontSize:20, fontWeight:800, color:C.green, margin:"0 0 8px" }}>تم الربط بنجاح!</h3>
          <p style={{ color:"#065F46", fontSize:14, margin:"0 0 20px" }}>تم إنشاء وربط {linked.length} شركة من Odoo بالمجموعة القابضة</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10, marginBottom:20, textAlign:"right" }}>
            {linked.map((c:any,i:number)=>(
              <div key={i} style={{ padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.8)", border:"1px solid #A7F3D0" }}>
                <p style={{ fontWeight:700, color:C.green, margin:"0 0 3px", fontSize:13 }}>{c.name}</p>
                <p style={{ color:C.textSec, fontSize:11, margin:0 }}>{c.status==="created"?"✅ تم الإنشاء":"◉ موجودة مسبقاً"}</p>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={()=>{ setStep("list"); refetch(); }} style={{ padding:"10px 22px", borderRadius:10, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>← عرض القائمة</button>
            <button onClick={()=>{ setStep("list"); refetch(); }} style={{ padding:"10px 22px", borderRadius:10, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>ابدأ المزامنة</button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Group Card ─────────────────────────────────────────────────────────────────
function GroupCard({ group, onExpand, expanded, onDelete, onSync, currentUser }:any) {
  const { data:members } = (trpc as any).groups.getMembers.useQuery({ groupId:group.id }, { enabled:expanded });
  const syncMutation = trpc.odoo.syncJournals.useMutation();
  const updateStatus = (trpc as any).groups.updateSyncStatus.useMutation();
  const [syncingId, setSyncingId] = useState<number|null>(null);
  const [syncLog, setSyncLog] = useState<Record<number,string>>({});

  const handleSyncCompany = async (member:any) => {
    setSyncingId(member.company_id);
    setSyncLog(l=>({...l,[member.company_id]:"جاري المزامنة..."}));
    const year = new Date().getFullYear();
    syncMutation.mutate({
      companyId: member.company_id,
      odooCompanyId: member.odoo_company_id,
      dateFrom: `${year}-01-01`,
      dateTo: `${year}-12-31`,
      syncType: "full",
      includeOpeningBalance: true,
    }, {
      onSuccess: (data:any) => {
        setSyncLog(l=>({...l,[member.company_id]:`✅ ${fmt(data.inserted)} قيد + رصيد افتتاحي`}));
        setSyncingId(null);
        updateStatus.mutate({ groupId:group.id, companyId:member.company_id, status:"synced" });
      },
      onError: (err:any) => {
        setSyncLog(l=>({...l,[member.company_id]:`❌ ${err.message}`}));
        setSyncingId(null);
      }
    });
  };

  const handleSyncAll = async () => {
    if (!members?.length) return;
    for (const m of members) {
      await new Promise(resolve => setTimeout(resolve, 500));
      handleSyncCompany(m);
    }
  };

  return (
    <Card style={{ overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:42, height:42, borderRadius:11, background:"linear-gradient(135deg,#2563EB,#0D9488)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏛️</div>
          <div>
            <p style={{ fontWeight:800, color:C.text, margin:0, fontSize:15 }}>{group.name}</p>
            <div style={{ display:"flex", gap:8, marginTop:3 }}>
              {group.is_connected?<Badge label="● متصل بـ Odoo" bg={C.greenLight} color={C.green}/>:<Badge label="○ غير متصل" bg="#F1F5F9" color={C.muted}/>}
              {group.odoo_database && <Badge label={group.odoo_database.slice(0,20)+"..."} bg={C.primaryLight} color={C.primary}/>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {currentUser.role==="cfo_admin" && (
            <>
              <button onClick={()=>onExpand(expanded?null:group.id)} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:expanded?C.primaryLight:"#fff", color:expanded?C.primary:C.textSec, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                {expanded?"▲ إخفاء":"▼ عرض الشركات"}
              </button>
              <button onClick={onDelete} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #FECACA", background:C.redLight, color:C.red, cursor:"pointer", fontSize:12 }}>حذف</button>
            </>
          )}
        </div>
      </div>

      {/* Members */}
      {expanded && (
        <div style={{ borderTop:`1px solid ${C.border}` }}>
          <div style={{ padding:"12px 20px", background:C.bg, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <p style={{ fontWeight:600, fontSize:13, color:C.text, margin:0 }}>الشركات التابعة ({members?.length||0})</p>
            {members?.length>0 && (
              <button onClick={handleSyncAll} disabled={syncingId!==null} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:700 }}>
                🔄 مزامنة جميع الشركات
              </button>
            )}
          </div>
          {!members ? (
            <div style={{ padding:24, textAlign:"center" }}><Spinner/></div>
          ) : members.length===0 ? (
            <div style={{ padding:24, textAlign:"center" }}><p style={{ color:C.muted, fontSize:13 }}>لا توجد شركات — ارجع لإعداد المجموعة</p></div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:C.primaryLight }}>
                  {["الشركة","Odoo ID","القيود","السطور","حالة المزامنة","إجراء"].map(h=>(
                    <th key={h} style={{ padding:"10px 14px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m:any,i:number) => (
                  <tr key={m.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"11px 14px" }}>
                      <p style={{ fontWeight:700, color:C.text, margin:0 }}>{m.company_name}</p>
                      <p style={{ color:C.muted, fontSize:10, margin:0 }}>{m.currency}</p>
                    </td>
                    <td style={{ padding:"11px 14px" }}><Badge label={`#${m.odoo_company_id}`} bg={C.primaryLight} color={C.primary}/></td>
                    <td style={{ padding:"11px 14px", color:C.teal, fontWeight:600 }}>{fmt(m.entry_count||0)}</td>
                    <td style={{ padding:"11px 14px", color:C.textSec }}>{fmt(m.line_count||0)}</td>
                    <td style={{ padding:"11px 14px" }}>
                      {syncLog[m.company_id] ? (
                        <span style={{ fontSize:11, color:syncLog[m.company_id].includes("✅")?C.green:syncLog[m.company_id].includes("❌")?C.red:C.primary }}>{syncLog[m.company_id]}</span>
                      ) : (
                        <Badge label={m.sync_status==="synced"?"✅ مزامن":m.sync_status==="pending"?"⏳ معلق":"◉ "+m.sync_status} bg={m.sync_status==="synced"?C.greenLight:C.amberLight} color={m.sync_status==="synced"?C.green:C.amber}/>
                      )}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={()=>handleSyncCompany(m)} disabled={syncingId===m.company_id} style={{ padding:"5px 12px", borderRadius:7, border:"none", background:syncingId===m.company_id?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                        {syncingId===m.company_id?<><Spinner/>مزامنة...</>:"🔄 مزامنة"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }:{ user:any; onLogout:()=>void }) {
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(true);
  const [exp, setExp] = useState<Record<string,boolean>>(()=>Object.fromEntries(NAV.map(s=>[s.s,true])));
  const { data:companies } = trpc.company.list.useQuery();
  const [companyId, setCompanyId] = useState(0);
  if (!companyId && companies?.length) setCompanyId(companies[0].id);
  const co = companies?.find((c:any)=>c.id===companyId);
  const label = NAV.flatMap(s=>s.items).find(i=>i.id===page)?.label||page;
  const rc = roleLabels[user.role]||roleLabels.custom;

  const renderPage = () => {
    switch(page) {
      case "dashboard":         return <DashboardPage companyId={companyId} co={co}/>;
      case "odoo-wizard":        return <OdooWizardPage companyId={companyId} co={co}/>;

      case "trial-balance":     return <TrialBalancePage companyId={companyId}/>;
      case "income":            return <IncomePage companyId={companyId}/>;
      case "balance-sheet":     return <BalanceSheetPage companyId={companyId}/>;
      case "journal-entries":   return <JournalEntriesPage companyId={companyId}/>;
      case "general-ledger":    return <GeneralLedgerPage companyId={companyId}/>;
      case "partner-statement": return <PartnerStatementPage companyId={companyId}/>;
      case "ratios":            return <RatiosPage companyId={companyId}/>;
      case "monthly":           return <MonthlyPage companyId={companyId}/>;
      case "advisor":           return <AdvisorPage companyId={companyId} co={co}/>;
      case "chatbot":           return <ChatbotPage companyId={companyId} co={co}/>;
      case "users":             return user.role==="cfo_admin"?<UsersPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "holding":           return user.role==="cfo_admin"?<HoldingCompaniesPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "companies":         return user.role==="cfo_admin"?<CompaniesPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "audit-log":         return user.role==="cfo_admin"?<AuditLogPage/>:<NoData text="غير مصرح"/>;
      case "profile":           return <ProfilePage user={user} onLogout={onLogout}/>;
      default:                  return <NoData text="هذه الصفحة قيد التطوير"/>;
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:"'Cairo','Segoe UI',sans-serif", overflow:"hidden" }}>
      <style>{`*{box-sizing:border-box;} ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px;} button,input,select{font-family:inherit;} @keyframes spin{to{transform:rotate(360deg)}} @keyframes bounce{from{transform:translateY(0);opacity:0.4}to{transform:translateY(-4px);opacity:1}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <aside style={{ width:open?256:0, background:C.sidebar, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden", transition:"width 0.22s ease", borderLeft:`1px solid #E8EFFE`, boxShadow:"2px 0 16px rgba(37,99,235,0.06)" }}>
        <div style={{ minWidth:256, display:"flex", flexDirection:"column", height:"100%" }}>
          <div style={{ padding:"16px 14px 12px", borderBottom:`1px solid #E8EFFE` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, direction:"rtl" }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#2563EB,#0D9488)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16, flexShrink:0, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>م</div>
              <div><p style={{ color:C.text, fontWeight:800, fontSize:13, margin:0 }}>المستشار المالي</p><p style={{ color:C.muted, fontSize:9, margin:0 }}>CFO Intelligence v4</p></div>
            </div>
          </div>
          {companies&&companies.length>0&&(
            <div style={{ padding:"10px 12px 8px", borderBottom:`1px solid #E8EFFE` }}>
              <p style={{ color:C.muted, fontSize:9, margin:"0 2px 5px", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>الشركة</p>
              <select value={companyId} onChange={e=>setCompanyId(parseInt(e.target.value))} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.primaryLight, color:C.primary, fontSize:11, cursor:"pointer", direction:"rtl", fontWeight:700 }}>
                {companies.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <nav style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
            {NAV.map(sec=>(
              <div key={sec.s}>
                <button onClick={()=>setExp(p=>({...p,[sec.s]:!p[sec.s]}))} style={{ width:"100%", padding:"5px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"transparent", border:"none", cursor:"pointer", direction:"rtl" }}>
                  <span style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" }}>{sec.s}</span>
                  <span style={{ color:C.muted, fontSize:8 }}>{exp[sec.s]?"▼":"▶"}</span>
                </button>
                {exp[sec.s]&&sec.items.map(item=>(
                  <button key={item.id} onClick={()=>setPage(item.id)} style={{ width:"100%", padding:"8px 10px 8px 14px", display:"flex", alignItems:"center", gap:8, background:page===item.id?C.primaryLight:"transparent", border:"none", borderRight:`3px solid ${page===item.id?C.primary:"transparent"}`, cursor:"pointer", direction:"rtl", transition:"all 0.12s", margin:"1px 0" }}>
                    <span style={{ fontSize:13, width:20, textAlign:"center", flexShrink:0 }}>{item.icon}</span>
                    <span style={{ fontSize:12, color:page===item.id?C.primary:"#64748B", fontWeight:page===item.id?700:500, flex:1 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div onClick={()=>setPage("profile")} style={{ padding:"10px 14px", borderTop:`1px solid #E8EFFE`, direction:"rtl", display:"flex", gap:9, alignItems:"center", cursor:"pointer" }} onMouseEnter={e=>(e.currentTarget.style.background=C.primaryLight)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
            <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${rc.bg},${rc.c}30)`, display:"flex", alignItems:"center", justifyContent:"center", color:rc.c, fontWeight:800, fontSize:14, flexShrink:0 }}>{user.name.charAt(0)}</div>
            <div style={{ flex:1 }}><p style={{ color:C.text, fontSize:12, fontWeight:700, margin:0 }}>{user.name}</p><Badge label={rc.l} bg={rc.bg} color={rc.c}/></div>
          </div>
        </div>
      </aside>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        <header style={{ height:54, background:C.sidebar, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", flexShrink:0, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setOpen(o=>!o)} style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.primaryLight, cursor:"pointer", fontSize:14, color:C.primary, fontWeight:700, lineHeight:1 }}>☰</button>
            <span style={{ fontSize:14, color:C.text, fontWeight:700 }}>{label}</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <Badge label="● مباشر" bg={C.greenLight} color={C.green}/>
            {co && <Badge label={co.name?.slice(0,12)+"..."} bg={C.primaryLight} color={C.primary}/>}
            <button onClick={onLogout} style={{ padding:"5px 12px", borderRadius:8, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:11, fontWeight:600 }}>خروج</button>
          </div>
        </header>
        <main style={{ flex:1, overflowY:"auto", paddingTop:18 }}>{renderPage()}</main>
      </div>
    </div>
  );
}

// ── Journal Entries ────────────────────────────────────────────────────────────
function JournalEntriesPage({ companyId }:any) {
  const [page, setPage] = useState(1);
  const { data } = trpc.journal.listEntries.useQuery({ companyId, page, limit:20 }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  const jColors: Record<string,{bg:string,c:string}> = { مبيعات:{bg:"#EFF6FF",c:"#2563EB"}, بنك:{bg:"#ECFDF5",c:"#059669"}, مشتريات:{bg:"#FFFBEB",c:"#D97706"}, رواتب:{bg:"#F5F3FF",c:"#7C3AED"} };
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="📋 القيود المحاسبية" sub={`${data?.total||0} قيد إجمالي`} />
      {!data?.total ? <NoData/> : (
        <Card>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead><tr style={{ background:C.primaryLight }}>{["رقم القيد","التاريخ","الدفتر","الشريك","مدين","دائن","الحالة"].map(h=><th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
            <tbody>{data?.entries?.map((e:any,i:number)=>{
              const jc = jColors[e.journalName||""]||{bg:"#F8FAFC",c:"#64748B"};
              return <tr key={e.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                <td style={{ padding:"9px 12px", color:C.primary, fontWeight:700, fontFamily:"monospace", fontSize:11 }}>{e.name}</td>
                <td style={{ padding:"9px 12px", color:C.textSec }}>{e.date}</td>
                <td style={{ padding:"9px 12px" }}><Badge label={e.journalName||"—"} bg={jc.bg} color={jc.c}/></td>
                <td style={{ padding:"9px 12px", color:C.text }}>{e.partnerName||"—"}</td>
                <td style={{ padding:"9px 12px", color:C.teal, fontWeight:600 }}>{fmt(e.totalDebit)}</td>
                <td style={{ padding:"9px 12px", color:C.red, fontWeight:600 }}>{fmt(e.totalCredit)}</td>
                <td style={{ padding:"9px 12px" }}><Badge label={e.state} bg={C.greenLight} color={C.green}/></td>
              </tr>;
            })}</tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:"#F8FAFF" }}>
            <span style={{ fontSize:11, color:C.muted }}>صفحة {data?.page} من {data?.pages}</span>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:11 }}>←</button>
              <button onClick={()=>setPage(p=>Math.min(data?.pages||1,p+1))} disabled={page===data?.pages} style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:11 }}>→</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

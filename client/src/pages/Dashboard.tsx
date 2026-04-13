import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";

// ── Theme System (Light + Dark Mode) ─────────────────────────────────────────
const THEMES = {
  light: { bg:"#F8FAFF", sidebar:"#FFFFFF", surface:"#FFFFFF", border:"#E2E8F0", primary:"#2563EB", primaryLight:"#EFF6FF", primarySoft:"#DBEAFE", teal:"#0D9488", tealLight:"#F0FDFA", green:"#059669", greenLight:"#ECFDF5", red:"#DC2626", redLight:"#FEF2F2", amber:"#D97706", amberLight:"#FFFBEB", purple:"#7C3AED", purpleLight:"#F5F3FF", text:"#1E293B", textSec:"#475569", muted:"#94A3B8" },
  dark:  { bg:"#0F172A", sidebar:"#1E293B", surface:"#1E293B", border:"#334155", primary:"#60A5FA", primaryLight:"#1E3A5F", primarySoft:"#1E40AF", teal:"#2DD4BF", tealLight:"#0F3D38", green:"#34D399", greenLight:"#064E3B", red:"#F87171", redLight:"#450A0A", amber:"#FBB80A", amberLight:"#422006", purple:"#A78BFA", purpleLight:"#2E1065", text:"#F1F5F9", textSec:"#94A3B8", muted:"#64748B" },
};
let C = THEMES.light;
const fmt = (n:number) => new Intl.NumberFormat("ar").format(Math.round(n));
const fmtM = (n:number) => n>=1000000?`${(n/1000000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(0)}K`:fmt(n);
const ARMonths = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const roleLabels: Record<string,{l:string,bg:string,c:string}> = {
  cfo_admin:{l:"CFO Admin",bg:"#EFF6FF",c:"#2563EB"},manager:{l:"مدير",bg:"#ECFDF5",c:"#059669"},
  accountant:{l:"محاسب",bg:"#FFFBEB",c:"#D97706"},auditor:{l:"مدقق",bg:"#F5F3FF",c:"#7C3AED"},
  partner:{l:"شريك",bg:"#FDF2F8",c:"#DB2777"},custom:{l:"مخصص",bg:"#F8FAFC",c:"#64748B"},
};
const NAV = [
  { s:"الرئيسية",         items:[
    {id:"dashboard",       label:"لوحة التحكم",           icon:"📊"},
  ]},
  { s:"ربط Odoo",         items:[
    {id:"odoo-wizard",     label:"إعداد وربط + مزامنة",   icon:"🔗"},
  ]},
  { s:"الدفاتر",          items:[
    {id:"journal-entries", label:"القيود المحاسبية",      icon:"📋"},
    {id:"general-ledger",  label:"دفتر الأستاذ العام",    icon:"📒"},
    {id:"partner-statement",label:"كشف حساب شريك",        icon:"👤"},
    {id:"daily-sales",     label:"مبيعات مراكز التكلفة",  icon:"📊"},
  ]},
  { s:"القوائم المالية",  items:[
    {id:"trial-balance",   label:"ميزان المراجعة",        icon:"⚖️"},
    {id:"income",          label:"قائمة الدخل",           icon:"📈"},
    {id:"balance-sheet",   label:"الميزانية العمومية",    icon:"🏦"},
    {id:"cashflow",        label:"التدفقات النقدية",      icon:"💧"},
  ]},
  { s:"التحليل المالي",   items:[
    {id:"executive",       label:"لوحة الأداء التنفيذية", icon:"🎯"},
    {id:"ratios",          label:"النسب المالية",          icon:"📉"},
    {id:"monthly-detail",  label:"تحليل شهري تفصيلي",    icon:"📅"},
    {id:"costs",           label:"تحليل التكاليف",        icon:"🔍"},
    {id:"compare",         label:"مقارنة الفترات",        icon:"🔄"},
    {id:"analytic",        label:"المراكز التحليلية",     icon:"🎯"},
  ]},
  { s:"مقارنة الشركات",  items:[
    {id:"multi-company",   label:"مقارنة الشركات",        icon:"🏢"},
    {id:"monthly",         label:"أداء شهري للشركات",     icon:"📅"},
  ]},
  { s:"الذكاء AI",        items:[
    {id:"advisor",         label:"المستشار AI",            icon:"🤖"},
    {id:"chatbot",         label:"شات بوت مالي",          icon:"💬"},
    {id:"export",          label:"تصدير التقارير",         icon:"📤"},
  ]},
  { s:"الإدارة",          items:[
    {id:"holding",         label:"الشركات القابضة",       icon:"🏛️"},
    {id:"users",           label:"المستخدمون",             icon:"👥"},
    {id:"companies",       label:"الشركات",                icon:"🏢"},
    {id:"diagnostics",     label:"تشخيص البيانات",        icon:"🔬"},
    {id:"audit-log",       label:"سجل النشاط",             icon:"🔍"},
  ]},
];

// ── Shared Components ──────────────────────────────────────────────────────────
const Card = ({ children, style={} }:any) => <div style={{ background:C.sidebar, borderRadius:14, border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)", ...style }}>{children}</div>;
const PageTitle = ({ title, sub="" }:any) => <div style={{ marginBottom:18 }}><h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>{title}</h2>{sub && <p style={{ color:C.muted, fontSize:12, margin:"3px 0 0" }}>{sub}</p>}</div>;
const Badge = ({ label, bg, color }:any) => <span style={{ padding:"2px 10px", borderRadius:20, background:bg, color, fontSize:10, fontWeight:700 }}>{label}</span>;
const Spinner = () => <div style={{ width:16, height:16, border:"2px solid rgba(37,99,235,0.2)", borderTopColor:C.primary, borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>;
const NoData = ({ text="لا توجد بيانات — قم بمزامنة Odoo أولاً" }:any) => <div style={{ padding:60, textAlign:"center", direction:"rtl" }}><div style={{ fontSize:40, marginBottom:12 }}>📭</div><p style={{ color:C.muted, fontSize:13 }}>{text}</p></div>;

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashboardPage({ companyId, co, onNavigate }:any) {
  const { data:sync } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId, refetchInterval:5000 });
  const year = new Date().getFullYear();
  const hasData = (sync?.totalLines||0) > 0;
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${year}-01-01`, dateTo:`${year}-12-31` }, { enabled:!!companyId && hasData });

  const kpis = [
    { l:"إجمالي الإيرادات",  v:fmtM(income?.revenue||0),  icon:"💰", bg:C.primaryLight, c:C.primary },
    { l:"صافي الربح",        v:fmtM(income?.netProfit||0), icon:"📈", bg:C.greenLight,   c:C.green },
    { l:"القيود المحاسبية",  v:fmt(sync?.totalEntries||0), icon:"📋", bg:C.tealLight,    c:C.teal },
    { l:"سطور القيود",       v:fmt(sync?.totalLines||0),   icon:"📄", bg:C.amberLight,   c:C.amber },
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
      ) : !hasData ? (
        <Card style={{ background:"linear-gradient(135deg,#EFF6FF,#F0FDFA)", padding:"28px 24px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔗</div>
          <p style={{ color:C.primary, fontWeight:700, margin:"0 0 6px", fontSize:16 }}>
            {(sync?.totalEntries||0)>0 ? "⚠️ القيود موجودة لكن السطور فارغة" : "لا توجد بيانات بعد"}
          </p>
          <p style={{ color:C.textSec, fontSize:13, margin:"0 0 6px" }}>
            القيود: {fmt(sync?.totalEntries||0)} | السطور: {fmt(sync?.totalLines||0)}
          </p>
          <p style={{ color:C.textSec, fontSize:13, margin:"0 0 16px" }}>
            {(sync?.totalEntries||0)>0 ? "أعد المزامنة بنوع كاملة وتأكد من اختيار الشركة الصحيحة في Odoo" : "اذهب لصفحة ربط Odoo وابدأ المزامنة"}
          </p>
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <button onClick={()=>onNavigate&&onNavigate("odoo-wizard")} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>🔗 ربط Odoo + مزامنة</button>
            <button onClick={()=>onNavigate&&onNavigate("diagnostics")} style={{ padding:"9px 16px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>🔬 تشخيص</button>
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
type WizardStep = "list"|"create"|"odoo"|"discover"|"select"|"link"|"sync";

function OdooWizardPage({ companyId, co }:any) {
  const [step,         setStep]         = useState<WizardStep>("list");
  const [activeGroup,  setActiveGroup]  = useState<any>(null);
  const [newName,      setNewName]      = useState("");
  const [odooForm,     setOdooForm]     = useState({
    url:"https://onesolutionc-roma.odoo.com",
    database:"onesolutionc-roma-main-17095422",
    username:"admin@admin.com", password:"KMM9999"
  });
  const [discovered,  setDiscovered]   = useState<any[]>([]);
  const [selected,    setSelected]     = useState<Set<number>>(new Set());
  const [syncItems,   setSyncItems]    = useState<any[]>([]);
  const [linkLog,     setLinkLog]      = useState<{msg:string,type:string}[]>([]);
  const [linkPct,     setLinkPct]      = useState(0);
  const [linking,     setLinking]      = useState(false);
  const [dateFrom,    setDateFrom]     = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo,      setDateTo]       = useState(`${new Date().getFullYear()}-12-31`);
  const [syncType,    setSyncType]     = useState("full");
  const [incOpening,  setIncOpening]   = useState(true);
  const [error,       setError]        = useState("");
  const linkLogRef = useRef<HTMLDivElement>(null);

  const { data:groups, refetch:rGroups } = (trpc as any).groups.list.useQuery();
  const createGroup  = (trpc as any).groups.create.useMutation();
  const saveOdoo     = (trpc as any).groups.saveOdooConfig.useMutation();
  const testDiscover = (trpc as any).groups.testAndDiscover.useMutation();
  const linkSingle   = (trpc as any).groups.linkSingleCompany.useMutation();

  useEffect(()=>{ linkLogRef.current?.scrollTo(0,linkLogRef.current.scrollHeight); },[linkLog]);
  const addLog = (msg:string,type="info") => setLinkLog(l=>[...l,{msg,type}]);
  const toggle = (id:number) => setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });

  // ── اختيار مجموعة موجودة → تحميل الأعضاء مباشرة للمزامنة ──────────────
  const pickGroup = async (g:any) => {
    setActiveGroup(g);
    setError("");
    setOdooForm({ url:g.odoo_url||"", database:g.odoo_database||"", username:g.odoo_username||"", password:g.odoo_password||"" });

    if (g.is_connected) {
      try {
        const res = await fetch(`/trpc/groups.getMembers?input=${encodeURIComponent(JSON.stringify({json:{groupId:g.id}}))}`, {
          headers:{ Authorization:`Bearer ${localStorage.getItem("cfo_token")||""}` }
        });
        const data = await res.json();
        const members = data?.result?.data || data?.result || [];
        if (members.length > 0) {
          setSyncItems(members.map((m:any)=>({ companyId:m.company_id, name:m.company_name||m.odoo_company_name, odooId:m.odoo_company_id, currency:m.currency||"KWD" })));
          setStep("sync");
          return;
        }
      } catch {}
    }
    setStep("odoo");
  };

  // ── إنشاء مجموعة ─────────────────────────────────────────────────────────
  const createAndNext = () => {
    if (!newName.trim()) return;
    setError("");
    createGroup.mutate({ name:newName.trim(), baseCurrency:"KWD" }, {
      onSuccess:(g:any)=>{ setActiveGroup(g); setNewName(""); rGroups(); setStep("odoo"); },
      onError:(e:any)=>setError(e.message)
    });
  };

  // ── حفظ Odoo ─────────────────────────────────────────────────────────────
  const saveAndDiscover = async () => {
    setError("");
    try {
      await saveOdoo.mutateAsync({ groupId:activeGroup.id, ...odooForm });
      setStep("discover");
    } catch(e:any) { setError(e.message); }
  };

  // ── اكتشاف الشركات ────────────────────────────────────────────────────────
  const discover = () => {
    setError(""); setDiscovered([]);
    testDiscover.mutate({ groupId:activeGroup.id }, {
      onSuccess:(d:any)=>{ setDiscovered(d.companies||[]); setStep("select"); },
      onError:(e:any)=>setError(e.message)
    });
  };

  // ── ربط الشركات ──────────────────────────────────────────────────────────
  const doLink = async () => {
    const toLink = discovered.filter((c:any)=>selected.has(c.id));
    if (!toLink.length || !activeGroup) return;
    setStep("link"); setLinking(true); setLinkLog([]); setLinkPct(0);
    const results:any[] = [];

    for (let i=0; i<toLink.length; i++) {
      const c = toLink[i];
      const pct = Math.round((i/toLink.length)*100);
      addLog(`─── ${i+1}/${toLink.length}: ${c.name} ───`,"sep");
      setLinkPct(pct+5);  await new Promise(r=>setTimeout(r,200));
      addLog(`📝 إنشاء سجل الشركة...`); setLinkPct(pct+15); await new Promise(r=>setTimeout(r,200));
      addLog(`🔑 إعطاء صلاحيات المستخدم`); setLinkPct(pct+25); await new Promise(r=>setTimeout(r,200));
      addLog(`🔗 نسخ إعدادات Odoo (ID: ${c.id})`); setLinkPct(pct+35); await new Promise(r=>setTimeout(r,200));
      try {
        const res = await linkSingle.mutateAsync({ groupId:activeGroup.id, odooId:c.id, name:c.name, currency:c.currency||"KWD" });
        addLog(`✅ ${c.name} — ${res.status==="created"?"تم الإنشاء":"موجودة مسبقاً"}`,"success");
        results.push({ companyId:res.companyId, name:c.name, odooId:c.id, status:res.status });
      } catch(e:any) {
        addLog(`❌ خطأ: ${e.message}`,"error");
        results.push({ name:c.name, status:"error" });
      }
      setLinkPct(Math.round(((i+1)/toLink.length)*100));
    }

    addLog(`─────────────────────────────────────`,"sep");
    addLog(`🎉 اكتمل — ${results.filter(r=>r.status==="created").length} شركة جديدة`,"success");
    setLinking(false);
    setSyncItems(results.filter(r=>r.companyId));
    rGroups();
  };

  // ── شريط الخطوات ─────────────────────────────────────────────────────────
  const STEPS = [
    {id:"list",    icon:"🏛️", label:"الشركة القابضة"},
    {id:"create",  icon:"✨", label:"الشركة القابضة"},
    {id:"odoo",    icon:"🔌", label:"بيانات Odoo"},
    {id:"discover",icon:"🔍", label:"اكتشاف"},
    {id:"select",  icon:"☑️", label:"اختيار الشركات"},
    {id:"link",    icon:"🔗", label:"ربط وإنشاء"},
    {id:"sync",    icon:"🔄", label:"مزامنة البيانات"},
  ];
  const visibleSteps = ["odoo","discover","select","link","sync"];
  const stepIdx = visibleSteps.indexOf(step);

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="🔗 إعداد Odoo والمزامنة" sub="إدارة الشركات القابضة + استيراد البيانات المحاسبية"/>

      {/* ── شريط الخطوات (يظهر بعد اختيار المجموعة) ── */}
      {!["list","create"].includes(step) && (
        <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:18, padding:"12px 18px", background:C.sidebar, borderRadius:12, border:`1px solid ${C.border}`, overflowX:"auto" }}>
          {visibleSteps.map((s,i)=>{
            const done=i<stepIdx, cur=s===step;
            const icons:Record<string,string> = { odoo:"🔌", discover:"🔍", select:"☑️", link:"🔗", sync:"🔄" };
            const labels:Record<string,string> = { odoo:"بيانات Odoo", discover:"اكتشاف", select:"اختيار", link:"ربط", sync:"مزامنة" };
            return (
              <div key={s} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?11:14,fontWeight:700,
                    background:done?C.teal:cur?C.primary:"#F1F5F9",
                    color:done||cur?"#fff":C.muted,
                    boxShadow:cur?`0 0 0 3px ${C.primarySoft}`:"none",transition:"all 0.25s" }}>
                    {done?"✓":icons[s]}
                  </div>
                  <span style={{ fontSize:9,color:done?C.teal:cur?C.primary:C.muted,fontWeight:done||cur?700:400,whiteSpace:"nowrap" }}>{labels[s]}</span>
                </div>
                {i<visibleSteps.length-1 && <div style={{ width:32,height:2,background:done?C.teal:C.border,margin:"0 3px",marginBottom:14,borderRadius:1,flexShrink:0 }}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* الشركة النشطة */}
      {activeGroup && !["list","create"].includes(step) && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 14px", borderRadius:9, background:C.greenLight, border:`1px solid #A7F3D0`, marginBottom:12 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:18 }}>🏛️</span>
            <div>
              <p style={{ color:C.green, fontWeight:800, margin:0, fontSize:13 }}>{activeGroup.name}</p>
              <p style={{ color:"#065F46", fontSize:11, margin:0 }}>{activeGroup.odoo_url||odooForm.url}</p>
            </div>
          </div>
          <button onClick={()=>{ setActiveGroup(null); setStep("list"); setSyncItems([]); setDiscovered([]); setSelected(new Set()); }}
            style={{ padding:"3px 10px", borderRadius:6, border:`1px solid #A7F3D0`, background:"rgba(255,255,255,0.7)", color:C.green, cursor:"pointer", fontSize:11 }}>
            تغيير ←
          </button>
        </div>
      )}

      {error && <div style={{ padding:"10px 14px", borderRadius:8, background:C.redLight, border:`1px solid #FECACA`, color:C.red, fontSize:12, marginBottom:12 }}>⚠️ {error}</div>}

      {/* ══ الشاشة الرئيسية — قائمة الشركات القابضة ══════════════════════════ */}
      {step==="list" && (
        <div>
          {/* مجموعات موجودة */}
          {groups?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 10px" }}>🏛️ شركاتك القابضة المرتبطة بـ Odoo</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {groups.map((g:any) => (
                  <div key={g.id} style={{ background:C.sidebar, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
                    {/* Header */}
                    <div style={{ padding:"16px 20px", display:"flex", gap:14, alignItems:"center" }}>
                      <div style={{ width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#EFF6FF,#F0FDFA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0 }}>🏛️</div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontWeight:800, color:C.text, margin:"0 0 4px", fontSize:15 }}>{g.name}</p>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          {g.is_connected
                            ? <Badge label="✅ متصل بـ Odoo" bg={C.greenLight} color={C.green}/>
                            : <Badge label="○ غير متصل" bg="#F1F5F9" color={C.muted}/>}
                          {g.odoo_url && <span style={{ fontSize:11, color:C.muted }}>{g.odoo_url.replace("https://","")}</span>}
                          {g.odoo_database && <Badge label={g.odoo_database.slice(0,28)+(g.odoo_database.length>28?"...":"")} bg={C.primaryLight} color={C.primary}/>}
                          {g.odoo_version && <Badge label={`Odoo ${g.odoo_version}`} bg={C.purpleLight} color={C.purple}/>}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        {g.is_connected ? (
                          <button onClick={()=>pickGroup(g)}
                            style={{ padding:"9px 20px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.2)" }}>
                            🔄 عرض الشركات والمزامنة
                          </button>
                        ) : (
                          <button onClick={()=>{ setActiveGroup(g); setStep("odoo"); setOdooForm({url:g.odoo_url||"",database:g.odoo_database||"",username:g.odoo_username||"",password:g.odoo_password||""}); }}
                            style={{ padding:"9px 18px", borderRadius:9, border:`1px solid ${C.primary}`, background:C.primaryLight, color:C.primary, cursor:"pointer", fontSize:13, fontWeight:700 }}>
                            ⚙️ إعداد Odoo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* إنشاء مجموعة جديدة */}
          <Card style={{ padding:"20px 22px" }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 4px" }}>
              {groups?.length > 0 ? "➕ إضافة شركة قابضة جديدة" : "🏛️ إنشاء شركة قابضة جديدة"}
            </p>
            <p style={{ color:C.textSec, fontSize:12, margin:"0 0 14px", lineHeight:1.6 }}>
              الشركة القابضة تجمع عدة شركات من قاعدة بيانات Odoo واحدة وتدير مزامنة بياناتها المحاسبية دفعة واحدة
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="اسم الشركة القابضة (مثال: مجموعة روما القابضة)"
                onKeyDown={e=>e.key==="Enter"&&createAndNext()}
                style={{ flex:1, padding:"10px 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13, outline:"none" }}/>
              <button onClick={createAndNext} disabled={!newName.trim()||createGroup.isPending}
                style={{ padding:"10px 22px", borderRadius:9, border:"none", background:!newName.trim()?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, whiteSpace:"nowrap" }}>
                {createGroup.isPending?"جاري...":"إنشاء ←"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ══ STEP: Odoo Config ═════════════════════════════════════════════════ */}
      {step==="odoo" && (
        <Card style={{ padding:"24px" }}>
          <p style={{ fontWeight:800, fontSize:15, color:C.text, margin:"0 0 4px" }}>🔌 بيانات الاتصال بـ Odoo</p>
          <p style={{ color:C.textSec, fontSize:12, margin:"0 0 16px" }}>أدخل بيانات الخادم لاكتشاف الشركات داخل قاعدة البيانات</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {([
              ["رابط الخادم (URL)","url","text","https://"],
              ["اسم قاعدة البيانات","database","text","mydb"],
              ["اسم المستخدم","username","email","admin"],
              ["كلمة المرور","password","password","•••"],
            ] as [string,string,string,string][]).map(([l,k,t,ph])=>(
              <div key={k}>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>{l}</label>
                <input type={t} value={(odooForm as any)[k]} onChange={e=>setOdooForm((f:any)=>({...f,[k]:e.target.value}))} placeholder={ph}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none", direction:"ltr", textAlign:"left", boxSizing:"border-box" as any }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={saveAndDiscover} disabled={saveOdoo.isPending}
              style={{ padding:"11px 28px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
              {saveOdoo.isPending?"جاري الحفظ...":"حفظ والمتابعة ←"}
            </button>
            <button onClick={()=>setStep("list")} style={{ padding:"11px 16px", borderRadius:10, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>← رجوع</button>
          </div>
        </Card>
      )}

      {/* ══ STEP: Discover ════════════════════════════════════════════════════ */}
      {step==="discover" && (
        <Card style={{ padding:"44px 24px", textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:14 }}>🔍</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, margin:"0 0 8px" }}>اكتشاف الشركات في Odoo</h3>
          <p style={{ color:C.textSec, fontSize:14, margin:"0 0 6px" }}>سيتصل النظام بـ Odoo ويقرأ جميع الشركات في قاعدة البيانات</p>
          <p style={{ color:C.muted, fontSize:12, margin:"0 0 24px" }}>{odooForm.url}</p>

          {testDiscover.isPending ? (
            <div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", alignItems:"center", marginBottom:16 }}>
                <div style={{ width:22,height:22,border:`3px solid ${C.primaryLight}`,borderTopColor:C.primary,borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/>
                <span style={{ fontSize:14, color:C.primary, fontWeight:600 }}>جاري الاتصال وقراءة الشركات...</span>
              </div>
              <div style={{ background:"#F1F5F9",borderRadius:8,height:6,maxWidth:280,margin:"0 auto",overflow:"hidden" }}>
                <div style={{ width:"65%",height:"100%",background:`linear-gradient(90deg,${C.primary},${C.teal})`,borderRadius:8 }}/>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={discover} style={{ padding:"14px 40px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:15, fontWeight:700, boxShadow:"0 4px 14px rgba(37,99,235,0.3)" }}>
                🔍 اكتشف الشركات الآن
              </button>
              <button onClick={()=>setStep("odoo")} style={{ padding:"14px 16px", borderRadius:12, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>← رجوع</button>
            </div>
          )}
        </Card>
      )}

      {/* ══ STEP: Select ══════════════════════════════════════════════════════ */}
      {step==="select" && (
        <>
          <Card style={{ padding:"12px 18px", marginBottom:12, background:C.greenLight, border:`1px solid #A7F3D0` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <p style={{ fontWeight:700, color:C.green, margin:0, fontSize:14 }}>✅ تم اكتشاف {discovered.length} شركة في قاعدة البيانات</p>
              <Badge label={`${selected.size} مختارة`} bg="rgba(255,255,255,0.8)" color={C.green}/>
            </div>
          </Card>

          <Card style={{ padding:"18px 20px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:0 }}>🏢 اختر الشركات التي تريد استيراد بياناتها</p>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setSelected(new Set(discovered.map((c:any)=>c.id)))} style={{ padding:"5px 14px", borderRadius:7, border:`1px solid ${C.primary}`, background:C.primaryLight, color:C.primary, cursor:"pointer", fontSize:12, fontWeight:600 }}>تحديد الكل</button>
                <button onClick={()=>setSelected(new Set())} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء الكل</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
              {discovered.map((c:any)=>(
                <div key={c.id} onClick={()=>toggle(c.id)}
                  style={{ padding:"14px 16px", borderRadius:11, border:`2px solid ${selected.has(c.id)?C.primary:C.border}`, background:selected.has(c.id)?C.primaryLight:"#fff", cursor:"pointer", transition:"all 0.12s", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:700, color:selected.has(c.id)?C.primary:C.text, margin:"0 0 5px", fontSize:13 }}>{c.name}</p>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {c.currency&&<Badge label={c.currency} bg={selected.has(c.id)?C.primarySoft:"#F1F5F9"} color={selected.has(c.id)?C.primary:C.textSec}/>}
                      {c.city&&<span style={{ fontSize:10, color:C.muted }}>📍{c.city}</span>}
                      <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>#{c.id}</span>
                    </div>
                    {c.vat&&<p style={{ fontSize:10, color:C.muted, margin:"4px 0 0" }}>رقم ضريبي: {c.vat}</p>}
                  </div>
                  <div style={{ width:22,height:22,borderRadius:5,border:`2px solid ${selected.has(c.id)?C.primary:C.muted}`,background:selected.has(c.id)?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:4 }}>
                    {selected.has(c.id)&&<span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={()=>setStep("discover")} style={{ padding:"10px 18px", borderRadius:9, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:13 }}>← رجوع</button>
            <button onClick={doLink} disabled={selected.size===0}
              style={{ padding:"11px 28px", borderRadius:10, border:"none", background:selected.size===0?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:selected.size===0?"default":"pointer", fontSize:14, fontWeight:700, boxShadow:selected.size>0?"0 2px 8px rgba(37,99,235,0.3)":"none" }}>
              🔗 ربط وإنشاء {selected.size} شركة →
            </button>
          </div>
        </>
      )}

      {/* ══ STEP: Link Progress ═══════════════════════════════════════════════ */}
      {step==="link" && (
        <Card style={{ padding:"24px" }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <p style={{ fontWeight:800, fontSize:15, color:C.text, margin:0 }}>{linking?"🔗 جاري ربط الشركات...":"✅ اكتمل الربط!"}</p>
              <span style={{ fontSize:13, color:linking?C.primary:C.green, fontWeight:700 }}>{linkPct}%</span>
            </div>
            <div style={{ background:"#F1F5F9", borderRadius:8, height:10, overflow:"hidden" }}>
              <div style={{ width:`${linkPct}%`,height:"100%",background:linking?"linear-gradient(90deg,#2563EB,#0D9488)":"linear-gradient(90deg,#059669,#0D9488)",borderRadius:8,transition:"width 0.4s ease" }}/>
            </div>
          </div>

          <div style={{ background:"#0F172A", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
            <div style={{ padding:"9px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:8 }}>
              {["#EF4444","#F59E0B","#10B981"].map(c=><div key={c} style={{ width:9,height:9,borderRadius:"50%",background:c }}/>)}
              <span style={{ fontSize:11, color:"#64748B", fontFamily:"monospace", marginRight:"auto" }}>cfo-system — ربط الشركات</span>
            </div>
            <div ref={linkLogRef} style={{ padding:"12px 14px", maxHeight:220, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
              {linkLog.map((l,i)=>(
                <p key={i} style={{ fontSize:11, margin:0, fontFamily:"monospace",
                  color:l.type==="sep"?"#1E3A5F":l.type==="success"?"#34D399":l.type==="error"?"#F87171":"#94A3B8" }}>{l.msg}</p>
              ))}
              {linking&&<span style={{ fontSize:11,color:"#2563EB" }}>$ <span style={{ animation:"blink 1s step-end infinite",display:"inline-block",width:7,height:13,background:"#2563EB",verticalAlign:"middle" }}/></span>}
            </div>
          </div>

          {!linking && syncItems.length > 0 && (
            <button onClick={()=>setStep("sync")} style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
              🔄 المتابعة إلى مزامنة البيانات ←
            </button>
          )}
        </Card>
      )}

      {/* ══ STEP: Sync ════════════════════════════════════════════════════════ */}
      {step==="sync" && (
        <>
          {/* إعدادات المزامنة */}
          <Card style={{ padding:"16px 20px", marginBottom:14 }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 12px" }}>⚙️ إعدادات المزامنة — تنطبق على جميع الشركات</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:3, fontWeight:600 }}>نوع المزامنة</label>
                <select value={syncType} onChange={e=>setSyncType(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
                  <option value="full">كاملة — من الصفر (موصى به)</option>
                  <option value="incremental">تزايدية — الجديد فقط</option>
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:3, fontWeight:600 }}>من تاريخ</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:3, fontWeight:600 }}>إلى تاريخ</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
              </div>
            </div>
            <label onClick={()=>setIncOpening(o=>!o)} style={{ display:"flex", gap:9, alignItems:"center", cursor:"pointer", marginTop:10, padding:"9px 12px", borderRadius:8, background:incOpening?C.primaryLight:C.bg, border:`1px solid ${incOpening?C.primary:C.border}` }}>
              <div style={{ width:16,height:16,borderRadius:3,border:`2px solid ${incOpening?C.primary:C.muted}`,background:incOpening?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                {incOpening&&<span style={{ color:"#fff",fontSize:10,fontWeight:800 }}>✓</span>}
              </div>
              <span style={{ fontSize:12, color:incOpening?C.primary:C.text, fontWeight:600 }}>تضمين الرصيد الافتتاحي — ضروري لصحة ميزان المراجعة 6 أعمدة</span>
            </label>
          </Card>

          {/* بطاقات الشركات */}
          {syncItems.length === 0 ? (
            <Card style={{ padding:"32px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>⚠️</div>
              <p style={{ color:C.textSec, fontSize:14, fontWeight:600, margin:"0 0 14px" }}>لا توجد شركات مرتبطة بعد</p>
              <button onClick={()=>setStep("discover")} style={{ padding:"9px 22px", borderRadius:9, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>← اكتشف الشركات</button>
            </Card>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {syncItems.map((item:any)=>(
                <SyncCard key={item.companyId||item.name} item={item} dateFrom={dateFrom} dateTo={dateTo} syncType={syncType} incOpening={incOpening}/>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}



// ── SyncCard: بطاقة مزامنة لكل شركة ──────────────────────────────────────────
function SyncCard({ item, dateFrom, dateTo, syncType, incOpening }:any) {
  const { data:status, refetch } = trpc.journal.syncStatus.useQuery({ companyId:item.companyId }, { enabled:!!item.companyId });
  const [log, setLog]   = useState<{msg:string,type:string}[]>([]);
  const [pct, setPct]   = useState(0);
  const [busy,setBusy]  = useState(false);
  const [done,setDone]  = useState(false);
  const [res, setRes]   = useState<any>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const syncMut = trpc.odoo.syncJournals.useMutation();

  useEffect(()=>{ logRef.current?.scrollTo(0,logRef.current.scrollHeight); },[log]);
  const add = (msg:string,type="info") => setLog(l=>[...l,{msg:`[${new Date().toLocaleTimeString("ar")}] ${msg}`,type}]);

  const fullSyncMut = (trpc as any).odoo.fullSync.useMutation();

  const doSync = async () => {
    if (!item.companyId || !item.odooId) return;
    setBusy(true); setDone(false); setLog([]); setPct(0); setRes(null);
    add("🔗 بدء المزامنة في الخلفية...");

    try {
      // Start background job
      const startRes = await fetch("/bg-sync/start", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          companyId:   item.companyId,
          odooCompanyId: item.odooId,
          dateFrom:    item.dateFrom || "2020-01-01",
          dateTo:      item.dateTo   || new Date().toISOString().split("T")[0],
        })
      });
      const { jobId } = await startRes.json();
      add(`✅ بدأت المزامنة (job: ${jobId})`);
      add("⏳ جاري معالجة البيانات — قد تستغرق 15-30 دقيقة للقيود الكثيرة...");

      // Poll every 3 seconds
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`/bg-sync/status/${jobId}`);
          const status = await statusRes.json();
          if (!status.found) { clearInterval(poll); return; }

          // Update logs with new messages
          if (status.logs?.length > 0) {
            const lastMsg = status.logs[status.logs.length - 1];
            setLog(prev => {
              if (prev.length > 0 && prev[prev.length-1].msg === lastMsg) return prev;
              return [...prev.slice(-50), {msg:lastMsg, type:"info"}];
            });
          }

          if (status.progress > 0) setPct(status.progress);

          if (status.done) {
            clearInterval(poll);
            setBusy(false);
            setDone(true);
            if (status.error) {
              add("❌ " + status.error, "error");
            } else {
              add("✅ اكتملت المزامنة بنجاح!", "success");
              setPct(100);
            }
          }
        } catch(e) { console.error("poll error", e); }
      }, 3000);

      // Stop polling after 2 hours max
      setTimeout(() => clearInterval(poll), 2 * 60 * 60 * 1000);

    } catch(e:any) {
      add("❌ " + e.message, "error");
      setBusy(false);
    }
  };

  return (
    <Card style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 18px", display:"flex", gap:12, alignItems:"center", borderBottom:log.length>0?`1px solid ${C.border}`:"none" }}>
        <div style={{ width:42,height:42,borderRadius:11,background:"linear-gradient(135deg,#EFF6FF,#F0FDFA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>🏢</div>
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:800, color:C.text, margin:"0 0 4px", fontSize:14 }}>{item.name}</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Badge label={`Odoo ID: ${item.odooId}`} bg={C.primaryLight} color={C.primary}/>
            {status?.totalEntries ? <Badge label={`${fmt(status.totalEntries)} قيد`} bg={C.greenLight} color={C.green}/> : <Badge label="لا توجد بيانات" bg="#F1F5F9" color={C.muted}/>}
            {done && <Badge label="✅ مزامن" bg={C.greenLight} color={C.green}/>}
          </div>
        </div>

        {/* Progress inline */}
        {busy && (
          <div style={{ flex:1, maxWidth:160 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:10, color:C.muted }}>جاري...</span>
              <span style={{ fontSize:10, color:C.primary, fontWeight:700 }}>{pct}%</span>
            </div>
            <div style={{ background:"#F1F5F9", borderRadius:4, height:6, overflow:"hidden" }}>
              <div style={{ width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#2563EB,#0D9488)",borderRadius:4,transition:"width 0.5s" }}/>
            </div>
          </div>
        )}
        {done && <Badge label="✓ 100%" bg={C.greenLight} color={C.green}/>}

        <button onClick={doSync} disabled={busy||!item.companyId||!item.odooId}
          style={{ padding:"9px 20px", borderRadius:9, border:"none", background:busy||!item.companyId?"#94A3B8":done?"linear-gradient(135deg,#059669,#0D9488)":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:busy||!item.companyId?"default":"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {busy?<><Spinner/>جاري...</>:done?"🔄 إعادة":"🔄 مزامنة"}
        </button>
      </div>

      {/* Log terminal */}
      {log.length>0 && (
        <div ref={logRef} style={{ padding:"10px 14px", maxHeight:130, overflowY:"auto", background:"#0F172A", display:"flex", flexDirection:"column", gap:3 }}>
          {log.map((l,i)=>(
            <p key={i} style={{ fontSize:10, margin:0, fontFamily:"monospace",
              color:l.type==="success"?"#34D399":l.type==="error"?"#F87171":"#94A3B8" }}>{l.msg}</p>
          ))}
          {busy&&<span style={{ fontSize:11, color:"#60A5FA" }}>$ <span style={{ animation:"blink 1s step-end infinite",display:"inline-block",width:6,height:12,background:"#60A5FA",verticalAlign:"middle" }}/></span>}
        </div>
      )}

      {/* Result */}
      {done && res && (
        <div style={{ padding:"10px 18px", background:C.greenLight, borderTop:`1px solid #A7F3D0`, display:"flex", gap:16 }}>
          {[{l:"القيود المستوردة",v:fmt(res.inserted||0)},{l:"رصيد افتتاحي",v:fmt(res.openingLines||0)+" سطر"},{l:"إجمالي Odoo",v:fmt(res.total||0)}].map((s,i)=>(
            <div key={i}>
              <p style={{ fontSize:10, color:C.textSec, margin:0 }}>{s.l}</p>
              <p style={{ fontSize:14, fontWeight:800, color:C.green, margin:0 }}>{s.v}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}



// ── صفحة التشخيص ─────────────────────────────────────────────────────────────
function DiagnosticsPage({ companyId, co }:any) {
  const { data, refetch, isLoading } = (trpc as any).debug.checkData.useQuery({ companyId }, { enabled:!!companyId });
  const fixDates = (trpc as any).debug.fixDates.useMutation({ onSuccess:()=>refetch() });
  const fixTypes = (trpc as any).debug.fixAccountTypes.useMutation({ onSuccess:()=>refetch() });
  const [fixLog, setFixLog] = useState<string[]>([]);

  const runFix = async () => {
    setFixLog([]);
    setFixLog(l=>[...l,"🔧 إصلاح التواريخ الفارغة..."]);
    const r1 = await fixDates.mutateAsync({ companyId });
    setFixLog(l=>[...l,`✓ تم إصلاح ${r1.fixed} تاريخ`]);
    setFixLog(l=>[...l,"🔧 إصلاح تصنيف الحسابات..."]);
    const r2 = await fixTypes.mutateAsync({ companyId });
    setFixLog(l=>[...l,`✓ تم إصلاح ${r2.fixed} حساب`]);
    setFixLog(l=>[...l,"✅ اكتمل الإصلاح!"]);
    refetch();
  };

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🔬 تشخيص البيانات" sub={co?.name||""}/>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>refetch()} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>🔄 تحديث</button>
          <button onClick={runFix} disabled={fixDates.isPending||fixTypes.isPending} style={{ padding:"7px 16px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#D97706,#92400E)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>🔧 إصلاح تلقائي</button>
        </div>
      </div>

      {isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : !data ? <NoData/> : (
        <>
          {/* Health banner */}
          <Card style={{ padding:"14px 18px", marginBottom:14, background:data.isHealthy?C.greenLight:C.redLight, border:`1px solid ${data.isHealthy?"#A7F3D0":"#FECACA"}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:24 }}>{data.isHealthy?"✅":"⚠️"}</span>
              <div>
                <p style={{ fontWeight:800, color:data.isHealthy?C.green:C.red, margin:0, fontSize:15 }}>
                  {data.isHealthy?"البيانات سليمة — التقارير تعمل بشكل صحيح":"يوجد مشكلة في البيانات — يحتاج إصلاح"}
                </p>
                <p style={{ color:data.isHealthy?"#065F46":"#7F1D1D", fontSize:12, margin:0 }}>
                  {data.journalEntries} قيد | {data.journalLines} سطر | {data.linesWithNoDate} سطر بلا تاريخ | {data.linesWithNoEntry} سطر بلا قيد أب
                </p>
              </div>
            </div>
          </Card>

          {/* Stats grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
            {[
              {l:"القيود المحاسبية",  v:fmt(data.journalEntries),  ok:data.journalEntries>0,    icon:"📋"},
              {l:"سطور القيود",       v:fmt(data.journalLines),    ok:data.journalLines>0,       icon:"📄"},
              {l:"سطور بلا تاريخ",   v:fmt(data.linesWithNoDate), ok:data.linesWithNoDate===0,  icon:"📅"},
              {l:"سطور يتيمة",       v:fmt(data.linesWithNoEntry),ok:data.linesWithNoEntry===0, icon:"🔗"},
            ].map((s,i)=>(
              <Card key={i} style={{ padding:"12px 14px", background:s.ok?C.surface:C.redLight, border:`1px solid ${s.ok?C.border:"#FECACA"}` }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:20 }}>{s.icon}</span>
                  <div>
                    <p style={{ color:C.muted, fontSize:10, margin:0 }}>{s.l}</p>
                    <p style={{ fontSize:18, fontWeight:800, color:s.ok?C.text:C.red, margin:0 }}>{s.v}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Type breakdown */}
          {data.typeBreakdown?.length > 0 && (
            <Card style={{ padding:"16px 20px", marginBottom:14 }}>
              <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 12px" }}>📊 توزيع الحسابات حسب النوع</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:C.primaryLight }}>{["نوع الحساب","عدد السطور","مجموع مدين","مجموع دائن","الحالة"].map(h=><th key={h} style={{ padding:"9px 12px", textAlign:"right", color:C.primary, fontWeight:700, fontSize:11 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.typeBreakdown.map((r:any,i:number)=>{
                    const typeLabels: Record<string,{l:string,ok:boolean}> = {
                      assets:{l:"الأصول",ok:true}, liabilities:{l:"الالتزامات",ok:true},
                      equity:{l:"حقوق الملكية",ok:true}, revenue:{l:"الإيرادات",ok:true},
                      cogs:{l:"تكلفة المبيعات",ok:true}, expenses:{l:"المصروفات",ok:true},
                      other_income:{l:"إيرادات أخرى",ok:true}, other_expenses:{l:"مصروفات أخرى",ok:true},
                      other:{l:"غير مصنّف ⚠️",ok:false},
                    };
                    const tl = typeLabels[r.accountType] || {l:r.accountType||"غير محدد",ok:false};
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                        <td style={{ padding:"9px 12px" }}><Badge label={tl.l} bg={tl.ok?C.greenLight:C.amberLight} color={tl.ok?C.green:C.amber}/></td>
                        <td style={{ padding:"9px 12px", color:C.text, fontWeight:600 }}>{fmt(r.cnt)}</td>
                        <td style={{ padding:"9px 12px", color:C.teal }}>{fmt(r.totalDebit||0)}</td>
                        <td style={{ padding:"9px 12px", color:C.red }}>{fmt(r.totalCredit||0)}</td>
                        <td style={{ padding:"9px 12px" }}><Badge label={tl.ok?"✓ صحيح":"⚠ يحتاج إصلاح"} bg={tl.ok?C.greenLight:C.amberLight} color={tl.ok?C.green:C.amber}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* Sample lines */}
          {data.sampleLines?.length > 0 && (
            <Card style={{ padding:"16px 20px", marginBottom:14 }}>
              <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 12px" }}>🔍 عينة من السطور (أول 5)</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr style={{ background:C.primaryLight }}>{["ID","EntryID","كود الحساب","النوع","مدين","دائن","تاريخ","حالة"].map(h=><th key={h} style={{ padding:"8px 10px", textAlign:"right", color:C.primary, fontWeight:700 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.sampleLines.map((l:any,i:number)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:"7px 10px", color:C.muted, fontFamily:"monospace" }}>{l.id}</td>
                      <td style={{ padding:"7px 10px", color:C.muted, fontFamily:"monospace" }}>{l.entryId}</td>
                      <td style={{ padding:"7px 10px", color:C.text }}>{l.accountCode}</td>
                      <td style={{ padding:"7px 10px" }}><Badge label={l.accountType||"null"} bg={l.accountType&&l.accountType!=="other"?C.greenLight:C.amberLight} color={l.accountType&&l.accountType!=="other"?C.green:C.amber}/></td>
                      <td style={{ padding:"7px 10px", color:C.teal }}>{fmt(l.debit||0)}</td>
                      <td style={{ padding:"7px 10px", color:C.red }}>{fmt(l.credit||0)}</td>
                      <td style={{ padding:"7px 10px", color:l.date?C.text:C.red, fontFamily:"monospace" }}>{l.date||"⚠ فارغ"}</td>
                      <td style={{ padding:"7px 10px" }}><Badge label={l.date&&l.accountType&&l.accountType!=="other"?"✓":"⚠"} bg={l.date&&l.accountType&&l.accountType!=="other"?C.greenLight:C.redLight} color={l.date&&l.accountType&&l.accountType!=="other"?C.green:C.red}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Fix log */}
          {fixLog.length > 0 && (
            <Card style={{ padding:"14px 18px", background:"#0F172A" }}>
              <p style={{ fontWeight:700, fontSize:13, color:"#94A3B8", margin:"0 0 10px" }}>سجل الإصلاح</p>
              {fixLog.map((l,i)=>(
                <p key={i} style={{ fontSize:12, color:l.includes("✅")?"#34D399":l.includes("✓")?"#60A5FA":"#CBD5E1", margin:"0 0 4px", fontFamily:"monospace" }}>{l}</p>
              ))}
            </Card>
          )}

          {/* Guidance */}
          {!data.isHealthy && (
            <Card style={{ padding:"16px 18px", background:C.amberLight, border:`1px solid #FDE68A`, marginTop:14 }}>
              <p style={{ fontWeight:700, fontSize:13, color:C.amber, margin:"0 0 10px" }}>🔧 خطوات الإصلاح المقترحة</p>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {data.linesWithNoDate > 0 && <p style={{ fontSize:12, color:"#92400E", margin:0 }}>1. اضغط "إصلاح تلقائي" لملء التواريخ الفارغة</p>}
                {data.journalLines === 0 && data.journalEntries > 0 && <p style={{ fontSize:12, color:"#92400E", margin:0 }}>2. القيود موجودة لكن السطور فارغة — أعد المزامنة بنوع "كاملة"</p>}
                {data.journalEntries === 0 && <p style={{ fontSize:12, color:"#92400E", margin:0 }}>3. لا توجد بيانات — اذهب لصفحة "إعداد وربط Odoo" وابدأ المزامنة</p>}
                {data.typeBreakdown?.some((r:any)=>!r.accountType||r.accountType==="other") && <p style={{ fontSize:12, color:"#92400E", margin:0 }}>4. يوجد حسابات غير مصنّفة — اضغط "إصلاح تلقائي"</p>}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}


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

// ══════════════════════════════════════════════════════════════════════════════
// 📊 تقرير المبيعات اليومية حسب مراكز التكلفة
// ══════════════════════════════════════════════════════════════════════════════
function KPICard({ label, value, sub, icon, color, bg, trend, trendVal }:any) {
  return (
    <Card style={{ padding:"18px 20px", background:bg||C.surface }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px", fontWeight:600 }}>{label}</p>
          <p style={{ fontSize:24, fontWeight:900, color:color||C.text, margin:"0 0 4px" }}>{value}</p>
          {sub && <p style={{ fontSize:11, color:C.textSec, margin:0 }}>{sub}</p>}
          {trendVal !== undefined && (
            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:6 }}>
              <span style={{ fontSize:12, color:trendVal>=0?C.green:C.red, fontWeight:700 }}>
                {trendVal>=0?"▲":"▼"} {Math.abs(trendVal).toFixed(1)}%
              </span>
              <span style={{ fontSize:10, color:C.muted }}>مقارنة بالفترة السابقة</span>
            </div>
          )}
        </div>
        <div style={{ width:46, height:46, borderRadius:12, background:`${color||C.primary}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Mini Sparkline ────────────────────────────────────────────────────────────
function AdvisorPage({ companyId, co }:any) { return <div style={{padding:24}}><p>صفحة المستشار AI</p></div>; }

function ChatbotPage({ companyId, co }:any) { return <div style={{padding:24}}><p>شات بوت مالي</p></div>; }

function UsersPage({ currentUser }:any) { return <div style={{padding:24}}><p>إدارة المستخدمين</p></div>; }

function DailySalesPage({ companyId, co }:any) {
  const yr  = new Date().getFullYear();
  const [dF, setDF]         = useState(`${yr}-01-01`);
  const [dT, setDT]         = useState(`${yr}-12-31`);
  const [cmpF, setCmpF]     = useState(`${yr-1}-01-01`);
  const [cmpT, setCmpT]     = useState(`${yr-1}-12-31`);
  const [showLY, setShowLY] = useState(true);
  const [filterCenters, setFilterCenters] = useState<string[]>([]);
  const [maxCols, setMaxCols] = useState(20);
  const [view, setView]     = useState<"table"|"chart">("table");

  const { data, isLoading } = (trpc as any).journal.dailySalesReport.useQuery({
    companyId, dateFrom:dF, dateTo:dT,
    compareFrom: showLY ? cmpF : undefined,
    compareTo:   showLY ? cmpT : undefined,
    accountTypes: ["revenue","other_income"],
  }, { enabled:!!companyId, staleTime:3*60*1000 });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const centers: string[]      = (data?.centers || []).slice(0, maxCols);
  const centerNames: any       = data?.centerNames || {};
  const dates: string[]        = data?.dates || [];
  const dateMap: any           = data?.dateMap || {};
  const mtd: any               = data?.mtdByCtr || {};
  const dailyTotal: any        = data?.dailyTotal || {};
  const grandTotal: number     = data?.grandTotal || 0;
  const compare: any           = data?.compareData || {};
  const isReal                 = data?.source === "analytic_lines";

  // الفلترة
  const visibleCenters = filterCenters.length > 0
    ? centers.filter(c => filterCenters.includes(c))
    : centers;

  const getDayName = (dateStr:string) => {
    const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
    return days[new Date(dateStr).getDay()] || "";
  };
  const getShortDay = (dateStr:string) => {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return days[new Date(dateStr).getDay()] || "";
  };

  // ألوان الهيدر للمراكز
  const colColors = [
    "#C2185B","#AD1457","#880E4F",
    "#00838F","#006064","#004D40",
    "#1565C0","#0D47A1","#1A237E",
    "#6A1B9A","#4A148C","#311B92",
    "#E65100","#BF360C","#870000",
    "#1B5E20","#2E7D32","#388E3C",
    "#F57F17","#E65100",
  ];

  // KPIs
  const totalCenters = data?.centers?.length || 0;
  const activeDates  = dates.length;
  const avgPerDay    = activeDates > 0 ? Math.round(grandTotal / activeDates) : 0;
  const topCenter    = centers[0];
  const topCenterName = topCenter ? (centerNames[topCenter]?.name || topCenter) : "—";
  const topCenterAmt  = topCenter ? (mtd[topCenter] || 0) : 0;

  if (isLoading) return (
    <div style={{ textAlign:"center", padding:80 }}>
      <Spinner/>
      <p style={{ color:C.muted, marginTop:14, fontSize:13 }}>جاري بناء تقرير المبيعات من حركات مراكز التكلفة...</p>
    </div>
  );

  return (
    <div style={{ padding:"0 20px 28px", direction:"rtl" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:C.text, margin:0 }}>📊 تقرير المبيعات اليومية حسب مراكز التكلفة</h2>
          <div style={{ display:"flex", gap:8, marginTop:5, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:C.textSec }}>{co?.name}</span>
            {isReal
              ? <Badge label="✅ مراكز تحليلية من Odoo" bg={C.greenLight} color={C.green}/>
              : data?.source==="journal_entry_lines"
                ? <Badge label="⚠️ تقريبي — أعد المزامنة لمراكز دقيقة" bg={C.amberLight} color={C.amber}/>
                : <Badge label="⚠️ لا توجد بيانات — تحقق من المزامنة" bg={C.redLight} color={C.red}/>
            }
            {totalCenters > 0 && <Badge label={`${totalCenters} مركز تكلفة`} bg={C.primaryLight} color={C.primary}/>}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[{k:"table",l:"📋 جدول"},{k:"chart",l:"📊 رسم"}].map(v=>(
            <button key={v.k} onClick={()=>setView(v.k as any)}
              style={{ padding:"7px 14px", borderRadius:8, border:`1.5px solid ${view===v.k?C.primary:C.border}`, background:view===v.k?C.primary:"#fff", color:view===v.k?"#fff":C.textSec, cursor:"pointer", fontSize:12, fontWeight:view===v.k?700:400 }}>
              {v.l}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div>
            <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>من تاريخ</label>
            <input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          </div>
          <div>
            <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>إلى تاريخ</label>
            <input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          </div>
          <div style={{ display:"flex", gap:6, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            {["هذا الشهر","هذه السنة","الشهر الماضي"].map((l,i)=>(
              <button key={i} onClick={()=>{
                const now = new Date();
                if (i===0) { setDF(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`); setDT(new Date().toISOString().split("T")[0]); }
                if (i===1) { setDF(`${now.getFullYear()}-01-01`); setDT(new Date().toISOString().split("T")[0]); }
                if (i===2) { const m=now.getMonth()===0?12:now.getMonth(); const y=now.getMonth()===0?now.getFullYear()-1:now.getFullYear(); setDF(`${y}-${String(m).padStart(2,"0")}-01`); setDT(`${y}-${String(m).padStart(2,"0")}-28`); }
              }} style={{ padding:"7px 10px", border:"none", background:"transparent", cursor:"pointer", fontSize:11, color:C.textSec }}>
                {l}
              </button>
            ))}
          </div>
          <label style={{ display:"flex", gap:6, alignItems:"center", cursor:"pointer", fontSize:12, color:C.textSec }}>
            <input type="checkbox" checked={showLY} onChange={e=>setShowLY(e.target.checked)} style={{ cursor:"pointer" }}/>
            مقارنة السنة الماضية
          </label>
          {showLY && (
            <>
              <div>
                <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3 }}>LY من</label>
                <input type="date" value={cmpF} onChange={e=>setCmpF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
              </div>
              <div>
                <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3 }}>LY إلى</label>
                <input type="date" value={cmpT} onChange={e=>setCmpT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* KPIs */}
      {data && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
          <KPICard label="إجمالي MTD" value={fmtM(grandTotal)} icon="💰" color={C.primary} bg={C.primaryLight}
            sub={`${activeDates} يوم نشط`}/>
          <KPICard label="مراكز التكلفة" value={String(totalCenters)} icon="🎯" color={C.purple} bg={C.purpleLight}
            sub="نقطة بيع مرتبطة"/>
          <KPICard label="متوسط يومي" value={fmtM(avgPerDay)} icon="📅" color={C.teal} bg={C.tealLight}
            sub={`بناءً على ${activeDates} يوم`}/>
          <KPICard label="أعلى مركز" value={fmtM(topCenterAmt)} icon="🏆" color={C.green} bg={C.greenLight}
            sub={topCenterName.slice(0,22)}/>
        </div>
      )}

      {!data || (!grandTotal && !isLoading) ? (
        <Card style={{ padding:40, textAlign:"center" }}>
          <p style={{ fontSize:14, color:C.muted, marginBottom:8 }}>لا توجد بيانات مراكز تكلفة لهذه الفترة</p>
          <p style={{ fontSize:12, color:C.muted }}>تأكد من وجود حركات محاسبية بها analytic_distribution من Odoo، ثم أعد المزامنة</p>
        </Card>
      ) : view === "chart" ? (
        /* ── Chart View ── */
        <Card style={{ padding:"20px" }}>
          <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 16px" }}>📊 أعلى مراكز التكلفة — MTD</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {visibleCenters.slice(0,15).map((ctr:string,i:number)=>{
              const name = centerNames[ctr]?.name || ctr;
              const code = centerNames[ctr]?.code || "";
              const amt  = mtd[ctr] || 0;
              const lyAmt = compare[ctr] || 0;
              const pct  = grandTotal > 0 ? (amt/grandTotal*100).toFixed(1) : "0";
              const lyPct = lyAmt > 0 ? Math.round(((amt-lyAmt)/lyAmt)*100) : null;
              return (
                <div key={ctr}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",background:colColors[i%colColors.length],flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{name}</span>
                      {code && <span style={{ fontSize:10, color:C.muted }}>({code})</span>}
                    </div>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ fontSize:12, color:C.muted }}>{pct}%</span>
                      {lyAmt > 0 && lyPct !== null && (
                        <Badge label={`${lyPct>=0?"+":""}${lyPct}% LY`} bg={lyPct>=0?C.greenLight:C.redLight} color={lyPct>=0?C.green:C.red}/>
                      )}
                      <span style={{ fontSize:12, fontWeight:800, color:colColors[i%colColors.length], minWidth:60, textAlign:"left" }}>{fmt(amt)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", background:C.border }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:colColors[i%colColors.length], borderRadius:5, transition:"width 0.5s" }}/>
                    {lyAmt > 0 && (
                      <div style={{ width:`${grandTotal>0?Math.min(100,lyAmt/grandTotal*100):0}%`, height:"100%", background:`${colColors[i%colColors.length]}40`, marginRight:`-${pct}%` }}/>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        /* ── Table View ── */
        <div>
          {/* Column count selector */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:C.textSec }}>عرض:</span>
            {[5,10,15,20,centers.length].map(n=>(
              <button key={n} onClick={()=>setMaxCols(n)}
                style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${maxCols===n?C.primary:C.border}`, background:maxCols===n?C.primaryLight:"transparent", color:maxCols===n?C.primary:C.textSec, cursor:"pointer", fontSize:11, fontWeight:maxCols===n?700:400 }}>
                {n===centers.length?"الكل":n+" مركز"}
              </button>
            ))}
            <span style={{ fontSize:11, color:C.muted, marginRight:"auto" }}>
              يُعرض {visibleCenters.length} من {centers.length} مركز
            </span>
          </div>

          <Card style={{ overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", fontSize:11, minWidth:"max-content", width:"100%" }}>
                <thead>
                  {/* Row 1: header */}
                  <tr style={{ background:"#1a237e" }}>
                    <th style={{ padding:"10px 12px", textAlign:"right", color:"#fff", fontWeight:700, border:"1px solid #283593", minWidth:90, position:"sticky", right:0, zIndex:2, background:"#1a237e" }}>التاريخ</th>
                    <th style={{ padding:"10px 10px", textAlign:"center", color:"#fff", fontWeight:700, border:"1px solid #283593", minWidth:70, background:"#1a237e" }}>اليوم</th>
                    {visibleCenters.map((ctr:string,i:number)=>{
                      const name = centerNames[ctr]?.name || ctr;
                      const code = centerNames[ctr]?.code || "";
                      return (
                        <th key={ctr} style={{ padding:"8px 8px", textAlign:"center", color:"#fff", fontWeight:700, border:"1px solid rgba(255,255,255,0.2)", minWidth:100, background:colColors[i%colColors.length], whiteSpace:"nowrap" }}>
                          <div style={{ fontSize:11 }}>{name.length>14?name.slice(0,14)+"…":name}</div>
                          {code && <div style={{ fontSize:9, opacity:0.8 }}>{code}</div>}
                        </th>
                      );
                    })}
                    <th style={{ padding:"10px 10px", textAlign:"center", color:"#fff", fontWeight:900, border:"1px solid #283593", minWidth:90, background:"#B71C1C" }}>إجمالي اليوم</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date:string, di:number) => {
                    const dayData = dateMap[date] || {};
                    const dayTot  = dailyTotal[date] || 0;
                    const isEven  = di % 2 === 0;
                    return (
                      <tr key={date} style={{ background:isEven?"#fff":"#F8F9FF" }}
                        onMouseEnter={e=>(e.currentTarget as any).style.background="#EFF6FF"}
                        onMouseLeave={e=>(e.currentTarget as any).style.background=isEven?"#fff":"#F8F9FF"}>
                        <td style={{ padding:"7px 12px", textAlign:"right", color:"#1a237e", fontWeight:600, border:"1px solid #E0E0E0", position:"sticky", right:0, background:isEven?"#fff":"#F8F9FF", zIndex:1, whiteSpace:"nowrap" }}>
                          {date}
                        </td>
                        <td style={{ padding:"7px 8px", textAlign:"center", color:C.textSec, border:"1px solid #E0E0E0" }}>
                          {getShortDay(date)}
                        </td>
                        {visibleCenters.map((ctr:string)=>{
                          const val = dayData[ctr] || 0;
                          return (
                            <td key={ctr} style={{ padding:"7px 10px", textAlign:"center", border:"1px solid #E0E0E0", color:val>0?C.text:C.muted, fontWeight:val>0?600:400 }}>
                              {val > 0 ? val.toLocaleString("en") : "—"}
                            </td>
                          );
                        })}
                        <td style={{ padding:"7px 10px", textAlign:"center", border:"2px solid #E53935", fontWeight:900, color:"#B71C1C", background:"#FFF8F8" }}>
                          {dayTot > 0 ? dayTot.toLocaleString("en") : "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {/* TOTAL MTD */}
                  <tr style={{ background:"#E3F2FD", borderTop:"2px solid #1565C0", borderBottom:"2px solid #1565C0" }}>
                    <td colSpan={2} style={{ padding:"9px 12px", textAlign:"right", color:"#0D47A1", fontWeight:900, border:"1px solid #BBDEFB", fontSize:12, position:"sticky", right:0, background:"#E3F2FD", zIndex:1 }}>
                      TOTAL MTD
                    </td>
                    {visibleCenters.map((ctr:string)=>(
                      <td key={ctr} style={{ padding:"9px 10px", textAlign:"center", border:"1px solid #BBDEFB", fontWeight:900, color:"#0D47A1" }}>
                        {(mtd[ctr]||0) > 0 ? (mtd[ctr]||0).toLocaleString("en") : "—"}
                      </td>
                    ))}
                    <td style={{ padding:"9px 10px", textAlign:"center", border:"2px solid #1565C0", fontWeight:900, color:"#0D47A1", fontSize:13 }}>
                      {grandTotal.toLocaleString("en")}
                    </td>
                  </tr>

                  {/* Sales Share % */}
                  <tr style={{ background:"#E8F5E9" }}>
                    <td colSpan={2} style={{ padding:"7px 12px", textAlign:"right", color:"#2E7D32", fontWeight:700, border:"1px solid #C8E6C9", fontSize:11, position:"sticky", right:0, background:"#E8F5E9", zIndex:1 }}>
                      Sales Share %
                    </td>
                    {visibleCenters.map((ctr:string)=>{
                      const pct = grandTotal > 0 ? ((mtd[ctr]||0)/grandTotal*100) : 0;
                      return (
                        <td key={ctr} style={{ padding:"7px 10px", textAlign:"center", border:"1px solid #C8E6C9", color:"#2E7D32", fontWeight:700, fontSize:11 }}>
                          {pct > 0 ? pct.toFixed(0)+"%" : "0%"}
                        </td>
                      );
                    })}
                    <td style={{ padding:"7px 10px", textAlign:"center", border:"1px solid #C8E6C9", color:"#2E7D32", fontWeight:900 }}>100%</td>
                  </tr>

                  {/* Spacer */}
                  <tr><td colSpan={visibleCenters.length+3} style={{ padding:4, background:"#fff", border:"none" }}/></tr>

                  {/* Last Year */}
                  {showLY && Object.keys(compare).length > 0 && (
                    <>
                      <tr style={{ background:"#1565C0" }}>
                        <td colSpan={2} style={{ padding:"8px 12px", textAlign:"right", color:"#fff", fontWeight:700, border:"1px solid #1976D2", position:"sticky", right:0, background:"#1565C0", zIndex:1 }}>
                          Last Year (LY)
                        </td>
                        {visibleCenters.map((ctr:string)=>{
                          const lyAmt = compare[ctr] || 0;
                          return (
                            <td key={ctr} style={{ padding:"8px 10px", textAlign:"center", border:"1px solid #1976D2", color:"#fff", fontWeight:600 }}>
                              {lyAmt > 0 ? lyAmt.toLocaleString("en") : "—"}
                            </td>
                          );
                        })}
                        <td style={{ padding:"8px 10px", textAlign:"center", border:"1px solid #1976D2", color:"#fff", fontWeight:900 }}>
                          {Object.values(compare as Record<string,number>).reduce((s,v)=>s+v,0).toLocaleString("en")}
                        </td>
                      </tr>

                      {/* Remaining LY */}
                      <tr style={{ background:"#311B92" }}>
                        <td colSpan={2} style={{ padding:"8px 12px", textAlign:"right", color:"#E8EAF6", fontWeight:700, border:"1px solid #4527A0", position:"sticky", right:0, background:"#311B92", zIndex:1 }}>
                          Remaining LY
                        </td>
                        {visibleCenters.map((ctr:string)=>{
                          const diff = (mtd[ctr]||0) - (compare[ctr]||0);
                          return (
                            <td key={ctr} style={{ padding:"8px 10px", textAlign:"center", border:"1px solid #4527A0", color:diff<0?"#FFCDD2":"#C8E6C9", fontWeight:600 }}>
                              {diff < 0 ? `(${Math.abs(diff).toLocaleString("en")})` : diff > 0 ? `+${diff.toLocaleString("en")}` : "—"}
                            </td>
                          );
                        })}
                        <td style={{ padding:"8px 10px", textAlign:"center", border:"1px solid #4527A0", color:"#FFCDD2", fontWeight:900 }}>
                          {(()=>{const d = grandTotal - Object.values(compare as Record<string,number>).reduce((s,v)=>s+v,0); return d<0?`(${Math.abs(d).toLocaleString("en")})`:`+${d.toLocaleString("en")}`})()}
                        </td>
                      </tr>

                      {/* Remaining % */}
                      <tr style={{ background:"#4A148C" }}>
                        <td colSpan={2} style={{ padding:"7px 12px", textAlign:"right", color:"#CE93D8", fontWeight:600, border:"1px solid #6A1B9A", fontSize:11, position:"sticky", right:0, background:"#4A148C", zIndex:1 }}>
                          Remaining LY %
                        </td>
                        {visibleCenters.map((ctr:string)=>{
                          const ly = compare[ctr] || 0;
                          const pct = ly > 0 ? Math.round(((mtd[ctr]||0) - ly)/ly*100) : 0;
                          return (
                            <td key={ctr} style={{ padding:"7px 10px", textAlign:"center", border:"1px solid #6A1B9A", color:pct<0?"#FFCDD2":"#C8E6C9", fontWeight:600, fontSize:11 }}>
                              {ly > 0 ? `${pct}%` : "—"}
                            </td>
                          );
                        })}
                        <td style={{ padding:"7px 10px", textAlign:"center", border:"1px solid #6A1B9A", color:"#FFCDD2", fontWeight:700, fontSize:11 }}>
                          {(()=>{const ly=Object.values(compare as Record<string,number>).reduce((s,v)=>s+v,0); return ly>0?`${Math.round((grandTotal-ly)/ly*100)}%`:"—"})()}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}




// ══════════════════════════════════════════════════════════════════════════════
// 🎯 نظام الميزانية ومراقبة مراكز التكلفة
// ══════════════════════════════════════════════════════════════════════════════
function BudgetMonitorPage({ companyId, co }:any) {
  const yr  = new Date().getFullYear();
  const [year, setYear]       = useState(yr);
  const [activeTab, setTab]   = useState<"monitor"|"targets"|"history"|"analysis">("monitor");
  const [editTarget, setEdit] = useState<any>(null);
  const [newTarget, setNewTarget] = useState({
    analyticId:0, centerName:"", plannedExpenses:0, targetRevenue:0,
    alertExpPct:80, alertRevPct:70, notes:""
  });
  const [showAddForm, setShowAdd] = useState(false);
  const [monthlyMode, setMonthlyMode] = useState<number|null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const { data, isLoading, refetch } = (trpc as any).journal.getCostCenterTargets.useQuery(
    { companyId, year }, { enabled:!!companyId, staleTime:2*60*1000 }
  );
  const { data:alerts } = (trpc as any).journal.getAlertHistory.useQuery(
    { companyId, limit:50 }, { enabled:!!companyId }
  );
  const { data:centers } = (trpc as any).journal.analyticCenterList.useQuery(
    { companyId }, { enabled:!!companyId }
  );

  const upsert  = (trpc as any).journal.upsertCostCenterTarget.useMutation({ onSuccess:()=>refetch() });
  const del     = (trpc as any).journal.deleteCostCenterTarget.useMutation({ onSuccess:()=>refetch() });
  const markRead= (trpc as any).journal.markAlertRead.useMutation();
  const recAlert= (trpc as any).journal.recordAlert.useMutation();

  const targets: any[] = data?.targets || [];
  const totals: any    = data?.totals || {};
  const histAlerts: any[] = alerts || [];
  const unread = histAlerts.filter((a:any)=>!a.is_read).length;

  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  const severityColors: Record<string,{bg:string,c:string,border:string,icon:string}> = {
    ok:       {bg:C.greenLight,  c:C.green,  border:"#A7F3D0", icon:"✅"},
    info:     {bg:C.primaryLight,c:C.primary,border:C.primarySoft,icon:"ℹ️"},
    warning:  {bg:C.amberLight,  c:C.amber,  border:"#FDE68A", icon:"⚠️"},
    exceeded: {bg:C.redLight,    c:C.red,    border:"#FECACA", icon:"🚨"},
    critical: {bg:C.redLight,    c:C.red,    border:"#FECACA", icon:"❌"},
  };
  const matrixColors: Record<string,{bg:string,c:string,label:string,icon:string}> = {
    excellent: {bg:C.greenLight,  c:C.green,  label:"ممتاز",          icon:"✅"},
    rev_needed:{bg:C.amberLight,  c:C.amber,  label:"تحسين إيرادات",  icon:"⚠️"},
    monitor:   {bg:"#FFF3E0",     c:"#E65100",label:"مراقبة",         icon:"🟠"},
    danger:    {bg:C.redLight,    c:C.red,    label:"خطر",            icon:"🔴"},
  };

  // تلقائياً سجّل التنبيهات عند التحميل
  useEffect(()=>{
    if (!targets.length || !companyId) return;
    targets.forEach((t:any)=>{
      if (t.expStatus==="exceeded") {
        recAlert.mutate({ companyId, analyticId:t.analyticId, centerName:t.centerName, alertType:"expenses", severity:"emergency", message:`تجاوز ميزانية المصروفات ${t.expPct.toFixed(0)}%`, actualValue:t.actualExpenses, plannedValue:t.plannedExpenses, pctUsed:t.expPct });
      }
    });
  },[targets.length]);

  // توزيع شهري متساوٍ
  const distributeEqual = (annual: number) =>
    Array.from({length:12},(_,i)=>({ month:i+1, expenses:Math.round(annual/12), revenue:Math.round(annual/12) }));

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:C.text, margin:0 }}>🎯 مراقبة الميزانية ومراكز التكلفة</h2>
          <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:C.textSec }}>{co?.name}</span>
            <Badge label={`سنة ${year}`} bg={C.primaryLight} color={C.primary}/>
            {unread > 0 && <Badge label={`🔔 ${unread} تنبيه جديد`} bg={C.redLight} color={C.red}/>}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12 }}>
            {[yr-1,yr,yr+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {activeTab==="targets" && (
            <button onClick={()=>setShowAdd(!showAddForm)}
              style={{ padding:"7px 14px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>
              + إضافة هدف
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`2px solid ${C.border}`, paddingBottom:0 }}>
        {[
          {k:"monitor",  l:"📊 لوحة المراقبة"},
          {k:"targets",  l:"🎯 الأهداف والمستهدفات"},
          {k:"analysis", l:"📈 تحليل الانحراف"},
          {k:"history",  l:`🔔 سجل التنبيهات${unread>0?` (${unread})`:""}`},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)}
            style={{ padding:"9px 18px", border:"none", borderBottom:`2.5px solid ${activeTab===t.k?C.primary:"transparent"}`, background:"transparent", color:activeTab===t.k?C.primary:C.textSec, cursor:"pointer", fontSize:12, fontWeight:activeTab===t.k?800:400, marginBottom:-2 }}>
            {t.l}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ textAlign:"center", padding:60 }}><Spinner/><p style={{ color:C.muted, marginTop:12 }}>جاري مقارنة البيانات الفعلية بالأهداف...</p></div>}

      {/* ── MONITOR TAB ── */}
      {activeTab==="monitor" && !isLoading && (
        <>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
            {[
              {l:"المصروفات المخططة",   v:fmtM(totals.plannedExp||0), sub:`فعلي: ${fmtM(totals.actualExp||0)}`,  icon:"💸", c:C.red,     bg:C.redLight},
              {l:"الإيرادات المستهدفة", v:fmtM(totals.targetRev||0), sub:`فعلي: ${fmtM(totals.actualRev||0)}`,   icon:"💰", c:C.primary, bg:C.primaryLight},
              {l:"مراكز تجاوزت الميزانية", v:String(totals.exceeded||0), sub:"تحتاج تدخل فوري",                icon:"🚨", c:C.red,     bg:C.redLight},
              {l:"مراكز قاصرة الإيرادات", v:String(totals.revMissed||0), sub:"لم تحقق المستهدف",               icon:"⚠️", c:C.amber,   bg:C.amberLight},
            ].map((s,i)=>(
              <Card key={i} style={{ padding:"14px 16px", background:s.bg, border:"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div>
                    <p style={{ fontSize:10, color:C.textSec, margin:"0 0 4px" }}>{s.l}</p>
                    <p style={{ fontSize:18, fontWeight:900, color:s.c, margin:"0 0 3px" }}>{s.v}</p>
                    <p style={{ fontSize:10, color:C.muted, margin:0 }}>{s.sub}</p>
                  </div>
                  <span style={{ fontSize:22 }}>{s.icon}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Performance Matrix */}
          {targets.length > 0 && (
            <Card style={{ padding:"18px 20px", marginBottom:14 }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>📊 مصفوفة الأداء</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                {Object.entries(matrixColors).map(([key,mc])=>{
                  const count = targets.filter((t:any)=>t.matrix===key).length;
                  return (
                    <div key={key} style={{ padding:"12px 16px", borderRadius:10, background:mc.bg, border:`1px solid ${mc.c}30`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:16 }}>{mc.icon}</span>
                        <span style={{ fontSize:12, color:mc.c, fontWeight:700 }}>{mc.label}</span>
                      </div>
                      <span style={{ fontSize:22, fontWeight:900, color:mc.c }}>{count}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {Object.entries(matrixColors).map(([key,mc])=>(
                  <div key={key} style={{ display:"flex", gap:4, alignItems:"center" }}>
                    <div style={{ width:8,height:8,borderRadius:"50%",background:mc.c }}/><span style={{ fontSize:10, color:C.muted }}>{mc.label}: {targets.filter((t:any)=>t.matrix===key).length}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top centers progress */}
          {targets.length === 0 ? (
            <Card style={{ padding:40, textAlign:"center" }}>
              <p style={{ fontSize:16, color:C.muted, marginBottom:8 }}>لا توجد أهداف محددة لسنة {year}</p>
              <p style={{ fontSize:12, color:C.muted, marginBottom:16 }}>ابدأ بإضافة أهداف المصروفات والإيرادات لكل مركز تكلفة</p>
              <button onClick={()=>setTab("targets")} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                + إضافة أهداف الآن
              </button>
            </Card>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {/* Expenses */}
              <Card style={{ padding:"18px 20px" }}>
                <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>💸 استهلاك ميزانية المصروفات</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {targets.slice(0,8).map((t:any,i:number)=>{
                    const sc = severityColors[t.expStatus]||severityColors.ok;
                    return (
                      <div key={i}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{t.centerName.slice(0,22)}</span>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <span style={{ fontSize:11, color:sc.c, fontWeight:700 }}>{t.expPct.toFixed(0)}%</span>
                            <Badge label={sc.icon+" "+t.expStatus} bg={sc.bg} color={sc.c}/>
                          </div>
                        </div>
                        <div style={{ background:C.border, borderRadius:5, height:8, overflow:"hidden" }}>
                          <div style={{ width:`${Math.min(100,t.expPct)}%`, height:"100%", background:sc.c, borderRadius:5, transition:"width 0.5s" }}/>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
                          <span style={{ fontSize:9, color:C.muted }}>فعلي: {fmtM(t.actualExpenses)}</span>
                          <span style={{ fontSize:9, color:C.muted }}>مخطط: {fmtM(t.plannedExpenses)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              {/* Revenue */}
              <Card style={{ padding:"18px 20px" }}>
                <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>💰 تحقيق مستهدفات الإيرادات</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {targets.filter((t:any)=>t.targetRevenue>0).slice(0,8).map((t:any,i:number)=>{
                    const color = t.revPct>=100?C.green:t.revPct>=70?C.amber:C.red;
                    return (
                      <div key={i}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{t.centerName.slice(0,22)}</span>
                          <span style={{ fontSize:11, color, fontWeight:700 }}>{t.revPct.toFixed(0)}%</span>
                        </div>
                        <div style={{ background:C.border, borderRadius:5, height:8, overflow:"hidden" }}>
                          <div style={{ width:`${Math.min(100,t.revPct)}%`, height:"100%", background:color, borderRadius:5 }}/>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
                          <span style={{ fontSize:9, color:C.muted }}>فعلي: {fmtM(t.actualRevenue)}</span>
                          <span style={{ fontSize:9, color:C.muted }}>هدف: {fmtM(t.targetRevenue)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {targets.filter((t:any)=>t.targetRevenue===0).length > 0 && (
                    <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:8 }}>
                      {targets.filter((t:any)=>t.targetRevenue===0).length} مركز بدون مستهدف إيرادات
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── TARGETS TAB ── */}
      {activeTab==="targets" && (
        <>
          {/* Add form */}
          {showAddForm && (
            <Card style={{ padding:"18px 20px", marginBottom:14, border:`2px solid ${C.primary}` }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.primary, margin:"0 0 14px" }}>+ إضافة هدف مركز تكلفة جديد</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
                {[
                  {l:"مركز التكلفة / المشروع",w:"2/3"},
                  {l:"المعرف التحليلي في Odoo"},
                  {l:"المصروفات المخططة"},
                  {l:"الإيرادات المستهدفة"},
                  {l:"نسبة تنبيه المصروفات %"},
                  {l:"نسبة تنبيه الإيرادات %"},
                ].map((_,i)=>(
                  <div key={i}>
                    <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>{
                      ["اسم مركز التكلفة","المعرف التحليلي Odoo","المصروفات المخططة","الإيرادات المستهدفة","تنبيه مصروفات %","تنبيه إيرادات %"][i]
                    }</label>
                    <input
                      type={i>1?"number":"text"}
                      placeholder={["جاسم الغانم - مقاولات","1459","500,000","800,000","80","70"][i]}
                      value={[newTarget.centerName,String(newTarget.analyticId||""),String(newTarget.plannedExpenses||""),String(newTarget.targetRevenue||""),String(newTarget.alertExpPct),String(newTarget.alertRevPct)][i]}
                      onChange={e=>{
                        const v = e.target.value;
                        const keys = ["centerName","analyticId","plannedExpenses","targetRevenue","alertExpPct","alertRevPct"];
                        setNewTarget(p=>({...p, [keys[i]]: i>1?Number(v)||0:v}));
                      }}
                      style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{
                  upsert.mutate({ companyId, ...newTarget, year, monthlyTargets: distributeEqual(newTarget.plannedExpenses).map(m=>({...m, revenue:Math.round(newTarget.targetRevenue/12)})) });
                  setShowAdd(false);
                  setNewTarget({analyticId:0,centerName:"",plannedExpenses:0,targetRevenue:0,alertExpPct:80,alertRevPct:70,notes:""});
                }} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                  حفظ وتوزيع شهري متساوٍ
                </button>
                <button onClick={()=>setShowAdd(false)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSec, cursor:"pointer", fontSize:12 }}>
                  إلغاء
                </button>
              </div>
            </Card>
          )}

          {/* Targets table */}
          <Card style={{ overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:C.primaryLight }}>
                  {["المركز","المصروفات المخططة","الإيرادات المستهدفة","تنبيه مصروفات","تنبيه إيرادات","توزيع شهري","إجراءات"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, whiteSpace:"nowrap", fontSize:10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {targets.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding:30, textAlign:"center", color:C.muted }}>لا توجد أهداف — اضغط "+ إضافة هدف"</td></tr>
                ) : targets.map((t:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"9px 12px", fontWeight:700, color:C.text }}>{t.centerName}</td>
                    <td style={{ padding:"9px 12px", color:C.red }}>
                      {editTarget?.id===t.id ? (
                        <input type="number" value={editTarget.plannedExpenses} onChange={e=>setEdit({...editTarget,plannedExpenses:Number(e.target.value)})}
                          style={{ width:90, padding:"4px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11 }}/>
                      ) : fmt(t.plannedExpenses)}
                    </td>
                    <td style={{ padding:"9px 12px", color:C.primary }}>
                      {editTarget?.id===t.id ? (
                        <input type="number" value={editTarget.targetRevenue} onChange={e=>setEdit({...editTarget,targetRevenue:Number(e.target.value)})}
                          style={{ width:90, padding:"4px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11 }}/>
                      ) : fmt(t.targetRevenue)}
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      {editTarget?.id===t.id ? (
                        <input type="number" value={editTarget.alertExpPct} onChange={e=>setEdit({...editTarget,alertExpPct:Number(e.target.value)})}
                          style={{ width:55, padding:"4px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11 }}/>
                      ) : <Badge label={`${t.alertExpPct}%`} bg={C.amberLight} color={C.amber}/>}
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      {editTarget?.id===t.id ? (
                        <input type="number" value={editTarget.alertRevPct} onChange={e=>setEdit({...editTarget,alertRevPct:Number(e.target.value)})}
                          style={{ width:55, padding:"4px 6px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:11 }}/>
                      ) : <Badge label={`${t.alertRevPct}%`} bg={C.primaryLight} color={C.primary}/>}
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <button onClick={()=>{ setMonthlyMode(t.id); setMonthlyData(t.monthly.length>0?t.monthly:distributeEqual(t.plannedExpenses).map((m:any)=>({...m,revenue:Math.round(t.targetRevenue/12)}))); }}
                        style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:10, color:C.primary }}>
                        ⚙️ {t.monthly.length>0?"عرض":"ضبط"}
                      </button>
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        {editTarget?.id===t.id ? (
                          <>
                            <button onClick={()=>{ upsert.mutate({companyId,...editTarget,year}); setEdit(null); }}
                              style={{ padding:"4px 8px", borderRadius:6, border:"none", background:C.green, color:"#fff", cursor:"pointer", fontSize:10 }}>حفظ</button>
                            <button onClick={()=>setEdit(null)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", cursor:"pointer", fontSize:10 }}>إلغاء</button>
                          </>
                        ) : (
                          <>
                            <button onClick={()=>setEdit({...t})} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:10 }}>✏️</button>
                            <button onClick={()=>{ if(confirm("حذف هذا الهدف؟")) del.mutate({companyId, analyticId:t.analyticId, year}); }}
                              style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${C.redLight}`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:10 }}>🗑️</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Monthly breakdown modal */}
          {monthlyMode !== null && (
            <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,direction:"rtl" }}
              onClick={()=>setMonthlyMode(null)}>
              <div onClick={e=>e.stopPropagation()} style={{ background:C.surface,borderRadius:16,padding:24,maxWidth:540,width:"94%",maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:16 }}>
                  <p style={{ fontWeight:800,fontSize:15,color:C.text,margin:0 }}>التوزيع الشهري</p>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>{
                      const t = targets.find((x:any)=>x.id===monthlyMode);
                      if (t) setMonthlyData(distributeEqual(t.plannedExpenses).map((m:any)=>({...m,revenue:Math.round(t.targetRevenue/12)})));
                    }} style={{ padding:"5px 12px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontSize:11 }}>
                      توزيع متساوٍ
                    </button>
                    <button onClick={()=>setMonthlyMode(null)} style={{ padding:"5px 10px",borderRadius:7,border:"none",background:"transparent",cursor:"pointer",fontSize:18,color:C.muted }}>×</button>
                  </div>
                </div>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                  <thead>
                    <tr style={{ background:C.primaryLight }}>
                      {["الشهر","المصروفات المخططة","الإيرادات المستهدفة"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px",textAlign:"right",color:C.primary,fontWeight:700,borderBottom:`1px solid ${C.primarySoft}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({length:12},(_,i)=>{
                      const m = monthlyData.find((x:any)=>x.month===i+1) || {month:i+1,planned_expenses:0,target_revenue:0};
                      return (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":"#F8FAFF" }}>
                          <td style={{ padding:"7px 12px",fontWeight:600,color:C.textSec }}>{arM[i]}</td>
                          <td style={{ padding:"7px 12px" }}>
                            <input type="number" value={m.planned_expenses||m.expenses||0}
                              onChange={e=>setMonthlyData(prev=>{ const n=[...prev]; const idx=n.findIndex(x=>x.month===i+1); if(idx>=0)n[idx]={...n[idx],expenses:Number(e.target.value),planned_expenses:Number(e.target.value)}; else n.push({month:i+1,expenses:Number(e.target.value),planned_expenses:Number(e.target.value),revenue:0,target_revenue:0}); return n; })}
                              style={{ width:"100%",padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11 }}/>
                          </td>
                          <td style={{ padding:"7px 12px" }}>
                            <input type="number" value={m.target_revenue||m.revenue||0}
                              onChange={e=>setMonthlyData(prev=>{ const n=[...prev]; const idx=n.findIndex(x=>x.month===i+1); if(idx>=0)n[idx]={...n[idx],revenue:Number(e.target.value),target_revenue:Number(e.target.value)}; else n.push({month:i+1,expenses:0,planned_expenses:0,revenue:Number(e.target.value),target_revenue:Number(e.target.value)}); return n; })}
                              style={{ width:"100%",padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11 }}/>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background:C.primaryLight,borderTop:`2px solid ${C.primary}` }}>
                      <td style={{ padding:"9px 12px",fontWeight:800,color:C.primary }}>المجموع</td>
                      <td style={{ padding:"9px 12px",fontWeight:800,color:C.red }}>{fmt(monthlyData.reduce((s:number,m:any)=>s+(m.planned_expenses||m.expenses||0),0))}</td>
                      <td style={{ padding:"9px 12px",fontWeight:800,color:C.primary }}>{fmt(monthlyData.reduce((s:number,m:any)=>s+(m.target_revenue||m.revenue||0),0))}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop:14,display:"flex",gap:8 }}>
                  <button onClick={()=>{
                    const t = targets.find((x:any)=>x.id===monthlyMode);
                    if (t) upsert.mutate({companyId,analyticId:t.analyticId,centerName:t.centerName,year,plannedExpenses:t.plannedExpenses,targetRevenue:t.targetRevenue,alertExpPct:t.alertExpPct,alertRevPct:t.alertRevPct,monthlyTargets:monthlyData.map(m=>({month:m.month,expenses:m.planned_expenses||m.expenses||0,revenue:m.target_revenue||m.revenue||0}))});
                    setMonthlyMode(null);
                  }} style={{ flex:1,padding:"9px",borderRadius:8,border:"none",background:C.primary,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700 }}>
                    حفظ التوزيع الشهري
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ANALYSIS TAB ── */}
      {activeTab==="analysis" && (
        <Card style={{ overflow:"hidden" }}>
          <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.border}` }}>
            <p style={{ fontWeight:800,fontSize:14,color:C.text,margin:0 }}>📈 تحليل الانحراف — Variance Analysis</p>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:700 }}>
              <thead>
                <tr style={{ background:C.primaryLight }}>
                  {["المركز","إيرادات مخططة","إيرادات فعلية","انحراف إيرادات","مصروفات مخططة","مصروفات فعلية","انحراف مصروفات","ربح مخطط","ربح فعلي","انحراف الربح","تنبؤ نهاية السنة"].map(h=>(
                    <th key={h} style={{ padding:"9px 10px",textAlign:"right",color:C.primary,fontWeight:700,borderBottom:`1px solid ${C.primarySoft}`,whiteSpace:"nowrap",fontSize:10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {targets.length===0 ? (
                  <tr><td colSpan={11} style={{ padding:24,textAlign:"center",color:C.muted }}>لا توجد أهداف لعرض تحليل الانحراف</td></tr>
                ) : targets.map((t:any,i:number)=>{
                  const varRev  = t.actualRevenue - t.targetRevenue;
                  const varExp  = t.actualExpenses - t.plannedExpenses;
                  const varProf = t.netProfit - t.plannedProfit;
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":"#F8FAFF" }}>
                      <td style={{ padding:"8px 10px",fontWeight:700,color:C.text }}>{t.centerName}</td>
                      <td style={{ padding:"8px 10px",color:C.muted }}>{t.targetRevenue>0?fmt(t.targetRevenue):"—"}</td>
                      <td style={{ padding:"8px 10px",color:C.primary,fontWeight:600 }}>{fmt(t.actualRevenue)}</td>
                      <td style={{ padding:"8px 10px" }}><span style={{ color:varRev>=0?C.green:C.red,fontWeight:700 }}>{varRev>=0?"+":""}{fmtM(varRev)}</span></td>
                      <td style={{ padding:"8px 10px",color:C.muted }}>{t.plannedExpenses>0?fmt(t.plannedExpenses):"—"}</td>
                      <td style={{ padding:"8px 10px",color:C.red,fontWeight:600 }}>{fmt(t.actualExpenses)}</td>
                      <td style={{ padding:"8px 10px" }}><span style={{ color:varExp<=0?C.green:C.red,fontWeight:700 }}>{varExp>=0?"+":""}{fmtM(varExp)}</span></td>
                      <td style={{ padding:"8px 10px",color:C.muted }}>{fmt(t.plannedProfit)}</td>
                      <td style={{ padding:"8px 10px",fontWeight:700,color:t.netProfit>=0?C.green:C.red }}>{fmt(t.netProfit)}</td>
                      <td style={{ padding:"8px 10px" }}><span style={{ color:varProf>=0?C.green:C.red,fontWeight:700 }}>{varProf>=0?"+":""}{fmtM(varProf)}</span></td>
                      <td style={{ padding:"8px 10px" }}>
                        {t.forecastExp>0&&<div><div style={{ fontSize:10,color:C.red }}>مصر: {fmtM(t.forecastExp)}</div><div style={{ fontSize:10,color:C.primary }}>إير: {fmtM(t.forecastRev)}</div></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab==="history" && (
        <>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <p style={{ fontSize:13,color:C.textSec,margin:0 }}>{histAlerts.length} تنبيه في السجل</p>
            <button onClick={()=>markRead.mutate({companyId})} style={{ padding:"6px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontSize:11,color:C.textSec }}>
              ✓ تحديد الكل كمقروء
            </button>
          </div>
          {histAlerts.length===0 ? (
            <Card style={{ padding:30,textAlign:"center" }}><p style={{ color:C.muted }}>لا توجد تنبيهات مسجلة بعد</p></Card>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {histAlerts.map((a:any,i:number)=>{
                const sc = severityColors[a.severity]||severityColors.info;
                return (
                  <div key={i} style={{ padding:"12px 16px",borderRadius:10,background:a.is_read?"#F8FAFF":sc.bg,border:`1px solid ${a.is_read?C.border:sc.border}`,display:"flex",gap:12,alignItems:"flex-start",transition:"background 0.2s" }}>
                    <span style={{ fontSize:18,flexShrink:0 }}>{sc.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                        <span style={{ fontSize:12,fontWeight:700,color:a.is_read?C.textSec:sc.c }}>{a.center_name}</span>
                        <span style={{ fontSize:10,color:C.muted }}>{String(a.created_at).split("T")[0]}</span>
                      </div>
                      <p style={{ fontSize:12,color:C.textSec,margin:0 }}>{a.message}</p>
                      {a.pct_used > 0 && (
                        <div style={{ marginTop:6,height:4,background:C.border,borderRadius:2,overflow:"hidden",width:120 }}>
                          <div style={{ width:`${Math.min(100,a.pct_used)}%`,height:"100%",background:sc.c,borderRadius:2 }}/>
                        </div>
                      )}
                    </div>
                    {!a.is_read && (
                      <button onClick={()=>markRead.mutate({companyId,alertId:a.id})} style={{ padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",fontSize:10,flexShrink:0 }}>
                        قراءة
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}



export default function Dashboard({ user, onLogout }:{ user:any; onLogout:()=>void }) {
  const [page, setPage]      = useState("dashboard");
  const [open, setOpen]      = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [isDark, setDark]    = useState(()=>localStorage.getItem("cfo_theme")==="dark");
  if (isDark) C = THEMES.dark; else C = THEMES.light;

  // alerts: moved below
  const [exp, setExp] = useState<Record<string,boolean>>(()=>Object.fromEntries(NAV.map(s=>[s.s,true])));
  const { data:companies } = trpc.company.list.useQuery();
  const [companyId, setCompanyId] = useState(0);
  if (!companyId && companies?.length) setCompanyId(companies[0].id);
  const co = companies?.find((c:any)=>c.id===companyId);
  const label = NAV.flatMap(s=>s.items).find(i=>i.id===page)?.label

  // ── Budget alerts (needs companyId) ────────────────────────────────────
  const checkAlerts = (trpc as any).journal.checkAndFireAlerts.useMutation();
  const { data:dailySummary } = (trpc as any).journal.dailySummary.useQuery(
    { companyId, year:new Date().getFullYear() },
    { enabled:!!companyId, refetchInterval:5*60*1000 }
  );
  const unreadAlerts   = dailySummary?.unreadAlerts   || 0;
  const emergencyCount = dailySummary?.emergencyCount || 0;

  useEffect(()=>{
    if (!companyId) return;
    const runCheck = () => checkAlerts.mutate({ companyId, year:new Date().getFullYear() });
    const timer = setInterval(runCheck, 10*60*1000);
    return ()=>clearInterval(timer);
  }, [companyId]);
  const rc = roleLabels[user.role]||roleLabels.custom;


// ══════════════════════════════════════════════════════════════════════════════
// 📊 صفحات التقارير المالية
// ══════════════════════════════════════════════════════════════════════════════

// ── ميزان المراجعة ────────────────────────────────────────────────────────────
function TrialBalancePage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const { data, isLoading } = trpc.journal.trialBalance.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId, staleTime:5*60*1000 });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="⚖️ ميزان المراجعة" sub="الأرصدة الافتتاحية والحركة والختامية"/>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          <span style={{ color:C.muted }}>—</span>
          <input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
        </div>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:60 }}><Spinner/></div> : !data?.length ? <NoData/> : (
        <Card>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:750 }}>
              <thead>
                <tr style={{ background:C.primaryLight }}>
                  <th style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, fontSize:11, borderBottom:`1px solid ${C.primarySoft}` }}>الكود</th>
                  <th style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, fontSize:11, borderBottom:`1px solid ${C.primarySoft}` }}>اسم الحساب</th>
                  <th colSpan={2} style={{ padding:"10px 12px", textAlign:"center", color:C.primary, fontWeight:700, fontSize:11, borderBottom:`1px solid ${C.primarySoft}`, background:"#EEF4FF" }}>الرصيد الافتتاحي</th>
                  <th colSpan={2} style={{ padding:"10px 12px", textAlign:"center", color:C.teal, fontWeight:700, fontSize:11, borderBottom:`1px solid ${C.primarySoft}`, background:"#F0FDFA" }}>الحركة</th>
                  <th colSpan={2} style={{ padding:"10px 12px", textAlign:"center", color:C.purple, fontWeight:700, fontSize:11, borderBottom:`1px solid ${C.primarySoft}`, background:"#F5F3FF" }}>الرصيد الختامي</th>
                </tr>
                <tr style={{ background:"#F8FAFF" }}>
                  <th colSpan={2}/>
                  {["مدين","دائن","مدين","دائن","مدين","دائن"].map((h,i)=>(
                    <th key={i} style={{ padding:"5px 10px", textAlign:"center", color:C.muted, fontSize:10, fontWeight:600, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data as any[]).map((r:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"8px 12px", color:C.muted, fontFamily:"monospace", fontSize:11 }}>{r.accountCode}</td>
                    <td style={{ padding:"8px 12px", color:C.text }}>{r.accountName}</td>
                    {[r.openDebit,r.openCredit,r.mvtDebit,r.mvtCredit,r.closingDebit,r.closingCredit].map((v:number,j:number)=>(
                      <td key={j} style={{ padding:"8px 10px", textAlign:"center", color:Number(v)>0?C.text:C.muted }}>{Number(v)>0?fmt(Number(v)):"—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
                  <td colSpan={2} style={{ padding:"10px 12px", color:C.primary, fontWeight:800 }}>المجموع</td>
                  {["openDebit","openCredit","mvtDebit","mvtCredit","closingDebit","closingCredit"].map((f,i)=>(
                    <td key={i} style={{ padding:"10px", textAlign:"center", color:C.primary, fontWeight:800 }}>
                      {fmt((data as any[]).reduce((s:number,r:any)=>s+(Number(r[f])||0),0))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── قائمة الدخل ───────────────────────────────────────────────────────────────
function IncomePage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const { data, isLoading } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId, staleTime:5*60*1000 });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  const rows = data ? [
    { label:"إجمالي الإيرادات",    value:data.revenue,          type:"total",    color:C.primary },
    { label:"تكلفة المبيعات",      value:-data.cogs,            type:"item" },
    { label:"مجمل الربح",          value:data.grossProfit,      type:"subtotal", color:C.teal },
    { label:"المصروفات التشغيلية", value:-data.expenses,        type:"item" },
    { label:"الربح التشغيلي",      value:data.operatingProfit,  type:"subtotal", color:C.purple },
    { label:"إيرادات أخرى",        value:data.otherIncome,      type:"item" },
    { label:"مصروفات أخرى",        value:-data.otherExpenses,   type:"item" },
    { label:"صافي الربح",          value:data.netProfit,        type:"net",      color:data.netProfit>=0?C.green:C.red },
  ] : [];
  const rev = data?.revenue || 1;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📈 قائمة الدخل" sub="نتائج الأعمال للفترة المحددة"/>
        <div style={{ display:"flex", gap:8 }}>
          <input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          <span style={{ color:C.muted }}>—</span>
          <input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
        </div>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:60 }}><Spinner/></div> : !data ? <NoData/> : (
        <Card>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.primaryLight }}>
                <th style={{ padding:"12px 20px", textAlign:"right", color:C.primary, fontWeight:700 }}>البيان</th>
                <th style={{ padding:"12px 16px", textAlign:"center", color:C.primary, fontWeight:700 }}>المبلغ</th>
                <th style={{ padding:"12px 16px", textAlign:"center", color:C.primary, fontWeight:700 }}>% من الإيرادات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>{
                const pct = rev>0 ? Math.abs((r.value/rev)*100).toFixed(1) : "—";
                if (r.type==="net") return (
                  <tr key={i} style={{ background:r.value>=0?"linear-gradient(135deg,#ECFDF5,#F0FDFA)":"linear-gradient(135deg,#FEF2F2,#FFF1F2)", borderTop:`2px solid ${r.color}` }}>
                    <td style={{ padding:"14px 20px", fontWeight:800, color:r.color, fontSize:16 }}>{r.label}</td>
                    <td style={{ padding:"14px 16px", textAlign:"center", fontWeight:800, color:r.color, fontSize:16 }}>{fmt(Math.abs(r.value))}</td>
                    <td style={{ padding:"14px 16px", textAlign:"center", fontWeight:700, color:r.color }}>{pct}%</td>
                  </tr>
                );
                if (r.type==="total"||r.type==="subtotal") return (
                  <tr key={i} style={{ background:r.type==="total"?C.primaryLight:"#F8FAFF", borderTop:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 20px", fontWeight:700, color:r.color||C.primary }}>{r.label}</td>
                    <td style={{ padding:"11px 16px", textAlign:"center", fontWeight:700, color:r.color||C.primary }}>{fmt(Math.abs(r.value))}</td>
                    <td style={{ padding:"11px 16px", textAlign:"center", color:C.muted, fontSize:11 }}>{pct}%</td>
                  </tr>
                );
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"9px 20px 9px 36px", color:C.text }}>{r.label}</td>
                    <td style={{ padding:"9px 16px", textAlign:"center", color:r.value<0?C.red:C.text }}>
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

// ── الميزانية العمومية ────────────────────────────────────────────────────────
function BalanceSheetPage({ companyId }:any) {
  const [asOf, setAsOf] = useState(`${new Date().getFullYear()}-12-31`);
  const { data, isLoading } = trpc.journal.balanceSheet.useQuery({ companyId, asOf }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  const Section = ({ title, items, total, color }:any) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ padding:"10px 16px", background:`${color}20`, borderRadius:"8px 8px 0 0", borderBottom:`2px solid ${color}`, display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontWeight:800, color, fontSize:14 }}>{title}</span>
        <span style={{ fontWeight:800, color, fontSize:14 }}>{fmt(total)}</span>
      </div>
      {(items||[]).sort((a:any,b:any)=>b.value-a.value).slice(0,10).map((item:any,i:number)=>(
        <div key={i} style={{ padding:"8px 16px 8px 24px", display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
          <span style={{ fontSize:12, color:C.text }}><span style={{ color:C.muted, fontSize:10, marginLeft:8 }}>{item.accountCode}</span>{item.accountName}</span>
          <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{fmt(item.value)}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🏦 الميزانية العمومية" sub="المركز المالي"/>
        <input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:60 }}><Spinner/></div> : !data ? <NoData/> : (
        <>
          {/* Balance check */}
          <div style={{ padding:"10px 16px", marginBottom:14, borderRadius:8, background:Math.abs(data.assets-data.totalLiabilitiesEquity)<1?C.greenLight:C.redLight, border:`1px solid ${Math.abs(data.assets-data.totalLiabilitiesEquity)<1?"#A7F3D0":"#FECACA"}` }}>
            <span style={{ fontSize:13, fontWeight:700, color:Math.abs(data.assets-data.totalLiabilitiesEquity)<1?C.green:C.red }}>
              {Math.abs(data.assets-data.totalLiabilitiesEquity)<1 ? "✅ الميزانية متوازنة" : `⚠️ فرق: ${fmt(Math.abs(data.assets-data.totalLiabilitiesEquity))}`}
              {" | "}الأصول: {fmt(data.assets)} | الخصوم: {fmt(data.totalLiabilitiesEquity)}
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Card style={{ padding:"16px 0", overflow:"hidden" }}>
              <Section title="الأصول" items={data.details?.assets} total={data.assets} color={C.primary}/>
              <div style={{ padding:"12px 16px", background:C.primaryLight, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontWeight:800, color:C.primary }}>إجمالي الأصول</span>
                <span style={{ fontWeight:800, color:C.primary, fontSize:16 }}>{fmt(data.assets)}</span>
              </div>
            </Card>
            <div>
              <Card style={{ padding:"16px 0", overflow:"hidden", marginBottom:12 }}>
                <Section title="الالتزامات" items={data.details?.liabilities} total={data.liabilities} color={C.red}/>
              </Card>
              <Card style={{ padding:"16px 0", overflow:"hidden" }}>
                <Section title="حقوق الملكية" items={data.details?.equity} total={data.equity} color={C.green}/>
                <div style={{ padding:"12px 16px", background:C.greenLight, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:800, color:C.green }}>إجمالي الالتزامات + حقوق الملكية</span>
                  <span style={{ fontWeight:800, color:C.green }}>{fmt(data.totalLiabilitiesEquity)}</span>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── دفتر الأستاذ العام ────────────────────────────────────────────────────────
function GeneralLedgerPage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const [acc, setAcc] = useState("");
  const { data:accounts } = trpc.journal.getAccounts.useQuery({ companyId }, { enabled:!!companyId });
  const { data, isLoading } = trpc.journal.generalLedger.useQuery({ companyId, accountCode:acc, dateFrom:dF, dateTo:dT }, { enabled:!!companyId&&!!acc });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="📒 دفتر الأستاذ العام" sub="حركات حساب خلال فترة"/>
      <Card style={{ padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ flex:2, minWidth:200 }}>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>اختر الحساب</label>
            <select value={acc} onChange={e=>setAcc(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
              <option value="">— اختر حساباً —</option>
              {(accounts||[]).map((a:any)=><option key={a.account_code||a.accountCode} value={a.account_code||a.accountCode}>{a.account_code||a.accountCode} — {a.account_name||a.accountName}</option>)}
            </select>
          </div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>من</label><input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى</label><input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
        </div>
      </Card>
      {!acc ? <NoData text="اختر حساباً من القائمة أعلاه"/> : isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
            {[{l:"الرصيد الافتتاحي",v:data?.openingBalance||0,c:C.primary},{l:"مجموع مدين",v:(data?.lines||[]).reduce((s:number,l:any)=>s+(l.debit||0),0),c:C.teal},{l:"الرصيد الختامي",v:(data?.lines||[]).length?(data?.lines||[]).at(-1)?.balance||0:data?.openingBalance||0,c:C.purple}].map((s,i)=>(
              <Card key={i} style={{ padding:"12px 16px" }}><p style={{ color:C.muted, fontSize:10, margin:"0 0 3px" }}>{s.l}</p><p style={{ fontSize:16, fontWeight:800, color:s.c, margin:0 }}>{fmt(s.v)}</p></Card>
            ))}
          </div>
          <Card>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ background:C.primaryLight }}>{["التاريخ","المستند","البيان","الشريك","مدين","دائن","الرصيد"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>
                <tr style={{ background:C.primaryLight }}>
                  <td colSpan={4} style={{ padding:"8px 12px", color:C.primary, fontWeight:600, fontSize:11 }}>رصيد افتتاحي</td>
                  <td style={{ padding:"8px 12px", color:C.primary, fontWeight:700 }}>{(data?.openingBalance||0)>0?fmt(data?.openingBalance||0):"—"}</td>
                  <td style={{ padding:"8px 12px", color:C.red, fontWeight:700 }}>{(data?.openingBalance||0)<0?fmt(Math.abs(data?.openingBalance||0)):"—"}</td>
                  <td style={{ padding:"8px 12px", color:C.primary, fontWeight:700 }}>{fmt(data?.openingBalance||0)}</td>
                </tr>
                {(data?.lines||[]).map((l:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"8px 12px", color:C.textSec }}>{l.date}</td>
                    <td style={{ padding:"8px 12px", color:C.primary, fontFamily:"monospace", fontSize:11 }}>{l.entryName||l.entry_name}</td>
                    <td style={{ padding:"8px 12px", color:C.text }}>{l.label||"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.textSec }}>{l.partnerName||l.partner_name||"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.teal, fontWeight:(l.debit||0)>0?600:400 }}>{(l.debit||0)>0?fmt(l.debit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.red, fontWeight:(l.credit||0)>0?600:400 }}>{(l.credit||0)>0?fmt(l.credit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:(l.balance||0)>=0?C.primary:C.red, fontWeight:600 }}>{fmt(Math.abs(l.balance||0))} {(l.balance||0)>=0?"م":"د"}</td>
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

// ── التحليل الشهري ────────────────────────────────────────────────────────────
function MonthlyPage({ companyId }:any) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year }, { enabled:!!companyId, staleTime:10*60*1000 });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  const maxVal = data ? Math.max(...data.map((m:any)=>Math.max(m.revenue||0,m.expenses||0)),1) : 1;
  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📅 التحليل الشهري" sub="مقارنة الإيرادات والمصروفات شهرياً"/>
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text }}>
          {[2022,2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {isLoading ? <div style={{ textAlign:"center", padding:60 }}><Spinner/></div> : !data ? <NoData/> : (
        <>
          {/* Bar chart */}
          <Card style={{ padding:"20px", marginBottom:14 }}>
            <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:180, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
              {data.map((m:any,i:number)=>(
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:150 }}>
                    <div style={{ width:10, background:C.primary, borderRadius:"2px 2px 0 0", height:`${Math.max(2,((m.revenue||0)/maxVal)*145)}px`, opacity:0.85, transition:"height 0.3s" }}/>
                    <div style={{ width:10, background:C.amber, borderRadius:"2px 2px 0 0", height:`${Math.max(2,((m.expenses||0)/maxVal)*145)}px`, opacity:0.85, transition:"height 0.3s" }}/>
                    <div style={{ width:10, background:(m.profit||0)>=0?C.teal:C.red, borderRadius:"2px 2px 0 0", height:`${Math.max(2,(Math.abs(m.profit||0)/maxVal)*145)}px`, transition:"height 0.3s" }}/>
                  </div>
                  <span style={{ fontSize:8, color:C.muted }}>{arM[i].slice(0,3)}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:16, marginTop:10, justifyContent:"center" }}>
              {[{c:C.primary,l:"الإيرادات"},{c:C.amber,l:"المصروفات"},{c:C.teal,l:"الأرباح"}].map(s=>(
                <div key={s.l} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:s.c }}/><span style={{ fontSize:11, color:C.textSec }}>{s.l}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ background:C.primaryLight }}>{["الشهر","الإيرادات","المصروفات","صافي الربح","هامش %"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((m:any,i:number)=>{
                  const margin = (m.revenue||0)>0?(((m.profit||0)/(m.revenue||1))*100).toFixed(1):"0";
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                      <td style={{ padding:"9px 12px", fontWeight:600, color:C.text }}>{arM[i]}</td>
                      <td style={{ padding:"9px 12px", color:C.primary, fontWeight:600 }}>{fmt(m.revenue||0)}</td>
                      <td style={{ padding:"9px 12px", color:C.amber, fontWeight:600 }}>{fmt(m.expenses||0)}</td>
                      <td style={{ padding:"9px 12px", color:(m.profit||0)>=0?C.green:C.red, fontWeight:700 }}>{fmt(m.profit||0)}</td>
                      <td style={{ padding:"9px 12px" }}><Badge label={`${margin}%`} bg={parseFloat(margin)>0?C.greenLight:C.redLight} color={parseFloat(margin)>0?C.green:C.red}/></td>
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

// ── النسب المالية ─────────────────────────────────────────────────────────────
function RatiosPage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${yr}-01-01`, dateTo:`${yr}-12-31` }, { enabled:!!companyId });
  const { data:balance } = trpc.journal.balanceSheet.useQuery({ companyId, asOf:`${yr}-12-31` }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  if (!income||!balance) return <div style={{ textAlign:"center", padding:60 }}><Spinner/><p style={{ color:C.muted, marginTop:12 }}>جاري حساب النسب...</p></div>;
  const rev=income.revenue||1, assets=balance.assets||1, equity=balance.equity||1;
  const liab=balance.liabilities||0, profit=income.netProfit||0, gross=income.grossProfit||0;
  const ratios = [
    { cat:"الربحية 💹", items:[
      {name:"هامش الربح الإجمالي",   val:`${((gross/rev)*100).toFixed(1)}%`,    good:gross>0},
      {name:"هامش الربح الصافي",     val:`${((profit/rev)*100).toFixed(1)}%`,   good:profit>0},
      {name:"العائد على الأصول ROA", val:`${((profit/assets)*100).toFixed(1)}%`,good:profit>0},
      {name:"العائد على حقوق الملكية ROE",val:`${((profit/equity)*100).toFixed(1)}%`,good:profit>0},
    ]},
    { cat:"الرافعة المالية ⚖️", items:[
      {name:"نسبة الدين إلى الأصول",       val:`${((liab/assets)*100).toFixed(1)}%`, good:liab/assets<0.5},
      {name:"نسبة الدين إلى حقوق الملكية", val:equity>0?`${(liab/equity).toFixed(2)}x`:"—",good:liab/equity<1},
    ]},
    { cat:"النشاط 🔄", items:[
      {name:"هامش الربح التشغيلي", val:`${((income.operatingProfit/rev)*100).toFixed(1)}%`,good:income.operatingProfit>0},
      {name:"الإيرادات إلى الأصول", val:`${(rev/assets).toFixed(2)}x`, good:rev/assets>0.5},
    ]},
  ];
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="📉 النسب المالية" sub="تحليل الأداء المالي الشامل"/>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {ratios.map((cat,ci)=>(
          <Card key={ci} style={{ padding:"18px 20px" }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>{cat.cat}</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {cat.items.map((r,ri)=>(
                <div key={ri} style={{ padding:"14px 16px", borderRadius:10, background:r.good?C.greenLight:C.redLight, border:`1px solid ${r.good?"#A7F3D0":"#FECACA"}` }}>
                  <p style={{ fontSize:11, color:C.textSec, margin:"0 0 6px" }}>{r.name}</p>
                  <p style={{ fontSize:22, fontWeight:800, color:r.good?C.green:C.red, margin:"0 0 4px" }}>{r.val}</p>
                  <Badge label={r.good?"✓ جيد":"⚠ يحتاج مراجعة"} bg={r.good?"#D1FAE5":"#FEE2E2"} color={r.good?C.green:C.red}/>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── كشف حساب شريك ────────────────────────────────────────────────────────────
function PartnerStatementPage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const [partner, setPartner] = useState("");
  const { data:partners } = trpc.journal.getPartners.useQuery({ companyId }, { enabled:!!companyId });
  const { data, isLoading } = trpc.journal.partnerStatement.useQuery({ companyId, partnerName:partner, dateFrom:dF, dateTo:dT }, { enabled:!!companyId&&!!partner });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="👤 كشف حساب شريك" sub="حركات عميل أو مورد"/>
      <Card style={{ padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ flex:2, minWidth:200 }}>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>الشريك</label>
            <select value={partner} onChange={e=>setPartner(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
              <option value="">— اختر شريكاً —</option>
              {(partners||[]).map((p:any)=><option key={p.partnerName||p.partner_name} value={p.partnerName||p.partner_name}>{p.partnerName||p.partner_name}</option>)}
            </select>
          </div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>من</label><input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
          <div><label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى</label><input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/></div>
        </div>
      </Card>
      {!partner ? <NoData text="اختر شريكاً من القائمة"/> : isLoading ? <div style={{ textAlign:"center", padding:40 }}><Spinner/></div> : (
        <>
          <Card style={{ padding:"14px 18px", marginBottom:12, background:(data?.finalBalance||0)>=0?C.greenLight:C.redLight, border:`1px solid ${(data?.finalBalance||0)>=0?"#A7F3D0":"#FECACA"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontWeight:700, fontSize:14, color:(data?.finalBalance||0)>=0?C.green:C.red }}>الرصيد النهائي</span>
              <span style={{ fontWeight:800, fontSize:20, color:(data?.finalBalance||0)>=0?C.green:C.red }}>{fmt(Math.abs(data?.finalBalance||0))} {(data?.finalBalance||0)>=0?"مدين":"دائن"}</span>
            </div>
          </Card>
          <Card>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ background:C.primaryLight }}>{["التاريخ","المستند","البيان","الحساب","مدين","دائن","الرصيد"].map(h=><th key={h} style={{ padding:"10px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>
                {(data?.lines||[]).map((l:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                    <td style={{ padding:"8px 12px", color:C.textSec }}>{l.date}</td>
                    <td style={{ padding:"8px 12px", color:C.primary, fontFamily:"monospace", fontSize:11 }}>{l.entryName||l.entry_name}</td>
                    <td style={{ padding:"8px 12px", color:C.text }}>{l.label||"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.textSec, fontSize:11 }}>{l.accountCode||l.account_code} {l.accountName||l.account_name}</td>
                    <td style={{ padding:"8px 12px", color:C.teal, fontWeight:(l.debit||0)>0?600:400 }}>{(l.debit||0)>0?fmt(l.debit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:C.red, fontWeight:(l.credit||0)>0?600:400 }}>{(l.credit||0)>0?fmt(l.credit):"—"}</td>
                    <td style={{ padding:"8px 12px", color:(l.balance||0)>=0?C.primary:C.red, fontWeight:600 }}>{fmt(Math.abs(l.balance||0))} {(l.balance||0)>=0?"م":"د"}</td>
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



// ══════════════════════════════════════════════════════════════════════════════
// 📊 صفحات التحليل المالي المتقدم
// ══════════════════════════════════════════════════════════════════════════════

// ── KPI Cards Component ───────────────────────────────────────────────────────
function Sparkline({ data, color, height=40 }:any) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100, h = height;
  const pts = data.map((v:number, i:number) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 100 ${h}`} style={{ width:"100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={`0,${h} ${pts} 100,${h}`} fill={`${color}20`} stroke="none"/>
    </svg>
  );
}

// ── لوحة الأداء التنفيذية ─────────────────────────────────────────────────────
function ExecutiveDashboardPage({ companyId, co }:any) {
  const yr = new Date().getFullYear();
  const { data:income, isLoading:il } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${yr}-01-01`, dateTo:`${yr}-12-31` }, { enabled:!!companyId });
  const { data:balance, isLoading:bl } = trpc.journal.balanceSheet.useQuery({ companyId, asOf:`${yr}-12-31` }, { enabled:!!companyId });
  const { data:monthly } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year:yr }, { enabled:!!companyId });
  const { data:sync } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  if (il||bl) return <div style={{ textAlign:"center", padding:80 }}><Spinner/><p style={{ color:C.muted, marginTop:14, fontSize:14 }}>جاري تحليل البيانات...</p></div>;
  if (!income||!balance) return <NoData text="لا توجد بيانات — قم بالمزامنة أولاً"/>;

  const rev    = income.revenue||0;
  const profit = income.netProfit||0;
  const assets = balance.assets||1;
  const equity = balance.equity||1;
  const liab   = balance.liabilities||0;
  const gross  = income.grossProfit||0;
  const exp    = income.expenses||0;

  // Monthly trend data
  const revTrend = (monthly||[]).map((m:any) => m.revenue||0);
  const profitTrend = (monthly||[]).map((m:any) => m.profit||0);
  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  // Traffic light indicators
  const indicators = [
    { name:"هامش الربح الإجمالي",  val:rev>0?(gross/rev*100):0, target:30, unit:"%" },
    { name:"هامش الربح الصافي",    val:rev>0?(profit/rev*100):0, target:15, unit:"%" },
    { name:"العائد على الأصول",    val:(profit/assets*100), target:10, unit:"%" },
    { name:"العائد على حقوق الملكية", val:(profit/equity*100), target:15, unit:"%" },
    { name:"نسبة الدين للأصول",    val:(liab/assets*100), target:50, unit:"%", inverse:true },
    { name:"نسبة المصروفات للإيرادات", val:rev>0?(exp/rev*100):0, target:40, unit:"%", inverse:true },
  ];

  const getLight = (v:number, t:number, inv:boolean) => {
    if (inv) return v<=t*0.7?"green":v<=t?"amber":"red";
    return v>=t?"green":v>=t*0.7?"amber":"red";
  };
  const lightColors:any = { green:C.green, amber:C.amber, red:C.red };
  const lightBg:any = { green:C.greenLight, amber:C.amberLight, red:C.redLight };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:900, color:C.text, margin:"0 0 4px" }}>📊 لوحة الأداء التنفيذية</h2>
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:13, color:C.textSec }}>{co?.name}</span>
          <Badge label={`سنة ${yr}`} bg={C.primaryLight} color={C.primary}/>
          <Badge label={`${fmt(sync?.totalEntries||0)} قيد محاسبي`} bg={C.greenLight} color={C.green}/>
          {profit > 0
            ? <Badge label="✅ شركة رابحة" bg={C.greenLight} color={C.green}/>
            : <Badge label="⚠️ شركة خاسرة" bg={C.redLight} color={C.red}/>}
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
        <KPICard label="إجمالي الإيرادات"    value={fmtM(rev)}    icon="💰" color={C.primary} bg={C.primaryLight}
          sub={`مجمل الربح: ${fmtM(gross)}`}
          trendVal={revTrend.length>=2?(revTrend[revTrend.length-1]-revTrend[revTrend.length-2])/(revTrend[revTrend.length-2]||1)*100:undefined}/>
        <KPICard label="صافي الربح"          value={fmtM(profit)} icon={profit>=0?"📈":"📉"} color={profit>=0?C.green:C.red} bg={profit>=0?C.greenLight:C.redLight}
          sub={`هامش: ${rev>0?(profit/rev*100).toFixed(1):0}%`}/>
        <KPICard label="إجمالي الأصول"      value={fmtM(assets)} icon="🏦" color={C.teal} bg={C.tealLight}
          sub={`حقوق الملكية: ${fmtM(equity)}`}/>
        <KPICard label="إجمالي المصروفات"   value={fmtM(exp)}    icon="💸" color={C.amber} bg={C.amberLight}
          sub={`${rev>0?(exp/rev*100).toFixed(1):0}% من الإيرادات`}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14, marginBottom:14 }}>
        {/* Revenue chart */}
        <Card style={{ padding:"18px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:0 }}>📅 الأداء الشهري</p>
            <div style={{ display:"flex", gap:12 }}>
              {[{c:C.primary,l:"إيرادات"},{c:C.green,l:"أرباح"},{c:C.red,l:"مصروفات"}].map(s=>(
                <div key={s.l} style={{ display:"flex", gap:4, alignItems:"center" }}>
                  <div style={{ width:8,height:8,borderRadius:2,background:s.c }}/><span style={{ fontSize:10,color:C.muted }}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
          {monthly && (
            <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:140, marginBottom:8 }}>
              {(monthly as any[]).map((m:any,i:number)=>{
                const maxV = Math.max(...(monthly as any[]).map((x:any)=>Math.max(x.revenue||0,x.expenses||0)),1);
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ display:"flex", gap:1, alignItems:"flex-end", height:120 }}>
                      <div style={{ width:8,background:C.primary,borderRadius:"2px 2px 0 0",height:`${Math.max(2,((m.revenue||0)/maxV)*115)}px`,opacity:0.8 }}/>
                      <div style={{ width:8,background:C.amber,borderRadius:"2px 2px 0 0",height:`${Math.max(2,((m.expenses||0)/maxV)*115)}px`,opacity:0.8 }}/>
                      <div style={{ width:8,background:(m.profit||0)>=0?C.green:C.red,borderRadius:"2px 2px 0 0",height:`${Math.max(2,(Math.abs(m.profit||0)/maxV)*115)}px`,opacity:0.9 }}/>
                    </div>
                    <span style={{ fontSize:8,color:C.muted,whiteSpace:"nowrap" }}>{arM[i].slice(0,3)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:10 }}>
            {[
              {l:"أعلى إيرادات", v:fmtM(Math.max(...(monthly||[]).map((m:any)=>m.revenue||0))), c:C.primary},
              {l:"أعلى مصروفات", v:fmtM(Math.max(...(monthly||[]).map((m:any)=>m.expenses||0))), c:C.amber},
              {l:"أعلى ربح",     v:fmtM(Math.max(...(monthly||[]).map((m:any)=>m.profit||0))),   c:C.green},
            ].map((s,i)=>(
              <div key={i} style={{ padding:"8px 10px", borderRadius:8, background:C.bg, border:`1px solid ${C.border}`, textAlign:"center" }}>
                <p style={{ fontSize:9, color:C.muted, margin:"0 0 3px" }}>{s.l}</p>
                <p style={{ fontSize:13, fontWeight:800, color:s.c, margin:0 }}>{s.v}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Traffic lights */}
        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>🚦 مؤشرات الأداء</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {indicators.map((ind,i)=>{
              const light = getLight(ind.val, ind.target, ind.inverse||false);
              const lc = lightColors[light]; const lb = lightBg[light];
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", borderRadius:8, background:lb, border:`1px solid ${lc}30` }}>
                  <span style={{ fontSize:11, color:C.text }}>{ind.name}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:lc }}>{ind.val.toFixed(1)}{ind.unit}</span>
                    <div style={{ width:10,height:10,borderRadius:"50%",background:lc,boxShadow:`0 0 4px ${lc}` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Income structure */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:13, color:C.text, margin:"0 0 14px" }}>📊 هيكل الإيرادات</p>
          {rev > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { l:"الإيرادات الإجمالية", v:rev, pct:100, c:C.primary },
                { l:"تكلفة المبيعات",      v:income.cogs||0, pct:(income.cogs||0)/rev*100, c:C.amber },
                { l:"مجمل الربح",          v:gross, pct:gross/rev*100, c:C.teal },
                { l:"المصروفات",           v:exp, pct:exp/rev*100, c:C.red },
                { l:"صافي الربح",          v:profit, pct:profit/rev*100, c:C.green },
              ].map((s,i)=>(
                <div key={i}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, color:C.text }}>{s.l}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:s.c }}>{fmtM(s.v)} <span style={{ color:C.muted,fontWeight:400 }}>({s.pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ background:"#F1F5F9", borderRadius:4, height:6, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100,Math.abs(s.pct))}%`, height:"100%", background:s.c, borderRadius:4, transition:"width 0.5s" }}/>
                  </div>
                </div>
              ))}
            </div>
          ) : <NoData text="لا توجد إيرادات"/>}
        </Card>

        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:13, color:C.text, margin:"0 0 14px" }}>🏦 هيكل الميزانية</p>
          {assets > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { l:"إجمالي الأصول",     v:assets,  pct:100,                c:C.primary },
                { l:"الالتزامات",        v:liab,    pct:liab/assets*100,    c:C.red },
                { l:"حقوق الملكية",      v:equity,  pct:equity/assets*100,  c:C.green },
                { l:"الأرباح المحتجزة",  v:profit,  pct:Math.abs(profit/assets*100), c:C.teal },
              ].map((s,i)=>(
                <div key={i}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, color:C.text }}>{s.l}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:s.c }}>{fmtM(s.v)} <span style={{ color:C.muted,fontWeight:400 }}>({s.pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ background:"#F1F5F9", borderRadius:4, height:6, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100,Math.abs(s.pct))}%`, height:"100%", background:s.c, borderRadius:4 }}/>
                  </div>
                </div>
              ))}
            </div>
          ) : <NoData text="لا توجد بيانات"/>}
        </Card>

        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:13, color:C.text, margin:"0 0 14px" }}>🎯 النسب الرئيسية</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { l:"هامش الربح الإجمالي", v:rev>0?(gross/rev*100).toFixed(1)+"%":"-", good:gross/rev>0.3 },
              { l:"هامش الربح الصافي",   v:rev>0?(profit/rev*100).toFixed(1)+"%":"-", good:profit/rev>0.1 },
              { l:"ROA",                 v:(profit/assets*100).toFixed(1)+"%", good:profit/assets>0.05 },
              { l:"ROE",                 v:equity>0?(profit/equity*100).toFixed(1)+"%":"-", good:profit/equity>0.1 },
              { l:"نسبة الرفع المالي",   v:equity>0?(liab/equity).toFixed(2)+"x":"-", good:liab/equity<1 },
              { l:"الإيرادات/الأصول",   v:(rev/assets).toFixed(2)+"x", good:rev/assets>0.5 },
            ].map((r,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:12, color:C.textSec }}>{r.l}</span>
                <span style={{ fontSize:13, fontWeight:800, color:r.good?C.green:C.red }}>{r.v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── تحليل التدفق النقدي ───────────────────────────────────────────────────────
function CashFlowPage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${yr}-01-01`, dateTo:`${yr}-12-31` }, { enabled:!!companyId });
  const { data:balance } = trpc.journal.balanceSheet.useQuery({ companyId, asOf:`${yr}-12-31` }, { enabled:!!companyId });
  const { data:monthly } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year:yr }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  if (!income||!balance) return <div style={{ textAlign:"center", padding:60 }}><Spinner/></div>;

  // Estimate cash flow from income statement (indirect method)
  const netProfit      = income.netProfit || 0;
  const operatingCF    = netProfit + (income.cogs||0)*0.1; // Depreciation estimate
  const investingCF    = -(balance.assets||0) * 0.05; // Capex estimate
  const financingCF    = -(balance.liabilities||0) * 0.1; // Debt repayment estimate
  const netCF          = operatingCF + investingCF + financingCF;

  const cfRows = [
    { label:"صافي الربح",                      val:netProfit,     type:"income"  },
    { label:"تعديلات غير نقدية (الإهلاك)",      val:operatingCF-netProfit, type:"adj" },
    { label:"التدفق من العمليات التشغيلية",    val:operatingCF,   type:"total",  bold:true },
    { label:"الاستثمارات الرأسمالية (تقديري)", val:investingCF,   type:"invest"  },
    { label:"التدفق من الاستثمار",             val:investingCF,   type:"total",  bold:true },
    { label:"سداد الديون (تقديري)",            val:financingCF,   type:"finance" },
    { label:"التدفق من التمويل",               val:financingCF,   type:"total",  bold:true },
    { label:"صافي التدفق النقدي",              val:netCF,         type:"net",    bold:true },
  ];

  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const cumulative = (monthly||[]).reduce((acc:number[], m:any, i:number) => {
    const prev = acc[i-1]||0;
    return [...acc, prev + (m.profit||0)];
  }, [] as number[]);

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="💧 تحليل التدفق النقدي" sub="تحليل تدفقات النقد التشغيلية والاستثمارية والتمويلية"/>
      <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:14 }}>
        <div>
          {/* Cash flow statement */}
          <Card style={{ marginBottom:14, overflow:"hidden" }}>
            <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:C.primaryLight }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.primary, margin:0 }}>قائمة التدفقات النقدية (تقديري)</p>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <tbody>
                {cfRows.map((r,i)=>(
                  <tr key={i} style={{
                    background:r.type==="net"?C.primaryLight:r.type==="total"?"#F8FAFF":i%2===0?"#fff":"#F8FAFF",
                    borderBottom:`1px solid ${C.border}`,
                  }}>
                    <td style={{ padding:"10px 18px", color:C.text, fontWeight:r.bold?700:400, paddingRight:r.type==="income"||r.type==="adj"||r.type==="invest"||r.type==="finance"?"30px":"18px" }}>
                      {r.label}
                    </td>
                    <td style={{ padding:"10px 18px", textAlign:"left", color:r.val>=0?C.primary:C.red, fontWeight:r.bold?800:600 }}>
                      {r.val>=0?fmt(r.val):`(${fmt(Math.abs(r.val))})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cumulative cash flow chart */}
          <Card style={{ padding:"18px 20px" }}>
            <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>📈 التراكم النقدي الشهري</p>
            <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:100, marginBottom:8 }}>
              {cumulative.map((v,i)=>{
                const maxV = Math.max(...cumulative.map(Math.abs),1);
                const h = Math.max(4,(Math.abs(v)/maxV)*90);
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ width:"100%", background:v>=0?C.teal:C.red, borderRadius:"2px 2px 0 0", height:`${h}px`, opacity:0.8 }}/>
                    <span style={{ fontSize:8,color:C.muted }}>{arM[i].slice(0,3)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[
            { l:"التدفق التشغيلي",  v:operatingCF, icon:"⚙️", good:operatingCF>0 },
            { l:"التدفق الاستثماري", v:investingCF, icon:"🏗️", good:true },
            { l:"التدفق التمويلي",   v:financingCF, icon:"🏦", good:true },
            { l:"صافي التدفق",       v:netCF,       icon:"💧", good:netCF>0 },
          ].map((s,i)=>(
            <Card key={i} style={{ padding:"16px 18px", background:s.good?C.greenLight:C.redLight, border:`1px solid ${s.good?"#A7F3D0":"#FECACA"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ fontSize:11, color:C.textSec, margin:"0 0 4px" }}>{s.l}</p>
                  <p style={{ fontSize:20, fontWeight:800, color:s.v>=0?C.green:C.red, margin:0 }}>
                    {s.v>=0?fmtM(s.v):`(${fmtM(Math.abs(s.v))})`}
                  </p>
                </div>
                <span style={{ fontSize:28 }}>{s.icon}</span>
              </div>
            </Card>
          ))}

          <Card style={{ padding:"16px 18px" }}>
            <p style={{ fontWeight:800, fontSize:13, color:C.text, margin:"0 0 12px" }}>📋 ملاحظات</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { text:"التدفقات مبنية على طريقة غير مباشرة (تقديرية)", icon:"ℹ️" },
                { text:"الإهلاك يُحسب كنسبة من التكاليف", icon:"📊" },
                { text:"للحصول على بيانات دقيقة، تحقق من دليل الحسابات", icon:"✏️" },
              ].map((n,i)=>(
                <p key={i} style={{ fontSize:11, color:C.textSec, margin:0, display:"flex", gap:6 }}>
                  <span>{n.icon}</span>{n.text}
                </p>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── تحليل التكاليف والمصروفات ─────────────────────────────────────────────────
function CostAnalysisPage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId, staleTime:5*60*1000 });
  const { data:monthly } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year:yr }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  if (!income) return <div style={{ textAlign:"center",padding:60 }}><Spinner/></div>;

  const totalCost = (income.cogs||0)+(income.expenses||0)+(income.otherExpenses||0);
  const rev       = income.revenue || 1;
  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  const costItems = [
    { l:"تكلفة المبيعات (COGS)",   v:income.cogs||0,         icon:"📦", c:C.amber },
    { l:"المصروفات التشغيلية",     v:income.expenses||0,     icon:"⚙️",  c:C.red },
    { l:"مصروفات أخرى",           v:income.otherExpenses||0, icon:"📋", c:C.purple },
  ].filter(x=>x.v>0);

  // Break-even analysis
  const fixedCosts   = income.expenses||0;
  const variableCosts = income.cogs||0;
  const contribMargin = rev > 0 ? (rev - variableCosts) / rev : 0;
  const breakEven     = contribMargin > 0 ? fixedCosts / contribMargin : 0;
  const safetyMargin  = rev > 0 ? ((rev - breakEven) / rev * 100) : 0;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📉 تحليل التكاليف والمصروفات" sub="هيكل التكاليف ونقطة التعادل"/>
        <div style={{ display:"flex", gap:8 }}>
          <input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          <span style={{ color:C.muted }}>—</span>
          <input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
        <KPICard label="إجمالي التكاليف"      value={fmtM(totalCost)} icon="💸" color={C.red}    bg={C.redLight}/>
        <KPICard label="نسبة التكاليف"        value={`${(totalCost/rev*100).toFixed(1)}%`} icon="📊" color={C.amber} bg={C.amberLight} sub="من الإيرادات"/>
        <KPICard label="نقطة التعادل"         value={fmtM(breakEven)} icon="⚖️" color={C.purple} bg={C.purpleLight}/>
        <KPICard label="هامش الأمان"          value={`${safetyMargin.toFixed(1)}%`} icon="🛡️" color={safetyMargin>20?C.green:C.red} bg={safetyMargin>20?C.greenLight:C.redLight}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        {/* Cost structure */}
        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>🥧 هيكل التكاليف</p>
          {costItems.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {costItems.map((s,i)=>(
                <div key={i}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:C.text }}>{s.icon} {s.l}</span>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ fontSize:12, color:C.muted }}>{(s.v/totalCost*100).toFixed(1)}%</span>
                      <span style={{ fontSize:12, fontWeight:700, color:s.c }}>{fmtM(s.v)}</span>
                    </div>
                  </div>
                  <div style={{ background:"#F1F5F9", borderRadius:4, height:8, overflow:"hidden" }}>
                    <div style={{ width:`${(s.v/totalCost*100)}%`, height:"100%", background:s.c, borderRadius:4 }}/>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:8, padding:"10px 14px", borderRadius:8, background:C.bg, border:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontWeight:700, color:C.text }}>الإجمالي</span>
                <span style={{ fontWeight:800, color:C.red }}>{fmtM(totalCost)}</span>
              </div>
            </div>
          ) : <NoData text="لا توجد بيانات مصروفات"/>}
        </Card>

        {/* Break-even analysis */}
        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>⚖️ تحليل نقطة التعادل</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              {l:"الإيرادات الفعلية",       v:fmtM(rev),          c:C.primary},
              {l:"التكاليف المتغيرة",       v:fmtM(variableCosts), c:C.amber},
              {l:"هامش المساهمة",           v:`${(contribMargin*100).toFixed(1)}%`, c:C.teal},
              {l:"التكاليف الثابتة",        v:fmtM(fixedCosts),   c:C.red},
              {l:"نقطة التعادل (إيرادات)", v:fmtM(breakEven),    c:C.purple, bold:true},
              {l:"هامش الأمان",             v:`${safetyMargin.toFixed(1)}%`, c:safetyMargin>20?C.green:C.red, bold:true},
            ].map((r,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<5?`1px solid ${C.border}`:"none" }}>
                <span style={{ fontSize:12, color:C.textSec }}>{r.l}</span>
                <span style={{ fontSize:13, fontWeight:r.bold?800:600, color:r.c }}>{r.v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Monthly expenses trend */}
      {monthly && (
        <Card style={{ padding:"18px 20px" }}>
          <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>📅 اتجاه المصروفات الشهرية</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(12,1fr)", gap:4 }}>
            {(monthly as any[]).map((m:any,i:number)=>{
              const maxE = Math.max(...(monthly as any[]).map((x:any)=>x.expenses||0),1);
              const h    = Math.max(4,((m.expenses||0)/maxE)*80);
              const eff  = (m.revenue||1)>0?(m.expenses||0)/(m.revenue||1)*100:0;
              return (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <span style={{ fontSize:8, color:eff>50?C.red:C.green, fontWeight:600 }}>{eff.toFixed(0)}%</span>
                  <div style={{ width:"100%", background:eff>50?C.red:C.teal, borderRadius:"2px 2px 0 0", height:`${h}px`, opacity:0.8 }}/>
                  <span style={{ fontSize:7, color:C.muted }}>{arM[i].slice(0,3)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:10, justifyContent:"center" }}>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}><div style={{ width:8,height:8,borderRadius:2,background:C.teal }}/><span style={{ fontSize:10,color:C.muted }}>مصروفات أقل من 50% من الإيرادات</span></div>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}><div style={{ width:8,height:8,borderRadius:2,background:C.red }}/><span style={{ fontSize:10,color:C.muted }}>مصروفات أعلى من 50% من الإيرادات</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── مقارنة الفترات ────────────────────────────────────────────────────────────
function PeriodsComparePage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const { data:cur }  = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${yr}-01-01`,   dateTo:`${yr}-12-31` }, { enabled:!!companyId });
  const { data:prev } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:`${yr-1}-01-01`, dateTo:`${yr-1}-12-31` }, { enabled:!!companyId });
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;
  if (!cur||!prev) return <div style={{ textAlign:"center",padding:60 }}><Spinner/></div>;

  const diff = (c:number, p:number) => p!==0 ? ((c-p)/Math.abs(p)*100) : 0;
  const rows = [
    { l:"الإيرادات",              c:cur.revenue||0,        p:prev.revenue||0 },
    { l:"تكلفة المبيعات",         c:cur.cogs||0,           p:prev.cogs||0 },
    { l:"مجمل الربح",             c:cur.grossProfit||0,    p:prev.grossProfit||0, bold:true },
    { l:"المصروفات",              c:cur.expenses||0,       p:prev.expenses||0 },
    { l:"الربح التشغيلي",         c:cur.operatingProfit||0,p:prev.operatingProfit||0, bold:true },
    { l:"صافي الربح",             c:cur.netProfit||0,      p:prev.netProfit||0, bold:true },
    { l:"هامش الربح الإجمالي",   c:(cur.revenue||1)>0?(cur.grossProfit||0)/(cur.revenue||1)*100:0, p:(prev.revenue||1)>0?(prev.grossProfit||0)/(prev.revenue||1)*100:0, isPercent:true },
    { l:"هامش الربح الصافي",     c:(cur.revenue||1)>0?(cur.netProfit||0)/(cur.revenue||1)*100:0,   p:(prev.revenue||1)>0?(prev.netProfit||0)/(prev.revenue||1)*100:0,   isPercent:true },
  ];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="🔄 مقارنة الفترات" sub={`مقارنة ${yr} مع ${yr-1}`}/>
      <Card>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:C.primaryLight }}>
              <th style={{ padding:"12px 18px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>البيان</th>
              <th style={{ padding:"12px 14px", textAlign:"center", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>{yr}</th>
              <th style={{ padding:"12px 14px", textAlign:"center", color:C.muted, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>{yr-1}</th>
              <th style={{ padding:"12px 14px", textAlign:"center", color:C.teal, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>التغيير</th>
              <th style={{ padding:"12px 14px", textAlign:"center", color:C.teal, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>{
              const d = diff(r.c, r.p);
              const good = r.l.includes("مصروفات")||r.l.includes("تكلفة") ? d<=0 : d>=0;
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:r.bold?"#F0F7FF":i%2===0?"#fff":"#F8FAFF" }}>
                  <td style={{ padding:"10px 18px", color:C.text, fontWeight:r.bold?700:400 }}>{r.l}</td>
                  <td style={{ padding:"10px 14px", textAlign:"center", color:C.primary, fontWeight:r.bold?800:600 }}>{r.isPercent?`${r.c.toFixed(1)}%`:fmt(r.c)}</td>
                  <td style={{ padding:"10px 14px", textAlign:"center", color:C.muted }}>{r.isPercent?`${r.p.toFixed(1)}%`:fmt(r.p)}</td>
                  <td style={{ padding:"10px 14px", textAlign:"center", color:good?C.green:C.red, fontWeight:600 }}>{r.isPercent?`${(r.c-r.p).toFixed(1)}%`:fmt(Math.abs(r.c-r.p))}{r.c>=r.p?" ▲":" ▼"}</td>
                  <td style={{ padding:"10px 14px", textAlign:"center" }}>
                    <Badge label={`${d>=0?"+":""}${d.toFixed(1)}%`} bg={good?C.greenLight:C.redLight} color={good?C.green:C.red}/>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// 📅 تحليل الشركة شهرياً — تفاصيل كل شهر
// ══════════════════════════════════════════════════════════════════════════════
function MonthlyDetailPage({ companyId, co }:any) {
  const yr = new Date().getFullYear();
  const [year, setYear] = useState(yr);
  const [selMonth, setSelMonth] = useState(new Date().getMonth()+1);
  const { data:annual } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year }, { enabled:!!companyId, staleTime:10*60*1000 });
  const { data:detail, isLoading } = (trpc as any).journal.monthlyDetail.useQuery({ companyId, year, month:selMonth }, { enabled:!!companyId });

  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const maxVal = annual ? Math.max(...(annual as any[]).map((m:any)=>Math.max(m.revenue||0,m.expenses||0)),1) : 1;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📅 التحليل الشهري التفصيلي" sub={co?.name}/>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text }}>
          {[yr-1,yr,yr+1].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Month selector + mini bars */}
      <Card style={{ padding:"16px 20px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
          {arM.map((m,i)=>{
            const md = annual ? (annual as any[])[i] : null;
            const rev = md?.revenue||0, exp = md?.expenses||0, pft = md?.profit||0;
            const h = maxVal>0?Math.max(4,(rev/maxVal)*60):4;
            const isActive = selMonth===i+1;
            return (
              <div key={i} onClick={()=>setSelMonth(i+1)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", flexShrink:0, minWidth:52,
                  padding:"8px 6px", borderRadius:10,
                  background:isActive?C.primaryLight:"transparent",
                  border:`1.5px solid ${isActive?C.primary:C.border}`,
                  transition:"all 0.15s" }}>
                <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:60 }}>
                  <div style={{ width:7, background:C.primary, borderRadius:"2px 2px 0 0", height:`${Math.max(4,(rev/maxVal)*56)}px`, opacity:0.8 }}/>
                  <div style={{ width:7, background:C.amber,   borderRadius:"2px 2px 0 0", height:`${Math.max(4,(exp/maxVal)*56)}px`, opacity:0.8 }}/>
                  <div style={{ width:7, background:pft>=0?C.green:C.red, borderRadius:"2px 2px 0 0", height:`${Math.max(4,(Math.abs(pft)/maxVal)*56)}px`, opacity:0.9 }}/>
                </div>
                <span style={{ fontSize:10, fontWeight:isActive?800:400, color:isActive?C.primary:C.textSec }}>{m.slice(0,3)}</span>
                {rev>0 && <span style={{ fontSize:9, color:pft>=0?C.green:C.red }}>{fmtM(pft)}</span>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected month detail */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
        <h3 style={{ fontSize:17, fontWeight:800, color:C.text, margin:0 }}>تفاصيل شهر {arM[selMonth-1]} {year}</h3>
        {detail && <Badge label={detail.netProfit>=0?"✅ رابح":"❌ خاسر"} bg={detail.netProfit>=0?C.greenLight:C.redLight} color={detail.netProfit>=0?C.green:C.red}/>}
      </div>

      {isLoading ? <div style={{ textAlign:"center",padding:40 }}><Spinner/></div> : !detail ? <NoData/> : (
        <>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
            {[
              {l:"الإيرادات",    v:detail.revenue,    c:C.primary, bg:C.primaryLight, icon:"💰"},
              {l:"تكلفة المبيعات",v:detail.cogs,      c:C.amber,   bg:C.amberLight,   icon:"📦"},
              {l:"المصروفات",   v:detail.expenses,   c:C.red,     bg:C.redLight,     icon:"💸"},
              {l:"صافي الربح",  v:detail.netProfit,  c:detail.netProfit>=0?C.green:C.red, bg:detail.netProfit>=0?C.greenLight:C.redLight, icon:detail.netProfit>=0?"📈":"📉"},
            ].map((s,i)=>(
              <KPICard key={i} label={s.l} value={fmtM(s.v)} icon={s.icon} color={s.c} bg={s.bg}
                sub={detail.revenue>0?`${(Math.abs(s.v)/detail.revenue*100).toFixed(1)}% من الإيرادات`:""}/>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {/* Revenue detail */}
            <Card style={{ overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", background:C.primaryLight, borderBottom:`1px solid ${C.primarySoft}` }}>
                <p style={{ fontWeight:800, fontSize:13, color:C.primary, margin:0 }}>
                  💰 تفصيل الإيرادات — {fmtM(detail.revenue)}
                </p>
              </div>
              {(detail.revenueDetail||[]).length === 0 ? <div style={{ padding:20, textAlign:"center", color:C.muted, fontSize:12 }}>لا توجد إيرادات هذا الشهر</div> : (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead><tr style={{ background:"#F8FAFF" }}>
                    <th style={{ padding:"8px 12px", textAlign:"right", color:C.muted, fontWeight:600 }}>الحساب</th>
                    <th style={{ padding:"8px 12px", textAlign:"right", color:C.muted, fontWeight:600 }}>الشريك</th>
                    <th style={{ padding:"8px 12px", textAlign:"center", color:C.muted, fontWeight:600 }}>المبلغ</th>
                  </tr></thead>
                  <tbody>
                    {(detail.revenueDetail as any[]).filter((r:any)=>Number(r.amount)>0).map((r:any,i:number)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                        <td style={{ padding:"7px 12px", color:C.text }}><span style={{ color:C.muted,fontSize:10 }}>{r.account_code} </span>{r.account_name}</td>
                        <td style={{ padding:"7px 12px", color:C.textSec, fontSize:10 }}>{r.partner_name||"—"}</td>
                        <td style={{ padding:"7px 12px", textAlign:"center", color:C.primary, fontWeight:700 }}>{fmt(Number(r.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Expense detail */}
            <Card style={{ overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", background:C.redLight, borderBottom:`1px solid #FECACA` }}>
                <p style={{ fontWeight:800, fontSize:13, color:C.red, margin:0 }}>
                  💸 تفصيل المصروفات — {fmtM(detail.expenses+detail.cogs)}
                </p>
              </div>
              {(detail.expenseDetail||[]).length === 0 ? <div style={{ padding:20, textAlign:"center", color:C.muted, fontSize:12 }}>لا توجد مصروفات هذا الشهر</div> : (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead><tr style={{ background:"#FFF5F5" }}>
                    <th style={{ padding:"8px 12px", textAlign:"right", color:C.muted, fontWeight:600 }}>الحساب</th>
                    <th style={{ padding:"8px 12px", textAlign:"right", color:C.muted, fontWeight:600 }}>الشريك</th>
                    <th style={{ padding:"8px 12px", textAlign:"center", color:C.muted, fontWeight:600 }}>المبلغ</th>
                  </tr></thead>
                  <tbody>
                    {(detail.expenseDetail as any[]).filter((r:any)=>Number(r.amount)>0).map((r:any,i:number)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#FFF8F8" }}>
                        <td style={{ padding:"7px 12px", color:C.text }}><span style={{ color:C.muted,fontSize:10 }}>{r.account_code} </span>{r.account_name}</td>
                        <td style={{ padding:"7px 12px", color:C.textSec, fontSize:10 }}>{r.partner_name||"—"}</td>
                        <td style={{ padding:"7px 12px", textAlign:"center", color:C.red, fontWeight:700 }}>{fmt(Number(r.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 🏢 مقارنة الشركات — على مستوى المجموعة
// ══════════════════════════════════════════════════════════════════════════════
function MultiCompanyPage({ currentUser }:any) {
  const yr = new Date().getFullYear();
  const [year, setYear]         = useState(yr);
  const [selView, setSelView]   = useState<"summary"|"monthly"|"ratios">("summary");
  const [selCos, setSelCos]     = useState<number[]>([]);
  const { data:companies }      = trpc.company.list.useQuery();

  // Auto-select all companies on load
  useEffect(()=>{
    if (companies?.length && selCos.length===0) {
      setSelCos(companies.map((c:any)=>c.id));
    }
  },[companies]);

  const { data:summary, isLoading:sl } = (trpc as any).journal.multiCompanySummary.useQuery(
    { companyIds:selCos, year }, { enabled:selCos.length>0 }
  );
  const { data:monthly, isLoading:ml } = (trpc as any).journal.multiCompanyMonthly.useQuery(
    { companyIds:selCos, year }, { enabled:selCos.length>0 && selView==="monthly" }
  );

  const arM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const COLORS = [C.primary, C.teal, C.amber, C.purple, C.red, C.green, "#06B6D4", "#F97316"];

  const maxRev = summary ? Math.max(...(summary as any[]).map((s:any)=>s.revenue||0), 1) : 1;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <PageTitle title="🏢 مقارنة الشركات" sub="تحليل الأداء عبر جميع الشركات"/>
        <div style={{ display:"flex", gap:8 }}>
          <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text }}>
            {[yr-1,yr,yr+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Company selector */}
      {(companies||[]).length > 0 && (
        <Card style={{ padding:"12px 16px", marginBottom:14 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.muted, fontWeight:600 }}>الشركات:</span>
            {(companies as any[]).map((co:any,i:number)=>(
              <label key={co.id} onClick={()=>setSelCos(s=>s.includes(co.id)?s.filter(x=>x!==co.id):[...s,co.id])}
                style={{ display:"flex", gap:6, alignItems:"center", padding:"5px 12px", borderRadius:20, cursor:"pointer",
                  background:selCos.includes(co.id)?`${COLORS[i%8]}20`:C.bg,
                  border:`1.5px solid ${selCos.includes(co.id)?COLORS[i%8]:C.border}` }}>
                <div style={{ width:10,height:10,borderRadius:"50%",background:selCos.includes(co.id)?COLORS[i%8]:"#D1D5DB" }}/>
                <span style={{ fontSize:12, fontWeight:600, color:selCos.includes(co.id)?COLORS[i%8]:C.textSec }}>{co.name}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* View tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[{k:"summary",l:"📊 ملخص سنوي"},{k:"monthly",l:"📅 مقارنة شهرية"},{k:"ratios",l:"📉 النسب المالية"}].map(v=>(
          <button key={v.k} onClick={()=>setSelView(v.k as any)}
            style={{ padding:"8px 18px", borderRadius:9, border:`1.5px solid ${selView===v.k?C.primary:C.border}`, background:selView===v.k?C.primary:"#fff", color:selView===v.k?"#fff":C.textSec, cursor:"pointer", fontSize:12, fontWeight:selView===v.k?700:400 }}>
            {v.l}
          </button>
        ))}
      </div>

      {/* ── SUMMARY VIEW ── */}
      {selView==="summary" && (
        <>
          {sl ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> : !summary?.length ? <NoData text="لا توجد بيانات — قم بالمزامنة"/> : (
            <>
              {/* Revenue comparison bars */}
              <Card style={{ padding:"20px", marginBottom:14 }}>
                <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 16px" }}>💰 مقارنة الإيرادات السنوية</p>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {(summary as any[]).sort((a:any,b:any)=>b.revenue-a.revenue).map((co:any,i:number)=>(
                    <div key={co.companyId}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{co.companyName}</span>
                        <div style={{ display:"flex", gap:12 }}>
                          <span style={{ fontSize:12, color:C.primary }}>{fmtM(co.revenue)}</span>
                          <Badge label={co.netProfit>=0?`ربح: ${fmtM(co.netProfit)}`:`خسارة: (${fmtM(Math.abs(co.netProfit))})`} bg={co.netProfit>=0?C.greenLight:C.redLight} color={co.netProfit>=0?C.green:C.red}/>
                        </div>
                      </div>
                      <div style={{ background:"#F1F5F9", borderRadius:6, height:10, overflow:"hidden", position:"relative" }}>
                        <div style={{ width:`${(co.revenue/maxRev)*100}%`, height:"100%", background:COLORS[i%8], borderRadius:6, transition:"width 0.5s" }}/>
                        <div style={{ position:"absolute", top:0, right:`${100-(co.revenue/maxRev)*100*(co.expenses/co.revenue)}%`, width:`${(co.expenses/co.revenue)*(co.revenue/maxRev)*100}%`, height:"100%", background:`${COLORS[i%8]}60` }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Summary table */}
              <Card style={{ overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:700 }}>
                    <thead>
                      <tr style={{ background:C.primaryLight }}>
                        {["الشركة","الإيرادات","تكلفة المبيعات","مجمل الربح","هامش إجمالي%","المصروفات","صافي الربح","هامش صافي%","ROA","ROE"].map(h=>(
                          <th key={h} style={{ padding:"10px 10px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, whiteSpace:"nowrap", fontSize:10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(summary as any[]).map((co:any,i:number)=>(
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                          <td style={{ padding:"9px 10px" }}>
                            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                              <div style={{ width:8,height:8,borderRadius:"50%",background:COLORS[i%8],flexShrink:0 }}/>
                              <span style={{ color:C.text, fontWeight:600, fontSize:11 }}>{co.companyName}</span>
                            </div>
                          </td>
                          <td style={{ padding:"9px 10px", color:C.primary, fontWeight:700 }}>{fmtM(co.revenue)}</td>
                          <td style={{ padding:"9px 10px", color:C.amber }}>{fmtM(co.cogs)}</td>
                          <td style={{ padding:"9px 10px", color:C.teal, fontWeight:600 }}>{fmtM(co.grossProfit)}</td>
                          <td style={{ padding:"9px 10px" }}><Badge label={`${co.grossMargin.toFixed(1)}%`} bg={co.grossMargin>30?C.greenLight:C.amberLight} color={co.grossMargin>30?C.green:C.amber}/></td>
                          <td style={{ padding:"9px 10px", color:C.red }}>{fmtM(co.expenses)}</td>
                          <td style={{ padding:"9px 10px", fontWeight:800, color:co.netProfit>=0?C.green:C.red }}>{co.netProfit>=0?fmtM(co.netProfit):`(${fmtM(Math.abs(co.netProfit))})`}</td>
                          <td style={{ padding:"9px 10px" }}><Badge label={`${co.netMargin.toFixed(1)}%`} bg={co.netMargin>10?C.greenLight:C.redLight} color={co.netMargin>10?C.green:C.red}/></td>
                          <td style={{ padding:"9px 10px" }}><Badge label={`${co.roa.toFixed(1)}%`} bg={co.roa>5?C.greenLight:"#F1F5F9"} color={co.roa>5?C.green:C.muted}/></td>
                          <td style={{ padding:"9px 10px" }}><Badge label={`${co.roe.toFixed(1)}%`} bg={co.roe>10?C.greenLight:"#F1F5F9"} color={co.roe>10?C.green:C.muted}/></td>
                        </tr>
                      ))}
                    </tbody>
                    {(summary as any[]).length > 1 && (
                      <tfoot>
                        <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
                          <td style={{ padding:"10px", fontWeight:800, color:C.primary }}>المجموع</td>
                          {["revenue","cogs","grossProfit","","expenses","netProfit","","",""].map((f,i)=>(
                            <td key={i} style={{ padding:"10px", fontWeight:800, color:C.primary }}>
                              {f ? fmtM((summary as any[]).reduce((s:number,c:any)=>s+(c[f]||0),0)) : ""}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── MONTHLY VIEW ── */}
      {selView==="monthly" && (
        <>
          {ml ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> : !monthly ? <NoData/> : (
            <Card style={{ overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:900 }}>
                  <thead>
                    <tr style={{ background:C.primaryLight }}>
                      <th style={{ padding:"10px 14px", textAlign:"right", color:C.primary, fontWeight:700, whiteSpace:"nowrap" }}>الشركة / الشهر</th>
                      {arM.map(m=><th key={m} style={{ padding:"10px 8px", textAlign:"center", color:C.primary, fontWeight:700, fontSize:10, whiteSpace:"nowrap" }}>{m.slice(0,3)}</th>)}
                      <th style={{ padding:"10px 10px", textAlign:"center", color:C.primary, fontWeight:700 }}>المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selCos.map((cid,ci)=>{
                      const coData = monthly[cid] || [];
                      const coName = (companies as any[])?.find(c=>c.id===cid)?.name || `شركة ${cid}`;
                      const totalRev = coData.reduce((s:number,m:any)=>s+(m.revenue||0),0);
                      const totalPft = coData.reduce((s:number,m:any)=>s+(m.profit||0),0);
                      return [
                        // Revenue row
                        <tr key={`${cid}-rev`} style={{ borderBottom:`1px solid ${C.border}`, background:ci%2===0?"#EFF6FF":"#F0FDFA" }}>
                          <td style={{ padding:"8px 14px", fontWeight:700, color:COLORS[ci%8] }}>
                            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                              <div style={{ width:8,height:8,borderRadius:"50%",background:COLORS[ci%8] }}/>
                              {coName} — إيرادات
                            </div>
                          </td>
                          {coData.map((m:any,i:number)=>(
                            <td key={i} style={{ padding:"8px 6px", textAlign:"center", color:C.primary, fontWeight:(m.revenue||0)>0?600:400, fontSize:10 }}>
                              {(m.revenue||0)>0?fmtM(m.revenue):"—"}
                            </td>
                          ))}
                          <td style={{ padding:"8px 10px", textAlign:"center", color:C.primary, fontWeight:800 }}>{fmtM(totalRev)}</td>
                        </tr>,
                        // Profit row
                        <tr key={`${cid}-pft`} style={{ borderBottom:`2px solid ${C.border}` }}>
                          <td style={{ padding:"6px 14px 8px 30px", color:C.textSec, fontSize:10 }}>ربح/خسارة</td>
                          {coData.map((m:any,i:number)=>(
                            <td key={i} style={{ padding:"6px 6px 8px", textAlign:"center", fontSize:10,
                              color:(m.profit||0)>=0?C.green:C.red, fontWeight:(m.profit||0)!==0?600:400 }}>
                              {(m.profit||0)!==0?((m.profit||0)>=0?"+":"")+fmtM(m.profit):"—"}
                            </td>
                          ))}
                          <td style={{ padding:"6px 10px 8px", textAlign:"center", color:totalPft>=0?C.green:C.red, fontWeight:800, fontSize:11 }}>
                            {totalPft>=0?fmtM(totalPft):`(${fmtM(Math.abs(totalPft))})`}
                          </td>
                        </tr>
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── RATIOS VIEW ── */}
      {selView==="ratios" && (
        <>
          {sl ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> : !summary?.length ? <NoData/> : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
              {(summary as any[]).map((co:any,i:number)=>(
                <Card key={co.companyId} style={{ padding:"18px 20px", borderTop:`3px solid ${COLORS[i%8]}` }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
                    <div style={{ width:36,height:36,borderRadius:10,background:`${COLORS[i%8]}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🏢</div>
                    <div>
                      <p style={{ fontWeight:800, color:C.text, margin:0, fontSize:13 }}>{co.companyName}</p>
                      <Badge label={co.netProfit>=0?"✅ رابحة":"❌ خاسرة"} bg={co.netProfit>=0?C.greenLight:C.redLight} color={co.netProfit>=0?C.green:C.red}/>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      {l:"الإيرادات",         v:fmtM(co.revenue), c:COLORS[i%8]},
                      {l:"صافي الربح",        v:co.netProfit>=0?fmtM(co.netProfit):`(${fmtM(Math.abs(co.netProfit))})`, c:co.netProfit>=0?C.green:C.red},
                      {l:"هامش الربح الإجمالي",v:`${co.grossMargin.toFixed(1)}%`, c:co.grossMargin>30?C.green:C.amber},
                      {l:"هامش الربح الصافي", v:`${co.netMargin.toFixed(1)}%`, c:co.netMargin>10?C.green:C.red},
                      {l:"العائد على الأصول ROA",v:`${co.roa.toFixed(1)}%`, c:co.roa>5?C.green:C.amber},
                      {l:"العائد على الملكية ROE",v:`${co.roe.toFixed(1)}%`, c:co.roe>10?C.green:C.amber},
                    ].map((r,j)=>(
                      <div key={j} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:j<5?`1px solid ${C.border}`:"none" }}>
                        <span style={{ fontSize:11, color:C.textSec }}>{r.l}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:r.c }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// 🎯 صفحة المراكز التحليلية (Cost/Profit Centers)
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticCentersPage({ companyId, co }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const [selCenter, setSelCenter] = useState<any>(null);
  const [view, setView]           = useState<"table"|"chart"|"detail">("table");

  const { data, isLoading } = (trpc as any).journal.analyticCenters.useQuery(
    { companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId }
  );

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const centers: any[] = data?.centers || [];
  const isRealAnalytic = data?.source === "analytic_distribution";

  // KPIs
  const totalCost    = centers.reduce((s,c)=>s+c.totalCost,0);
  const totalRev     = centers.reduce((s,c)=>s+c.revenue,0);
  const totalProfit  = centers.reduce((s,c)=>s+c.netProfit,0);
  const profitable   = centers.filter(c=>c.netProfit>0).length;
  const topCost      = centers[0];
  const topProfit    = [...centers].sort((a,b)=>b.netProfit-a.netProfit)[0];
  const active       = centers.filter(c=>c.lines>0).length;

  const maxCost = Math.max(...centers.map(c=>c.totalCost),1);
  const maxRev  = Math.max(...centers.map(c=>c.revenue),1);

  // Colors for pie chart
  const PIE_COLORS = [C.primary,C.teal,C.amber,C.purple,C.red,C.green,"#06B6D4","#F97316","#8B5CF6","#EC4899","#14B8A6","#F59E0B","#6366F1","#84CC16","#EF4444"];

  // Pie segments
  const top15 = centers.slice(0,15);
  const pieTotal = top15.reduce((s,c)=>s+c.totalCost,0)||1;
  let cumAngle = -90;
  const pieSlices = top15.map((c,i)=>{
    const pct = c.totalCost/pieTotal;
    const angle = pct*360;
    const start = cumAngle;
    cumAngle += angle;
    return { ...c, pct, start, end:cumAngle, color:PIE_COLORS[i%PIE_COLORS.length] };
  });

  const polarToCart = (cx:number,cy:number,r:number,deg:number) => ({
    x: cx + r*Math.cos(deg*Math.PI/180),
    y: cy + r*Math.sin(deg*Math.PI/180)
  });

  const PieChart = () => (
    <svg viewBox="0 0 200 200" style={{ width:"100%", maxWidth:220, height:220 }}>
      {pieSlices.map((s,i)=>{
        const large = (s.end-s.start)>180?1:0;
        const p1 = polarToCart(100,100,85,s.start);
        const p2 = polarToCart(100,100,85,s.end);
        return (
          <g key={i}>
            <path
              d={`M100,100 L${p1.x},${p1.y} A85,85 0 ${large},1 ${p2.x},${p2.y} Z`}
              fill={s.color} stroke="#fff" strokeWidth="1.5"
              opacity={selCenter?.name===s.name?1:0.85}
              onClick={()=>setSelCenter(selCenter?.name===s.name?null:s)}
              style={{ cursor:"pointer" }}
            />
          </g>
        );
      })}
      <circle cx="100" cy="100" r="40" fill="#fff"/>
      <text x="100" y="95" textAnchor="middle" fontSize="10" fill={C.textSec}>المراكز</text>
      <text x="100" y="110" textAnchor="middle" fontSize="13" fontWeight="bold" fill={C.text}>{centers.length}</text>
    </svg>
  );

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:C.text, margin:0 }}>🎯 المراكز التحليلية</h2>
          <div style={{ display:"flex", gap:8, marginTop:4, alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.textSec }}>{co?.name}</span>
            {isRealAnalytic
              ? <Badge label="✅ بيانات من analytic_distribution" bg={C.greenLight} color={C.green}/>
              : <Badge label="⚠️ تصنيف تقديري بالكود — أعد المزامنة" bg={C.amberLight} color={C.amber}/>}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          <span style={{ color:C.muted }}>—</span>
          <input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {[
          {l:"المراكز النشطة",        v:String(active),              icon:"🎯", c:C.primary,  bg:C.primaryLight},
          {l:"إجمالي التكاليف",       v:fmtM(totalCost),             icon:"💸", c:C.red,      bg:C.redLight},
          {l:"إجمالي الإيرادات",      v:fmtM(totalRev),              icon:"💰", c:C.teal,     bg:C.tealLight},
          {l:"الصافي (ربح/خسارة)",    v:fmtM(totalProfit),           icon:totalProfit>=0?"📈":"📉", c:totalProfit>=0?C.green:C.red, bg:totalProfit>=0?C.greenLight:C.redLight},
          {l:"مراكز رابحة",           v:`${profitable}/${centers.length}`, icon:"✅", c:C.purple, bg:C.purpleLight},
        ].map((s,i)=>(
          <Card key={i} style={{ padding:"14px 16px", background:s.bg, border:`none` }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div><p style={{ fontSize:10, color:C.textSec, margin:"0 0 4px" }}>{s.l}</p><p style={{ fontSize:18, fontWeight:900, color:s.c, margin:0 }}>{s.v}</p></div>
              <span style={{ fontSize:22 }}>{s.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Top cards */}
      {(topCost||topProfit) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          {topCost && (
            <Card style={{ padding:"12px 16px", background:C.redLight, border:`1px solid #FECACA` }}>
              <p style={{ fontSize:10, color:C.muted, margin:"0 0 4px" }}>🔺 أعلى مركز تكلفة</p>
              <p style={{ fontWeight:800, color:C.red, margin:"0 0 2px", fontSize:14 }}>{topCost.name}</p>
              <p style={{ color:C.red, fontSize:13, margin:0 }}>{fmtM(topCost.totalCost)}</p>
            </Card>
          )}
          {topProfit && topProfit.netProfit > 0 && (
            <Card style={{ padding:"12px 16px", background:C.greenLight, border:`1px solid #A7F3D0` }}>
              <p style={{ fontSize:10, color:C.muted, margin:"0 0 4px" }}>🏆 أعلى مركز ربحية</p>
              <p style={{ fontWeight:800, color:C.green, margin:"0 0 2px", fontSize:14 }}>{topProfit.name}</p>
              <p style={{ color:C.green, fontSize:13, margin:0 }}>{fmtM(topProfit.netProfit)}</p>
            </Card>
          )}
        </div>
      )}

      {/* View tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[{k:"table",l:"📋 جدول المراكز"},{k:"chart",l:"📊 رسم بياني"},{k:"detail",l:"🔍 تفاصيل مركز"}].map(v=>(
          <button key={v.k} onClick={()=>setView(v.k as any)}
            style={{ padding:"8px 18px", borderRadius:9, border:`1.5px solid ${view===v.k?C.primary:C.border}`, background:view===v.k?C.primary:"#fff", color:view===v.k?"#fff":C.textSec, cursor:"pointer", fontSize:12, fontWeight:view===v.k?700:400 }}>
            {v.l}
          </button>
        ))}
      </div>

      {isLoading ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> : !centers.length ? <NoData text="لا توجد بيانات — قم بالمزامنة أولاً"/> : (
        <>
          {/* ── TABLE VIEW ── */}
          {view==="table" && (
            <Card style={{ overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:750 }}>
                  <thead>
                    <tr style={{ background:C.primaryLight }}>
                      {["#","المركز","الإيرادات","تكلفة مباشرة","مصروفات","إجمالي التكاليف","مجمل الربح","صافي الربح/خسارة","الهامش%","حركات"].map(h=>(
                        <th key={h} style={{ padding:"10px 10px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, whiteSpace:"nowrap", fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centers.map((c:any,i:number)=>(
                      <tr key={i} onClick={()=>{setSelCenter(c);setView("detail");}}
                        style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF", cursor:"pointer", transition:"background 0.1s" }}
                        onMouseEnter={e=>(e.currentTarget as any).style.background="#EFF6FF"}
                        onMouseLeave={e=>(e.currentTarget as any).style.background=i%2===0?"#fff":"#F8FAFF"}>
                        <td style={{ padding:"9px 10px", color:C.muted, fontWeight:600 }}>{i+1}</td>
                        <td style={{ padding:"9px 10px", color:C.text, fontWeight:700, maxWidth:200 }}>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <div style={{ width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0 }}/>
                            {c.name}
                          </div>
                        </td>
                        <td style={{ padding:"9px 10px", color:C.primary,fontWeight:600 }}>{c.revenue>0?fmt(c.revenue):"—"}</td>
                        <td style={{ padding:"9px 10px", color:C.amber  }}>{c.cogs>0?fmt(c.cogs):"—"}</td>
                        <td style={{ padding:"9px 10px", color:C.red    }}>{c.expenses>0?fmt(c.expenses):"—"}</td>
                        <td style={{ padding:"9px 10px", color:C.red, fontWeight:700 }}>{fmt(c.totalCost)}</td>
                        <td style={{ padding:"9px 10px", color:c.grossProfit>=0?C.teal:C.red }}>{c.grossProfit!==0?fmt(c.grossProfit):"—"}</td>
                        <td style={{ padding:"9px 10px", fontWeight:800, color:c.netProfit>=0?C.green:C.red }}>
                          {c.netProfit>=0?fmt(c.netProfit):`(${fmt(Math.abs(c.netProfit))})`}
                        </td>
                        <td style={{ padding:"9px 10px" }}>
                          {c.revenue>0
                            ? <Badge label={`${c.margin.toFixed(1)}%`} bg={c.margin>20?C.greenLight:c.margin>0?C.amberLight:C.redLight} color={c.margin>20?C.green:c.margin>0?C.amber:C.red}/>
                            : <span style={{ color:C.muted }}>—</span>}
                        </td>
                        <td style={{ padding:"9px 10px", color:C.muted }}>{c.lines}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
                      <td colSpan={2} style={{ padding:"10px", fontWeight:800, color:C.primary }}>المجموع</td>
                      <td style={{ padding:"10px", color:C.primary, fontWeight:800 }}>{fmt(totalRev)}</td>
                      <td style={{ padding:"10px", color:C.amber,   fontWeight:800 }}>{fmt(centers.reduce((s:number,c:any)=>s+c.cogs,0))}</td>
                      <td style={{ padding:"10px", color:C.red,     fontWeight:800 }}>{fmt(centers.reduce((s:number,c:any)=>s+c.expenses,0))}</td>
                      <td style={{ padding:"10px", color:C.red,     fontWeight:800 }}>{fmt(totalCost)}</td>
                      <td style={{ padding:"10px", color:C.teal,    fontWeight:800 }}>{fmt(centers.reduce((s:number,c:any)=>s+c.grossProfit,0))}</td>
                      <td style={{ padding:"10px", color:totalProfit>=0?C.green:C.red, fontWeight:800 }}>{totalProfit>=0?fmt(totalProfit):`(${fmt(Math.abs(totalProfit))})`}</td>
                      <td colSpan={2}><Badge label={totalRev>0?`${((totalProfit/totalRev)*100).toFixed(1)}%`:"—"} bg={totalProfit>=0?C.greenLight:C.redLight} color={totalProfit>=0?C.green:C.red}/></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* ── CHART VIEW ── */}
          {view==="chart" && (
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14 }}>
              {/* Horizontal bar chart */}
              <Card style={{ padding:"20px" }}>
                <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 16px" }}>📊 أعلى 15 مركز حسب التكاليف</p>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {centers.slice(0,15).map((c:any,i:number)=>(
                    <div key={i}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                          <div style={{ width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0 }}/>
                          <span style={{ fontSize:11, color:C.text, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                        </div>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          {c.revenue>0 && <span style={{ fontSize:10, color:C.primary }}>ر:{fmtM(c.revenue)}</span>}
                          <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>{fmtM(c.totalCost)}</span>
                          {c.netProfit!==0 && (
                            <Badge label={c.netProfit>=0?`+${fmtM(c.netProfit)}`:`-${fmtM(Math.abs(c.netProfit))}`}
                              bg={c.netProfit>=0?C.greenLight:C.redLight} color={c.netProfit>=0?C.green:C.red}/>
                          )}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:2, height:10 }}>
                        {/* Revenue bar */}
                        {c.revenue>0 && <div style={{ width:`${(c.revenue/Math.max(maxCost,maxRev))*100}%`, height:"100%", background:C.primary, borderRadius:"3px 0 0 3px", opacity:0.7 }}/>}
                        {/* Cost bar */}
                        <div style={{ width:`${(c.totalCost/maxCost)*100}%`, height:"100%", background:PIE_COLORS[i%PIE_COLORS.length], borderRadius:c.revenue>0?"0 3px 3px 0":"3px", opacity:0.85 }}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:16, marginTop:12, justifyContent:"center" }}>
                  {[{c:C.primary,l:"الإيرادات"},{c:C.red,l:"التكاليف"}].map(s=>(
                    <div key={s.l} style={{ display:"flex", gap:4, alignItems:"center" }}>
                      <div style={{ width:10,height:10,borderRadius:2,background:s.c }}/><span style={{ fontSize:10, color:C.muted }}>{s.l}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Pie chart */}
              <Card style={{ padding:"20px" }}>
                <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 12px" }}>🥧 توزيع التكاليف</p>
                <PieChart/>
                <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:8 }}>
                  {top15.map((c:any,i:number)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:C.text, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                      </div>
                      <span style={{ fontSize:10, color:C.muted }}>{((c.totalCost/pieTotal)*100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── DETAIL VIEW ── */}
          {view==="detail" && (
            <>
              {/* Center selector */}
              <Card style={{ padding:"14px 16px", marginBottom:14 }}>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontSize:12, color:C.muted, fontWeight:600 }}>اختر مركزاً:</span>
                  {centers.map((c:any,i:number)=>(
                    <button key={i} onClick={()=>setSelCenter(c)}
                      style={{ padding:"5px 14px", borderRadius:18, border:`1.5px solid ${selCenter?.name===c.name?PIE_COLORS[i%PIE_COLORS.length]:C.border}`, background:selCenter?.name===c.name?`${PIE_COLORS[i%PIE_COLORS.length]}20`:"#fff", cursor:"pointer", fontSize:11, fontWeight:600, color:selCenter?.name===c.name?PIE_COLORS[i%PIE_COLORS.length]:C.textSec, transition:"all 0.12s" }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </Card>

              {selCenter ? (
                <>
                  {/* Center KPIs */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
                    {[
                      {l:"الإيرادات",     v:fmtM(selCenter.revenue),   c:C.primary, icon:"💰"},
                      {l:"التكلفة المباشرة",v:fmtM(selCenter.cogs),    c:C.amber,   icon:"📦"},
                      {l:"المصروفات",     v:fmtM(selCenter.expenses),  c:C.red,     icon:"💸"},
                      {l:"صافي الربح",   v:selCenter.netProfit>=0?fmtM(selCenter.netProfit):`(${fmtM(Math.abs(selCenter.netProfit))})`,
                        c:selCenter.netProfit>=0?C.green:C.red, icon:selCenter.netProfit>=0?"✅":"❌"},
                    ].map((s,i)=>(
                      <Card key={i} style={{ padding:"14px 16px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between" }}>
                          <div><p style={{ fontSize:10, color:C.muted, margin:"0 0 4px" }}>{s.l}</p><p style={{ fontSize:17, fontWeight:800, color:s.c, margin:0 }}>{s.v}</p></div>
                          <span style={{ fontSize:20 }}>{s.icon}</span>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Profitability bar */}
                  {selCenter.revenue > 0 && (
                    <Card style={{ padding:"16px 20px", marginBottom:14 }}>
                      <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 12px" }}>📊 هيكل التكاليف والأرباح</p>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {[
                          {l:"الإيرادات",       v:selCenter.revenue,    pct:100,                             c:C.primary},
                          {l:"تكلفة المبيعات",  v:selCenter.cogs,       pct:selCenter.cogs/selCenter.revenue*100, c:C.amber},
                          {l:"مجمل الربح",      v:selCenter.grossProfit,pct:selCenter.grossProfit/selCenter.revenue*100, c:C.teal},
                          {l:"المصروفات",       v:selCenter.expenses,   pct:selCenter.expenses/selCenter.revenue*100,   c:C.red},
                          {l:"صافي الربح",      v:selCenter.netProfit,  pct:Math.abs(selCenter.netProfit/selCenter.revenue*100), c:selCenter.netProfit>=0?C.green:C.red},
                        ].map((r,i)=>(
                          <div key={i}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                              <span style={{ fontSize:12, color:C.textSec }}>{r.l}</span>
                              <span style={{ fontSize:12, fontWeight:700, color:r.c }}>{fmtM(r.v)} <span style={{ color:C.muted, fontWeight:400 }}>({r.pct.toFixed(1)}%)</span></span>
                            </div>
                            <div style={{ background:"#F1F5F9", borderRadius:4, height:7, overflow:"hidden" }}>
                              <div style={{ width:`${Math.min(100,Math.abs(r.pct))}%`, height:"100%", background:r.c, borderRadius:4 }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <NoData text="اختر مركزاً من القائمة أعلاه"/>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// 📊 تقرير الشيخوخة (Aging Report)
// ══════════════════════════════════════════════════════════════════════════════
function AgingReportPage({ companyId, co }:any) {
  const [asOf, setAsOf] = useState(`${new Date().getFullYear()}-12-31`);
  const [type, setType] = useState("receivable");
  const { data, isLoading } = (trpc as any).journal.agingReport.useQuery({ companyId, asOf, type }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const cols = [
    {k:"current",  l:"جاري (0-30)",  c:C.green},
    {k:"d30",      l:"30-60 يوم",    c:C.teal},
    {k:"d60",      l:"60-90 يوم",    c:C.amber},
    {k:"d90",      l:"90-180 يوم",   c:C.red},
    {k:"d90plus",  l:"+180 يوم",     c:"#7F1D1D"},
  ];
  const partners: any[] = data?.partners || [];
  const totals: any = data?.totals || {};
  const grandTotal = Math.abs(totals.total || 0);

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <PageTitle title="📅 تقرير الشيخوخة (Aging)" sub={co?.name}/>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}` }}>
            {[{k:"receivable",l:"مدينون"},{k:"payable",l:"دائنون"}].map(t=>(
              <button key={t.k} onClick={()=>setType(t.k)}
                style={{ padding:"7px 16px", border:"none", background:type===t.k?C.primary:"#fff", color:type===t.k?"#fff":C.textSec, cursor:"pointer", fontSize:12, fontWeight:type===t.k?700:400 }}>
                {t.l}
              </button>
            ))}
          </div>
          <input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {cols.map(col=>(
          <Card key={col.k} style={{ padding:"12px 14px" }}>
            <p style={{ fontSize:10, color:C.muted, margin:"0 0 4px" }}>{col.l}</p>
            <p style={{ fontSize:16, fontWeight:800, color:col.c, margin:"0 0 3px" }}>{fmt(Math.abs(totals[col.k]||0))}</p>
            <div style={{ background:"#F1F5F9", borderRadius:4, height:5, overflow:"hidden" }}>
              <div style={{ width:`${grandTotal>0?Math.abs((totals[col.k]||0))/grandTotal*100:0}%`, height:"100%", background:col.c, borderRadius:4 }}/>
            </div>
            <p style={{ fontSize:9, color:C.muted, margin:"3px 0 0" }}>{grandTotal>0?(Math.abs((totals[col.k]||0))/grandTotal*100).toFixed(1):0}%</p>
          </Card>
        ))}
      </div>

      {isLoading ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> : !partners.length ? <NoData text="لا توجد أرصدة"/> : (
        <Card style={{ overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:700 }}>
              <thead>
                <tr style={{ background:C.primaryLight }}>
                  <th style={{ padding:"10px 14px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>الشريك</th>
                  {cols.map(col=><th key={col.k} style={{ padding:"10px 10px", textAlign:"center", color:col.c, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, whiteSpace:"nowrap" }}>{col.l}</th>)}
                  <th style={{ padding:"10px 10px", textAlign:"center", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}` }}>الإجمالي</th>
                  <th style={{ padding:"10px 10px", textAlign:"center", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, minWidth:80 }}>التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p:any,i:number)=>{
                  const tot = Math.abs(p.total);
                  const risk = (Math.abs(p.d90)+Math.abs(p.d90plus))/tot*100;
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                      <td style={{ padding:"9px 14px", color:C.text, fontWeight:600 }}>{p.name}</td>
                      {cols.map(col=>(
                        <td key={col.k} style={{ padding:"9px 10px", textAlign:"center", color:Math.abs(p[col.k])>0?col.c:C.muted }}>
                          {Math.abs(p[col.k])>0?fmt(Math.abs(p[col.k])):"—"}
                        </td>
                      ))}
                      <td style={{ padding:"9px 10px", textAlign:"center", fontWeight:800, color:risk>50?C.red:C.text }}>{fmt(tot)}</td>
                      <td style={{ padding:"9px 10px" }}>
                        <div style={{ display:"flex", height:10, borderRadius:4, overflow:"hidden" }}>
                          {cols.map(col=>{
                            const w = tot>0?Math.abs(p[col.k])/tot*100:0;
                            return w>0?<div key={col.k} style={{ width:`${w}%`, background:col.c, opacity:0.85 }}/>:null;
                          })}
                        </div>
                        {risk>50&&<span style={{ fontSize:9, color:C.red }}>⚠️ {risk.toFixed(0)}% متأخر</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
                  <td style={{ padding:"10px 14px", fontWeight:800, color:C.primary }}>الإجمالي</td>
                  {cols.map(col=><td key={col.k} style={{ padding:"10px", textAlign:"center", fontWeight:800, color:col.c }}>{fmt(Math.abs(totals[col.k]||0))}</td>)}
                  <td style={{ padding:"10px", textAlign:"center", fontWeight:900, color:C.primary, fontSize:13 }}>{fmt(grandTotal)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 🔬 DuPont Analysis + Altman Z-Score + Smart Alerts
// ══════════════════════════════════════════════════════════════════════════════
function AdvancedAnalysisPage({ companyId, co }:any) {
  const yr = new Date().getFullYear();
  const [year, setYear] = useState(yr);
  const [tab, setTab]   = useState<"dupont"|"altman"|"alerts">("alerts");

  const { data:dp, isLoading:dl } = (trpc as any).journal.dupont.useQuery({ companyId, year }, { enabled:!!companyId });
  const { data:az, isLoading:al } = (trpc as any).journal.altmanZScore.useQuery({ companyId, year }, { enabled:!!companyId });
  const { data:alerts, isLoading:sl } = (trpc as any).journal.smartAlerts.useQuery({ companyId, year }, { enabled:!!companyId });

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const alertColors: Record<string,{bg:string,c:string,border:string}> = {
    danger:  {bg:C.redLight,   c:C.red,   border:"#FECACA"},
    warning: {bg:C.amberLight, c:C.amber, border:"#FDE68A"},
    success: {bg:C.greenLight, c:C.green, border:"#A7F3D0"},
    info:    {bg:C.primaryLight,c:C.primary,border:C.primarySoft},
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🔬 التحليل المالي المتقدم" sub={co?.name}/>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, color:C.text }}>
          {[yr-1,yr,yr+1].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {[{k:"alerts",l:"🚨 التنبيهات الذكية"},{k:"dupont",l:"🔬 DuPont ROE"},{k:"altman",l:"⚖️ Altman Z-Score"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)}
            style={{ padding:"9px 20px", borderRadius:9, border:`1.5px solid ${tab===t.k?C.primary:C.border}`, background:tab===t.k?C.primary:"#fff", color:tab===t.k?"#fff":C.textSec, cursor:"pointer", fontSize:12, fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── ALERTS ── */}
      {tab==="alerts" && (
        sl ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> :
        !alerts ? <NoData/> : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {(alerts.alerts as any[]).map((a:any,i:number)=>{
              const ac = alertColors[a.level]||alertColors.info;
              return (
                <Card key={i} style={{ padding:"16px 20px", background:ac.bg, border:`1px solid ${ac.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <span style={{ fontSize:24, flexShrink:0 }}>{a.icon}</span>
                      <div>
                        <p style={{ fontWeight:800, color:ac.c, margin:"0 0 4px", fontSize:14 }}>{a.title}</p>
                        <p style={{ color:C.textSec, fontSize:13, margin:0, lineHeight:1.6 }}>{a.msg}</p>
                      </div>
                    </div>
                    <Badge label={a.value} bg={ac.border} color={ac.c}/>
                  </div>
                </Card>
              );
            })}

            {/* Current metrics summary */}
            {alerts.currentMetrics && (
              <Card style={{ padding:"16px 20px" }}>
                <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 12px" }}>📊 ملخص مالي — {year}</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                  {[
                    {l:"الإيرادات",   v:alerts.currentMetrics.rev,    c:C.primary},
                    {l:"المصروفات",  v:alerts.currentMetrics.exp+alerts.currentMetrics.cogs, c:C.red},
                    {l:"صافي الربح", v:alerts.currentMetrics.profit,  c:alerts.currentMetrics.profit>=0?C.green:C.red},
                    {l:"الهامش",     v:alerts.currentMetrics.rev>0?`${((alerts.currentMetrics.profit/alerts.currentMetrics.rev)*100).toFixed(1)}%`:"—", c:C.teal},
                  ].map((s,j)=>(
                    <div key={j} style={{ padding:"10px 12px", borderRadius:8, background:C.bg, border:`1px solid ${C.border}` }}>
                      <p style={{ fontSize:10, color:C.muted, margin:"0 0 4px" }}>{s.l}</p>
                      <p style={{ fontSize:15, fontWeight:800, color:s.c, margin:0 }}>{typeof s.v==="number"?fmtM(s.v):s.v}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )
      )}

      {/* ── DUPONT ── */}
      {tab==="dupont" && (
        dl ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> :
        !dp ? <NoData/> : (
          <>
            {/* ROE breakdown */}
            <Card style={{ padding:"24px", marginBottom:14 }}>
              <p style={{ fontWeight:800, fontSize:15, color:C.text, margin:"0 0 20px" }}>
                🔬 تحليل DuPont — العائد على حقوق الملكية (ROE)
              </p>
              {/* Visual equation */}
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"center", marginBottom:24 }}>
                {[
                  {l:"هامش الربح",  v:`${dp.netMargin.toFixed(1)}%`,     c:C.teal,   sub:"صافي الربح ÷ إيرادات"},
                  {l:"×"},
                  {l:"دوران الأصول", v:`${dp.assetTurnover.toFixed(2)}x`, c:C.primary, sub:"إيرادات ÷ أصول"},
                  {l:"×"},
                  {l:"الرافعة المالية",v:`${dp.equityMultiplier.toFixed(2)}x`,c:C.purple,sub:"أصول ÷ حقوق ملكية"},
                  {l:"="},
                  {l:"ROE",          v:`${dp.roe.toFixed(1)}%`,            c:dp.roe>10?C.green:C.red, sub:"العائد على حقوق الملكية", big:true},
                ].map((item:any,i:number)=>(
                  item.l==="×"||item.l==="=" ? (
                    <span key={i} style={{ fontSize:28, color:C.muted, fontWeight:300, margin:"0 4px" }}>{item.l}</span>
                  ) : (
                    <div key={i} style={{ padding:"16px 20px", borderRadius:12, background:item.big?item.c+"20":C.bg, border:`${item.big?"2px":"1px"} solid ${item.big?item.c:C.border}`, textAlign:"center", minWidth:120 }}>
                      <p style={{ fontSize:11, color:C.textSec, margin:"0 0 6px" }}>{item.l}</p>
                      <p style={{ fontSize:item.big?28:22, fontWeight:900, color:item.c, margin:"0 0 4px" }}>{item.v}</p>
                      <p style={{ fontSize:10, color:C.muted, margin:0 }}>{item.sub}</p>
                    </div>
                  )
                ))}
              </div>

              {/* Detailed metrics */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[
                  {l:"الإيرادات",        v:fmtM(dp.revenue),         c:C.primary},
                  {l:"صافي الربح",       v:fmtM(dp.netProfit),       c:dp.netProfit>=0?C.green:C.red},
                  {l:"هامش إجمالي",      v:`${dp.grossMargin.toFixed(1)}%`, c:C.teal},
                  {l:"هامش تشغيلي",      v:`${dp.operatingMargin.toFixed(1)}%`, c:C.amber},
                  {l:"العائد على الأصول ROA", v:`${dp.roa.toFixed(1)}%`, c:C.purple},
                  {l:"نسبة الديون",      v:`${dp.debtRatio.toFixed(1)}%`, c:dp.debtRatio<50?C.green:C.red},
                  {l:"إجمالي الأصول",   v:fmtM(dp.assets),          c:C.primary},
                  {l:"حقوق الملكية",    v:fmtM(dp.equity),          c:C.green},
                  {l:"الالتزامات",      v:fmtM(dp.liab),            c:C.red},
                ].map((s,j)=>(
                  <div key={j} style={{ padding:"12px 14px", borderRadius:9, background:C.bg, border:`1px solid ${C.border}` }}>
                    <p style={{ fontSize:11, color:C.muted, margin:"0 0 4px" }}>{s.l}</p>
                    <p style={{ fontSize:16, fontWeight:800, color:s.c, margin:0 }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )
      )}

      {/* ── ALTMAN Z-SCORE ── */}
      {tab==="altman" && (
        al ? <div style={{ textAlign:"center",padding:60 }}><Spinner/></div> :
        !az ? <NoData/> : (
          <>
            {/* Z-Score card */}
            <Card style={{ padding:"24px", marginBottom:14, background:az.zone==="safe"?C.greenLight:az.zone==="grey"?C.amberLight:C.redLight, border:`2px solid ${az.zone==="safe"?"#A7F3D0":az.zone==="grey"?"#FDE68A":"#FECACA"}` }}>
              <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                <div style={{ textAlign:"center", padding:"20px 30px", borderRadius:14, background:"rgba(255,255,255,0.7)" }}>
                  <p style={{ fontSize:11, color:C.textSec, margin:"0 0 6px" }}>Altman Z-Score</p>
                  <p style={{ fontSize:48, fontWeight:900, color:az.zone==="safe"?C.green:az.zone==="grey"?C.amber:C.red, margin:"0 0 4px" }}>{az.z}</p>
                  <p style={{ fontSize:16, fontWeight:700, color:az.zone==="safe"?C.green:az.zone==="grey"?C.amber:C.red, margin:0 }}>{az.zoneLabel}</p>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ position:"relative", height:20, background:"linear-gradient(to right,#FEE2E2 0%,#FEF3C7 35%,#D1FAE5 60%,#ECFDF5 100%)", borderRadius:10, marginBottom:12 }}>
                    <div style={{ position:"absolute", left:`${Math.min(95,Math.max(2,(az.z/4)*100))}%`, top:-4, width:28, height:28, borderRadius:"50%", background:az.zone==="safe"?C.green:az.zone==="grey"?C.amber:C.red, border:"3px solid #fff", boxShadow:"0 2px 8px rgba(0,0,0,0.15)", transform:"translateX(-50%)" }}/>
                    <div style={{ position:"absolute", left:"35%",  top:24, fontSize:10, color:C.amber, transform:"translateX(-50%)" }}>1.81</div>
                    <div style={{ position:"absolute", left:"60%",  top:24, fontSize:10, color:C.green, transform:"translateX(-50%)" }}>2.99</div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:30 }}>
                    <Badge label="< 1.81 منطقة الضائقة" bg="#FEE2E2" color={C.red}/>
                    <Badge label="1.81-2.99 رمادية"    bg="#FEF3C7" color={C.amber}/>
                    <Badge label="> 2.99 آمنة"          bg="#D1FAE5" color={C.green}/>
                  </div>
                </div>
              </div>
            </Card>

            {/* Components */}
            <Card style={{ padding:"20px" }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.text, margin:"0 0 14px" }}>📊 مكونات النموذج</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:C.primaryLight }}>
                    {["المتغير","الوصف","القيمة","الوزن","المساهمة"].map(h=>(
                      <th key={h} style={{ padding:"9px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(az.components as any[]).map((comp:any,i:number)=>{
                    const contribution = comp.value * comp.weight;
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"#fff":"#F8FAFF" }}>
                        <td style={{ padding:"9px 12px", color:C.primary, fontWeight:700, fontFamily:"monospace" }}>X{i+1}</td>
                        <td style={{ padding:"9px 12px", color:C.text }}>{comp.label}</td>
                        <td style={{ padding:"9px 12px", color:C.teal, fontWeight:600 }}>{comp.value.toFixed(3)}</td>
                        <td style={{ padding:"9px 12px", color:C.muted }}>× {comp.weight}</td>
                        <td style={{ padding:"9px 12px", color:contribution>0?C.green:C.red, fontWeight:700 }}>{contribution.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
                    <td colSpan={4} style={{ padding:"10px 12px", fontWeight:800, color:C.primary }}>Z-Score الإجمالي</td>
                    <td style={{ padding:"10px 12px", fontWeight:900, color:az.zone==="safe"?C.green:az.zone==="grey"?C.amber:C.red, fontSize:16 }}>{az.z}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop:14, padding:"12px 16px", borderRadius:9, background:C.bg, border:`1px solid ${C.border}` }}>
                <p style={{ fontSize:11, color:C.textSec, margin:0, lineHeight:1.7 }}>
                  <strong>⚠️ ملاحظة:</strong> نموذج Altman Z-Score مصمم أصلاً للشركات الصناعية المدرجة في البورصة. القيم التقديرية (رأس المال العامل، القيمة السوقية) تستخدم معادلات تقريبية. النتائج للإشارة فقط وليست بديلاً عن التقييم المهني.
                </p>
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 📤 صفحة التصدير (PDF + Excel)
// ══════════════════════════════════════════════════════════════════════════════
function ExportPage({ companyId, co }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const [exporting, setExporting] = useState<string|null>(null);

  const { data:income }  = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId, staleTime:5*60*1000 });
  const { data:balance } = trpc.journal.balanceSheet.useQuery({ companyId, asOf:dT }, { enabled:!!companyId, staleTime:5*60*1000 });
  const { data:tb }      = trpc.journal.trialBalance.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId, staleTime:5*60*1000 });

  const exportExcel = async (reportName: string, headers: string[], rows: any[][]) => {
    setExporting(reportName);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(()=>({wch:20}));
      XLSX.utils.book_append_sheet(wb, ws, reportName);
      XLSX.writeFile(wb, `${reportName}-${dF}-${dT}.xlsx`);
    } finally { setExporting(null); }
  };

  const exportTrialExcel = () => {
    if (!tb?.length) return;
    exportExcel("ميزان المراجعة",
      ["كود الحساب","اسم الحساب","النوع","افتتاحي مدين","افتتاحي دائن","حركة مدين","حركة دائن","ختامي مدين","ختامي دائن"],
      (tb as any[]).map(r=>[r.accountCode,r.accountName,r.accountType,r.openDebit,r.openCredit,r.mvtDebit,r.mvtCredit,r.closingDebit,r.closingCredit])
    );
  };

  const exportIncomeExcel = () => {
    if (!income) return;
    exportExcel("قائمة الدخل",
      ["البيان","المبلغ","النسبة%"],
      [
        ["الإيرادات الإجمالية",income.revenue,(100).toFixed(1)+"%"],
        ["تكلفة المبيعات",-income.cogs,(income.revenue>0?-(income.cogs/income.revenue*100):0).toFixed(1)+"%"],
        ["مجمل الربح",income.grossProfit,(income.revenue>0?income.grossProfit/income.revenue*100:0).toFixed(1)+"%"],
        ["المصروفات التشغيلية",-income.expenses,(income.revenue>0?-(income.expenses/income.revenue*100):0).toFixed(1)+"%"],
        ["الربح التشغيلي",income.operatingProfit,(income.revenue>0?income.operatingProfit/income.revenue*100:0).toFixed(1)+"%"],
        ["صافي الربح",income.netProfit,(income.revenue>0?income.netProfit/income.revenue*100:0).toFixed(1)+"%"],
      ]
    );
  };

  const exportPDF = async (title: string, tableData?: any) => {
    setExporting(title);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new (jsPDF as any)({ orientation:'landscape', unit:'mm', format:'a4' });
      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 297, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.text(title, 14, 12);
      doc.setFontSize(9);  doc.text(`${co?.name||""} | ${dF} — ${dT}`, 200, 12);
      doc.setTextColor(0, 0, 0);
      // Table
      if (tableData) {
        (autoTable as any)(doc, { startY:22, head:[tableData.headers], body:tableData.rows, styles:{ font:'helvetica', fontSize:8 }, headStyles:{ fillColor:[37,99,235] } });
      } else {
        doc.setFontSize(11); doc.text("تم الإنشاء بواسطة CFO Intelligence System", 14, 28);
      }
      doc.save(`${co?.name||"report"}-${title}-${dT}.pdf`);
    } finally { setExporting(null); }
  };

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  const reports = [
    {
      id:"trial", title:"ميزان المراجعة", icon:"⚖️",
      desc:"6 أعمدة: افتتاحي + حركة + ختامي",
      ready:!!tb?.length, count:tb?.length||0,
      excel:exportTrialExcel,
      pdf:()=>exportPDF("ميزان المراجعة"),
    },
    {
      id:"income", title:"قائمة الدخل", icon:"📈",
      desc:"إيرادات - تكاليف - مصروفات = صافي ربح",
      ready:!!income?.revenue,
      excel:exportIncomeExcel,
      pdf:()=>exportPDF("قائمة الدخل"),
    },
    {
      id:"balance", title:"الميزانية العمومية", icon:"🏦",
      desc:"أصول = التزامات + حقوق ملكية",
      ready:!!balance?.assets,
      excel:()=>exportExcel("الميزانية",["البيان","القيمة"],[["الأصول",balance?.assets||0],["الالتزامات",balance?.liabilities||0],["حقوق الملكية",balance?.equity||0]]),
      pdf:()=>exportPDF("الميزانية العمومية"),
    },
  ];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="📤 تصدير التقارير" sub="PDF + Excel"/>
        <div style={{ display:"flex", gap:8 }}>
          <input type="date" value={dF} onChange={e=>setDF(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          <span style={{ color:C.muted }}>—</span>
          <input type="date" value={dT} onChange={e=>setDT(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {reports.map(r=>(
          <Card key={r.id} style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <div style={{ width:46,height:46,borderRadius:12,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0 }}>{r.icon}</div>
              <div>
                <p style={{ fontWeight:800, color:C.text, margin:"0 0 4px", fontSize:14 }}>{r.title}</p>
                <p style={{ color:C.textSec, fontSize:12, margin:"0 0 6px" }}>{r.desc}</p>
                <Badge label={r.ready?`✅ جاهز${r.count?` (${r.count})`:""}`:r.ready===false?"⚠️ لا توجد بيانات":"⏳ جاري..."} bg={r.ready?C.greenLight:C.amberLight} color={r.ready?C.green:C.amber}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:"auto" }}>
              <button onClick={r.excel} disabled={!r.ready||exporting===r.title}
                style={{ flex:1, padding:"9px", borderRadius:8, border:`1px solid ${C.border}`, background:r.ready?"#217346":"#94A3B8", color:"#fff", cursor:r.ready?"pointer":"default", fontSize:12, fontWeight:700 }}>
                {exporting===r.title?"⏳...":"📊 Excel"}
              </button>
              <button onClick={r.pdf} disabled={!r.ready||exporting===r.title}
                style={{ flex:1, padding:"9px", borderRadius:8, border:"none", background:r.ready?C.red:"#94A3B8", color:"#fff", cursor:r.ready?"pointer":"default", fontSize:12, fontWeight:700 }}>
                {exporting===r.title?"⏳...":"📄 PDF"}
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding:"16px 20px", marginTop:14 }}>
        <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 10px" }}>📋 إرشادات التصدير</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            {icon:"📊",l:"Excel",d:"جداول قابلة للتحرير — مناسبة للمراجعة والتحليل الإضافي"},
            {icon:"📄",l:"PDF",d:"نسخة نهائية للطباعة والمشاركة مع الإدارة"},
          ].map((s,i)=>(
            <div key={i} style={{ padding:"12px", borderRadius:8, background:C.bg, border:`1px solid ${C.border}` }}>
              <p style={{ fontWeight:700, color:C.text, margin:"0 0 4px", fontSize:13 }}>{s.icon} {s.l}</p>
              <p style={{ color:C.textSec, fontSize:12, margin:0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


  // Keyboard shortcuts
  useEffect(()=>{
    const h = (e:KeyboardEvent) => {
      if ((e.ctrlKey||e.metaKey)&&e.key==="k") { e.preventDefault(); setShowSearch(true); }
      if (e.key==="Escape") setShowSearch(false);
      if ((e.ctrlKey||e.metaKey)&&e.key==="d") { e.preventDefault(); setPage("dashboard"); }
    };
    window.addEventListener("keydown", h);
    return ()=>window.removeEventListener("keydown", h);
  }, []);

  const renderPage = () => {
    switch(page) {
      case "dashboard":         return <DashboardPage companyId={companyId} co={co} onNavigate={setPage}/>;
      case "odoo-wizard":        return <OdooWizardPage companyId={companyId} co={co}/>;

      case "trial-balance":     return <TrialBalancePage companyId={companyId}/>;
      case "income":            return <IncomePage companyId={companyId}/>;
      case "balance-sheet":     return <BalanceSheetPage companyId={companyId}/>;
      case "journal-entries":   return <JournalEntriesPage companyId={companyId}/>;
      case "general-ledger":    return <GeneralLedgerPage companyId={companyId}/>;
      case "partner-statement": return <PartnerStatementPage companyId={companyId}/>;
      case "daily-sales":        return <DailySalesPage companyId={companyId} co={co}/>;
      case "executive":         return <ExecutiveDashboardPage companyId={companyId} co={co}/>;
      case "ratios":            return <RatiosPage companyId={companyId}/>;
      case "monthly":           return <MonthlyPage companyId={companyId}/>;
      case "cashflow":          return <CashFlowPage companyId={companyId}/>;
      case "costs":             return <CostAnalysisPage companyId={companyId}/>;
      case "compare":           return <PeriodsComparePage companyId={companyId}/>;
      case "monthly-detail":    return <MonthlyDetailPage companyId={companyId} co={co}/>;
      case "multi-company":     return <MultiCompanyPage currentUser={user}/>;
      case "analytic":          return <AnalyticCentersPage companyId={companyId} co={co}/>;
      case "aging":             return <AgingReportPage companyId={companyId} co={co}/>;
      case "budget-monitor":    return <BudgetMonitorPage companyId={companyId} co={co}/>;;
      case "advanced":          return <AdvancedAnalysisPage companyId={companyId} co={co}/>;
      case "export":            return <ExportPage companyId={companyId} co={co}/>;
      case "advisor":           return <AdvisorPage companyId={companyId} co={co}/>;
      case "chatbot":           return <ChatbotPage companyId={companyId} co={co}/>;
      case "users":             return user.role==="cfo_admin"?<UsersPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "holding":           return user.role==="cfo_admin"?<HoldingCompaniesPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "companies":         return user.role==="cfo_admin"?<CompaniesPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "diagnostics":       return <DiagnosticsPage companyId={companyId} co={co}/>;
      case "audit-log":         return user.role==="cfo_admin"?<AuditLogPage/>:<NoData text="غير مصرح"/>;
      case "profile":           return <ProfilePage user={user} onLogout={onLogout}/>;
      default:                  return <NoData text="هذه الصفحة قيد التطوير"/>;
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:"'Cairo','Segoe UI',sans-serif", overflow:"hidden" }}>
      <style>{`*{box-sizing:border-box;} ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px;} button,input,select{font-family:inherit;} @keyframes spin{to{transform:rotate(360deg)}} @keyframes bounce{from{transform:translateY(0);opacity:0.4}to{transform:translateY(-4px);opacity:1}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0}} @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
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
            {/* Bell notification with badge */}
            <div style={{ position:"relative" }}>
              <button onClick={()=>setPage("budget-monitor")}
                style={{ position:"relative", padding:"5px 10px", borderRadius:8, border:`1px solid ${emergencyCount>0?"#FECACA":unreadAlerts>0?"#FDE68A":C.border}`, background:emergencyCount>0?C.redLight:unreadAlerts>0?C.amberLight:C.bg, cursor:"pointer", fontSize:16 }}>
                🔔
              </button>
              {unreadAlerts > 0 && (
                <span style={{ position:"absolute", top:-4, right:-4, minWidth:18, height:18, borderRadius:9, background:emergencyCount>0?C.red:C.amber, color:"#fff", fontSize:10, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px", border:"2px solid #fff" }}>
                  {unreadAlerts > 99 ? "99+" : unreadAlerts}
                </span>
              )}
            </div>
            {/* Ctrl+K search */}
            <button onClick={()=>setShowSearch(true)}
              style={{ display:"flex", gap:5, alignItems:"center", padding:"5px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:11, color:C.muted }}>
              🔍 <kbd style={{ padding:"1px 5px", borderRadius:3, border:`1px solid ${C.border}`, fontSize:10 }}>K</kbd>
            </button>
            {/* Dark mode */}
            <button onClick={()=>{ const d=!isDark; setDark(d); localStorage.setItem("cfo_theme",d?"dark":"light"); }}
              style={{ padding:"5px 9px", borderRadius:8, border:`1px solid ${C.border}`, background:isDark?C.primary:C.bg, color:isDark?"#fff":C.textSec, cursor:"pointer", fontSize:13 }}>
              {isDark?"☀️":"🌙"}
            </button>
            <button onClick={onLogout} style={{ padding:"5px 12px", borderRadius:8, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:11, fontWeight:600 }}>خروج</button>
          </div>
        </header>
        <main style={{ flex:1, overflowY:"auto", paddingTop:18 }}>{renderPage()}</main>
      </div>
    {/* Global Search Ctrl+K */}
    {showSearch && (
      <div onClick={()=>setShowSearch(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"18vh",zIndex:9999,direction:"rtl" }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:C.surface,borderRadius:16,padding:18,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:14 }}>
            <span style={{ fontSize:16,color:C.muted }}>🔍</span>
            <input autoFocus placeholder="انتقل لصفحة... (ابدأ الكتابة)"
              onChange={e=>{ const q=e.target.value.toLowerCase(); if(!q)return; const m=NAV.flatMap(s=>s.items).find(i=>i.label.includes(q)||i.id.includes(q)); if(m){setPage(m.id);setShowSearch(false);} }}
              style={{ flex:1,border:"none",outline:"none",fontSize:15,background:"transparent",color:C.text,fontFamily:"Cairo,sans-serif" }}/>
            <kbd style={{ padding:"2px 8px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:11,color:C.muted }}>Esc</kbd>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:4 }}>
            {NAV.flatMap(s=>s.items).map(item=>(
              <button key={item.id} onClick={()=>{setPage(item.id);setShowSearch(false);}}
                style={{ padding:"8px 12px",borderRadius:8,border:`1px solid ${page===item.id?C.primary:C.border}`,background:page===item.id?C.primaryLight:"transparent",color:page===item.id?C.primary:C.textSec,cursor:"pointer",fontSize:12,textAlign:"right",display:"flex",gap:6,alignItems:"center",fontFamily:"Cairo,sans-serif" }}>
                <span style={{ fontSize:13 }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop:10,padding:"8px 12px",borderRadius:8,background:C.bg,fontSize:10,color:C.muted,display:"flex",gap:16 }}>
            <span>Ctrl+D لوحة التحكم</span><span>Ctrl+K بحث</span><span>Esc إغلاق</span>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

// ── Journal Entries ────────────────────────────────────────────────────────────
function JournalEntriesPage({ companyId }:any) {
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [filterType, setFilter] = useState("all");
  const [expandedId, setExpanded] = useState<number|null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const { data, isLoading } = trpc.journal.listEntries.useQuery(
    { companyId, page, limit:25 },
    { enabled:!!companyId }
  );
  const { data:sync } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });

  // filter client-side
  const entries = (data?.entries || []).filter((e:any) => {
    const matchSearch = !search || e.name?.includes(search) || e.partnerName?.includes(search) || e.journalName?.includes(search);
    const matchType   = filterType === "all" || e.journalName === filterType;
    const matchFrom   = !dateFrom || e.date >= dateFrom;
    const matchTo     = !dateTo   || e.date <= dateTo;
    return matchSearch && matchType && matchFrom && matchTo;
  });

  const journals = [...new Set((data?.entries||[]).map((e:any)=>e.journalName).filter(Boolean))];

  const jColors: Record<string,{bg:string,c:string}> = {
    "مبيعات":{bg:"#EFF6FF",c:"#2563EB"}, "sale":{bg:"#EFF6FF",c:"#2563EB"},
    "بنك":{bg:"#ECFDF5",c:"#059669"},    "bank":{bg:"#ECFDF5",c:"#059669"},
    "نقدية":{bg:"#ECFDF5",c:"#059669"},  "cash":{bg:"#ECFDF5",c:"#059669"},
    "مشتريات":{bg:"#FFFBEB",c:"#D97706"},"purchase":{bg:"#FFFBEB",c:"#D97706"},
    "رواتب":{bg:"#F5F3FF",c:"#7C3AED"},  "general":{bg:"#F5F3FF",c:"#7C3AED"},
  };
  const getJColor = (j:string) => jColors[j] || {bg:"#F8FAFC",c:"#64748B"};

  if (!companyId) return <NoData text="اختر شركة أولاً"/>;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>📋 القيود المحاسبية</h2>
          <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:C.muted }}>إجمالي القيود: <strong style={{ color:C.primary }}>{fmt(sync?.totalEntries||0)}</strong></span>
            <span style={{ fontSize:12, color:C.muted }}>السطور: <strong style={{ color:C.teal }}>{fmt(sync?.totalLines||0)}</strong></span>
            <span style={{ fontSize:12, color:C.muted }}>الصفحة {data?.page||1} من {data?.pages||1}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ flex:2, minWidth:180 }}>
            <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>بحث (رقم القيد / الشريك / الدفتر)</label>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="ابحث..."
              style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none" }}/>
          </div>
          <div style={{ flex:1, minWidth:120 }}>
            <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>نوع الدفتر</label>
            <select value={filterType} onChange={e=>{setFilter(e.target.value);setPage(1);}} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
              <option value="all">الكل</option>
              {journals.map(j=><option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          </div>
          <div>
            <label style={{ display:"block", fontSize:10, color:C.muted, marginBottom:3, fontWeight:600 }}>إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, fontSize:12, outline:"none" }}/>
          </div>
          {(search||filterType!=="all"||dateFrom||dateTo) && (
            <button onClick={()=>{setSearch("");setFilter("all");setDateFrom("");setDateTo("");setPage(1);}}
              style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:11, fontWeight:600 }}>
              ✕ مسح الفلتر
            </button>
          )}
        </div>
      </Card>

      {/* Stats row */}
      {entries.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
          {[
            {l:"عدد القيود المعروضة", v:fmt(entries.length),                                         c:C.primary, bg:C.primaryLight},
            {l:"إجمالي مدين",         v:fmt(entries.reduce((s:number,e:any)=>s+(e.totalDebit||0),0)),  c:C.teal,    bg:C.tealLight},
            {l:"إجمالي دائن",         v:fmt(entries.reduce((s:number,e:any)=>s+(e.totalCredit||0),0)), c:C.red,     bg:C.redLight},
            {l:"عدد الشركاء",         v:fmt(new Set(entries.map((e:any)=>e.partnerName).filter(Boolean)).size), c:C.purple, bg:C.purpleLight},
          ].map((s,i)=>(
            <Card key={i} style={{ padding:"10px 14px" }}>
              <p style={{ color:C.muted, fontSize:10, margin:"0 0 2px" }}>{s.l}</p>
              <p style={{ fontSize:16, fontWeight:800, color:s.c, margin:0 }}>{s.v}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign:"center", padding:50 }}><Spinner/><p style={{ color:C.muted, marginTop:12 }}>جاري تحميل القيود...</p></div>
      ) : !data?.total ? (
        <NoData text="لا توجد قيود — قم بمزامنة Odoo أولاً"/>
      ) : (
        <Card style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:C.primaryLight }}>
                {["","رقم القيد","التاريخ","الدفتر","الشريك","مدين","دائن","البيان","الحالة"].map((h,i)=>(
                  <th key={i} style={{ padding:"10px 10px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e:any, i:number) => {
                const jc  = getJColor(e.journalName||"");
                const isOpen = expandedId === e.id;
                return (
                  <>
                    <tr key={e.id}
                      onClick={()=>setExpanded(isOpen?null:e.id)}
                      style={{ borderBottom:`1px solid ${C.border}`, background:isOpen?C.primaryLight:i%2===0?"#fff":"#F8FAFF", cursor:"pointer", transition:"background 0.1s" }}
                      onMouseEnter={el=>{if(!isOpen)(el.currentTarget as any).style.background="#F0F7FF";}}
                      onMouseLeave={el=>{if(!isOpen)(el.currentTarget as any).style.background=i%2===0?"#fff":"#F8FAFF";}}>
                      {/* Expand icon */}
                      <td style={{ padding:"9px 8px", width:24 }}>
                        <span style={{ fontSize:10, color:C.muted, display:"inline-block", transform:isOpen?"rotate(90deg)":"none", transition:"transform 0.2s" }}>▶</span>
                      </td>
                      <td style={{ padding:"9px 10px", color:C.primary, fontWeight:700, fontFamily:"monospace", fontSize:11, whiteSpace:"nowrap" }}>
                        {e.name}
                      </td>
                      <td style={{ padding:"9px 10px", color:C.textSec, whiteSpace:"nowrap" }}>{e.date}</td>
                      <td style={{ padding:"9px 10px" }}>
                        <Badge label={e.journalName||"—"} bg={jc.bg} color={jc.c}/>
                      </td>
                      <td style={{ padding:"9px 10px", color:C.text, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {e.partnerName||"—"}
                      </td>
                      <td style={{ padding:"9px 10px", color:C.teal, fontWeight:600, whiteSpace:"nowrap" }}>
                        {(e.totalDebit||0)>0 ? fmt(e.totalDebit) : "—"}
                      </td>
                      <td style={{ padding:"9px 10px", color:C.red, fontWeight:600, whiteSpace:"nowrap" }}>
                        {(e.totalCredit||0)>0 ? fmt(e.totalCredit) : "—"}
                      </td>
                      <td style={{ padding:"9px 10px", color:C.textSec, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {e.narration||"—"}
                      </td>
                      <td style={{ padding:"9px 10px" }}>
                        <Badge label="✓ معتمد" bg={C.greenLight} color={C.green}/>
                      </td>
                    </tr>

                    {/* Expanded rows — سطور القيد */}
                    {isOpen && (
                      <tr key={`exp-${e.id}`}>
                        <td colSpan={9} style={{ padding:0, background:"#F8FAFF" }}>
                          <EntryLinesSection entryId={e.id} companyId={companyId} entry={e}/>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:"#F8FAFF" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:11, color:C.muted }}>
                صفحة <strong>{data.page}</strong> من <strong>{data.pages}</strong>
                {" "}({fmt(data.total)} قيد إجمالي)
              </span>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={()=>setPage(1)} disabled={page===1} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:page===1?"#F1F5F9":"#fff", color:page===1?C.muted:C.primary, cursor:page===1?"default":"pointer", fontSize:11 }}>⟪</button>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:page===1?"#F1F5F9":"#fff", color:page===1?C.muted:C.primary, cursor:page===1?"default":"pointer", fontSize:11 }}>←</button>
              {[...Array(Math.min(5,data.pages))].map((_,i)=>{
                const p = Math.max(1, Math.min(data.pages-4, page-2)) + i;
                return (
                  <button key={p} onClick={()=>setPage(p)}
                    style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${p===page?C.primary:C.border}`, background:p===page?C.primary:"#fff", color:p===page?"#fff":C.textSec, cursor:"pointer", fontSize:11, fontWeight:p===page?700:400 }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={()=>setPage(p=>Math.min(data.pages,p+1))} disabled={page===data.pages} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:page===data.pages?"#F1F5F9":"#fff", color:page===data.pages?C.muted:C.primary, cursor:page===data.pages?"default":"pointer", fontSize:11 }}>→</button>
              <button onClick={()=>setPage(data.pages)} disabled={page===data.pages} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:page===data.pages?"#F1F5F9":"#fff", color:page===data.pages?C.muted:C.primary, cursor:page===data.pages?"default":"pointer", fontSize:11 }}>⟫</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── سطور القيد المفصّلة ───────────────────────────────────────────────────────
function EntryLinesSection({ entryId, companyId, entry }:any) {
  const { data:linesData, isLoading } = trpc.journal.getEntryLines.useQuery(
    { entryId, companyId },
    { enabled:!!entryId }
  );

  const typeColors: Record<string,{bg:string,c:string}> = {
    assets:         {bg:"#EFF6FF",c:"#2563EB"},
    liabilities:    {bg:"#FEF2F2",c:"#DC2626"},
    equity:         {bg:"#F5F3FF",c:"#7C3AED"},
    revenue:        {bg:"#ECFDF5",c:"#059669"},
    expenses:       {bg:"#FFFBEB",c:"#D97706"},
    cogs:           {bg:"#FFF7ED",c:"#EA580C"},
    other_income:   {bg:"#F0FDFA",c:"#0D9488"},
    other_expenses: {bg:"#FFF1F2",c:"#E11D48"},
  };
  const typeLabels: Record<string,string> = {
    assets:"أصول", liabilities:"التزامات", equity:"حقوق ملكية",
    revenue:"إيرادات", expenses:"مصروفات", cogs:"تكلفة المبيعات",
    other_income:"إيرادات أخرى", other_expenses:"مصروفات أخرى",
  };

  const lines = linesData?.lines || [];
  const totalD = lines.reduce((s:number,l:any)=>s+(l.debit||0),0);
  const totalC = lines.reduce((s:number,l:any)=>s+(l.credit||0),0);

  return (
    <div style={{ padding:"0 12px 12px 12px", borderTop:`2px solid ${C.primarySoft}` }}>
      {/* Entry header */}
      <div style={{ display:"flex", gap:12, padding:"10px 4px 8px", borderBottom:`1px solid ${C.border}`, marginBottom:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:C.primary, fontWeight:700 }}>🔖 {entry.name}</span>
        <span style={{ fontSize:12, color:C.textSec }}>📅 {entry.date}</span>
        {entry.partnerName && <span style={{ fontSize:12, color:C.textSec }}>👤 {entry.partnerName}</span>}
        {entry.narration && <span style={{ fontSize:12, color:C.muted, fontStyle:"italic" }}>"{entry.narration}"</span>}
        <span style={{ marginRight:"auto", fontSize:11, color:C.muted }}>{lines.length} سطر</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign:"center", padding:20 }}><Spinner/></div>
      ) : lines.length === 0 ? (
        <div style={{ padding:"12px 8px", color:C.muted, fontSize:12, textAlign:"center" }}>
          ⚠️ لا توجد سطور لهذا القيد — قد تحتاج إعادة المزامنة
        </div>
      ) : (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ background:"#F0F4FA" }}>
              {["الحساب","كود الحساب","نوع الحساب","الشريك","البيان","مدين","دائن"].map(h=>(
                <th key={h} style={{ padding:"7px 10px", textAlign:"right", color:C.textSec, fontWeight:700, borderBottom:`1px solid ${C.border}`, fontSize:10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l:any, i:number) => {
              const tc = typeColors[l.accountType] || {bg:"#F8FAFC",c:"#64748B"};
              return (
                <tr key={i} style={{ borderBottom:`1px solid #F1F5F9`, background:i%2===0?"#fff":"#FAFCFF" }}>
                  <td style={{ padding:"7px 10px", color:C.text, fontWeight:500, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {l.account_name||l.accountName||"—"}
                  </td>
                  <td style={{ padding:"7px 10px", fontFamily:"monospace", color:C.primary, fontSize:11 }}>
                    {l.account_code||l.accountCode||"—"}
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    {(() => {
                      const at = l.account_type||l.accountType||"";
                      const tc2 = typeColors[at]||{bg:"#F8FAFC",c:"#64748B"};
                      return <Badge label={typeLabels[at]||at||"—"} bg={tc2.bg} color={tc2.c}/>;
                    })()}
                  </td>
                  <td style={{ padding:"7px 10px", color:C.textSec, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {l.partner_name||l.partnerName||"—"}
                  </td>
                  <td style={{ padding:"7px 10px", color:C.muted, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {l.label||"—"}
                  </td>
                  <td style={{ padding:"7px 10px", color:C.teal, fontWeight:(l.debit||0)>0?700:400, textAlign:"left", whiteSpace:"nowrap" }}>
                    {(l.debit||0)>0 ? fmt(l.debit) : "—"}
                  </td>
                  <td style={{ padding:"7px 10px", color:C.red, fontWeight:(l.credit||0)>0?700:400, textAlign:"left", whiteSpace:"nowrap" }}>
                    {(l.credit||0)>0 ? fmt(l.credit) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:C.primaryLight, borderTop:`2px solid ${C.primary}` }}>
              <td colSpan={5} style={{ padding:"8px 10px", color:C.primary, fontWeight:800, fontSize:12 }}>
                المجموع {Math.abs(totalD-totalC)<0.01?<span style={{ color:C.green, fontSize:10 }}> ✓ متوازن</span>:<span style={{ color:C.red, fontSize:10 }}> ⚠ غير متوازن ({fmt(Math.abs(totalD-totalC))})</span>}
              </td>
              <td style={{ padding:"8px 10px", color:C.teal, fontWeight:800, fontSize:12, textAlign:"left" }}>{fmt(totalD)}</td>
              <td style={{ padding:"8px 10px", color:C.red,  fontWeight:800, fontSize:12, textAlign:"left" }}>{fmt(totalC)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

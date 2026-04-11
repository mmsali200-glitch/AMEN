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
  { s:"الإدارة",         items:[{id:"holding",label:"الشركات القابضة",icon:"🏛️"},{id:"users",label:"المستخدمون",icon:"👥"},{id:"companies",label:"الشركات",icon:"🏢"},{id:"diagnostics",label:"تشخيص البيانات",icon:"🔬"},{id:"audit-log",label:"سجل النشاط",icon:"🔍"}]},
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

  const doSync = () => {
    if (!item.companyId || !item.odooId) return;
    setBusy(true); setDone(false); setLog([]); setPct(0); setRes(null);
    const steps:[number,string,string][] = [
      [5,  "🔗 الاتصال بـ Odoo...","info"],
      [15, "✅ تم تسجيل الدخول","success"],
      [25, "📚 استيراد دليل الحسابات...","info"],
      [35, "📋 استيراد الدفاتر المحاسبية...","info"],
      [45, "👥 استيراد الشركاء (عملاء + موردون)...","info"],
      [55, "📊 حساب الأرصدة الافتتاحية...","info"],
      [68, "📥 استيراد القيود المحاسبية...","info"],
      [82, "⚙️ معالجة وتصنيف السطور...","info"],
      [92, "💾 حفظ كل البيانات...","info"],
    ];
    let si=0;
    const iv=setInterval(()=>{ if(si<steps.length){ const[p,m,t]=steps[si]; setPct(p); add(m,t); si++; } },1000);

    fullSyncMut.mutate({
      companyId: item.companyId,
      odooCompanyId: item.odooId,
      dateFrom, dateTo,
      models: ["coa","journals","partners","currencies","entries"]
    },{
      onSuccess:(d:any)=>{
        clearInterval(iv); setPct(100);
        add(`✅ دليل الحسابات: ${d.coa||0} حساب`,"success");
        add(`✅ الدفاتر: ${d.journals||0} دفتر`,"success");
        add(`✅ الشركاء: ${d.partners||0} شريك`,"success");
        add(`✅ القيود: ${d.entries||0} قيد`,"success");
        add(`✅ الرصيد الافتتاحي: ${d.openingLines||0} سطر`,"success");
        setRes(d); setDone(true); setBusy(false); refetch();
      },
      onError:(e:any)=>{ clearInterval(iv); add(`❌ ${e.message}`,"error"); setBusy(false); setPct(0); }
    });
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


// ══════════════════════════════════════════════════════════════════════════════
// 📊 صفحات التقارير المالية
// ══════════════════════════════════════════════════════════════════════════════

// ── ميزان المراجعة ────────────────────────────────────────────────────────────
function TrialBalancePage({ companyId }:any) {
  const yr = new Date().getFullYear();
  const [dF, setDF] = useState(`${yr}-01-01`);
  const [dT, setDT] = useState(`${yr}-12-31`);
  const { data, isLoading } = trpc.journal.trialBalance.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId });

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
  const { data, isLoading } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId });

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
  const { data, isLoading } = trpc.journal.monthlyAnalysis.useQuery({ companyId, year }, { enabled:!!companyId });
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
  const { data:income } = trpc.journal.incomeStatement.useQuery({ companyId, dateFrom:dF, dateTo:dT }, { enabled:!!companyId });
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
      case "executive":         return <ExecutiveDashboardPage companyId={companyId} co={co}/>;
      case "ratios":            return <RatiosPage companyId={companyId}/>;
      case "monthly":           return <MonthlyPage companyId={companyId}/>;
      case "cashflow":          return <CashFlowPage companyId={companyId}/>;
      case "costs":             return <CostAnalysisPage companyId={companyId}/>;
      case "compare":           return <PeriodsComparePage companyId={companyId}/>;
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

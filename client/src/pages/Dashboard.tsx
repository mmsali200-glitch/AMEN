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
  { s:"ربط Odoo",        items:[{id:"odoo-setup",     label:"إعداد وربط Odoo",    icon:"🔗"},{id:"journal-sync",label:"مزامنة الحركات",icon:"🔄"}]},
  { s:"الدفاتر",         items:[{id:"journal-entries",label:"القيود المحاسبية",   icon:"📋"},{id:"general-ledger",label:"دفتر الأستاذ",icon:"📒"},{id:"partner-statement",label:"كشف حساب شريك",icon:"👤"}]},
  { s:"القوائم المالية", items:[{id:"trial-balance",  label:"ميزان المراجعة",     icon:"⚖️"},{id:"income",label:"قائمة الدخل",icon:"📈"},{id:"balance-sheet",label:"الميزانية العمومية",icon:"🏦"},{id:"cashflow",label:"التدفقات النقدية",icon:"💵"}]},
  { s:"التحليل",         items:[{id:"ratios",         label:"النسب المالية",      icon:"📉"},{id:"monthly",label:"التحليل الشهري",icon:"📅"}]},
  { s:"الذكاء AI",       items:[{id:"advisor",        label:"المستشار AI ✦",      icon:"🤖"},{id:"chatbot",label:"شات بوت مالي",icon:"💬"}]},
  { s:"الإدارة",         items:[{id:"users",          label:"المستخدمون",         icon:"👥"},{id:"companies",label:"الشركات",icon:"🏢"},{id:"audit-log",label:"سجل النشاط",icon:"🔍"}]},
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
function OdooSetupPage({ companyId, co }:any) {
  const [form, setForm] = useState({ url:"https://onesolutionc-roma.odoo.com", database:"onesolutionc-roma-main-17095422", username:"admin@admin.com", password:"KMM9999" });
  const [step, setStep] = useState<"idle"|"testing"|"selecting"|"done"|"error">("idle");
  const [result, setResult] = useState<any>(null);
  const [selectedOdooCompany, setSelectedOdooCompany] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const saveConfig = trpc.odoo.saveConfig.useMutation();
  const testDiscover = trpc.odoo.testAndDiscover.useMutation();

  const handleTest = () => {
    if (!companyId) return alert("اختر شركة من النظام أولاً");
    setStep("testing"); setErrorMsg(""); setResult(null); setSelectedOdooCompany(null);
    testDiscover.mutate(form, {
      onSuccess: (data) => { setResult(data); setStep("selecting"); },
      onError: (err) => { setStep("error"); setErrorMsg(err.message); }
    });
  };

  const handleSelectCompany = async (odooCompany: any) => {
    setSelectedOdooCompany(odooCompany);
    await saveConfig.mutateAsync({ companyId, ...form, odooCompanyId: odooCompany.id, odooCompanyName: odooCompany.name });
    setStep("done");
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="🔗 إعداد وربط Odoo ERP" sub="اربط شركتك بـ Odoo لاستيراد جميع البيانات المحاسبية" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Card style={{ padding:"22px" }}>
          <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 16px" }}>⚙️ بيانات الاتصال بـ Odoo</p>
          {[["رابط الخادم","url","text"],["قاعدة البيانات","database","text"],["اسم المستخدم","username","email"],["كلمة المرور","password","password"]].map(([l,k,type]) => (
            <div key={k} style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>{l}</label>
              <input type={type} value={(form as any)[k]} onChange={e=>setForm((f:any)=>({...f,[k]:e.target.value}))}
                style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none", direction:k==="url"||k==="database"||k==="username"||k==="password"?"ltr":"rtl", textAlign:"left", boxSizing:"border-box" as any }}/>
            </div>
          ))}
          <button onClick={handleTest} disabled={step==="testing"} style={{ width:"100%", padding:"11px", borderRadius:10, border:"none", background:step==="testing"?C.muted:"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:4 }}>
            {step==="testing" ? <><Spinner/> جاري الاتصال...</> : "⚡ اختبار الاتصال واكتشاف الشركات"}
          </button>
          {step==="error" && <div style={{ marginTop:10, padding:"10px 14px", borderRadius:8, background:C.redLight, border:`1px solid #FECACA`, color:C.red, fontSize:12 }}>⚠️ {errorMsg}</div>}
        </Card>

        <div>
          {step==="selecting" && result?.companies && (
            <Card style={{ padding:"22px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, padding:"10px 12px", borderRadius:8, background:C.greenLight, border:`1px solid #A7F3D0` }}>
                <span style={{ color:C.green, fontSize:18 }}>✅</span>
                <div>
                  <p style={{ fontWeight:700, color:C.green, margin:0, fontSize:13 }}>تم الاتصال — Odoo v{result.version}</p>
                  <p style={{ color:"#065F46", margin:0, fontSize:11 }}>{result.companies.length} شركة متاحة في قاعدة البيانات</p>
                </div>
              </div>
              <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 10px" }}>🏢 اختر الشركة التي تريد مزامنتها:</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto" }}>
                {result.companies.map((c:any, i:number) => (
                  <button key={c.id} onClick={() => handleSelectCompany(c)} style={{ padding:"12px 14px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.bg, cursor:"pointer", textAlign:"right", transition:"all 0.15s", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e=>{(e.currentTarget as any).style.background=C.primaryLight;(e.currentTarget as any).style.borderColor=C.primary;}}
                    onMouseLeave={e=>{(e.currentTarget as any).style.background=C.bg;(e.currentTarget as any).style.borderColor=C.border;}}>
                    <div>
                      <p style={{ fontWeight:700, color:C.text, margin:"0 0 2px", fontSize:13 }}>{c.name}</p>
                      <p style={{ color:C.muted, margin:0, fontSize:11 }}>
                        {c.currency && <span style={{ marginLeft:8 }}>💱 {c.currency}</span>}
                        {c.city && <span>📍 {c.city}</span>}
                      </p>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ padding:"2px 8px", borderRadius:18, background:C.primaryLight, color:C.primary, fontSize:10, fontWeight:700 }}>ID: {c.id}</span>
                      <span style={{ color:C.primary, fontSize:16 }}>←</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {step==="done" && selectedOdooCompany && (
            <Card style={{ padding:"22px", background:C.greenLight, border:`1px solid #A7F3D0` }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.green, margin:"0 0 14px" }}>✅ تم الربط بنجاح!</p>
              <div style={{ padding:"14px", borderRadius:10, background:"rgba(255,255,255,0.8)", marginBottom:10 }}>
                <p style={{ fontSize:11, color:C.textSec, margin:"0 0 4px" }}>الشركة المختارة من Odoo</p>
                <p style={{ fontSize:16, fontWeight:800, color:C.green, margin:0 }}>🏢 {selectedOdooCompany.name}</p>
                {selectedOdooCompany.currency && <p style={{ color:C.textSec, fontSize:12, margin:"4px 0 0" }}>العملة: {selectedOdooCompany.currency}</p>}
              </div>
              <p style={{ fontSize:12, color:"#065F46", margin:0, fontWeight:600 }}>✓ تم الحفظ — الآن اذهب لصفحة "مزامنة الحركات" لاستيراد البيانات</p>
            </Card>
          )}

          {(step==="idle" || step==="error") && (
            <Card style={{ padding:"22px" }}>
              <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 12px" }}>📋 كيف يعمل الربط؟</p>
              {[
                ["1","اضغط اختبار الاتصال — سيتصل بـ Odoo ويكتشف كل الشركات"],
                ["2","اختر الشركة التي تريد مزامنة بياناتها"],
                ["3","انتقل لصفحة مزامنة الحركات لاستيراد القيود مع الرصيد الافتتاحي"],
                ["4","جميع التقارير ستعمل تلقائياً بالبيانات الحقيقية"],
              ].map(([n,t])=>(
                <div key={n} style={{ display:"flex", gap:10, marginBottom:10 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:C.primarySoft, color:C.primary, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{n}</div>
                  <p style={{ fontSize:12, color:C.textSec, margin:0, lineHeight:1.6 }}>{t}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function JournalSyncPage({ companyId }:any) {
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [syncType, setSyncType] = useState("incremental");
  const [includeOpening, setIncludeOpening] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const { data:sync, refetch } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });
  const { data:config } = trpc.odoo.getConfig.useQuery({ companyId }, { enabled:!!companyId });
  const syncMutation = trpc.odoo.syncJournals.useMutation();

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log]);

  const addLog = (msg:string) => setLog(l => [...l, `[${new Date().toLocaleTimeString("ar")}] ${msg}`]);

  const handleSync = async () => {
    if (!companyId) return;
    if (!config?.odoo_company_id && !(config as any)?.odooCompanyId) {
      alert("⚠️ لم يتم اختيار شركة Odoo — اذهب لصفحة الإعداد أولاً واختر الشركة");
      return;
    }
    const odooCompanyId = (config as any)?.odoo_company_id || (config as any)?.odooCompanyId;

    setSyncing(true); setDone(false); setProgress(0); setLog([]);
    addLog("🔗 جاري الاتصال بـ Odoo...");
    setProgress(5);

    const progressInterval = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 8 : p);
    }, 1500);

    setTimeout(() => addLog("✅ تم المصادقة بنجاح"), 800);
    setTimeout(() => addLog(`📥 جاري جلب القيود من ${dateFrom} إلى ${dateTo}...`), 1500);
    if (includeOpening) setTimeout(() => addLog("📊 جاري حساب الأرصدة الافتتاحية لجميع الحسابات..."), 2500);
    setTimeout(() => addLog("⚙️ معالجة سطور القيود وتصنيف الحسابات..."), 3500);
    setTimeout(() => addLog("💾 حفظ البيانات في قاعدة البيانات..."), 5000);

    syncMutation.mutate({ companyId, odooCompanyId, dateFrom, dateTo, syncType, includeOpeningBalance: includeOpening }, {
      onSuccess: (data) => {
        clearInterval(progressInterval);
        setProgress(100);
        addLog(`✅ اكتملت المزامنة!`);
        addLog(`📋 تم استيراد ${data.inserted} قيد للفترة المحددة`);
        if (data.openingLines > 0) addLog(`📊 تم معالجة ${data.openingLines} سطر للرصيد الافتتاحي`);
        setSyncResult(data); setDone(true); setSyncing(false);
        refetch();
      },
      onError: (err) => {
        clearInterval(progressInterval);
        addLog(`❌ خطأ: ${err.message}`);
        setSyncing(false); setProgress(0);
      }
    });
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <PageTitle title="🔄 مزامنة الحركات المحاسبية" sub="استيراد القيود من Odoo مع الأرصدة الافتتاحية" />

      {/* الشركة المربوطة */}
      {config && (
        <Card style={{ padding:"12px 16px", marginBottom:14, background:C.greenLight, border:`1px solid #A7F3D0` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>🏢</span>
            <div>
              <p style={{ fontWeight:700, color:C.green, margin:0, fontSize:13 }}>الشركة المربوطة: {(config as any)?.odoo_company_name || "—"}</p>
              <p style={{ color:"#065F46", margin:0, fontSize:11 }}>{(config as any)?.url} | {(config as any)?.database}</p>
            </div>
          </div>
        </Card>
      )}

      {!config && (
        <Card style={{ padding:"14px 16px", marginBottom:14, background:C.amberLight, border:`1px solid #FDE68A` }}>
          <p style={{ color:"#92400E", margin:0, fontSize:13 }}>⚠️ لم يتم إعداد Odoo بعد — اذهب لصفحة "إعداد وربط Odoo" أولاً واختر الشركة</p>
        </Card>
      )}

      {/* إحصاءات */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[
          {l:"القيود المحاسبية",v:fmt(sync?.totalEntries||0),c:C.primary,bg:C.primaryLight},
          {l:"سطور القيود",v:fmt(sync?.totalLines||0),c:C.teal,bg:C.tealLight},
          {l:"آخر مزامنة",v:sync?.lastSync?.started_at||sync?.lastSync?.startedAt?new Date(sync.lastSync.started_at||sync.lastSync.startedAt).toLocaleDateString("ar"):"لم تتم",c:C.purple,bg:C.purpleLight},
        ].map((s,i)=>(
          <Card key={i} style={{ padding:"14px 16px" }}>
            <p style={{ color:C.muted, fontSize:10, margin:"0 0 3px" }}>{s.l}</p>
            <p style={{ fontSize:16, fontWeight:800, color:s.c, margin:0 }}>{s.v}</p>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Card style={{ padding:"20px" }}>
          <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 14px" }}>⚙️ إعدادات المزامنة</p>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>نوع المزامنة</label>
            <select value={syncType} onChange={e=>setSyncType(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12 }}>
              <option value="incremental">تزايدية — إضافة الجديد فقط</option>
              <option value="full">كاملة — إعادة بناء كامل (يمسح القديم)</option>
            </select>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>من تاريخ</label>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none" }}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, outline:"none" }}/>
            </div>
          </div>

          {/* خيار الرصيد الافتتاحي */}
          <label onClick={()=>setIncludeOpening(o=>!o)} style={{ display:"flex", gap:10, padding:"12px 14px", borderRadius:9, border:`1.5px solid ${includeOpening?C.primary:C.border}`, background:includeOpening?C.primaryLight:C.bg, cursor:"pointer", marginBottom:14, transition:"all 0.15s" }}>
            <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${includeOpening?C.primary:C.muted}`, background:includeOpening?C.primary:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
              {includeOpening && <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>✓</span>}
            </div>
            <div>
              <p style={{ fontSize:12, fontWeight:700, color:includeOpening?C.primary:C.text, margin:"0 0 2px" }}>✅ تضمين الرصيد الافتتاحي (مهم)</p>
              <p style={{ fontSize:11, color:C.textSec, margin:0, lineHeight:1.5 }}>يحسب أرصدة جميع الحسابات قبل فترة المزامنة ويخزّنها كرصيد افتتاحي — ضروري لصحة ميزان المراجعة</p>
            </div>
          </label>

          <button onClick={handleSync} disabled={syncing||!companyId||!config} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:syncing||!config?"#94A3B8":"linear-gradient(135deg,#2563EB,#0D9488)", color:"#fff", cursor:syncing||!config?"default":"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {syncing ? <><Spinner/>جاري المزامنة...</> : "▶ بدء المزامنة"}
          </button>

          {(syncing||done) && (
            <div style={{ marginTop:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:12, color:C.textSec }}>التقدم</span>
                <span style={{ fontSize:12, color:done?C.green:C.primary, fontWeight:700 }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ background:"#F1F5F9", borderRadius:6, height:8 }}>
                <div style={{ width:`${progress}%`, height:"100%", background:done?"linear-gradient(90deg,#059669,#0D9488)":"linear-gradient(90deg,#2563EB,#0D9488)", borderRadius:6, transition:"width 0.5s" }}/>
              </div>
            </div>
          )}
        </Card>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {log.length > 0 && (
            <Card style={{ background:"#0F172A", flex:1 }}>
              <div style={{ padding:"10px 14px 6px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize:11, color:"#94A3B8", fontWeight:600 }}>● سجل العمليات</span>
              </div>
              <div ref={logRef} style={{ padding:"10px 14px", maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
                {log.map((l,i) => (
                  <p key={i} style={{ fontSize:11, color:l.includes("✅")?"#34D399":l.includes("❌")?"#F87171":l.includes("📊")||l.includes("📋")?"#60A5FA":"#CBD5E1", margin:0, fontFamily:"monospace" }}>{l}</p>
                ))}
              </div>
            </Card>
          )}

          {done && syncResult && (
            <Card style={{ background:C.greenLight, border:`1px solid #A7F3D0`, padding:"18px" }}>
              <p style={{ fontWeight:800, fontSize:14, color:C.green, margin:"0 0 12px" }}>✅ اكتملت المزامنة!</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                {[
                  {l:"قيود الفترة",v:fmt(syncResult.inserted||0)},
                  {l:"إجمالي Odoo",v:fmt(syncResult.total||0)},
                  {l:"سطور افتتاحية",v:fmt(syncResult.openingLines||0)},
                  {l:"في قاعدة البيانات",v:fmt(sync?.totalEntries||0)},
                ].map((s,i)=>(
                  <div key={i} style={{ padding:"10px", borderRadius:8, background:"rgba(255,255,255,0.7)", textAlign:"center" }}>
                    <p style={{ fontSize:16, fontWeight:800, color:C.green, margin:"0 0 2px" }}>{s.v}</p>
                    <p style={{ fontSize:10, color:C.textSec, margin:0 }}>{s.l}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:C.green, margin:0, fontWeight:600 }}>🎉 يمكنك الآن الاطلاع على جميع التقارير المالية</p>
            </Card>
          )}

          {!syncing && !done && (
            <Card style={{ padding:"18px" }}>
              <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 10px" }}>📌 ملاحظات مهمة</p>
              {[
                "الرصيد الافتتاحي يُحسب تلقائياً من جميع الحركات قبل تاريخ البداية",
                "ميزان المراجعة سيعرض: افتتاحي + حركة الفترة + ختامي",
                "يُنصح بمزامنة كاملة في أول مرة ثم تزايدية بعدها",
                "يمكن مزامنة فترات مختلفة (شهر، ربع، سنة) حسب الحاجة",
              ].map((t,i)=>(
                <p key={i} style={{ fontSize:12, color:C.textSec, margin:"0 0 8px", display:"flex", gap:8 }}>
                  <span style={{ color:C.teal, fontWeight:700, flexShrink:0 }}>✓</span>{t}
                </p>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
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

// ── Companies ──────────────────────────────────────────────────────────────────
function CompaniesPage({ currentUser }:any) {
  const { data:companies, refetch } = trpc.company.list.useQuery();
  const createCo = trpc.company.create.useMutation({ onSuccess:()=>{ refetch(); setShowForm(false); } });
  const deleteCo = trpc.company.delete.useMutation({ onSuccess:()=>refetch() });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", industry:"", currency:"KWD", contactEmail:"" });
  const colors = [C.primary, C.teal, C.purple, C.amber];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle title="🏢 إدارة الشركات" sub={`${companies?.length||0} شركة مسجلة`} />
        {currentUser.role==="cfo_admin"&&<button onClick={()=>setShowForm(!showForm)} style={{ padding:"8px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>+ شركة جديدة</button>}
      </div>
      {showForm && (
        <Card style={{ padding:"18px 20px", background:C.primaryLight, marginBottom:14, border:`1px solid ${C.primarySoft}` }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {([["اسم الشركة","name","text"],["القطاع","industry","text"],["البريد","contactEmail","email"]] as any[]).map(([l,k,t])=>(
              <div key={k}><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:3, fontWeight:600 }}>{l}</label><input type={t} value={(form as any)[k]} onChange={(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}))} required={k==="name"} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
            ))}
            <div><label style={{ display:"block", fontSize:11, color:C.primary, marginBottom:3, fontWeight:600 }}>العملة</label><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.primarySoft}`, background:"#fff", color:C.text, fontSize:12 }}>{["KWD","SAR","AED","USD","EUR","GBP"].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>createCo.mutate(form as any)} disabled={createCo.isPending} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{createCo.isPending?"...":"حفظ"}</button>
            <button onClick={()=>setShowForm(false)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fff", color:C.textSec, cursor:"pointer", fontSize:12 }}>إلغاء</button>
          </div>
        </Card>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {companies?.map((co:any,i:number)=>(
          <Card key={co.id} style={{ padding:"20px 22px", borderTop:`3px solid ${colors[i%4]}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`${colors[i%4]}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏢</div>
              <Badge label={co.currency} bg={`${colors[i%4]}15`} color={colors[i%4]}/>
            </div>
            <h3 style={{ fontSize:14, fontWeight:800, color:C.text, margin:"0 0 4px" }}>{co.name}</h3>
            <p style={{ color:C.muted, fontSize:12, margin:"0 0 12px" }}>{co.industry||"—"}</p>
            {currentUser.role==="cfo_admin"&&<button onClick={()=>{if(confirm(`حذف "${co.name}"؟`))deleteCo.mutate({id:co.id})}} style={{ width:"100%", padding:"5px", borderRadius:7, border:`1px solid #FECACA`, background:C.redLight, color:C.red, cursor:"pointer", fontSize:10 }}>حذف</button>}
          </Card>
        ))}
      </div>
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
      case "odoo-setup":        return <OdooSetupPage companyId={companyId} co={co}/>;
      case "journal-sync":      return <JournalSyncPage companyId={companyId}/>;
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
      case "companies":         return user.role==="cfo_admin"?<CompaniesPage currentUser={user}/>:<NoData text="غير مصرح"/>;
      case "audit-log":         return user.role==="cfo_admin"?<AuditLogPage/>:<NoData text="غير مصرح"/>;
      case "profile":           return <ProfilePage user={user} onLogout={onLogout}/>;
      default:                  return <NoData text="هذه الصفحة قيد التطوير"/>;
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:"'Cairo','Segoe UI',sans-serif", overflow:"hidden" }}>
      <style>{`*{box-sizing:border-box;} ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px;} button,input,select{font-family:inherit;} @keyframes spin{to{transform:rotate(360deg)}} @keyframes bounce{from{transform:translateY(0);opacity:0.4}to{transform:translateY(-4px);opacity:1}}`}</style>
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

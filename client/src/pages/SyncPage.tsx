import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";

const C = { primary:"#2563EB", primaryLight:"#EFF6FF", primarySoft:"#DBEAFE", teal:"#0D9488", tealLight:"#F0FDFA", green:"#059669", greenLight:"#ECFDF5", red:"#DC2626", redLight:"#FEF2F2", amber:"#D97706", amberLight:"#FFFBEB", text:"#1E293B", textSec:"#475569", muted:"#94A3B8", surface:"#FFFFFF", surface2:"#F8FAFF", border:"#E2E8F0" };

const fmt = (n:number) => new Intl.NumberFormat("ar").format(Math.round(n));

export default function SyncPage({ companyId, companies }: { companyId:number; companies:any[] }) {
  const co = companies.find(c=>c.id===companyId);
  const { data:cfg } = trpc.odooConfig.get.useQuery({ companyId }, { enabled:!!companyId });
  const { data:syncStatus, refetch:refetchStatus } = trpc.journal.syncStatus.useQuery({ companyId }, { enabled:!!companyId });
  const syncMutation = trpc.journal.syncFromOdoo.useMutation();
  const clearMutation = trpc.journal.clearData.useMutation({ onSuccess:()=>refetchStatus() });

  const [syncType, setSyncType] = useState<"incremental"|"full">("incremental");
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [postedOnly, setPostedOnly] = useState(true);
  const [status, setStatus] = useState<"idle"|"running"|"done"|"error">("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [tab, setTab] = useState<"sync"|"history">("sync");
  const intervalRef = useRef<any>(null);
  const { data:entries } = trpc.journal.listEntries.useQuery({ companyId, page:1, limit:10 }, { enabled:!!companyId });

  if (!companyId) return <div style={{ padding:50, textAlign:"center", color:C.muted }}>اختر شركة أولاً</div>;

  const addLog = (msg:string) => setLogs(l => [...l, `[${new Date().toLocaleTimeString("ar")}] ${msg}`]);

  const startSync = async () => {
    if (!cfg) { alert("أضف إعدادات Odoo أولاً من صفحة ربط Odoo"); return; }
    setStatus("running"); setProgress(0); setLogs([]); setResult(null);
    addLog("جاري الاتصال بـ Odoo...");

    // محاكاة تقدم مرئي
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += syncType === "full" ? 2 : 5;
      if (p < 85) setProgress(p);
    }, 300);

    addLog("التحقق من الصلاحيات...");
    addLog("اكتشاف الإصدار...");

    try {
      addLog(syncType === "full" ? "مزامنة كاملة — جلب جميع القيود..." : "مزامنة تزايدية — القيود الجديدة فقط...");
      const res = await syncMutation.mutateAsync({ companyId, dateFrom, dateTo, syncType, postedOnly });
      clearInterval(intervalRef.current);
      setProgress(100);
      addLog(`✓ تم جلب ${res.totalEntries} قيد`);
      addLog(`✓ تم حفظ ${res.totalLines} سطر`);
      addLog(`✓ اكتملت المزامنة في ${((res.durationMs||0)/1000).toFixed(1)} ثانية`);
      setResult(res); setStatus("done"); refetchStatus();
    } catch(err:any) {
      clearInterval(intervalRef.current);
      addLog(`✗ خطأ: ${err.message}`);
      setStatus("error");
    }
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const steps = [
    { l:"الاتصال بـ Odoo", done:progress>=15 },
    { l:"التحقق من الصلاحيات", done:progress>=30 },
    { l:"سحب القيود المحاسبية", done:progress>=55 },
    { l:"معالجة السطور", done:progress>=75 },
    { l:"حفظ في قاعدة البيانات", done:progress>=90 },
    { l:"اكتملت المزامنة", done:progress>=100 },
  ];

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>مزامنة الحركات المحاسبية 🔄</h2>
        <p style={{ color:C.muted, fontSize:13, margin:"3px 0 0" }}>{co?.name} — سحب القيود من Odoo ERP</p>
      </div>

      {/* إحصائيات */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {[
          { l:"إجمالي القيود",  v:syncStatus?.totalEntries?fmt(syncStatus.totalEntries):"0", icon:"📋", c:C.primary, bg:C.primaryLight },
          { l:"سطور القيود",    v:syncStatus?.totalLines?fmt(syncStatus.totalLines):"0", icon:"📄", c:C.teal, bg:C.tealLight },
          { l:"آخر مزامنة",    v:syncStatus?.lastSync?.finishedAt?new Date(syncStatus.lastSync.finishedAt).toLocaleDateString("ar"):"—", icon:"🕐", c:C.amber, bg:C.amberLight },
          { l:"حالة Odoo",      v:cfg?"متصل":"غير متصل", icon:"⚙️", c:cfg?C.green:C.red, bg:cfg?C.greenLight:C.redLight },
        ].map((s,i)=>(
          <div key={i} style={{ background:C.surface, borderRadius:12, padding:"14px 16px", border:`1px solid ${C.border}`, borderTop:`3px solid ${s.c}`, display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontSize:20 }}>{s.icon}</span>
            <div><p style={{ color:C.muted, fontSize:10, margin:"0 0 2px" }}>{s.l}</p><p style={{ fontSize:15, fontWeight:700, color:s.c, margin:0 }}>{s.v}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:14, background:"#F1F5F9", borderRadius:9, padding:3, width:"fit-content" }}>
        {[{id:"sync",l:"تشغيل المزامنة"},{id:"history",l:"آخر القيود"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} style={{ padding:"7px 18px", borderRadius:7, border:"none", background:tab===t.id?C.surface:"transparent", color:tab===t.id?C.primary:C.muted, cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:400, boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="sync" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {/* إعدادات المزامنة */}
          <div style={{ background:C.surface, borderRadius:14, padding:"20px 22px", border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
            <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 16px" }}>⚙️ إعدادات المزامنة</p>

            {/* نوع المزامنة */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:8, fontWeight:600 }}>نوع المزامنة</label>
              {[
                { v:"incremental", l:"تزايدية (موصى بها)", d:"القيود الجديدة والمعدّلة فقط — أسرع وأكثر كفاءة" },
                { v:"full", l:"كاملة", d:"جميع القيود من البداية — للمزامنة الأولى أو إعادة البناء" },
              ].map(opt => (
                <label key={opt.v} onClick={()=>setSyncType(opt.v as any)} style={{ display:"flex", gap:10, padding:"10px 12px", borderRadius:9, border:`1.5px solid ${syncType===opt.v?C.primary:C.border}`, background:syncType===opt.v?C.primaryLight:"transparent", cursor:"pointer", marginBottom:8, transition:"all 0.15s" }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${syncType===opt.v?C.primary:C.muted}`, background:syncType===opt.v?C.primary:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                    {syncType===opt.v && <div style={{ width:7, height:7, borderRadius:"50%", background:"#fff" }}/>}
                  </div>
                  <div><p style={{ fontSize:12, fontWeight:600, color:syncType===opt.v?C.primary:C.text, margin:"0 0 2px" }}>{opt.l}</p><p style={{ fontSize:11, color:C.muted, margin:0 }}>{opt.d}</p></div>
                </label>
              ))}
            </div>

            {/* الفترة الزمنية */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div><label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>من تاريخ</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
              <div><label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى تاريخ</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:12, outline:"none", boxSizing:"border-box" as any }}/></div>
            </div>

            {/* خيارات */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"flex", gap:8, alignItems:"center", cursor:"pointer", fontSize:12, color:C.text, fontWeight:500 }}>
                <div onClick={()=>setPostedOnly(!postedOnly)} style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${postedOnly?C.primary:C.muted}`, background:postedOnly?C.primary:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {postedOnly && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
                </div>
                القيود المعتمدة (posted) فقط
              </label>
            </div>

            {!cfg && <div style={{ background:C.amberLight, border:`1px solid #FDE68A`, borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#92400E" }}>⚠ أضف إعدادات Odoo أولاً من صفحة <strong>ربط Odoo</strong></div>}

            <button onClick={startSync} disabled={status==="running"||!cfg} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:status==="running"||!cfg?"#94A3B8":"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", cursor:status==="running"||!cfg?"default":"pointer", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 2px 8px rgba(37,99,235,0.25)" }}>
              {status==="running" ? <><div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> جاري المزامنة...</> : "▶ بدء المزامنة"}
            </button>

            {syncStatus && syncStatus.totalEntries > 0 && (
              <button onClick={()=>{ if(confirm("مسح جميع القيود؟ لا يمكن التراجع.")) clearMutation.mutate({companyId}); }} style={{ width:"100%", padding:"9px", borderRadius:9, border:`1px solid #FECACA`, background:"#FFF5F5", color:C.red, cursor:"pointer", fontSize:12, fontWeight:600, marginTop:8 }}>
                🗑 مسح جميع البيانات
              </button>
            )}
          </div>

          {/* شريط التقدم + اللوج */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:C.surface, borderRadius:14, padding:"20px 22px", border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:0 }}>التقدم</p>
                {status==="done" && <span style={{ padding:"3px 10px", borderRadius:18, background:C.greenLight, color:C.green, fontSize:11, fontWeight:700 }}>✓ مكتمل</span>}
                {status==="running" && <span style={{ padding:"3px 10px", borderRadius:18, background:C.primaryLight, color:C.primary, fontSize:11, fontWeight:700 }}>جاري...</span>}
                {status==="error" && <span style={{ padding:"3px 10px", borderRadius:18, background:C.redLight, color:C.red, fontSize:11, fontWeight:700 }}>✗ خطأ</span>}
              </div>

              {/* حلقة دائرية */}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
                <div style={{ position:"relative", width:100, height:100 }}>
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="7"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={status==="done"?C.teal:status==="error"?C.red:C.primary} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${2*Math.PI*42}`} strokeDashoffset={`${2*Math.PI*42*(1-progress/100)}`} transform="rotate(-90 50 50)" style={{ transition:"stroke-dashoffset 0.4s ease" }}/>
                  </svg>
                  <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
                    <p style={{ fontSize:20, fontWeight:800, color:status==="done"?C.teal:status==="error"?C.red:C.primary, margin:0 }}>{progress}%</p>
                    <p style={{ fontSize:9, color:C.muted, margin:0 }}>{status==="running"?"جاري":status==="done"?"مكتمل":status==="error"?"خطأ":"انتظار"}</p>
                  </div>
                </div>
              </div>

              {/* شريط */}
              <div style={{ background:"#F1F5F9", borderRadius:5, height:6, overflow:"hidden", marginBottom:14 }}>
                <div style={{ width:`${progress}%`, height:"100%", background:status==="done"?C.teal:status==="error"?C.red:C.primary, borderRadius:5, transition:"width 0.4s ease" }}/>
              </div>

              {/* خطوات */}
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {steps.map((s,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, opacity:s.done||status==="running"?1:0.4 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:s.done?C.teal:"#E2E8F0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.3s" }}>
                      {s.done && <span style={{ color:"#fff", fontSize:9, fontWeight:700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize:11, color:s.done?C.teal:C.muted, fontWeight:s.done?600:400 }}>{s.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* لوج حي */}
            {logs.length > 0 && (
              <div style={{ background:"#0F172A", borderRadius:12, padding:"14px 16px", border:"1px solid #1E293B", flex:1 }}>
                <p style={{ color:"#64748B", fontSize:10, margin:"0 0 8px", fontWeight:700, letterSpacing:"0.05em" }}>SYNC LOG</p>
                <div style={{ maxHeight:120, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
                  {logs.map((l,i)=>(
                    <p key={i} style={{ color:l.includes("✓")?"#34D399":l.includes("✗")?"#F87171":"#94A3B8", fontSize:11, margin:0, fontFamily:"monospace" }}>{l}</p>
                  ))}
                </div>
              </div>
            )}

            {/* نتائج */}
            {status==="done" && result && (
              <div style={{ background:C.greenLight, border:`1px solid #A7F3D0`, borderRadius:12, padding:"14px 18px" }}>
                <p style={{ fontWeight:700, fontSize:13, color:C.green, margin:"0 0 10px" }}>✅ اكتملت المزامنة!</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {[{l:"القيود الجديدة",v:fmt(result.totalEntries)},{l:"السطور المحفوظة",v:fmt(result.totalLines)},{l:"الوقت المستغرق",v:`${((result.durationMs||0)/1000).toFixed(1)}ث`}].map((s,i)=>(
                    <div key={i} style={{ padding:"10px", borderRadius:8, background:"rgba(255,255,255,0.7)", textAlign:"center" }}>
                      <p style={{ fontSize:16, fontWeight:800, color:C.teal, margin:"0 0 2px" }}>{s.v}</p>
                      <p style={{ fontSize:10, color:"#065F46", margin:0 }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==="history" && (
        <div style={{ background:C.surface, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead><tr style={{ background:C.primaryLight }}>{["رقم القيد","التاريخ","الدفتر","الشريك","مدين","دائن","الحالة"].map(h=><th key={h} style={{ padding:"11px 12px", textAlign:"right", color:C.primary, fontWeight:700, borderBottom:`1px solid ${C.primarySoft}`, fontSize:11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {entries?.entries.map((e,i)=>(
                <tr key={e.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:C.surface2 }}>
                  <td style={{ padding:"9px 12px", color:C.primary, fontWeight:700, fontFamily:"monospace", fontSize:11 }}>{e.name}</td>
                  <td style={{ padding:"9px 12px", color:C.textSec }}>{e.date}</td>
                  <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 8px", borderRadius:18, background:C.primaryLight, color:C.primary, fontSize:10 }}>{e.journalName||"—"}</span></td>
                  <td style={{ padding:"9px 12px", color:C.text }}>{e.partnerName||"—"}</td>
                  <td style={{ padding:"9px 12px", color:C.teal, fontWeight:600 }}>{fmt(e.totalDebit)}</td>
                  <td style={{ padding:"9px 12px", color:C.red, fontWeight:600 }}>{fmt(e.totalCredit)}</td>
                  <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 8px", borderRadius:18, background:C.greenLight, color:C.green, fontSize:10, fontWeight:600 }}>{e.state}</span></td>
                </tr>
              ))}
              {(!entries?.entries.length) && <tr><td colSpan={7} style={{ padding:"30px", textAlign:"center", color:C.muted, fontSize:13 }}>لا توجد قيود — ابدأ المزامنة أو ارفع ميزان مراجعة</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

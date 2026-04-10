import { useState, useRef } from "react";
import { trpc } from "../lib/trpc";

const C = { primary:"#2563EB", primaryLight:"#EFF6FF", teal:"#0D9488", tealLight:"#F0FDFA", green:"#059669", greenLight:"#ECFDF5", red:"#DC2626", redLight:"#FEF2F2", amber:"#D97706", amberLight:"#FFFBEB", text:"#1E293B", textSec:"#475569", muted:"#94A3B8", surface:"#FFFFFF", surface2:"#F8FAFF", border:"#E2E8F0" };

// نموذج بيانات ميزان المراجعة
const TEMPLATE_DATA = [
  ["رمز الحساب","اسم الحساب","افتتاحي مدين","افتتاحي دائن","حركة مدين","حركة دائن"],
  ["1100","الصندوق والبنوك","250000","0","1850000","1620000"],
  ["1200","العملاء والمدينون","820000","0","2100000","1980000"],
  ["1300","المخزون","430000","0","890000","750000"],
  ["1500","الأصول الثابتة","1200000","0","350000","120000"],
  ["2100","الموردون والدائنون","0","380000","1450000","1620000"],
  ["3100","رأس المال","0","1000000","0","0"],
  ["4100","إيرادات المبيعات","0","0","0","12300000"],
  ["5100","تكلفة المبيعات","0","0","7800000","0"],
  ["6100","مصروفات إدارية","0","0","1850000","0"],
  ["6200","مصروفات تسويقية","0","0","920000","0"],
];

export default function UploadPage({ companyId, companies }: { companyId:number; companies:any[] }) {
  const co = companies.find(c=>c.id===companyId);
  const uploadMutation = trpc.journal.uploadTrialBalance.useMutation();

  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"upload"|"manual">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  // قراءة ملف CSV
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l=>l.trim());
      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c=>c.trim().replace(/"/g,""));
        if (cols.length < 2) continue;
        const oD = parseFloat(cols[2])||0, oC = parseFloat(cols[3])||0, mD = parseFloat(cols[4])||0, mC = parseFloat(cols[5])||0;
        if (oD===0&&oC===0&&mD===0&&mC===0) continue;
        parsed.push({ accountCode:cols[0], accountName:cols[1], openingDebit:oD, openingCredit:oC, mvtDebit:mD, mvtCredit:mC });
      }
      setRows(parsed);
      setError(parsed.length===0?"لم يتم إيجاد بيانات صالحة في الملف":"");
    };
    reader.readAsText(file, "utf-8");
  };

  // تنزيل نموذج CSV
  const downloadTemplate = () => {
    const csv = TEMPLATE_DATA.map(r=>r.join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ميزان_المراجعة_${new Date().getFullYear()}.csv`;
    a.click();
  };

  const handleUpload = async () => {
    if (!rows.length) { setError("لا توجد بيانات للرفع"); return; }
    setError(""); setSuccess("");
    try {
      const res = await uploadMutation.mutateAsync({ companyId, dateFrom, dateTo, entries:rows });
      setSuccess(`✅ تم رفع ${res.accounts} حساب بنجاح!`);
      setRows([]);
    } catch(err:any) { setError(err.message); }
  };

  if (!companyId) return <div style={{ padding:50, textAlign:"center", color:C.muted }}>اختر شركة أولاً</div>;

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>رفع ميزان المراجعة 📁</h2>
        <p style={{ color:C.muted, fontSize:13, margin:"3px 0 0" }}>{co?.name} — رفع بيانات من ملف Excel/CSV</p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:16, background:"#F1F5F9", borderRadius:9, padding:3, width:"fit-content" }}>
        {[{id:"upload",l:"رفع ملف CSV"},{id:"manual",l:"إدخال يدوي"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} style={{ padding:"7px 18px", borderRadius:7, border:"none", background:tab===t.id?C.surface:"transparent", color:tab===t.id?C.primary:C.muted, cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:400, boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>{t.l}</button>
        ))}
      </div>

      {/* الفترة الزمنية - مشتركة */}
      <div style={{ background:C.surface, borderRadius:12, padding:"16px 18px", border:`1px solid ${C.border}`, marginBottom:14, display:"flex", gap:14, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div><label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>من تاريخ</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:12, outline:"none" }}/></div>
        <div><label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>إلى تاريخ</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:12, outline:"none" }}/></div>
        <div style={{ fontSize:12, color:C.muted }}>📅 الفترة: <strong style={{ color:C.text }}>{dateFrom}</strong> إلى <strong style={{ color:C.text }}>{dateTo}</strong></div>
      </div>

      {tab==="upload" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ background:C.surface, borderRadius:14, padding:"22px 24px", border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
            <p style={{ fontWeight:700, fontSize:14, color:C.text, margin:"0 0 16px" }}>📋 خطوات الرفع</p>

            <div style={{ marginBottom:14 }}>
              <p style={{ fontSize:12, color:C.textSec, margin:"0 0 8px", fontWeight:600 }}>1. نزّل النموذج الجاهز</p>
              <button onClick={downloadTemplate} style={{ width:"100%", padding:"10px", borderRadius:9, border:`1.5px solid ${C.primarySoft}`, background:C.primaryLight, color:C.primary, cursor:"pointer", fontSize:12, fontWeight:700 }}>
                ⬇ تنزيل نموذج CSV
              </button>
            </div>

            <div style={{ marginBottom:14 }}>
              <p style={{ fontSize:12, color:C.textSec, margin:"0 0 8px", fontWeight:600 }}>2. أدخل بياناتك في النموذج</p>
              <div style={{ background:C.surface2, borderRadius:8, padding:"10px 12px", fontSize:11, color:C.textSec, lineHeight:1.8 }}>
                <p style={{ margin:"0 0 4px", fontWeight:600, color:C.text }}>أعمدة الملف:</p>
                <p style={{ margin:0 }}>A: رمز الحساب | B: اسم الحساب<br/>C: افتتاحي مدين | D: افتتاحي دائن<br/>E: حركة مدين | F: حركة دائن</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize:12, color:C.textSec, margin:"0 0 8px", fontWeight:600 }}>3. ارفع الملف</p>
              <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${C.border}`, borderRadius:10, padding:"20px", textAlign:"center", cursor:"pointer", background:C.surface2, transition:"all 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor=C.primary)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
                <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
                <p style={{ fontWeight:600, color:C.text, margin:"0 0 4px", fontSize:13 }}>اضغط لاختيار الملف</p>
                <p style={{ color:C.muted, fontSize:11, margin:0 }}>CSV أو Excel (بعد حفظه كـ CSV)</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:"none" }}/>
            </div>
          </div>

          <div>
            {error && <div style={{ background:C.redLight, border:`1px solid #FECACA`, borderRadius:10, padding:"12px 16px", marginBottom:12, color:C.red, fontSize:13 }}>⚠ {error}</div>}
            {success && <div style={{ background:C.greenLight, border:`1px solid #A7F3D0`, borderRadius:10, padding:"12px 16px", marginBottom:12, color:C.green, fontSize:13, fontWeight:600 }}>{success}</div>}

            {rows.length > 0 ? (
              <div style={{ background:C.surface, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ padding:"12px 16px", background:C.primaryLight, borderBottom:`1px solid ${C.primarySoft}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <p style={{ fontWeight:700, fontSize:13, color:C.primary, margin:0 }}>معاينة البيانات ({rows.length} حساب)</p>
                  <button onClick={handleUpload} disabled={uploadMutation.isPending} style={{ padding:"7px 16px", borderRadius:8, border:"none", background:uploadMutation.isPending?"#94A3B8":C.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                    {uploadMutation.isPending?"جاري الرفع...":"✓ رفع البيانات"}
                  </button>
                </div>
                <div style={{ maxHeight:320, overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead><tr style={{ background:C.surface2, position:"sticky", top:0 }}>{["الكود","الحساب","افت.م","افت.د","حركة.م","حركة.د"].map(h=><th key={h} style={{ padding:"8px 10px", textAlign:"right", color:C.muted, fontWeight:600 }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.slice(0,50).map((r,i)=>(
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:C.surface2 }}>
                          <td style={{ padding:"7px 10px", color:C.primary, fontFamily:"monospace", fontSize:11 }}>{r.accountCode}</td>
                          <td style={{ padding:"7px 10px", color:C.text, fontWeight:500 }}>{r.accountName}</td>
                          <td style={{ padding:"7px 10px", color:r.openingDebit>0?C.teal:C.muted }}>{r.openingDebit>0?r.openingDebit.toLocaleString("ar"):"—"}</td>
                          <td style={{ padding:"7px 10px", color:r.openingCredit>0?C.red:C.muted }}>{r.openingCredit>0?r.openingCredit.toLocaleString("ar"):"—"}</td>
                          <td style={{ padding:"7px 10px", color:r.mvtDebit>0?C.teal:C.muted }}>{r.mvtDebit>0?r.mvtDebit.toLocaleString("ar"):"—"}</td>
                          <td style={{ padding:"7px 10px", color:r.mvtCredit>0?C.red:C.muted }}>{r.mvtCredit>0?r.mvtCredit.toLocaleString("ar"):"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ background:C.surface, borderRadius:14, padding:"40px 24px", border:`2px dashed ${C.border}`, textAlign:"center" }}>
                <div style={{ fontSize:44, marginBottom:12 }}>📊</div>
                <h3 style={{ fontSize:15, fontWeight:700, color:C.text, margin:"0 0 8px" }}>في انتظار الملف</h3>
                <p style={{ color:C.muted, fontSize:13 }}>ارفع ملف CSV لرؤية معاينة البيانات هنا</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==="manual" && (
        <ManualEntry companyId={companyId} dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}

function ManualEntry({ companyId, dateFrom, dateTo }: any) {
  const uploadMutation = trpc.journal.uploadTrialBalance.useMutation();
  const [rows, setRows] = useState([
    { accountCode:"", accountName:"", openingDebit:0, openingCredit:0, mvtDebit:0, mvtCredit:0 }
  ]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const addRow = () => setRows(r=>[...r,{ accountCode:"", accountName:"", openingDebit:0, openingCredit:0, mvtDebit:0, mvtCredit:0 }]);
  const updateRow = (i:number, k:string, v:any) => setRows(r=>r.map((row,idx)=>idx===i?{...row,[k]:v}:row));
  const removeRow = (i:number) => setRows(r=>r.filter((_,idx)=>idx!==i));

  const handleSave = async () => {
    const valid = rows.filter(r=>r.accountCode&&r.accountName);
    if (!valid.length) { setError("أدخل بيانات الحسابات أولاً"); return; }
    setError("");
    try {
      const res = await uploadMutation.mutateAsync({ companyId, dateFrom, dateTo, entries:valid });
      setSuccess(`✅ تم حفظ ${res.accounts} حساب`);
    } catch(err:any) { setError(err.message); }
  };

  const C2 = { primary:"#2563EB", primaryLight:"#EFF6FF", primarySoft:"#DBEAFE", teal:"#0D9488", red:"#DC2626", text:"#1E293B", muted:"#94A3B8", surface:"#FFFFFF", surface2:"#F8FAFF", border:"#E2E8F0", green:"#059669", greenLight:"#ECFDF5", redLight:"#FEF2F2" };

  return (
    <div style={{ background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`, overflow:"hidden" }}>
      {error && <div style={{ background:C2.redLight, padding:"10px 16px", color:C2.red, fontSize:13 }}>⚠ {error}</div>}
      {success && <div style={{ background:C2.greenLight, padding:"10px 16px", color:C2.green, fontSize:13, fontWeight:600 }}>{success}</div>}
      <div style={{ padding:"12px 16px", background:C2.primaryLight, borderBottom:`1px solid ${C2.primarySoft}`, display:"flex", justifyContent:"space-between" }}>
        <p style={{ fontWeight:700, fontSize:13, color:C2.primary, margin:0 }}>إدخال يدوي ({rows.length} حساب)</p>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={addRow} style={{ padding:"6px 14px", borderRadius:7, border:`1px solid ${C2.primarySoft}`, background:C2.surface, color:C2.primary, cursor:"pointer", fontSize:12, fontWeight:600 }}>+ سطر</button>
          <button onClick={handleSave} disabled={uploadMutation.isPending} style={{ padding:"6px 14px", borderRadius:7, border:"none", background:uploadMutation.isPending?"#94A3B8":C2.primary, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>{uploadMutation.isPending?"جاري...":"حفظ"}</button>
        </div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:C2.surface2 }}>{["رمز الحساب","اسم الحساب","افتتاحي مدين","افتتاحي دائن","حركة مدين","حركة دائن",""].map(h=><th key={h} style={{ padding:"9px 10px", textAlign:"right", color:C2.muted, fontWeight:600, borderBottom:`1px solid ${C2.border}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${C2.border}` }}>
                <td style={{ padding:"6px 8px" }}><input value={r.accountCode} onChange={e=>updateRow(i,"accountCode",e.target.value)} placeholder="1100" style={{ width:80, padding:"6px 8px", borderRadius:6, border:`1px solid ${C2.border}`, fontSize:12, direction:"ltr", outline:"none" }}/></td>
                <td style={{ padding:"6px 8px" }}><input value={r.accountName} onChange={e=>updateRow(i,"accountName",e.target.value)} placeholder="اسم الحساب" style={{ width:180, padding:"6px 8px", borderRadius:6, border:`1px solid ${C2.border}`, fontSize:12, outline:"none" }}/></td>
                {["openingDebit","openingCredit","mvtDebit","mvtCredit"].map(k=>(
                  <td key={k} style={{ padding:"6px 8px" }}><input type="number" value={(r as any)[k]||""} onChange={e=>updateRow(i,k,parseFloat(e.target.value)||0)} style={{ width:100, padding:"6px 8px", borderRadius:6, border:`1px solid ${C2.border}`, fontSize:12, direction:"ltr", outline:"none" }}/></td>
                ))}
                <td style={{ padding:"6px 8px" }}><button onClick={()=>removeRow(i)} style={{ padding:"4px 8px", borderRadius:5, border:"1px solid #FECACA", background:"#FFF5F5", color:C2.red, cursor:"pointer", fontSize:11 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "../lib/trpc";

const C = { primary:"#2563EB", primaryLight:"#EFF6FF", primarySoft:"#DBEAFE", teal:"#0D9488", tealLight:"#F0FDFA", green:"#059669", greenLight:"#ECFDF5", red:"#DC2626", redLight:"#FEF2F2", amber:"#D97706", amberLight:"#FFFBEB", text:"#1E293B", textSec:"#475569", muted:"#94A3B8", surface:"#FFFFFF", surface2:"#F8FAFF", border:"#E2E8F0" };

export default function OdooPage({ companyId, companies }: { companyId:number; companies:any[] }) {
  const co = companies.find(c => c.id === companyId);
  const { data: cfg, refetch } = trpc.odooConfig.get.useQuery({ companyId }, { enabled:!!companyId });
  const testMutation = trpc.odooConfig.testConnection.useMutation();
  const deleteMutation = trpc.odooConfig.delete.useMutation({ onSuccess:()=>refetch() });

  const [form, setForm] = useState({ url:"", database:"", username:"", password:"" });
  const [step, setStep] = useState<"config"|"success">("config");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  if (!companyId) return <div style={{ padding:50, textAlign:"center", color:C.muted }}>اختر شركة أولاً</div>;

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const res = await testMutation.mutateAsync({ companyId, ...form });
      setResult(res);
      setStep("success");
      refetch();
    } catch(err:any) {
      setErr(err.message || "فشل الاتصال — تحقق من البيانات");
    }
  };

  return (
    <div style={{ padding:"0 24px 28px", direction:"rtl" }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0 }}>ربط Odoo ERP ⚙️</h2>
        <p style={{ color:C.muted, fontSize:13, margin:"3px 0 0" }}>{co?.name} — ربط مباشر بنظام Odoo لسحب البيانات المحاسبية تلقائياً</p>
      </div>

      {/* الحالة الحالية */}
      {cfg && (
        <div style={{ background:C.greenLight, border:`1px solid #A7F3D0`, borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ fontSize:22 }}>✅</span>
            <div>
              <p style={{ fontWeight:700, color:C.green, margin:0, fontSize:14 }}>Odoo متصل — الإصدار {cfg.odooVersion}</p>
              <p style={{ color:C.textSec, fontSize:12, margin:"2px 0 0", direction:"ltr" }}>{cfg.url} / {cfg.database}</p>
            </div>
          </div>
          <button onClick={()=>{ if(confirm("حذف إعدادات Odoo؟")) deleteMutation.mutate({companyId}); }} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid #FCA5A5`, background:"#FFF5F5", color:C.red, cursor:"pointer", fontSize:12, fontWeight:600 }}>فصل الاتصال</button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        {/* نموذج الإعداد */}
        <div style={{ background:C.surface, borderRadius:14, padding:"22px 24px", border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.text, margin:"0 0 16px" }}>🔗 بيانات اتصال Odoo</h3>

          {err && <div style={{ background:C.redLight, border:`1px solid #FECACA`, borderRadius:8, padding:"10px 14px", marginBottom:14, color:C.red, fontSize:13 }}>⚠ {err}</div>}

          <form onSubmit={handleTest}>
            {[
              { l:"رابط الخادم", k:"url", p:"https://mycompany.odoo.com", ltr:true },
              { l:"قاعدة البيانات", k:"database", p:"my_company_db", ltr:true },
              { l:"اسم المستخدم", k:"username", p:"admin@company.com", ltr:true },
              { l:"كلمة المرور / API Key", k:"password", p:"••••••••", ltr:true, type:"password" },
            ].map(f => (
              <div key={f.k} style={{ marginBottom:12 }}>
                <label style={{ display:"block", fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>{f.l}</label>
                <input type={f.type||"text"} placeholder={f.p} value={(form as any)[f.k]} onChange={e=>setForm((prev:any)=>({...prev,[f.k]:e.target.value}))} required
                  style={{ width:"100%", padding:"10px 12px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:13, direction:"ltr", textAlign:"left", outline:"none", boxSizing:"border-box" as any }} />
              </div>
            ))}

            <button type="submit" disabled={testMutation.isPending} style={{ width:"100%", padding:"11px", borderRadius:10, border:"none", background:testMutation.isPending?"#94A3B8":"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", fontSize:14, fontWeight:700, cursor:testMutation.isPending?"default":"pointer", marginTop:4, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>
              {testMutation.isPending ? "⟳ جاري الاختبار..." : "⚡ اختبار الاتصال"}
            </button>
          </form>
        </div>

        {/* النتيجة */}
        <div>
          {step==="success" && result ? (
            <div style={{ background:C.surface, borderRadius:14, padding:"22px 24px", border:`1px solid ${C.border}`, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
                <h3 style={{ fontSize:16, fontWeight:800, color:C.green, margin:0 }}>تم الاتصال بنجاح!</h3>
                <p style={{ color:C.muted, fontSize:13, margin:"4px 0 0" }}>Odoo الإصدار {result.version}</p>
              </div>

              <p style={{ fontWeight:700, fontSize:13, color:C.text, margin:"0 0 10px" }}>الشركات المكتشفة ({result.companies?.length || 0})</p>
              {result.companies?.map((c:any, i:number) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderRadius:9, border:`1px solid ${C.border}`, background:C.surface2, marginBottom:8 }}>
                  <div>
                    <p style={{ fontWeight:600, color:C.text, margin:0, fontSize:13 }}>{c.name}</p>
                    <p style={{ color:C.muted, fontSize:11, margin:"2px 0 0" }}>ID: {c.id} | {c.currency}</p>
                  </div>
                  <span style={{ padding:"3px 9px", borderRadius:18, background:C.primaryLight, color:C.primary, fontSize:10, fontWeight:700 }}>Odoo #{c.id}</span>
                </div>
              ))}

              <div style={{ background:C.primaryLight, borderRadius:10, padding:"12px 16px", marginTop:12 }}>
                <p style={{ fontSize:12, color:C.primary, fontWeight:600, margin:"0 0 4px" }}>الخطوة التالية 👇</p>
                <p style={{ fontSize:12, color:C.textSec, margin:0 }}>اذهب إلى صفحة <strong>مزامنة الحركات</strong> لسحب القيود المحاسبية من Odoo</p>
              </div>
            </div>
          ) : (
            <div style={{ background:C.surface, borderRadius:14, padding:"22px 24px", border:`2px dashed ${C.border}` }}>
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🔗</div>
                <h3 style={{ fontSize:15, fontWeight:700, color:C.text, margin:"0 0 8px" }}>اربط Odoo الآن</h3>
                <p style={{ color:C.muted, fontSize:13, lineHeight:1.8 }}>بعد الربط ستتمكن من:<br/>• سحب القيود المحاسبية تلقائياً<br/>• مزامنة تزايدية يومية<br/>• دعم الإصدارات 14 حتى 19</p>
              </div>

              <div style={{ marginTop:16 }}>
                <p style={{ fontWeight:700, fontSize:12, color:C.textSec, margin:"0 0 8px" }}>كيفية الحصول على بيانات الاتصال:</p>
                <div style={{ fontSize:12, color:C.textSec, lineHeight:1.9 }}>
                  <p style={{ margin:"0 0 4px" }}>1. افتح Odoo → الإعدادات → Technical → API Keys</p>
                  <p style={{ margin:"0 0 4px" }}>2. أنشئ API Key جديد وانسخه</p>
                  <p style={{ margin:0 }}>3. اسم قاعدة البيانات يظهر في URL الخاص بك</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* معلومات الدعم */}
      <div style={{ background:C.amberLight, border:`1px solid #FDE68A`, borderRadius:12, padding:"14px 18px", marginTop:16, display:"flex", gap:10 }}>
        <span style={{ fontSize:18 }}>💡</span>
        <div style={{ fontSize:12, color:"#92400E", lineHeight:1.8 }}>
          <strong>ملاحظة:</strong> يدعم النظام Odoo الإصدارات 14، 15، 16، 17 و18+. يتم اكتشاف الإصدار تلقائياً عند الاتصال.
          للـ Odoo 18+ يستخدم <code>company_ids</code> بدلاً من <code>company_id</code>.
        </div>
      </div>
    </div>
  );
}

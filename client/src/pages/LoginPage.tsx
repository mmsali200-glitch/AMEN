import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@cfo.local");
  const [password, setPassword] = useState("Admin@2024");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => onLogin(data.token),
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

  const demoUsers = [
    { label: "المدير المالي", email: "admin@cfo.local", pwd: "Admin@2024", color: "#2563EB" },
    { label: "مدير", email: "ahmed@cfo.local", pwd: "Ahmed@123", color: "#0D9488" },
    { label: "محاسب", email: "fatima@cfo.local", pwd: "Fatima@123", color: "#7C3AED" },
    { label: "مدقق", email: "mkandari@cfo.local", pwd: "Mohammed@123", color: "#D97706" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#EFF6FF 0%,#F0FDF4 50%,#FFF7ED 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, direction:"rtl", fontFamily:"'Cairo','Segoe UI',sans-serif" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .card{animation:fadeUp 0.5s ease} input:focus{outline:none!important;border-color:#2563EB!important;box-shadow:0 0 0 3px rgba(37,99,235,0.12)!important} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div className="card" style={{ width:"100%", maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#2563EB,#0D9488)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"0 8px 24px rgba(37,99,235,0.25)" }}>
            <span style={{ color:"#fff", fontWeight:800, fontSize:26 }}>م</span>
          </div>
          <h1 style={{ color:"#1E293B", fontSize:22, fontWeight:800, margin:0 }}>المستشار المالي</h1>
          <p style={{ color:"#94A3B8", fontSize:12, margin:"4px 0 0" }}>CFO Intelligence System v4</p>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:20, padding:"28px 28px 24px", boxShadow:"0 4px 40px rgba(0,0,0,0.08)", border:"1px solid rgba(226,232,240,0.8)" }}>
          <h2 style={{ color:"#1E293B", fontSize:17, fontWeight:700, margin:"0 0 20px", textAlign:"center" }}>تسجيل الدخول</h2>

          {error && (
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13, display:"flex", gap:8 }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", color:"#64748B", fontSize:12, marginBottom:6, fontWeight:600 }}>البريد الإلكتروني</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E2E8F0", background:"#F8FAFC", color:"#1E293B", fontSize:13, direction:"ltr", textAlign:"left", transition:"all 0.2s", boxSizing:"border-box" }} />
            </div>
            <div style={{ marginBottom:22 }}>
              <label style={{ display:"block", color:"#64748B", fontSize:12, marginBottom:6, fontWeight:600 }}>كلمة المرور</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E2E8F0", background:"#F8FAFC", color:"#1E293B", fontSize:13, direction:"ltr", transition:"all 0.2s", boxSizing:"border-box" }} />
            </div>
            <button type="submit" disabled={loginMutation.isPending}
              style={{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:loginMutation.isPending?"#94A3B8":"linear-gradient(135deg,#2563EB,#1D4ED8)", color:"#fff", fontSize:15, fontWeight:700, cursor:loginMutation.isPending?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:loginMutation.isPending?"none":"0 4px 14px rgba(37,99,235,0.35)", transition:"all 0.2s" }}>
              {loginMutation.isPending ? (
                <><div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> جاري الدخول...</>
              ) : "دخول →"}
            </button>
          </form>
        </div>

        {/* Demo users */}
        <div style={{ marginTop:16 }}>
          <p style={{ color:"#94A3B8", fontSize:11, textAlign:"center", marginBottom:10, fontWeight:600 }}>حسابات تجريبية — اضغط للدخول السريع</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {demoUsers.map((u,i) => (
              <button key={i} onClick={() => { setEmail(u.email); setPassword(u.pwd); }} type="button"
                style={{ padding:"9px 12px", borderRadius:12, border:`1.5px solid ${u.color}30`, background:"#fff", color:"#1E293B", cursor:"pointer", textAlign:"right", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize:11, fontWeight:700, color:u.color, margin:"0 0 2px" }}>{u.label}</p>
                <p style={{ fontSize:10, color:"#94A3B8", margin:0, direction:"ltr", textAlign:"left" }}>{u.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

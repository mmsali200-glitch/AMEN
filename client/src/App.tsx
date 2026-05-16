import { useState, useEffect } from "react";
import { trpc } from "./lib/trpc";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";

// ── Portal selector lives here, outside Dashboard ──────────────────────────
function PortalSelector({ user, onLogout }:{ user:any; onLogout:()=>void }) {
  const [mode, setMode] = useState<string|null>(null);

  // Show landing on first load
  if (!mode) {
    const cards = [
      { id:"admin",    icon:"📊", title:"لوحة المالية",  desc:"التقارير والقوائم المالية",  color:"#2563EB", bg:"#EFF6FF" },
      { id:"helpdesk", icon:"🎫", title:"الدعم الفني",   desc:"التذاكر والعملاء والـ SLA",   color:"#714B67", bg:"#F5EEF3" },
      { id:"executive",icon:"🎯", title:"لوحة تنفيذية", desc:"ملخص سريع للأداء",           color:"#059669", bg:"#ECFDF5" },
    ];
    return (
      <div style={{ minHeight:"100vh", background:"#F8F9FA", fontFamily:"Cairo,system-ui,sans-serif", direction:"rtl" }}>
        <div style={{ background:"#2563EB", padding:"24px 20px 36px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#fff" }}>CF</div>
            <span style={{ fontWeight:700,fontSize:17,color:"#fff" }}>CFO Intelligence</span>
          </div>
          <p style={{ fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>مرحباً 👋</p>
          <p style={{ fontSize:14,color:"rgba(255,255,255,0.85)",margin:0 }}>{user?.name||"المستخدم"} — اختر الواجهة</p>
        </div>
        <div style={{ padding:"20px 16px", display:"flex", flexDirection:"column", gap:12, marginTop:-12 }}>
          {cards.map(p=>(
            <button key={p.id} onClick={()=>setMode(p.id)}
              style={{ background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:"18px 20px",display:"flex",alignItems:"center",gap:16,cursor:"pointer",textAlign:"right",width:"100%",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",fontFamily:"Cairo,sans-serif" }}>
              <div style={{ width:54,height:54,borderRadius:14,background:p.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0 }}>{p.icon}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:16,fontWeight:800,color:"#1E293B",margin:"0 0 3px" }}>{p.title}</p>
                <p style={{ fontSize:13,color:"#64748B",margin:0 }}>{p.desc}</p>
              </div>
              <span style={{ color:"#CBD5E1",fontSize:20 }}>‹</span>
            </button>
          ))}
          <button onClick={onLogout} style={{ background:"transparent",border:"1px solid #E2E8F0",borderRadius:12,padding:"12px",color:"#94A3B8",fontSize:13,cursor:"pointer",fontFamily:"Cairo,sans-serif",marginTop:8 }}>
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // Route to correct dashboard
  return (
    <Dashboard
      user={user}
      onLogout={onLogout}
      initialMode={mode}
      onSwitchMode={()=>setMode(null)}
    />
  );
}

export default function App() {
  const [token, setToken] = useState<string|null>(()=>localStorage.getItem("cfo_token"));
  const { data:me, isLoading, error } = trpc.auth.me.useQuery(undefined, { enabled:!!token, retry:false });

  useEffect(()=>{ if(error){ localStorage.removeItem("cfo_token"); setToken(null); } },[error]);

  const handleLogin  = (t:string) => { localStorage.setItem("cfo_token",t); setToken(t); };
  const handleLogout = () => { localStorage.removeItem("cfo_token"); setToken(null); };

  if (!token) return <LoginPage onLogin={handleLogin}/>;
  if (isLoading) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F0F4FA",direction:"rtl" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:44,height:44,border:"3px solid #DBEAFE",borderTopColor:"#2563EB",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
        <p style={{ color:"#64748B",fontSize:14 }}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  if (!me) return <LoginPage onLogin={handleLogin}/>;

  return <PortalSelector user={me} onLogout={handleLogout}/>;
}

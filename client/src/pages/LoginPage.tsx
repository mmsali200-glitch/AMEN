import { useState } from "react";
import { trpc } from "../lib/trpc";

const T = { primary: "#2563EB", teal: "#0D9488", text: "#1E293B", muted: "#94A3B8", border: "#E2E8F0", bg: "#F0F4FA", red: "#DC2626" };

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
    { label: "المدير المالي (CFO)", email: "admin@cfo.local", pwd: "Admin@2024", color: T.primary },
    { label: "مدير", email: "ahmed@cfo.local", pwd: "Ahmed@123", color: T.teal },
    { label: "محاسب", email: "fatima@cfo.local", pwd: "Fatima@123", color: "#7C3AED" },
    { label: "مدقق", email: "mkandari@cfo.local", pwd: "Mohammed@123", color: "#D97706" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, direction: "rtl" }}>
      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} } input:focus{outline:none;border-color:#2563EB!important;box-shadow:0 0 0 3px rgba(37,99,235,0.15)}`}</style>

      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ position: "absolute", borderRadius: "50%", background: `rgba(37,99,235,${0.03 + i * 0.01})`, width: 200 + i * 100, height: 200 + i * 100, top: `${10 + i * 15}%`, left: `${5 + i * 15}%`, animation: `float ${3 + i}s ease-in-out infinite` }} />
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 28, fontWeight: 800, color: "#fff" }}>م</div>
          <h1 style={{ color: "#F8FAFC", fontSize: 24, fontWeight: 800, margin: 0 }}>المستشار المالي</h1>
          <p style={{ color: "#94A3B8", fontSize: 13, margin: "4px 0 0" }}>CFO Intelligence System v4</p>
        </div>

        {/* Login Card */}
        <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 16, padding: "28px 28px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700, margin: "0 0 20px", textAlign: "center" }}>تسجيل الدخول</h2>

          {error && (
            <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#FCA5A5", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", color: "#94A3B8", fontSize: 12, marginBottom: 6, fontWeight: 500 }}>البريد الإلكتروني</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@cfo.local"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#F8FAFC", fontSize: 14, direction: "ltr", textAlign: "left", transition: "border-color 0.2s" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", color: "#94A3B8", fontSize: 12, marginBottom: 6, fontWeight: 500 }}>كلمة المرور</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#F8FAFC", fontSize: 14, direction: "ltr", transition: "border-color 0.2s" }} />
            </div>
            <button type="submit" disabled={loginMutation.isPending}
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: loginMutation.isPending ? "#475569" : T.primary, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loginMutation.isPending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
              {loginMutation.isPending ? (
                <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> جاري الدخول...</>
              ) : "دخول ←"}
            </button>
          </form>
        </div>

        {/* Demo users */}
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "#64748B", fontSize: 11, textAlign: "center", marginBottom: 10, fontWeight: 600, letterSpacing: "0.05em" }}>حسابات تجريبية — اضغط للدخول السريع</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {demoUsers.map((u, i) => (
              <button key={i} onClick={() => { setEmail(u.email); setPassword(u.pwd); }} type="button"
                style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${u.color}40`, background: `${u.color}15`, color: "#E2E8F0", cursor: "pointer", textAlign: "right", transition: "background 0.15s" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: u.color, margin: "0 0 2px" }}>{u.label}</p>
                <p style={{ fontSize: 10, color: "#64748B", margin: 0, direction: "ltr", textAlign: "left" }}>{u.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

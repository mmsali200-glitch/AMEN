import { useState, useEffect } from "react";
import { trpc } from "./lib/trpc";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("cfo_token"));

  const { data: me, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (error) {
      localStorage.removeItem("cfo_token");
      setToken(null);
    }
  }, [error]);

  const handleLogin = (newToken: string) => {
    localStorage.setItem("cfo_token", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("cfo_token");
    setToken(null);
  };

  if (!token) return <LoginPage onLogin={handleLogin} />;
  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F0F4FA", direction: "rtl" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, border: "3px solid #DBEAFE", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#64748B", fontSize: 14 }}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  if (!me) return <LoginPage onLogin={handleLogin} />;

  return <Dashboard user={me} onLogout={handleLogout} />;
}

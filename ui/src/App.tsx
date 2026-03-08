import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { apiFetch } from "./api";

type Page = "dashboard" | "settings";

interface Status {
  uptime: number;
  version: string;
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [status, setStatus] = useState<Status | null>(null);
  const [authState, setAuthState] = useState<{ required: boolean; setup: boolean } | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth-required")
      .then((r) => r.json())
      .then((data: { required: boolean; setup: boolean }) => {
        setAuthState(data);
        if (!data.required && !data.setup) {
          setAuthenticated(true);
        } else if (data.required) {
          setAuthenticated(!!localStorage.getItem("token"));
        }
      });
  }, []);

  useEffect(() => {
    if (authenticated) {
      apiFetch("/api/status").then((r) => r.json()).then(setStatus);
    }
  }, [authenticated]);

  if (authState === null) {
    return <div className="min-h-screen bg-[#0f1923]" />;
  }

  if (authState.setup || (authState.required && !authenticated)) {
    return <Login isSetup={authState.setup} onLogin={() => { setAuthState({ required: true, setup: false }); setAuthenticated(true); }} />;
  }

  return (
    <div className="min-h-screen bg-[#0f1923] text-gray-100">
      <nav className="bg-[#1a2332] border-b border-[#2a3a4a] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-header.png" alt="github-bro" className="h-20 -mt-5 -mb-7 rounded block" />
          {status && (
            <span className="text-xs bg-[#1a3a1a] text-[#7fff00] px-2 py-0.5 rounded-full border border-[#7fff00]/30">
              v{status.version}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setPage("dashboard")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              page === "dashboard"
                ? "bg-[#7fff00]/15 text-[#7fff00]"
                : "text-gray-400 hover:text-[#7fff00] hover:bg-[#7fff00]/10"
            }`}
          >
            Reviews
          </button>
          <button
            onClick={() => setPage("settings")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              page === "settings"
                ? "bg-[#7fff00]/15 text-[#7fff00]"
                : "text-gray-400 hover:text-[#7fff00] hover:bg-[#7fff00]/10"
            }`}
          >
            Settings
          </button>
          {authState.required && (
            <button
              onClick={() => {
                localStorage.removeItem("token");
                setAuthenticated(false);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-[#7fff00] hover:bg-[#7fff00]/10 transition"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {page === "dashboard" ? <Dashboard /> : <Settings />}
      </main>
    </div>
  );
}

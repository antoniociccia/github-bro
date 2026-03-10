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
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("theme") as "dark" | "light") || "dark");
  const [workerOk, setWorkerOk] = useState<boolean | null>(null);
  const [newReviewCount, setNewReviewCount] = useState(0);
  const [lastSeenId, setLastSeenId] = useState(() => parseInt(localStorage.getItem("lastSeenReviewId") || "0"));

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

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

  useEffect(() => {
    if (!authenticated) return;
    const check = () => apiFetch("/api/worker-health").then((r) => r.json()).then((d) => setWorkerOk(d.ok)).catch(() => setWorkerOk(false));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    const check = () =>
      apiFetch("/api/reviews?limit=1")
        .then((r) => r.json())
        .then((d) => {
          if (d.reviews?.length > 0) {
            const latestId = d.reviews[0].id;
            setNewReviewCount(latestId > lastSeenId ? latestId - lastSeenId : 0);
          }
        })
        .catch(() => {});
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [authenticated, lastSeenId]);

  useEffect(() => {
    document.title = newReviewCount > 0 ? `(${newReviewCount}) github-bro` : "github-bro";
  }, [newReviewCount]);

  const markReviewsSeen = () => {
    apiFetch("/api/reviews?limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.reviews?.length > 0) {
          const latestId = d.reviews[0].id;
          setLastSeenId(latestId);
          localStorage.setItem("lastSeenReviewId", String(latestId));
          setNewReviewCount(0);
        }
      })
      .catch(() => {});
  };

  if (authState === null) {
    return <div className="min-h-screen bg-[var(--bg-page)]" />;
  }

  if (authState.setup || (authState.required && !authenticated)) {
    return <Login isSetup={authState.setup} onLogin={() => { setAuthState({ required: true, setup: false }); setAuthenticated(true); }} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
      <nav className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-header.png" alt="github-bro" className="h-20 -mt-5 -mb-7 rounded block" />
          {status && (
            <span className="text-xs bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-0.5 rounded-full border border-[var(--accent-border)]">
              v{status.version}
            </span>
          )}
          {workerOk !== null && (
            <span
              className={`w-2.5 h-2.5 rounded-full ${workerOk ? "bg-green-500" : "bg-red-500"}`}
              title={workerOk ? "Worker online" : "Worker offline"}
            />
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => { setPage("dashboard"); markReviewsSeen(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition relative ${
              page === "dashboard"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            Reviews
            {newReviewCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {newReviewCount > 9 ? "9+" : newReviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setPage("settings")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              page === "settings"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="px-3 py-2 rounded-lg text-sm transition text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          {authState.required && (
            <button
              onClick={() => {
                localStorage.removeItem("token");
                setAuthenticated(false);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {page === "dashboard" ? <Dashboard onMount={markReviewsSeen} /> : <Settings />}
      </main>
    </div>
  );
}

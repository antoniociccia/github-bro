import { useState } from "react";

export default function Login({ isSetup, onLogin }: { isSetup: boolean; onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isSetup && password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    const endpoint = isSetup ? "/api/setup" : "/api/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const { token } = await res.json();
      localStorage.setItem("token", token);
      onLogin();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center">
      <img src="/logo.png" alt="github-bro" className="h-56 -my-10 rounded-lg mb-0" />
      <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-8 w-full max-w-sm">
        <p className="text-sm text-[var(--text-dim)] mb-6">
          {isSetup ? "Create an account to secure your instance." : "Log in to continue."}
        </p>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]/50 transition mb-4"
          autoFocus
        />
        <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]/50 transition mb-4"
        />
        {isSetup && (
          <>
            <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]/50 transition mb-4"
            />
          </>
        )}
        {error && <p className="text-[var(--toast-error-text)] text-sm mb-4">{error}</p>}
        <button
          type="submit"
          className="w-full bg-[var(--accent)] text-[var(--bg-page)] px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[var(--accent-hover)] transition"
        >
          {isSetup ? "Create Account" : "Log in"}
        </button>
      </form>
    </div>
  );
}

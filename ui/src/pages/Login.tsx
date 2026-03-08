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
    <div className="min-h-screen bg-[#0f1923] flex flex-col items-center justify-center">
      <img src="/logo.png" alt="github-bro" className="h-56 -my-10 rounded-lg mb-0" />
      <form onSubmit={handleSubmit} className="bg-[#1a2332] border border-[#2a3a4a] rounded-xl p-8 w-full max-w-sm">
        <p className="text-sm text-gray-500 mb-6">
          {isSetup ? "Create an account to secure your instance." : "Log in to continue."}
        </p>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-[#0f1923] border border-[#2a3a4a] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#7fff00]/50 transition mb-4"
          autoFocus
        />
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0f1923] border border-[#2a3a4a] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#7fff00]/50 transition mb-4"
        />
        {isSetup && (
          <>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-[#0f1923] border border-[#2a3a4a] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#7fff00]/50 transition mb-4"
            />
          </>
        )}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          className="w-full bg-[#7fff00] text-[#0f1923] px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#6edf00] transition"
        >
          {isSetup ? "Create Account" : "Log in"}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { apiFetch } from "../api";

type Provider = "cloud" | "local";

interface Config {
  poll_repos: string;
  poll_interval: string;
  openrouter_model: string;
  llm_base_url: string;
  openrouter_api_key: string;
  llm_provider: Provider;
  post_to_github: string;
}

export default function Settings() {
  const [config, setConfig] = useState<Config>({
    poll_repos: "antoniociccia/github-bro",
    poll_interval: "300",
    openrouter_model: "local",
    llm_base_url: "http://worker:8000/v1",
    openrouter_api_key: "",
    llm_provider: "local",
    post_to_github: "true",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      });
  }, []);

  const setProvider = (provider: Provider) => {
    if (provider === "cloud") {
      setConfig({
        ...config,
        llm_provider: "cloud",
        llm_base_url: "https://openrouter.ai/api/v1",
        openrouter_model: "qwen/qwen3.5-35b-a3b",
      });
    } else {
      setConfig({
        ...config,
        llm_provider: "local",
        llm_base_url: "http://worker:8000/v1",
        openrouter_model: "local",
        openrouter_api_key: "",
      });
    }
  };

  const handleSave = async () => {
    await apiFetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-12">Loading...</div>;
  }

  const isCloud = config.llm_provider === "cloud";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-8">
        <Section title="LLM Provider">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setProvider("cloud")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isCloud
                  ? "bg-[#7fff00] text-[#0f1923] font-bold"
                  : "bg-[#1a2332] text-gray-400 hover:text-[#7fff00]"
              }`}
            >
              Cloud
            </button>
            <button
              onClick={() => setProvider("local")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                !isCloud
                  ? "bg-[#7fff00] text-[#0f1923] font-bold"
                  : "bg-[#1a2332] text-gray-400 hover:text-[#7fff00]"
              }`}
            >
              Local
            </button>
          </div>

          {isCloud && (
            <>
              <Field
                label="API Key"
                value={config.openrouter_api_key}
                onChange={(v) => setConfig({ ...config, openrouter_api_key: v })}
                placeholder="sk-or-v1-..."
                type="password"
              />
              <Field
                label="Model"
                value={config.openrouter_model}
                onChange={(v) => setConfig({ ...config, openrouter_model: v })}
                placeholder="qwen/qwen3.5-35b-a3b"
              />
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="rounded bg-gray-800 border-gray-700"
            />
            Show Base URL
          </label>

          {showAdvanced && (
            <Field
              label="Base URL"
              value={config.llm_base_url}
              onChange={(v) => setConfig({ ...config, llm_base_url: v })}
              placeholder={isCloud ? "https://openrouter.ai/api/v1" : "http://worker:8000/v1"}
            />
          )}
        </Section>

        <Section title="GitHub">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-300">Post reviews to GitHub</span>
              <p className="text-xs text-gray-600 mt-0.5">
                When off, reviews are stored locally only (visible in the dashboard)
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.post_to_github !== "false"}
              onChange={(e) => setConfig({ ...config, post_to_github: e.target.checked ? "true" : "false" })}
              className="rounded bg-gray-800 border-gray-700"
            />
          </label>
          <Field
            label="Repositories to poll"
            value={config.poll_repos}
            onChange={(v) => setConfig({ ...config, poll_repos: v })}
            placeholder="antoniociccia/github-bro"
            hint="Comma-separated. Leave empty to disable polling."
          />
          <Field
            label="Poll interval (seconds)"
            value={config.poll_interval}
            onChange={(v) => setConfig({ ...config, poll_interval: v })}
            placeholder="300"
            type="number"
          />
        </Section>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="bg-[#7fff00] text-[#0f1923] px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#6edf00] transition"
          >
            Save
          </button>
          {saved && (
            <span className="text-green-400 text-sm">Settings saved!</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="space-y-4 bg-[#1a2332] border border-[#2a3a4a] rounded-xl p-5">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0f1923] border border-[#2a3a4a] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#7fff00]/50 transition"
      />
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

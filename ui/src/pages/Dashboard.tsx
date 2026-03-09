import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch } from "../api";
import Mermaid from "../Mermaid";

interface Review {
  id: number;
  owner: string;
  repo: string;
  pull_number: number;
  head_sha: string;
  status: string;
  review_body: string | null;
  verdict: string | null;
  created_at: string;
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  pages: number;
  projects: string[];
}

const PAGE_SIZE = 20;
const TOAST_DURATION = 3000;

export default function Dashboard({ onMount }: { onMount?: () => void }) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [project, setProject] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const confirmDelete = (id: number) => setPendingDelete(id);

  const handleDelete = async () => {
    if (pendingDelete === null) return;
    const res = await apiFetch(`/api/reviews/${pendingDelete}`, { method: "DELETE" });
    setPendingDelete(null);
    if (res.ok) {
      showToast("Review deleted");
      setRefreshKey((k) => k + 1);
    } else {
      showToast("Failed to delete review", "error");
    }
  };

  useEffect(() => {
    onMount?.();
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (project) params.set("project", project);

    apiFetch(`/api/reviews?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [page, project, refreshKey]);

  if (loading && !data) {
    return <div className="text-[var(--text-faint)] text-center py-12">Loading...</div>;
  }

  if (!data || (data.total === 0 && !project)) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">0</div>
        <div className="text-[var(--text-faint)] text-lg">No reviews yet</div>
        <p className="text-[var(--text-dim)] mt-2 text-sm">
          Configure a webhook or enable polling to start reviewing PRs
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <div className="flex items-center gap-3">
          {data.projects.length > 1 && (
            <select
              value={project}
              onChange={(e) => { setProject(e.target.value); setPage(1); }}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
            >
              <option value="">All projects</option>
              {data.projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <span className="text-sm text-[var(--text-faint)]">{data.total} total</span>
        </div>
      </div>

      <div className="space-y-3">
        {data.reviews.map((r) => (
          <div
            key={r.id}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden"
          >
            <div className="w-full px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VerdictBadge verdict={r.verdict} />
                <div>
                  <a
                    href={`https://github.com/${r.owner}/${r.repo}/pull/${r.pull_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-[var(--accent)] transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.owner}/{r.repo}
                  </a>
                  <span className="text-[var(--text-faint)] mx-2">#</span>
                  <span className="font-mono">{r.pull_number}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-[var(--text-faint)]">
                  {r.head_sha.slice(0, 7)}
                </span>
                <span className="text-xs text-[var(--text-dim)]">
                  {new Date(r.created_at + "Z").toLocaleString()}
                </span>
                <button
                  onClick={() => {
                    const text = r.review_body || "No review body";
                    const filename = `review-${r.owner}-${r.repo}-${r.pull_number}-${r.head_sha.slice(0, 7)}.md`;
                    const blob = new Blob([text], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[var(--text-faint)] text-sm hover:text-[var(--accent)] transition px-1"
                  title="Download as markdown"
                >
                  ↓
                </button>
                <button
                  onClick={() => confirmDelete(r.id)}
                  className="text-[var(--text-faint)] text-sm hover:text-red-400 transition px-1"
                  title="Delete review"
                >
                  ✕
                </button>
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="text-[var(--text-faint)] text-sm hover:text-[var(--accent)] transition px-2"
                >
                  {expanded === r.id ? "−" : "+"}
                </button>
              </div>
            </div>
            {expanded === r.id && r.review_body && (
              <div className="px-5 pb-5 border-t border-[var(--border-color)]">
                <div className="mt-4 prose prose-sm max-w-none">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children }) {
                        if (className === "language-mermaid") {
                          return <Mermaid chart={String(children).trim()} />;
                        }
                        return <code className={className}>{children}</code>;
                      },
                    }}
                  >{r.review_body}</Markdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent-border)] transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-sm text-[var(--text-faint)] px-2">
            {page} / {data.pages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= data.pages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent-border)] transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {pendingDelete !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Delete review?</h3>
            <p className="text-sm text-[var(--text-dim)] mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg backdrop-blur-sm transition-all animate-slide-up ${
          toast.type === "success"
            ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]"
            : "bg-[var(--toast-error-bg)] text-[var(--toast-error-text)] border border-[var(--toast-error-border)]"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (verdict === "APPROVE") {
    return (
      <span className="text-xs font-medium bg-[var(--badge-approve-bg)] text-[var(--badge-approve-text)] px-2.5 py-1 rounded-full">
        Approved
      </span>
    );
  }
  if (verdict === "REQUEST_CHANGES") {
    return (
      <span className="text-xs font-medium bg-[var(--badge-changes-bg)] text-[var(--badge-changes-text)] px-2.5 py-1 rounded-full">
        Changes
      </span>
    );
  }
  return (
    <span className="text-xs font-medium bg-[var(--badge-comment-bg)] text-[var(--badge-comment-text)] px-2.5 py-1 rounded-full">
      Comment
    </span>
  );
}

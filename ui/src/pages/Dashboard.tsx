import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch } from "../api";

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

export default function Dashboard() {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [project, setProject] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/reviews/${id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  };

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
    return <div className="text-gray-500 text-center py-12">Loading...</div>;
  }

  if (!data || (data.total === 0 && !project)) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">0</div>
        <div className="text-gray-500 text-lg">No reviews yet</div>
        <p className="text-gray-600 mt-2 text-sm">
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
              className="bg-[#1a2332] border border-[#2a3a4a] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-[#7fff00]/50"
            >
              <option value="">All projects</option>
              {data.projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <span className="text-sm text-gray-500">{data.total} total</span>
        </div>
      </div>

      <div className="space-y-3">
        {data.reviews.map((r) => (
          <div
            key={r.id}
            className="bg-[#1a2332] border border-[#2a3a4a] rounded-xl overflow-hidden"
          >
            <div className="w-full px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VerdictBadge verdict={r.verdict} />
                <div>
                  <a
                    href={`https://github.com/${r.owner}/${r.repo}/pull/${r.pull_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-[#7fff00] transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.owner}/{r.repo}
                  </a>
                  <span className="text-gray-500 mx-2">#</span>
                  <span className="font-mono">{r.pull_number}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-gray-600">
                  {r.head_sha.slice(0, 7)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(r.created_at + "Z").toLocaleString()}
                </span>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-gray-700 text-sm hover:text-red-400 transition px-1"
                  title="Delete review"
                >
                  ✕
                </button>
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="text-gray-600 text-sm hover:text-[#7fff00] transition px-2"
                >
                  {expanded === r.id ? "−" : "+"}
                </button>
              </div>
            </div>
            {expanded === r.id && r.review_body && (
              <div className="px-5 pb-5 border-t border-gray-800">
                <div className="mt-4 prose prose-invert prose-sm max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>{r.review_body}</Markdown>
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
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a2332] border border-[#2a3a4a] text-gray-400 hover:text-[#7fff00] hover:border-[#7fff00]/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500 px-2">
            {page} / {data.pages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= data.pages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a2332] border border-[#2a3a4a] text-gray-400 hover:text-[#7fff00] hover:border-[#7fff00]/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (verdict === "APPROVE") {
    return (
      <span className="text-xs font-medium bg-green-900/50 text-green-400 px-2.5 py-1 rounded-full">
        Approved
      </span>
    );
  }
  if (verdict === "REQUEST_CHANGES") {
    return (
      <span className="text-xs font-medium bg-red-900/50 text-red-400 px-2.5 py-1 rounded-full">
        Changes
      </span>
    );
  }
  return (
    <span className="text-xs font-medium bg-blue-900/50 text-blue-400 px-2.5 py-1 rounded-full">
      Comment
    </span>
  );
}

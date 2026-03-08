import { listOpenPRs, getPRDiff, postReview } from "./github.js";
import { reviewDiff } from "./reviewer.js";
import { alreadyReviewed, markReviewed, getConfig } from "./db.js";

function getRepos(): Array<{ owner: string; repo: string }> {
  const config = getConfig();
  const raw = config.poll_repos || process.env.POLL_REPOS || "antoniociccia/github-bro";
  if (!raw) return [];
  return raw.split(",").map((r) => {
    const [owner, repo] = r.trim().split("/");
    return { owner, repo };
  });
}

function getIntervalMs(): number {
  const config = getConfig();
  return parseInt(config.poll_interval || process.env.POLL_INTERVAL || "300") * 1000;
}

async function pollRepo(owner: string, repo: string): Promise<void> {
  const prs = await listOpenPRs(owner, repo);

  for (const pr of prs) {
    if (alreadyReviewed(owner, repo, pr.number, pr.headSha)) continue;

    console.log(`[poll] Reviewing PR #${pr.number} on ${owner}/${repo}`);

    try {
      const diff = await getPRDiff(owner, repo, pr.number);
      const { body, verdict } = await reviewDiff(diff, pr.title, pr.body);
      const config = getConfig();
      const postToGithub = (config.post_to_github || "true") !== "false";
      if (postToGithub) {
        await postReview(owner, repo, pr.number, body, verdict);
        console.log(`[poll] Review posted on PR #${pr.number} [${verdict}]`);
      } else {
        console.log(`[poll] Review stored locally for PR #${pr.number} [${verdict}] (GitHub posting disabled)`);
      }
      markReviewed(owner, repo, pr.number, pr.headSha, body, verdict);
    } catch (err) {
      console.error(`[poll] Error reviewing PR #${pr.number}:`, (err as Error).message);
    }
  }
}

async function poll(): Promise<void> {
  const repos = getRepos();
  if (repos.length === 0) return;

  for (const { owner, repo } of repos) {
    try {
      await pollRepo(owner, repo);
    } catch (err) {
      console.error(`[poll] Error polling ${owner}/${repo}:`, (err as Error).message);
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startPoller(): void {
  const repos = getRepos();
  const intervalMs = getIntervalMs();

  if (repos.length === 0) {
    console.log("[poll] No POLL_REPOS configured, polling disabled (will re-check every 60s)");
  } else {
    console.log(`[poll] Watching ${repos.map((r) => `${r.owner}/${r.repo}`).join(", ")} every ${intervalMs / 1000}s`);
    poll();
  }

  // Re-read config each tick so UI changes take effect
  intervalId = setInterval(() => {
    const currentRepos = getRepos();
    if (currentRepos.length > 0) poll();
  }, repos.length > 0 ? intervalMs : 60000);
}

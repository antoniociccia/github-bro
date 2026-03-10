import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const ALLOWED_EVENTS = ["COMMENT", "REQUEST_CHANGES"] as const;
type ReviewEvent = (typeof ALLOWED_EVENTS)[number];

export async function getPRDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: "diff" },
  });
  return data as unknown as string;
}

export interface PRInfo {
  number: number;
  title: string;
  body: string | null;
  headSha: string;
}

export async function listOpenPRs(owner: string, repo: string): Promise<PRInfo[]> {
  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: 30,
  });

  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    body: pr.body,
    headSha: pr.head.sha,
  }));
}

export async function getPRBranchGraph(owner: string, repo: string, pullNumber: number): Promise<string> {
  try {
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
    const { data: commits } = await octokit.rest.pulls.listCommits({ owner, repo, pull_number: pullNumber, per_page: 50 });
    const { data: comparison } = await octokit.rest.repos.compareCommits({
      owner, repo,
      base: pr.base.sha,
      head: pr.base.ref,
    });

    const baseBranch = pr.base.ref;
    const headBranch = pr.head.ref;
    const mergeBase = pr.base.sha.slice(0, 7);

    const baseCommits = comparison.commits.slice(-3);

    let graph = "```mermaid\ngitGraph\n";
    graph += `  commit id: "..."\n`;

    for (const c of baseCommits) {
      const msg = (c.commit.message.split("\n")[0]).slice(0, 35).replace(/"/g, "'");
      graph += `  commit id: "${c.sha.slice(0, 7)} ${msg}"\n`;
    }

    graph += `  branch ${headBranch}\n`;

    for (const c of commits) {
      const msg = (c.commit.message.split("\n")[0]).slice(0, 35).replace(/"/g, "'");
      graph += `  commit id: "${c.sha.slice(0, 7)} ${msg}"\n`;
    }

    graph += "```\n";
    graph += `**Branch:** \`${headBranch}\` → \`${baseBranch}\` | **Commits:** ${commits.length} | **Merge base:** \`${mergeBase}\``;

    return graph;
  } catch (err) {
    console.error(`[github] Failed to generate branch graph for PR #${pullNumber}:`, (err as Error).message);
    return "";
  }
}

export async function postReview(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  event: string = "COMMENT",
): Promise<void> {
  const safeEvent: ReviewEvent = ALLOWED_EVENTS.includes(event as ReviewEvent)
    ? (event as ReviewEvent)
    : "COMMENT";

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event: safeEvent,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 422) {
      console.log(`[github] Review failed (422), falling back to PR comment on #${pullNumber}`);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
    } else {
      throw err;
    }
  }
}

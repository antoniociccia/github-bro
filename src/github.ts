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

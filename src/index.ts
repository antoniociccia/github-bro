import "dotenv/config";
import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getPRDiff, postReview, getPRBranchGraph } from "./github.js";
import { reviewDiff } from "./reviewer.js";
import { alreadyReviewed, markReviewed, getConfig } from "./db.js";
import { startPoller } from "./poller.js";
import apiRouter from "./api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.json());
app.use("/api", apiRouter);

const uiPath = join(__dirname, "ui");
console.log(`Serving UI from: ${uiPath}`);
app.use(express.static(uiPath));

function verifySignature(req: Request): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(req.body));
  const expected = `sha256=${hmac.digest("hex")}`;

  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post("/webhook", async (req: Request, res: Response) => {
  if (!verifySignature(req)) {
    console.error("Invalid webhook signature");
    res.status(401).send("Invalid signature");
    return;
  }

  const event = req.headers["x-github-event"];
  if (event !== "pull_request") {
    res.status(200).send("Ignored");
    return;
  }

  const { action, pull_request, repository } = req.body;
  if (!["opened", "synchronize"].includes(action)) {
    res.status(200).send("Ignored");
    return;
  }

  const owner: string = repository.owner.login;
  const repo: string = repository.name;
  const pullNumber: number = pull_request.number;
  const headSha: string = pull_request.head.sha;

  if (alreadyReviewed(owner, repo, pullNumber, headSha)) {
    console.log(`PR #${pullNumber} (${headSha.slice(0, 7)}) already reviewed, skipping`);
    res.status(200).send("Already reviewed");
    return;
  }

  console.log(`Reviewing PR #${pullNumber} on ${owner}/${repo} (${action})`);

  try {
    const diff = await getPRDiff(owner, repo, pullNumber);
    const { body, verdict } = await reviewDiff(diff, pull_request.title, pull_request.body);
    const graph = await getPRBranchGraph(owner, repo, pullNumber);
    const fullBody = graph ? `${graph}\n\n---\n\n${body}` : body;
    const config = getConfig();
    const postToGithub = (config.post_to_github || "true") !== "false";
    if (postToGithub) {
      await postReview(owner, repo, pullNumber, body, verdict);
    }
    markReviewed(owner, repo, pullNumber, headSha, fullBody, verdict);
    console.log(`Review ${postToGithub ? "posted" : "stored locally"} on PR #${pullNumber} [${verdict}]`);
    res.status(200).send(postToGithub ? "Review posted" : "Review stored");
  } catch (err) {
    console.error(`Error reviewing PR #${pullNumber}:`, (err as Error).message);
    res.status(500).send("Error");
  }
});

app.get("/health", (_req: Request, res: Response) => res.send("OK"));

// SPA fallback
app.use((_req: Request, res: Response) => {
  res.sendFile(join(uiPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`github-bro listening on port ${PORT}`);
  startPoller();
});

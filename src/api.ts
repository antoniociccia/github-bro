import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { getReviews, getReviewCount, getReviewProjects, getConfig, setConfigBulk, getUserCount, createUser, getUserByEmail, deleteReview } from "./db.js";
import { requireAuth, isAuthEnabled, signToken } from "./auth.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public endpoints (no auth)
router.get("/auth-required", (_req: Request, res: Response) => {
  const userExists = getUserCount() > 0;
  res.json({ required: userExists, setup: !userExists });
});

router.post("/setup", async (req: Request, res: Response) => {
  if (getUserCount() > 0) {
    res.status(400).json({ error: "User already exists" });
    return;
  }

  const { email, password } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  createUser(email, hash);
  res.json({ token: signToken() });
});

router.post("/login", async (req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    res.json({ token: "no-auth" });
    return;
  }

  const { email, password } = req.body;
  const user = email ? getUserByEmail(email) : null;
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const match = await bcrypt.compare(password ?? "", user.password_hash);
  if (!match) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json({ token: signToken() });
});

// Protected endpoints (auth required from here)
router.use(requireAuth);

router.get("/reviews", (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const project = (req.query.project as string) || undefined;
  const offset = (page - 1) * limit;

  const reviews = getReviews({ limit, offset, project });
  const total = getReviewCount(project);
  const projects = getReviewProjects();

  res.json({ reviews, total, page, pages: Math.ceil(total / limit), projects });
});

router.delete("/reviews/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid review ID" });
    return;
  }
  deleteReview(id);
  res.json({ ok: true });
});

router.get("/config", (_req: Request, res: Response) => {
  const dbConfig = getConfig();
  res.json({
    poll_repos: dbConfig.poll_repos || process.env.POLL_REPOS || "antoniociccia/github-bro",
    poll_interval: dbConfig.poll_interval || process.env.POLL_INTERVAL || "300",
    openrouter_model: dbConfig.openrouter_model || process.env.OPENROUTER_MODEL || "local",
    llm_base_url: dbConfig.llm_base_url || process.env.LLM_BASE_URL || "http://worker:8000/v1",
    openrouter_api_key: dbConfig.openrouter_api_key ? "••••••" : (process.env.OPENROUTER_API_KEY ? "••••••" : ""),
    llm_provider: dbConfig.llm_provider || "local",
    post_to_github: dbConfig.post_to_github || "true",
  });
});

router.put("/config", (req: Request, res: Response) => {
  const allowed = ["poll_repos", "poll_interval", "openrouter_model", "llm_base_url", "openrouter_api_key", "llm_provider", "post_to_github"];
  const entries: Record<string, string> = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined && req.body[key] !== "••••••") {
      entries[key] = req.body[key];
    }
  }

  if (Object.keys(entries).length > 0) {
    setConfigBulk(entries);
  }

  res.json({ ok: true });
});

router.get("/status", (_req: Request, res: Response) => {
  res.json({
    uptime: process.uptime(),
    version: "1.0.0",
  });
});

export default router;

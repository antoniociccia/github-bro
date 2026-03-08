import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.GITHUBBRO_DB || join(__dirname, "..", "data", "githubbro.db");
const db = new Database(dbPath);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _db: any = db;

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    pull_number INTEGER NOT NULL,
    head_sha TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted',
    review_body TEXT,
    verdict TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(owner, repo, pull_number, head_sha)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migrate: add review_body and verdict columns if missing
try { db.exec("ALTER TABLE reviews ADD COLUMN review_body TEXT"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN verdict TEXT"); } catch {}

const insertStmt = db.prepare(
  "INSERT OR IGNORE INTO reviews (owner, repo, pull_number, head_sha, review_body, verdict) VALUES (?, ?, ?, ?, ?, ?)",
);

const findStmt = db.prepare(
  "SELECT id FROM reviews WHERE owner = ? AND repo = ? AND pull_number = ? AND head_sha = ?",
);

export function alreadyReviewed(owner: string, repo: string, pullNumber: number, headSha: string): boolean {
  return !!findStmt.get(owner, repo, pullNumber, headSha);
}

export function markReviewed(owner: string, repo: string, pullNumber: number, headSha: string, reviewBody?: string, verdict?: string): void {
  insertStmt.run(owner, repo, pullNumber, headSha, reviewBody ?? null, verdict ?? null);
}

export function deleteReview(id: number): void {
  db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
}

export function getReviews({ limit = 20, offset = 0, project }: { limit?: number; offset?: number; project?: string } = {}): unknown[] {
  if (project) {
    const [owner, repo] = project.split("/");
    return db.prepare("SELECT * FROM reviews WHERE owner = ? AND repo = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(owner, repo, limit, offset);
  }
  return db.prepare("SELECT * FROM reviews ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
}

export function getReviewCount(project?: string): number {
  if (project) {
    const [owner, repo] = project.split("/");
    return (db.prepare("SELECT COUNT(*) as count FROM reviews WHERE owner = ? AND repo = ?").get(owner, repo) as { count: number }).count;
  }
  return (db.prepare("SELECT COUNT(*) as count FROM reviews").get() as { count: number }).count;
}

export function getReviewProjects(): string[] {
  const rows = db.prepare("SELECT DISTINCT owner || '/' || repo as project FROM reviews ORDER BY project").all() as Array<{ project: string }>;
  return rows.map((r) => r.project);
}

export function getConfig(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM config").all() as Array<{ key: string; value: string }>;
  const config: Record<string, string> = {};
  for (const row of rows) config[row.key] = row.value;
  return config;
}

export function setConfig(key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
}

export function setConfigBulk(entries: Record<string, string>): void {
  const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
  const tx = db.transaction((items: Record<string, string>) => {
    for (const [k, v] of Object.entries(items)) stmt.run(k, v);
  });
  tx(entries);
}

export function getUserCount(): number {
  return (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
}

export function createUser(email: string, passwordHash: string): void {
  db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, passwordHash);
}

export function getUserByEmail(email: string): { email: string; password_hash: string } | null {
  return db.prepare("SELECT email, password_hash FROM users WHERE email = ?").get(email) as { email: string; password_hash: string } | undefined ?? null;
}

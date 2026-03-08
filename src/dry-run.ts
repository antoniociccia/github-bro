import "dotenv/config";
import { reviewDiff } from "./reviewer.js";

const FAKE_DIFF = `diff --git a/src/api/auth.ts b/src/api/auth.ts
index 1a2b3c4..5d6e7f8 100644
--- a/src/api/auth.ts
+++ b/src/api/auth.ts
@@ -1,8 +1,22 @@
 import jwt from "jsonwebtoken";
+import bcrypt from "bcrypt";
+import { db } from "../db.js";

-const SECRET = "supersecret123";
+const SECRET = process.env.JWT_SECRET;

-export function login(req, res) {
-  if (req.body.user === "admin" && req.body.pass === "admin") {
-    res.json({ token: jwt.sign({ user: "admin" }, SECRET) });
+export async function login(req, res) {
+  const { email, password } = req.body;
+  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
+  if (!user) return res.status(401).json({ error: "Invalid credentials" });
+
+  if (bcrypt.compareSync(password, user.password_hash)) {
+    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "7d" });
+    res.json({ token });
+  } else {
+    res.status(401).json({ error: "Invalid credentials" });
   }
 }
+
+export function verifyToken(token) {
+  return jwt.verify(token, SECRET);
+}
diff --git a/src/api/users.ts b/src/api/users.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/api/users.ts
@@ -0,0 +1,28 @@
+import { db } from "../db.js";
+
+export function getUsers(req, res) {
+  const role = req.query.role;
+  const users = db.prepare("SELECT * FROM users WHERE role = '" + role + "'").all();
+  res.json(users);
+}
+
+export function getUser(req, res) {
+  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
+  res.json(user);
+}
+
+export function deleteUser(req, res) {
+  db.prepare("DELETE FROM users WHERE id = " + req.params.id).run();
+  res.json({ success: true });
+}
+
+export function updateProfile(req, res) {
+  const { name, bio } = req.body;
+  db.prepare("UPDATE users SET name = ?, bio = ? WHERE id = ?").run(name, bio, req.user.id);
+  res.json({ success: true });
+}
+
+export function runMigration(req, res) {
+  eval(req.body.migration);
+  res.json({ ok: true });
+}
diff --git a/src/middleware/rateLimit.ts b/src/middleware/rateLimit.ts
new file mode 100644
index 0000000..b2c3d4e
--- /dev/null
+++ b/src/middleware/rateLimit.ts
@@ -0,0 +1,15 @@
+const attempts = {};
+
+export function rateLimit(req, res, next) {
+  const ip = req.headers["x-forwarded-for"] || req.ip;
+  if (!attempts[ip]) attempts[ip] = { count: 0, first: Date.now() };
+
+  attempts[ip].count++;
+
+  if (attempts[ip].count > 100) {
+    return res.status(429).json({ error: "Too many requests" });
+  }
+
+  next();
+}
`;

const PR_TITLE = "feat: add user auth with bcrypt + user management API";
const PR_BODY = "Replaced hardcoded admin credentials with proper bcrypt-based authentication. Added user CRUD endpoints and basic rate limiting middleware.";

console.log("github-bro dry-run\n");
console.log(`PR: ${PR_TITLE}`);
console.log(`Description: ${PR_BODY}`);
console.log("---\n");

const { body, verdict } = await reviewDiff(FAKE_DIFF, PR_TITLE, PR_BODY);
console.log(body);
console.log(`\n[Verdict: ${verdict}]`);

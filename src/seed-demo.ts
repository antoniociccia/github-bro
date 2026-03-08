import "dotenv/config";
import { markReviewed } from "./db.js";

const DEMO_REVIEW = `## github-bro Review

**Summary:** Found 2 security issues and 1 performance concern.

### 🔴 Critical
> **SQL Injection Vulnerability** (\`src/api/users.ts:5\`)
>
> The \`getUsers\` endpoint is vulnerable to SQL injection because it directly concatenates user input into the SQL query. An attacker could exploit this to read, modify, or delete data.
> \`\`\`suggestion
> const users = db.prepare("SELECT * FROM users WHERE role = ?").all(role);
> \`\`\`

### 🟡 Warning
> **Missing Authorization Check** (\`src/api/users.ts:15\`)
>
> The \`deleteUser\` endpoint does not verify that the requesting user has admin privileges. Any authenticated user could delete other users.
> \`\`\`suggestion
> if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
> \`\`\`

### 🟢 Suggestion
> **Rate Limiting Bypass** (\`src/middleware/rateLimit.ts:4\`)
>
> The rate limiter trusts \`x-forwarded-for\` which can be spoofed. Consider using a battle-tested library like \`express-rate-limit\` with proper proxy trust configuration.
> \`\`\`suggestion
> import rateLimit from 'express-rate-limit';
> const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
> export default limiter;
> \`\`\`

**Verdict:** REQUEST_CHANGES

---
*-- github-bro*`;

markReviewed("antoniociccia", "github-bro", 1, "demo000", DEMO_REVIEW, "REQUEST_CHANGES");
console.log("Demo review seeded.");

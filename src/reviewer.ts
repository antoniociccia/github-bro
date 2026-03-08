import OpenAI from "openai";
import { encoding_for_model } from "tiktoken";
import { getConfig } from "./db.js";
import { signToken } from "./auth.js";

const enc = encoding_for_model("gpt-4o"); // cl100k_base, close enough for Qwen

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

function getClient(): OpenAI {
  const config = getConfig();
  const baseURL = config.llm_base_url || process.env.LLM_BASE_URL || "http://worker:8000/v1";
  const isLocal = config.llm_provider === "local" || baseURL.includes("worker:");

  let apiKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY || "not-needed";
  if (isLocal && process.env.APP_SECRET) {
    apiKey = signToken(300);
  }

  return new OpenAI({ baseURL, apiKey, timeout: 10 * 60 * 1000 });
}

function getModel(): string {
  const config = getConfig();
  return config.openrouter_model || process.env.OPENROUTER_MODEL || "local";
}

const SYSTEM_PROMPT = `You are github-bro, a no-BS senior code reviewer.
Do NOT output any thinking, reasoning, or internal monologue. Output ONLY the final review.

You MUST follow this EXACT markdown format. Do not deviate.

## github-bro Review

**Summary:** <one-line summary of findings>

### 🔴 Critical
> **<title>** (\`<file>:<line>\`)
>
> <explanation of the issue>
> \`\`\`suggestion
> <code fix>
> \`\`\`

### 🟡 Warning
> **<title>** (\`<file>:<line>\`)
>
> <explanation>

### 🟢 Suggestion
> **<title>**
>
> <explanation>

**Verdict:** APPROVE | REQUEST_CHANGES | COMMENT

---
*-- github-bro*

Rules:
- ONLY output the review. No preamble, no "let me analyze", no thinking.
- Skip empty severity sections entirely (do NOT include a section if there are no findings for it).
- Use ONLY real file paths from the diff. Never invent file names or line numbers.
- Max 5 findings. Focus on what actually matters.
- If the code is fine, just write a short Summary, set Verdict to APPROVE, and skip all sections.
- Be direct. Be useful. No filler.`;

export interface ReviewResult {
  body: string;
  verdict: string;
}

const CONTEXT_WINDOW = parseInt(process.env.CONTEXT_SIZE || "8192", 10);
const RESERVED_OUTPUT_TOKENS = 4096;
const SYSTEM_TOKENS = countTokens(SYSTEM_PROMPT) + 200;

export function truncateDiff(diff: string, maxTokens: number): string {
  const tokens = countTokens(diff);
  if (tokens <= maxTokens) return diff;

  // Binary search for the right cut point
  let lo = 0, hi = diff.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (countTokens(diff.slice(0, mid)) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }

  return diff.slice(0, lo) + "\n\n[... diff truncated to fit context window ...]";
}

export async function reviewDiff(diff: string, prTitle: string, prBody: string | null): Promise<ReviewResult> {
  const client = getClient();
  const model = getModel();

  const userPrefix = `Review this PR.\n\nTitle: ${prTitle}\nDescription: ${prBody || "None"}\n\nDiff:\n`;
  const prefixTokens = countTokens(userPrefix);
  const maxDiffTokens = CONTEXT_WINDOW - RESERVED_OUTPUT_TOKENS - SYSTEM_TOKENS - prefixTokens;

  diff = truncateDiff(diff, maxDiffTokens);
  const totalTokens = countTokens(SYSTEM_PROMPT + userPrefix + diff);
  console.log(`[review] Sending ${totalTokens} tokens to LLM (limit: ${CONTEXT_WINDOW})`);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrefix + diff },
    ],
    max_tokens: RESERVED_OUTPUT_TOKENS,
  });

  let content = response.choices[0].message.content ?? "";
  content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const reviewStart = content.indexOf("## github-bro");
  if (reviewStart > 0) content = content.slice(reviewStart);

  const verdictMatch = content.match(/\*\*Verdict:\*\*\s*(REQUEST_CHANGES|COMMENT)/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : "COMMENT";

  return { body: content, verdict };
}

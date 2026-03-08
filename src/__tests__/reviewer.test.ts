import { describe, it, expect } from "vitest";
import { truncateDiff, countTokens } from "../reviewer.js";

describe("truncateDiff", () => {
  it("returns diff unchanged if within token limit", () => {
    const diff = "short diff";
    const tokens = countTokens(diff);
    expect(truncateDiff(diff, tokens + 10)).toBe(diff);
  });

  it("truncates diff exceeding token limit", () => {
    // Use diverse text to get predictable tokenization
    const diff = Array.from({ length: 200 }, (_, i) => `line ${i}: some code here\n`).join("");
    const totalTokens = countTokens(diff);
    const limit = Math.floor(totalTokens / 2);
    const result = truncateDiff(diff, limit);
    expect(result.length).toBeLessThan(diff.length);
    expect(result).toContain("[... diff truncated to fit context window ...]");
    // The truncated content (minus suffix) should be within the token limit
    const truncatedPart = result.split("\n\n[... diff truncated")[0];
    expect(countTokens(truncatedPart)).toBeLessThanOrEqual(limit);
  });

  it("handles exact token limit boundary", () => {
    const diff = "hello world this is a test string";
    const tokens = countTokens(diff);
    expect(truncateDiff(diff, tokens)).toBe(diff);
    expect(truncateDiff(diff, tokens - 1)).toContain("[... diff truncated");
  });

  it("handles empty diff", () => {
    expect(truncateDiff("", 100)).toBe("");
  });
});

describe("verdict extraction", () => {
  // This logic lives inside reviewDiff — test the regex pattern
  function extractVerdict(content: string): string {
    const match = content.match(/\*\*Verdict:\*\*\s*(REQUEST_CHANGES|COMMENT)/i);
    return match ? match[1].toUpperCase() : "COMMENT";
  }

  it("extracts REQUEST_CHANGES", () => {
    expect(extractVerdict("**Verdict:** REQUEST_CHANGES")).toBe("REQUEST_CHANGES");
  });

  it("extracts COMMENT", () => {
    expect(extractVerdict("**Verdict:** COMMENT")).toBe("COMMENT");
  });

  it("defaults to COMMENT when no verdict found", () => {
    expect(extractVerdict("no verdict here")).toBe("COMMENT");
  });

  it("handles case insensitivity", () => {
    expect(extractVerdict("**Verdict:** request_changes")).toBe("REQUEST_CHANGES");
  });

  it("extracts from full review body", () => {
    const body = `## GithubBro Review\n**Summary:** Found 1 issue\n**Verdict:** REQUEST_CHANGES\n---`;
    expect(extractVerdict(body)).toBe("REQUEST_CHANGES");
  });
});

describe("think tag removal", () => {
  function cleanThinkTags(content: string): string {
    return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  it("removes think tags", () => {
    expect(cleanThinkTags("<think>reasoning</think>## Review")).toBe("## Review");
  });

  it("removes multiline think tags", () => {
    expect(cleanThinkTags("<think>\nstep 1\nstep 2\n</think>\n## Review")).toBe("## Review");
  });

  it("handles content without think tags", () => {
    expect(cleanThinkTags("## Review\nclean")).toBe("## Review\nclean");
  });

  it("removes multiple think tags", () => {
    expect(cleanThinkTags("<think>a</think>mid<think>b</think>end")).toBe("midend");
  });
});

describe("review start extraction", () => {
  function extractReview(content: string): string {
    const start = content.indexOf("## GithubBro");
    if (start > 0) return content.slice(start);
    return content;
  }

  it("strips preamble before review", () => {
    expect(extractReview("preamble\n\n## GithubBro Review\ncontent")).toBe("## GithubBro Review\ncontent");
  });

  it("returns as-is when review starts at beginning", () => {
    expect(extractReview("## GithubBro Review")).toBe("## GithubBro Review");
  });

  it("returns as-is when no marker found", () => {
    expect(extractReview("random content")).toBe("random content");
  });
});

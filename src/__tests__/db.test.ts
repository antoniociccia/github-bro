import { describe, it, expect, beforeEach } from "vitest";
import {
  alreadyReviewed,
  markReviewed,
  getReviews,
  getReviewCount,
  getReviewProjects,
  getConfig,
  setConfig,
  setConfigBulk,
  getUserCount,
  createUser,
  getUserByEmail,
  resetForTests,
  rawQuery,
} from "../db.js";

describe("reviews", () => {
  beforeEach(resetForTests);

  it("marks and detects already-reviewed PRs", () => {
    expect(alreadyReviewed("org", "repo", 1, "abc123")).toBe(false);
    markReviewed("org", "repo", 1, "abc123", "looks good", "COMMENT");
    expect(alreadyReviewed("org", "repo", 1, "abc123")).toBe(true);
  });

  it("prevents duplicate reviews via UNIQUE constraint", () => {
    markReviewed("org", "repo", 1, "abc123", "first", "COMMENT");
    markReviewed("org", "repo", 1, "abc123", "second", "REQUEST_CHANGES");
    expect(getReviewCount()).toBe(1);
  });

  it("getReviews returns reviews ordered by created_at DESC with pagination", () => {
    rawQuery("INSERT INTO reviews (owner, repo, pull_number, head_sha, review_body, verdict, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "org", "repo", 1, "aaa", "r1", "COMMENT", "2026-01-01 00:00:00");
    rawQuery("INSERT INTO reviews (owner, repo, pull_number, head_sha, review_body, verdict, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "org", "repo", 2, "bbb", "r2", "COMMENT", "2026-01-02 00:00:00");
    rawQuery("INSERT INTO reviews (owner, repo, pull_number, head_sha, review_body, verdict, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "org", "repo", 3, "ccc", "r3", "COMMENT", "2026-01-03 00:00:00");

    const page1 = getReviews({ limit: 2, offset: 0 }) as Array<{ pull_number: number }>;
    expect(page1).toHaveLength(2);
    expect(page1[0].pull_number).toBe(3);
    expect(page1[1].pull_number).toBe(2);

    const page2 = getReviews({ limit: 2, offset: 2 }) as Array<{ pull_number: number }>;
    expect(page2).toHaveLength(1);
    expect(page2[0].pull_number).toBe(1);
  });

  it("filters reviews by project", () => {
    markReviewed("org1", "repoA", 1, "aaa", "r1", "COMMENT");
    markReviewed("org2", "repoB", 2, "bbb", "r2", "COMMENT");

    const filtered = getReviews({ project: "org1/repoA" });
    expect(filtered).toHaveLength(1);
  });

  it("getReviewProjects returns distinct projects", () => {
    markReviewed("org1", "repoA", 1, "aaa");
    markReviewed("org1", "repoA", 2, "bbb");
    markReviewed("org2", "repoB", 3, "ccc");

    expect(getReviewProjects()).toEqual(["org1/repoA", "org2/repoB"]);
  });

  it("getReviewCount returns total and filtered count", () => {
    markReviewed("org", "repo", 1, "aaa");
    markReviewed("org", "repo", 2, "bbb");

    expect(getReviewCount()).toBe(2);
    expect(getReviewCount("org/repo")).toBe(2);
    expect(getReviewCount("none/none")).toBe(0);
  });
});

describe("config", () => {
  beforeEach(resetForTests);

  it("setConfig and getConfig round-trip", () => {
    setConfig("test_key", "test_value");
    expect(getConfig().test_key).toBe("test_value");
  });

  it("setConfig overwrites existing keys", () => {
    setConfig("key", "old");
    setConfig("key", "new");
    expect(getConfig().key).toBe("new");
  });

  it("setConfigBulk writes multiple keys atomically", () => {
    setConfigBulk({ a: "1", b: "2", c: "3" });
    const config = getConfig();
    expect(config.a).toBe("1");
    expect(config.b).toBe("2");
    expect(config.c).toBe("3");
  });
});

describe("users", () => {
  beforeEach(resetForTests);

  it("getUserCount returns 0 initially", () => {
    expect(getUserCount()).toBe(0);
  });

  it("createUser and getUserByEmail", () => {
    createUser("test@test.com", "hash123");
    expect(getUserCount()).toBe(1);

    const user = getUserByEmail("test@test.com");
    expect(user).not.toBeNull();
    expect(user!.email).toBe("test@test.com");
    expect(user!.password_hash).toBe("hash123");
  });

  it("rejects duplicate emails", () => {
    createUser("test@test.com", "hash1");
    expect(() => createUser("test@test.com", "hash2")).toThrow();
  });

  it("getUserByEmail returns null for unknown email", () => {
    expect(getUserByEmail("nobody@test.com")).toBeNull();
  });
});

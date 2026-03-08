import { describe, it, expect } from "vitest";

// Test getRepos parsing logic from poller.ts
function getRepos(raw: string): Array<{ owner: string; repo: string }> {
  if (!raw) return [];
  return raw.split(",").map((r) => {
    const [owner, repo] = r.trim().split("/");
    return { owner, repo };
  });
}

describe("getRepos parsing", () => {
  it("parses single repo", () => {
    expect(getRepos("owner/repo")).toEqual([{ owner: "owner", repo: "repo" }]);
  });

  it("parses multiple repos", () => {
    expect(getRepos("org1/repoA,org2/repoB")).toEqual([
      { owner: "org1", repo: "repoA" },
      { owner: "org2", repo: "repoB" },
    ]);
  });

  it("handles whitespace around repos", () => {
    expect(getRepos("org1/repoA , org2/repoB")).toEqual([
      { owner: "org1", repo: "repoA" },
      { owner: "org2", repo: "repoB" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(getRepos("")).toEqual([]);
  });
});

describe("poll interval parsing", () => {
  function getIntervalMs(raw: string | undefined): number {
    return parseInt(raw || "300") * 1000;
  }

  it("parses numeric interval", () => {
    expect(getIntervalMs("60")).toBe(60000);
  });

  it("defaults to 300 seconds", () => {
    expect(getIntervalMs(undefined)).toBe(300000);
  });

  it("handles string numbers", () => {
    expect(getIntervalMs("120")).toBe(120000);
  });
});

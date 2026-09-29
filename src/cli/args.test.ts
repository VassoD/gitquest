import { describe, expect, it } from "vitest";
import { parseCliArgs, UsageError } from "./args.js";

describe("parseCliArgs --github", () => {
  it("should default to no GitHub account", () => {
    expect(parseCliArgs([]).github).toBeNull();
  });

  it("should accept a login with or without a leading @", () => {
    expect(parseCliArgs(["--github", "octo-cat"]).github).toBe("octo-cat");
    expect(parseCliArgs(["-g", "@octocat"]).github).toBe("octocat");
  });

  it("should keep local folders alongside the GitHub account", () => {
    const options = parseCliArgs(["~/code", "--github", "octocat"]);
    expect(options.roots).toEqual(["~/code"]);
    expect(options.github).toBe("octocat");
  });

  it("should reject values that are not GitHub usernames", () => {
    expect(() => parseCliArgs(["--github", "../etc"])).toThrow(UsageError);
    expect(() => parseCliArgs(["--github", "-bad"])).toThrow(UsageError);
  });
});

describe("parseCliArgs --publish", () => {
  it("should be off unless asked for", () => {
    expect(parseCliArgs([]).publish).toBe(false);
    expect(parseCliArgs(["--github", "octocat", "--publish"]).publish).toBe(true);
  });
});

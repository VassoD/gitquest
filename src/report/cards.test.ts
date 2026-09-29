import { describe, expect, it } from "vitest";
import { buildProfile } from "../analyze/build-profile.js";
import { makeCommit } from "../test-helpers.js";
import { renderAchievementStrip, renderMiniBadge, renderPlayerCard } from "./cards.js";
import { renderReport } from "./html.js";

const profile = buildProfile("<script>alert(1)</script>", [
  makeCommit("2020-02-12", { repo: "repo<&>", subject: "feat: <b>bold</b>", createdPaths: ["Dockerfile"] }, [{ path: "Dockerfile" }]),
]);

describe("report rendering", () => {
  it("should escape the player name in every output", () => {
    for (const output of [renderPlayerCard(profile), renderAchievementStrip(profile), renderMiniBadge(profile), renderReport(profile)]) {
      expect(output).not.toContain("<script>alert");
    }
  });

  it("should produce valid looking SVG documents", () => {
    for (const svg of [renderPlayerCard(profile), renderAchievementStrip(profile), renderMiniBadge(profile)]) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.trim().endsWith("</svg>")).toBe(true);
    }
  });
});

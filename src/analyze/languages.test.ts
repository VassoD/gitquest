import { describe, expect, it } from "vitest";
import { languageOf } from "./languages.js";

describe("languageOf", () => {
  it.each([
    ["src/components/Button.tsx", "frontend"],
    ["src/hooks/use-user.ts", "frontend"],
    ["apps/api/src/users.ts", "backend"],
    ["src/users/users.controller.ts", "backend"],
    ["newspulse-backend/src/index.ts", "backend"],
    ["services/api-gateway/main.ts", "backend"],
    ["src/rapid/index.ts", "frontend"],
    ["src/api/Client.tsx", "frontend"],
    ["src/app.service.ts", "frontend"],
    ["src/user.spec.ts", "test"],
    ["tests/test_models.py", "test"],
    ["pkg/user_test.go", "test"],
    ["android/app/src/MainActivity.kt", "mobile"],
    ["Sources/App.swift", "mobile"],
    ["styles/main.scss", "style"],
    ["README.md", "docs"],
  ])("should put %s under %s", (path, discipline) => {
    expect(languageOf(path)?.discipline).toBe(discipline);
  });

  it("should keep the language name when the discipline changes", () => {
    expect(languageOf("server/index.ts")?.name).toBe("TypeScript");
  });

  it("should ignore changelogs written by release tools", () => {
    expect(languageOf("CHANGELOG.md")).toBeNull();
  });
});

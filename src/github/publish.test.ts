import { describe, expect, it, vi } from "vitest";
import { GitHubClient } from "./api.js";
import { GitHubPublishError } from "./errors.js";
import { publishCards, withCardEmbed, type CardFile } from "./publish.js";

const CARDS: CardFile[] = [
  { name: "card.svg", svg: "<svg>card</svg>" },
  { name: "badge.svg", svg: "<svg>badge</svg>" },
];
const BASE_TREE = "tree-base";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function readmeResponse(content: string, path = "README.md"): Response {
  return jsonResponse({ path, content: Buffer.from(content).toString("base64") });
}

function clientWith(responses: Response[]): { client: GitHubClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  return { client: new GitHubClient({ token: "secret", fetchImpl: fetchMock, retryDelayMs: 0 }), fetchMock };
}

/** The repo, branch and README lookups every publish starts with. */
function headResponses(readme: Response): Response[] {
  return [
    jsonResponse({ default_branch: "main" }),
    jsonResponse({ object: { sha: "commit-head" } }),
    jsonResponse({ tree: { sha: BASE_TREE } }),
    readme,
  ];
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe("withCardEmbed", () => {
  it("should add the card at the end of the README", () => {
    expect(withCardEmbed("# Hi, I'm Ada\n\n", "card.svg")).toBe("# Hi, I'm Ada\n\n![gitquest](./gitquest/card.svg)\n");
  });

  it("should leave a README that already shows a gitquest card alone", () => {
    expect(withCardEmbed("# Ada\n<img src=\"gitquest/badge.svg\">\n", "card.svg")).toBeNull();
  });

  it("should start an empty README with the card", () => {
    expect(withCardEmbed("", "card.svg")).toBe("![gitquest](./gitquest/card.svg)\n");
  });
});

describe("publishCards", () => {
  it("should commit the cards and the README change together", async () => {
    const { client, fetchMock } = clientWith([
      ...headResponses(readmeResponse("# Ada\n")),
      jsonResponse({ sha: "tree-new" }),
      jsonResponse({ sha: "commit-new" }),
      jsonResponse({}),
    ]);

    const result = await publishCards(client, "ada", CARDS, "card.svg");

    expect(result).toEqual({ repoUrl: "https://github.com/ada/ada", committed: true, readmePath: "README.md" });
    expect(requestBody(fetchMock, 4)).toEqual({
      base_tree: BASE_TREE,
      tree: [
        { path: "gitquest/card.svg", mode: "100644", type: "blob", content: "<svg>card</svg>" },
        { path: "gitquest/badge.svg", mode: "100644", type: "blob", content: "<svg>badge</svg>" },
        { path: "README.md", mode: "100644", type: "blob", content: "# Ada\n\n![gitquest](./gitquest/card.svg)\n" },
      ],
    });
    expect(requestBody(fetchMock, 5)).toMatchObject({ tree: "tree-new", parents: ["commit-head"] });
    expect(String(fetchMock.mock.calls[6]?.[0])).toBe("https://api.github.com/repos/ada/ada/git/refs/heads/main");
    expect(requestBody(fetchMock, 6)).toEqual({ sha: "commit-new", force: false });
  });

  it("should keep the README's own file name", async () => {
    const { client, fetchMock } = clientWith([
      ...headResponses(readmeResponse("hello", "readme.markdown")),
      jsonResponse({ sha: "tree-new" }),
      jsonResponse({ sha: "commit-new" }),
      jsonResponse({}),
    ]);
    const result = await publishCards(client, "ada", CARDS, "card.svg");
    expect(result.readmePath).toBe("readme.markdown");
    expect(JSON.stringify(requestBody(fetchMock, 4))).toContain("readme.markdown");
  });

  it("should not commit when the cards are already up to date", async () => {
    const { client, fetchMock } = clientWith([...headResponses(readmeResponse("![gitquest](./gitquest/card.svg)")), jsonResponse({ sha: BASE_TREE })]);
    const result = await publishCards(client, "ada", CARDS, "card.svg");
    expect(result.committed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("should explain how to create the profile repo when it does not exist", async () => {
    const { client } = clientWith([jsonResponse({ message: "Not Found" }, 404)]);
    await expect(publishCards(client, "ada", CARDS, "card.svg")).rejects.toThrow(/Create a public repo named "ada"/);
  });

  it("should ask for a first commit when the profile repo is empty", async () => {
    const { client } = clientWith([jsonResponse({ default_branch: "main" }), jsonResponse({ message: "Git Repository is empty." }, 409)]);
    await expect(publishCards(client, "ada", CARDS, "card.svg")).rejects.toThrow(/is empty/);
  });

  it("should explain a token that cannot write to the repo", async () => {
    const { client } = clientWith([...headResponses(readmeResponse("# Ada")), jsonResponse({ message: "Not Found" }, 404)]);
    const publishing = publishCards(client, "ada", CARDS, "card.svg");
    await expect(publishing).rejects.toBeInstanceOf(GitHubPublishError);
    await expect(publishing).rejects.toThrow(/gh auth refresh -s repo/);
  });
});

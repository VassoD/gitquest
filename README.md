# gitquest

Turn your git history into an RPG save file.

gitquest scans every repo on your machine, finds the commits you authored since day one, and shows you what you actually achieved: your first test, the week you shipped your first Dockerfile, the 140-file refactor you forgot about, the languages you picked up along the way. Then it gives you a card to show it off on your GitHub profile.

It runs locally. Your code and history never leave your machine.

## What you get

- **Character sheet**: level, XP and a class (Frontend Illusionist, Backend Blacksmith, DevOps Warlock...) based on what you write.
- **Journey map**: every week since your first commit, with gold "boss fight" weeks where you unlocked something.
- **Achievements**: 14 of them, from First Blood (your first test) to Refactor Boss (100+ files in one commit). Locked ones show your progress.
- **Quest log**: one chapter per year, written from your stats.
- **README cards**: a player card, an achievement strip and a mini badge, as SVG.

## Quick start

Requires Node 20+ and git.

```sh
git clone <this repo> && cd gitquest
npm install
npm run dev
```

gitquest asks you three things:

1. **Where your repos are.** One or more folders, like `~/code`.
2. **Which emails are yours.** It lists every author it found and pre-ticks the ones that match your git config (same email, same name, or your GitHub noreply address). Press `space` to toggle one, `a` to toggle all, `enter` to confirm.
3. **Whether to open the report.**

That's it. The report and the README cards land in `gitquest-report/`.

## Scripting and CI

Every question has a flag, so you can skip the prompts:

```sh
npm run dev -- ~/code ~/work -e me@personal.dev -e me@company.com --no-input
```

| Flag | Description |
| --- | --- |
| `-e, --email <email>` | An email you commit with. Repeat for each one. Skips the email picker. |
| `-n, --name <name>` | Player name shown on the report. Defaults to `git config user.name`. |
| `-o, --out <folder>` | Output folder. Default `gitquest-report`. |
| `-d, --depth <n>` | How deep to look for repos under each folder. Default 4. |
| `--list-emails` | Print every author email found, with commit counts. |
| `--no-input` | Never prompt. Uses the current folder and your global `git config user.email` unless you pass them. |

Prompts are also skipped automatically when there is no terminal or when `CI` is set.

## Adding the card to your GitHub profile

1. Copy `card.svg` (or `achievements.svg`, `badge.svg`) from the report folder into a `gitquest/` folder in your profile repo (`github.com/<you>/<you>`).
2. Add this to its README:

```md
![gitquest](./gitquest/card.svg)
```

## How it works

- `src/cli`: argument parsing and the interactive prompts.
- `src/scan`: finds repos, runs `git log --numstat --summary` and parses it.
- `src/identity`: groups commits by author and guesses which emails are yours.
- `src/analyze`: stats, "firsts" detection, achievements, level and yearly chapters. Lockfiles, `node_modules`, build output and vendored code are ignored so they don't inflate your numbers.
- `src/report`: renders the HTML report and SVG cards.

Commits that show up in several clones are counted once.

## Development

```sh
npm test          # unit tests
npm run typecheck
npm run build     # compiles to dist/
```

## Roadmap

- GitHub Action that regenerates the card weekly
- GitHub API mode for repos you don't have cloned (PRs, reviews, issues)
- Optional AI-written chapter stories
- Shareable image export

## License

MIT

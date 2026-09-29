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

## Scanning a whole GitHub account

Repos you never cloned, or cloned on another laptop, can be pulled straight from GitHub:

```sh
npm run dev -- --github <your-username>
```

gitquest finds every repo that holds your commits and keeps a light copy of each in `~/.cache/gitquest/github/` (or `$XDG_CACHE_HOME/gitquest/github/`). The copy holds the commit history but no file contents. Once you've picked your emails, gitquest downloads only the file versions your own commits touched, since that's all it needs to count lines. A busy repo you made a handful of commits to costs a few MB instead of hundreds. Later runs only fetch what changed. Caches made by older versions of gitquest are replaced by light copies on the next run.

Which repos count:

- **Repos you own**, always, even forks, since your work there may sit on branches GitHub does not index.
- **Repos owned by others that you committed to**: open source projects, and org or shared repos. Being a member of an org is not enough. A repo you can read but never committed to is skipped.

Private repos and your org work need a token for your account: set `GITHUB_TOKEN` (or `GH_TOKEN`), or log in with `gh auth login`. Without one, only public repos you own are scanned. With a token for a different account, you get that account's public repos plus the public projects it contributed to.

GitHub only links a commit to you when its email is on your GitHub account. If you committed to someone else's repo with an email you never added to GitHub, that repo won't be found. Adding the email in GitHub's settings fixes it.

Also good to know:

- **Local folders still work** alongside it: `npm run dev -- ~/code --github you`. Commits found in both places are counted once.
- **Your GitHub noreply emails** (`you@users.noreply.github.com` and `12345+you@...`) are pre-ticked in the email picker, and used by default with `--no-input`.

The token is only sent to GitHub. It is passed to git through the environment, so it is never written into the cached clones.

To start from scratch, delete the cache with `rm -rf ~/.cache/gitquest`. The next run clones everything again.

## Scripting and CI

Every question has a flag, so you can skip the prompts:

```sh
npm run dev -- ~/code ~/work -e me@personal.dev -e me@company.com --no-input
```

| Flag | Description |
| --- | --- |
| `-g, --github <user>` | Scan every repo of this GitHub account, on top of any folders you pass. |
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
- `src/github`: lists an account's repos through the GitHub API, keeps light clones of them (history without file contents) in the cache.
- `src/identity`: groups commits by author and guesses which emails are yours.
- `src/analyze`: stats, "firsts" detection, achievements, level and yearly chapters. Lockfiles, `node_modules`, build output and vendored code are ignored so they don't inflate your numbers.
- `src/report`: renders the HTML report and SVG cards.
- `src/shared`: small helpers used across modules, like running async work with a concurrency limit.

Commits that show up in several clones are counted once.

## Development

```sh
npm test          # unit tests
npm run typecheck
npm run build     # compiles to dist/
```

## Roadmap

- GitHub Action that regenerates the card weekly
- PRs, reviews and issues from the GitHub API
- Optional AI-written chapter stories
- Shareable image export

## License

MIT

<p align="center">
  <img src="assets/banner.svg" alt="undecuple" width="660">
</p>

<h1 align="center">undecuple status</h1>

<p align="center"><b>A live status page for the undecuple GitHub projects.</b><br>
It shows what each project is doing: build state, last push, releases and open items.</p>

<p align="center">
  <a href="https://github.com/undecuple/me/actions/workflows/pages.yml"><img src="https://github.com/undecuple/me/actions/workflows/pages.yml/badge.svg" alt="Pages deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/undecuple/me" alt="Licence: MIT"></a>
  <a href="https://github.com/undecuple/me/commits/main"><img src="https://img.shields.io/github/last-commit/undecuple/me" alt="Last commit"></a>
  <a href="https://github.com/undecuple/me/stargazers"><img src="https://img.shields.io/github/stars/undecuple/me?style=flat" alt="Stars"></a>
</p>

<p align="center">
  <a href="https://undecuple.github.io/me/"><b>Open the site</b></a> ·
  <a href="https://undecuple.github.io/me/docs.html">Project docs</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#setup">Setup</a> ·
  <a href="https://github.com/undecuple">Profile</a>
</p>

---

## What you get

- **A table of every public repository** of the account: CI state, last push, latest release, stars, forks, open pull requests and issues. Sort it by activity, name, stars, forks, CI, pull requests or release.
- **Contributions:** the pull requests and issues the account has opened in other people's repositories, 10 per page, newest first.
- **Recent activity:** a feed of public events, newest first.
- **Project docs:** pages that explain the projects, with playable step-by-step diagrams. Today: how a re:psn server introduces players, and how a PS3 game becomes a native PC program with ps3recomp.
- **Comments** through giscus (GitHub Discussions in this repository).

The look is ANSI/NFO: a block-letter banner, double-line frames and 16 colours. The colours follow guts.nvim.

## How it works

- `tools/status.py` reads the GitHub API (GET only, public repositories) and writes `status.json`.
- `.github/workflows/pages.yml` is the only automation. It builds `status.json`, copies the site files into the Pages artifact and deploys it. It runs on every push to `main`, by hand, and on a schedule of every 10 minutes. GitHub often delays or skips scheduled runs, so the page says when its data was generated.
- When the page loads it also asks the GitHub API for stars, forks, last push and recent activity, so those stay current even when a scheduled run was skipped. CI, pull requests, releases and contributions are as of the generated time.
- `app.js` draws the page in the browser. All text goes through `textContent`. Links go only to `https://github.com/`, plus the fixed Ko-fi support link. The page contacts `api.github.com` (the live numbers) and, only when comments are enabled, `giscus.app`. It sets no cookies and loads no external fonts.
- The project docs pages use `play.js`, which plays the scenarios in `re-psn.json` and `ps3recomp.json`.
- The workflow needs `contents`, `actions`, `discussions` (read), `pages` and `id-token` permissions on the built-in token. It pins its actions by commit.
- Comments use giscus: one discussion for the whole site, titled "Site Discussions", in the category Announcements, so only the giscus bot opens threads. `status.py` reads the repository id and the category id with one GraphQL read query and puts them in `status.json`.

## Setup

1. Settings, Pages: set Source to GitHub Actions.
2. Run the `pages` workflow once (Actions, Run workflow).
3. For comments: turn Discussions on and install the [giscus app](https://github.com/apps/giscus) for the repository.
4. For the social preview: Settings, General, Social preview, upload `assets/social-preview.png` (1280x640).

GitHub turns off scheduled workflows in a public repository after 60 days without activity. Each scheduled run enables the workflow again through the API and, once a day, commits `status.json` to a `snapshot` branch. Whether either resets the 60-day timer is not confirmed by GitHub. If the page shows "status.json is N h old", re-enable the workflow under Actions or push to `main`.

Private repositories are never listed. The script skips them and uses a token that cannot read them.

## Corrections, removal requests and bugs

The site also hosts the contact forms for the ps3rc-feed project. [Open an issue](https://github.com/undecuple/me/issues/new/choose) to correct a wrong label, ask for a listing to be removed, or report a bug on the page or feed. Do not put passwords, tokens, game files or private information in an issue.

Do not report a security problem in a public issue. Write to undecuple@proton.me.

## How AI was used

This site was developed with AI agent assistance under the maintainer's direction. A person reads and approves the text before it is posted.

---

## Licence

MIT, see [LICENSE](LICENSE).

# me

![undecuple](assets/banner.svg)

Status page for the undecuple projects, in an ANSI/NFO look: block-letter banner, double-line frames, 16-colour palette.
It lists every public repository of the account with CI state, last push, latest release, stars, forks and open PR and issue
counts (sort by activity, name, stars, forks, CI, PRs or release), the pull requests and issues the account has opened in other
people's repositories, and a feed of recent public activity, newest first. Colours follow guts.nvim.

Site: https://undecuple.github.io/me/

## How it works
- `tools/status.py` reads the GitHub API (GET only, public repositories) and writes `status.json`.
- `.github/workflows/pages.yml` (the only automation; needs `contents`, `actions`, `pages` and `id-token` write on the
  built-in token) builds that file, copies `index.html`, `style.css`, `app.js` and `status.json` into the
  Pages artifact and deploys it, on every push to main and every 30 minutes.
- Comments use giscus (GitHub Discussions in this repository, category Announcements, so only the giscus bot opens threads; one discussion for the whole site, mapped by its title "Site Discussions"). `status.py` reads the repository id and the category id with one GraphQL read query and puts them in `status.json`; `app.js` loads `https://giscus.app/client.js` only when both are there. Setup: Discussions on, the giscus app installed for this repository (https://github.com/apps/giscus).
- `app.js` renders the table in the browser from `status.json`. All text goes through `textContent`; links only to
  `https://github.com/`. No external fonts; the only external request is the giscus widget, and only when comments are enabled.

## Setup
1. Settings, Pages: Source = GitHub Actions.
2. Run the `pages` workflow once (Actions, Run workflow).
3. Everything runs as the workflow. GitHub disables scheduled workflows in a public repository after 60 days without
   repository activity, so each scheduled run (a) calls the documented "enable workflow" API for itself and (b) once a day
   commits `status.json` to a `snapshot` branch (a regular commit, which is also a history of the status). Whether either
   one resets the 60-day timer is not confirmed by GitHub's documentation, so the page also shows a warning when its data
   is more than 3 hours old. If that appears, re-enable the workflow under Actions or push to main.
4. Settings, General, Social preview: upload `assets/social-preview.png` (1280x640: the banner from `assets/banner.svg`
   on the page background).

Private repositories are never listed: the script skips them and uses a token that cannot read them.

Prepared with AI assistance and reviewed by a person before posting.

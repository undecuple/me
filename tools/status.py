#!/usr/bin/env python3
"""Write status.json: public repositories of one user, their CI, releases, PR counts and recent public events.

Read-only GitHub API calls (GET). Token from GITHUB_TOKEN if set (a higher rate limit); works without one for a few repos.
Usage: python3 tools/status.py USER OUTFILE [OWNER/REPO for the giscus comment settings]
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API = "https://api.github.com"
TOKEN = os.environ.get("GITHUB_TOKEN", "")
EVENT_LIMIT = 30


FAIL = object()  # a call that failed (rate limit, server error, network): shown as unknown, never as "nothing"
errors = 0


def safe(path):
    """get() that returns FAIL on rate limits, server errors and network failures (one repo must not fail the run)."""
    global errors
    try:
        return get(path)
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        errors += 1
        print(f"warning: {path}: {e}", file=sys.stderr)
        return FAIL


def get(path):
    req = urllib.request.Request(API + path, headers={"Accept": "application/vnd.github+json",
                                                      "User-Agent": "status-page", "X-GitHub-Api-Version": "2022-11-28"})
    if TOKEN:
        req.add_header("Authorization", "Bearer " + TOKEN)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (404, 409):
            return None
        raise


def giscus(repo, category):
    """Comment settings for giscus: the repository id and the id of the discussion category, read with one GraphQL query
    (a read; needs a token). None when Discussions are off, the category is missing or the call fails."""
    global errors
    if not TOKEN or not repo:
        return None
    owner, name = repo.split("/", 1)
    q = ("query($o:String!,$n:String!){repository(owner:$o,name:$n){id hasDiscussionsEnabled "
         "discussionCategories(first:25){nodes{id name}}}}")
    body = json.dumps({"query": q, "variables": {"o": owner, "n": name}}).encode()
    req = urllib.request.Request(API + "/graphql", data=body, headers={
        "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "User-Agent": "status-page"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            doc = json.load(r)
        if doc.get("errors"):
            raise ValueError(doc["errors"][0].get("message", "GraphQL error"))
        repo_data = doc["data"]["repository"]
        if not repo_data.get("hasDiscussionsEnabled"):
            return None
        for c in repo_data["discussionCategories"]["nodes"]:
            if c["name"] == category:
                return {"repo": repo, "repo_id": repo_data["id"], "category": category, "category_id": c["id"]}
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError, AttributeError) as e:
        errors += 1
        print(f"warning: giscus query: {e}", file=sys.stderr)
    return None


def ci_state(repo, branch):
    runs = safe(f"/repos/{repo}/commits/{urllib.parse.quote(branch, safe='/')}/check-runs?per_page=100")
    if runs is FAIL:
        return {"state": "unknown", "total": 0, "summary": ""}
    if not runs or not runs.get("check_runs"):
        return {"state": "none", "total": 0, "summary": ""}
    counts = {}
    for c in runs["check_runs"]:
        k = c["conclusion"] or c["status"]
        counts[k] = counts.get(k, 0) + 1
    bad = sum(counts.get(k, 0) for k in ("failure", "timed_out", "action_required", "startup_failure"))  # cancelled is not a failure
    wait = sum(counts.get(k, 0) for k in ("queued", "in_progress", "waiting", "pending"))
    state = "fail" if bad else "wait" if wait else "ok"
    return {"state": state, "total": len(runs["check_runs"]),
            "summary": ", ".join(f"{n} {k}" for k, n in sorted(counts.items()))}


def release(repo):
    rels = safe(f"/repos/{repo}/releases?per_page=5")
    if rels is FAIL:
        return {"tag": None, "date": None, "pre": False, "url": None, "unknown": True}
    for r in rels or []:
        if not r.get("draft"):
            return {"tag": r["tag_name"], "date": r.get("published_at"), "pre": bool(r.get("prerelease")), "url": r["html_url"]}
    return {"tag": None, "date": None, "pre": False, "url": None}


def describe(ev):
    p, t = ev.get("payload", {}), ev["type"]
    if t == "PushEvent":
        n = p.get("size") or len(p.get("commits", [])) or 1
        return f"pushed {n} commit{'s' if n != 1 else ''} to {p.get('ref', '').replace('refs/heads/', '')} in"
    if t == "PullRequestEvent":
        pr = p.get("pull_request", {})
        act = "merged" if (pr.get("merged") or pr.get("merged_at")) else p.get("action", "updated")
        return f"{act} pull request #{pr.get('number', '?')} in"
    if t == "IssuesEvent":
        return f"{p.get('action', 'updated')} issue #{p.get('issue', {}).get('number', '?')} in"
    if t == "IssueCommentEvent":
        return f"commented on #{p.get('issue', {}).get('number', '?')} in"
    if t == "ReleaseEvent":
        return f"{p.get('action', 'published')} release {p.get('release', {}).get('tag_name', '')} in"
    if t == "CreateEvent":
        return f"created {p.get('ref_type', 'ref')} in"
    return None


def main():
    user, out = sys.argv[1], sys.argv[2]
    comments_repo = sys.argv[3] if len(sys.argv) > 3 else ""
    repos = []
    for r in get(f"/users/{user}/repos?type=owner&per_page=100&sort=pushed") or []:
        if r["private"] or r["archived"] or r["disabled"]:
            continue
        name = r["full_name"]
        prs = safe(f"/repos/{name}/pulls?state=open&per_page=100")  # first 100 only
        n_prs = None if prs is FAIL else len(prs or [])
        repos.append({"name": r["name"], "full_name": name, "url": r["html_url"], "fork": r["fork"],
                      "description": r.get("description") or "", "stars": r["stargazers_count"], "forks": r["forks_count"], "pushed_at": r["pushed_at"],
                      "branch": r["default_branch"], "ci": ci_state(name, r["default_branch"]),
                      "release": release(name), "open_prs": n_prs,
                      "open_issues": None if n_prs is None else max(0, r["open_issues_count"] - n_prs)})
    events = []
    evs = safe(f"/users/{user}/events/public?per_page={EVENT_LIMIT}")
    for ev in ([] if evs is FAIL else evs or []):
        what = describe(ev)
        if what:
            events.append({"at": ev["created_at"], "what": what, "repo": ev["repo"]["name"]})
    events.sort(key=lambda e: e["at"], reverse=True)
    contrib = []
    q = urllib.parse.quote(f"author:{user} -user:{user} is:public")
    found = safe(f"/search/issues?q={q}&sort=updated&order=desc&per_page=40")
    for it in ([] if found is FAIL else (found or {}).get("items", [])):
        repo = it["repository_url"].split("/repos/", 1)[-1]
        pr = it.get("pull_request")
        state = "merged" if pr and pr.get("merged_at") else it["state"]
        contrib.append({"repo": repo, "number": it["number"], "title": it["title"], "pr": bool(pr), "state": state,
                        "updated": it["updated_at"], "url": it["html_url"]})
    doc = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "user": user,
           "repos": repos, "events": events, "contrib": contrib, "giscus": giscus(comments_repo, "Announcements"), "errors": errors,
           "build": {"sha": os.environ.get("GITHUB_SHA", "") if re.fullmatch(r"[0-9a-f]{40}", os.environ.get("GITHUB_SHA", "")) else ""}}
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"{len(repos)} repositories, {len(events)} events, {len(contrib)} contributions, {errors} failed calls")


if __name__ == "__main__":
    main()

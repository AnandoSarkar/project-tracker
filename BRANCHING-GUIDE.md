# Git Branching & Merging — a hands-on guide

You've been committing in a straight line on `main`, which is also what GitHub Pages publishes. This guide introduces **feature branches**: a way to build something off to the side, commit freely, and only fold it into your live site once it works.

We'll use the **dark mode & PWA** feature as the worked example.

---

## The mental model

- **`main` = what's live.** It's the branch GitHub Pages deploys from.
- **A feature branch = your private workshop.** You can build, commit half-finished work, and experiment without touching `main` or your published site.
- **Merging = folding the finished work back into `main`.** Only at this point does it reach your users.

A branch is just a parallel line of commits. Until you merge, `main` stays exactly as it is — which is why branching is **low-risk**: if the feature goes sideways, you throw the branch away and `main` was never affected.

---

## The workflow, step by step

### 1. Start the branch from an up-to-date main

First make sure `main` has your latest work and matches GitHub, then branch off it.

```bash
git checkout main
git pull                          # make sure local main matches GitHub
git checkout -b feature/dark-mode # create the branch AND switch to it
```

The `-b` flag creates the branch and moves you onto it in one step. From now on, commits land on `feature/dark-mode`, not `main`.

> Tip: `git branch` lists your branches and marks the current one with `*`. `git status` always tells you which branch you're on.

### 2. Build and commit in small steps on the branch

This is where the branch earns its keep — you can commit work-in-progress without affecting the live site. For dark mode, natural commit points might be:

```bash
# add the dark theme CSS variables
git add index.html
git commit -m "Add dark theme color variables"

# add the toggle button + switching logic
git commit -am "Add dark mode toggle and persist choice"

# the PWA manifest + service worker
git commit -am "Add PWA manifest and service worker for installability"
```

Several small commits tell a story and give you points to roll back to, versus one giant commit at the end.

> `git commit -am "..."` is a shortcut that stages all *already-tracked* changed files and commits in one go. For brand-new files you still need `git add <file>` first.

### 3. Push the branch (optional, but useful)

You can push the branch to GitHub to back it up, without touching `main` or the published page:

```bash
git push -u origin feature/dark-mode
```

The live site at your Pages URL **still shows the old version** — the branch is not what Pages publishes. The `-u` sets up tracking so future pushes are just `git push`.

### 4. Merge back to main when it's working

Once dark mode is tested and you're happy with it, fold it in:

```bash
git checkout main          # switch back to the main line
git merge feature/dark-mode
git push                   # NOW it deploys — Pages rebuilds from main
```

The moment you push `main`, GitHub Pages redeploys and dark mode goes live. That's the payoff: **nothing reached your users until you deliberately merged.**

### 5. Clean up

```bash
git branch -d feature/dark-mode            # delete the local branch
git push origin --delete feature/dark-mode # delete it on GitHub too (if you pushed it)
```

Deleting a merged branch is purely tidiness — the commits are now part of `main`, so nothing is lost.

---

## Concepts worth internalizing

**Branching is cheap and reversible.** If the feature turns out badly, just `git checkout main` and delete the branch. Nothing was lost, and `main` never changed.

**Merging replays your branch's commits onto `main`.** Since you're the only one touching these files, it'll be a clean **fast-forward** merge with no conflicts.

**Merge conflicts** happen only when the *same lines* changed on both branches since they split. Not a concern on a solo project, but the term is good to know: git pauses, marks the clashing sections in the file, and you pick what to keep, then commit.

**Branch naming.** A common convention is `feature/<name>`, `fix/<name>`, `chore/<name>`. The prefix is just a label — git doesn't care — but it keeps a list of branches readable.

---

## Quick reference

| Goal | Command |
|------|---------|
| See current branch | `git status` or `git branch` |
| Create + switch to a branch | `git checkout -b feature/x` |
| Switch to an existing branch | `git checkout feature/x` |
| Stage a new file | `git add <file>` |
| Commit tracked changes | `git commit -am "message"` |
| Push a branch first time | `git push -u origin feature/x` |
| Merge a branch into main | `git checkout main` then `git merge feature/x` |
| Deploy (after merge) | `git push` (from `main`) |
| Delete a local branch | `git branch -d feature/x` |

---

## The cycle, in one line

**branch → commit → commit → test → merge → push (deploy) → delete branch**

That's the same loop professional teams use; the only thing they add on top is a *pull request* (a review step) before the merge — something you'll meet naturally if you ever collaborate or want a checklist before merging.

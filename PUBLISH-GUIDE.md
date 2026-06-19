# Publishing Your Project Tracker to the Web

You've built an app (`index.html`). Now let's get it onto the internet with a real, shareable URL. This guide walks you through the whole flow a developer actually uses.

The big idea you're learning: **code → commit → push → auto-deploy.** Once it's set up, every future change you make goes live just by saving and pushing.

---

## The mental model (read this first)

There are three "places" your code lives:

1. **Your computer** — where you edit `index.html`.
2. **GitHub** — a cloud home for your code. It stores your files and their history (this is "version control" via Git).
3. **A hosting service** — takes the files from GitHub and serves them to the world at a URL.

You connect GitHub to the host once. After that, the host watches your GitHub repo and **redeploys automatically** whenever you push a change. That auto loop is the thing worth internalizing.

Because your app is a single static HTML file, hosting is **free** and there's no server to manage.

---

## Option A — The fastest path: Netlify Drop (no Git, ~2 minutes)

Best for your very first "I see it live!" moment. No accounts-and-repos ceremony.

1. Go to **https://app.netlify.com/drop**
2. Drag the **`project-tracker` folder** (the one containing `index.html`) onto the page.
3. Wait a few seconds — you get a live URL like `random-name-123.netlify.app`. Done. Share it with anyone.

The catch: there's no Git connection, so to update it you drag the folder again. Great for a first taste, but Option B is the real-world workflow and what I'd recommend you learn next.

---

## Option B — The real workflow: GitHub + auto-deploy (recommended)

This is what professionals use. A bit more setup once, then updates are effortless.

### Step 1 — Make a GitHub account
Go to **https://github.com** and sign up (free). Verify your email.

### Step 2 — Create a repository
A "repo" is a project folder in the cloud.

1. Click the **+** (top right) → **New repository**.
2. Name it something like `project-tracker`.
3. Leave it **Public** (required for free hosting on GitHub Pages).
4. Click **Create repository**.

### Step 3 — Get your file into the repo

**Easiest (no command line):** On your new empty repo page, click **"uploading an existing file"**, then drag in `index.html`. Add a short message like "first version" and click **Commit changes**. That's a *commit* — a saved snapshot.

**Or with Git on your computer (the proper way to learn):** Install Git from **https://git-scm.com** if you don't have it, then in a terminal:

```bash
cd "path/to/project-tracker"      # the folder with index.html
git init                          # start tracking this folder
git add index.html PUBLISH-GUIDE.md
git commit -m "First version of project tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/project-tracker.git
git push -u origin main           # send it to GitHub
```

(GitHub shows you these exact commands, with your URL filled in, right after you create the repo.)

### Step 4 — Turn on hosting

Pick **one** of these. All free. GitHub Pages is the simplest since your code is already there.

**GitHub Pages (simplest):**
1. In your repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source = Deploy from a branch**.
3. Choose branch **`main`** and folder **`/ (root)`**, click **Save**.
4. Wait ~1 minute. Your site appears at `https://YOUR-USERNAME.github.io/project-tracker/`.

**Netlify (nicer dashboard, faster deploys):**
1. Sign in at **https://app.netlify.com** with your GitHub account.
2. **Add new site → Import an existing project → GitHub** → pick your repo.
3. No build settings needed (it's a static file) — just click **Deploy**.

**Vercel (also excellent):**
1. Sign in at **https://vercel.com** with GitHub.
2. **Add New → Project** → import your repo → **Deploy**.

### Step 5 — You're live 🎉
You now have a public URL. Open it on your phone, send it to a friend.

---

## The payoff: how you update from now on

Change `index.html` on your computer, then:

```bash
git add index.html
git commit -m "Describe what you changed"
git push
```

Within a minute, your live site updates **automatically**. No re-uploading, no manual deploy. That's the loop. Make a change, push, refresh the live URL — that feedback cycle is the heart of shipping software.

---

## Good next steps once it's live

- **Custom name:** Rename the site in your host's dashboard (e.g. `anando-tracker.netlify.app`), or buy a real domain (~$10/yr) and point it at the site.
- **Add the Kanban view:** The code already has a disabled "Kanban" tab and a `VIEWS` router with placeholders. Adding it means writing one `renderKanban()` function and enabling the tab — no rewrite needed. Same pattern for Calendar and Gantt.
- **Version history:** Browse your repo's "commits" on GitHub to see every snapshot. You can roll back to any of them. This is the safety net that lets you experiment fearlessly.

---

## Troubleshooting

- **GitHub Pages shows 404 / blank:** Give it 1–2 minutes after enabling. Make sure the file is named exactly `index.html` and sits at the repo root.
- **`git push` asks for a password and rejects it:** GitHub no longer accepts account passwords on the command line. Either use the web upload method (Step 3, easiest), or create a Personal Access Token (GitHub → Settings → Developer settings → Tokens) and use that as the password.
- **My tasks disappeared:** Data is saved per-browser in `localStorage`, so it won't follow you across devices or survive clearing browser data. That's expected for this version — adding a cloud database is a great future upgrade.

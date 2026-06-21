# CLAUDE.md — Project Tracker

Context for AI assistants (and humans) working on this project. Read this first.

## What this is

A **project/task tracker web app**, built as a learning project to practice the full build-and-publish flow. Started as a single self-contained `index.html` (no build step, no framework) and **graduated** to a small multi-file app when cloud sync landed. Data lives in the browser's `localStorage` when logged out, and in **Supabase** (Postgres + Auth) when logged in, syncing across devices.

**Live site:** https://anandosarkar.github.io/project-tracker/ (GitHub Pages, deploys from `main`).

## Guiding principles

- **No build step.** Still true and important: plain vanilla JS, hand-written CSS, ES/classic scripts loaded directly — works on GitHub Pages + mobile with nothing to compile. The Supabase SDK is loaded from a CDN, not npm.
- **Mostly self-contained, now multi-file.** The original "single `index.html`" rule was deliberately retired at the cloud-sync graduation. App logic now spans `index.html` + a small `js/` folder (see File structure). The *views* still live in `index.html`'s inline script; only data/auth concerns were split out.
- **One data seam.** All persistence goes through `js/store.js` (localStorage) and, when logged in, the cloud write helpers in `index.html` that call `js/cloud.js`. New storage logic belongs there, not scattered through the views.
- **It's a learning project.** When making changes, briefly explain the *why* and the transferable concept, not just the *what*.
- **Verify before declaring done.** Every feature gets Node logic tests + a live check before it's considered finished (see Testing). For cloud features, verify against the live database too.
- **Secrets discipline.** The Supabase URL + publishable key are public and safe in `js/config.js`. The service-role key must NEVER appear in client code. Security is enforced by Row-Level Security in the DB, not by hiding the key.

## File structure

| File | Purpose |
|------|---------|
| `index.html` | The app — HTML + CSS + the main view/UI script (inline). Imports the `js/` modules. |
| `js/store.js` | The persistence seam: localStorage read/write (`window.Store`). The one place that knows where data physically lives. |
| `js/cloud.js` | Supabase client + auth + cloud data API (`window.Cloud`). ES module; loads the SDK from CDN. |
| `js/config.js` | Public Supabase URL + publishable key (`window.SUPABASE_CONFIG`). Safe to commit. |
| `manifest.webmanifest` | PWA manifest (app name, icons, colours, `display: standalone`). Lets the app be installed. |
| `sw.js` | Service worker — precaches the app shell + `js/` files, serves cache-first (offline). Update flow: a new SW waits and the page shows a "Reload" banner (no auto-skipWaiting). |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | App icons referenced by the manifest. |
| `roadmap.html` | Interactive Done / Now / Later roadmap. Keep it updated when features ship. |
| `CLOUD-SYNC-SPEC.md` | The cloud-sync design + phase plan + provisioned-project details. |
| `PUBLISH-GUIDE.md` | How to deploy to the web (GitHub + Pages). |
| `BRANCHING-GUIDE.md` | Git feature-branch workflow (branch → commit → merge). |
| `TESTING-GUIDE.md` | What/why/how of testing, grounded in this app's code. |
| `MOBILE-REDESIGN.md` | Design-critique notes from the mobile/responsive redesign. |
| `CLAUDE.md` | This file. |

## How the app is architected

- **View switcher.** Tabs (List, Kanban, Calendar, Gantt — all live). A `VIEWS` object maps a view name to its render function, and `render()` dispatches to the active one. **Adding a view = write one render function + enable its tab.** Preserve this pattern.
- **State** lives in module-level variables: `tasks` (the data), `currentView`, `editingId`, `calCursor`, `calMode`, `searchText`, `activeChips`.
- **Persistence.** `load()` reads/parses `localStorage`; `save()` writes it. `load()` runs every task through `normalizeTask()`. Projects live in a separate key (`PROJECTS_KEY`) via `loadProjects()`/`saveProjects()`, normalised through `normalizeProject()`. Milestones likewise under `MILESTONES_KEY` via `loadMilestones()`/`saveMilestones()`/`normalizeMilestone()`.
- **Projects (one-to-many).** Projects are their own objects; a task references one via `projectId` (`""` = none). Deleting a project reassigns its tasks **and milestones** to `""` rather than orphaning them. A global `projectFilter` narrows every view; List view also groups under project headings when the filter is "all". `syncProjectControls()` rebuilds the panel + both dropdowns on each render.
- **Subtasks (nested + derived).** Each task has a `subtasks` array of `{id, text, done}`. `normalizeSubtasks()` sanitizes it (part of `normalizeTask`). Progress (`2/5`) is **derived** via `subtaskProgress()` — never stored — so it can't drift. Edited in the form via a `draftSubtasks` working array (committed on Save); toggled live in the List detail panel. Because toggling re-renders, `openDetailIds` (a Set of task ids) preserves which panels are expanded across renders.
- **`normalizeTask(t)`** is the backward-compatibility layer: it sets safe defaults then lets existing values win, so older/imported data gains any missing fields (e.g. `priority`). **Any new task field must be added here** so old saved data keeps working.
- **Shared add/edit form.** One form does both create and edit, switched by `editingId` (null = add, otherwise the id being edited) — the "one form, two modes" pattern.
- **Calendar.** Weeks start **Monday**. `mondayIndex(date)` converts JS's Sunday-based `getDay()` to Monday-based. `weekStart()`, `isWeekend()` derive from it. Month/Week/Day modes share helpers (`tasksByDate`, `taskChip`, `dayCell`) and a `calMode` dispatcher. Grid columns use `repeat(7, minmax(0, 1fr))` so a long task title clips instead of widening its column.
- **Gantt (data → pixels).** Pure scale math, all using the `iso + "T00:00:00"` parse convention to avoid UTC drift: `daysBetween(a,b)` (whole days, computed in UTC so DST can't shift the count), `dateToX(date, rangeStart, pxPerDay)` (the date→pixel map), `timelineRange(tasks, milestones)` (min/max across all dates incl. milestones), `addDays`. Tasks render as bars (`start`→`due`, single-day marker if only one date, min-width clamp, start-after-due clamped so no negative width); undated tasks listed separately. One horizontal scroll container holds the axis + rows so they stay locked without JS scroll-sync. Desktop-first; mobile shrinks the label column via `--gantt-label-w`. **Bars before diamonds** was deliberate — both share `dateToX`.
- **Milestones (separate object).** A `milestones` array under `MILESTONES_KEY`, with `loadMilestones`/`saveMilestones`/`normalizeMilestone` mirroring projects. Rendered as **diamonds** on the Gantt via the same `dateToX` scale (filled = past/reached, outlined = upcoming; same-date collisions nudged vertically). Managed via the ◆ Milestones panel (mirrors the Projects panel). Carried in export/import. The `dependsOn` array is migrated but **inert** (forward hook). **Any new milestone field must be added to `normalizeMilestone`.**
- **Add-task form is collapsed by default** at all widths behind the "+ Add task" toggle (`body.form-open` reveals it); editing a task forces it open. The task list is what you see first.
- **Cloud sync (Supabase).** Model: **cloud is source of truth when logged in**, localStorage when not (and as an offline cache). On login, `enterCloudMode()` calls `Cloud.fetchAll()` and replaces the in-memory arrays; on logout, `enterLocalMode()` reloads from localStorage. CRUD functions write the specific changed row to the cloud via fire-and-forget helpers (`cloudUpsertTask`, `cloudDeleteTask`, …) — instant UI, background sync, error banner on failure. **The app keeps its string `uid()` ids**, stored in the DB's `client_id` column (matched on `(user_id, client_id)` for upserts); the DB uuid PK is internal, so the views never learn about uuids. RLS scopes every row to its owner. **First-login migration:** if the cloud is empty and local has data, `offerMigration()` prompts to upload (projects→tasks→milestones for FK order); a `migrationPending` guard + "never overwrite a non-empty local cache with an empty cloud" rule prevent a data-loss race. Auth UI is in the Account panel (email/password; Google deferred). See `CLOUD-SYNC-SPEC.md`.
- **Service-worker updates.** `sw.js` does NOT auto-`skipWaiting`. A new version waits; the page detects it (`updatefound`/`controllerchange`) and shows a "new version — Reload" banner that posts `SKIP_WAITING` then reloads once. **Bump `CACHE` in `sw.js` on every deploy that changes cached files** (still required), and add any new `js/` file to the SW `SHELL` list.

## Task data shape

```js
{
  id: string,            // unique, from uid()
  title: string,
  start: "YYYY-MM-DD" | "",  // optional start date; "" when unset. Groundwork for the Gantt timeline.
  due: "YYYY-MM-DD" | "",
  status: "todo" | "doing" | "done",
  priority: "none" | "low" | "med" | "high",
  notes: string,         // free-text, may be multi-line; "" when empty
  projectId: string,     // id of the owning project, or "" for no project
  subtasks: [             // checklist items (nested array); [] when none
    { id: string, text: string, done: boolean }
  ],
  created: number        // Date.now() timestamp
}
```

## Project data shape

```js
{
  id: string,            // unique, from uid()
  name: string,
  created: number        // Date.now() timestamp
}
```

## Milestone data shape

A milestone is a separate object type (its own array + `MILESTONES_KEY` storage key +
`normalizeMilestone`), mirroring the projects pattern. It marks a single dated moment on
the Gantt timeline (rendered as a diamond), as opposed to a task's date span.

```js
{
  id: string,            // unique, from uid()
  name: string,
  date: "YYYY-MM-DD",    // the single moment (required — unlike task dates)
  projectId: string,     // id of the owning project, or "" for none
  dependsOn: [],         // optional array of task IDs this milestone depends on.
                         // INERT: stored + migrated, but no logic acts on it yet.
                         // A forward hook for future task→milestone dependencies.
  created: number        // Date.now() timestamp
}
```

## Conventions

- **CSS** is driven by custom properties (variables) in `:root` — reuse them (`--accent`, `--line`, `--muted`, etc.) rather than hard-coding colors. This also makes the planned dark-mode toggle nearly free.
- **Text from tasks** is inserted via `textContent` / `createTextNode`, never via `innerHTML`, to avoid HTML injection from task titles.
- **Comments** explain non-obvious *why*s (e.g. the `preventDefault()` in calendar/kanban drag handlers, the spread order in `normalizeTask`).

## Testing workflow

This app has no test framework; tests are run ad hoc with **Node.js**:
1. Extract the `<script>` body from `index.html`.
2. Provide a tiny stubbed `document` / `localStorage` / `window`.
3. `eval` the script, then assert with a one-line `check()` helper.

Focus tests on the **pure, breakable logic**: date math (`mondayIndex`, `weekStart`, days-in-month, leap years), `normalizeTask` (migration), `parseImport` (validation), the list filter pipeline, and `priorityRank` sorting. Always **re-run after changes** to catch regressions. When a test fails, check whether the bug is in the test or the code — both have happened here.

## Dev / publish cycle

1. (Optional but encouraged) work on a `feature/<name>` branch — see `BRANCHING-GUIDE.md`.
2. Make the change in `index.html` (views/UI) or the relevant `js/` module (data/auth/cloud).
3. Run the Node verification for the affected logic; for cloud changes, verify against the live DB too.
4. **Bump `CACHE` in `sw.js`** if any cached file changed; add new `js/` files to the SW `SHELL`.
5. Update `roadmap.html` when a feature ships.
6. Commit → push `main` → GitHub Pages auto-deploys within ~1–2 min. (A new SW now surfaces a "Reload" banner instead of needing a manual cache reset.)

## Roadmap status (keep in sync with roadmap.html)

- **Shipped:** list view + publish, task editing, Kanban, calendar (month), calendar Month/Week/Day toggle, priority + colour tags, search & quick filters, calendar polish (Monday start / weekends / equal columns), JSON export/import, dark mode (system default + remembered manual toggle), PWA install (manifest + service worker, app-shell offline cache), mobile redesign / responsive polish (collapsible form, restructured task cards, scrollable tabs, larger tap targets — see MOBILE-REDESIGN.md), task notes (free-text field + expandable detail panel in List view), project grouping (projects as separate objects, projectId on tasks, management panel, global filter across views + grouped List headings), Kanban filters (project picker + Overdue/High chips sharing state with List), subtasks/checklists (nested array per task, form editor + interactive panel, derived progress badge), start-date field (optional `start` on tasks), collapsible add-task form (collapsed by default at all widths behind a "+ Add task" toggle), Gantt timeline + milestones (task bars from start→due via `dateToX` scale math, milestone diamonds, `MILESTONES_KEY` object mirroring projects with inert `dependsOn` hook, ◆ Milestones management panel, project filter + grouping + export/import integration, desktop-first with a mobile label-column shrink), cloud sync (Supabase Postgres + Auth behind email/password login; graduated to multi-file `js/` modules; cloud-as-source-of-truth when logged in with localStorage offline cache; per-row writes keyed on `client_id`; RLS per-user isolation; first-login local-data migration; SW update banner + offline awareness — see CLOUD-SYNC-SPEC.md).
- **Now:** _(roadmap complete — every planned feature shipped)_
- **Later:** _(nothing queued — all planned stretch goals shipped)_. Possible future ideas: real-time multi-device updates (Supabase subscriptions), offline-first write queue, task↔milestone dependencies (the `dependsOn` hook exists), sharing/collaboration.

## Gotchas

- `localStorage` is per-browser — data doesn't sync across devices (by design, until cloud sync).
- The live site only updates when `main` is pushed; a feature branch or unpushed local changes won't appear at the Pages URL.
- GitHub Pages can cache briefly after a push; give it a minute before assuming a deploy didn't work.
- **The service worker caches the app shell, so a normal push won't reach returning visitors until the cache name is bumped.** When you change `index.html` (or any cached file), bump `CACHE` in `sw.js` (e.g. `v2` → `v3`) in the same commit — otherwise the old cached page keeps being served. Note the SW also takes over on the *next* load, so the first refresh after deploy may still show the old version; a second refresh (or reopening the installed app) shows the update.

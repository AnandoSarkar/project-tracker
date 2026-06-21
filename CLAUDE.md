# CLAUDE.md — Project Tracker

Context for AI assistants (and humans) working on this project. Read this first.

## What this is

A simple **project/task tracker web app**, built as a learning project to practice the full build-and-publish flow. It's a single, self-contained `index.html` — no build step, no framework, no backend. Tasks are stored in the browser's `localStorage`.

**Live site:** https://anandosarkar.github.io/project-tracker/ (GitHub Pages, deploys from `main`).

## Guiding principles

- **Keep it a single file.** All HTML, CSS, and JS live in `index.html`. Do not split into separate files or add a build step unless the owner explicitly decides to "graduate" the project (that's a roadmap item under cloud sync). *(Exception: the PWA needs `manifest.webmanifest` + `sw.js` as separate files because the browser fetches them by URL — they can't be inlined. The app code itself remains single-file.)*
- **No dependencies / no frameworks.** Plain vanilla JS, hand-written CSS. No npm packages in the app itself.
- **It's a learning project.** When making changes, briefly explain the *why* and the transferable concept, not just the *what*. The owner is learning web dev and the surrounding workflow (git, publishing, testing).
- **Verify before declaring done.** Every feature gets logic tests run via Node before it's considered finished (see Testing below).

## File structure

| File | Purpose |
|------|---------|
| `index.html` | The entire app — HTML + CSS + JS in one file. |
| `manifest.webmanifest` | PWA manifest (app name, icons, colours, `display: standalone`). Lets the app be installed. |
| `sw.js` | Service worker — precaches the app shell and serves it cache-first so the app works offline. |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | App icons referenced by the manifest. |
| `roadmap.html` | An interactive Now/Next/Later-style roadmap (Done / Now / Later columns). Keep it updated when features ship. |
| `PUBLISH-GUIDE.md` | How to deploy to the web (GitHub + Pages). |
| `BRANCHING-GUIDE.md` | Git feature-branch workflow (branch → commit → merge). |
| `TESTING-GUIDE.md` | What/why/how of testing, grounded in this app's code. |
| `MOBILE-REDESIGN.md` | Design-critique notes + prioritised fix list for the mobile/responsive redesign (Later). |
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
2. Make the change in `index.html`.
3. Run the Node verification for the affected logic.
4. Update `roadmap.html` when a feature ships.
5. Commit → push `main` → GitHub Pages auto-deploys within ~1–2 min.

## Roadmap status (keep in sync with roadmap.html)

- **Shipped:** list view + publish, task editing, Kanban, calendar (month), calendar Month/Week/Day toggle, priority + colour tags, search & quick filters, calendar polish (Monday start / weekends / equal columns), JSON export/import, dark mode (system default + remembered manual toggle), PWA install (manifest + service worker, app-shell offline cache), mobile redesign / responsive polish (collapsible form, restructured task cards, scrollable tabs, larger tap targets — see MOBILE-REDESIGN.md), task notes (free-text field + expandable detail panel in List view), project grouping (projects as separate objects, projectId on tasks, management panel, global filter across views + grouped List headings), Kanban filters (project picker + Overdue/High chips sharing state with List), subtasks/checklists (nested array per task, form editor + interactive panel, derived progress badge), start-date field (optional `start` on tasks), collapsible add-task form (collapsed by default at all widths behind a "+ Add task" toggle), Gantt timeline + milestones (task bars from start→due via `dateToX` scale math, milestone diamonds, `MILESTONES_KEY` object mirroring projects with inert `dependsOn` hook, ◆ Milestones management panel, project filter + grouping + export/import integration, desktop-first with a mobile label-column shrink).
- **Now:** _(nothing queued — pull the next item from Later)_
- **Later:** cloud sync (accounts + DB) — the full-stack leap; natural moment to graduate from the single file.

## Gotchas

- `localStorage` is per-browser — data doesn't sync across devices (by design, until cloud sync).
- The live site only updates when `main` is pushed; a feature branch or unpushed local changes won't appear at the Pages URL.
- GitHub Pages can cache briefly after a push; give it a minute before assuming a deploy didn't work.
- **The service worker caches the app shell, so a normal push won't reach returning visitors until the cache name is bumped.** When you change `index.html` (or any cached file), bump `CACHE` in `sw.js` (e.g. `v2` → `v3`) in the same commit — otherwise the old cached page keeps being served. Note the SW also takes over on the *next* load, so the first refresh after deploy may still show the old version; a second refresh (or reopening the installed app) shows the update.

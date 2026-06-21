# Cloud Sync — Spec & Plan

The "graduation" feature: move storage from the browser to **Supabase** behind a login,
so a user's tasks/projects/milestones follow them across devices. This is the roadmap's
final "Later" item and the point where the single-file principle intentionally bends.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Backend | **Supabase** (Postgres + Auth + JS SDK) | Portable Postgres; CDN-loadable SDK works with no build step; connector here can automate schema. |
| Sync model | **Cloud is source of truth when logged in** | Simplest correct model; maps onto the existing `load()/save()` seam. localStorage stays as offline read-cache + the logged-out experience. Offline-first reachable later without a rewrite. |
| Project shape | **Graduate to a small multi-file project** | Auth/data logic split into modules; still no build step (SDK from CDN). Must remain usable as a phone web app / installed PWA. |
| Auth | **Email + password only** (v1) | Simplest to build and reason about. Google/OAuth deferred — easy to add later via `signInWithOAuth`. |
| Existing local data | **Offer to upload on first login** | On first sign-in to an empty cloud account, prompt to push current local data up so nothing is lost. |

## Guiding principles for this feature

- **Logged out = today, unchanged.** No account required to use the app; it still reads/writes
  localStorage exactly as now. Cloud is purely additive.
- **One data seam.** All cloud reads/writes go through a single data module so the rest of the
  app doesn't know or care where data lives. This is what makes offline-first a later *extension*
  rather than a rewrite.
- **Secrets discipline.** The Supabase anon/publishable key is safe to ship in client code
  (it's designed to be public); the **service-role key must never** appear in the client.
  Security is enforced by Row-Level Security in the database, not by hiding the anon key.
- **Verify-before-done** still applies: schema tested via SQL, data-layer logic Node-tested where
  pure, and a live cross-device check at the end.

## Provisioned project (Phase 1 — done)

- **Supabase project:** `project-tracker` (ref `mnpvmflvwzfrtrumddfa`), org Weybridge Consulting, region eu-west-2, free plan ($0/mo), status ACTIVE_HEALTHY.
- **API URL:** `https://mnpvmflvwzfrtrumddfa.supabase.co`
- **Publishable key (safe for client/`config.js`):** `sb_publishable_s_GfKhh2LiHkeVQA-njw7g_zjLy0QR3`
  - (A legacy JWT `anon` key also exists; prefer the publishable key for new code.)
  - **Never** put the service-role key in client code. Security relies on RLS, which is enabled.
- **Schema:** `projects`, `tasks`, `milestones` created with `user_id` + `client_id`, JSON columns
  for `subtasks` / `depends_on`, `project_id` FKs using `on delete set null` (reproduces the
  reassign-orphans rule). RLS enabled on all three with a per-user `auth.uid() = user_id` policy.
  Security advisor: 0 lints.

## Architecture (the "graduated" shape)

Proposed file layout (still no build step — ES modules + CDN import):

```
index.html            # markup + view code (slimmed: data/auth logic moves out)
sw.js                 # service worker (cache list updated for new files)
manifest.webmanifest  # unchanged
/js/
  store.js            # THE data seam: load/save/CRUD. Routes to localStorage OR Supabase.
  cloud.js            # Supabase client init + auth (sign up/in/out, session, Google OAuth)
  config.js           # Supabase project URL + anon key (public, safe to commit)
```

- `index.html` loads the Supabase SDK from CDN (`<script type="module">` importing from
  `https://esm.sh/@supabase/supabase-js`), then imports the local modules.
- `store.js` exposes the SAME function names the app already calls (`load`, `save`,
  `loadProjects`, `saveProjects`, `loadMilestones`, `saveMilestones`, plus the CRUD helpers).
  Internally it checks "is there a logged-in session?" and dispatches to local or cloud.
- The view code (`renderList`, `renderGantt`, etc.) is untouched — it keeps calling the same
  functions. **This is the whole point of routing through one seam.**

## Database schema (Supabase / Postgres)

Three tables mirroring the current object shapes, each scoped to a user via `user_id`.
Postgres `uuid`/`text` ids; the app's existing string ids map to a `client_id` column so
imported local data keeps working. JSON columns hold the nested bits (subtasks, dependsOn).

```sql
-- tasks
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_id    text,                         -- original uid() from local data (for migration)
  title        text not null,
  start        date,                         -- null = unset
  due          date,
  status       text not null default 'todo', -- todo | doing | done
  priority     text not null default 'none', -- none | low | med | high
  notes        text not null default '',
  project_id   uuid references projects(id) on delete set null,  -- mirrors "reassign to none"
  subtasks     jsonb not null default '[]',  -- [{id,text,done}]
  created      timestamptz not null default now()
);

-- projects
create table projects (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  client_id text,
  name      text not null,
  created   timestamptz not null default now()
);

-- milestones
create table milestones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text,
  name       text not null,
  date       date not null,
  project_id uuid references projects(id) on delete set null,
  depends_on jsonb not null default '[]',    -- inert hook, preserved
  created    timestamptz not null default now()
);
```

**Row-Level Security (critical):** enable RLS on all three tables and add policies so a user
can only read/write rows where `user_id = auth.uid()`. Without RLS, the public anon key would
let anyone read everyone's data. This is the real security boundary.

Note the schema preserves the existing model exactly — including the project-deletion rule
(`on delete set null` reproduces "reassign orphaned tasks/milestones to no project") and the
inert `depends_on` hook.

## Auth flows

- **Sign up / sign in** with email + password (Supabase `signUp` / `signInWithPassword`).
- **Session persistence** is handled by the SDK (stored locally); on load the app checks for an
  existing session and shows logged-in or logged-out state.
- **UI:** a small auth control in the header (e.g. "Sign in" → modal/inline form; when logged in,
  show the email + "Sign out"). Logged-out users see today's app unchanged.
- **Google / OAuth is deferred** to a later iteration — `signInWithOAuth({ provider: 'google' })`
  can be added without disturbing the data seam or schema when wanted.

## First-login data migration

When a user signs in and their cloud account has **zero** rows across the three tables, and
local data exists, prompt: *"Upload your N local tasks / projects / milestones to your account?"*
On yes: push local data up (rewriting ids, mapping `projectId` references the same way
import-merge already does), then switch to cloud-as-source-of-truth. On no: start cloud empty
(local data stays in the browser; Export/Import remains the manual bridge).

## Edge cases & risks to plan for

- **Anon key exposure** — fine by design, *provided RLS is on*. The build order puts RLS before
  any client wiring so we never ship an unprotected window.
- **Logged-in but offline** — writes can't reach the cloud. For now: surface a clear "offline —
  changes won't sync" state and rely on the localStorage cache for reads. (Offline-first write
  queue is the future extension.)
- **id type change** (string `uid()` → uuid) — handled by `client_id` mapping during migration
  and by letting the DB generate uuids for new cloud rows.
- **Service worker caching** — the SDK is a cross-origin CDN script; decide whether to cache it
  (offline app shell) or always fetch. Bump cache version when files change.
- **Two tabs / two devices** — with cloud-as-truth, a manual refresh re-reads the latest; real-time
  live updates (Supabase subscriptions) are a nice later add, not in scope v1.
- **Data loss during migration** — never delete local data on upload; keep it as a fallback until
  the user confirms the cloud copy looks right.

## Build phases (each ends verified + pushable)

1. **Provision Supabase project + schema + RLS.** Create project (cost-gated — confirm with owner),
   apply the three-table migration, enable RLS + per-user policies. Verify with SQL (insert as
   two fake users, confirm isolation). *No app changes yet.*
2. **Extract the data seam.** Refactor existing `load/save/CRUD` into `js/store.js` with identical
   behaviour (still localStorage-only). Node-test + live-verify the app is unchanged. *Pure
   refactor — the riskiest-to-regress step, so isolated and verified before any cloud code.*
3. **Add Supabase client + config.** `js/cloud.js` + `js/config.js`; load SDK from CDN; init client.
   No UI yet — just confirm a session can be read in the console.
4. **Auth UI + email/password.** Header control, sign-up/in/out, session-aware rendering. Logged-out
   path stays identical. Live-verify both states.
5. **Route store.js to the cloud when logged in.** Reads/writes hit Supabase for an authed user;
   localStorage when not. Verify CRUD round-trips to the DB across all object types.
6. **First-login migration prompt.** Upload-local-data flow with id remapping. Verify on a fresh
   account.
7. **Offline / error states + SW cache update.** Clear messaging when offline-and-logged-in; update
   service worker cache list + version; confirm installed PWA still opens.
8. **Final verify + docs + roadmap.** Cross-device live test (sign in on two browsers, confirm data
   follows). Update CLAUDE.md (new architecture, file layout, env/keys, RLS note), move Cloud sync
   to Done, refresh BRANCHING/PUBLISH guides if the multi-file layout changes the flow.

## Out of scope for v1 (explicit)

- **Google / OAuth sign-in** — deferred; `signInWithOAuth` can be added later without schema or
  data-seam changes.
- Offline-first write queue + conflict resolution (the data seam leaves room for it).
- Real-time multi-device live updates (Supabase subscriptions).
- Sharing/collaboration between users.
- Password reset flows beyond what Supabase provides out of the box.

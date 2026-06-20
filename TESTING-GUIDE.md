# Testing — a hands-on guide (using the Project Tracker)

Every feature we built, we **verified** before calling it done. This guide explains what that verification actually was, why it matters, and how testing fits into the development cycle — using real examples from your own code.

---

## What is a test, and why bother?

A test is just **code that checks your code**. You give a function a known input, and assert that it returns the answer you expect. If it does, the test passes; if it doesn't, you've caught a bug before your users did.

Why it's worth the effort, especially as an app grows:

- **It catches mistakes early**, when they're cheap to fix — at your desk, not on the live site.
- **It lets you change things fearlessly.** When we reworked the calendar to start weeks on Monday, the tests told us instantly whether the date math still held. Without them, you'd be clicking around hoping you didn't break February.
- **It documents intent.** A test like "Feb 2028 has 29 days" says exactly what the code is *supposed* to do.
- **It builds confidence to ship.** "All checks pass" is a much better feeling than "I think it works."

The flip side: tests are code too, so they can have bugs. We actually hit this — twice a test "failed" but the real problem was the test's own expectation, not the app. That's normal, and catching it is part of the skill.

---

## The three main types of tests

Think of them as a pyramid — lots of small fast tests at the bottom, fewer big slow ones at the top.

### Unit tests (the foundation)
Test **one small piece in isolation** — usually a single function — with no browser, no clicking, no network. They're fast and pinpoint exactly what broke.

This is what we leaned on most. Example from your code: the priority sort helper.

```js
// the function under test (from index.html)
function priorityRank(p) { return (PRIORITY[p] || PRIORITY.none).rank; }

// a unit test for it
check("high outranks med", priorityRank("high") > priorityRank("med"));   // true
check("unknown -> none rank", priorityRank("bogus"), 0);                  // defaults safely
```

### Integration tests (do the pieces work together?)
Test **several units combined**. The individual functions might each be correct, but do they cooperate?

Example: your List view filtering isn't one function — it's a *pipeline* of status filter → search → chips. We tested the whole chain composing correctly:

```js
// "Overdue" + "High priority" chips together should return only matching tasks
filterPipeline(tasks, { overdue: true, high: true })  // -> just the overdue high-priority task
```

Each filter worked alone (unit-level), but the integration test confirmed they AND together properly.

### End-to-end (E2E) tests (does it work for a real user?)
Drive the **actual app in a real browser** — clicking buttons, typing, reading the screen — exactly as a person would. Slowest and most realistic.

We did a lightweight version of this when we opened your live GitHub Pages site in the browser, switched to the Calendar tab, and took a screenshot to confirm Monday-start, weekend shading, and equal columns rendered correctly. A full E2E suite would automate that with a tool like Playwright or Cypress.

**The trade-off:** unit tests are fast and precise but don't prove the whole thing works; E2E proves the real experience but is slow and brittle. A healthy project has many unit tests, some integration tests, and a few E2E tests for the critical paths.

---

## How testing fits the development cycle

A common rhythm, sometimes called **red → green → refactor**:

1. **Red** — write a test for the behaviour you want. It fails (the feature doesn't exist yet). This is "test-first" or TDD.
2. **Green** — write the simplest code that makes the test pass.
3. **Refactor** — clean up the code, confident the test will catch any regression.

You don't have to write the test *first* — plenty of people write the code, then the test, then keep both. What matters is that the test exists and runs. The cycle we actually used on this project was:

> **build the feature → write verification tests → run them → fix what fails (code *or* test) → only then mark it done**

And critically: **after changing anything, re-run the existing tests** to make sure you didn't break something that used to work. That's called catching a *regression*, and it's the single biggest payoff of having tests at all.

---

## How this applied to the Project Tracker — real cases

These aren't hypothetical. Each of these tests caught or prevented a real issue while we built your app.

### 1. The priority migration (a backward-compatibility test)
When we added priority, the risk was breaking tasks already saved in your browser from *before* the field existed. So we pre-loaded old-shaped tasks (no `priority`) and asserted the migration filled them in:

```js
// old task saved before "priority" existed
const legacy = { id:"old1", title:"Legacy", due:"", status:"todo" };
// after load()'s migration, it must gain a safe default
check("legacy task defaults to none", normalizeTask(legacy).priority === "none");
```

This is a test that protects *existing users' data* — exactly the kind of thing easy to forget and painful to get wrong.

### 2. Calendar date math (edge-case unit tests)
Dates are a classic bug magnet, so we tested the nasty cases explicitly rather than trusting "looks right":

```js
check("Feb 2028 is leap (29 days)", daysInMonth(2028, 1) === 29);
check("Feb 1900 NOT leap (century rule)", daysInMonth(1900, 1) === 28);
check("week of Sun rolls to prev Monday", weekStart(sundayDate) === thatMonday);
```

When we later switched to Monday-start, re-running these immediately confirmed nothing else broke.

### 3. Export/import round-trip (an integration test)
The real question for export/import isn't "does export work" or "does import work" separately — it's "if I export and then import, do I get my data back unchanged?" So we tested the round-trip:

```js
const json = JSON.stringify({ tasks });        // export
const back = parseImport(json);                // import
check("round-trip preserves every task", /* each task matches by id */);
check("malformed JSON is rejected", /* parseImport("{bad") throws */);
```

This one also surfaced a subtle inconsistency — the seed tasks were missing the `priority` field — which we then fixed. A good example of a test revealing *schema drift* you'd never notice by clicking around.

### When a "failing" test was actually a wrong test
Twice, a red result came from the test's own expectation being off (e.g. comparing against `null` when the correct value was `"none"`). The lesson: when a test fails, the bug might be in the test, not the code. You investigate, you don't just trust the red — and you don't just trust the green either.

---

## Practical setup for this app

Your app is a single HTML file with plain functions, so testing is refreshingly simple — no framework required:

- We extracted the `<script>` and ran the functions under **Node.js** with a tiny stubbed `document`/`localStorage`, then asserted with a one-line `check()` helper. That's a real unit-test harness, just minimal.
- If you wanted to formalize it, **Vitest** or **Jest** are popular JS test runners that give you `describe`/`it`/`expect`, automatic test discovery, and nicer output. For E2E, **Playwright** drives a real browser.
- A natural next step: move the pure logic (date helpers, `normalizeTask`, `parseImport`, the filter pipeline, `priorityRank`) into testable functions and write a small `tests.js` — those are the parts most worth locking down, because they're easy to break and hard to eyeball.

---

## The one-line takeaway

**A test is code that proves your code does what you claim — write them for the tricky, breakable parts (dates, data migrations, parsing), run them after every change, and let "all green" be what tells you it's safe to ship.**

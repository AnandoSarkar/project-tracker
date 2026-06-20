# Mobile Redesign — Notes & Critique

Working notes for the **"Mobile redesign / responsive polish"** roadmap item.
Source: a design critique run against screenshots of the live site rendered at
iPhone width (390px viewport) on 2026-06-20.

## The core problem

Everything is full-width and stacked vertically with desktop-sized spacing, so
the screen fills up fast. The entire first screen is consumed by chrome — title,
three action buttons, four view tabs, a five-field form, and a filter bar —
**before a single task appears.** On a to-do app the tasks are the product;
right now they're below the fold. The root cause: a single desktop layout being
squeezed by the narrow width, rather than mobile-specific layout rules.

## What's already working (keep it)

- The dark theme reads cleanly at narrow width.
- Card borders and priority colours survive the squeeze.
- The add-task form already reflows from one row to two columns instead of
  overflowing.
- There are already `@media (max-width: 640px)` blocks in `index.html` — the
  redesign is mostly about *extending* these, which fits the "keep it one file,
  reuse existing patterns" principle.

## Issues, highest-impact first

1. **Add-task form is too prominent.** It sits open at full height at the top,
   taking ~40% of the first screen for something done occasionally, not every
   visit.
   - *Fix:* collapse it behind a "+ Add task" button that expands the form on
     tap. Highest-leverage change — reclaims the most space.

2. **Task titles wrap to 2–4 lines.** The card reserves wide columns for the
   status dropdown + edit + delete, squeezing the title into a narrow strip
   (e.g. "Try marking a / task as / done" over four lines).
   - *Fix:* on mobile, give the title the full card width on its own row; move
     status/edit/delete into a compact action row beneath it.

3. **Vertical rhythm too loose.** Desktop margins (~20px between every block) are
   inherited as-is, pushing content down.
   - *Fix:* tighten section gaps to ~10–12px under the mobile breakpoint.

4. **View tabs wrap.** "Gantt" drops to a second row by itself and looks broken.
   - *Fix:* let the tab row scroll horizontally, or drop the disabled
     "Gantt — soon" tab on mobile.

5. **Filter/sort bar breaks awkwardly.** "Sort:" lands on one line with its
   dropdown on the next, detached from its label.
   - *Fix:* stack each label directly above its control, or give filter and sort
     their own full-width rows.

6. **Checkbox tap target (accessibility).** Buttons/dropdowns look like
   comfortable targets (~40px+), but the checkbox is close to the ~24px minimum
   and sits right next to edit/delete, inviting mis-taps.
   - *Fix:* enlarge the mobile tap area and add spacing between the checkbox and
     the action buttons.

## Suggested build order

1. Collapse the add-task form behind a button (biggest space win)
2. Restructure the task card for narrow screens (title on its own row)
3. Tighten vertical spacing under the mobile breakpoint
4. Fix the tab row wrap and the filter/sort bar
5. Verify checkbox tap target + spacing

## How to re-test

Render the live site inside a 390px-wide iframe (the browser window can resize
without changing the page viewport, which leaves the CSS media queries on the
desktop layout). Screenshot, then scroll the iframe to capture the task list.
Re-run `design:design-critique` on the new screenshots to check improvements.

## Verification reminder (per CLAUDE.md)

Any logic added (e.g. form collapse/expand state) gets a Node test before it's
considered done. Pure layout/CSS changes are verified visually via the iframe
screenshot method above.

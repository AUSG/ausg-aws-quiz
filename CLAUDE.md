# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
nvm use              # Node 22 (.nvmrc)
npm run dev          # Vite dev server, http://localhost:5173
npm test             # vitest run (all tests)
npm run test:watch
npm run coverage     # v8 coverage; fails below 80% on all four metrics
npm run build        # tsc -b && vite build — same command Vercel runs
```

Run a single test file or case:

```bash
npx vitest run src/test/pickSession.test.ts
npx vitest run -t '난이도'
```

`npm run build` must pass locally before pushing — a failure here is a failed deploy.

**`npm run lint` is currently broken**: the script runs `eslint .` but there is no
`eslint.config.js` in the repo (ESLint 9 flat config missing). Don't report lint results
without checking this; either add the config or use `npm run build` + `npm test` as the gate.

## What this is

A static single-page React app for a hackathon booth: a visitor picks up a tablet, answers
3 AWS Cloud Practitioner-level questions in ~30 seconds, and gets a prize for a perfect score.
No backend, no database, no environment variables, no persistence, no analytics. PWA caching
(`vite-plugin-pwa`, autoUpdate + skipWaiting) means the app keeps working after the venue wifi
drops. Deployed to Vercel on push to `main`.

The booth context drives nearly every design decision, and the reasoning is written into
source comments in Korean. **Read the comment above a function before changing it** — most
of what looks like an arbitrary constraint is a deliberate response to "a stranger uses this
for 30 seconds while standing up."

## Architecture

State flows one direction from `App.tsx` down:

```
App.tsx                 ← the only place state lives; reads URL config once
 ├─ config.ts           ← readBoothConfig(search): ?n= ?prize= ?idle= ?kiosk=
 ├─ state/useQuiz.ts    ← wraps quizReducer; the ONLY place randomness happens
 │   └─ state/quizReducer.ts   ← pure reducer + selectors (START/ANSWER/NEXT/RESET)
 ├─ hooks/useIdleReset.ts      ← kiosk hygiene: reset after idle timeout
 └─ screens/{Start,Quiz,Result}Screen.tsx   ← pure props-only presentational
```

Key invariants:

- **The reducer is pure and randomness is hoisted out of it.** `useQuiz.start()` calls
  `pickSession()` and ships the already-drawn array in the `START` action. Tests inject a
  seeded `rng` (`src/test/seededRng.ts`, mulberry32) for deterministic assertions.
- **Screens take props only.** They can be rendered standalone in tests; no context, no store.
- **No submit button.** Tapping an option grades immediately (`ANSWER` sets `revealed`).
  The `revealed` guard in the reducer is what absorbs double-taps on a shared tablet.
- **Question selection is not uniform random.** `lib/pickSession.ts` spreads categories across
  slots and orders questions by ascending difficulty, so a beginner doesn't lose on question 1
  and walk away. `selectSlot` degrades through preference tiers and never throws.
- **Question 1 is always from `커뮤니티`** (`LEAD_CATEGORY` in `lib/pickSession.ts`), so the quiz
  continues the AUSG/AWSKRUG intro the visitor just heard at the booth. It lands in display
  position 1 for free: the difficulty plan's first slot is always 1, and the final sort is
  ascending difficulty with pick-order as the tiebreak. Pass `leadCategory: null` to disable.
- **Runtime tuning is via URL params, not redeploys.** `?prize=2` is the one staff reach for
  most; `?idle=0` disables auto-reset for demos.

## The question bank

Questions live in `src/data/questions.ts` — 44 questions across 7 categories. The 6 AWS
categories hold 6 each (difficulty 1/2/3 × 2), so `pickSession`'s difficulty plan is always
satisfiable. `커뮤니티` holds 8, with **four** at difficulty 1 rather than two: it owns slot 1
of every session, and a shallower pool means someone waiting in line sees the same opening
question they just watched the person ahead of them answer.

`src/data/validateBank.ts` enforces the rules and `src/test/validateBank.test.ts` runs it
against the real bank, so a bad question fails `npm test`:

- Length caps (prompt 60 / option 24 / explanation 70 / hint 45 chars). **These are layout
  constraints wearing a content-validation costume** — exceeding them introduces scrolling on
  a phone, and scrolling at a booth means the visitor leaves. Don't raise them to fit content;
  compress the content.
- `choice` format needs exactly 4 options; `ox` needs exactly `['O', 'X']`.
- Prompts must end with `?`; ids and prompts must be unique.
- No answer index may hold more than 40% of `choice` questions (prevents guessing by position).
- A hint must not contain the correct option's text verbatim.
- Every category needs at least one question at each difficulty.

## Fonts (the non-obvious part)

Latin text uses self-hosted Amazon Ember; Korean uses a **Pretendard subset containing only the
characters the app actually renders** (~2MB → ~180KB). The split is done purely by
`unicode-range` in `src/index.css` — removing it makes Pretendard swallow Latin too and Ember
never appears.

If you add or change any user-facing Korean string, `src/test/fontCoverage.test.ts` fails with
the missing glyphs. Fix it by regenerating and committing the result:

```bash
pip install fonttools brotli
python3 scripts/build-fonts.py     # rewrites public/fonts/Pretendard-subset.woff2 + scripts/font-charset.txt
```

Comments are stripped before collecting characters (matching rules live in both
`build-fonts.py:strip_comments` and `fontCoverage.test.ts:stripComments` — **keep them in sync**),
so Korean comments are free and don't pressure anyone into writing English comments to
appease the test. `scripts/font-charset.txt` lives in `scripts/`, not `public/`, specifically so
the build doesn't ship it and the service worker doesn't cache it — a test asserts this.

## The Codex hint

`components/HintPanel.tsx` presents the per-question hint as coming from Codex — Codex mark
plus a "Codex" label on the callout, and a `Codex 힌트 보기` button. **The hints are static
strings in the question bank; nothing is generated at runtime and no API is called.** Keep it
that way: the app has no backend and must survive a dead venue network.

Pressing the button holds a `loading` state for `hintDelayMs` (default 700ms, tunable with
`?hint=`) before the hint appears, so the Codex framing isn't contradicted by an instant
reveal. `?hint=0` skips the timer entirely rather than setting a 0ms one — off means off.
The state lives in `QuizScreen` as `{ id, ready }` keyed by question id, so changing questions
resets it and the effect cleanup cancels an in-flight timer; without that, a hint requested on
question 1 would pop up over question 2. All three prompt states (`idle`/`loading`/`shown`)
share one box model — a shifting button under a finger is worse than a slow one.

**Testing note:** fake timers hang Testing Library in this project — reproducible with as
little as `vi.useFakeTimers({ toFake: ['setTimeout'] })`, which is why `hint.test.tsx` runs
delay-independent cases under `?hint=0` and keeps a single real-clock `describe` for the delay
itself. Don't "fix" that file by reaching for `vi.useFakeTimers()`.

`CodexMark` is a hand-built inline SVG rather than an image file, matching `CheckIcon`/
`CrossIcon` in `FeedbackPanel.tsx`. The petals are overlapping `<circle>`s sharing one
gradient — `gradientUnits="userSpaceOnUse"` is load-bearing, since the default
(`objectBoundingBox`) paints a separate gradient per circle and the seams show. The gradient
`id` comes from `useId()` so multiple instances don't collide. Codex brand colors live in
`@theme` as `--color-codex-violet` / `--color-codex-blue`, deliberately outside the ASB
palette so the hint reads as another tool helping out rather than another AWS affordance.

## Styling

Tailwind v4 via `@tailwindcss/vite`, **no `tailwind.config.js`**. All design tokens are declared
in `@theme` inside `src/index.css`, ported from the AWS Skill Builder design system
(`--color-asb-*`).

Two custom height-axis variants exist because the quiz layout runs out of *vertical* space,
which width breakpoints can't express:

- `short:` → `max-height: 719px` (360×640 Android, 375×667 iPhone SE) — tighter padding, smaller type
- `tall:` → `min-height: 900px` (portrait tablet) — raises minimums so options don't float as an island

`QuizScreen` is fixed at three vertical blocks: pinned header / single scrollable body /
pinned next-button. Keeping the button outside the scroll area is what guarantees
"read the answer → tap next" is always one tap.

## Testing

Vitest + jsdom + Testing Library, 80% coverage thresholds enforced in `vitest.config.ts`
(`questions.ts` and `main.tsx` excluded). Tests cover the reducer, `pickSession` determinism,
URL config parsing, the real question bank, the full flow (`flow.test.tsx`), the hint panel,
and font subset coverage.

## Deploy

Push to `main` → Vercel auto-deploys. If something breaks in production, **do not hotfix
forward** — use Vercel Dashboard → Deployments → Instant Rollback first. Because the service
worker is `autoUpdate` + `skipWaiting`, booth devices pick up the rolled-back version on the
next refresh, but an already-open tab needs one manual refresh.

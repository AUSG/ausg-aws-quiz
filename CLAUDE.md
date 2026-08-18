# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
nvm use              # Node 22 (.nvmrc)
npm run dev          # Vite dev server, http://localhost:5173
npm run dev:pages    # production build + local D1 migration + Pages Functions
npm test             # frontend tests
npm run test:worker  # Workers runtime D1/API tests
npm run test:watch
npm run coverage     # v8 coverage; fails below 80% on all four metrics
npm run build        # frontend + worker typecheck, then Vite build
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

A React app for the Codex Community Hackathon community booth: a visitor picks up a tablet,
answers 3 questions by default (admin-configurable from 3 to 5) about AUSG, AWSKRUG, and AUSGCON,
and then spins a goods roulette regardless of score. Static assets run on Cloudflare Pages; public roulette APIs and
`/api/admin/prizes` are Pages Functions backed by D1. PWA caching keeps the quiz itself available after venue wifi drops,
but the roulette intentionally requires a live network connection so inventory stays authoritative.

The booth context drives nearly every design decision, and the reasoning is written into
source comments in Korean. **Read the comment above a function before changing it** — most
of what looks like an arbitrary constraint is a deliberate response to "a stranger uses this
for 30 seconds while standing up."

## Architecture

State flows one direction from `App.tsx` down:

```
App.tsx                 ← quiz + roulette navigation state; fetches D1 question count
 ├─ config.ts           ← D1 default + URL overrides: ?n= ?prize= ?idle= ?kiosk=
 ├─ state/useQuiz.ts    ← wraps quizReducer; the ONLY place randomness happens
 │   └─ state/quizReducer.ts   ← pure reducer + selectors (START/ANSWER/NEXT/RESET)
 ├─ hooks/useIdleReset.ts      ← kiosk hygiene: reset after idle timeout
 ├─ screens/{Start,Quiz,Result}Screen.tsx   ← quiz flow
 ├─ screens/RouletteScreen.tsx             ← inventory, one spin, result animation
 ├─ screens/AdminScreen.tsx                ← /admin client password + prize controls
 ├─ functions/api/{config,prizes,spin}.ts   ← public Pages Functions HTTP boundary
 ├─ functions/api/admin/prizes.ts           ← admin inventory mutations
 ├─ worker/prize-store.ts                   ← D1 inventory + idempotent award logic
 ├─ worker/admin-prize-store.ts             ← add prizes + adjust unclaimed slots
 └─ migrations/{0001,0002,0003,0004}_*.sql  ← stock, settings, distribution, counters
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
- **No category owns question 1.** All six categories are shuffled for every session. The
  default three-question session uses three distinct categories and difficulty slots `1,2,3`;
  admin-selected 4–5 question sessions use the same spread logic.
- **Question count is a D1 booth setting.** `/admin` stores 3–5; the app fetches it from
  `/api/config` before showing Start. `?n=` remains a temporary per-device override.
- **Runtime tuning is also available through URL params.** `?prize=2` changes only the high-score
  result banner; everyone can spin. `?idle=0` disables auto-reset for demos.
- **The server chooses the prize.** The client wheel never uses `Math.random()` for a result.
  `prize-store.ts` uses rejection-sampled `crypto.getRandomValues()` and applies each enabled,
  in-stock prize's integer relative weight (1–100).
- **The public wheel API contains no stock counts or distribution settings.** It returns enabled
  products for display, including sold-out products, but redacts `remaining`, `enabled`, and
  `weight`. Disabled products are hidden. The client repeats products across wheel slices; the
  server alone filters sold-out products from the actual draw.
- **D1 is the stock authority.** Each finite physical item is a numbered stock-slot row, and
  `(prize_code, stock_slot)` is unique in the append-only win log. `attempt_id` is also unique,
  so browser retries replay the stored result without consuming another slot. When every finite
  slot is claimed, the available set contains only unlimited stickers. Admin quantity decreases
  remove only unclaimed slots, so previous wins remain append-only.
- **Live inventory does not require full-log scans.** Public catalog and award candidates read the
  latest D1 rows on every request with `Cache-Control: no-store`. Slot `claimed` state,
  `prize_stock_counts`, and `booth_stats` are updated by the same database write that records or
  removes a win, so dynamic products and quantities stay current without `COUNT(*)` over the win
  log. The `(prize_code, claimed, stock_slot)` index finds the next free slot directly.
- **At least one product stays enabled.** D1 rejects disabling the final enabled product. An
  enabled finite product can still have zero stock, so `/admin` warns when nothing is awardable
  and `/api/spin` returns 409 instead of inventing a result.

## The question bank

Questions live in `src/data/questions.ts` — 38 questions across 6 community categories.
`AUSG 활동`, `AWSKRUG 기본`, `AWSKRUG 활동`, `함께하기`, and `AUSGCON 2026` hold
6 each (difficulty 1/2/3 × 2), so `pickSession`'s difficulty plan is always satisfiable.
`AUSG 기본` holds 8, with **four** introductory questions at difficulty 1 rather than two.
Because category order and difficulty slots are shuffled together across sessions, every bank
question can be selected over repeated plays.

Every real-bank question carries a `sourceUrl` pointing to an official AUSG/AWSKRUG page,
official AWSKRUG Meetup listing, or the official AUSGCON repository. `validateBank` rejects
missing, malformed, or non-HTTPS sources. The `AUSGCON 2026` block is an event-only pack;
after the event, remove both that block and its entry in `CATEGORIES` before redeploying.

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
- Every question must carry a valid HTTPS official-source URL.
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
strings in the question bank; nothing is generated at runtime and no API is called.** Keep the
hint path static so quiz play survives a venue-network outage. The D1-backed roulette is the
only part that requires the network.

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

Vitest + jsdom + Testing Library cover the frontend. A separate Cloudflare Workers Vitest pool
runs the Pages Function and D1 tests against Miniflare with real migrations. The worker suite
must cover stock consumption, idempotent replay, the zero floor, sticker-only fallback,
dynamic prize registration, admin quantity edits, and public stock-count redaction.

## Deploy

Cloudflare Pages is configured by `wrangler.jsonc`; `DB` is the D1 binding. Apply remote
migrations before the first deploy, then run `npm run deploy:pages`. Direct Upload includes the
`functions/` directory automatically. `main.tsx` registers the `autoUpdate` + `skipWaiting`
service worker through `virtual:pwa-register`, so a refresh that discovers a new or rolled-back
build automatically reloads once when the new worker takes control.

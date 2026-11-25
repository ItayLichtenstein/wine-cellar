# Wine Cellar

A web app for managing home wine fridges: a visual map of every shelf and slot, drinking windows at a glance, shared households with real-time sync, and friends who can browse each other's cellars.

> **Status:** stages 1–5 of 8 are built (cellar, households with live sync, multiple fridges with a model catalog, friends and privacy, wishlist). Next: going live, stats, then the MCP server.

## Highlights

- **Visual fridge layout** that matches the real fridge: rows, front/back layers, stacks. Start from a model preset and adjust.
- **Drinking-window colors**: each vintage shows whether it is past its peak, at its peak, or still young.
- **Shared households**: two accounts, one cellar, live updates.
- **Friends and privacy**: friends can browse your cellar; prices stay hidden unless you allow them, per friend.
- **AI through your own assistant**: an MCP server lets your own AI read your cellar and suggest bottles. Every AI change is a draft you approve.
- **Hebrew first**, full right-to-left support, mobile first, installable as a PWA.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Row Level Security, Realtime) · Vercel

## Security model

Authorization is enforced **in the database** with Row Level Security, not in the UI. Each cellar is isolated by composite foreign keys, anonymous users have no grants at all, and email addresses never leave Supabase Auth. Automated pgTAP tests check all of this. See [`docs/security.md`](docs/security.md).

## Engineering notes

- **Authorization lives in Postgres.** Every table has RLS; reads go through helpers like `can_read_cellar()` so a policy is written once. Friends read a cellar, only the household writes, and prices sit in their own table because RLS filters rows, not columns.
- **RLS says what you *may* see; the query says what you *want*.** Once friends exist, every list query filters by cellar, and an architecture test fails the build on one that doesn't ([ADR 0008](docs/decisions/0008-queries-name-their-cellar.md)).
- **Multi-step changes are single transactions** (joining a household with your bottles, accepting a friendship, "we drank it") implemented as `security definer` functions with a pinned `search_path` and their own permission checks.
- **Invite and share tokens**: 32 random bytes, stored only as a SHA-256 hash, carried after `#` so they never reach a server log. Guests without an account have no table access at all; their only door is one function that takes the token.
- **Defense in depth**: CSP and security headers, EXIF stripped from photos in the browser, CSV export escaped against formula injection, CI fails if a server secret ever lands in the browser bundle.
- **Tests**: Vitest for pure logic, pgTAP for every permission rule (160+ database assertions), and CI that also runs a production build.

## Documentation

The docs are written in Hebrew.

| | |
|---|---|
| [`docs/product-spec.md`](docs/product-spec.md) | Product specification |
| [`docs/data-model.md`](docs/data-model.md) | Data model, ERD and permissions matrix |
| [`docs/decisions/`](docs/decisions/) | Architecture Decision Records |
| [`docs/security.md`](docs/security.md) | Security checklist |

## Running locally

Requires Node.js 22, Docker and the Supabase CLI.

```bash
npm install
supabase start        # local Postgres, Auth and Studio in Docker
npm run dev           # http://localhost:3000
npm test              # unit tests (Vitest)
npm run test:db       # database tests (pgTAP)
```

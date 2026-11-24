# Wine Cellar

A web app for managing home wine fridges: a visual map of every shelf and slot, drinking windows at a glance, shared households with real-time sync, and friends who can browse each other's cellars.

> **Status:** in development. The specification and the database layer are done; the UI is next.

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
supabase test db      # database tests
```

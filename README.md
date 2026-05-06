# AB Testing Tool

A self-hosted visual A/B testing platform. Create and run experiments on any web page without modifying source code — point-and-click variant editing, deterministic user bucketing, conversion tracking, and a results dashboard.

## What it does

**Visual editor** — point-and-click DOM editing via a browser-side editor SDK. Select elements, edit text inline, rearrange, hide/show, inject CSS, or replace HTML. Captures desktop and mobile screenshots of each variant.

**11 DOM operation types** — `set_text`, `set_style`, `replace_html`, `insert_html`, `remove`, `move_before`, `move_after`, `modify_class`, `inject_css`, `toggle_visibility`, `set_attribute` — all idempotent and reapplied on each page load.

**Deterministic bucketing** — hash-based variant assignment (DJB2) ensures the same user always gets the same variant. Configurable traffic allocation (run an experiment on any % of users) and weighted splits across variants.

**Exposure and conversion tracking** — session-scoped deduplication prevents double-counting. Supports click goals, pageview goals, and custom goals with optional numeric values.

**GA4 integration** — fires `ab_exposure` and `ab_conversion` custom events directly into GA4 alongside native tracking.

**URL targeting** — wildcard and regex URL rules to control which pages an experiment runs on. Regex presets included.

**Results dashboard** — unique-user conversion rates, uplift vs control, per-goal breakdown, best variant identification, and clickable variant screenshots.

**Multi-backend storage** — SQLite (default), PostgreSQL, in-memory, or flat-file. Swap without changing application logic.

## Architecture

```
apps/
  api/              — Node.js REST API (delivery, events, experiments, results, snapshots)
    store/          — pluggable backends: SQLite, PostgreSQL, memory, file
    routes/         — delivery, events, experiments, results, snapshots, health

packages/
  shared-types/     — TypeScript types and runtime validators shared across packages
  sdk-runtime/      — browser SDK: identity, bucketing, tracking, GA4, QA mode
  sdk-editor/       — visual editor: element selector, inline editing, drag-drop, snapshots
  dom-operations/   — idempotent DOM operation executor (11 operation types)
```

## Stack

TypeScript monorepo · Node.js API · SQLite / PostgreSQL · Browser SDK (no framework dependency)

## Getting started

```bash
npm install
# Start the API (SQLite by default)
npm run dev --workspace=apps/api
```

The SDK packages are consumed by the browser-side snippet embedded in target pages.

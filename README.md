# AB Testing Tool

A self-hosted visual A/B testing platform. Create experiments on any web page by pointing and clicking — no changes to your source code required. The server handles experiment delivery and data collection; a small script on your page applies variants and tracks users.

---

## How it works

1. **You create an experiment** in the dashboard — pick a page URL, use the visual editor to make changes (edit text, restyle elements, hide/show things, rearrange content), and set what counts as a conversion (a click, a page visit, or a custom event).
2. **The script on your page** calls the server on load, gets assigned to a variant (deterministically — the same user always sees the same variant), and the changes are applied instantly to the DOM before the user sees the page.
3. **Exposures and conversions are sent back** to the server automatically. The results dashboard shows you how each variant is performing.

---

## Setup

### 1. Start the server

```bash
npm install
npm run dev --workspace=apps/api
```

The server runs on `http://localhost:4000` by default. Change the port with the `PORT` environment variable.

**Storage:** By default it uses SQLite and stores data in a local `.db` file — no database setup needed. To use PostgreSQL instead, set `DATABASE_URL` in your environment. In-memory and flat-file options are also available for testing.

**API key auth:** By default, anyone can read and write experiments (fine for local use). To lock down the experiment management endpoints, set an `API_KEY` environment variable. The delivery and event endpoints remain open so your pages can call them without exposing a key.

### 2. Open the dashboard

Go to `http://localhost:4000/dashboard/` to create and manage experiments.

---

## Installing the SDK on your pages

The SDK is a small script that runs on your website. It calls the server, assigns the user to a variant, applies the visual changes, and tracks exposures. There are two ways to install it.

### Option A: Direct script tag

Add this to the `<head>` of every page you want to run experiments on:

```html
<script src="http://your-server/dist/sdk-runtime.iife.js"></script>
<script>
  ABTesting.initializeRuntime({
    apiBaseUrl: "http://your-server",
    projectId: "my-site"
  });
</script>
```

**When to use this:** You have access to your page templates or source code. This is the simplest and most reliable option — the script loads early and applies variants before the page is visible, so users don't see a flash of the original content.

**Trade-offs:**
- Requires a code deploy to install or update
- If your server is slow or down, the script call adds a small delay to page load
- Best to load it as early in `<head>` as possible to minimise flicker

---

### Option B: Google Tag Manager

In GTM, create a new **Custom HTML tag** with this content:

```html
<script src="http://your-server/dist/sdk-runtime.iife.js"></script>
<script>
  ABTesting.initializeRuntime({
    apiBaseUrl: "http://your-server",
    projectId: "my-site"
  });
</script>
```

Set the trigger to **All Pages** and publish.

**When to use this:** You don't have direct access to the page code, or you want to manage experiments without involving engineering. GTM lets you turn experiments on and off, change targeting, and push updates without a code deploy.

**Trade-offs:**
- GTM loads asynchronously, which means there's a higher chance of a visible flicker — the original page appears briefly before the variant is applied
- GTM itself must load before the SDK loads, adding an extra round-trip
- Works fine for most text, style, and layout changes; not ideal for experiments where flicker would be very noticeable (e.g. above-the-fold hero swaps)
- You can reduce flicker by adding a short CSS hide on body that the SDK removes once it has applied variants

---

## All features

### Visual editor

Open the dashboard, create an experiment, and click **Open Editor**. The editor loads your target page inside a proxy — it fetches the page server-side and injects the editor SDK, so you can edit any page regardless of its origin or framework.

In the editor you can:
- **Click any element** to select it
- **Edit text inline** — double-click to type directly on the page
- **Drag and drop elements** to rearrange them
- **Apply style changes** — fonts, colours, spacing, visibility
- **Insert, replace, or remove HTML** at any position
- **Inject custom CSS** that applies only to this variant
- **Add or remove CSS classes** on any element
- **Set element attributes** (e.g. change a link's `href`, an image's `src`)

Every change is recorded as an operation. When a user visits the page and is assigned to this variant, all operations are replayed on the live DOM.

### Variants and traffic

Each experiment has at least two variants: a **control** (the original page, unchanged) and one or more **test variants**. You set:

- **Traffic allocation** — what percentage of total visitors enter the experiment at all (e.g. 50% means half your visitors are excluded entirely and see the original page)
- **Variant weights** — how traffic is split between variants (e.g. 50/50, or 70/30)

Assignment is deterministic: a hash of the user's ID and the experiment ID decides which bucket they fall into. The same user always sees the same variant across sessions.

### Goals and conversion tracking

You define what counts as a success for each experiment. Three goal types are supported:

- **Click goal** — fires when a user clicks a specific element (you provide a CSS selector). Automatically wired up; no extra code needed.
- **Pageview goal** — fires when a user visits a specific URL or URL pattern after being exposed to the experiment.
- **Custom goal** — fires when you call `runtime.trackConversion(experimentId, variantId, goalId)` from your own code. Use this for form submissions, API calls, or anything that doesn't fit a click or pageview.

Conversions can include an optional numeric value (e.g. order amount).

### QA mode

To force yourself into a specific variant for testing without affecting real data, add `?ab_qa=experimentId:variantId` to the URL:

```
https://mysite.com/pricing?ab_qa=exp_123:variant_a
```

You can stack multiple overrides:

```
?ab_qa=exp_123:variant_a&ab_qa=exp_456:control
```

In QA mode, exposures and conversions are not recorded, so test visits don't pollute your results.

### Single-page app (SPA) support

If your site is a React, Vue, or similar SPA that changes content on navigation without a full page reload, the SDK automatically re-applies variant operations after route changes. This is on by default. If you need to disable it:

```js
ABTesting.initializeRuntime({
  apiBaseUrl: "http://your-server",
  projectId: "my-site",
  spaReapply: false
});
```

### Variant screenshots

When you finish editing a variant, the editor captures a screenshot of how the page looks with that variant applied (desktop and mobile). Screenshots appear in the results dashboard alongside the numbers so you can immediately see what each variant looked like.

---

## Analytics

### Built-in results dashboard

Go to `http://your-server/dashboard/results` to see all experiments and their results:

- **Exposures** — unique users who were assigned to each variant
- **Conversions** — unique users who converted, broken down by variant and goal
- **Conversion rate** — conversions ÷ exposures per variant
- **Uplift vs control** — how much better or worse each test variant is performing compared to the control, as a percentage

Results update in real time as events come in.

### GA4 integration

If you use Google Analytics 4, you can pipe experiment data into GA4 alongside your existing tracking. Pass your Measurement ID when initialising:

```js
ABTesting.initializeRuntime({
  apiBaseUrl: "http://your-server",
  projectId: "my-site",
  ga4MeasurementId: "G-XXXXXXXXXX"
});
```

This fires two custom events into GA4:

- `ab_exposure` — when a user is assigned to a variant. Includes `experiment_id`, `experiment_name`, `variant_id`, `variant_name`.
- `ab_conversion` — when a user converts on a goal. Includes `experiment_id`, `variant_id`, `goal_id`, and optionally `value`.

You can then build segments, funnels, and custom reports in GA4 using these event parameters — useful if you want to combine A/B test data with the rest of your GA4 analytics.

---

## API reference

The server exposes a REST API. Experiment management endpoints require the `X-API-Key` header if `API_KEY` is set.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/v1/delivery?projectId=&pageUrl=` | Get active experiments for a page (used by SDK) |
| `POST` | `/v1/events` | Ingest exposure and conversion events (used by SDK) |
| `GET` | `/v1/experiments` | List all experiments |
| `POST` | `/v1/experiments` | Create an experiment |
| `GET` | `/v1/experiments/:id` | Get one experiment |
| `PUT` | `/v1/experiments/:id` | Update an experiment |
| `DELETE` | `/v1/experiments/:id` | Delete an experiment |
| `GET` | `/v1/results` | List results for all experiments |
| `GET` | `/v1/results/:id` | Detailed results for one experiment |
| `POST` | `/v1/experiments/:id/snapshots` | Upload a variant screenshot |

---

## Project structure

```
apps/
  api/          — Node.js server (API + dashboard + editor proxy)
  dashboard/    — Dashboard UI (experiment list, editor, results)

packages/
  shared-types/     — TypeScript types shared across packages
  sdk-runtime/      — Browser SDK (bucketing, tracking, GA4, SPA reapply)
  sdk-editor/       — Visual editor (element selector, inline edit, drag-drop, snapshots)
  dom-operations/   — DOM operation executor (11 operation types, idempotent)
```

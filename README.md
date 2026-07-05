# Border Walk

A free daily geography puzzle: walk from a start country to a target country by
hopping only between land-bordering nations. Fewer hops = higher score. See
`CLAUDE.md` (untracked, local-only) for product principles and locked decisions.

Live at https://border-walk.vksub.workers.dev/ — deployed as a Cloudflare Worker,
git-linked to this repo (Cloudflare builds and deploys automatically on push,
using `wrangler.toml`).

## Layout
- `public/index.html`, `public/data.js` — the game (static, no build step).
- `wrangler.toml` — Worker config: serves `public/` as static assets and routes
  `/vote`, `/complete`, `/stats` to the Worker script below.
- `src/worker.js` — anonymous feedback/completion counters, stored in Workers KV.

## One-time setup: KV namespace
The Worker needs a KV namespace bound as `FEEDBACK_KV` before it will deploy or
run correctly. Do this once, **before merging any branch that touches
`wrangler.toml` into `main`** (a merge triggers a real Cloudflare build):

**Dashboard path:**
1. Cloudflare dashboard → Workers & Pages → KV → Create a namespace (e.g. `border-walk-feedback`).
2. Open the `border-walk` Worker → Settings → Bindings → Add binding → KV namespace.
   Variable name: `FEEDBACK_KV`. Select the namespace you just created.

**CLI path (equivalent, useful for local dev too):**
```
npx wrangler kv namespace create FEEDBACK_KV
```
Copy the returned `id` into `wrangler.toml`'s `[[kv_namespaces]]` block,
replacing the `REPLACE_ME_WITH_REAL_KV_NAMESPACE_ID` placeholder.

## Local development
```
npx wrangler dev
```
Runs the Worker (and static assets) locally with a local KV simulation — no
Cloudflare login needed for this. Play the game, tap the 👍/👎 feedback
buttons, and finish/give-up a puzzle to generate local KV entries.

## Checking numbers
```
GET /stats?day=<N>
```
e.g. `http://localhost:8787/stats?day=14` locally, or
`https://border-walk.vksub.workers.dev/stats?day=14` in production. Returns:
```json
{
  "day": 14,
  "votes": { "up": 3, "down": 1 },
  "plays": 20,
  "wins": 15,
  "dnf": 5,
  "avgScore": 78.4,
  "avgHops": 5.2,
  "avgHints": 0.3
}
```
`day` is the puzzle's daily number (shown in the UI as "DAILY #N"), not a date.
Averages are `null` until at least one completion is recorded for that day.

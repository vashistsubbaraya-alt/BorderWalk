// Anonymous, aggregate feedback counters for the daily puzzle. One JSON blob
// per day number in KV — no personal data, no IDs, no per-player rows.
// Note: KV has no atomic increment, so concurrent requests to the same day's
// key can race and lose an update. Accepted for this game's traffic (see
// ticket v0.4 — "de-dupe casually, not perfectly").

const EMPTY_DAY = { up: 0, down: 0, plays: 0, wins: 0, dnf: 0, scoreSum: 0, hopsSum: 0, hintsSum: 0 };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

async function readDay(env, day) {
  const raw = await env.FEEDBACK_KV.get(`day:${day}`, 'json');
  return raw || { ...EMPTY_DAY };
}

async function writeDay(env, day, record) {
  await env.FEEDBACK_KV.put(`day:${day}`, JSON.stringify(record));
}

async function handleVote(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const { day, vote } = body || {};
  if (!isPositiveInt(day) || (vote !== 'up' && vote !== 'down')) {
    return json({ error: 'invalid vote payload' }, 400);
  }
  const record = await readDay(env, day);
  record[vote]++;
  await writeDay(env, day, record);
  return json({ ok: true });
}

async function handleComplete(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const { day, won, hops, score, hints } = body || {};
  if (!isPositiveInt(day) || typeof won !== 'boolean'
    || !Number.isInteger(hops) || hops < 0
    || !Number.isInteger(score) || score < 0
    || !Number.isInteger(hints) || hints < 0) {
    return json({ error: 'invalid completion payload' }, 400);
  }
  const record = await readDay(env, day);
  record.plays++;
  if (won) record.wins++; else record.dnf++;
  record.scoreSum += score;
  record.hopsSum += hops;
  record.hintsSum += hints;
  await writeDay(env, day, record);
  return json({ ok: true });
}

async function handleStats(request, env) {
  const day = Number(new URL(request.url).searchParams.get('day'));
  if (!isPositiveInt(day)) return json({ error: 'invalid day' }, 400);
  const r = await readDay(env, day);
  const avg = (sum) => r.plays ? Math.round((sum / r.plays) * 10) / 10 : null;
  return json({
    day,
    votes: { up: r.up, down: r.down },
    plays: r.plays,
    wins: r.wins,
    dnf: r.dnf,
    avgScore: avg(r.scoreSum),
    avgHops: avg(r.hopsSum),
    avgHints: avg(r.hintsSum),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/vote') return handleVote(request, env);
    if (request.method === 'POST' && url.pathname === '/complete') return handleComplete(request, env);
    if (request.method === 'GET' && url.pathname === '/stats') return handleStats(request, env);
    return env.ASSETS.fetch(request);
  },
};

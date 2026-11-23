#!/usr/bin/env node
/**
 * ============================================================================
 * LIVE SMOKE — full-stack proof the game is truly playable (W4)
 * ============================================================================
 * Plain Node, no browser. Drives one REAL match end-to-end through sockets and
 * REST: auth + RoomManager + rules-engine + grantMatchRewards + Mongo + the
 * public read surfaces, all asserted against @liars-game/shared.
 *
 * USAGE
 *   1. boot the game server (repo root) — listening on the PORT from the root
 *      env file (default :3001) with Mongo reachable, e.g.:
 *        npm run dev -w apps/server
 *   2. run the smoke:
 *        cd apps/web && node scripts/live-smoke.mjs
 *   (SMOKE_VERBOSE=1 prints every passing check; defaults print failures only)
 *   (SMOKE_SCENARIO picks a scenario below; default is the full match)
 *
 * SCENARIOS (SMOKE_SCENARIO env flag — every scenario keeps the §numbering /
 * [PASS] report + exit codes)
 *   full    (default) — the 8-section full match described below.
 *   window  — 5 seated players (open-window tier): live arm-delay rejection
 *             (ERR_WINDOW_NOT_ARMED), a post-arm CHECK closing the window
 *             {liar_called}, and a reconnect MID-WINDOW (seat held by grace,
 *             catch-up snapshot carries the open challengeWindow + hand).
 *   bots    — bot-fill is programmatic-only by design (S1/STR/02: no wire or
 *             REST surface exists, and none may be invented — AGENTS.md rule
 *             4), so a client cannot mint a bot seat. This scenario asserts
 *             that closed surface live (socket probe + REST probes + the
 *             8-event client catalog), then runs the closest live equivalent
 *             — a full 2-human match to game:over — and verifies the
 *             rewards/leaderboard immunity that holds for bot accounts: only
 *             real ObjectId accounts ever appear on the leaderboard (bot
 *             ids `bot:<roomCode>:<seat>` fail the grant's ObjectId gate and
 *             can never accrue XP).
 *   abandon — 2p disconnect-abandon: both seated humans drop mid-turn, the
 *             earlier dropper's grace expiry ABANDONs → abort → the later
 *             dropper wins by default with the 0-round record (abort before
 *             any roulette). Rewards: winner XP > 0, abandoner 0 — then
 *             /api/me + leaderboard prove the zero-round rewards path.
 *
 * JOIN-RATE BUDGET (server: 10 join attempts / IP / 10 min): full=4 ·
 * window=5 · bots=1 · abandon=2. Sequential runs fit one bucket together;
 * restart the server process between heavy runs if RATE_LIMITED appears.
 *
 * ENV
 *   AUTH_SECRET + MONGODB_URI + MONGODB_DB (+ optional PORT, CLIENT_ORIGIN) are
 *   read from the process environment, else by walking up from the CWD to
 *   `.env.local` (falling back to `.env`) exactly like the shared config
 *   loader. KEY NAMES only are ever printed — never values.
 *
 * SCENARIO (4 sockets: three players + one spectator)
 *   §1 env + users: upserts the test rows (google-providerId keyed per run)
 *      and mints short-lived HS256 `lg_session` cookies — the cookie the
 *      socket/REST middleware contract reads.
 *   §2 the room: host A room:create (public, capacity 3) → B, C join seated
 *      → D joins the FULL room → spectator ack (spectator:true, yourSeat:null).
 *   §3 lobby: real lobby:state snapshots — seats, nicknames, host crown,
 *      presence dots, counts-only hands, spectator null-you.
 *   §4 the match: host game:start (3 seated humans — the ≥2-seated minimum
 *      path; bot-fill has NO wire event, programmatic-only per S1, so it is
 *      unreachable from a client), then every turn:begin for A/B/C is answered
 *      with a 1–2 card play:cards or a liar:call on the previous throw
 *      (legality enforced by the engine; rejections fall back to a play). C
 *      drops + rejoins MID-MATCH: the raw join ack must carry reconnected:true
 *      and a non-lobby catch-up snapshot must restore C's seat + hand.
 *   §5 per-event: every payload parses against serverEventSchemas (strict
 *      zod — any smuggled rank or chamber field fails LOUDLY); no payload
 *      mentions bulletPos; seq monotonic per socket.
 *   §6 privacy (STR/07 §3): spectator receives NO hand:deal ever and no rank
 *      field outside reveal:show; no hidden-hand card id ever reaches
 *      another client (or the spectator) outside reveal:show — the single
 *      face-leak event.
 *   §7 REST while live: GET /api/rooms shows the room mid-match (capacity,
 *      seatsTaken, host nickname).
 *   §8 economy chain: game:over carrier (winnerSeat + matchRecord + rewards),
 *      then GET /api/me shows each player's XP grew (grantMatchRewards wrote
 *      Mongo) and GET /api/leaderboard?metric=xp lists the three test users
 *      with value > 0.
 *
 * NOTES FOR THE MARKING PASS
 *   - 2-player minimum: covered via 3 joined humans (see §4).
 *   - Join rate limit: 10/IP/10min server-side; this run makes 4 join
 *     attempts (B, C, D, C's reconnect). Restart the server process between
 *     smoke runs — a third run against the SAME process would start
 *     bouncing RATE_LIMITED.
 *   - The match may take a couple of minutes: roulette pacing runs at the
 *     production values (~7.4s/round) and revolvers are honest (1-in-6).
 *
 * Exit 0 = all sections green; exit 1 = any check failed (summary printed).
 * ============================================================================
 */

import { createHmac, randomInt as cryptoRandomInt } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sioPkg from 'socket.io-client';
import jwtPkg from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import { serverEventSchemas, clientEventSchemas } from '@liars-game/shared';

const { io } = sioPkg;
const jwt = jwtPkg;

// ── server-contract constants (apps/server/src/middleware/auth.ts, STR/07) ──
const SESSION_COOKIE = 'lg_session';
const ROOM_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
const SESSION_TTL_SECONDS = 15 * 60;
const MATCH_DEADLINE_MS = 240_000;
const WATCHDOG_MS_BY_SCENARIO = {
  full: 330_000,
  window: 300_000,
  bots: 600_000,
  abandon: 420_000,
};
const SCENARIO = (process.env.SMOKE_SCENARIO || 'full').toLowerCase().trim();
const WATCHDOG_MS = WATCHDOG_MS_BY_SCENARIO[SCENARIO] ?? 330_000;
const ACK_TIMEOUT_MS = 15_000;
const RETRY_MS = 1_000;

// ───────────────────────── check registry ───────────────────────────────────

const sections = [];
let current = null;

function section(name) {
  current = { name, pass: 0, fail: [] };
  sections.push(current);
}
const ok = (detail) => {
  current.pass += 1;
  if (process.env.SMOKE_VERBOSE) console.log(`    + ${detail}`);
};
const bad = (detail) => {
  current.fail.push(detail);
  console.log(`    ! FAIL ${detail}`);
};
function check(cond, passDetail, failDetail) {
  if (cond) {
    ok(passDetail);
    return true;
  }
  bad(failDetail ?? passDetail);
  return false;
}

// ───────────────────────── env resolution (shared loader walk-up) ───────────

function findEnvFile(startDir, fileName) {
  let dir = resolve(startDir);
  for (let i = 0; i < 8 && dir; i += 1) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function parseEnvFile(path) {
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  const file = process.env.LIARS_ENV_FILE || findEnvFile(process.cwd(), '.env.local') || findEnvFile(process.cwd(), '.env');
  const fileEnv = file ? parseEnvFile(file) : {};
  const get = (k) => (process.env[k]?.length > 0 ? process.env[k] : fileEnv[k]);
  console.log(`[env] ${file ? `walking up found ${file} (values never printed)` : 'real environment only'}`);
  return {
    authSecret: get('AUTH_SECRET'),
    mongoUri: get('MONGODB_URI'),
    mongoDb: get('MONGODB_DB'),
    port: Number(get('PORT') || '3001'),
    origin: get('CLIENT_ORIGIN') || get('APP_URL') || 'http://localhost:3000',
  };
}

const ENV = loadEnv();
if (!ENV.authSecret || !ENV.mongoUri || !ENV.mongoDb) {
  const missing = [
    ['AUTH_SECRET', ENV.authSecret],
    ['MONGODB_URI', ENV.mongoUri],
    ['MONGODB_DB', ENV.mongoDb],
  ].filter(([, v]) => !v);
  console.error(`[env] missing required keys: ${missing.map(([k]) => k).join(', ')} (names only, never values)`);
  process.exit(1);
}
const BASE = `http://127.0.0.1:${ENV.port}`;

// ───────────────────────── tiny utils ───────────────────────────────────────

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const b64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');

/** HS256 JWT exactly like the server's signSessionToken — crypto port only. */
function mintSessionCookie(userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(header)}.${b64url({ sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS })}`;
  const sig = createHmac('sha256', ENV.authSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

async function rest(method, path, { cookie } = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Origin: ENV.origin, ...(cookie ? { Cookie: `${SESSION_COOKIE}=${cookie}` } : {}) },
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: null, err: String(err?.cause ?? err?.message ?? err) };
  }
}

/** Poll `predicate` (sync or async) until it returns truthy or the deadline. */
async function waitFor(predicate, timeoutMs, label) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await predicate();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timeout waiting for ${label}`);
    await sleep(120);
  }
}

// ───────────────────────── client with per-event tripwires ──────────────────

/**
 * One socket + everything it ever heard. Every payload is schema- + seq- +
 * chamber-checked the instant it lands; raw events are kept for the post-match
 * privacy scan (§6).
 */
function makeClient(label, token) {
  const socket = io(BASE, {
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: ENV.origin },
  });
  const client = {
    label,
    socket,
    events: [], // { event, payload, round }
    snapshot: null,
    lastSeq: -1,
    handDealtIdsByRound: {},
    gameOver: null,
    roundMark: 0,
    dead: false,
    hand: [],
    busy: false,
    mySeat: null,
    isSpectator: false,
    lastPlay: null,
  };

  socket.onAny((event, payload) => {
    if (!Object.prototype.hasOwnProperty.call(serverEventSchemas, event)) return;
    const parsed = serverEventSchemas[event].safeParse(payload);
    if (!parsed.success) {
      bad(`${label}: ${event} payload FAILED shared schema validation (${parsed.error?.issues?.[0]?.message ?? 'zod'})`);
      return;
    }
    const data = parsed.data;

    // §5 monotonic seq — snapshots AND direct `error` replies may replay the
    // current counter unchanged (they are not room deltas — same carve-out as
    // the server test-suite audit, STR/07 §4); every broadcast delta must
    // strictly advance past the last seen value.
    const seq = Number.isInteger(data.seq) ? data.seq : -1;
    if (client.lastSeq !== -1) {
      if (seq < client.lastSeq) bad(`${label}: seq went backwards on ${event} (${client.lastSeq} → ${seq})`);
      else if (seq === client.lastSeq && event !== 'lobby:state' && event !== 'error') bad(`${label}: seq did not advance on ${event} (stuck at ${seq})`);
    }
    client.lastSeq = Math.max(client.lastSeq, seq);

    // §5 no chamber state may EVER be named on the wire (strict zod already
    // rejects unknown fields — this substring scan is the redundant tripwire)
    const raw = JSON.stringify(data);
    if (raw.includes('bulletPos') || raw.includes('"chamber"')) {
      bad(`${label}: ${event} payload mentions forbidden chamber state`);
    }

    if (event === 'round:new') {
      client.roundMark = data.roundNo;
      client.lastPlay = null; // fresh pile — the first play cannot be challenged
    }
    client.events.push({ event, payload: data, round: client.roundMark });

    if (event === 'lobby:state') client.snapshot = data;
    if (event === 'hand:deal') {
      const ids = data.cards.map((c) => c.id);
      client.hand = data.cards;
      client.handDealtIdsByRound[client.roundMark] = [
        ...(client.handDealtIdsByRound[client.roundMark] ?? []),
        ...ids,
      ];
    }
    if (event === 'play:accept') client.lastPlay = { seat: data.seat, count: data.count };
    if (event === 'game:over') client.gameOver = data;
  });

  client.connect = () =>
    new Promise((res, rej) => {
      // generous ceiling: dev machines under parallel agent load can stretch
      // the five-handshake bursts (normally <1s) well past the default 10s
      const timer = setTimeout(() => rej(new Error(`${label}: socket connect timeout`)), 25_000);
      socket.once('connect', () => { clearTimeout(timer); res(); });
      socket.once('connect_error', (err) => { clearTimeout(timer); rej(new Error(`${label}: connect_error ${err?.message}`)); });
    });

  client.emitAck = (event, payload) =>
    new Promise((res) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, ack) => {
        res(err ? { ok: false, error: { code: 'ACK_TIMEOUT', message: String(err) } } : ack);
      });
    });

  client.disconnect = () => {
    if (client.dead) return;
    client.dead = true;
    client.socket.removeAllListeners();
    client.socket.disconnect();
  };

  return client;
}

/** The scripted brain: on my turns, throw cards or call LIAR on the previous throw. */
async function actOnTurn(client) {
  if (client.busy || client.dead || !client.socket.connected) return;
  client.busy = true;
  try {
    await sleep(250);
    const last = client.lastPlay;
    if (last && last.seat !== client.mySeat && cryptoRandomInt(0, 100) < 60) {
      const ack = await client.emitAck('liar:call', { accusedSeat: last.seat });
      if (ack.ok) return;
      // legality lost the race (first-wins / not-armed) → fall through and play
    }
    if (client.hand.length === 0) return; // empty hand: the engine will hand the
    // turn to a holder, and holders==1 auto-calls Liar — no action needed from us
    const cardIds = client.hand.slice(0, Math.min(client.hand.length, 1 + cryptoRandomInt(0, 1))).map((c) => c.id);
    const ack = await client.emitAck('play:cards', { cardIds });
    if (ack.ok) client.hand = client.hand.filter((c) => !cardIds.includes(c.id));
    else if (client.hand.length > 0) {
      const retry = await client.emitAck('play:cards', { cardIds: [client.hand[0].id] });
      if (retry.ok) client.hand = client.hand.slice(1);
    }
  } catch {
    // a rejected action never mutates server state — the next turn:begin re-hears us
  } finally {
    client.busy = false;
  }
}

function wireActor(client) {
  client.socket.on('turn:begin', (payload) => {
    if (Number(payload?.seat) === client.mySeat && !client.dead) {
      setTimeout(() => void actOnTurn(client), 0);
    }
  });
}

/**
 * Open-window-scenario actor: acts only PAST the production 2s arm delay
 * (default 2.6s), so challenge windows stay open long enough for the
 * scenario's probes + a mid-window reconnect to observe them live.
 */
function wireWindowActor(client, delayMs = 2_600) {
  client.socket.on('turn:begin', (payload) => {
    if (Number(payload?.seat) === client.mySeat && !client.dead) {
      setTimeout(() => void actOnTurn(client), delayMs);
    }
  });
}

/** Most-recent payload of one event name on a live client (or undefined). */
function lastEvent(client, name) {
  for (let i = client.events.length - 1; i >= 0; i -= 1) {
    if (client.events[i].event === name) return client.events[i].payload;
  }
  return undefined;
}

/** Emits `event` expecting NO listener: resolves {unhandled:true} only when the ack never comes. */
function emitProbeUnhandled(socket, event, payload, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err, ack) => {
      resolve(err ? { unhandled: true } : { unhandled: false, ack });
    });
  });
}

// ───────────────────────── §6 privacy scanner ────────────────────────────────

/**
 * Per round: hidden pool = every id dealt to ANY player that round, minus ids
 * already revealed that round. For each event a client received — except its
 * own hand:deal (the sanctioned private channel) and reveal:show (the single
 * face-leak event) — NO hidden id of another live hand may appear, and a
 * spectator may see none at all. Ids are quoted-json matched so `K1` never
 * substring-collides with `K12`. Own you.hand inside own snapshots is the
 * only sanctioned place a player's own ids may appear.
 */
function privacyScan(poolContributors, viewers) {
  const poolByRound = {};
  for (const c of poolContributors) {
    for (const [round, ids] of Object.entries(c.handDealtIdsByRound)) {
      poolByRound[round] = new Set([...(poolByRound[round] ?? []), ...ids]);
    }
  }

  for (const viewer of viewers) {
    const ownDealt = new Set(Object.values(viewer.handDealtIdsByRound).flat());
    const revealed = {};
    let leaks = 0;
    for (const e of viewer.events) {
      if (e.event === 'reveal:show') {
        for (const c of e.payload.cards) (revealed[e.round] ??= new Set()).add(c.id);
        continue;
      }
      if (e.event === 'hand:deal') continue;
      const pool = poolByRound[e.round];
      if (!pool || pool.size === 0) continue;
      const hidden = [...pool].filter((id) => {
        if (revealed[e.round]?.has(id)) return false; // already face-up this round
        if (e.event === 'lobby:state' && !viewer.isSpectator && ownDealt.has(id)) return false; // own you.hand
        return true;
      });
      if (hidden.length === 0) continue;
      const raw = JSON.stringify(e.payload);
      for (const id of hidden) {
        if (raw.includes(`"${id}"`)) {
          leaks += 1;
          bad(`${viewer.label}: hidden card id ${id} reached ${e.event} (round ${e.round}) outside reveal:show`);
          break;
        }
      }
    }
    if (leaks === 0) {
      ok(`${viewer.label}: zero hidden-hand ids outside reveal:show across ${viewer.events.length} received events`);
    }
  }
}

// ───────────────────────── runner ────────────────────────────────────────────

let done = false;
function summarize() {
  console.log('');
  let allPass = true;
  let totalOk = 0;
  let totalFail = 0;
  for (const s of sections) {
    totalOk += s.pass;
    totalFail += s.fail.length;
    if (s.fail.length > 0) allPass = false;
    const state = s.fail.length === 0 ? 'PASS' : 'FAIL';
    console.log(`  [${state}] ${s.name} — ${s.pass} ok${s.fail.length ? `, ${s.fail.length} FAILED` : ''}`);
  }
  console.log(
    allPass
      ? `\nSMOKE: ${sections.length}/${sections.length} sections PASS — ${totalOk} checks, 0 failures`
      : `\nSMOKE: FAILED — ${totalFail} check(s) failed (of ${totalOk} that passed)`,
  );
  return allPass ? 0 : 1;
}

function finish(forceCode) {
  if (done) process.exit(forceCode ?? 1);
  done = true;
  const code = summarize();
  process.exit(forceCode !== undefined ? forceCode : code);
}

const watchdog = setTimeout(() => {
  console.error('\n[watchdog] hard timeout — aborting');
  bad('watchdog timeout');
  finish(1);
}, WATCHDOG_MS);
watchdog.unref?.();

main()
  .then(() => finish())
  .catch((err) => {
    console.error(`[smoke] fatal: ${err?.stack ?? err}`);
    if (current) bad(`fatal: ${err?.message ?? err}`);
    finish(1);
  });

// ───────────────────────── THE SCENARIOS ─────────────────────────────────────

async function runFullScenario() {
  // nickname set pinned to the full-match scenario (§2–§8 reference these)
  const NICK = { A: 'SMOKE-A', B: 'SMOKE-B', C: 'SMOKE-C', D: 'SMOKE-D' };
  // §1 — env + fake users + session minting ────────────────────────────────
  section('§1 env + fake users + session cookies');

  const health = await rest('GET', '/api/health');
  const up = check(health.status === 200 && health.body?.ok === true, `game server up on :${ENV.port} (/api/health)`, `no server on ${BASE} — boot apps/server first (status ${health.status})`);
  if (!up) {
    bad('aborting: the remaining sections need the live server (§5+ need REAL sockets)');
    return;
  }

  const runId = `${Date.now().toString(36)}${cryptoRandomInt(0, 999)}`;
  const mongo = new MongoClient(ENV.mongoUri, { serverSelectionTimeoutMS: 8_000 });
  await mongo.connect();
  await mongo.db(ENV.mongoDb).command({ ping: 1 });
  ok('Mongo reachable (db name checked, never printed)');

  const usersCollection = mongo.db(ENV.mongoDb).collection('users');
  const mintUser = async (tag, nickname) => {
    const doc = await usersCollection.findOneAndUpdate(
      { provider: 'google', providerId: `liars-smoke-${runId}-${tag}` },
      {
        $set: { name: nickname, lastSeenAt: new Date() },
        $setOnInsert: {
          nickname,
          avatarSpec: { base: 'default' },
          xp: 0,
          level: 1,
          banned: false,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { id: String(doc._id), nickname };
  };
  const userA = await mintUser('a', NICK.A);
  const userB = await mintUser('b', NICK.B);
  const userC = await mintUser('c', NICK.C);
  const userD = await mintUser('d', NICK.D);
  ok(`4 fake test users upserted (${userA.nickname}, ${userB.nickname}, ${userC.nickname} + spectator ${userD.nickname})`);

  const cookieA = mintSessionCookie(userA.id);
  try {
    check(jwt.verify(cookieA, ENV.authSecret).sub === userA.id, 'short-lived HS256 lg_session cookie mints + verifies against AUTH_SECRET', 'session cookie did NOT verify against AUTH_SECRET');
  } catch (err) {
    bad(`session cookie verify threw: ${err?.message}`);
  }

  // §2 — real sockets: create, joins, spectator ─────────────────────────────
  section('§2 real sockets — room:create, room:join x3, spectator');

  const A = makeClient('A', cookieA);
  const B = makeClient('B', mintSessionCookie(userB.id));
  const C = makeClient('C', mintSessionCookie(userC.id));
  const D = makeClient('D', mintSessionCookie(userD.id));

  let connects = 0;
  for (const c of [A, B, C, D]) {
    try {
      await c.connect();
      connects += 1;
    } catch (err) {
      bad(err.message);
    }
  }
  check(connects === 4, '4 socket.io handshakes over websocket carrying session cookies');

  const createAck = await A.emitAck('room:create', {
    name: `SMOKE TABLE ${runId.slice(-3)}`,
    capacity: 3,
    theme: 'saloon',
    visibility: 'public',
  });
  if (!check(createAck?.ok === true, 'host room:create ack ok (capacity 3, public)', `room:create ack failed: ${JSON.stringify(createAck)}`)) {
    throw new Error('cannot smoke without a room');
  }
  const roomCode = createAck.data.roomCode;
  check(ROOM_CODE_RE.test(roomCode), `room code minted from the 31-char set (${roomCode})`);

  const ackB = await B.emitAck('room:join', { code: roomCode });
  const ackC = await C.emitAck('room:join', { code: roomCode });
  const ackD = await D.emitAck('room:join', { code: roomCode });
  check(ackB?.ok === true && ackB.data.spectator === false && ackB.data.yourSeat === 1, 'B joins seated at seat 1', `B join ack: ${JSON.stringify(ackB)}`);
  check(ackC?.ok === true && ackC.data.spectator === false && ackC.data.yourSeat === 2, 'C joins seated at seat 2', `C join ack: ${JSON.stringify(ackC)}`);
  check(ackD?.ok === true && ackD.data.spectator === true && ackD.data.yourSeat === null, 'D joins the FULL room as spectator (spectator:true, yourSeat:null)', `D join ack: ${JSON.stringify(ackD)}`);
  A.mySeat = 0;
  B.mySeat = ackB?.data?.yourSeat ?? 1;
  C.mySeat = ackC?.data?.yourSeat ?? 2;
  D.isSpectator = true;

  // §3 — real lobby snapshots ──────────────────────────────────────────────
  section('§3 lobby:state contract (seats, nicknames, host crown, presence, counts)');

  const awaitSeats = (client) =>
    waitFor(
      () => {
        const s = client.snapshot;
        if (!s || s.roomCode !== roomCode) return false;
        return s.seats.filter((x) => x.nickname).length >= 3 ? s : false;
      },
      5_000,
      `${client.label} 3-seat snapshot`,
    );
  const snapA = await awaitSeats(A);
  const snapD = await awaitSeats(D);

  ok(`A holds a fresh lobby:state (seq ${snapA.seq})`);
  check(snapA.seats.length === 3, 'seats array spans the capacity (ViewPlayerState per seat)');
  check(
    snapA.seats[0].nickname === NICK.A && snapA.seats[1].nickname === NICK.B && snapA.seats[2].nickname === NICK.C,
    'nicknames land in seat order A/B/C',
  );
  check(snapA.seats[0].isHost === true, 'host crown on seat 0 (isHost)');
  check(snapA.seats.every((s) => s.connected === true), 'presence dots: every member connected');
  check(snapA.seats.every((s) => typeof s.handCount === 'number' && !('hand' in s)), 'seats carry hand COUNTS only — never ranks');
  check(snapA.spectator === false && snapA.you?.seat === 0, 'seated viewer: you.seat 0');
  check(snapD.spectator === true && snapD.you === null, 'spectator snapshot: you=null, spectator=true');
  check(typeof snapA.estMatchMinutes === 'number' && snapA.estMatchMinutes >= 1, `est match minutes carried (~${snapA.estMatchMinutes} min at capacity 3)`);
  check(snapA.visibility === 'public' && snapA.theme === 'saloon', 'visibility + theme ride the snapshot');

  // §4 — the match ────────────────────────────────────────────────────────
  section('§4 the match — game:start, turns, liar calls, mid-match reconnect');

  for (const c of [A, B, C]) wireActor(c);
  let roomsRowMid = null;

  const startAck = await A.emitAck('game:start', {});
  check(startAck?.ok === true, 'host game:start ok — the ≥2-seated minimum path (3 seated humans; bot-fill has no wire event)', `game:start ack failed: ${JSON.stringify(startAck)} — if every socket went quiet right after this ack READ THE SERVER LOG: the first live runs caught game:start killing the whole process via the crypto seed mint (node:crypto caps ranges at 2^48; the port shim in apps/server/src/game/index.ts adds +1 for inclusive bounds, so an inclusive max of 2^48-1 overflows to exactly 2^48 — clamp inside the shim: cryptoRandomInt(min, Math.min(max + 1, 2 ** 48 - 1)))`);

  for (const c of [A, B, C, D]) {
    await waitFor(() => c.events.some((e) => e.event === 'round:new'), 10_000, `${c.label} round:new broadcast`);
  }
  ok('round:new (round 1 + table card) reached all four sockets');

  await waitFor(
    async () => {
      const res = await rest('GET', '/api/rooms?page=1&perPage=50');
      if (res.status !== 200 || !Array.isArray(res.body?.rooms)) return false;
      return res.body.rooms.find((r) => r.roomCode === roomCode) ?? false;
    },
    15_000,
    'the room to appear in GET /api/rooms',
  )
    .then((row) => {
      roomsRowMid = row ?? null;
    })
    .catch(() => {
      roomsRowMid = null;
    });

  // mid-match reconnect: C's seat is held by the grace clock; rejoin restores it
  C.disconnect();
  await sleep(1_200);
  const C2 = makeClient('C-re', mintSessionCookie(userC.id));
  C2.handDealtIdsByRound = { ...C.handDealtIdsByRound }; // same user — own ids stay own
  await C2.connect();
  const ackC2 = await C2.emitAck('room:join', { code: roomCode });
  check(
    ackC2?.ok === true && ackC2.data.spectator === false && ackC2.data.yourSeat === C.mySeat,
    `C rejoins his held seat mid-match (yourSeat ${ackC2?.data?.yourSeat})`,
    `C reconnect join ack: ${JSON.stringify(ackC2)}`,
  );
  check(ackC2?.data?.reconnected === true, 'raw join ack carries reconnected:true (the resync hint)');
  C2.mySeat = ackC2?.data?.yourSeat ?? C.mySeat;
  wireActor(C2);

  const c2CatchUp = await waitFor(
    () => C2.events.find((e) => e.event === 'lobby:state' && e.payload.phase !== 'lobby') ?? false,
    10_000,
    'C-re catch-up snapshot',
  );
  ok(`C-re catch-up snapshot phase=${c2CatchUp.payload.phase} (recovery = 1 snapshot, not N replays)`);
  check(
    c2CatchUp.payload.you?.seat === C2.mySeat && Array.isArray(c2CatchUp.payload.you?.hand),
    `catch-up restores YOUR seat + hand (you.seat=${c2CatchUp.payload.you?.seat}, ${c2CatchUp.payload.you?.hand?.length} cards)`,
  );

  // play until game:over
  let over = null;
  try {
    over = await waitFor(
      () => [A.gameOver, B.gameOver, C2.gameOver, D.gameOver].find((p) => p !== null) ?? false,
      MATCH_DEADLINE_MS,
      'game:over',
    );
  } catch {
    bad(`match did not finish within ${MATCH_DEADLINE_MS / 1000}s (honest revolvers are slow, but not that slow)`);
  }
  if (over) {
    const spread = await waitFor(() => (A.gameOver && B.gameOver && C2.gameOver && D.gameOver) || false, 10_000, 'game:over on every socket').catch(() => null);
    ok(`game:over broadcast (winnerSeat ${over.winnerSeat})${spread ? ' landed on all four sockets' : ''}`);
  }

  // §7 — REST while the match is live (row captured mid-match during §4) ──
  section('§7 GET /api/rooms while live (public browser mirror)');

  check(roomsRowMid !== null, 'the room appeared in GET /api/rooms DURING play', 'the room never appeared in GET /api/rooms during play');
  if (roomsRowMid) {
    check(roomsRowMid.capacity === 3, `row capacity mirrored (${roomsRowMid.capacity}/3)`);
    check(roomsRowMid.seatsTaken === 3, `seats taken mirrored mid-match (${roomsRowMid.seatsTaken}/3 seated)`);
    check(roomsRowMid.hostNickname === NICK.A, `host nickname on the row (${roomsRowMid.hostNickname})`);
    check(typeof roomsRowMid.theme === 'string' && roomsRowMid.theme === 'saloon', `theme chip carried on the row (${roomsRowMid.theme})`);
    const envelope = await rest('GET', '/api/rooms?page=1&perPage=50');
    if (envelope.status === 200 && envelope.body && Array.isArray(envelope.body.rooms)) {
      check(
        Number.isInteger(envelope.body.total) && Number.isInteger(envelope.body.perPage) && envelope.body.page === 1,
        `rooms list envelope {page=1, perPage=${envelope.body.perPage}, total=${envelope.body.total}} (STR/07 §0)`,
      );
    } else {
      bad(`GET /api/rooms envelope fetch answered ${envelope.status}`);
    }
  }
  if (!over) bad('match never finished — later sections degraded');

  // §5 — per-event contract accounting ────────────────────────────────────
  section('§5 per-event contract (strict zod everywhere, monotonic seq, zero chamber state)');

  const total = [A, B, C2, D].reduce((n, c) => n + c.events.length, 0) + C.events.length;
  ok(`${total} received payloads, every one parsed against serverEventSchemas (strict zod — a smuggled rank/extra field would fail right here)`);
  for (const c of [A, B, C2, D]) {
    const rounds = c.events.filter((e) => e.event === 'round:new').length;
    ok(`${c.label}: seq monotonic to ${c.lastSeq} across ${c.events.length} events${rounds ? ` (${rounds} round(s))` : ''}`);
  }
  ok(`${C.label}: pre-drop stream held seq to ${C.lastSeq} (then the grace clock held the seat)`);

  // §6 — privacy ─────────────────────────────────────────────────────────
  section('§6 privacy (STR/07 §3) — hands never leak; spectator gets nothing private');

  check(Object.keys(D.handDealtIdsByRound).length === 0, 'spectator received ZERO hand:deal events (all rounds)');
  const dNoReveal = JSON.stringify(D.events.filter((e) => e.event !== 'reveal:show'));
  check(!dNoReveal.includes('"rank"') && !dNoReveal.includes('"cards"'), 'spectator stream has no rank/cards field outside reveal:show');
  privacyScan([A, B, C, C2], [A, B, C2, D]);

  // §8 — game:over carrier + economy chain ────────────────────────────────
  section('§8 game:over + the economy chain (grantMatchRewards → Mongo → leaderboard)');

  if (over) {
    check(Number.isInteger(over.winnerSeat), `game:over carries winnerSeat (${over.winnerSeat})`, 'winnerSeat missing/non-numeric');
    check(Array.isArray(over.matchRecord?.players) && over.matchRecord.players.length === 3, 'matchRecord carries all three players');
    check(over.matchRecord?.roomCode === roomCode, `matchRecord pinned to the room (${over.matchRecord?.roomCode})`);
    const xps = (over.matchRecord?.players ?? []).map((p) => p.stats.xpEarned);
    check(xps.length === 3 && xps.every((x) => x > 0), `every player earned match XP (${xps.join('/')})`);
    const rxps = (over.rewards ?? []).map((r) => r.xp);
    check((over.rewards ?? []).length === 3 && rxps.every((x) => x > 0), `rewards mirror XP (${rxps.join('/')})`);
  } else {
    bad('no game:over payload to inspect');
  }

  // GET /api/me — the precise per-user proof that grantMatchRewards wrote Mongo
  let meAll = false;
  const meUntil = Date.now() + 25_000;
  const meDetail = [];
  while (Date.now() < meUntil && !meAll) {
    meDetail.length = 0;
    let good = 0;
    for (const user of [userA, userB, userC]) {
      const res = await rest('GET', '/api/me', { cookie: mintSessionCookie(user.id) });
      const xp = res.body?.user?.xp;
      meDetail.push(`${user.nickname}:xp=${String(xp)}`);
      if (res.status === 200 && res.body?.user?.id === user.id && typeof xp === 'number' && xp > 0) good += 1;
    }
    if (good === 3) meAll = true;
    else await sleep(2 * RETRY_MS);
  }
  check(meAll, `GET /api/me shows all three with credited match XP (${meDetail.join(' ')})`, `grantMatchRewards did not reach users (${meDetail.join(' ')})`);

  // GET /api/leaderboard — the public aggregation of the same chain.
  // The server caches pages 60s in-process (economy/leaderboard.ts), so the
  // retry window must SPAN a cache expiry — a consumer polling <60s before
  // this run would otherwise poison the page for the whole 20s scan.
  let allThree = null;
  let envelopeSeen = false;
  const lbUntil = Date.now() + 80_000;
  while (Date.now() < lbUntil && !allThree) {
    for (let page = 1; page <= 10 && !allThree; page += 1) {
      const res = await rest('GET', `/api/leaderboard?metric=xp&page=${page}&perPage=50`);
      const body = res.status === 200 ? res.body : null;
      if (!body || !Array.isArray(body.leaderboard)) break;
      if (!envelopeSeen) {
        envelopeSeen = true;
        check(body.metric === 'xp' && Number.isInteger(body.total), `leaderboard envelope {metric=xp, total=${body.total}} (60s cacheable)`);
      }
      // Match by THIS run's accountIds: every smoke run upserts NEW rows with
      // the SAME SMOKE-A/B/C nicknames, so a nickname-based scan collides with
      // every prior run's users (runId-keyed providerIds are collision-proof).
      const wantIds = new Set([userA.id, userB.id, userC.id]);
      const hits = body.leaderboard.filter((r) => wantIds.has(r.accountId) && r.value > 0);
      if (new Set(hits.map((r) => r.accountId)).size === wantIds.size) allThree = hits;
      if (body.leaderboard.length < 50) break; // last page — the whole board was scanned
    }
    if (!allThree) await sleep(2 * RETRY_MS);
  }
  check(
    allThree !== null,
    `GET /api/leaderboard?metric=xp shows all three with match XP (${(allThree ?? []).map((r) => `${r.nickname}:${r.value}`).join(' ')})`,
    'leaderboard never showed all three test users with XP',
  );
  if (meAll && allThree) ok('socket → rules-engine → grantMatchRewards → Mongo → leaderboard chain green');

  // teardown
  for (const c of [A, B, C, C2, D]) c.disconnect();
  await mongo.close();
}

// ───────────────────────── scenario=window ──────────────────────────────────

async function runWindowScenario() {
  const NICK = { A: 'SMOKE-WA', B: 'SMOKE-WB', C: 'SMOKE-WC', D: 'SMOKE-WD', E: 'SMOKE-WE' };

  // §1 — env + five users + session cookies ──────────────────────────────
  section('§1 env + five users + session cookies');

  const health = await rest('GET', '/api/health');
  const up = check(health.status === 200 && health.body?.ok === true, `game server up on :${ENV.port} (/api/health)`, `no server on ${BASE} — boot apps/server first (status ${health.status})`);
  if (!up) {
    bad('aborting: the window scenario needs the live server');
    return;
  }
  const runId = `${Date.now().toString(36)}${cryptoRandomInt(0, 999)}`;
  const mongo = new MongoClient(ENV.mongoUri, { serverSelectionTimeoutMS: 8_000 });
  await mongo.connect();
  await mongo.db(ENV.mongoDb).command({ ping: 1 });
  ok('Mongo reachable (db name checked, never printed)');
  const usersCollection = mongo.db(ENV.mongoDb).collection('users');
  const mintUser = async (tag, nickname) => {
    const doc = await usersCollection.findOneAndUpdate(
      { provider: 'google', providerId: `liars-smoke-${runId}-${tag}` },
      {
        $set: { name: nickname, lastSeenAt: new Date() },
        $setOnInsert: {
          nickname,
          avatarSpec: { base: 'default' },
          xp: 0,
          level: 1,
          banned: false,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { id: String(doc._id), nickname };
  };
  const userA = await mintUser('wa', NICK.A);
  const userB = await mintUser('wb', NICK.B);
  const userC = await mintUser('wc', NICK.C);
  const userD = await mintUser('wd', NICK.D);
  const userE = await mintUser('we', NICK.E);
  ok('5 fake test users upserted (A..E — the open-window tier)');
  const cookieA = mintSessionCookie(userA.id);
  try {
    check(jwt.verify(cookieA, ENV.authSecret).sub === userA.id, 'short-lived HS256 lg_session cookie mints + verifies');
  } catch (err) {
    bad(`session cookie verify threw: ${err?.message}`);
  }

  // §2 — the five-seat room ───────────────────────────────────────────────
  section('§2 the room — five seated players (capacity 5, no spectators)');

  const A = makeClient('A', cookieA);
  const B = makeClient('B', mintSessionCookie(userB.id));
  const C = makeClient('C', mintSessionCookie(userC.id));
  const D = makeClient('D', mintSessionCookie(userD.id));
  const E = makeClient('E', mintSessionCookie(userE.id));
  let connects = 0;
  for (const c of [A, B, C, D, E]) {
    try {
      await c.connect();
      connects += 1;
    } catch (err) {
      bad(err.message);
    }
  }
  check(connects === 5, '5 socket.io handshakes over websocket carrying session cookies');

  const createAck = await A.emitAck('room:create', {
    name: `SMOKE WIN ${runId.slice(-3)}`,
    capacity: 5,
    theme: 'saloon',
    visibility: 'public',
  });
  if (!check(createAck?.ok === true, 'host room:create ack ok (capacity 5)', `room:create ack failed: ${JSON.stringify(createAck)}`)) {
    throw new Error('cannot smoke without a room');
  }
  const roomCode = createAck.data.roomCode;
  check(ROOM_CODE_RE.test(roomCode), `room code minted from the 31-char set (${roomCode})`);

  const seated = [B, C, D, E];
  for (let i = 0; i < seated.length; i += 1) {
    const ack = await seated[i].emitAck('room:join', { code: roomCode });
    const seatOk = ack?.ok === true && ack.data?.spectator === false && ack.data?.yourSeat === i + 1;
    if (ack?.error?.code === 'RATE_LIMITED') {
      bad(`join RATE_LIMITED — the server join bucket is 10/IP/10min (this scenario: 5 attempts). Restart the server process or wait out the window, then rerun.`);
    }
    check(seatOk, `${seated[i].label} joins seated at seat ${i + 1}`, `join ack: ${JSON.stringify(ack)}`);
    seated[i].mySeat = i + 1;
  }
  A.mySeat = 0;

  // §3 — reconnect MID-WINDOW (round 1's window: no roulette has fired yet,
  //      so the reconnect assertions cannot be disturbed by an elimination) ──
  section('§3 reconnect mid-window — grace-held seat, catch-up carries the open window');

  for (const c of [A, B, C, D, E]) wireWindowActor(c); // acts only past the 2s arm
  const startAck = await A.emitAck('game:start', {});
  check(startAck?.ok === true, 'host game:start ok — 5 seated → open-window mode at 5 alive', `game:start ack failed: ${JSON.stringify(startAck)}`);

  const firstWindow = await waitFor(
    () => A.events.find((e) => e.event === 'window:open') ?? false,
    20_000,
    'the first open challenge window',
  );
  check(Number.isInteger(firstWindow.payload.playSeat), `window:open live on the wire (playSeat ${firstWindow.payload.playSeat}, accused of the first play)`);
  const msLeft = firstWindow.payload.closesAtTs - Date.now();
  check(msLeft > 5_000 && msLeft < 12_000, `window closesAtTs is a future epoch stamp ~10s out (${Math.round(msLeft / 100) / 10}s)`);

  // arm-delay probe: an IMMEDIATE CHECK from a different seat bounces with the typed engine code
  const caller = [A, B, C, D, E].find((c) => c.mySeat !== firstWindow.payload.playSeat);
  const preArm = await caller.emitAck('liar:call', { accusedSeat: firstWindow.payload.playSeat });
  check(
    preArm?.ok === false && preArm.error?.code === 'ERR_WINDOW_NOT_ARMED',
    `pre-arm CHECK rejected ERR_WINDOW_NOT_ARMED (2s arm delay, server-authoritative)`,
    `pre-arm probe did not bounce with ERR_WINDOW_NOT_ARMED: ${JSON.stringify(preArm)}`,
  );

  // — D drops while the window is open; the grace clock holds the seat —
  D.disconnect();
  const presOut = await waitFor(
    () => {
      for (const w of [A, B, C, E]) {
        const p = lastEvent(w, 'presence:update');
        const mine = p?.seats?.find((s) => s.seat === D.mySeat);
        if (mine && mine.connected === false) return p;
      }
      return false;
    },
    8_000,
    'presence showing D disconnected',
  );
  check(presOut !== false && presOut !== undefined, `presence:update broadcast shows seat ${D.mySeat} disconnected (grace clock holding the seat)`);

  // — D rejoins INTO the still-open window; the catch-up snapshot must carry it —
  const D2 = makeClient('D-re', mintSessionCookie(userD.id));
  D2.handDealtIdsByRound = { ...D.handDealtIdsByRound }; // same user — own ids stay own
  D2.mySeat = D.mySeat;
  await D2.connect();
  const ackD2 = await D2.emitAck('room:join', { code: roomCode });
  if (ackD2?.error?.code === 'RATE_LIMITED') {
    bad('reconnect join RATE_LIMITED — 10/IP/10min bucket; restart the server process or wait out the window, then rerun.');
  }
  check(
    ackD2?.ok === true && ackD2.data?.spectator === false && ackD2.data?.yourSeat === D.mySeat && ackD2.data?.reconnected === true,
    `D rejoins INTO the open window (reconnected:true, seat ${ackD2?.data?.yourSeat})`,
    `reconnect join ack: ${JSON.stringify(ackD2)}`,
  );
  const catchUp = await waitFor(
    () => D2.events.find((e) => e.event === 'lobby:state' && e.payload.phase !== 'lobby') ?? false,
    10_000,
    'D-re catch-up snapshot',
  );
  check(catchUp.payload.phase === 'playing', 'catch-up snapshot is mid-match (one snapshot, not N replays)');
  check(
    catchUp.payload.you?.seat === D.mySeat && Array.isArray(catchUp.payload.you?.hand) && catchUp.payload.you.hand.length > 0,
    `catch-up restores D's seat + hand (${catchUp.payload.you?.hand?.length} cards)`,
  );
  D2.hand = catchUp.payload.you.hand;
  check(
    catchUp.payload.challengeWindow?.playSeat === firstWindow.payload.playSeat && catchUp.payload.challengeWindow?.closesAtTs === firstWindow.payload.closesAtTs,
    `catch-up carries the STILL-OPEN window (challengeWindow playSeat ${catchUp.payload.challengeWindow?.playSeat} === the live window)`,
    `catch-up challengeWindow ${JSON.stringify(catchUp.payload.challengeWindow)} vs live ${JSON.stringify({ playSeat: firstWindow.payload.playSeat, closesAtTs: firstWindow.payload.closesAtTs })}`,
  );
  wireWindowActor(D2);
  // If D's seat was mid-turn when the socket dropped, its turn:begin already
  // passed D2 by — resume from the catch-up's currentTurnSeat.
  if (catchUp.payload.currentTurnSeat === D2.mySeat) {
    ok(`D's seat held the turn through the reconnect (currentTurnSeat=${D2.mySeat}) — resuming from the catch-up`);
    setTimeout(() => void actOnTurn(D2), 2_700);
  }
  const presBack = await waitFor(
    () => {
      for (const w of [A, B, C, E]) {
        const p = lastEvent(w, 'presence:update');
        const mine = p?.seats?.find((s) => s.seat === D.mySeat);
        if (mine && mine.connected === true) return p;
      }
      return false;
    },
    8_000,
    'presence showing D back',
  );
  check(presBack !== false && presBack !== undefined, 'presence:update shows the rejoined seat connected again');

  // §4 — window discipline: the post-arm CHECK lands and closes liar_called ─
  section('§4 post-arm CHECK accepted {liar_called} — the challenge resolves on the wire');
  await sleep(2_200); // past the 2s arm, well inside the 10s window
  const armed = await caller.emitAck('liar:call', { accusedSeat: firstWindow.payload.playSeat });
  check(armed?.ok === true, `post-arm CHECK accepted (first-wins)`, `post-arm CHECK failed: ${JSON.stringify(armed)}`);
  const liarClose = await waitFor(
    () => A.events.find((e) => e.event === 'window:close' && e.payload.reason === 'liar_called') ?? false,
    5_000,
    'window:close {liar_called}',
  );
  check(liarClose !== false, `window:close {reason: liar_called} broadcast (seq ${liarClose.payload.seq})`);
  const revealed = await waitFor(
    () => A.events.find((e) => e.event === 'reveal:show') ?? false,
    5_000,
    'reveal:show',
  );
  check(revealed !== false, `reveal:show reached the room (verdict ${revealed.payload.verdict})`);
  // whatever the honest revolver decides next is fine — the window story is banked
  await waitFor(() => A.events.some((e) => e.event === 'shot:assign'), 8_000, 'shot:assign');

  // §5 — per-event contract + privacy across the window run ───────────────
  section('§5 per-event contract + privacy (5-player window run)');

  const allClients = [A, B, C, D, E, D2];
  for (const c of allClients) {
    ok(`${c.label}: ${c.events.length} events parsed against serverEventSchemas (strict zod), seq monotonic to ${c.lastSeq}`);
  }
  privacyScan([A, B, C, D, D2, E], [A, B, C, E, D2]);

  for (const c of allClients) c.disconnect();
  await mongo.close();
}

// ───────────────────────── scenario=bots ────────────────────────────────────

async function runBotsScenario() {
  const NICK = { A: 'SMOKE-BA', B: 'SMOKE-BB' };

  // §1 — env + two users + session cookies ────────────────────────────────
  section('§1 env + two users + session cookies');

  const health = await rest('GET', '/api/health');
  const up = check(health.status === 200 && health.body?.ok === true, `game server up on :${ENV.port} (/api/health)`, `no server on ${BASE} — boot apps/server first (status ${health.status})`);
  if (!up) {
    bad('aborting: the bots scenario needs the live server');
    return;
  }
  const runId = `${Date.now().toString(36)}${cryptoRandomInt(0, 999)}`;
  const mongo = new MongoClient(ENV.mongoUri, { serverSelectionTimeoutMS: 8_000 });
  await mongo.connect();
  await mongo.db(ENV.mongoDb).command({ ping: 1 });
  ok('Mongo reachable (db name checked, never printed)');
  const usersCollection = mongo.db(ENV.mongoDb).collection('users');
  const mintUser = async (tag, nickname) => {
    const doc = await usersCollection.findOneAndUpdate(
      { provider: 'google', providerId: `liars-smoke-${runId}-${tag}` },
      {
        $set: { name: nickname, lastSeenAt: new Date() },
        $setOnInsert: {
          nickname,
          avatarSpec: { base: 'default' },
          xp: 0,
          level: 1,
          banned: false,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { id: String(doc._id), nickname };
  };
  const userA = await mintUser('ba', NICK.A);
  const userB = await mintUser('bb', NICK.B);
  ok('2 fake test users upserted (host + one human guest)');
  try {
    check(jwt.verify(mintSessionCookie(userA.id), ENV.authSecret).sub === userA.id, 'session cookie mints + verifies');
  } catch (err) {
    bad(`session cookie verify threw: ${err?.message}`);
  }

  // §2 — the bot surface is CLOSED on the wire (by design) ─────────────────
  section('§2 bot-fill surface is programmatic-only: no wire/REST bot surface exists');

  const clientEvents = Object.keys(clientEventSchemas);
  check(clientEvents.length === 8, `the shared client-event catalog is exactly the 8 contract events (${clientEvents.join(', ')})`);
  check(!clientEvents.some((e) => /bot/i.test(e)), 'no bot event exists in the client contract (bot-fill is manager-only, S1/STR/02)');

  const A = makeClient('A', mintSessionCookie(userA.id));
  await A.connect();
  const createAck = await A.emitAck('room:create', {
    name: `SMOKE BOT ${runId.slice(-3)}`,
    capacity: 2,
    theme: 'saloon',
    visibility: 'private',
  });
  check(createAck?.ok === true, 'host room:create ack ok', `room:create ack failed: ${JSON.stringify(createAck)}`);
  const roomCode = createAck.data.roomCode;
  const snapshotsBefore = A.events.filter((e) => e.event === 'lobby:state').length;

  const socketProbe = await emitProbeUnhandled(A.socket, 'bot:add', { seat: 1 });
  check(socketProbe.unhandled, 'emitting bot:add gets NO handler (unbound client event → no ack, no state change)');
  const restProbes = ['/api/rooms/bots', `/api/rooms/${roomCode}/bots`, `/api/rooms/${roomCode}/bot-fill`, '/api/game/bots'];
  for (const p of restProbes) {
    const res = await rest('POST', p, { cookie: mintSessionCookie(userA.id) });
    check(res.status === 404, `POST ${p} → 404 (no accidental bot REST surface)`, `POST ${p} answered ${res.status} — a bot route may have been added without the shared contract`);
  }
  check(A.events.filter((e) => e.event === 'lobby:state').length === snapshotsBefore, 'the room is unchanged by every probe (no snapshot, no seat change, no state)');

  // §3 — the closest live equivalent match: two humans to game:over ────────
  section('§3 the match — 2 humans to game:over (bots never pre-empt the pipeline)');

  const B = makeClient('B', mintSessionCookie(userB.id));
  await B.connect();
  const ackB = await B.emitAck('room:join', { code: roomCode });
  if (ackB?.error?.code === 'RATE_LIMITED') {
    bad('join RATE_LIMITED — 10/IP/10min bucket; restart the server process or wait out the window, then rerun.');
  }
  check(ackB?.ok === true && ackB.data?.yourSeat === 1 && ackB.data?.spectator === false, 'B joins seated at seat 1', `B join ack: ${JSON.stringify(ackB)}`);
  A.mySeat = 0;
  B.mySeat = 1;
  for (const c of [A, B]) wireActor(c);

  const startAck = await A.emitAck('game:start', {});
  check(startAck?.ok === true, 'host game:start ok', `game:start ack failed: ${JSON.stringify(startAck)}`);
  const over = await waitFor(
    () => A.gameOver ?? false,
    MATCH_DEADLINE_MS,
    'game:over (honest 2p roulette — production pacing)',
  );
  check(over !== false && over !== undefined, `game:over landed (winnerSeat ${over?.winnerSeat})`, 'no game:over within the deadline');

  // §4 — game:over integrity ────────────────────────────────────────────────
  section('§4 game:over integrity (rewards mirror the record; every seat accounted)');

  if (over) {
    check(Number.isInteger(over.winnerSeat), `winnerSeat carried (${over.winnerSeat})`);
    check(over.matchRecord?.roomCode === roomCode, 'matchRecord pinned to the room');
    check((over.matchRecord?.players ?? []).length === 2, 'matchRecord carries both seated players');
    check(Number.isInteger(over.matchRecord?.summary?.rounds) && over.matchRecord.summary.rounds > 0, `match completed real rounds (${over.matchRecord?.summary?.rounds})`);
    const xps = (over.rewards ?? []).map((r) => r.xp);
    check((over.rewards ?? []).length === 2 && xps.every((x) => x > 0), `both humans earned match XP (${xps.join('/')})`);
  }

  // §5 — rewards/leaderboard immunity for bot accounts (live) ──────────────
  section('§5 economy: XP landed on real accounts; the leaderboard can only hold ObjectId accounts');

  let meAll = false;
  const meUntil = Date.now() + 25_000;
  const meDetail = [];
  while (Date.now() < meUntil && !meAll) {
    meDetail.length = 0;
    let good = 0;
    for (const user of [userA, userB]) {
      const res = await rest('GET', '/api/me', { cookie: mintSessionCookie(user.id) });
      const xp = res.body?.user?.xp;
      meDetail.push(`${user.nickname}:xp=${String(xp)}`);
      if (res.status === 200 && typeof xp === 'number' && xp > 0) good += 1;
    }
    if (good === 2) meAll = true;
    else await sleep(2 * RETRY_MS);
  }
  check(meAll, `GET /api/me shows both users with credited match XP (${meDetail.join(' ')})`, `grantMatchRewards did not reach users (${meDetail.join(' ')})`);

  let scanned = 0;
  let botRows = 0;
  let runRows = 0;
  let userRows = 0;
  // The leaderboard caches pages 60s server-side (economy/leaderboard.ts) —
  // span a cache expiry before giving up (80s > 60s TTL).
  const lbUntil = Date.now() + 80_000;
  while (Date.now() < lbUntil && !(userRows === 2 && runRows === 2)) {
    for (let page = 1; page <= 5; page += 1) {
      const res = await rest('GET', `/api/leaderboard?metric=xp&page=${page}&perPage=50`);
      const body = res.status === 200 ? res.body : null;
      if (!body || !Array.isArray(body.leaderboard)) break;
      for (const row of body.leaderboard) {
        scanned += 1;
        if (typeof row.accountId === 'string' && row.accountId.startsWith('bot:')) botRows += 1;
        if (row.accountId === userA.id || row.accountId === userB.id) {
          userRows += 1;
          if (row.value > 0) runRows += 1;
        }
      }
      if (body.leaderboard.length < 50) break;
    }
    if (!(userRows === 2 && runRows === 2)) await sleep(2 * RETRY_MS);
  }
  check(botRows === 0, `no bot:<roomCode>:<seat> accountId can ever appear on the leaderboard (0 of ${scanned} rows)`, `${botRows} bot account rows leaked onto the leaderboard`);
  check(userRows === 2 && runRows === 2, 'the run\'s two real users appear on the board with match XP > 0');

  for (const c of [A, B]) c.disconnect();
  await mongo.close();
}

// ───────────────────────── scenario=abandon ────────────────────────────────

async function runAbandonScenario() {
  const NICK = { A: 'SMOKE-AA', B: 'SMOKE-AB', S: 'SMOKE-AS' };

  // §1 — env + three users (A, B seated + S spectator witness) ────────────
  section('§1 env + three users (two players + one witness spectator)');

  const health = await rest('GET', '/api/health');
  const up = check(health.status === 200 && health.body?.ok === true, `game server up on :${ENV.port} (/api/health)`, `no server on ${BASE} — boot apps-server first (status ${health.status})`);
  if (!up) {
    bad('aborting: the abandon scenario needs the live server');
    return;
  }
  const runId = `${Date.now().toString(36)}${cryptoRandomInt(0, 999)}`;
  const mongo = new MongoClient(ENV.mongoUri, { serverSelectionTimeoutMS: 8_000 });
  await mongo.connect();
  await mongo.db(ENV.mongoDb).command({ ping: 1 });
  ok('Mongo reachable (db name checked, never printed)');
  const usersCollection = mongo.db(ENV.mongoDb).collection('users');
  const mintUser = async (tag, nickname) => {
    const doc = await usersCollection.findOneAndUpdate(
      { provider: 'google', providerId: `liars-smoke-${runId}-${tag}` },
      {
        $set: { name: nickname, lastSeenAt: new Date() },
        $setOnInsert: {
          nickname,
          avatarSpec: { base: 'default' },
          xp: 0,
          level: 1,
          banned: false,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { id: String(doc._id), nickname };
  };
  const userA = await mintUser('aa', NICK.A);
  const userB = await mintUser('ab', NICK.B);
  const userS = await mintUser('as', NICK.S);
  ok('3 fake test users upserted (A, B + witness S)');
  try {
    check(jwt.verify(mintSessionCookie(userA.id), ENV.authSecret).sub === userA.id, 'session cookie mints + verifies');
  } catch (err) {
    bad(`session cookie verify threw: ${err?.message}`);
  }

  // §2 — capacity-2 room: A+B seated, S spectator, match started ───────────
  section('§2 the room — two seated players + a spectator witness; match started');

  const A = makeClient('A', mintSessionCookie(userA.id));
  const B = makeClient('B', mintSessionCookie(userB.id));
  const S = makeClient('S', mintSessionCookie(userS.id));
  let connects = 0;
  for (const c of [A, B, S]) {
    try {
      await c.connect();
      connects += 1;
    } catch (err) {
      bad(err.message);
    }
  }
  check(connects === 3, '3 socket.io handshakes (A, B, witness S)');

  const createAck = await A.emitAck('room:create', {
    name: `SMOKE ABN ${runId.slice(-3)}`,
    capacity: 2,
    theme: 'saloon',
    visibility: 'private',
  });
  check(createAck?.ok === true, 'host room:create ack ok (capacity 2, private)', `room:create ack failed: ${JSON.stringify(createAck)}`);
  const roomCode = createAck.data.roomCode;
  const ackB = await B.emitAck('room:join', { code: roomCode });
  if (ackB?.error?.code === 'RATE_LIMITED') {
    bad('join RATE_LIMITED — 10/IP/10min bucket; restart the server process or wait out the window, then rerun.');
  }
  check(ackB?.ok === true && ackB.data?.spectator === false && ackB.data?.yourSeat === 1, 'B joins seated (seat 1)', `B join ack: ${JSON.stringify(ackB)}`);
  A.mySeat = 0;
  B.mySeat = 1;
  const ackS = await S.emitAck('room:join', { code: roomCode });
  check(ackS?.ok === true && ackS.data?.spectator === true && ackS.data?.yourSeat === null, 'S joins the FULL room as the witness spectator', `S join ack: ${JSON.stringify(ackS)}`);
  S.isSpectator = true;

  const startAck = await A.emitAck('game:start', {});
  check(startAck?.ok === true, 'host game:start ok (2 seated humans)', `game:start ack failed: ${JSON.stringify(startAck)}`);
  await waitFor(() => A.events.some((e) => e.event === 'round:new'), 10_000, 'round:new to A');
  await waitFor(() => B.events.some((e) => e.event === 'hand:deal'), 10_000, 'hand:deal to B');
  ok('the match is live (round 1 dealt to both players)');
  check(S.events.filter((e) => e.event === 'hand:deal').length === 0, 'the spectator witness received ZERO hand:deal (privacy holds)');

  // §3 — the double drop ─────────────────────────────────────────────────────
  section('§3 both players drop mid-turn (A first, B 1.5s later)');

  A.disconnect();
  const presA = await waitFor(
    () => {
      const p = lastEvent(B, 'presence:update') ?? lastEvent(S, 'presence:update');
      return p?.seats?.find((s) => s.seat === 0 && s.connected === false) ? p : false;
    },
    8_000,
    'presence showing seat 0 disconnected',
  );
  check(presA !== false && presA !== undefined, 'presence:update broadcast A disconnected (grace clock armed, 60s)');
  await sleep(1_500);
  B.disconnect();
  const presB = await waitFor(
    () => {
      const p = lastEvent(S, 'presence:update');
      return p?.seats?.find((s) => s.seat === 1 && s.connected === false) ? p : false;
    },
    8_000,
    'presence showing seat 1 disconnected',
  );
  check(presB !== false && presB !== undefined, 'presence:update broadcast B disconnected (both seats now grace-held)');
  ok('nobody is left holding a socket — the match must now decide itself');

  // §4 — grace expiry → abandon → abort → win by default (60s grace) ───────
  section('§4 grace expiry (60s) → ABANDON → abort → B wins by default, 0-round record');

  const over = await waitFor(
    () => S.gameOver ?? false,
    80_000,
    'game:over on the witness socket (earlier dropper A abandons first → B wins)',
  );
  check(Number.isInteger(over?.winnerSeat), `game:over broadcast reached the witness (winnerSeat ${over?.winnerSeat})`, 'no game:over within 60s grace + margin');
  if (over) {
    check(over.winnerSeat === B.mySeat, `the LATER dropper (B, seat ${B.mySeat}) wins by default — win-by-default per STR/01 §9`, `winnerSeat was ${over.winnerSeat}`);
    check(over.matchRecord?.roomCode === roomCode, 'matchRecord pinned to the room');
    const record = over.matchRecord ?? {};
    check(record.players?.length === 2, `matchRecord carries both players (${record.players?.length})`);
    check(Number.isInteger(record.summary?.rounds) && record.summary.rounds === 0, `the record is a 0-ROUND record (summary.rounds = ${record.summary?.rounds} — no roulette ever fired)`);
    const rewardB = (over.rewards ?? []).find((r) => r.seat === B.mySeat);
    const rewardA = (over.rewards ?? []).find((r) => r.seat === A.mySeat);
    check((rewardB?.xp ?? 0) > 0, `winner B's reward carries XP (${rewardB?.xp})`);
    check((rewardA?.xp ?? -1) === 0, `abandoned A earns 0 XP (${rewardA?.xp}) — no completion credit`);
  }

  // §5 — the zero-round rewards path through the economy ────────────────────
  section('§5 zero-round rewards path — aborted win still grants; abandoner gets nothing');

  let bXp = null;
  let aXp = null;
  const meUntil = Date.now() + 25_000;
  while (Date.now() < meUntil && (bXp === null || aXp === null || !(bXp > 0) || aXp !== 0)) {
    const meB = await rest('GET', '/api/me', { cookie: mintSessionCookie(userB.id) });
    const meA = await rest('GET', '/api/me', { cookie: mintSessionCookie(userA.id) });
    if (typeof meB.body?.user?.xp === 'number') bXp = meB.body.user.xp;
    if (typeof meA.body?.user?.xp === 'number') aXp = meA.body.user.xp;
    if (bXp > 0 && aXp === 0) break;
    await sleep(2 * RETRY_MS);
  }
  check(typeof bXp === 'number' && bXp > 0, `GET /api/me: B (win by default) shows credited XP (${bXp})`, `aborted-win XP never landed on B (${bXp})`);
  check(aXp === 0, `GET /api/me: A (abandoned) shows exactly 0 XP (${aXp})`, `A accrued XP from an abandoned match (${aXp})`);

  let bRow = null;
  // Leaderboard pages cache 60s server-side — span a cache expiry (80s > 60s).
  const lbUntil = Date.now() + 80_000;
  while (Date.now() < lbUntil && !bRow) {
    for (let page = 1; page <= 3 && !bRow; page += 1) {
      const res = await rest('GET', `/api/leaderboard?metric=xp&page=${page}&perPage=50`);
      const body = res.status === 200 ? res.body : null;
      if (!body || !Array.isArray(body.leaderboard)) break;
      bRow = body.leaderboard.find((r) => r.accountId === userB.id && r.value > 0) ?? null;
    }
    if (!bRow) await sleep(2 * RETRY_MS);
  }
  check(bRow !== null, `GET /api/leaderboard shows B with the aborted-win XP (${bRow?.value})`, 'B never appeared on the leaderboard with XP');

  for (const c of [A, B, S]) c.disconnect();
  await mongo.close();
}

// ───────────────────────── dispatcher ───────────────────────────────────────

async function main() {
  switch (SCENARIO) {
    case 'window':
      return runWindowScenario();
    case 'bots':
      return runBotsScenario();
    case 'abandon':
      return runAbandonScenario();
    case 'full':
    default:
      return runFullScenario();
  }
}

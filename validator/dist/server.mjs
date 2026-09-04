// validator/server.ts
import { createServer } from "node:http";

// src/engine/board.ts
var WHITE = "white";
var BLACK = "black";
function opponent(p) {
  return p === WHITE ? BLACK : WHITE;
}
function cloneState(s) {
  return {
    points: s.points.slice(),
    bar: { ...s.bar },
    off: { ...s.off },
    turn: s.turn,
    dice: s.dice.slice(),
    diceUsed: s.diceUsed.slice()
  };
}
function countAt(points, index, player) {
  const v = points[index];
  return player === WHITE ? Math.max(0, v) : Math.max(0, -v);
}
function isBlocked(points, index, player) {
  const v = points[index];
  return player === WHITE ? v <= -2 : v >= 2;
}
function placeChecker(state, index, player) {
  const sign = player === WHITE ? 1 : -1;
  const opp = opponent(player);
  let hit = false;
  if (countAt(state.points, index, opp) === 1) {
    state.points[index] = 0;
    state.bar[opp] += 1;
    hit = true;
  }
  state.points[index] += sign;
  return hit;
}
function allHome(state, player) {
  if (state.bar[player] > 0) return false;
  const range = player === WHITE ? [6, 24] : [0, 18];
  for (let i = range[0]; i < range[1]; i++) {
    if (countAt(state.points, i, player) > 0) return false;
  }
  return true;
}
function highestHomeIndex(state, player) {
  if (player === WHITE) {
    for (let i = 5; i >= 0; i--) if (countAt(state.points, i, player) > 0) return i;
    return -1;
  } else {
    for (let i = 18; i <= 23; i++) if (countAt(state.points, i, player) > 0) return i;
    return -1;
  }
}

// src/engine/moves.ts
function dir(player) {
  return player === WHITE ? -1 : 1;
}
function bearOffPip(player, index) {
  return player === WHITE ? index + 1 : 24 - index;
}
function entryIndex(player, die) {
  return player === WHITE ? 24 - die : die - 1;
}
function singleDieSteps(state, player, die) {
  const steps = [];
  const points = state.points;
  if (state.bar[player] > 0) {
    const idx = entryIndex(player, die);
    if (!isBlocked(points, idx, player)) {
      steps.push({ from: "bar", to: idx, die });
    }
    return steps;
  }
  const canBearOff = allHome(state, player);
  for (let i = 0; i < 24; i++) {
    if (countAt(points, i, player) === 0) continue;
    const target = i + dir(player) * die;
    if (target >= 0 && target <= 23) {
      if (!isBlocked(points, target, player)) {
        steps.push({ from: i, to: target, die });
      }
    } else if (canBearOff) {
      const pip = bearOffPip(player, i);
      if (pip === die) {
        steps.push({ from: i, to: "off", die });
      } else if (pip < die) {
        if (highestHomeIndex(state, player) === i) {
          steps.push({ from: i, to: "off", die });
        }
      }
    }
  }
  return steps;
}
function applyStep(state, step, player) {
  const sign = player === WHITE ? 1 : -1;
  if (step.from === "bar") {
    state.bar[player] -= 1;
  } else {
    state.points[step.from] -= sign;
  }
  if (step.to === "off") {
    state.off[player] += 1;
  } else {
    placeChecker(state, step.to, player);
  }
}
function boardKey(state) {
  return state.points.join(",") + "|" + state.bar.white + "," + state.bar.black + "|" + state.off.white + "," + state.off.black;
}
function maximalTerminals(state) {
  const player = state.turn;
  if (state.dice.length === 0) return [];
  const remaining = state.dice.slice();
  const terminals = [];
  function expand(cur, dice, stepsSoFar) {
    let extended = false;
    const tried = /* @__PURE__ */ new Set();
    for (let k = 0; k < dice.length; k++) {
      const d = dice[k];
      if (tried.has(d)) continue;
      tried.add(d);
      const options = singleDieSteps(cur, player, d);
      for (const st of options) {
        const nb = cloneState(cur);
        applyStep(nb, st, player);
        const rem = dice.slice();
        rem.splice(k, 1);
        expand(nb, rem, [...stepsSoFar, st]);
        extended = true;
      }
    }
    if (!extended) {
      terminals.push({ steps: stepsSoFar, state: cur });
    }
  }
  expand(cloneState(state), remaining, []);
  const maxLen = terminals.reduce((m, t) => Math.max(m, t.steps.length), 0);
  let best = terminals.filter((t) => t.steps.length === maxLen);
  if (maxLen === 1 && state.dice.length === 2 && state.dice[0] !== state.dice[1]) {
    const larger = Math.max(state.dice[0], state.dice[1]);
    const withLarger = best.filter((t) => t.steps[0].die === larger);
    if (withLarger.length > 0) best = withLarger;
  }
  return best;
}
function allMaximalSequences(state) {
  return maximalTerminals(state).map((t) => t.steps);
}
function generateMoves(state) {
  const best = maximalTerminals(state);
  const seen = /* @__PURE__ */ new Set();
  const moves = [];
  for (const t of best) {
    const key = boardKey(t.state);
    if (seen.has(key)) continue;
    seen.add(key);
    moves.push({ steps: t.steps, resultKey: key });
  }
  return moves;
}
function hasNoMove(moves) {
  return moves.length === 1 && moves[0].steps.length === 0;
}

// src/engine/game.ts
function legalNextSteps(state, played) {
  const sequences = allMaximalSequences(state);
  const next = [];
  const seen = /* @__PURE__ */ new Set();
  for (const steps of sequences) {
    if (steps.length <= played.length) continue;
    let matches = true;
    for (let i = 0; i < played.length; i++) {
      if (!sameStep(steps[i], played[i])) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    const cand = steps[played.length];
    const key = stepKey(cand);
    if (!seen.has(key)) {
      seen.add(key);
      next.push(cand);
    }
  }
  return next;
}
function isTurnComplete(state, played) {
  const sequences = allMaximalSequences(state);
  return sequences.some(
    (steps) => steps.length === played.length && steps.every((s, i) => sameStep(s, played[i]))
  );
}
function sameStep(a, b) {
  return a.from === b.from && a.to === b.to && a.die === b.die;
}
function stepKey(s) {
  return `${s.from}-${s.to}-${s.die}`;
}

// src/engine/validateTurn.ts
function sameStep2(a, b) {
  return a.from === b.from && a.to === b.to && a.die === b.die;
}
function endTurn(state) {
  const s = cloneState(state);
  s.turn = opponent(s.turn);
  s.dice = [];
  s.diceUsed = [];
  return s;
}
function validateTurn(state, steps) {
  const proposed = steps ?? [];
  if (proposed.length === 0) {
    const legal = generateMoves(state);
    if (hasNoMove(legal)) {
      return { valid: true, state: endTurn(state) };
    }
    return { valid: false, reason: "moves-available" };
  }
  const played = [];
  for (const step of proposed) {
    const opts = legalNextSteps(state, played);
    if (!opts.some((o) => sameStep2(o, step))) {
      return { valid: false, reason: "illegal-step" };
    }
    played.push(step);
  }
  if (!isTurnComplete(state, played)) {
    return { valid: false, reason: "turn-incomplete" };
  }
  const s = cloneState(state);
  for (const step of played) {
    applyStep(s, step, s.turn);
  }
  return { valid: true, state: endTurn(s) };
}

// validator/analyzePr.ts
import * as ort from "onnxruntime-node";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// src/engine/encoding.ts
function td(n) {
  if (n <= 0) return [0, 0, 0, 0];
  if (n === 1) return [1, 0, 0, 0];
  if (n === 2) return [0, 1, 0, 0];
  return [0, 0, 1, n - 3];
}
function toWildPos(state, onRoll) {
  const pips = new Array(26).fill(0);
  pips[0] = -state.bar.black;
  pips[25] = state.bar.white;
  for (let p = 1; p <= 24; p++) {
    pips[p] = state.points[p - 1];
  }
  const white = { pips, xOff: state.off.white, oOff: state.off.black };
  if (onRoll === WHITE) return white;
  const switched = new Array(26).fill(0);
  for (let i = 0; i < 26; i++) switched[i] = -pips[25 - i];
  return { pips: switched, xOff: white.oOff, oOff: white.xOff };
}
var CONTACT_INPUTS = 202;
function contactInputs(pos) {
  const out = new Float32Array(CONTACT_INPUTS);
  out[0] = pos.xOff;
  out[1] = pos.oOff;
  const bar = td(pos.pips[25]);
  out[2] = bar[0];
  out[3] = bar[1];
  out[4] = bar[2];
  out[5] = bar[3];
  for (let k = 0; k < 24; k++) {
    const t = td(pos.pips[1 + k]);
    const s = 6 + k * 4;
    out[s] = t[0];
    out[s + 1] = t[1];
    out[s + 2] = t[2];
    out[s + 3] = t[3];
  }
  for (let k = 0; k < 25; k++) {
    const t = td(-pos.pips[k]);
    const s = 102 + k * 4;
    out[s] = t[0];
    out[s + 1] = t[1];
    out[s + 2] = t[2];
    out[s + 3] = t[3];
  }
  return out;
}
var RACE_INPUTS = 186;
function raceInputs(pos) {
  const out = new Float32Array(RACE_INPUTS);
  out[0] = pos.xOff;
  out[1] = pos.oOff;
  for (let k = 0; k < 23; k++) {
    const t = td(pos.pips[1 + k]);
    const s = 2 + k * 4;
    out[s] = t[0];
    out[s + 1] = t[1];
    out[s + 2] = t[2];
    out[s + 3] = t[3];
  }
  for (let k = 0; k < 23; k++) {
    const t = td(-pos.pips[2 + k]);
    const s = 94 + k * 4;
    out[s] = t[0];
    out[s + 1] = t[1];
    out[s + 2] = t[2];
    out[s + 3] = t[3];
  }
  return out;
}
function phaseOf(pos) {
  let lastOwn = -1;
  let lastOpp = -1;
  for (let i = 0; i < 26; i++) {
    if (pos.pips[i] > 0) lastOwn = i;
  }
  for (let i = 0; i < 26; i++) {
    if (pos.pips[i] < 0) {
      lastOpp = i;
      break;
    }
  }
  return lastOwn > lastOpp ? "contact" : "race";
}
function equityFrom(p) {
  return p[0] - p[3] + 2 * (p[1] - p[4]) + 3 * (p[2] - p[5]);
}

// src/analysis/pr.ts
var XG_OBVIOUS_CHECKER_EQUITY_SPREAD = 1e-3;
function onePointFactor(matchLength, isMoney = false) {
  return !isMoney && matchLength === 1 ? 1.5 : 1;
}
function prValue(equityLost, decisions) {
  if (decisions <= 0) return null;
  return equityLost / decisions * 500;
}
function checkerDecision(bestEq, playedEq, worstEq, legalMoveCount, matchLength, isMoney = false) {
  const counts = legalMoveCount > 1 && bestEq - worstEq >= XG_OBVIOUS_CHECKER_EQUITY_SPREAD;
  const loss = Math.max(0, bestEq - playedEq);
  return {
    type: "checker",
    countsForPR: counts,
    normalizedEquityLoss: loss,
    prAdjustedEquityLoss: loss * onePointFactor(matchLength, isMoney)
  };
}
function summarize(decisions) {
  const acc = {
    checker: { equityLost: 0, decisions: 0 },
    cube: { equityLost: 0, decisions: 0 }
  };
  for (const d of decisions) {
    if (!d.countsForPR) continue;
    acc[d.type].equityLost += d.prAdjustedEquityLoss;
    acc[d.type].decisions += 1;
  }
  const checkerC = {
    decisions: acc.checker.decisions,
    equityLost: acc.checker.equityLost,
    pr: prValue(acc.checker.equityLost, acc.checker.decisions)
  };
  const cubeC = {
    decisions: acc.cube.decisions,
    equityLost: acc.cube.equityLost,
    pr: prValue(acc.cube.equityLost, acc.cube.decisions)
  };
  const totalLost = checkerC.equityLost + cubeC.equityLost;
  const totalDec = checkerC.decisions + cubeC.decisions;
  return {
    checker: checkerC,
    cube: cubeC,
    overall: { decisions: totalDec, equityLost: totalLost, pr: prValue(totalLost, totalDec) }
  };
}

// validator/analyzePr.ts
var INPUT_NAME = "onnx::Gemm_0";
var contactSession = null;
var raceSession = null;
function modelsDir() {
  if (process.env.MODELS_DIR) return process.env.MODELS_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "models");
}
async function init() {
  if (contactSession && raceSession) return;
  const dir2 = modelsDir();
  contactSession = await ort.InferenceSession.create(join(dir2, "contact.onnx"));
  raceSession = await ort.InferenceSession.create(join(dir2, "race.onnx"));
}
function switchSides(opp) {
  return [opp[3], opp[4], opp[5], opp[0], opp[1], opp[2]];
}
function terminalEquity(board, mover) {
  const opp = opponent(mover);
  if (board.off[opp] > 0) return 1;
  const [hs, he] = mover === WHITE ? [0, 6] : [18, 24];
  let bg = board.bar[opp] > 0;
  if (!bg) {
    for (let i = hs; i < he; i++) {
      const v = board.points[i];
      if (opp === WHITE && v > 0 || opp !== WHITE && v < 0) {
        bg = true;
        break;
      }
    }
  }
  return bg ? 3 : 2;
}
async function equityAfter(after, mover) {
  if (after.off[mover] === 15) return terminalEquity(after, mover);
  const opp = opponent(mover);
  const pos = toWildPos(after, opp);
  const phase = phaseOf(pos);
  const inputs = phase === "contact" ? contactInputs(pos) : raceInputs(pos);
  const session = phase === "contact" ? contactSession : raceSession;
  const n = phase === "contact" ? CONTACT_INPUTS : RACE_INPUTS;
  const tensor = new ort.Tensor("float32", inputs, [1, n]);
  const out = await session.run({ [INPUT_NAME]: tensor });
  const oppProbs = out[session.outputNames[0]].data;
  return equityFrom(switchSides(oppProbs.subarray(0, 6)));
}
function applyMove(state, steps, mover) {
  const s = cloneState(state);
  for (const st of steps) applyStep(s, st, mover);
  return s;
}
async function checkerRecord(pos, dice, playedSteps, matchLength, isMoney) {
  const mover = pos.turn;
  const state = cloneState(pos);
  state.dice = dice.slice();
  state.diceUsed = dice.map(() => false);
  const moves = generateMoves(state);
  if (moves.length <= 1) {
    return checkerDecision(0, 0, 0, moves.length, matchLength, isMoney);
  }
  let best = -Infinity;
  let worst = Infinity;
  for (const m of moves) {
    const eq = await equityAfter(applyMove(state, m.steps, mover), mover);
    if (eq > best) best = eq;
    if (eq < worst) worst = eq;
  }
  const chosenEq = await equityAfter(applyMove(state, playedSteps, mover), mover);
  return checkerDecision(best, chosenEq, worst, moves.length, matchLength, isMoney);
}
async function analyzePr(hc, log, matchLength = 1, isMoney = false) {
  await init();
  const decisions = [];
  for (const e of log) {
    if (e.player !== hc || !e.pos || !e.dice || !e.playedSteps) continue;
    decisions.push(await checkerRecord(e.pos, e.dice, e.playedSteps, matchLength, isMoney));
  }
  const s = summarize(decisions);
  return { ...s, pr: s.overall.pr, decisions: s.overall.decisions };
}

// validator/server.ts
var SECRET = process.env.VALIDATOR_SECRET || "";
var PORT = Number(process.env.VALIDATOR_PORT || process.env.PORT || 8090);
function send(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(s);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("bad-json"));
      }
    });
    req.on("error", reject);
  });
}
var LOG_IP = process.env.VALIDATOR_LOG_IP === "1";
var server = createServer(async (req, res) => {
  if (LOG_IP) {
    const xff = req.headers["x-forwarded-for"] || "";
    console.log(`[validator] ${req.method} ${req.url} from=${req.socket.remoteAddress} xff=${xff}`);
  }
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "tavla-validator" });
  }
  if (SECRET && req.headers["x-validator-secret"] !== SECRET) {
    return send(res, 401, { error: "unauthorized" });
  }
  try {
    const body = await readJson(req);
    if (req.method === "POST" && req.url === "/validate") {
      const r = validateTurn(body.state, body.steps);
      return send(res, 200, r);
    }
    if (req.method === "POST" && req.url === "/legal-moves") {
      const moves = generateMoves(body.state);
      return send(res, 200, { moves });
    }
    if (req.method === "POST" && req.url === "/analyze-pr") {
      const hc = body.hc === "white" || body.hc === "black" ? body.hc : null;
      const log = Array.isArray(body.log) ? body.log : null;
      if (!hc || !log) return send(res, 400, { error: "bad-request", detail: "hc/log gerekli" });
      const ml = typeof body.matchLength === "number" && body.matchLength >= 1 ? body.matchLength : 1;
      const r = await analyzePr(hc, log, ml, body.isMoney === true);
      return send(res, 200, r);
    }
    return send(res, 404, { error: "not-found" });
  } catch (e) {
    return send(res, 400, { error: "bad-request", detail: String(e?.message ?? e) });
  }
});
server.listen(PORT, () => {
  console.log(`[tavla-validator] listening on :${PORT}${SECRET ? " (secret on)" : ""}`);
});

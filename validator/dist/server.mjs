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
var server = createServer(async (req, res) => {
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
    return send(res, 404, { error: "not-found" });
  } catch (e) {
    return send(res, 400, { error: "bad-request", detail: String(e?.message ?? e) });
  }
});
server.listen(PORT, () => {
  console.log(`[tavla-validator] listening on :${PORT}${SECRET ? " (secret on)" : ""}`);
});

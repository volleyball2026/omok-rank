// ===================================================================
//  janggi_ai.js — 장기 연습 상대 AI (초등 교실용)
//  janggi.js 규칙 엔진 위에서 기물 가치 평가로 알파베타 탐색.
//  승리 = 궁(k) 포획. 난이도 easy/normal/hard = 탐색깊이 1/2/3.
//  JanggiAI.chooseMove(state, color, level) -> { from:[r,c], to:[r,c], why } | null
//  좌표: 한(r)=아래(행 8~9, 위로 전진) / 초(b)=위(행 0~1, 아래로 전진)
// ===================================================================
(function (root) {
  const Janggi = (typeof module !== "undefined" && module.exports) ? require("./janggi.js") : root.Janggi;

  // 장기 기물 가치(차13·포7·마5·상3·사3·병2 관례를 ×100). 궁은 매우 큼.
  const VAL = { c: 1300, o: 700, h: 500, e: 300, a: 300, p: 200, k: 100000 };
  const MATE = 5000000;

  // 한(r) 관점 평가(양수 = 한 유리)
  function evaluate(board) {
    let s = 0, rk = false, bk = false;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const side = p[0], t = p[1];
      if (t === "k") { if (side === "r") rk = true; else bk = true; }
      let v = VAL[t];
      // 병/졸은 강을 건너 전진할수록 가치가 오른다
      if (t === "p") v += side === "r" ? (9 - r) * 8 : r * 8;
      // 중앙 열(3~5) 소폭 보너스 — 공격 기물 활동성
      if ((t === "c" || t === "o" || t === "h") && c >= 2 && c <= 6) v += 6;
      s += side === "r" ? v : -v;
    }
    if (!rk) return -MATE;        // 한 궁 잡힘 = 초 승
    if (!bk) return MATE;         // 초 궁 잡힘 = 한 승
    return s;
  }

  const sign = (color) => (color === "r" ? 1 : -1);

  function allMoves(state, color) {
    const b = state.board, out = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = b[r][c];
      if (p && Janggi.col(p) === color) for (const m of Janggi.legalMoves(state, r, c)) out.push([[r, c], m]);
    }
    // 잡는 수 우선(알파베타 효율)
    out.sort((m1, m2) => capVal(b, m2) - capVal(b, m1));
    return out;
  }
  function capVal(b, m) {
    const victim = b[m[1][0]][m[1][1]];
    return victim ? VAL[victim[1]] : 0;
  }
  function kingGone(board) {
    let rk = false, bk = false;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p[1] === "k") { if (p[0] === "r") rk = true; else bk = true; }
    }
    if (!rk) return -MATE;
    if (!bk) return MATE;
    return null;
  }

  function negamax(state, depth, alpha, beta, color, ply) {
    const term = kingGone(state.board);                 // 궁이 잡힌 국면이면 즉시 종료
    if (term !== null) return sign(color) * (term > 0 ? MATE - ply : -MATE + ply);
    if (depth === 0) return sign(color) * evaluate(state.board);
    const moves = allMoves(state, color);
    if (!moves.length) return sign(color) * evaluate(state.board);   // 둘 곳 없음(희귀) — 정적 평가
    let best = -Infinity;
    for (const [from, to] of moves) {
      const ns = Janggi.applyMove(state, from, to).state;
      const score = -negamax(ns, depth - 1, -beta, -alpha, Janggi.opp(color), ply + 1);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  const DEPTH = { easy: 1, normal: 2, hard: 3 };

  function chooseMove(state, color, level) {
    const depth = DEPTH[level] || 2;
    const moves = allMoves(state, color);
    if (!moves.length) return null;
    const scored = moves.map(([from, to]) => {
      const ns = Janggi.applyMove(state, from, to).state;
      const score = -negamax(ns, depth - 1, -Infinity, Infinity, Janggi.opp(color), 1);
      return { from, to, score };
    });
    scored.sort((a, b) => b.score - a.score);

    let pick;
    if (level === "easy") {
      // 초급: 궁을 바로 잡을 수 있으면 잡고, 아니면 절반은 아무 수나(실수 포함)
      const kingCap = scored.find(s => capVal(state.board, [s.from, s.to]) >= VAL.k);
      if (kingCap) pick = kingCap;
      else if (Math.random() < 0.5) pick = scored[Math.floor(Math.random() * scored.length)];
      else pick = nearBest(scored, 250);
    } else if (level === "normal") {
      pick = nearBest(scored, 120);
    } else {
      pick = scored[0];
    }
    return { from: pick.from, to: pick.to, why: null };
  }

  function nearBest(scored, margin) {
    const best = scored[0].score;
    const near = scored.filter(s => s.score >= best - margin);
    return near[Math.floor(Math.random() * near.length)];
  }

  const api = { chooseMove, evaluate, _DEPTH: DEPTH };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.JanggiAI = api;
})(typeof window !== "undefined" ? window : globalThis);

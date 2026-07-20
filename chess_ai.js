// ===================================================================
//  chess_ai.js — 체스 연습 상대 AI (초등 교실용)
//  chess.js 규칙 엔진 위에서 material + piece-square 평가로 알파베타 탐색.
//  강한 엔진이 아니라 "연습 상대". 난이도 easy/normal/hard = 탐색깊이 1/2/3.
//  ChessAI.chooseMove(state, color, level) -> { from:[r,c], to:[r,c], promo, why } | null
// ===================================================================
(function (root) {
  const Chess = (typeof module !== "undefined" && module.exports) ? require("./chess.js") : root.Chess;

  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const MATE = 1000000;

  // piece-square table (백 기준, 행 0 = 흑 진영 = 8번째 랭크). 흑은 상하 반전해서 사용.
  const PST = {
    p: [ 0,0,0,0,0,0,0,0,  50,50,50,50,50,50,50,50,  10,10,20,30,30,20,10,10,
         5,5,10,25,25,10,5,5,  0,0,0,20,20,0,0,0,  5,-5,-10,0,0,-10,-5,5,
         5,10,10,-20,-20,10,10,5,  0,0,0,0,0,0,0,0 ],
    n: [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
         -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
         -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
    b: [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
         -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
         -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
    r: [ 0,0,0,0,0,0,0,0,  5,10,10,10,10,10,10,5,  -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
    q: [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
         -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
         -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
    k: [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
         -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
         20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
  };

  // 백 관점 평가(양수 = 백 유리). board[r][c] = "" | "wp".. | "bk"
  function evaluate(board) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const side = p[0], t = p[1];
      const idx = side === "w" ? r * 8 + c : (7 - r) * 8 + c;   // 흑은 행 반전
      const val = VAL[t] + (PST[t] ? PST[t][idx] : 0);
      s += side === "w" ? val : -val;
    }
    return s;
  }

  const sign = (color) => (color === "w" ? 1 : -1);

  // 캡처 우선 정렬(MVV-LVA 근사) — 알파베타 가지치기 효율
  function orderedMoves(state, color) {
    const moves = Chess.allLegalMoves(state, color);
    const b = state.board;
    moves.sort((m1, m2) => capScore(b, m2) - capScore(b, m1));
    return moves;
  }
  function capScore(b, m) {
    const victim = b[m[1][0]][m[1][1]];
    if (!victim) return 0;
    const attacker = b[m[0][0]][m[0][1]];
    return VAL[victim[1]] * 10 - (attacker ? VAL[attacker[1]] : 0);
  }

  function negamax(state, depth, alpha, beta, color, ply) {
    const moves = orderedMoves(state, color);
    if (!moves.length) {                                  // 합법수 없음 = 체크메이트/스테일메이트
      return Chess.inCheck(state.board, color) ? -MATE + ply : 0;
    }
    if (depth === 0) return sign(color) * evaluate(state.board);
    let best = -Infinity;
    for (const [from, to] of moves) {
      const promo = Chess.isPromotion(state, from, to) ? "q" : undefined;
      const ns = Chess.applyMove(state, from, to, promo);
      const score = -negamax(ns, depth - 1, -beta, -alpha, Chess.opp(color), ply + 1);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  const DEPTH = { easy: 1, normal: 2, hard: 3 };

  function chooseMove(state, color, level) {
    const depth = DEPTH[level] || 2;
    const moves = orderedMoves(state, color);
    if (!moves.length) return null;
    const scored = moves.map(([from, to]) => {
      const promo = Chess.isPromotion(state, from, to) ? "q" : undefined;
      const ns = Chess.applyMove(state, from, to, promo);
      const score = -negamax(ns, depth - 1, -Infinity, Infinity, Chess.opp(color), 1);
      return { from, to, promo, score };
    });
    scored.sort((a, b) => b.score - a.score);

    let pick;
    if (level === "easy") {
      // 초급: 절반 정도는 아무 수나(실수 포함) 둬서 이기기 쉽게. 단, 공짜로 큰 기물 잡을 수 있으면 잡는다.
      const bigCap = scored.find(s => s.score >= scored[0].score - 5 && capScore(state.board, [s.from, s.to]) >= 300);
      if (bigCap && Math.random() < 0.7) pick = bigCap;
      else if (Math.random() < 0.5) pick = scored[Math.floor(Math.random() * scored.length)];
      else pick = nearBest(scored, 80);
    } else if (level === "normal") {
      pick = nearBest(scored, 30);   // 최선 근처에서 약간의 변화
    } else {
      pick = scored[0];              // 고급: 최선
    }
    return { from: pick.from, to: pick.to, promo: pick.promo, why: null };
  }

  // 최선 점수에서 margin 이내의 수 중 무작위 (같은 판이 반복되지 않게)
  function nearBest(scored, margin) {
    const best = scored[0].score;
    const near = scored.filter(s => s.score >= best - margin);
    return near[Math.floor(Math.random() * near.length)];
  }

  const api = { chooseMove, evaluate, _DEPTH: DEPTH };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ChessAI = api;
})(typeof window !== "undefined" ? window : globalThis);

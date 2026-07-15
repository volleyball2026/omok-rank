/*
 * 체스 규칙 엔진 - 순수 로직 (DOM 의존 없음)
 * 보드: board[r][c], r=0 위(흑 진영) ~ r=7 아래(백 진영). 백이 먼저(위로), 흑은 아래로 이동.
 * 기물 문자열: 색(w|b) + 종류(k q r b n p), 빈칸 ''.
 * 지원: 모든 기물 이동, 체크/체크메이트/스테일메이트, 캐슬링, 폰 승격(기본 퀸).
 * 미지원(교실용 단순화): 앙파상, 50수·3회동형 무승부.
 */
(function (root) {
  const opp = c => (c === "w" ? "b" : "w");
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const colorOf = p => (p ? p[0] : "");
  const typeOf = p => (p ? p[1] : "");
  const clone = b => b.map(row => row.slice());

  function initialBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(""));
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    for (let c = 0; c < 8; c++) { b[0][c] = "b" + back[c]; b[1][c] = "bp"; b[6][c] = "wp"; b[7][c] = "w" + back[c]; }
    return b;
  }
  const initialState = () => ({ board: initialBoard(), turn: "w", castling: { wK: true, wQ: true, bK: true, bQ: true } });

  function kingPos(b, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === color + "k") return [r, c];
    return null;
  }

  // (r,c)가 by색에게 공격받는가?
  function isAttacked(b, r, c, by) {
    const pr = r + (by === "w" ? 1 : -1);          // by색 폰의 위치
    for (const dc of [-1, 1]) if (inside(pr, c + dc) && b[pr][c + dc] === by + "p") return true;
    for (const [dr, dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) {
      const nr = r + dr, nc = c + dc; if (inside(nr, nc) && b[nr][nc] === by + "n") return true;
    }
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue; const nr = r + dr, nc = c + dc;
      if (inside(nr, nc) && b[nr][nc] === by + "k") return true;
    }
    for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) { const p = b[nr][nc]; if (p) { if (colorOf(p) === by && (typeOf(p) === "b" || typeOf(p) === "q")) return true; break; } nr += dr; nc += dc; }
    }
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) { const p = b[nr][nc]; if (p) { if (colorOf(p) === by && (typeOf(p) === "r" || typeOf(p) === "q")) return true; break; } nr += dr; nc += dc; }
    }
    return false;
  }
  function inCheck(b, color) { const k = kingPos(b, color); return k ? isAttacked(b, k[0], k[1], opp(color)) : false; }

  // 유사합법 이동(왕 안전 미검사)
  function pseudoMoves(b, r, c) {
    const p = b[r][c]; if (!p) return [];
    const color = colorOf(p), t = typeOf(p), moves = [];
    const add = (nr, nc) => { if (!inside(nr, nc)) return false; const q = b[nr][nc]; if (!q) { moves.push([nr, nc]); return true; } if (colorOf(q) !== color) moves.push([nr, nc]); return false; };
    if (t === "p") {
      const dir = color === "w" ? -1 : 1, start = color === "w" ? 6 : 1;
      if (inside(r + dir, c) && !b[r + dir][c]) { moves.push([r + dir, c]); if (r === start && !b[r + 2 * dir][c]) moves.push([r + 2 * dir, c]); }
      for (const dc of [-1, 1]) { const nr = r + dir, nc = c + dc; if (inside(nr, nc) && b[nr][nc] && colorOf(b[nr][nc]) !== color) moves.push([nr, nc]); }
    } else if (t === "n") {
      for (const [dr, dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) add(r + dr, c + dc);
    } else if (t === "k") {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
    } else {
      const dirs = t === "b" ? [[1,1],[1,-1],[-1,1],[-1,-1]] : t === "r" ? [[1,0],[-1,0],[0,1],[0,-1]]
        : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dr, dc] of dirs) { let nr = r + dr, nc = c + dc; while (add(nr, nc)) { nr += dr; nc += dc; } }
    }
    return moves;
  }

  // 합법 이동(왕 안전 + 캐슬링). 반환 [[r,c], ... , 캐슬은 [r,c,'castleK'|'castleQ']]
  function legalMoves(state, r, c) {
    const b = state.board, p = b[r][c];
    if (!p || colorOf(p) !== state.turn) return [];
    const color = colorOf(p), res = [];
    for (const [nr, nc] of pseudoMoves(b, r, c)) {
      const nb = clone(b); nb[nr][nc] = p; nb[r][c] = "";
      const k = kingPos(nb, color);
      if (!isAttacked(nb, k[0], k[1], opp(color))) res.push([nr, nc]);
    }
    if (typeOf(p) === "k" && !inCheck(b, color)) {
      const rights = state.castling, row = color === "w" ? 7 : 0;
      if (r === row && c === 4) {
        const K = color === "w" ? rights.wK : rights.bK, Q = color === "w" ? rights.wQ : rights.bQ;
        if (K && !b[row][5] && !b[row][6] && b[row][7] === color + "r"
          && !isAttacked(b, row, 5, opp(color)) && !isAttacked(b, row, 6, opp(color))) res.push([row, 6, "castleK"]);
        if (Q && !b[row][3] && !b[row][2] && !b[row][1] && b[row][0] === color + "r"
          && !isAttacked(b, row, 3, opp(color)) && !isAttacked(b, row, 2, opp(color))) res.push([row, 2, "castleQ"]);
      }
    }
    return res;
  }

  // 이동 적용 -> 새 state. promo: 승격 기물종류(기본 'q')
  function applyMove(state, from, to, promo) {
    const [fr, fc] = from, [tr, tc] = to;
    const b = clone(state.board), p = b[fr][fc], color = colorOf(p), t = typeOf(p);
    b[tr][tc] = p; b[fr][fc] = "";
    if (t === "k" && Math.abs(tc - fc) === 2) {           // 캐슬링: 룩도 이동
      if (tc === 6) { b[fr][5] = b[fr][7]; b[fr][7] = ""; }
      else if (tc === 2) { b[fr][3] = b[fr][0]; b[fr][0] = ""; }
    }
    if (t === "p" && (tr === 0 || tr === 7)) b[tr][tc] = color + (promo || "q");  // 승격
    const cast = { ...state.castling };
    if (t === "k") { if (color === "w") { cast.wK = cast.wQ = false; } else { cast.bK = cast.bQ = false; } }
    const touch = (r, c) => {
      if (r === 7 && c === 0) cast.wQ = false; if (r === 7 && c === 7) cast.wK = false;
      if (r === 0 && c === 0) cast.bQ = false; if (r === 0 && c === 7) cast.bK = false;
    };
    touch(fr, fc); touch(tr, tc);
    return { board: b, turn: opp(color), castling: cast };
  }

  function allLegalMoves(state, color) {
    const b = state.board, out = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
      if (b[r][c] && colorOf(b[r][c]) === color) for (const m of legalMoves(state, r, c)) out.push([[r, c], m]);
    return out;
  }

  // 폰이 승격 위치로 가는 이동인가?
  function isPromotion(state, from, to) {
    const p = state.board[from[0]][from[1]];
    return typeOf(p) === "p" && (to[0] === 0 || to[0] === 7);
  }

  function status(state) {
    const color = state.turn;
    const has = allLegalMoves(state, color).length > 0;
    const chk = inCheck(state.board, color);
    if (!has) return chk ? "checkmate" : "stalemate";
    return chk ? "check" : "playing";
  }

  const api = { initialState, legalMoves, applyMove, allLegalMoves, status, inCheck, isAttacked, kingPos, isPromotion, opp, colorOf, typeOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Chess = api;
})(typeof window !== "undefined" ? window : globalThis);

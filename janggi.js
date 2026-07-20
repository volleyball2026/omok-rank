/*
 * 장기(將棋) 규칙 엔진 - 순수 로직 (DOM 의존 없음)
 * 보드: board[r][c], 10행(r 0~9) x 9열(c 0~8). 위(r 0~2)=초(b, green), 아래(r 7~9)=한(r, red).
 * 한(아래)은 위로(r 감소), 초(위)는 아래로(r 증가) 진행. 한(아래)이 선공.
 * 기물: 색(r|b)+종류 k(궁) a(사) c(차) o(포) h(마) e(상) p(졸/병). 빈칸 ''.
 * 승리: 상대 궁(k)을 잡으면 승리. (체크메이트 자동판정 대신 궁 포획 방식)
 * 정확 구현: 차·포(넘기)·마상(다리막힘)·궁성 대각선(궁/사/차/포/졸). 미구현: 빅장(대궁) 규칙.
 */
(function (root) {
  const opp = c => (c === "r" ? "b" : "r");
  const inB = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
  const col = p => (p ? p[0] : "");
  const typ = p => (p ? p[1] : "");
  const clone = b => b.map(row => row.slice());
  const inPalace = (r, c) => c >= 3 && c <= 5 && (r >= 0 && r <= 2 || r >= 7 && r <= 9);
  const DIAG = new Set(["0,3","0,5","1,4","2,3","2,5","7,3","7,5","8,4","9,3","9,5"]);
  const isDiag = (r, c) => DIAG.has(r + "," + c);

  function initialBoard() {
    const b = Array.from({ length: 10 }, () => Array(9).fill(""));
    const back = ["c","h","e","a",null,"a","e","h","c"];
    for (let c = 0; c < 9; c++) if (back[c]) { b[0][c] = "b" + back[c]; b[9][c] = "r" + back[c]; }
    b[1][4] = "bk"; b[8][4] = "rk";
    b[2][1] = "bo"; b[2][7] = "bo"; b[7][1] = "ro"; b[7][7] = "ro";
    for (const c of [0,2,4,6,8]) { b[3][c] = "bp"; b[6][c] = "rp"; }
    return b;
  }
  const initialState = () => ({ board: initialBoard(), turn: "r" });   // 한(아래) 선공

  function palaceStep(b, r, c, color) {
    const res = [];
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r+dr, nc = c+dc; if (inPalace(nr,nc) && col(b[nr][nc]) !== color) res.push([nr,nc]);
    }
    if (isDiag(r,c)) for (const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nr = r+dr, nc = c+dc; if (inPalace(nr,nc) && isDiag(nr,nc) && col(b[nr][nc]) !== color) res.push([nr,nc]);
    }
    return res;
  }
  function slideOrtho(b, r, c, color) {
    const res = [];
    for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let nr=r+dr, nc=c+dc;
      while (inB(nr,nc)) { const q=b[nr][nc]; if (!q) res.push([nr,nc]); else { if (col(q)!==color) res.push([nr,nc]); break; } nr+=dr; nc+=dc; }
    }
    return res;
  }
  function chariot(b, r, c, color) {
    const res = slideOrtho(b, r, c, color);
    if (isDiag(r,c)) for (const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      let nr=r+dr, nc=c+dc;
      while (inB(nr,nc) && isDiag(nr,nc)) { const q=b[nr][nc]; if (!q) res.push([nr,nc]); else { if (col(q)!==color) res.push([nr,nc]); break; } nr+=dr; nc+=dc; }
    }
    return res;
  }
  function cannon(b, r, c, color) {
    const res = [];
    const ray = (dr, dc, diagOnly) => {
      let nr=r+dr, nc=c+dc, jumped=false;
      while (inB(nr,nc) && (!diagOnly || isDiag(nr,nc))) {
        const q = b[nr][nc];
        if (!jumped) { if (q) { if (typ(q)==="o") break; jumped=true; } }
        else { if (!q) res.push([nr,nc]); else { if (typ(q)!=="o" && col(q)!==color) res.push([nr,nc]); break; } }
        nr+=dr; nc+=dc;
      }
    };
    for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) ray(dr,dc,false);
    if (isDiag(r,c)) for (const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) ray(dr,dc,true);
    return res;
  }
  function horse(b, r, c, color) {
    const res = [];
    const M = [[[-1,0],[-2,-1]],[[-1,0],[-2,1]],[[1,0],[2,-1]],[[1,0],[2,1]],
               [[0,-1],[-1,-2]],[[0,-1],[1,-2]],[[0,1],[-1,2]],[[0,1],[1,2]]];
    for (const [[lr,lc],[tr,tc]] of M) {
      if (!inB(r+lr,c+lc) || b[r+lr][c+lc]) continue;         // 다리 막힘
      const nr=r+tr, nc=c+tc; if (inB(nr,nc) && col(b[nr][nc])!==color) res.push([nr,nc]);
    }
    return res;
  }
  function elephant(b, r, c, color) {
    const res = [];
    const M = [[[-1,0],[-2,-1],[-3,-2]],[[-1,0],[-2,1],[-3,2]],[[1,0],[2,-1],[3,-2]],[[1,0],[2,1],[3,2]],
               [[0,-1],[-1,-2],[-2,-3]],[[0,-1],[1,-2],[2,-3]],[[0,1],[-1,2],[-2,3]],[[0,1],[1,2],[2,3]]];
    for (const [[l1r,l1c],[l2r,l2c],[tr,tc]] of M) {
      if (!inB(r+l1r,c+l1c) || b[r+l1r][c+l1c]) continue;
      if (!inB(r+l2r,c+l2c) || b[r+l2r][c+l2c]) continue;
      const nr=r+tr, nc=c+tc; if (inB(nr,nc) && col(b[nr][nc])!==color) res.push([nr,nc]);
    }
    return res;
  }
  function soldier(b, r, c, color) {
    const res = [], fwd = color === "r" ? -1 : 1;
    for (const [dr,dc] of [[fwd,0],[0,-1],[0,1]]) {
      const nr=r+dr, nc=c+dc; if (inB(nr,nc) && col(b[nr][nc])!==color) res.push([nr,nc]);
    }
    if (isDiag(r,c)) for (const dc of [-1,1]) {
      const nr=r+fwd, nc=c+dc; if (inB(nr,nc) && isDiag(nr,nc) && col(b[nr][nc])!==color) res.push([nr,nc]);
    }
    return res;
  }
  function legalMoves(state, r, c) {
    const b = state.board, p = b[r][c];
    if (!p || col(p) !== state.turn) return [];
    const color = col(p), t = typ(p);
    if (t === "k" || t === "a") return palaceStep(b, r, c, color);
    if (t === "c") return chariot(b, r, c, color);
    if (t === "o") return cannon(b, r, c, color);
    if (t === "h") return horse(b, r, c, color);
    if (t === "e") return elephant(b, r, c, color);
    if (t === "p") return soldier(b, r, c, color);
    return [];
  }
  function applyMove(state, from, to) {
    const b = clone(state.board);
    const captured = b[to[0]][to[1]];
    b[to[0]][to[1]] = b[from[0]][from[1]]; b[from[0]][from[1]] = "";
    return { state: { board: b, turn: opp(state.turn) }, captured };
  }
  function kingAlive(board, color) {
    for (let r=0;r<10;r++) for (let c=0;c<9;c++) if (board[r][c] === color + "k") return true;
    return false;
  }

  const api = { initialState, legalMoves, applyMove, kingAlive, inPalace, isDiag, opp, col, typ };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Janggi = api;
})(typeof window !== "undefined" ? window : globalThis);

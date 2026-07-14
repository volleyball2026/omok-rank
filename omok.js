/*
 * 오목 렌주룰(Renju) 규칙 엔진 - 순수 로직 (DOM 의존 없음)
 *
 * 렌주룰 요약:
 *  - 15x15 판. 흑이 먼저 둔다.
 *  - 흑(선공)에게만 금수(禁手)가 있다:
 *      · 삼삼(3-3): 열린 3을 두 개 동시에 만드는 수
 *      · 사사(4-4): 4를 두 개 동시에 만드는 수
 *      · 장목(6목 이상): 6개 이상 연속
 *  - 흑은 '정확히 5목'으로만 승리. 6목(장목)은 승리가 아니라 금수.
 *  - 백(후공)은 제약이 없고, 5목 이상이면 무조건 승리.
 *  - 5를 완성하는 수는 (금수 모양과 겹쳐도) 승리로 인정.
 *
 * 주의: 대회 수준의 '재귀적 금수(금수점을 이용한 3/4의 성립 여부)'까지는
 *       다루지 않습니다. 교실 대국에서 나오는 삼삼/사사/장목은 정확히 판정합니다.
 */
(function (root) {
  const N = 15;
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function createBoard() {
    return Array.from({ length: N }, () => new Array(N).fill(EMPTY));
  }

  function inBounds(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  // (r,c)에 color 를 둔다고 가정하고, 한 방향으로 9칸 문자열을 만든다.
  // '1' = 내 돌(color), '2' = 상대 돌 또는 벽, '0' = 빈칸. 가운데(index 4)는 항상 '1'.
  function lineString(board, r, c, dr, dc, color) {
    let s = "";
    for (let k = -4; k <= 4; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr === r && cc === c) { s += "1"; continue; }
      if (!inBounds(rr, cc)) { s += "2"; continue; }
      const v = board[rr][cc];
      s += v === EMPTY ? "0" : (v === color ? "1" : "2");
    }
    return s;
  }

  // 가운데(index 4)를 지나는 연속된 '1'의 길이
  function centerRun(s) {
    let cnt = 1;
    for (let i = 3; i >= 0 && s[i] === "1"; i--) cnt++;
    for (let i = 5; i < s.length && s[i] === "1"; i++) cnt++;
    return cnt;
  }

  // 이 방향이 '4' 인가? (빈칸 하나를 채우면 가운데를 지나는 정확히 5목이 되는가)
  function isFour(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== "0") continue;
      const t = s.slice(0, i) + "1" + s.slice(i + 1);
      if (centerRun(t) === 5) return true;
    }
    return false;
  }

  // 이 방향이 '열린 3(활삼)' 인가? (빈칸 하나를 채우면 양끝이 열린 4(011110)가 되는가)
  function isOpenThree(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== "0") continue;
      const t = s.slice(0, i) + "1" + s.slice(i + 1);
      if (t.includes("011110")) return true;
    }
    return false;
  }

  /*
   * (r,c)에 color 를 두는 수를 분석한다. board[r][c] 는 비어 있어야 한다.
   * 반환:
   *   { win: true }                      -> 이 수로 승리
   *   { forbidden: "삼삼(3-3)" }         -> 흑 금수 (둘 수 없음)
   *   { ok: true }                       -> 정상적으로 둘 수 있는 수
   */
  function analyze(board, r, c, color) {
    if (!inBounds(r, c) || board[r][c] !== EMPTY) return { illegal: true };

    // 백: 5목 이상이면 승리, 금수 없음
    if (color === WHITE) {
      for (const [dr, dc] of DIRS) {
        if (centerRun(lineString(board, r, c, dr, dc, WHITE)) >= 5) return { win: true };
      }
      return { ok: true };
    }

    // 흑: 5목 승리 우선, 그다음 금수(장목/사사/삼삼) 검사
    let fives = 0, overline = false, fours = 0, threes = 0;
    for (const [dr, dc] of DIRS) {
      const s = lineString(board, r, c, dr, dc, BLACK);
      const run = centerRun(s);
      if (run === 5) fives++;
      if (run >= 6) overline = true;
      if (run !== 5) {
        if (isFour(s)) fours++;
        else if (isOpenThree(s)) threes++;
      }
    }
    if (fives > 0) return { win: true };          // 5목 완성은 금수보다 우선
    if (overline) return { forbidden: "장목(6목)" };
    if (fours >= 2) return { forbidden: "사사(4-4)" };
    if (threes >= 2) return { forbidden: "삼삼(3-3)" };
    return { ok: true };
  }

  // 판이 꽉 찼는가? (무승부 판정)
  function isFull(board) {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (board[r][c] === EMPTY) return false;
    return true;
  }

  // 지금 흑이 둘 수 없는 금수 자리 목록 (미리보기용). [[r,c,사유], ...]
  function forbiddenPoints(board) {
    const pts = [];
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== EMPTY) continue;
        const res = analyze(board, r, c, BLACK);
        if (res.forbidden) pts.push([r, c, res.forbidden]);
      }
    return pts;
  }

  const api = { N, EMPTY, BLACK, WHITE, createBoard, analyze, inBounds, isFull, forbiddenPoints };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Omok = api;
})(typeof window !== "undefined" ? window : globalThis);

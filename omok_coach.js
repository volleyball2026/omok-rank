/*
 * 오목 코치 엔진 — 순수 로직 (DOM 의존 없음)
 *
 * omok.js(규칙 엔진) 위에 '실전 개념'을 얹는다.
 *
 *  [모양(shape)]
 *    · 열린4(활사) — 양쪽으로 5를 만들 수 있는 4. 막을 수 없다.
 *    · 4(단사/충사) — 5가 되는 자리가 딱 하나. 상대는 반드시 막아야 한다(선수).
 *    · 열린3(활삼) — 한 수 더 두면 열린4가 되는 3. 상대는 반드시 대응해야 한다(선수).
 *
 *  [이중위협]
 *    · 사삼(4-3) — 4와 열린3을 동시에. 상대가 4를 막으면 열린4가 되어 이긴다.
 *    · 삼삼(3-3) — 열린3 둘. (흑은 금수, 백은 강력한 승리수)
 *    · 사사(4-4) — 4 둘. (흑은 금수, 백은 즉승)
 *
 *  [VCF] Victory by Continuous Fours — 4로만 계속 몰아서 이기는 수순.
 *        상대는 4를 막을 수밖에 없으므로 수순이 강제된다. 사삼은 VCF 2수와 같다.
 *
 *  [정석] 렌주 26주형. 흑1=천원, 백2=인접(직접/간접), 흑3=5x5 이내.
 *        좌표·이름 출처: RenjuNet 공식 다이어그램 (https://www.renju.net/openings/)
 */
(function (root) {
  const Omok = (typeof module !== "undefined" && module.exports)
    ? require("./omok.js") : root.Omok;

  const N = 15, EMPTY = 0, BLACK = 1, WHITE = 2;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const SPAN = 5, CEN = SPAN;              // 라인 문자열 길이 11, 가운데 index 5

  const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const other = (col) => col === BLACK ? WHITE : BLACK;
  const clone = (b) => b.map(x => x.slice());
  function place(b, r, c, col) { const n = clone(b); n[r][c] = col; return n; }

  // (r,c)에 col 을 둔다고 가정한 한 방향 문자열. '1'=내돌, '2'=상대돌/벽, '0'=빈칸
  function lineStr(board, r, c, dr, dc, col) {
    let s = "";
    for (let k = -SPAN; k <= SPAN; k++) {
      if (k === 0) { s += "1"; continue; }
      const rr = r + dr * k, cc = c + dc * k;
      if (!inB(rr, cc)) { s += "2"; continue; }
      const v = board[rr][cc];
      s += v === EMPTY ? "0" : (v === col ? "1" : "2");
    }
    return s;
  }
  function centerRun(s) {
    let n = 1;
    for (let i = CEN - 1; i >= 0 && s[i] === "1"; i--) n++;
    for (let i = CEN + 1; i < s.length && s[i] === "1"; i++) n++;
    return n;
  }
  const fill = (s, i) => s.slice(0, i) + "1" + s.slice(i + 1);
  // 흑은 '정확히 5'만 승리(6목은 장목 금수), 백은 5 이상이면 승리
  const isFive = (run, col) => col === BLACK ? run === 5 : run >= 5;

  // 이 방향에서 '한 칸만 더 채우면 5' 가 되는 빈칸들의 index
  function winIdx(s, col) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== "0") continue;
      if (isFive(centerRun(fill(s, i)), col)) out.push(i);
    }
    return out;
  }

  // 한 방향의 모양: five | openFour | four | openThree | none
  function dirKind(s, col) {
    const run = centerRun(s);
    if (isFive(run, col)) return "five";
    if (col === BLACK && run >= 6) return "overline";
    const w = winIdx(s, col).length;
    if (w >= 2) return "openFour";
    if (w === 1) return "four";
    // 열린3 = 한 칸 채우면 열린4(5가 되는 자리가 둘)가 되는 모양
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== "0") continue;
      const t = fill(s, i);
      if (isFive(centerRun(t), col)) continue;
      if (winIdx(t, col).length >= 2) return "openThree";
    }
    return "none";
  }

  /*
   * (r,c)에 col 을 두는 수를 분석한다.
   *   { illegal }                         둘 수 없는 자리
   *   { forbidden:"삼삼(3-3)" }            흑 금수
   *   { win:true }                        5목 완성
   *   { openFour, four, openThree,        만들어지는 모양의 개수(방향 수)
   *     winPts:[[r,c]...] }               이 수를 둔 뒤 '다음 수에 즉시 5' 가 되는 자리들
   */
  function moveInfo(board, r, c, col) {
    const a = Omok.analyze(board, r, c, col);
    if (a.illegal) return { illegal: true };
    if (a.win) return { win: true, winPts: [], openFour: 0, four: 0, openThree: 0 };
    if (a.forbidden) return { forbidden: a.forbidden, winPts: [], openFour: 0, four: 0, openThree: 0 };

    let openFour = 0, four = 0, openThree = 0;
    const winPts = [];
    for (const [dr, dc] of DIRS) {
      const s = lineStr(board, r, c, dr, dc, col);
      const kind = dirKind(s, col);
      if (kind === "openFour") openFour++;
      else if (kind === "four") four++;
      else if (kind === "openThree") openThree++;
      if (kind === "openFour" || kind === "four") {
        for (const i of winIdx(s, col)) {
          const k = i - CEN;
          winPts.push([r + dr * k, c + dc * k]);
        }
      }
    }
    return { ok: true, openFour, four, openThree, winPts };
  }

  // 지금 즉시 5를 완성할 수 있는 자리들
  function winPoints(board, col) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (board[r][c] !== EMPTY) continue;
      if (Omok.analyze(board, r, c, col).win) out.push([r, c]);
    }
    return out;
  }

  // 열린3을 만드는 자리들 (선수 위협)
  function openThreePoints(board, col) {
    const out = [];
    for (const [r, c] of nearCells(board, 2)) {
      const m = moveInfo(board, r, c, col);
      if (m.ok && m.openThree > 0 && m.winPts.length === 0) out.push([r, c]);
    }
    return out;
  }

  // 이중위협(사삼/삼삼/사사/열린4)을 만들어 이기는 자리들
  function doubleThreatPoints(board, col) {
    const out = [];
    for (const [r, c] of nearCells(board, 2)) {
      const m = moveInfo(board, r, c, col);
      if (!m.ok) continue;
      if (m.openFour > 0) { out.push({ at: [r, c], kind: "열린4" }); continue; }
      if (m.four >= 2) { out.push({ at: [r, c], kind: "사사(4-4)" }); continue; }
      if (m.four >= 1 && m.openThree >= 1) { out.push({ at: [r, c], kind: "사삼(4-3)" }); continue; }
      if (m.openThree >= 2) { out.push({ at: [r, c], kind: "삼삼(3-3)" }); continue; }
    }
    return out;
  }

  // 돌 주변 dist 칸 이내의 빈칸 (탐색 범위 축소용)
  function nearCells(board, dist) {
    const seen = new Set(), out = [];
    let any = false;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (board[r][c] === EMPTY) continue;
      any = true;
      for (let dr = -dist; dr <= dist; dr++) for (let dc = -dist; dc <= dist; dc++) {
        const rr = r + dr, cc = c + dc;
        if (!inB(rr, cc) || board[rr][cc] !== EMPTY) continue;
        const k = rr * N + cc;
        if (seen.has(k)) continue;
        seen.add(k); out.push([rr, cc]);
      }
    }
    if (!any) out.push([7, 7]);
    return out;
  }

  /*
   * VCF — 4로만 계속 몰아서 이기는 수순을 찾는다.
   * depth = 내가 두는 수의 최대 개수.
   * 반환: [[r,c](내수), [r,c](상대 강제응수), ...] 또는 null
   */
  function findVCF(board, col, depth) {
    if (depth <= 0) return null;
    const opp = other(col);

    // 이미 즉시 5를 만들 수 있으면 그걸로 끝
    const mine = winPoints(board, col);
    if (mine.length) return [mine[0]];

    // 상대가 즉시 5를 만들 수 있으면, 그 자리를 막으면서 4를 만들어야만 계속 몰 수 있다
    const oppWin = winPoints(board, opp);
    if (oppWin.length > 1) return null;

    const cands = [];
    for (const [r, c] of nearCells(board, 2)) {
      if (oppWin.length === 1 && !(oppWin[0][0] === r && oppWin[0][1] === c)) continue;
      const m = moveInfo(board, r, c, col);
      if (!m.ok) continue;
      if (m.winPts.length >= 2) return [[r, c]];   // 열린4·사사 → 상대가 다 막을 수 없다
      if (m.winPts.length === 1) cands.push([r, c, m.winPts[0]]);
    }
    for (const [r, c, w] of cands) {
      const b1 = place(board, r, c, col);
      // 상대는 4를 막을 수밖에 없다. 단, 막는 수가 상대의 5를 만들면 상대 승.
      if (Omok.analyze(b1, w[0], w[1], opp).win) continue;
      const b2 = place(b1, w[0], w[1], opp);
      const sub = findVCF(b2, col, depth - 1);
      if (sub) return [[r, c], w, ...sub];
    }
    return null;
  }

  // ==================== 렌주 26주형 ====================
  // 흑1 = 천원[7][7], 백2 = 인접, 흑3 = 5x5 이내.
  // 아래 오프셋은 천원 기준 [행, 열] (행: 음수=위, 열: 양수=오른쪽)
  // 정규형: 직접 = 백2가 (-1, 0) / 간접 = 백2가 (-1, +1)
  const OPENINGS_DIRECT = [
    { n: "한성", h: "寒星", d: [-2, 0] }, { n: "계월", h: "溪月", d: [-2, 1] },
    { n: "소성", h: "疎星", d: [-2, 2] }, { n: "화월", h: "花月", d: [-1, 1] },
    { n: "잔월", h: "殘月", d: [-1, 2] }, { n: "우월", h: "雨月", d: [0, 1] },
    { n: "금성", h: "金星", d: [0, 2] }, { n: "송월", h: "松月", d: [1, 0] },
    { n: "구월", h: "丘月", d: [1, 1] }, { n: "신월", h: "新月", d: [1, 2] },
    { n: "서성", h: "瑞星", d: [2, 0] }, { n: "산월", h: "山月", d: [2, 1] },
    { n: "유성", h: "遊星", d: [2, 2] },
  ];
  const OPENINGS_INDIRECT = [
    { n: "장성", h: "長星", d: [-2, 2] }, { n: "협월", h: "峽月", d: [-1, 2] },
    { n: "항성", h: "恒星", d: [0, 2] }, { n: "수월", h: "水月", d: [1, 2] },
    { n: "유성", h: "流星", d: [2, 2] }, { n: "운월", h: "雲月", d: [0, 1] },
    { n: "포월", h: "浦月", d: [1, 1] }, { n: "남월", h: "嵐月", d: [2, 1] },
    { n: "은월", h: "銀月", d: [1, 0] }, { n: "명성", h: "明星", d: [2, 0] },
    { n: "사월", h: "斜月", d: [1, -1] }, { n: "명월", h: "名月", d: [2, -1] },
    { n: "혜성", h: "彗星", d: [2, -2] },
  ];
  // 정사각형의 8가지 대칭 변환
  const SYM = [
    ([r, c]) => [r, c], ([r, c]) => [r, -c], ([r, c]) => [-r, c], ([r, c]) => [-r, -c],
    ([r, c]) => [c, r], ([r, c]) => [c, -r], ([r, c]) => [-c, r], ([r, c]) => [-c, -r],
  ];
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];

  /*
   * 첫 3수로 렌주 주형(정석)을 판별한다.
   * moves = [[r,c], ...] (흑,백,흑 순). 3수 미만이면 null.
   * 반환: { name, hanja, type:"직접"|"간접", index } 또는 null
   */
  function opening(moves) {
    if (!moves || moves.length < 3) return null;
    const [m1, m2, m3] = moves;
    if (!eq(m1, [7, 7])) return null;                       // 흑1이 천원이 아니면 주형 아님
    const o2 = [m2[0] - 7, m2[1] - 7], o3 = [m3[0] - 7, m3[1] - 7];
    if (Math.max(Math.abs(o2[0]), Math.abs(o2[1])) !== 1) return null;
    if (Math.max(Math.abs(o3[0]), Math.abs(o3[1])) > 2) return null;
    for (const t of SYM) {
      const w = t(o2), b = t(o3);
      let table = null, type = null;
      if (eq(w, [-1, 0])) { table = OPENINGS_DIRECT; type = "직접"; }
      else if (eq(w, [-1, 1])) { table = OPENINGS_INDIRECT; type = "간접"; }
      else continue;
      const i = table.findIndex(o => eq(o.d, b));
      if (i >= 0) return { name: table[i].n, hanja: table[i].h, type, index: i + 1 };
    }
    return null;
  }

  // ==================== 복기 코칭 ====================
  const GRADE = {
    brilliant: { icon: "⭐", label: "최고의 수", cls: "good" },
    good: { icon: "👍", label: "좋은 수", cls: "good" },
    ok: { icon: "•", label: "무난한 수", cls: "tip" },
    inaccuracy: { icon: "🤔", label: "아쉬운 수", cls: "miss" },
    mistake: { icon: "❗", label: "실수", cls: "miss" },
    blunder: { icon: "💥", label: "큰 실수", cls: "warn" },
  };
  const P = (rc) => `${rc[0] + 1}행 ${rc[1] + 1}열`;

  function boardAt(moves, upto) {
    const b = Omok.createBoard();
    for (let i = 0; i < upto; i++) b[moves[i][0]][moves[i][1]] = i % 2 === 0 ? BLACK : WHITE;
    return b;
  }

  /*
   * idx 번째 수(1-based)를 평가한다.
   * 반환 { grade, icon, label, cls, text, hint:[r,c]|null, marks:[[r,c]...] }
   */
  function reviewMove(moves, idx, opts) {
    const vcfDepth = (opts && opts.vcfDepth) || 4;
    const before = boardAt(moves, idx - 1);
    const mv = moves[idx - 1];
    const col = (idx - 1) % 2 === 0 ? BLACK : WHITE;
    const opp = other(col);
    const me = col === BLACK ? "⚫흑" : "⚪백";
    const you = col === BLACK ? "⚪백" : "⚫흑";
    const G = (g, text, extra) => Object.assign({ grade: g, text }, GRADE[g], extra || {});

    // 1) 이 수로 이겼나
    const info = moveInfo(before, mv[0], mv[1], col);
    if (info.win) return G("brilliant", "5목 완성! 이 판을 이겼어요. 축하해요 🎉");
    if (info.forbidden) return G("blunder", `${info.forbidden} 금수예요. 흑은 이 자리에 둘 수 없어요.`);

    // 2) 즉시 이길 수 있었는데 놓쳤나
    const myWin = winPoints(before, col);
    if (myWin.length) return G("blunder",
      `바로 이길 수 있었어요! <b>${P(myWin[0])}</b>에 두면 5목 완성이었어요.`,
      { hint: myWin[0], marks: myWin });

    // 3) 상대의 5목을 막았나
    const oppWin = winPoints(before, opp);
    if (oppWin.length >= 2) return G("ok",
      `${you}이 ${P(oppWin[0])}·${P(oppWin[1])} 두 곳으로 5목이라 이미 막을 수 없었어요. 더 일찍 손을 썼어야 해요.`,
      { marks: oppWin });
    if (oppWin.length === 1) {
      if (!eq(oppWin[0], mv)) return G("blunder",
        `${you}의 5목을 안 막았어요! <b>${P(oppWin[0])}</b>를 반드시 막아야 했어요.`,
        { hint: oppWin[0], marks: oppWin });
      return G("good", `${you}의 5목 자리를 정확히 막았어요. 꼭 필요한 수예요 🛡️`);
    }

    // 4) 내가 만든 위협 (좋은 수인가)
    if (info.openFour > 0) return G("brilliant",
      `<b>열린4</b>를 만들었어요! 양쪽 어디로도 5목이라 ${you}이 막을 수 없어요 🔥`,
      { marks: info.winPts });
    if (info.four >= 2) return G("brilliant",
      `<b>사사(4-4)</b> 이중위협! 4를 두 개 만들어서 한쪽밖에 못 막아요 🔥`,
      { marks: info.winPts });
    if (info.four >= 1 && info.openThree >= 1) return G("brilliant",
      `<b>사삼(4-3)</b>! 4를 막으면 열린3이 열린4가 돼요. 오목의 대표 승리 기술이에요 🔥`,
      { marks: info.winPts });
    if (info.openThree >= 2) return G("brilliant",
      `<b>삼삼(3-3)</b> 이중위협! 열린3을 두 개 만들어서 ${you}이 다 막을 수 없어요 🔥`);

    // 5) 더 좋은 수(이중위협·VCF)를 놓쳤나
    const dbl = doubleThreatPoints(before, col);
    if (dbl.length) return G("mistake",
      `<b>${P(dbl[0].at)}</b>에 뒀으면 <b>${dbl[0].kind}</b> 이중위협으로 이길 수 있었어요!`,
      { hint: dbl[0].at, marks: [dbl[0].at] });
    const vcf = findVCF(before, col, vcfDepth);
    if (vcf && vcf.length >= 3 && !eq(vcf[0], mv)) return G("mistake",
      `<b>${P(vcf[0])}</b>부터 4로 계속 몰면(VCF) 이길 수 있었어요! ${Math.ceil(vcf.length / 2)}수 만에 끝나요.`,
      { hint: vcf[0], marks: vcf.filter((_, i) => i % 2 === 0) });

    // 6) 상대의 열린3을 방치했나 (내가 선수를 잡았으면 괜찮다)
    const oppThree = openThreePoints(before, opp);
    if (oppThree.length && info.four === 0 && info.openThree === 0) {
      return G("inaccuracy",
        `${you}의 <b>열린3</b>을 그냥 뒀어요. 열린3은 다음에 열린4가 되니 막거나, 나도 4·열린3으로 맞받아야 해요.`,
        { marks: oppThree });
    }
    if (info.openThree > 0) return G("good",
      `<b>열린3</b>을 만들었어요! ${you}이 반드시 대응해야 하는 선수예요 👍`);
    if (info.four > 0) return G("good",
      `<b>4</b>를 만들어 ${you}을 강제로 막게 했어요. 선수를 잡았네요 👍`);

    // 7) 초반 정석
    if (idx <= 3) {
      const op = opening(moves.slice(0, 3));
      if (idx === 3 && op) return G("ok",
        `초반 정석 <b>${op.name}(${op.hanja})</b> — ${op.type}주형 ${op.index}번이에요.`);
      if (idx === 1) return G(eq(mv, [7, 7]) ? "good" : "ok",
        eq(mv, [7, 7]) ? "천원(한가운데)에서 시작했어요. 사방으로 뻗을 수 있어 가장 좋은 첫 수예요."
          : "첫 수는 보통 천원(한가운데)에 둬요. 가장자리는 뻗을 방향이 적어 불리해요.");
      if (idx === 2) {
        const d = Math.max(Math.abs(mv[0] - 7), Math.abs(mv[1] - 7));
        if (d === 1) return G("good", "천원 바로 옆에 붙여 흑을 견제했어요. 정석적인 대응이에요.");
        return G("inaccuracy", "백은 흑의 첫 수 바로 옆에 붙여 견제하는 게 정석이에요. 멀리 두면 흑이 편해져요.");
      }
    }

    // 8) 그 외
    const near = before.some((row, r) => row.some((v, c) =>
      v !== EMPTY && Math.max(Math.abs(r - mv[0]), Math.abs(c - mv[1])) <= 2));
    if (!near) return G("inaccuracy",
      "돌들과 멀리 떨어진 곳이에요. 오목은 내 돌을 이어야 이기니, 내 돌 근처에서 모양을 만들어요.");
    return G("ok", "무난한 수예요. 열린3을 만들거나 상대 모양을 막는 자리를 노려봐요.");
  }

  const api = {
    N, EMPTY, BLACK, WHITE,
    lineStr, dirKind, moveInfo, winPoints, openThreePoints, doubleThreatPoints,
    nearCells, findVCF, opening, reviewMove, boardAt,
    OPENINGS_DIRECT, OPENINGS_INDIRECT, GRADE,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OmokCoach = api;
})(typeof window !== "undefined" ? window : globalThis);

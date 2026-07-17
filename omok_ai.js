/*
 * 오목 AI — 순수 로직 (DOM 의존 없음)
 *
 * omok_coach.js 의 판정(moveInfo / doubleThreatPoints / findVCF)을 그대로 재사용한다.
 * 별도의 탐색 트리 없이 "한 수 두고 상대의 답을 한 번 확인" 하는 1수 앞 검증만 한다.
 *   → 15x15 전체가 아니라 돌 주변 후보를 점수로 추린 상위 K개만 검증하므로 태블릿에서도 빠르다.
 *
 * 수를 고르는 순서 (사람이 오목을 배우는 순서와 같다)
 *   1. 내가 5목을 만들 수 있으면 둔다
 *   2. 상대의 5목을 막는다
 *   3. 이중위협(사삼·삼삼·사사·열린4)으로 이긴다
 *   4. VCF(4로 계속 몰기)로 이긴다              — 고급만
 *   5. 나머지는 점수 = 공격(내 모양) + 수비(상대가 그 자리에 뒀을 때의 모양)
 *      상위 K개에 대해 '두고 나면 상대가 이기나?' 를 확인해 감점
 *
 * 난이도
 *   초급 — 1·2단계만. 게다가 5목 막기를 가끔 놓치고, 수를 꽤 무작위로 고른다.
 *   중급 — 3단계까지 + 얕은 검증(K=6). 이중위협을 만들고 막는다.
 *   고급 — VCF 수읽기 + 넓은 검증(K=12) + 상대 VCF 경계.
 */
(function (root) {
  const isNode = (typeof module !== "undefined" && module.exports);
  const Coach = isNode ? require("./omok_coach.js") : root.OmokCoach;

  const BLACK = 1, WHITE = 2;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const CEN = 5;                                  // Coach.lineStr 이 주는 길이 11 문자열의 가운데

  const other = (col) => col === BLACK ? WHITE : BLACK;
  const clone = (b) => b.map(x => x.slice());
  const place = (b, r, c, col) => { const n = clone(b); n[r][c] = col; return n; };
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];

  /* defW = 수비 가중치. 1.0(공수 동일)로 두면 오히려 약해진다 — 같은 값이면 먼저 공격하는 쪽이
   *        선수를 잡기 때문. 0.85 가 자가대국 성적이 가장 좋았다.
   * K    = 1수 앞 검증할 후보 수. 고급이 중급을 이기는 힘은 defW 가 아니라 K(넓게 보기)와 VCF 에서 나온다. */
  const LEVELS = {
    easy:   { label: "초급", defW: 0.3,  noise: 0.55, K: 0,  missBlock: 0.25, vcf: false },
    normal: { label: "중급", defW: 0.85, noise: 0.12, K: 6,  missBlock: 0,    vcf: false },
    hard:   { label: "고급", defW: 0.85, noise: 0,    K: 16, missBlock: 0,    vcf: true  },
  };

  // ---- 모양 점수 ----
  // 이어진 돌 수(run)와 양 끝이 열렸는지(ends)로 매긴다. [막힘, 한쪽열림, 양쪽열림]
  const RUN_SCORE = { 1: [0, 2, 5], 2: [0, 12, 30], 3: [0, 70, 200], 4: [0, 400, 1200] };
  function dirScore(s) {
    let run = 1, li = CEN - 1, ri = CEN + 1;
    while (li >= 0 && s[li] === "1") { run++; li--; }
    while (ri < s.length && s[ri] === "1") { run++; ri++; }
    const ends = ((li >= 0 && s[li] === "0") ? 1 : 0) + ((ri < s.length && s[ri] === "0") ? 1 : 0);
    return RUN_SCORE[Math.min(run, 4)][ends];
  }
  function shapeScore(board, r, c, col) {
    let t = 0;
    for (const [dr, dc] of DIRS) t += dirScore(Coach.lineStr(board, r, c, dr, dc, col));
    return t;
  }
  // moveInfo 가 알려준 위협의 가치
  function threatValue(m) {
    if (m.win) return 1e6;
    if (m.forbidden || m.illegal) return 0;
    if (m.openFour > 0) return 5e4;
    if (m.four >= 2 || (m.four >= 1 && m.openThree >= 1) || m.openThree >= 2) return 4e4;
    if (m.four > 0) return 1500;
    if (m.openThree > 0) return 1200;
    return 0;
  }

  // 둘 수 있는 자리들 (흑이면 금수 제외)
  function candidates(board, col) {
    const out = [];
    for (const [r, c] of Coach.nearCells(board, 2)) {
      const m = Coach.moveInfo(board, r, c, col);
      if (m.illegal || m.forbidden) continue;
      out.push({ r, c, m });
    }
    return out;
  }

  // 이 자리의 값어치 = 내 모양 + 상대가 여기 뒀을 때의 모양(=미리 뺏는 값) + 가운데 가산
  function scoreOf(board, r, c, col, m, cfg) {
    const opp = other(col);
    const om = Coach.moveInfo(board, r, c, opp);
    const off = threatValue(m) + shapeScore(board, r, c, col);
    const def = (om.forbidden || om.illegal) ? 0 : threatValue(om) + shapeScore(board, r, c, opp);
    const cen = 7 - Math.max(Math.abs(r - 7), Math.abs(c - 7));
    return off + def * cfg.defW + cen * 2;
  }

  /*
   * 다음 수를 고른다.
   *   board  15x15 (0=빈칸, 1=흑, 2=백)
   *   col    AI가 둘 색
   *   level  "easy" | "normal" | "hard"
   *   opts   { rng }  — 테스트에서 무작위를 고정하려면 rng 를 넘긴다
   * 반환: { at:[r,c], why:"말풍선 문구" } / 둘 곳이 없으면 null
   */
  function chooseMove(board, col, level, opts) {
    const cfg = LEVELS[level] || LEVELS.normal;
    const rng = (opts && opts.rng) || Math.random;
    const opp = other(col);
    const cands = candidates(board, col);
    if (!cands.length) return null;
    const at = (k) => [k.r, k.c];

    // 1) 5목 완성
    const winNow = cands.find(k => k.m.win);
    if (winNow) return { at: at(winNow), why: "5목 완성! 내가 이겼다 🎉" };

    // 2) 상대의 5목 막기
    const oppWin = Coach.winPoints(board, opp);
    let pool = cands;
    if (oppWin.length) {
      const missed = cfg.missBlock && rng() < cfg.missBlock;
      if (missed) {
        // 초급은 가끔 상대의 4를 '못 본다'. 점수로도 눈에 띄니 아예 후보에서 지워야 진짜로 지나친다.
        const rest = cands.filter(k => !oppWin.some(p => eq(p, at(k))));
        if (rest.length) pool = rest;
      } else {
        const k = cands.find(k => oppWin.some(p => eq(p, at(k))));
        if (k) return { at: at(k), why: "여기 막아야겠다! 🛡️" };
      }
    }

    // 초급은 여기서 끝 — 전술은 보지 않고 모양만 보고 둔다
    if (cfg.K === 0) {
      const k = pickScored(board, col, pool, cfg, rng);
      return { at: at(k), why: null };
    }

    // 3) 이중위협으로 이기기
    const dbl = Coach.doubleThreatPoints(board, col);
    if (dbl.length) {
      const hit = cands.filter(k => dbl.some(d => eq(d.at, at(k))));
      if (hit.length) {
        const k = pickScored(board, col, hit, cfg, rng, true);
        const kind = dbl.find(d => eq(d.at, at(k))).kind;
        return { at: at(k), why: `${kind}! 이건 못 막아 🔥` };
      }
    }

    // 4) VCF — 4로 계속 몰아서 이기기 (고급)
    if (cfg.vcf) {
      const vcf = Coach.findVCF(board, col, 4);
      if (vcf && vcf.length) {
        const k = cands.find(k => eq(at(k), vcf[0]));
        if (k) return { at: at(k), why: "4로 계속 몰아서 이긴다 ⚡" };
      }
    }

    // 5) 점수 상위 K개만 '두고 난 뒤 상대가 이기는지' 확인해서 고른다
    const top = pool
      .map(k => Object.assign({ s: scoreOf(board, k.r, k.c, col, k.m, cfg) }, k))
      .sort((a, b) => b.s - a.s)
      .slice(0, cfg.K);

    let best = null;
    for (const k of top) {
      const b1 = place(board, k.r, k.c, col);
      let pen = 0, risk = null;
      if (Coach.winPoints(b1, opp).length) { pen = 1e6; risk = "five"; }
      else {
        /* 선수(先手)를 잡았는지가 핵심이다.
         * 내가 4를 만들면 상대는 그걸 막을 수밖에 없어서 자기 이중위협을 만들 틈이 없다.
         * 이걸 빼먹으면 AI가 "두면 상대가 이중위협 가능"이라며 모든 공격을 스스로 감점해
         * 한 수도 못 두고 끌려다니게 된다. 열린3은 강요는 아니라 절반만 인정한다. */
        const forceW = (k.m.four > 0 || k.m.openFour > 0) ? 0 : (k.m.openThree > 0 ? 0.5 : 1);
        if (forceW > 0) {
          const od = Coach.doubleThreatPoints(b1, opp);
          if (od.length) { pen = 3e4 * Math.min(od.length, 2) * forceW; risk = "double"; }
          else if (cfg.vcf && Coach.findVCF(b1, opp, 3)) { pen = 2e4 * forceW; risk = "vcf"; }
        }
      }
      const v = (k.s - pen) * (1 + (rng() * 2 - 1) * cfg.noise);
      if (!best || v > best.v) best = { k, v, risk };
    }

    const k = best.k;
    let why = null;
    if (k.m.four >= 1 && k.m.openThree >= 1) why = "사삼(4-3)! 🔥";
    else if (k.m.four > 0) why = "4를 만들었어. 막아봐 😎";
    else if (k.m.openThree > 0) why = "열린3! 이거 막아야 해 😏";
    else if (best.risk === "double") why = "이거 큰일인데… 😰";
    else {
      const oppThree = Coach.moveInfo(board, k.r, k.c, opp);
      if (!oppThree.forbidden && !oppThree.illegal && (oppThree.openThree > 0 || oppThree.four > 0))
        why = "여기 먼저 뺏어야지 🚧";
    }
    return { at: at(k), why };
  }

  // 점수대로 고르되 난이도의 noise 만큼 흔들어서 고른다 (같은 판이어도 매번 똑같이 두지 않게)
  function pickScored(board, col, list, cfg, rng, noNoise) {
    let best = null;
    for (const k of list) {
      const s = scoreOf(board, k.r, k.c, col, k.m, cfg);
      const v = noNoise ? s : s * (1 + (rng() * 2 - 1) * cfg.noise);
      if (!best || v > best.v) best = { k, v };
    }
    return best.k;
  }

  const api = { LEVELS, chooseMove, shapeScore, threatValue, candidates };
  if (isNode) module.exports = api;
  else root.OmokAI = api;
})(typeof window !== "undefined" ? window : globalThis);

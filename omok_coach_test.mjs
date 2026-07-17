// 오목 코치 엔진 테스트:  node omok_coach_test.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Omok = require("./omok.js");
const C = require("./omok_coach.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra !== undefined ? "  → " + JSON.stringify(extra) : ""}`); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }
const B = Omok.BLACK, W = Omok.WHITE;
function mk(stones) { const b = Omok.createBoard(); stones.forEach(([r, c, v]) => b[r][c] = v); return b; }

console.log("\n[모양 판정]");
{
  // _ _ ● ● (●) _ _   → 열린3
  const b = mk([[7, 5, B], [7, 6, B]]);
  const m = C.moveInfo(b, 7, 7, B);
  ok("열린3 인식", m.openThree === 1 && m.four === 0 && m.winPts.length === 0, m);
}
{
  // ○ ● ● ● (●) _     → 4 (5가 되는 자리 한 곳)
  const b = mk([[7, 3, W], [7, 4, B], [7, 5, B], [7, 6, B]]);
  const m = C.moveInfo(b, 7, 7, B);
  ok("4 인식(한쪽 막힘)", m.four === 1 && m.openFour === 0, m);
  eq("4의 승리자리", m.winPts, [[7, 8]]);
}
{
  // _ ● ● ● (●) _     → 열린4 (양쪽 다 5)
  const b = mk([[7, 5, B], [7, 6, B], [7, 7, B]]);
  const m = C.moveInfo(b, 7, 8, B);
  ok("열린4 인식", m.openFour === 1, m);
  ok("열린4는 승리자리 2곳", m.winPts.length === 2, m.winPts);
}
{
  // 흑 장목(6목)은 승리가 아니라 금수
  const b = mk([[7, 3, B], [7, 4, B], [7, 5, B], [7, 6, B], [7, 8, B]]);
  const m = C.moveInfo(b, 7, 7, B);
  ok("흑 장목은 금수", !!m.forbidden, m);
  const m2 = C.moveInfo(mk([[7, 3, W], [7, 4, W], [7, 5, W], [7, 6, W], [7, 8, W]]), 7, 7, W);
  ok("백 6목은 승리", m2.win === true, m2);
}

console.log("\n[이중위협]");
// 가로: ○●●●(x)  → 4 /  세로: ●●(x) → 열린3   ⇒ (7,7)은 사삼
const SASAM = mk([[7, 3, W], [7, 4, B], [7, 5, B], [7, 6, B], [5, 7, B], [6, 7, B]]);
{
  const m = C.moveInfo(SASAM, 7, 7, B);
  ok("사삼(4-3) 모양", m.four === 1 && m.openThree === 1, m);
  const d = C.doubleThreatPoints(SASAM, B).find(x => x.at[0] === 7 && x.at[1] === 7);
  ok("사삼을 이기는 자리로 탐지", d && d.kind === "사삼(4-3)", d);
}
{
  // 흑 삼삼은 금수 / 백 삼삼은 즉승 위협
  const st = [[7, 5, B], [7, 6, B], [5, 7, B], [6, 7, B]];
  ok("흑 삼삼은 금수", !!C.moveInfo(mk(st), 7, 7, B).forbidden);
  const wst = st.map(([r, c]) => [r, c, W]);
  const d = C.doubleThreatPoints(mk(wst), W).find(x => x.at[0] === 7 && x.at[1] === 7);
  ok("백 삼삼은 이중위협", d && d.kind === "삼삼(3-3)", d);
}

console.log("\n[VCF 수읽기]");
{
  const v = C.findVCF(SASAM, B, 4);
  ok("사삼 자리에서 VCF 발견", !!v, v);
  eq("VCF 첫 수 = 사삼 자리", v && v[0], [7, 7]);
  ok("VCF는 4→강제응수→마무리", v && v.length >= 3, v);
}
{
  // 아무 위협 없는 판에서는 VCF 없음
  ok("빈 판 근처엔 VCF 없음", C.findVCF(mk([[7, 7, B], [6, 7, W]]), B, 4) === null);
}
{
  // 열린4 한 방
  const v = C.findVCF(mk([[7, 5, B], [7, 6, B], [7, 7, B]]), B, 3);
  ok("열린4로 1수 VCF", v && v.length === 1, v);
}

console.log("\n[렌주 26주형]");
// 출처: RenjuNet 공식 다이어그램. 흑1=천원(H8), 백2=H9(직접)/J9(간접)
{
  const D = C.OPENINGS_DIRECT, I = C.OPENINGS_INDIRECT;
  ok("직접 13개", D.length === 13, D.length);
  ok("간접 13개", I.length === 13, I.length);
  ok("한자 이름 26개 모두 다름",
    new Set([...D, ...I].map(o => o.h)).size === 26);

  // 대표 좌표 검증 (다이어그램 대조)
  eq("화월 = 백2 옆 대각(J9)", D[3], { n: "화월", h: "花月", d: [-1, 1] });
  eq("장성 = 간접 1번(K10)", I[0], { n: "장성", h: "長星", d: [-2, 2] });

  const SYM = [([r, c]) => [r, c], ([r, c]) => [r, -c], ([r, c]) => [-r, c], ([r, c]) => [-r, -c],
  ([r, c]) => [c, r], ([r, c]) => [c, -r], ([r, c]) => [-c, r], ([r, c]) => [-c, -r]];
  const abs = (o) => [o[0] + 7, o[1] + 7];

  let allOk = true, symOk = true;
  for (const [table, w2, type] of [[D, [-1, 0], "직접"], [I, [-1, 1], "간접"]]) {
    for (const o of table) {
      const got = C.opening([[7, 7], abs(w2), abs(o.d)]);
      if (!got || got.name !== o.n || got.type !== type) { allOk = false; console.log("    ↳ 실패:", type, o.n, got); }
      // 8가지 대칭 변환 전부 같은 주형으로 판별돼야 한다
      for (const t of SYM) {
        const g = C.opening([[7, 7], abs(t(w2)), abs(t(o.d))]);
        if (!g || g.name !== o.n || g.type !== type) { symOk = false; console.log("    ↳ 대칭실패:", type, o.n, t(w2), t(o.d), g); }
      }
    }
  }
  ok("26주형 정규위치 전부 판별", allOk);
  ok("8가지 대칭 회전/반사 전부 같은 주형", symOk);

  // 5x5 안의 가능한 3수는 정확히 26가지로 분류돼야 한다(중복/누락 없음)
  const names = new Set();
  for (const w2 of [[-1, 0], [-1, 1]])
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if ((dr === 0 && dc === 0) || (dr === w2[0] && dc === w2[1])) continue;
      const g = C.opening([[7, 7], abs(w2), abs([dr, dc])]);
      if (g) names.add(g.type + g.name + g.index);
      else console.log("    ↳ 미분류:", w2, [dr, dc]);
    }
  ok("5x5 전 좌표가 26주형으로 빠짐없이 분류", names.size === 26, names.size);

  ok("천원 아니면 주형 아님", C.opening([[7, 8], [6, 8], [5, 8]]) === null);
  ok("백2가 멀면 주형 아님", C.opening([[7, 7], [4, 4], [6, 7]]) === null);
}

console.log("\n[복기 코칭]");
{
  const r = C.reviewMove([[7, 7]], 1);
  ok("1수 천원 칭찬", r.grade === "good", r);
  const r2 = C.reviewMove([[0, 0]], 1);
  ok("1수 구석은 지적", r2.grade === "ok" && /천원/.test(r2.text), r2);
}
{
  // 흑1 천원, 백2 위, 흑3 화월자리 → 정석 이름
  const r = C.reviewMove([[7, 7], [6, 7], [6, 8]], 3);
  ok("3수에서 정석 안내", /화월/.test(r.text), r);
}
// 서로 이어지지 않는 더미 수 (네 귀퉁이) — 엉뚱한 4목이 생기지 않게 흩어둔다
const X = [[0, 0], [14, 14], [0, 14], [14, 0]];
{
  // 가로 ○●●●+세로 ●● 상태에서 흑이 (7,7) → 사삼
  const moves = [[7, 4], [7, 3], [7, 5], X[0], [6, 7], X[1], [5, 7], X[2], [7, 6], X[3], [7, 7]];
  const r = C.reviewMove(moves, 11);
  ok("사삼을 두면 최고의 수", r.grade === "brilliant" && /사삼/.test(r.text), r);
}
{
  // 사삼 자리를 놓치고 엉뚱한 곳 → 실수 + 힌트
  const moves = [[7, 4], [7, 3], [7, 5], X[0], [6, 7], X[1], [5, 7], X[2], [7, 6], X[3], [11, 11]];
  const r = C.reviewMove(moves, 11);
  ok("이중위협 놓치면 실수 지적", r.grade === "mistake", r);
  eq("힌트로 사삼 자리 제시", r.hint, [7, 7]);
}
{
  // 백이 ●●●● (한쪽은 흑이 막음) → 흑은 반드시 (7,8)을 막아야 한다
  const base = [[7, 3], [7, 4], X[1], [7, 5], X[2], [7, 6], X[3], [7, 7]];
  const r = C.reviewMove([...base, [5, 5]], 9);
  ok("상대 5목 방치 = 큰 실수", r.grade === "blunder" && /5목/.test(r.text), r);
  eq("막을 자리 힌트", r.hint, [7, 8]);
  const r2 = C.reviewMove([...base, [7, 8]], 9);
  ok("5목 막으면 좋은 수", r2.grade === "good", r2);
}
{
  // 열린3 만들면 좋은 수
  const r = C.reviewMove([[7, 5], X[0], [7, 6], X[1], [7, 7]], 5);
  ok("열린3 만들면 좋은 수", r.grade === "good" || r.grade === "brilliant", r);
}
{
  // 돌들과 동떨어진 수는 지적
  const r = C.reviewMove([[7, 7], [6, 7], [0, 0]], 3);
  ok("동떨어진 수 지적", r.grade === "inaccuracy" && /멀리/.test(r.text), r);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);

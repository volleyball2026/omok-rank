// 오목 AI 엔진 테스트:  node omok_ai_test.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Omok = require("./omok.js");
const C = require("./omok_coach.js");
const AI = require("./omok_ai.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra !== undefined ? "  → " + JSON.stringify(extra) : ""}`); }
}
const B = Omok.BLACK, W = Omok.WHITE;
function mk(stones) { const b = Omok.createBoard(); stones.forEach(([r, c, v]) => b[r][c] = v); return b; }
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const has = (list, p) => list.some(x => eq(x, p));
// 무작위 고정: 항상 0.5 (noise 를 0으로 만들어 점수 그대로, missBlock 도 발동 안 함)
const fixed = () => 0.5;
const LEVELS = ["easy", "normal", "hard"];

console.log("\n[1. 이기는 수는 반드시 둔다]");
for (const lv of LEVELS) {
  // ● ● ● ● _  → (7,8)이면 5목
  const b = mk([[7, 4, B], [7, 5, B], [7, 6, B], [7, 7, B]]);
  const m = AI.chooseMove(b, B, lv, { rng: fixed });
  ok(`${lv}: 5목 자리를 둔다`, eq(m.at, [7, 8]) || eq(m.at, [7, 3]), m);
}

console.log("\n[2. 상대의 5목은 막는다]");
for (const lv of ["normal", "hard"]) {
  // 백 4개 연속, 흑 차례 → 반드시 막아야 한다
  const b = mk([[7, 4, W], [7, 5, W], [7, 6, W], [7, 7, W], [9, 9, B]]);
  const m = AI.chooseMove(b, B, lv, { rng: fixed });
  ok(`${lv}: 상대 4를 막는다`, eq(m.at, [7, 8]) || eq(m.at, [7, 3]), m);
}
{
  // 초급도 rng 가 missBlock(0.25) 밖이면 막는다
  const b = mk([[7, 4, W], [7, 5, W], [7, 6, W], [7, 7, W], [9, 9, B]]);
  const m = AI.chooseMove(b, B, "easy", { rng: fixed });
  ok("easy: 5목 막기는 (놓치지 않는 한) 한다", eq(m.at, [7, 8]) || eq(m.at, [7, 3]), m);
  // rng 가 0.1 이면 25% 확률에 걸려 놓친다
  const m2 = AI.chooseMove(b, B, "easy", { rng: () => 0.1 });
  ok("easy: 가끔 못 보고 지나친다(초급다움)", !eq(m2.at, [7, 8]) && !eq(m2.at, [7, 3]), m2);
}
{
  // 막기보다 내가 이기는 게 우선
  const b = mk([[7, 4, W], [7, 5, W], [7, 6, W], [7, 7, W],
                [2, 4, B], [2, 5, B], [2, 6, B], [2, 7, B]]);
  const m = AI.chooseMove(b, B, "hard", { rng: fixed });
  ok("막기보다 내 5목이 먼저", m.at[0] === 2, m);
}

console.log("\n[3. 이중위협]");
{
  // 백: 가로 3 + 세로 3 이 (7,7)에서 만나 삼삼
  const b = mk([[7, 5, W], [7, 6, W], [5, 7, W], [6, 7, W], [0, 0, B], [0, 14, B]]);
  const m = AI.chooseMove(b, W, "hard", { rng: fixed });
  const dbl = C.doubleThreatPoints(b, W);
  ok("이중위협 자리가 존재", dbl.length > 0, dbl.slice(0, 3));
  ok("hard: 이중위협으로 이긴다", has(dbl.map(d => d.at), m.at), m);
  ok("이중위협이면 말풍선에 기술 이름", !!m.why && m.why.includes("!"), m.why);
  const m2 = AI.chooseMove(b, W, "normal", { rng: fixed });
  ok("normal: 이중위협도 본다", has(dbl.map(d => d.at), m2.at), m2);
}
{
  // 상대(백)가 다음 수에 이중위협을 만들 수 있으면 그 자리를 견제한다.
  // (흑은 삼삼이 금수라 이중위협을 못 만든다 → 위협하는 쪽은 반드시 백이어야 한다)
  const b = mk([[7, 5, W], [7, 6, W], [5, 7, W], [6, 7, W], [0, 0, B]]);
  const bad = C.doubleThreatPoints(b, W).map(d => d.at);
  ok("상대(백) 이중위협 자리가 존재", bad.length > 0, bad);
  const m = AI.chooseMove(b, B, "hard", { rng: fixed });
  const after = (() => { const n = b.map(x => x.slice()); n[m.at[0]][m.at[1]] = B; return n; })();
  ok("hard: 상대 이중위협을 방치하지 않는다",
    has(bad, m.at) || C.doubleThreatPoints(after, W).length < bad.length, { m, bad });
}

console.log("\n[4. VCF 수읽기 (고급)]");
{
  // 자가대국으로 찾은 실제 판 — 흑에게 VCF(4로 계속 몰기) 수순은 있지만 즉시 이중위협은 없다.
  // 이런 판은 '한 수만 보는' 중급은 못 찾고 VCF 수읽기를 하는 고급만 찾아낸다.
  const b = mk([[7, 7, B], [6, 6, W], [6, 7, B], [5, 7, W], [7, 5, B], [7, 6, W],
                [8, 6, B], [6, 4, W], [9, 5, B], [10, 4, W], [6, 8, B], [5, 9, W],
                [8, 5, B], [6, 5, W], [8, 7, B], [8, 4, W]]);
  const vcf = C.findVCF(b, B, 4);
  ok("VCF 테스트 판이 유효(수순 존재)", !!vcf && vcf.length >= 3, vcf && vcf.length);
  ok("이 판엔 즉시 이중위협이 없다(고급만 풀 수 있는 판)", C.doubleThreatPoints(b, B).length === 0);
  const m = AI.chooseMove(b, B, "hard", { rng: fixed });
  ok("hard: VCF 첫 수를 찾아낸다", eq(m.at, vcf[0]), { got: m, want: vcf[0] });
  ok("VCF면 말풍선으로 알려준다", !!m.why && m.why.includes("몰아서"), m.why);
}

console.log("\n[5. 흑 AI는 금수를 두지 않는다]");
{
  // 흑 삼삼 금수 자리가 생기는 판에서 AI(흑)를 여러 번 돌려본다
  let bad = 0, n = 0;
  for (let t = 0; t < 30; t++) {
    const b = mk([[7, 5, B], [7, 6, B], [5, 7, B], [6, 7, B], [0, 0, W], [14, 14, W]]);
    for (const lv of LEVELS) {
      const m = AI.chooseMove(b, B, lv, { rng: Math.random });
      n++;
      if (Omok.analyze(b, m.at[0], m.at[1], B).forbidden) bad++;
    }
  }
  ok(`금수를 한 번도 두지 않음 (${n}회 시도)`, bad === 0, { bad });
}

console.log("\n[6. 항상 둘 수 있는 자리를 낸다]");
{
  let bad = 0;
  for (const lv of LEVELS) {
    const b = Omok.createBoard();
    let col = B;
    for (let i = 0; i < 40; i++) {                       // 자기들끼리 40수 둬본다
      const m = AI.chooseMove(b, col, lv, { rng: Math.random });
      if (!m || b[m.at[0]][m.at[1]] !== Omok.EMPTY) { bad++; break; }
      const a = Omok.analyze(b, m.at[0], m.at[1], col);
      if (a.illegal || a.forbidden) { bad++; break; }
      b[m.at[0]][m.at[1]] = col;
      if (a.win) break;
      col = col === B ? W : B;
    }
  }
  ok("빈 판부터 자가대국 40수 — 반칙 없음", bad === 0, { bad });
}
{
  const b = Omok.createBoard();
  const m = AI.chooseMove(b, B, "hard", { rng: fixed });
  ok("빈 판이면 천원 근처를 둔다", Math.max(Math.abs(m.at[0] - 7), Math.abs(m.at[1] - 7)) <= 1, m);
}

console.log("\n[7. 실력 차이 — 난이도가 실제로 세지는가]");
// 흑·백을 번갈아 둔다. 렌주는 흑에게 금수가 있어 한 색으로만 재면 실력이 아니라 색을 재게 된다.
function selfPlay(lvBlack, lvWhite) {
  const b = Omok.createBoard();
  let col = B;
  for (let i = 0; i < 225; i++) {
    const m = AI.chooseMove(b, col, col === B ? lvBlack : lvWhite, { rng: Math.random });
    if (!m) return null;
    const a = Omok.analyze(b, m.at[0], m.at[1], col);
    b[m.at[0]][m.at[1]] = col;
    if (a.win) return col;
    col = col === B ? W : B;
  }
  return null;                                   // 판이 다 차도록 승부가 안 남 = 무승부
}
function match(l1, l2, n) {
  let w1 = 0, w2 = 0, d = 0;
  for (let i = 0; i < n; i++) {
    const l1IsBlack = i % 2 === 0;
    const r = l1IsBlack ? selfPlay(l1, l2) : selfPlay(l2, l1);
    if (r === null) d++;
    else if ((r === B) === l1IsBlack) w1++;
    else w2++;
  }
  return { w1, w2, d };
}
{
  const r = match("hard", "easy", 20);
  ok(`고급이 초급에게 20판 중 15판 이상 승 (${r.w1}-${r.w2}, 무 ${r.d})`, r.w1 >= 15, r);
}
{
  const r = match("normal", "easy", 20);
  ok(`중급이 초급에게 20판 중 14판 이상 승 (${r.w1}-${r.w2}, 무 ${r.d})`, r.w1 >= 14, r);
}
/* 고급 vs 중급은 여기서 재지 않는다.
 * 둘 다 잘 막아서 절반이 무승부(225수)라 한 판이 오래 걸리고, 14판 정도로는 결과가 크게 흔들린다
 * (같은 설정으로 7-1 도 나오고 2-7 도 나왔다). 40판을 돌려야 신호가 잡히는데 3분이 걸려 테스트로는 부적합.
 * 2026-07-17 40판 측정 결과 (색 번갈아):
 *    기준(defW .85 / K=16 / VCF)  → 14-5 (무 21)  승률 74%
 *    상대 VCF 감점 제거            → 12-11 (무 17) 승률 52%
 *    K=6 (중급과 동일)             → 10-10 (무 20) 승률 50%
 * 즉 고급의 실력은 K=16(넓게 보기)과 상대 VCF 감점 '둘 다'에서 나온다. 둘 중 하나만 빼도 중급과 같아진다.
 * → 이 둘을 성능 때문에 줄이려면 반드시 40판을 다시 재고 줄일 것. */

console.log("\n[8. 속도 — 태블릿에서 버벅이지 않아야]");
{
  // 중반쯤 되는 판에서 고급 AI 한 수 계산 시간
  const b = mk([[7, 7, B], [7, 8, W], [6, 7, B], [8, 8, W], [6, 6, B], [8, 6, W],
                [5, 5, B], [9, 9, W], [6, 8, B], [8, 7, W], [5, 8, B], [9, 7, W],
                [4, 7, B], [10, 6, W], [5, 6, B], [9, 6, W]]);
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) AI.chooseMove(b, B, "hard", { rng: Math.random });
  const per = (Date.now() - t0) / 5;
  ok(`고급 한 수 300ms 이내 (${per.toFixed(0)}ms)`, per < 300, { per });
  const t1 = Date.now();
  for (let i = 0; i < 5; i++) AI.chooseMove(b, B, "normal", { rng: Math.random });
  const per2 = (Date.now() - t1) / 5;
  ok(`중급 한 수 150ms 이내 (${per2.toFixed(0)}ms)`, per2 < 150, { per2 });
}

console.log(`\n${fail === 0 ? "🎉" : "❌"} 통과 ${pass} / 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);

// 레슨 문제 검증:  node lessons_test.mjs
// index.html 안의 LESSONS 정의와 정답판정 함수를 그대로 꺼내와 실제로 풀리는지 확인한다.
import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const Omok = require("./omok.js");
const Coach = require("./omok_coach.js");

const html = readFileSync("./index.html", "utf8");
function extract(startMark, endMark) {
  const a = html.indexOf(startMark);
  const b = html.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error("index.html에서 코드를 찾지 못했습니다: " + startMark);
  return html.slice(a, b);
}
// LESSONS 배열 + lessonBoard/lessonAnswers 를 통째로 가져와 실행
const src = extract("const LESSONS = [", "// 틀렸을 때");
const ctx = { window: { OmokCoach: Coach }, Omok, OmokCoach: Coach, localStorage: null };
const run = new Function("window", "Omok", "OmokCoach",
  src + "\n return { LESSONS, lessonAnswers, lessonBoard };");
const { LESSONS, lessonAnswers, lessonBoard } = run(ctx.window, Omok, Coach);

let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log(`  ✓ ${n}`))
  : (fail++, console.log(`  ✗ ${n}${x !== undefined ? "  → " + JSON.stringify(x) : ""}`));
const has = (list, p) => list.some(q => q[0] === p[0] && q[1] === p[1]);

console.log(`\n[레슨 ${LESSONS.length}개 검증]`);
ok("id 중복 없음", new Set(LESSONS.map(L => L.id)).size === LESSONS.length);

for (const L of LESSONS) {
  const b = lessonBoard(L);
  const ans = lessonAnswers(L);
  const tag = `${L.id} ${L.title}`;

  ok(`${tag} — 정답이 존재`, ans.length >= 1, ans);
  ok(`${tag} — 의도한 정답 [${L.answer}] 이 인정됨`, has(ans, L.answer), { ans });
  // 문제판의 돌이 서로 겹치지 않는지
  ok(`${tag} — 돌 배치 유효`, L.stones.every(([r, c]) => r >= 0 && r < 15 && c >= 0 && c < 15)
    && new Set(L.stones.map(([r, c]) => r * 15 + c)).size === L.stones.length);
  // 정답 자리는 반드시 빈칸이어야 한다
  ok(`${tag} — 정답 자리가 모두 빈칸`, ans.every(([r, c]) => b[r][c] === Omok.EMPTY), ans);

  // 흑 문제의 정답은 금수가 아니어야 한다 (금수 찾기 문제는 예외)
  if (L.color === 1 && L.type !== "forbidden") {
    ok(`${tag} — 정답이 금수가 아님`,
      ans.every(([r, c]) => !Omok.analyze(b, r, c, 1).forbidden), ans);
  }
  // 문제 시작 상태에서 이미 상대가 즉시 이기는 상황이면 문제가 성립하지 않는다
  if (["openThree", "openFour", "double", "win"].includes(L.type)) {
    const opp = L.color === 1 ? 2 : 1;
    ok(`${tag} — 상대의 즉시 5목 위협 없음(문제 성립)`,
      L.type === "win" || Coach.winPoints(b, opp).length === 0, Coach.winPoints(b, opp));
  }
}

console.log("\n[핵심 레슨의 의미 확인]");
{
  const L = LESSONS.find(x => x.id === "L7");                       // 사삼
  const d = Coach.doubleThreatPoints(lessonBoard(L), 1).find(x => x.at[0] === 7 && x.at[1] === 7);
  ok("L7 정답이 실제로 '사삼(4-3)'", d && d.kind === "사삼(4-3)", d);
}
{
  const L = LESSONS.find(x => x.id === "L9");                       // 삼삼(백)
  const d = Coach.doubleThreatPoints(lessonBoard(L), 2).find(x => x.at[0] === 7 && x.at[1] === 7);
  ok("L9 정답이 실제로 '삼삼(3-3)'", d && d.kind === "삼삼(3-3)", d);
}
{
  const L = LESSONS.find(x => x.id === "L6");                       // 금수
  ok("L6 정답이 실제로 삼삼 금수", Omok.analyze(lessonBoard(L), 7, 7, 1).forbidden === "삼삼(3-3)");
}
{
  const L = LESSONS.find(x => x.id === "L8");                       // 사삼 마무리
  const m = Coach.moveInfo(lessonBoard(L), 8, 7, 1);
  ok("L8 정답이 실제로 열린4", m.openFour >= 1, m);
}
{
  const L = LESSONS.find(x => x.id === "L11");                      // 화월
  const o = Coach.opening([[7, 7], L.white2, L.answer]);
  ok("L11 정답이 실제로 화월", o && o.name === "화월", o);
  ok("L11 화월 정답은 대칭으로 2곳", lessonAnswers(L).length === 2, lessonAnswers(L));
}
{
  const L = LESSONS.find(x => x.id === "L10");                      // 상대 사삼 막기
  const d = Coach.doubleThreatPoints(lessonBoard(L), 2);
  ok("L10 백의 이중위협 급소가 정확히 1곳", d.length === 1, d);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Omok = require("./omok.js");
const { createBoard, analyze, BLACK, WHITE } = Omok;

let pass = 0, fail = 0;
function check(desc, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✅" : "❌"} ${desc}  =>  ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

// 보드에 돌 배치 헬퍼: put(board, [[r,c,color],...])
function put(board, moves) { for (const [r, c, col] of moves) board[r][c] = col; return board; }

// 1) 흑 5목 승리 (가로)
{
  const b = createBoard();
  put(b, [[7,3,BLACK],[7,4,BLACK],[7,5,BLACK],[7,6,BLACK]]);
  check("흑 가로 5목 -> 승리", analyze(b, 7, 7, BLACK), { win: true });
}

// 2) 흑 장목(6목) -> 금수 (승리 아님)
{
  const b = createBoard();
  // 7행에 3,4,5,6 과 8 을 두고 7에 두면 3..8 = 6목
  put(b, [[7,3,BLACK],[7,4,BLACK],[7,5,BLACK],[7,6,BLACK],[7,8,BLACK]]);
  check("흑 6목 -> 장목 금수", analyze(b, 7, 7, BLACK), { forbidden: "장목(6목)" });
}

// 3) 백 6목 -> 승리 (백은 장목 허용)
{
  const b = createBoard();
  put(b, [[7,3,WHITE],[7,4,WHITE],[7,5,WHITE],[7,6,WHITE],[7,8,WHITE]]);
  check("백 6목 -> 승리", analyze(b, 7, 7, WHITE), { win: true });
}

// 4) 흑 삼삼(3-3) -> 금수
//    (7,7)에 두면 가로로 열린3, 세로로 열린3 이 동시에 생김
{
  const b = createBoard();
  put(b, [
    [7,5,BLACK],[7,6,BLACK],   // 가로: (7,5)(7,6) + (7,7) => 열린 3
    [5,7,BLACK],[6,7,BLACK],   // 세로: (5,7)(6,7) + (7,7) => 열린 3
  ]);
  check("흑 삼삼 -> 금수", analyze(b, 7, 7, BLACK), { forbidden: "삼삼(3-3)" });
}

// 5) 흑 사사(4-4) -> 금수
//    (7,7)에 두면 가로 4, 세로 4 동시
{
  const b = createBoard();
  put(b, [
    [7,4,BLACK],[7,5,BLACK],[7,6,BLACK],   // 가로 4 (with 7,7)
    [4,7,BLACK],[5,7,BLACK],[6,7,BLACK],   // 세로 4 (with 7,7)
  ]);
  check("흑 사사 -> 금수", analyze(b, 7, 7, BLACK), { forbidden: "사사(4-4)" });
}

// 6) 흑 사삼(4-3)은 허용 (금수 아님)
{
  const b = createBoard();
  put(b, [
    [7,4,BLACK],[7,5,BLACK],[7,6,BLACK],   // 가로 4
    [5,7,BLACK],[6,7,BLACK],               // 세로 열린 3
  ]);
  check("흑 사삼(4-3) -> 허용", analyze(b, 7, 7, BLACK), { ok: true });
}

// 7) 흑 단순 열린 3 하나 -> 허용
{
  const b = createBoard();
  put(b, [[7,5,BLACK],[7,6,BLACK]]);
  check("흑 열린 3 하나 -> 허용", analyze(b, 7, 7, BLACK), { ok: true });
}

// 8) 흑 열린 4 하나(양끝 열림) -> 허용 (승리 아님, 금수 아님)
{
  const b = createBoard();
  put(b, [[7,5,BLACK],[7,6,BLACK],[7,8,BLACK]]);  // (7,7)두면 5,6,7,8 = 4목, 양끝 4,9 빈칸
  check("흑 열린 4 하나 -> 허용", analyze(b, 7, 7, BLACK), { ok: true });
}

// 9) 백은 삼삼이어도 금수 아님 -> 허용
{
  const b = createBoard();
  put(b, [[7,5,WHITE],[7,6,WHITE],[5,7,WHITE],[6,7,WHITE]]);
  check("백 삼삼 모양 -> 허용", analyze(b, 7, 7, WHITE), { ok: true });
}

// 10) 이미 돌이 있는 자리 -> illegal
{
  const b = createBoard();
  b[7][7] = BLACK;
  check("이미 둔 자리 -> illegal", analyze(b, 7, 7, BLACK), { illegal: true });
}

// 11) 흑 5목이 삼삼과 겹쳐도 승리 우선
{
  const b = createBoard();
  put(b, [
    [7,3,BLACK],[7,4,BLACK],[7,5,BLACK],[7,6,BLACK], // 가로 4 -> (7,7)이면 5목
    [5,7,BLACK],[6,7,BLACK],                          // 세로 열린 3
  ]);
  check("흑 5목+삼 겹침 -> 승리 우선", analyze(b, 7, 7, BLACK), { win: true });
}

// 12) 빈 판은 꽉 차지 않음 / 꽉 채우면 true
{
  const b = createBoard();
  check("빈 판 isFull=false", Omok.isFull(b), false);
  for (let r = 0; r < Omok.N; r++) for (let c = 0; c < Omok.N; c++) b[r][c] = WHITE;
  check("가득 찬 판 isFull=true", Omok.isFull(b), true);
}

// 13) 금수 자리 목록: 삼삼 모양이면 해당 지점이 금수로 잡힘
{
  const b = createBoard();
  put(b, [[7,5,BLACK],[7,6,BLACK],[5,7,BLACK],[6,7,BLACK]]); // (7,7)은 삼삼
  const pts = Omok.forbiddenPoints(b);
  const has77 = pts.some(([r,c]) => r===7 && c===7);
  check("금수 목록에 (7,7) 삼삼 포함", has77, true);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);

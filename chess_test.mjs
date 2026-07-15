import { createRequire } from "module";
const require = createRequire(import.meta.url);
const C = require("./chess.js");
let pass = 0, fail = 0;
const check = (d, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? "✅" : "❌"} ${d} => ${JSON.stringify(got)}`); ok ? pass++ : fail++; };

// 1) 시작 위치 백 합법수 20개
let s = C.initialState();
check("시작 백 합법수 20", C.allLegalMoves(s, "w").length, 20);

// 2) 폴스메이트: 1.f3 e5 2.g4 Qh4#
// f2(6,5)->f3(5,5)
s = C.applyMove(s, [6,5],[5,5]);
// e7(1,4)->e5(3,4)
s = C.applyMove(s, [1,4],[3,4]);
// g2(6,6)->g4(4,6)
s = C.applyMove(s, [6,6],[4,6]);
// Qd8(0,3)->h4(4,7)
s = C.applyMove(s, [0,3],[4,7]);
check("폴스메이트 -> checkmate", C.status(s), "checkmate");

// 3) 캐슬링 가능: 백 킹사이드 (f1,g1 비우기)
let s2 = C.initialState();
s2.board[7][5] = ""; s2.board[7][6] = "";   // f1,g1 제거(비숍·나이트)
const kMoves = C.legalMoves(s2, 7, 4);
check("백 킹 캐슬링 이동 포함", kMoves.some(m => m[2] === "castleK"), true);

// 4) 체크 상황 인식: 흑 e5 폰, 백 퀸이 흑왕 체크
let s3 = C.initialState();
s3.board = Array.from({length:8},()=>Array(8).fill(""));
s3.board[0][4] = "bk"; s3.board[7][4] = "wk"; s3.board[0][0] = "wq"; // wq a8, bk e8 -> 같은 랭크 공격? a8-e8 사이 비어있으면 체크
s3.turn = "b";
check("흑 체크 인식", C.inCheck(s3.board, "b"), true);

// 5) 스테일메이트: 흑왕 a8, 백 퀸 b6, 백왕 c6, 흑 차례 -> 이동 불가·체크아님
let s4 = C.initialState();
s4.board = Array.from({length:8},()=>Array(8).fill(""));
s4.board[0][0] = "bk";   // a8
s4.board[2][1] = "wq";   // b6
s4.board[2][2] = "wk";   // c6
s4.turn = "b";
check("스테일메이트", C.status(s4), "stalemate");

// 6) 승격 감지
let s5 = C.initialState();
s5.board = Array.from({length:8},()=>Array(8).fill(""));
s5.board[1][0] = "wp"; s5.board[0][4]="bk"; s5.board[7][4]="wk"; s5.turn="w";
check("폰 승격 감지", C.isPromotion(s5, [1,0],[0,0]), true);
const s6 = C.applyMove(s5, [1,0],[0,0]);  // 승격 -> 기본 퀸
check("승격 후 퀸", s6.board[0][0], "wq");

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);

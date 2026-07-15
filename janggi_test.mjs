import { createRequire } from "module";
const require = createRequire(import.meta.url);
const J = require("./janggi.js");
let pass=0, fail=0;
const has=(arr,r,c)=>arr.some(m=>m[0]===r&&m[1]===c);
const check=(d,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);console.log(`${ok?"✅":"❌"} ${d} => ${JSON.stringify(got)}`);ok?pass++:fail++;};

let s = J.initialState();
// 1) 초기 기물 수 32 (각 16)
let cnt=0; for(const row of s.board)for(const p of row)if(p)cnt++;
check("초기 기물 32", cnt, 32);

// 2) 한 마(9,1) 이동에 (7,0),(7,2) 포함 (앞다리 8,1 비어있음)
check("마(9,1)->(7,2) 가능", has(J.legalMoves(s,9,1),7,2), true);
check("마(9,1)->(7,0) 가능", has(J.legalMoves(s,9,1),7,0), true);

// 3) 궁(8,4)은 궁성 안에서만: (8,3),(8,5),(7,4) 가능, (8,4)->(6,4) 불가
const km=J.legalMoves(s,8,4);
check("궁 (8,4)->(7,4) 가능", has(km,7,4), true);
check("궁 (8,4)->(6,4) 불가(궁성밖)", has(km,6,4), false);

// 4) 궁 대각선: 빈 궁성에서 궁(8,4)->(9,5) 가능(대각 점)
let sd={board:Array.from({length:10},()=>Array(9).fill("")),turn:"r"};
sd.board[8][4]="rk";
check("궁 대각 (8,4)->(9,5)", has(J.legalMoves(sd,8,4),9,5), true);
check("궁 대각 (8,4)->(7,3)", has(J.legalMoves(sd,8,4),7,3), true);

// 5) 포 넘기: 빈 보드에 포(5,4), 스크린 졸(5,2), 그 뒤 (5,0)
let s2={board:Array.from({length:10},()=>Array(9).fill("")),turn:"r"};
s2.board[5][4]="ro"; s2.board[5][2]="rp"; s2.board[5][0]="bp"; // 스크린 rp, 뒤 적 bp
const om=J.legalMoves(s2,5,4);
check("포가 스크린 넘어 (5,0) 잡기", has(om,5,0), true);
check("포는 스크린(5,2) 자리엔 못감", has(om,5,2), false);

// 6) 포는 포를 못넘음: 스크린이 포이면 이동 불가
let s3={board:Array.from({length:10},()=>Array(9).fill("")),turn:"r"};
s3.board[5][4]="ro"; s3.board[5][2]="bo"; s3.board[5][0]="bp";
check("포는 포(스크린) 못넘음", has(J.legalMoves(s3,5,4),5,0), false);

// 7) 차 궁성 대각: 차를 (7,3)에 두면 (8,4),(9,5)로 대각 이동
let s4={board:Array.from({length:10},()=>Array(9).fill("")),turn:"r"};
s4.board[7][3]="rc"; s4.board[8][4]="";
check("차 궁성대각 (7,3)->(9,5)", has(J.legalMoves(s4,7,3),9,5), true);

// 8) 마 다리 막힘: 앞에 기물 있으면 그 방향 이동 불가
let s5={board:Array.from({length:10},()=>Array(9).fill("")),turn:"r"};
s5.board[5][4]="rh"; s5.board[4][4]="rp"; // 위 다리 막음
check("마 위 다리막힘 -> (3,3) 불가", has(J.legalMoves(s5,5,4),3,3), false);
check("마 옆다리 열림 -> (4,6) 가능", has(J.legalMoves(s5,5,4),4,6), true);

// 9) 궁 잡으면 승리 판정
let s6={board:Array.from({length:10},()=>Array(9).fill("")),turn:"r"};
s6.board[5][4]="rc"; s6.board[5][7]="bk";
const ap=J.applyMove(s6,[5,4],[5,7]);
check("차가 상대 궁 잡음", ap.captured, "bk");
check("잡은 뒤 초 궁 사라짐", J.kingAlive(ap.state.board,"b"), false);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);

-- =====================================================================
--  승리 애니메이션(승리 연출) 스킨 추가 마이그레이션  (2026-07)
--  Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 [Run]
--  재실행해도 안전 (if not exists / on conflict / create or replace)
--  기존 데이터·학생·전적·스킨은 그대로 유지됩니다.
--
--  '승리 연출'은 종목 공통 스킨입니다. 이기면 승자가 장착한 애니메이션이
--  화면에 재생돼요 (오목·체스·장기·AI연습·온라인 모두 적용).
-- =====================================================================

-- 1) 장착 컬럼
alter table students add column if not exists equip_victory text;

-- 2) equip_item 함수: 'victory' 종류 허용 (나머지 로직 동일)
create or replace function equip_item(p_student bigint, p_item text)
returns json language plpgsql security definer as $$
declare it shop_items; s students;
begin
  select * into s from students where id = p_student;
  if s.id is null then raise exception '학생을 찾을 수 없습니다.'; end if;

  if p_item is null then
    return json_build_object('ok', true);
  end if;

  select * into it from shop_items where id = p_item;
  if it.id is null then raise exception '없는 아이템입니다.'; end if;
  if it.price > 0 and not (s.owned ? p_item) then raise exception '보유하지 않은 아이템입니다.'; end if;

  if it.kind not in ('board','stone','chessboard','chesspiece','janggiboard','janggipiece','victory') then
    raise exception '알 수 없는 스킨 종류입니다: %', it.kind;
  end if;
  execute format('update students set %I = $1 where id = $2', 'equip_' || it.kind)
    using p_item, p_student;
  return json_build_object('ok', true, 'kind', it.kind, 'item', p_item);
end;
$$;
grant execute on function equip_item(bigint, text) to anon, authenticated;

-- 3) 승리 연출 아이템 (기본 1 + 유료 6)
--    data.type: confetti(색종이) / emoji(이모지 샤워) / fireworks(불꽃놀이)
--    emoji.motion: fall(위→아래) · rise(아래→위) · burst(가운데서 터짐)
insert into shop_items (id, name, price, kind, data, sort) values
  ('vic_confetti',  '🎉 기본 색종이',   0,   'victory', '{"type":"confetti"}', 40),
  ('vic_hearts',    '💖 하트 샤워',     200, 'victory', '{"type":"emoji","emojis":["💖","💗","❤️","💕"],"motion":"rise","prevBg":"radial-gradient(circle at 50% 40%,#ff8ab5,#c23a6b)"}', 41),
  ('vic_stars',     '⭐ 별똥별',        250, 'victory', '{"type":"emoji","emojis":["⭐","🌟","✨"],"motion":"fall","prevBg":"radial-gradient(circle at 50% 30%,#3a4670,#141a33)"}', 42),
  ('vic_sakura',    '🌸 벚꽃 잔치',     300, 'victory', '{"type":"emoji","emojis":["🌸","🌺","🌼","💮"],"motion":"fall","prevBg":"radial-gradient(circle at 50% 40%,#ffd9e6,#e79ab5)"}', 43),
  ('vic_crown',     '👑 왕관의 비',     350, 'victory', '{"type":"emoji","emojis":["👑","✨","🏆"],"motion":"fall","prevBg":"radial-gradient(circle at 50% 35%,#7a5c1e,#2e2308)"}', 44),
  ('vic_fireworks', '🎆 불꽃놀이',      400, 'victory', '{"type":"fireworks","prevBg":"radial-gradient(circle at 50% 55%,#1a2140,#070a18)"}', 45),
  ('vic_rainbow',   '🌈 무지개 폭죽',   450, 'victory', '{"type":"fireworks","rainbow":true,"prevBg":"radial-gradient(circle at 50% 55%,#241a40,#080614)"}', 46)
on conflict (id) do update
  set name = excluded.name, price = excluded.price, kind = excluded.kind,
      data = excluded.data, sort = excluded.sort;

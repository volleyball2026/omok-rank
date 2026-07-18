-- =====================================================================
--  체스·장기 스킨 추가 마이그레이션  (2026-07)
--  Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 [Run]
--  재실행해도 안전 (if not exists / on conflict / create or replace)
--  기존 데이터·학생·전적은 그대로 유지됩니다.
-- =====================================================================

-- 1) 장착 컬럼 4개
alter table students add column if not exists equip_chessboard  text;
alter table students add column if not exists equip_chesspiece  text;
alter table students add column if not exists equip_janggiboard text;
alter table students add column if not exists equip_janggipiece text;

-- 2) equip_item 함수: 종류별 컬럼(equip_<kind>)로 일반화
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

  if it.kind not in ('board','stone','chessboard','chesspiece','janggiboard','janggipiece') then
    raise exception '알 수 없는 스킨 종류입니다: %', it.kind;
  end if;
  execute format('update students set %I = $1 where id = $2', 'equip_' || it.kind)
    using p_item, p_student;
  return json_build_object('ok', true, 'kind', it.kind, 'item', p_item);
end;
$$;
grant execute on function equip_item(bigint, text) to anon, authenticated;

-- 3) 신규 아이템 (체스판 5 · 체스기물 6 · 장기판 4 · 장기기물 5)
insert into shop_items (id, name, price, kind, data, sort) values
  ('cboard_wood',   '기본 체스판',   0,   'chessboard', '{"light":"#f0d9b5","dark":"#b58863","border":"#6b4423"}', 0),
  ('cboard_marble', '대리석 체스판', 200, 'chessboard', '{"light":"#e8eef2","dark":"#8aa0b0","border":"#556676"}', 1),
  ('cboard_forest', '숲 체스판',     250, 'chessboard', '{"light":"#e7efd6","dark":"#7f9b5b","border":"#4a6b32"}', 2),
  ('cboard_royal',  '로열 체스판',   350, 'chessboard', '{"light":"#f3e2c0","dark":"#b08d57","border":"#6b4a10"}', 3),
  ('cboard_neon',   '네온 체스판',   450, 'chessboard', '{"light":"#2a2f45","dark":"#12162a","border":"#5b6cff"}', 4),
  ('cpiece_std',    '기본 기물',     0,   'chesspiece', '{}', 10),
  ('cpiece_gold',   '황금 기물',     250, 'chesspiece', '{"fill":"#ffcf3a","glow":"#ffe58a"}', 11),
  ('cpiece_ruby',   '루비 기물',     250, 'chesspiece', '{"fill":"#ff5a6e","glow":"#ff9aa8"}', 12),
  ('cpiece_ice',    '얼음 기물',     250, 'chesspiece', '{"fill":"#bfe8ff","glow":"#7fd0ff"}', 13),
  ('cpiece_shadow', '그림자 기물',   300, 'chesspiece', '{"fill":"#5a5a66","glow":"#000000"}', 14),
  ('cpiece_neon',   '네온 기물',     350, 'chesspiece', '{"fill":"#c8ff3a","glow":"#eaff8a"}', 15),
  ('jboard_wood',   '기본 장기판',   0,   'janggiboard', '{"bg":"#e6c179","line":"rgba(107,68,35,0.45)","palace":"rgba(150,95,40,0.16)","border":"#6b4423"}', 20),
  ('jboard_hanji',  '한지 장기판',   200, 'janggiboard', '{"bg":"#f3e7cf","line":"rgba(138,106,58,0.5)","palace":"rgba(160,120,60,0.15)","border":"#8a6a3a"}', 21),
  ('jboard_jade',   '옥 장기판',     300, 'janggiboard', '{"bg":"#cfe3c0","line":"rgba(74,107,50,0.45)","palace":"rgba(74,107,50,0.14)","border":"#4a6b32"}', 22),
  ('jboard_night',  '한밤 장기판',   350, 'janggiboard', '{"bg":"#33404f","line":"rgba(157,180,201,0.4)","palace":"rgba(157,180,201,0.14)","border":"#22303f"}', 23),
  ('jpiece_std',    '기본 기물',     0,   'janggipiece', '{}', 30),
  ('jpiece_wood',   '나무 기물',     200, 'janggipiece', '{"disk":"#e8c98f","text":"#5a3a1a","border":"#5a3a1a"}', 31),
  ('jpiece_ink',    '먹 기물',       250, 'janggipiece', '{"disk":"#efe6d0","text":"#1c1c1c","border":"#1c1c1c"}', 32),
  ('jpiece_gold',   '황금 기물',     300, 'janggipiece', '{"disk":"#fff2c0","text":"#a06a00","border":"#d4a017","glow":"#ffd84d"}', 33),
  ('jpiece_royal',  '궁중 기물',     400, 'janggipiece', '{"disk":"#3a2c55","text":"#ffd84d","border":"#b79bff","glow":"#a06bff"}', 34)
on conflict (id) do update
  set name = excluded.name, price = excluded.price, kind = excluded.kind,
      data = excluded.data, sort = excluded.sort;

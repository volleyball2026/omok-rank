-- ============================================================
--  오목 랭킹 시스템 - Supabase(Postgres) 스키마
--  Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 [Run] 하세요.
-- ============================================================

-- ---------- 테이블 ----------
create table if not exists students (
  id         bigint generated always as identity primary key,
  name       text unique not null,
  tier       text not null default '브론즈',
  lp         int  not null default 0,
  wins       int  not null default 0,
  losses     int  not null default 0,
  streak     int  not null default 0,   -- 현재 연승 수
  created_at timestamptz not null default now()
);
-- 이전 버전 스키마를 이미 실행했다면 아래로 컬럼들을 보강
alter table students add column if not exists streak int not null default 0;
alter table students add column if not exists points int not null default 0;                 -- 상점 포인트
alter table students add column if not exists owned jsonb not null default '[]'::jsonb;        -- 보유 스킨 id 목록
alter table students add column if not exists equip_board text;                                -- 장착한 바둑판 스킨 id
alter table students add column if not exists equip_stone text;                                -- 장착한 바둑알 스킨 id

-- ---------- 상점 아이템 카탈로그 (가격의 단일 소스) ----------
create table if not exists shop_items (
  id    text primary key,
  name  text not null,
  price int  not null,
  kind  text not null,                 -- 'board' | 'stone'
  data  jsonb not null default '{}'::jsonb,
  sort  int not null default 0
);

insert into shop_items (id, name, price, kind, data, sort) values
  ('board_wood',   '기본 나무판',   0,   'board', '{"bg":"#e9b96e","line":"#7a5230","star":"#7a5230"}', 0),
  ('board_night',  '한밤의 판',     150, 'board', '{"bg":"#33404f","line":"#9db4c9","star":"#9db4c9"}', 1),
  ('board_sakura', '벚꽃 판',       200, 'board', '{"bg":"#ffdbe4","line":"#c56a86","star":"#c56a86"}', 2),
  ('board_forest', '숲속 판',       250, 'board', '{"bg":"#cfe3b8","line":"#4a6b32","star":"#4a6b32"}', 3),
  ('board_ocean',  '바다 판',       350, 'board', '{"bg":"linear-gradient(135deg,#a8d8f0,#5b8dff)","line":"#1c4e8a","star":"#1c4e8a"}', 4),
  ('board_gold',   '황금 궁전판',   600, 'board', '{"bg":"linear-gradient(135deg,#ffe9a8,#e0a800)","line":"#8a6a10","star":"#8a6a10"}', 5),
  ('stone_ink',    '먹돌/백돌',      0,  'stone', '{"black":{"in":"#555","out":"#111"},"white":{"in":"#fff","out":"#cfd3d8"}}', 0),
  ('stone_jade',   '옥 바둑알',     150, 'stone', '{"in":"#a8f0c0","out":"#2e8b57"}', 1),
  ('stone_ruby',   '루비 바둑알',   150, 'stone', '{"in":"#ff9a9a","out":"#c0182b"}', 2),
  ('stone_sky',    '하늘 바둑알',   150, 'stone', '{"in":"#bfe3ff","out":"#2b6fc0"}', 3),
  ('stone_gold',   '황금 바둑알',   300, 'stone', '{"in":"#fff2b0","out":"#e0a800","glow":"#ffd84d"}', 4),
  ('stone_shadow', '흑요석 바둑알', 250, 'stone', '{"in":"#8a8a8a","out":"#000","glow":"#444"}', 5),
  ('stone_galaxy', '은하 바둑알',   400, 'stone', '{"in":"#d0a8ff","out":"#3a1c71","glow":"#a06bff"}', 6)
on conflict (id) do update
  set name = excluded.name, price = excluded.price, kind = excluded.kind,
      data = excluded.data, sort = excluded.sort;

-- 추가 스킨 (#6)
insert into shop_items (id, name, price, kind, data, sort) values
  ('board_ice',    '얼음 판',       300, 'board', '{"bg":"linear-gradient(135deg,#e3f4ff,#b8d8f0)","line":"#4a7ba6","star":"#4a7ba6"}', 6),
  ('board_lava',   '용암 판',       450, 'board', '{"bg":"linear-gradient(135deg,#ff9a5a,#c0261b)","line":"#5a1006","star":"#ffd24d"}', 7),
  ('board_space',  '우주 판',       700, 'board', '{"bg":"linear-gradient(135deg,#2a1a4a,#4a2c7a)","line":"#b79bff","star":"#ffd84d"}', 8),
  ('board_hanji',  '한지 판',       250, 'board', '{"bg":"#f3e7cf","line":"#8a6a3a","star":"#8a6a3a"}', 9),
  ('stone_emerald','에메랄드 바둑알', 200, 'stone', '{"in":"#b7ffd8","out":"#0f8a55","glow":"#5cf0a8"}', 7),
  ('stone_neon',   '네온 바둑알',    350, 'stone', '{"in":"#e0ff70","out":"#7ac400","glow":"#c8ff3a"}', 8),
  ('stone_candy',  '캔디 바둑알',    250, 'stone', '{"in":"#ffd0ec","out":"#ff5fa8","glow":"#ff9ad0"}', 9),
  ('stone_pearl',  '진주 바둑알',    300, 'stone', '{"in":"#ffffff","out":"#dfe6f0","glow":"#eaf2ff"}', 10),
  ('stone_flame',  '불꽃 바둑알',    500, 'stone', '{"in":"#fff2a8","out":"#e03b00","glow":"#ff7a1a"}', 11),
  ('stone_ocean',  '심해 바둑알',    400, 'stone', '{"in":"#8fdfff","out":"#0a4a8a","glow":"#3aa8ff"}', 12)
on conflict (id) do update
  set name = excluded.name, price = excluded.price, kind = excluded.kind,
      data = excluded.data, sort = excluded.sort;

create table if not exists match_history (
  id               bigint generated always as identity primary key,
  winner_id        bigint references students(id) on delete set null,
  winner_name      text not null,
  loser_id         bigint references students(id) on delete set null,
  loser_name       text not null,
  winner_lp_change int not null,
  loser_lp_change  int not null,
  played_at        timestamptz not null default now()
);

-- ---------- 티어 유틸 함수 ----------
create or replace function tier_index(t text) returns int
language sql immutable as $$
  select case t
    when '브론즈' then 0
    when '실버'   then 1
    when '골드'   then 2
    when '플래티넘' then 3
    when '다이아몬드' then 4
    else 0 end;
$$;

create or replace function tier_name(i int) returns text
language sql immutable as $$
  select (array['브론즈','실버','골드','플래티넘','다이아몬드'])[least(greatest(i,0),4) + 1];
$$;

-- ---------- 대국 결과 등록 (자동 점수/티어 계산) ----------
-- Elo 가중치: 동등 ±15, 티어 차이 1당 ±5, 하한 10 / 상한 30
create or replace function record_match(p_winner_id bigint, p_loser_id bigint)
returns json
language plpgsql
security definer          -- RLS 우회하여 점수 갱신 (아래 정책으로 직접 UPDATE는 막음)
as $$
declare
  w students; l students;
  diff int;
  win_gain int; lose_loss int; w_pts int; l_pts int;
  consec int; pair_recent int;
  w_idx int; l_idx int; w_lp int; l_lp int;
  new_w_tier text; new_l_tier text;
begin
  if p_winner_id = p_loser_id then
    raise exception '승자와 패자가 같을 수 없습니다.';
  end if;

  select * into w from students where id = p_winner_id;
  select * into l from students where id = p_loser_id;
  if w.id is null or l.id is null then
    raise exception '학생을 찾을 수 없습니다.';
  end if;

  -- (#1) 연속 리매치 제한: 승자의 최근 2경기가 모두 이 상대였다면 3번째는 금지
  select count(*) into consec from (
    select case when winner_id = p_winner_id then loser_id else winner_id end as opp
    from match_history
    where winner_id = p_winner_id or loser_id = p_winner_id
    order by id desc limit 2
  ) t where opp = p_loser_id;
  if consec >= 2 then
    raise exception '같은 친구와는 연속 2판까지만! 다른 친구와 한 판 두고 오세요.';
  end if;

  -- (#3) 패작 방지: 최근 3시간 내 같은 상대와의 대국 수 (많으면 보상 감소)
  select count(*) into pair_recent from match_history
  where played_at > now() - interval '3 hours'
    and ((winner_id = p_winner_id and loser_id = p_loser_id)
      or (winner_id = p_loser_id and loser_id = p_winner_id));

  -- (#7) LP 변동: 동등 기준 승 +15 / 패 -10, 티어차 1당 ±5 (상·하위 대결 반영 #2)
  diff      := tier_index(w.tier) - tier_index(l.tier);
  win_gain  := greatest(8, least(30, 15 - 5 * diff));
  lose_loss := greatest(5, least(25, 10 - 5 * diff));
  -- (#2) 포인트: 이변(하위가 상위 이김)일수록 승자 포인트 증가
  w_pts := 10 + win_gain;
  l_pts := 5;
  -- (#3) 같은 상대와 반복(3판째부터)이면 보상 대폭 감소 -> 패작 이득 제거
  if pair_recent >= 2 then
    win_gain := 3; lose_loss := 2; w_pts := 2; l_pts := 1;
  end if;

  -- 승자: 승급 처리 (100 도달 시 승급, 초과분 이월. 다이아 최대 100)
  w_idx := tier_index(w.tier);
  w_lp  := w.lp + win_gain;
  while w_lp >= 100 loop
    if w_idx < 4 then
      w_idx := w_idx + 1;
      w_lp  := w_lp - 100;
    else
      w_lp := 100;
      exit;
    end if;
  end loop;
  new_w_tier := tier_name(w_idx);

  -- 패자: 강등 처리 (0 미만이면 강등, 브론즈 밑으로는 강등 없음)
  l_idx := tier_index(l.tier);
  l_lp  := l.lp - lose_loss;
  if l_lp < 0 then
    if l_idx > 0 then
      l_idx := l_idx - 1;
      l_lp  := 100 + l_lp;
    else
      l_lp := 0;
    end if;
  end if;
  new_l_tier := tier_name(l_idx);

  update students set tier = new_w_tier, lp = w_lp, wins = wins + 1,
                     streak = w.streak + 1, points = points + w_pts where id = w.id;
  update students set tier = new_l_tier, lp = l_lp, losses = losses + 1,
                     streak = 0, points = points + l_pts where id = l.id;

  insert into match_history
    (winner_id, winner_name, loser_id, loser_name, winner_lp_change, loser_lp_change)
  values (w.id, w.name, l.id, l.name, win_gain, -lose_loss);

  return json_build_object(
    'winner', json_build_object(
      'id', w.id, 'name', w.name, 'lp_change', win_gain,
      'old_tier', w.tier, 'new_tier', new_w_tier, 'new_lp', w_lp,
      'streak', w.streak + 1, 'points_gain', w_pts,
      'promoted', tier_index(new_w_tier) > tier_index(w.tier)),
    'loser', json_build_object(
      'id', l.id, 'name', l.name, 'lp_change', -lose_loss,
      'old_tier', l.tier, 'new_tier', new_l_tier, 'new_lp', l_lp,
      'points_gain', l_pts,
      'demoted', tier_index(new_l_tier) < tier_index(l.tier))
  );
end;
$$;

-- ---------- RLS(행 보안) ----------
-- 브라우저는 anon 키로 접근합니다. 조회/학생등록은 허용하되,
-- 점수(students) 직접 수정/삭제는 막고 record_match 함수로만 바뀌게 합니다.
alter table students enable row level security;
alter table match_history enable row level security;

drop policy if exists "students read"   on students;
drop policy if exists "students insert" on students;
drop policy if exists "history read"    on match_history;

create policy "students read"   on students        for select using (true);
create policy "students insert" on students        for insert with check (true);
create policy "history read"    on match_history   for select using (true);

-- ---------- 학생 관리 함수 (이름 수정 / 삭제 / 시즌 초기화) ----------
create or replace function rename_student(p_id bigint, p_name text)
returns void language plpgsql security definer as $$
begin
  if length(trim(p_name)) = 0 then raise exception '이름을 입력해 주세요.'; end if;
  update students set name = trim(p_name) where id = p_id;
end;
$$;

create or replace function delete_student(p_id bigint)
returns void language plpgsql security definer as $$
begin
  delete from match_history where winner_id = p_id or loser_id = p_id;
  delete from students where id = p_id;
end;
$$;

-- 시즌 초기화: 모든 학생 점수/전적을 브론즈 0LP로 되돌리고 경기 기록 삭제
create or replace function reset_season()
returns void language plpgsql security definer as $$
begin
  delete from match_history;
  update students set tier = '브론즈', lp = 0, wins = 0, losses = 0, streak = 0;
end;
$$;

-- ---------- 상점: 구매 / 장착 ----------
-- 구매: 가격은 서버(shop_items)에서 조회 -> 클라이언트가 가격을 조작할 수 없음
create or replace function buy_item(p_student bigint, p_item text)
returns json language plpgsql security definer as $$
declare it shop_items; s students;
begin
  select * into it from shop_items where id = p_item;
  if it.id is null then raise exception '없는 아이템입니다.'; end if;
  select * into s from students where id = p_student;
  if s.id is null then raise exception '학생을 찾을 수 없습니다.'; end if;
  if s.owned ? p_item then raise exception '이미 보유한 아이템입니다.'; end if;
  if it.price > 0 and s.points < it.price then raise exception '포인트가 부족합니다.'; end if;

  update students
     set points = points - it.price,
         owned  = owned || to_jsonb(p_item)
   where id = p_student;

  select * into s from students where id = p_student;
  return json_build_object('points', s.points, 'owned', s.owned);
end;
$$;

-- 장착: 보유했거나 무료(가격 0)인 아이템만. p_item이 null이면 기본으로 되돌림.
create or replace function equip_item(p_student bigint, p_item text)
returns json language plpgsql security definer as $$
declare it shop_items; s students;
begin
  select * into s from students where id = p_student;
  if s.id is null then raise exception '학생을 찾을 수 없습니다.'; end if;

  if p_item is null then
    return json_build_object('ok', true); -- (사용 안 함: 항상 아이템 지정)
  end if;

  select * into it from shop_items where id = p_item;
  if it.id is null then raise exception '없는 아이템입니다.'; end if;
  if it.price > 0 and not (s.owned ? p_item) then raise exception '보유하지 않은 아이템입니다.'; end if;

  if it.kind = 'board' then
    update students set equip_board = p_item where id = p_student;
  else
    update students set equip_stone = p_item where id = p_student;
  end if;
  return json_build_object('ok', true, 'kind', it.kind, 'item', p_item);
end;
$$;

-- ---------- 권한 부여 ----------
grant execute on function record_match(bigint, bigint) to anon, authenticated;
grant execute on function rename_student(bigint, text) to anon, authenticated;
grant execute on function delete_student(bigint)        to anon, authenticated;
grant execute on function reset_season()                to anon, authenticated;
grant execute on function buy_item(bigint, text)        to anon, authenticated;
grant execute on function equip_item(bigint, text)      to anon, authenticated;

-- 상점 카탈로그는 누구나 조회 가능
alter table shop_items enable row level security;
drop policy if exists "shop read" on shop_items;
create policy "shop read" on shop_items for select using (true);

-- ============================================================
--  계정(비밀번호) + 관리자 모드
-- ============================================================

-- 학생 비밀번호: 별도 테이블 + RLS(정책 없음) = anon 키로 직접 못 읽음. 검증은 아래 함수로만.
create table if not exists student_auth (
  student_id bigint primary key references students(id) on delete cascade,
  pw_hash    text not null
);
alter table student_auth enable row level security;

-- 앱 설정(관리자 비밀번호). 마찬가지로 잠금.
create table if not exists app_config (
  key   text primary key,
  value text not null
);
alter table app_config enable row level security;
insert into app_config(key, value) values ('admin_pw', md5('2875'))
  on conflict (key) do nothing;   -- 관리자 비번: 2875 (관리자 모드에서 변경 가능)

-- 학생 등록(이름 + 비밀번호)
create or replace function register_student(p_name text, p_password text)
returns json language plpgsql security definer as $$
declare new_id bigint; nm text;
begin
  nm := trim(p_name);
  if length(nm) = 0 then raise exception '이름을 입력해 주세요.'; end if;
  if length(coalesce(p_password,'')) = 0 then raise exception '비밀번호를 입력해 주세요.'; end if;
  if exists(select 1 from students where name = nm) then raise exception '이미 등록된 이름입니다.'; end if;
  insert into students(name) values (nm) returning id into new_id;
  insert into student_auth(student_id, pw_hash) values (new_id, md5(p_password));
  return json_build_object('id', new_id, 'name', nm);
end; $$;

-- 학생 비밀번호 확인 (해시는 반환하지 않고 참/거짓만)
create or replace function verify_student(p_id bigint, p_password text)
returns boolean language plpgsql security definer as $$
declare ok boolean;
begin
  select (pw_hash = md5(coalesce(p_password,''))) into ok from student_auth where student_id = p_id;
  return coalesce(ok, false);
end; $$;

-- 관리자 확인
create or replace function is_admin(p_pw text) returns boolean
language sql security definer stable as $$
  select exists(select 1 from app_config where key = 'admin_pw' and value = md5(coalesce(p_pw,'')));
$$;

-- 관리자: 학생 능력치 조정 (포인트/LP/티어/전적)
create or replace function admin_edit_student(p_admin_pw text, p_id bigint,
   p_points int, p_lp int, p_tier text, p_wins int, p_losses int, p_streak int)
returns void language plpgsql security definer as $$
begin
  if not is_admin(p_admin_pw) then raise exception '관리자 비밀번호가 틀립니다.'; end if;
  update students set
     points = greatest(0, p_points),
     lp     = greatest(0, least(100, p_lp)),
     tier   = p_tier,
     wins   = greatest(0, p_wins),
     losses = greatest(0, p_losses),
     streak = greatest(0, p_streak)
   where id = p_id;
end; $$;

create or replace function admin_rename_student(p_admin_pw text, p_id bigint, p_name text)
returns void language plpgsql security definer as $$
begin
  if not is_admin(p_admin_pw) then raise exception '관리자 비밀번호가 틀립니다.'; end if;
  if length(trim(p_name)) = 0 then raise exception '이름을 입력해 주세요.'; end if;
  update students set name = trim(p_name) where id = p_id;
end; $$;

create or replace function admin_delete_student(p_admin_pw text, p_id bigint)
returns void language plpgsql security definer as $$
begin
  if not is_admin(p_admin_pw) then raise exception '관리자 비밀번호가 틀립니다.'; end if;
  delete from match_history where winner_id = p_id or loser_id = p_id;
  delete from students where id = p_id;   -- student_auth 는 cascade 로 함께 삭제
end; $$;

create or replace function admin_reset_student_pw(p_admin_pw text, p_id bigint, p_new text)
returns void language plpgsql security definer as $$
begin
  if not is_admin(p_admin_pw) then raise exception '관리자 비밀번호가 틀립니다.'; end if;
  if length(coalesce(p_new,'')) = 0 then raise exception '새 비밀번호를 입력해 주세요.'; end if;
  insert into student_auth(student_id, pw_hash) values (p_id, md5(p_new))
    on conflict (student_id) do update set pw_hash = md5(p_new);
end; $$;

create or replace function admin_reset_season(p_admin_pw text)
returns void language plpgsql security definer as $$
begin
  if not is_admin(p_admin_pw) then raise exception '관리자 비밀번호가 틀립니다.'; end if;
  delete from match_history;
  update students set tier = '브론즈', lp = 0, wins = 0, losses = 0, streak = 0;
end; $$;

create or replace function admin_set_password(p_admin_pw text, p_new text)
returns void language plpgsql security definer as $$
begin
  if not is_admin(p_admin_pw) then raise exception '현재 관리자 비밀번호가 틀립니다.'; end if;
  if length(coalesce(p_new,'')) = 0 then raise exception '새 비밀번호를 입력해 주세요.'; end if;
  update app_config set value = md5(p_new) where key = 'admin_pw';
end; $$;

-- 계정/관리자 함수 권한
grant execute on function register_student(text, text)      to anon, authenticated;
grant execute on function verify_student(bigint, text)      to anon, authenticated;
grant execute on function is_admin(text)                    to anon, authenticated;
grant execute on function admin_edit_student(text, bigint, int, int, text, int, int, int) to anon, authenticated;
grant execute on function admin_rename_student(text, bigint, text)   to anon, authenticated;
grant execute on function admin_delete_student(text, bigint)         to anon, authenticated;
grant execute on function admin_reset_student_pw(text, bigint, text) to anon, authenticated;
grant execute on function admin_reset_season(text)          to anon, authenticated;
grant execute on function admin_set_password(text, text)    to anon, authenticated;

-- 등록은 register_student(비번 포함) 로만: 학생 테이블 직접 insert 정책 제거
drop policy if exists "students insert" on students;
-- 예전 무방비 함수는 anon 이 직접 못 부르게 차단 (관리자 함수로 대체됨)
revoke execute on function rename_student(bigint, text) from anon, authenticated;
revoke execute on function delete_student(bigint)       from anon, authenticated;
revoke execute on function reset_season()               from anon, authenticated;

-- ---------- 실시간 동기화(Realtime) ----------
-- 한 기기에서 결과를 기록하면 다른 기기 랭킹이 자동 갱신되도록 테이블을 게시에 추가
do $$
begin
  alter publication supabase_realtime add table students;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table match_history;
exception when others then null;
end $$;

-- ============================================================
--  복기(게임 수순 저장) - game_records
-- ============================================================
create table if not exists game_records (
  id         bigint generated always as identity primary key,
  game_type  text not null,              -- omok | chess | janggi
  p1_id      bigint, p1_name text,       -- 오목:흑 / 체스:백 / 장기:한 (선공)
  p2_id      bigint, p2_name text,       -- 오목:백 / 체스:흑 / 장기:초 (후공)
  winner_id  bigint,                     -- null 이면 무승부
  result     text not null,              -- win | draw
  moves      jsonb not null,             -- [[..],[..]] 게임별 수순
  created_at timestamptz not null default now()
);
alter table game_records enable row level security;
drop policy if exists "gr read"   on game_records;
drop policy if exists "gr insert" on game_records;
create policy "gr read"   on game_records for select using (true);
create policy "gr insert" on game_records for insert with check (true);

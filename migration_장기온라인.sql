-- =====================================================================
--  장기 온라인 대국 지원 마이그레이션  (2026-07)
--  Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 [Run]
--  재실행해도 안전 (create or replace). 기존 데이터·진행중 대국 영향 없음.
--
--  왜 필요한가:
--   online_games.game_type 는 자유 텍스트라 'janggi' 저장 자체는 문제없지만,
--   og_move 가 turn 컬럼으로 차례를 검증한다. og_create 가 장기 초기 차례를
--   'black'(초)로 잡으면, 한(선공) 플레이어의 첫 수를 서버가 막아버린다.
--   → 초기 차례 규약을 "오목=black, 그 외(체스·장기)=white(=한/백 선공)"로 통일.
-- =====================================================================

-- 1) og_create: 초기 차례 = 오목만 흑, 체스·장기는 white 선공
create or replace function og_create(p_code text, p_host_id bigint, p_host_name text, p_main int, p_inc int, p_ranked boolean, p_host_color text, p_game_type text)
returns online_games language plpgsql security definer as $$
declare g online_games;
begin
  insert into online_games(code, host_id, host_name, time_main, time_inc, ranked, host_color, game_type, turn, host_ms, guest_ms)
  values (p_code, p_host_id, p_host_name, p_main, p_inc, p_ranked, coalesce(p_host_color,'black'),
          coalesce(p_game_type,'omok'),
          case when coalesce(p_game_type,'omok')='omok' then 'black' else 'white' end,   -- 오목=흑 / 체스=백·장기=한(white) 선공
          case when p_main>0 then p_main*1000 end, case when p_main>0 then p_main*1000 end)
  returning * into g;
  return g;
end; $$;
grant execute on function og_create(text,bigint,text,int,int,boolean,text,text) to anon, authenticated;

-- 2) og_rematch: 재대국 재시작 시 초기 차례도 같은 규약으로
create or replace function og_rematch(p_id bigint, p_player bigint)
returns online_games language plpgsql security definer as $$
declare g online_games;
begin
  select * into g from online_games where id = p_id;
  if g.id is null then raise exception '대국을 찾을 수 없어요.'; end if;
  if g.status <> 'done' then return g; end if;
  if g.rematch_offer is not null and g.rematch_offer <> p_player then   -- 상대가 이미 요청 -> 재시작
    update online_games set
      moves='[]'::jsonb, winner_id=null, result=null, status='playing',
      turn = case when g.game_type='omok' then 'black' else 'white' end,   -- 오목=흑 / 체스·장기=white 선공
      host_color = case when host_color='black' then 'white' else 'black' end,   -- 색 교대
      host_ms = case when time_main>0 then time_main*1000 end,
      guest_ms = case when time_main>0 then time_main*1000 end,
      last_move_at=now(), recorded=false, rematch_offer=null, updated_at=now()
    where id=p_id returning * into g;
  else
    update online_games set rematch_offer=p_player, updated_at=now() where id=p_id returning * into g;
  end if;
  return g;
end; $$;

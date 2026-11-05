\set ON_ERROR_STOP on
begin;
insert into public.profiles(user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into public.channels(id,owner_id,youtube_channel_id,name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',
   'UCaaaaaaaaaaaaaaaaaaaaaa','Canal A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222',
   'UCbbbbbbbbbbbbbbbbbbbbbb','Canal B');
insert into public.videos(id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'aaaaaaaaaaa','Obra Distinta Parte 1','https://youtube.com/a','https://youtube.com/a',now()),
  ('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'bbbbbbbbbbb','Obra Distinta Parte 2','https://youtube.com/b','https://youtube.com/b',now()),
  ('aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'ccccccccccc','Obra Distinta Parte 3','https://youtube.com/c','https://youtube.com/c',now()),
  ('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'ddddddddddd','Outra Obra Parte 1','https://youtube.com/d','https://youtube.com/d',now()),
  ('bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'eeeeeeeeeee','Outra Obra Parte 2','https://youtube.com/e','https://youtube.com/e',now());

insert into public.tracked_stories(id,owner_id,seed_video_id,name,canonical_key) values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001','Obra Distinta','obra distinta'),
  ('cccccccc-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-0000-0000-0000-000000000001','Outra Obra','outra obra');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
set local role authenticated;
insert into public.tracked_stories(owner_id,seed_video_id,name,canonical_key) values
  ('11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001','Outra Obra Própria','outra obra propria');
do $$
begin
  begin
    insert into public.tracked_stories(owner_id,seed_video_id,name,canonical_key) values
      ('11111111-1111-1111-1111-111111111111',
       'bbbbbbbb-0000-0000-0000-000000000001','Outra Obra','outra obra');
    raise exception 'Aceitou vídeo inicial alheio';
  exception when check_violation or insufficient_privilege then null;
  end;
  begin
    update public.tracked_stories set owner_id = '22222222-2222-2222-2222-222222222222';
    raise exception 'Aceitou mudança de proprietário';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tracked_stories set seed_video_id = 'aaaaaaaa-0000-0000-0000-000000000002';
    raise exception 'Aceitou mudança de vídeo inicial';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tracked_stories set last_scanned_at = now();
    raise exception 'Aceitou mudança de cursor';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.story_matches(story_id,video_id,score,reason) values
      ('cccccccc-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000002',90,'Teste');
    raise exception 'Cliente inseriu sugestão';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role service_role;
insert into public.story_matches(id,story_id,video_id,score,reason) values
  ('dddddddd-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002',95,'Parte seguinte'),
  ('dddddddd-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003',90,'Parte seguinte'),
  ('dddddddd-0000-0000-0000-000000000003',
   'cccccccc-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000002',90,'Parte seguinte');
do $$
begin
  begin
    insert into public.story_matches(story_id,video_id,score,reason) values
      ('cccccccc-0000-0000-0000-000000000001',
       'bbbbbbbb-0000-0000-0000-000000000001',80,'Vídeo alheio');
    raise exception 'Coletor vinculou vídeo alheio';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
set local role authenticated;
do $$
begin
  if (select count(*) from public.story_matches) <> 2 then
    raise exception 'Leitura do proprietário falhou';
  end if;
  if exists (select 1 from public.tracked_stories
      where id='cccccccc-0000-0000-0000-000000000002') then
    raise exception 'História de outro proprietário visível';
  end if;
  update public.story_matches set status='confirmed',decided_at=now()
    where id='dddddddd-0000-0000-0000-000000000003';
  if found then raise exception 'Confirmou sugestão alheia'; end if;
  begin
    update public.story_matches set story_id = gen_random_uuid();
    raise exception 'Aceitou troca de história';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.story_matches set video_id = gen_random_uuid();
    raise exception 'Aceitou troca de vídeo';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.story_matches set score = 0;
    raise exception 'Aceitou troca de pontuação';
  exception when insufficient_privilege then null;
  end;
  update public.story_matches set status='confirmed',decided_at=now()
    where id='dddddddd-0000-0000-0000-000000000001';
  if not found then raise exception 'Confirmação falhou'; end if;
  update public.story_matches set status='rejected',decided_at=now()
    where id='dddddddd-0000-0000-0000-000000000002';
  if not found then raise exception 'Rejeição falhou'; end if;
  update public.story_matches set status='confirmed',decided_at=now()
    where id='dddddddd-0000-0000-0000-000000000002';
  if found then raise exception 'Rejeição foi revertida'; end if;
end;
$$;
reset role;
set local role service_role;
insert into public.story_matches(story_id,video_id,score,reason) values
  ('cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003',99,'Nova coleta')
on conflict (story_id,video_id) do nothing;
do $$
begin
  if (select status from public.story_matches
      where id='dddddddd-0000-0000-0000-000000000002') <> 'rejected' then
    raise exception 'Nova coleta reabriu rejeição';
  end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  if has_table_privilege('anon','public.tracked_stories','SELECT') or
     has_table_privilege('anon','public.story_matches','SELECT') then
    raise exception 'Anon tem acesso às histórias';
  end if;
end;
$$;
reset role;
set local role service_role;
insert into public.videos(id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at) values
  ('aaaaaaaa-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'fffffffffff','Obra Distinta Parte 4','https://youtube.com/f','https://youtube.com/f',now());
reset role;
set local role authenticated;
do $$
begin
  if public.attach_story_video('cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000004') <> 'confirmed' then
    raise exception 'Associação manual não confirmou vídeo';
  end if;
  if public.attach_story_video('cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000004') <> 'already_confirmed' then
    raise exception 'Associação manual não é idempotente';
  end if;
  begin
    perform public.attach_story_video('cccccccc-0000-0000-0000-000000000001',
      'aaaaaaaa-0000-0000-0000-000000000003');
    raise exception 'Permitiu reabrir rejeição';
  exception when check_violation then null;
  end;
  begin
    perform public.attach_story_video('cccccccc-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001');
    raise exception 'Permitiu vídeo alheio';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  if has_function_privilege('anon','public.attach_story_video(uuid,uuid)','EXECUTE') then
    raise exception 'Anon pode vincular histórias';
  end if;
  if has_function_privilege('anon','public.story_seed_guard()','EXECUTE') or
    has_function_privilege('anon','public.story_match_guard()','EXECUTE') then
    raise exception 'Anon pode executar guards';
  end if;
end;
$$;
rollback;

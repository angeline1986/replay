-- Aplicar somente após aprovação separada no Supabase hospedado.
-- As funções de trigger não são endpoints públicos.
revoke all on function public.story_seed_guard() from public, anon, authenticated;
revoke all on function public.story_match_guard() from public, anon, authenticated;

-- Associação manual atômica: nunca reabre uma rejeição.
create function public.attach_story_video(p_story_id uuid, p_video_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_seed uuid;
  v_status text;
begin
  if v_owner is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;
  select s.seed_video_id into v_seed from public.tracked_stories s
    where s.id = p_story_id and s.owner_id = v_owner and s.is_followed = true;
  if not found then
    raise exception 'História indisponível' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.videos v join public.channels c on c.id = v.channel_id
    where v.id = p_video_id and c.owner_id = v_owner
  ) then
    raise exception 'Vídeo indisponível' using errcode = '42501';
  end if;
  if p_video_id = v_seed then return 'already_confirmed'; end if;
  -- Serializa associações simultâneas para a mesma história.
  perform 1 from public.tracked_stories where id = p_story_id for update;
  select m.status into v_status from public.story_matches m
    where m.story_id = p_story_id and m.video_id = p_video_id for update;
  if v_status = 'rejected' then
    raise exception 'Esta sugestão foi rejeitada e não pode ser reaberta.' using errcode = '23514';
  end if;
  if v_status = 'confirmed' then return 'already_confirmed'; end if;
  if v_status = 'pending' then
    update public.story_matches set status = 'confirmed', decided_at = now()
      where story_id = p_story_id and video_id = p_video_id;
  else
    insert into public.story_matches (story_id, video_id, status, score, reason, decided_at)
      values (p_story_id, p_video_id, 'confirmed', 100, 'Associação manual confirmada', now());
  end if;
  return 'confirmed';
end;
$$;
revoke all on function public.attach_story_video(uuid,uuid) from public, anon, authenticated;
grant execute on function public.attach_story_video(uuid,uuid) to authenticated;

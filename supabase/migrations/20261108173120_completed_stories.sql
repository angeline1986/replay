alter table public.tracked_stories add column completed_at timestamptz;
alter table public.tracked_stories add constraint tracked_stories_completed_not_followed
  check (completed_at is null or is_followed = false);
create index tracked_stories_owner_completed_idx on public.tracked_stories(owner_id, completed_at desc)
  where completed_at is not null;
grant update (completed_at) on public.tracked_stories to authenticated;

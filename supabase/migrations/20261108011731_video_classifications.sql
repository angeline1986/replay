alter table public.user_video_state
  add column is_deprioritized boolean not null default false,
  add column is_queued boolean not null default false;

create index user_video_state_deprioritized_idx
  on public.user_video_state (user_id, video_id) where is_deprioritized;

create index user_video_state_queued_idx
  on public.user_video_state (user_id, video_id) where is_queued;

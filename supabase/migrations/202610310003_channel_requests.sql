create table public.channel_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  handle text not null check (handle ~ '^[A-Za-z0-9_.-]{3,30}$'),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index channel_requests_pending_idx on public.channel_requests(status, created_at);
create index channel_requests_owner_idx on public.channel_requests(owner_id, created_at desc);
create trigger channel_requests_updated_at before update on public.channel_requests
for each row execute function public.set_updated_at();

alter table public.channel_requests enable row level security;
create policy requests_owner_read on public.channel_requests for select to authenticated
using (owner_id = (select auth.uid()));
create policy requests_owner_insert on public.channel_requests for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'pending' and error_message is null);
create policy requests_owner_delete on public.channel_requests for delete to authenticated
using (owner_id = (select auth.uid()));

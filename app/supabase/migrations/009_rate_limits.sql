-- 009: per-IP throttle counters for the public booking endpoints.
--
-- The Netlify functions are stateless, so the counters live here:
-- one row per (key, fixed window), incremented atomically by the RPC
-- below. Keys look like 'rl:booking-lookup:203.0.113.7' (endpoint +
-- client IP, built by the shared rateLimit helper). The RPC returns
-- whether the request is allowed, how many remain, and seconds until
-- the window resets.
--
-- RLS is on with NO policies: only the service role reaches this
-- table, and only through the SECURITY DEFINER RPC. The grants below
-- follow the rule from migration 008's fix — new tables get no API
-- grants by default, so grant explicitly (service_role only; never
-- anon/authenticated for this table).
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

grant all on public.rate_limits to service_role;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_count integer;
begin
  v_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup: yesterday's windows never matter again.
  delete from public.rate_limits
   where window_start < now() - interval '1 day';

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'reset_after', greatest(
      extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now()))::integer,
      0
    )
  );
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

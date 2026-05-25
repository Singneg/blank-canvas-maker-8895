-- =====================================================================
-- 0007_rebuild_consolidated_schema.sql
-- Recriação total do schema para sincronizar tipos TS e RPC
-- =====================================================================

-- 1. DROP FUNCTIONS FIRST (Para evitar erros de assinatura)
do $$
declare r record;
begin
  for r in
    select n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_available_slots', 'book_appointment', 'ensure_self_customer', 'barber_owner_id', 'is_staff')
  loop
    execute format('drop function if exists %I.%I(%s) cascade',
                   r.nspname, r.proname, r.args);
  end loop;
end $$;

-- 2. CREATE EXTENSIONS
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- 3. CREATE TABLES
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('owner', 'barber', 'master_admin')),
  created_at timestamptz default now(),
  unique(user_id, role)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null,
  duration_minutes integer not null default 30,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  phone text,
  bio text,
  photo_url text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  week_day integer not null check (week_day between 0 and 6),
  start_time time not null,
  end_time time not null,
  lunch_start time,
  lunch_end time,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  email text,
  phone text,
  total_visits integer default 0,
  total_spent_cents integer default 0,
  last_visit_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  barber_id uuid references public.barbers(id),
  service_id uuid references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text default 'scheduled' check (status in ('scheduled', 'confirmed', 'cancelled', 'no_show', 'completed')),
  notes text,
  created_at timestamptz default now()
);

-- 4. HELPER FUNCTIONS
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_roles where user_id = _user_id);
$$;

create or replace function public.barber_owner_id(_barber_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select b.user_id from public.barbers b where b.id = _barber_id and b.user_id is not null),
    (select ur.user_id from public.user_roles ur where ur.role = 'owner' order by ur.created_at limit 1)
  );
$$;

-- 5. RPC FUNCTIONS
create or replace function public.ensure_self_customer()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
begin
  if v_user_id is null then return null; end if;
  
  select id into v_customer_id from public.customers where user_id = v_user_id;
  
  if v_customer_id is null then
    insert into public.customers (user_id, full_name, email)
    values (v_user_id, coalesce(auth.jwt()->>'full_name', 'Novo Cliente'), auth.jwt()->>'email')
    returning id into v_customer_id;
  end if;
  
  return v_customer_id;
end;
$$;

create or replace function public.get_available_slots(
  p_barber_id uuid,
  p_date      date,
  p_service_id uuid
) returns setof timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  v_duration integer;
  v_owner uuid;
  v_start time;
  v_end time;
  v_lunch_start time;
  v_lunch_end time;
  v_weekday integer;
  v_step integer := 30;
  v_cursor timestamptz;
  v_limit timestamptz;
  v_slot_end timestamptz;
  v_tz constant text := 'America/Sao_Paulo';
begin
  select duration_minutes into v_duration from public.services where id = p_service_id;
  v_owner := public.barber_owner_id(p_barber_id);
  v_weekday := extract(dow from p_date)::integer;

  select start_time, end_time, lunch_start, lunch_end
  into v_start, v_end, v_lunch_start, v_lunch_end
  from public.business_hours
  where owner_id = v_owner and week_day = v_weekday and active = true limit 1;

  if v_start is null or v_end is null then return; end if;

  v_cursor := ((p_date::text || ' ' || v_start::text || ' ' || v_tz)::timestamptz);
  v_limit  := ((p_date::text || ' ' || v_end::text   || ' ' || v_tz)::timestamptz);

  while v_cursor + make_interval(mins => v_duration) <= v_limit loop
    v_slot_end := v_cursor + make_interval(mins => v_duration);
    
    if v_cursor < (now() + interval '5 minutes') then
      v_cursor := v_cursor + make_interval(mins => v_step);
      continue;
    end if;

    if v_lunch_start is not null and v_lunch_end is not null then
      declare
        v_l_start timestamptz := ((p_date::text||' '||v_lunch_start::text||' '||v_tz)::timestamptz);
        v_l_end   timestamptz := ((p_date::text||' '||v_lunch_end::text  ||' '||v_tz)::timestamptz);
      begin
        if tstzrange(v_cursor, v_slot_end, '[)') && tstzrange(v_l_start, v_l_end, '[)') then
          v_cursor := v_cursor + make_interval(mins => v_step);
          continue;
        end if;
      end;
    end if;

    if not exists (
      select 1 from public.appointments a
      where a.barber_id = p_barber_id
        and a.status not in ('cancelled','no_show')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_cursor, v_slot_end, '[)')
    ) then
      return next v_cursor;
    end if;
    v_cursor := v_cursor + make_interval(mins => v_step);
  end loop;
end;
$$;

create or replace function public.book_appointment(
  p_customer_id uuid,
  p_service_id uuid,
  p_barber_id uuid,
  p_start_at timestamptz,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_duration integer;
  v_end_at timestamptz;
  v_id uuid;
begin
  select duration_minutes into v_duration from public.services where id = p_service_id;
  v_end_at := p_start_at + make_interval(mins => v_duration);
  
  insert into public.appointments (customer_id, service_id, barber_id, starts_at, ends_at, notes)
  values (p_customer_id, p_service_id, p_barber_id, p_start_at, v_end_at, p_notes)
  returning id into v_id;
  
  return v_id;
end;
$$;

-- 6. RLS & GRANTS
alter table public.user_roles enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.business_hours enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;

create policy "Public view services" on public.services for select using (active = true);
create policy "Public view barbers" on public.barbers for select using (active = true);
create policy "Public view business_hours" on public.business_hours for select using (active = true);
create policy "Users can view their own profile" on public.customers for select using (auth.uid() = user_id);
create policy "Users can view their own appointments" on public.appointments for select using (
  exists (select 1 from public.customers c where c.id = appointments.customer_id and c.user_id = auth.uid())
  or public.is_staff(auth.uid())
);

grant usage on schema public to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.barbers to anon, authenticated;
grant select on public.business_hours to anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant execute on function public.get_available_slots(uuid, date, uuid) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.ensure_self_customer() to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.barber_owner_id(uuid) to anon, authenticated;
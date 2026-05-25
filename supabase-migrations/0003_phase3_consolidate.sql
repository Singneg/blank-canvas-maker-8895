-- =====================================================================
-- LÉO MORAES BARBER — FASE 3 CONSOLIDADA (0003_phase3_consolidate.sql)
-- Execução única no SQL Editor do Supabase. 100% idempotente.
--
-- O QUE ESTE SCRIPT FAZ:
--   1. Cria as tabelas que ficaram faltando (barbers, profiles,
--      transactions, loyalty_points, loyalty_transactions, etc.) sem
--      tocar nas tabelas que já existem.
--   2. Garante enums, índices, exclusion constraint anti-overlap.
--   3. Recria funções utilitárias (has_role, is_staff, ensure_self_customer,
--      get_available_slots, book_appointment, recompute_*).
--   4. Reaplica RLS — em especial customers permitindo inserção/edição
--      por owner / master_admin / barber (Fase 3).
--   5. GRANTs corretos para anon e authenticated.
--   6. Garante owner Leonardo + barbeiro Leonardo + horário Ter–Sáb 09–20.
--   7. Cria views dashboard_admin_today e dashboard_admin_month.
--
-- Pode rodar quantas vezes precisar.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =====================================================================
-- ENUMS (idempotentes)
-- =====================================================================
do $$ begin
  create type public.app_role as enum ('master_admin', 'owner', 'barber', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum (
    'scheduled','confirmed','in_progress','completed','no_show','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending','paid','refunded','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','pix','credit_card','debit_card','transfer','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_tx_type as enum ('earn','redeem','adjust','expire');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- TABELAS (todas com `if not exists` — não destrói nada existente)
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  bio text,
  avatar_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_barbers_active_order on public.barbers(active, display_order);
create unique index if not exists uq_barbers_user_id_not_null on public.barbers(user_id) where user_id is not null;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_service_categories_name_ci on public.service_categories ((lower(name)));

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_services_active on public.services(active);
create unique index if not exists uq_services_name_ci on public.services ((lower(name)));

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (barber_id, weekday),
  check (closes_at > opens_at)
);

create table if not exists public.barber_time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits integer not null default 0,
  total_spent_cents bigint not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_user_id on public.customers(user_id);
create index if not exists idx_customers_phone on public.customers(phone);
create unique index if not exists uq_customers_user_id_not_null on public.customers(user_id) where user_id is not null;

-- Para o caso da tabela ter sido criada antes sem essas colunas: adiciona se faltarem.
alter table public.customers add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.customers add column if not exists tags text[] not null default '{}';
alter table public.customers add column if not exists total_visits integer not null default 0;
alter table public.customers add column if not exists total_spent_cents bigint not null default 0;
alter table public.customers add column if not exists first_visit_at timestamptz;
alter table public.customers add column if not exists last_visit_at timestamptz;

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- appointments: garante coluna barber_id e FK para barbers
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  barber_id uuid references public.barbers(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  price_cents integer not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Caso a tabela appointments já exista sem barber_id, adiciona a coluna + FK.
alter table public.appointments add column if not exists barber_id uuid;
do $$ begin
  alter table public.appointments
    add constraint appointments_barber_id_fkey
    foreign key (barber_id) references public.barbers(id) on delete restrict;
exception when duplicate_object then null; when invalid_foreign_key then null; end $$;

create index if not exists idx_appointments_barber_starts_at on public.appointments(barber_id, starts_at);
create index if not exists idx_appointments_customer_id on public.appointments(customer_id);
create index if not exists idx_appointments_starts_at on public.appointments(starts_at);
create index if not exists idx_appointments_status on public.appointments(status);

do $$ begin
  alter table public.appointments
    add constraint appointments_no_overlap
    exclude using gist (
      barber_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (status <> 'cancelled' and status <> 'no_show');
exception when duplicate_object then null; end $$;

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  from_status public.appointment_status,
  to_status public.appointment_status,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  method public.payment_method not null,
  status public.payment_status not null default 'paid',
  description text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_occurred_at on public.transactions(occurred_at desc);
create index if not exists idx_transactions_customer_id on public.transactions(customer_id);
create index if not exists idx_transactions_status on public.transactions(status);

create table if not exists public.loyalty_points (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  type public.loyalty_tx_type not null,
  points integer not null,
  note text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- FUNÇÕES UTILITÁRIAS
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('master_admin','owner','barber')
  );
$$;

create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select c.id from public.customers c where c.user_id = auth.uid()
  order by c.created_at asc limit 1;
$$;

create or replace function public.ensure_loyalty_wallet(_customer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _customer_id is null then return; end if;
  insert into public.loyalty_points (customer_id) values (_customer_id)
  on conflict (customer_id) do nothing;
end $$;

create or replace function public.recompute_customer_metrics(_customer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_first timestamptz; v_last timestamptz; v_count integer;
begin
  if _customer_id is null then return; end if;
  select min(starts_at), max(starts_at), count(*)
    into v_first, v_last, v_count
  from public.appointments
  where customer_id = _customer_id and status = 'completed';

  update public.customers
  set first_visit_at = v_first,
      last_visit_at = v_last,
      total_visits = coalesce(v_count, 0),
      updated_at = now()
  where id = _customer_id;
end $$;

create or replace function public.recompute_customer_spend(_customer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_spent bigint;
begin
  if _customer_id is null then return; end if;
  select coalesce(sum(amount_cents), 0) into v_spent
  from public.transactions
  where customer_id = _customer_id and status = 'paid';

  update public.customers
  set total_spent_cents = v_spent, updated_at = now()
  where id = _customer_id;
end $$;

create or replace function public.ensure_self_customer()
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_customer_id uuid; v_name text; v_email text; v_phone text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;

  select c.id into v_customer_id from public.customers c
   where c.user_id = auth.uid() limit 1;
  if v_customer_id is not null then
    perform public.ensure_loyalty_wallet(v_customer_id);
    return v_customer_id;
  end if;

  select coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', split_part(u.email,'@',1)),
         u.email,
         coalesce(p.phone, nullif(u.raw_user_meta_data ->> 'phone',''))
    into v_name, v_email, v_phone
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();

  insert into public.customers (user_id, full_name, email, phone)
  values (auth.uid(), coalesce(v_name,'Cliente'), v_email, v_phone)
  returning id into v_customer_id;

  insert into public.user_roles (user_id, role) values (auth.uid(),'customer')
    on conflict (user_id, role) do nothing;
  perform public.ensure_loyalty_wallet(v_customer_id);
  return v_customer_id;
end $$;

create or replace function public.handle_leonardo_owner_access()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_barber_id uuid; v_email text;
begin
  v_email := lower(coalesce(new.email,''));
  if v_email = 'leonardomoraes712@gmail.com' then
    insert into public.user_roles (user_id, role) values
      (new.id,'master_admin'),(new.id,'owner'),(new.id,'barber')
      on conflict (user_id, role) do nothing;

    select b.id into v_barber_id from public.barbers b
     where lower(b.name)='leonardo moraes' order by b.created_at asc limit 1;

    if v_barber_id is null then
      insert into public.barbers (user_id, name, bio, active, display_order)
      values (new.id,'Leonardo Moraes','Barbeiro proprietário.',true,1)
      returning id into v_barber_id;
    else
      update public.barbers set user_id = new.id, active = true,
        display_order = 1, updated_at = now() where id = v_barber_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_handle_leonardo_owner_access on auth.users;
create trigger trg_handle_leonardo_owner_access
after insert or update on auth.users
for each row execute function public.handle_leonardo_owner_access();

-- =====================================================================
-- RPC: get_available_slots / book_appointment
-- =====================================================================

create or replace function public.get_available_slots(
  _barber_id uuid, _service_id uuid, _date date, _slot_minutes integer default 15
) returns table (slot timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_duration integer; v_open time; v_close time;
  v_cursor timestamptz; v_end timestamptz; v_weekday integer;
  v_tz constant text := 'America/Sao_Paulo';
begin
  if _barber_id is null or _service_id is null or _date is null then return; end if;
  if _slot_minutes is null or _slot_minutes <= 0 then _slot_minutes := 15; end if;

  select duration_minutes into v_duration from public.services
   where id = _service_id and active = true;
  if v_duration is null then return; end if;

  v_weekday := extract(dow from _date)::integer;
  select opens_at, closes_at into v_open, v_close from public.business_hours
   where barber_id = _barber_id and weekday = v_weekday and active = true limit 1;
  if v_open is null then return; end if;

  v_cursor := ((_date::text||' '||v_open::text||' '||v_tz)::timestamptz);
  v_end := ((_date::text||' '||v_close::text||' '||v_tz)::timestamptz);

  while v_cursor + make_interval(mins => v_duration) <= v_end loop
    if v_cursor > now()
      and not exists (
        select 1 from public.barber_time_off bto
         where bto.barber_id = _barber_id
           and tstzrange(bto.starts_at,bto.ends_at,'[)')
            && tstzrange(v_cursor, v_cursor + make_interval(mins=>v_duration),'[)')
      )
      and not exists (
        select 1 from public.appointments a
         where a.barber_id = _barber_id
           and a.status not in ('cancelled','no_show')
           and tstzrange(a.starts_at,a.ends_at,'[)')
            && tstzrange(v_cursor, v_cursor + make_interval(mins=>v_duration),'[)')
      )
    then slot := v_cursor; return next;
    end if;
    v_cursor := v_cursor + make_interval(mins => _slot_minutes);
  end loop;
end $$;

create or replace function public.book_appointment(
  _barber_id uuid, _service_id uuid, _starts_at timestamptz, _notes text default null
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_customer_id uuid; v_service public.services%rowtype; v_appt uuid;
  v_ends timestamptz; v_open time; v_close time; v_weekday integer;
  v_tz constant text := 'America/Sao_Paulo';
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if _barber_id is null or _service_id is null or _starts_at is null then
    raise exception 'Parâmetros obrigatórios ausentes';
  end if;

  select * into v_service from public.services where id = _service_id and active = true;
  if v_service.id is null then raise exception 'Serviço não encontrado ou inativo'; end if;

  v_customer_id := public.ensure_self_customer();
  v_ends := _starts_at + make_interval(mins => v_service.duration_minutes);
  v_weekday := extract(dow from (_starts_at at time zone v_tz))::integer;

  select opens_at, closes_at into v_open, v_close from public.business_hours
   where barber_id = _barber_id and weekday = v_weekday and active = true limit 1;
  if v_open is null then raise exception 'Barbeiro indisponível nesta data'; end if;

  if ((_starts_at at time zone v_tz)::time < v_open)
     or ((v_ends at time zone v_tz)::time > v_close) then
    raise exception 'Horário fora do expediente';
  end if;

  insert into public.appointments
    (customer_id, barber_id, service_id, starts_at, ends_at, status, price_cents, notes, created_by)
  values
    (v_customer_id, _barber_id, _service_id, _starts_at, v_ends, 'scheduled',
     v_service.price_cents, _notes, auth.uid())
  returning id into v_appt;
  return v_appt;
exception when exclusion_violation then
  raise exception 'appointments_no_overlap';
end $$;

-- =====================================================================
-- RLS — habilita em todas as tabelas
-- =====================================================================
alter table public.profiles               enable row level security;
alter table public.user_roles             enable row level security;
alter table public.barbers                enable row level security;
alter table public.service_categories     enable row level security;
alter table public.services               enable row level security;
alter table public.business_hours         enable row level security;
alter table public.barber_time_off        enable row level security;
alter table public.customers              enable row level security;
alter table public.customer_notes         enable row level security;
alter table public.appointments           enable row level security;
alter table public.appointment_history    enable row level security;
alter table public.transactions           enable row level security;
alter table public.loyalty_points         enable row level security;
alter table public.loyalty_transactions   enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists profiles_insert_own_or_staff on public.profiles;
create policy profiles_insert_own_or_staff on public.profiles
  for insert to authenticated with check (id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists profiles_update_own_or_staff on public.profiles;
create policy profiles_update_own_or_staff on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_staff(auth.uid()))
  with check (id = auth.uid() or public.is_staff(auth.uid()));

-- ---------- user_roles ----------
drop policy if exists user_roles_select_own_or_staff on public.user_roles;
create policy user_roles_select_own_or_staff on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists user_roles_manage_admin_only on public.user_roles;
create policy user_roles_manage_admin_only on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(),'master_admin') or public.has_role(auth.uid(),'owner'))
  with check (public.has_role(auth.uid(),'master_admin') or public.has_role(auth.uid(),'owner'));

-- ---------- barbers ----------
drop policy if exists barbers_public_read on public.barbers;
create policy barbers_public_read on public.barbers
  for select to anon, authenticated using (true);

drop policy if exists barbers_staff_write on public.barbers;
create policy barbers_staff_write on public.barbers
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- service_categories ----------
drop policy if exists service_categories_public_read on public.service_categories;
create policy service_categories_public_read on public.service_categories
  for select to anon, authenticated using (true);
drop policy if exists service_categories_staff_write on public.service_categories;
create policy service_categories_staff_write on public.service_categories
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- services ----------
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon, authenticated using (true);
drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- business_hours ----------
drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours
  for select to anon, authenticated using (true);
drop policy if exists business_hours_staff_write on public.business_hours;
create policy business_hours_staff_write on public.business_hours
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- barber_time_off ----------
drop policy if exists barber_time_off_staff_manage on public.barber_time_off;
create policy barber_time_off_staff_manage on public.barber_time_off
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- customers (Fase 3 — corrige insert) ----------
drop policy if exists customers_select_own_or_staff on public.customers;
create policy customers_select_own_or_staff on public.customers
  for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists customers_insert_own_or_staff on public.customers;
create policy customers_insert_own_or_staff on public.customers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or user_id is null
    or public.is_staff(auth.uid())
  );

drop policy if exists customers_update_own_or_staff on public.customers;
create policy customers_update_own_or_staff on public.customers
  for update to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists customers_delete_staff on public.customers;
create policy customers_delete_staff on public.customers
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ---------- customer_notes ----------
drop policy if exists customer_notes_staff_manage on public.customer_notes;
create policy customer_notes_staff_manage on public.customer_notes
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- appointments ----------
drop policy if exists appointments_select_own_or_staff on public.appointments;
create policy appointments_select_own_or_staff on public.appointments
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.customers c where c.id = appointments.customer_id and c.user_id = auth.uid())
  );

drop policy if exists appointments_staff_insert on public.appointments;
create policy appointments_staff_insert on public.appointments
  for insert to authenticated with check (public.is_staff(auth.uid()));

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists appointments_staff_delete on public.appointments;
create policy appointments_staff_delete on public.appointments
  for delete to authenticated using (public.is_staff(auth.uid()));

drop policy if exists appointments_customer_cancel on public.appointments;
create policy appointments_customer_cancel on public.appointments
  for update to authenticated
  using (exists (select 1 from public.customers c where c.id = appointments.customer_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.customers c where c.id = appointments.customer_id and c.user_id = auth.uid()));

-- ---------- appointment_history ----------
drop policy if exists appointment_history_staff_manage on public.appointment_history;
create policy appointment_history_staff_manage on public.appointment_history
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- transactions ----------
drop policy if exists transactions_select_own_or_staff on public.transactions;
create policy transactions_select_own_or_staff on public.transactions
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.customers c where c.id = transactions.customer_id and c.user_id = auth.uid())
  );
drop policy if exists transactions_staff_write on public.transactions;
create policy transactions_staff_write on public.transactions
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- loyalty_points ----------
drop policy if exists loyalty_points_select_own_or_staff on public.loyalty_points;
create policy loyalty_points_select_own_or_staff on public.loyalty_points
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.customers c where c.id = loyalty_points.customer_id and c.user_id = auth.uid())
  );
drop policy if exists loyalty_points_staff_write on public.loyalty_points;
create policy loyalty_points_staff_write on public.loyalty_points
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ---------- loyalty_transactions ----------
drop policy if exists loyalty_transactions_staff_manage on public.loyalty_transactions;
create policy loyalty_transactions_staff_manage on public.loyalty_transactions
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- =====================================================================
-- GRANTS
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on public.barbers, public.service_categories, public.services, public.business_hours to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.has_role(uuid, public.app_role)              to authenticated;
grant execute on function public.is_staff(uuid)                               to authenticated;
grant execute on function public.current_customer_id()                        to authenticated;
grant execute on function public.ensure_self_customer()                       to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, integer) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- =====================================================================
-- SEEDS — categorias e serviços
-- =====================================================================
insert into public.service_categories (name, display_order)
select v.name, v.ord
from (values ('Cortes',1),('Barba',2),('Sobrancelha',3),('Combos',4)) as v(name, ord)
where not exists (select 1 from public.service_categories sc where lower(sc.name)=lower(v.name));

do $$
declare v_cortes uuid; v_barba uuid; v_sobr uuid; v_combo uuid;
begin
  select id into v_cortes from public.service_categories where lower(name)='cortes' limit 1;
  select id into v_barba  from public.service_categories where lower(name)='barba'  limit 1;
  select id into v_sobr   from public.service_categories where lower(name)='sobrancelha' limit 1;
  select id into v_combo  from public.service_categories where lower(name)='combos' limit 1;

  insert into public.services (category_id,name,description,duration_minutes,price_cents,active)
  select v_cortes,'Corte','Corte masculino com acabamento premium.',45,5000,true
  where not exists (select 1 from public.services where lower(name)='corte');

  insert into public.services (category_id,name,description,duration_minutes,price_cents,active)
  select v_barba,'Barba','Barba completa com desenho e acabamento.',30,5000,true
  where not exists (select 1 from public.services where lower(name)='barba');

  insert into public.services (category_id,name,description,duration_minutes,price_cents,active)
  select v_sobr,'Sobrancelha','Alinhamento e desenho de sobrancelha.',20,3000,true
  where not exists (select 1 from public.services where lower(name)='sobrancelha');

  insert into public.services (category_id,name,description,duration_minutes,price_cents,active)
  select v_combo,'Combo','Sessão completa com corte e barba.',75,8000,true
  where not exists (select 1 from public.services where lower(name)='combo');
end $$;

-- =====================================================================
-- SEED — Owner Leonardo + barbeiro + business_hours (Ter–Sáb 09–20)
-- =====================================================================
do $$
declare v_user uuid; v_barber uuid;
begin
  select id into v_user from auth.users where lower(email)='leonardomoraes712@gmail.com' limit 1;

  if v_user is not null then
    insert into public.profiles (id, full_name, email)
      values (v_user, 'Leonardo Moraes', 'leonardomoraes712@gmail.com')
      on conflict (id) do update set
        email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

    insert into public.user_roles (user_id, role) values
      (v_user,'master_admin'),(v_user,'owner'),(v_user,'barber')
      on conflict (user_id, role) do nothing;
  end if;

  select id into v_barber from public.barbers where lower(name)='leonardo moraes' limit 1;
  if v_barber is null then
    insert into public.barbers (user_id, name, bio, active, display_order)
    values (v_user, 'Leonardo Moraes', 'Barbeiro proprietário.', true, 1)
    returning id into v_barber;
  else
    update public.barbers
      set user_id = coalesce(v_user, user_id), active = true,
          display_order = 1, updated_at = now()
      where id = v_barber;
  end if;

  if v_barber is not null then
    insert into public.business_hours (barber_id, weekday, opens_at, closes_at, active)
    values
      (v_barber, 2, '09:00', '20:00', true),
      (v_barber, 3, '09:00', '20:00', true),
      (v_barber, 4, '09:00', '20:00', true),
      (v_barber, 5, '09:00', '20:00', true),
      (v_barber, 6, '09:00', '20:00', true)
    on conflict (barber_id, weekday) do update set
      opens_at = excluded.opens_at,
      closes_at = excluded.closes_at,
      active = excluded.active;
  end if;
end $$;

-- =====================================================================
-- VIEWS DE DASHBOARD
-- =====================================================================
create or replace view public.dashboard_admin_today as
select
  current_date as reference_date,
  count(*) filter (where a.starts_at::date = current_date) as appointments_today,
  count(*) filter (where a.starts_at::date = current_date and a.status='completed') as completed_today,
  count(*) filter (where a.starts_at::date = current_date and a.status='no_show')   as no_show_today,
  count(*) filter (where a.starts_at::date = current_date and a.status in ('scheduled','confirmed','in_progress')) as open_today
from public.appointments a;

create or replace view public.dashboard_admin_month as
select
  date_trunc('month', now())::date as reference_month,
  coalesce(sum(t.amount_cents) filter (where t.status='paid' and date_trunc('month', t.occurred_at)=date_trunc('month', now())),0) as revenue_month_cents,
  (select count(*) from public.customers) as total_customers,
  (select count(*) from public.appointments where starts_at >= date_trunc('month', now())) as appointments_month,
  (select count(*) from public.appointments where starts_at >= now()) as future_appointments
from public.transactions t;

grant select on public.dashboard_admin_today, public.dashboard_admin_month to authenticated;

-- =====================================================================
-- FIM
-- =====================================================================

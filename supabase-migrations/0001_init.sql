-- =====================================================================
-- LÉO MORAES BARBER — MIGRAÇÃO ÚNICA INICIAL (0001_init.sql)
-- Execução única no SQL Editor do Supabase/Postgres
-- Arquivo completo, íntegro, idempotente e validado estruturalmente
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =====================================================================
-- ENUMS
-- =====================================================================

do $$
begin
  create type public.app_role as enum ('master_admin', 'owner', 'barber', 'customer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.appointment_status as enum (
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'no_show',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'refunded', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_method as enum ('cash', 'pix', 'credit_card', 'debit_card', 'transfer', 'other');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.loyalty_tx_type as enum ('earn', 'redeem', 'adjust', 'expire');
exception
  when duplicate_object then null;
end
$$;

-- =====================================================================
-- TABELAS BASE
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
create index if not exists idx_barbers_user_id on public.barbers(user_id);
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
create index if not exists idx_services_category_id on public.services(category_id);
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
create index if not exists idx_business_hours_barber_weekday on public.business_hours(barber_id, weekday);

create table if not exists public.barber_time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_barber_time_off_barber_range on public.barber_time_off(barber_id, starts_at, ends_at);

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
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_customers_last_visit_at on public.customers(last_visit_at desc);
create unique index if not exists uq_customers_user_id_not_null on public.customers(user_id) where user_id is not null;

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_notes_customer_id on public.customer_notes(customer_id);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  barber_id uuid not null references public.barbers(id) on delete restrict,
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
create index if not exists idx_appointments_barber_starts_at on public.appointments(barber_id, starts_at);
create index if not exists idx_appointments_customer_id on public.appointments(customer_id);
create index if not exists idx_appointments_service_id on public.appointments(service_id);
create index if not exists idx_appointments_status on public.appointments(status);
create index if not exists idx_appointments_starts_at on public.appointments(starts_at);

do $$
begin
  alter table public.appointments
    add constraint appointments_no_overlap
    exclude using gist (
      barber_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (status <> 'cancelled' and status <> 'no_show');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  from_status public.appointment_status,
  to_status public.appointment_status,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_appointment_history_appointment_id on public.appointment_history(appointment_id);

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
create index if not exists idx_transactions_appointment_id on public.transactions(appointment_id);
create index if not exists idx_transactions_status on public.transactions(status);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  provider text not null default 'manual',
  provider_intent_id text,
  status public.payment_status not null default 'pending',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_payment_intents_provider_ref on public.payment_intents(provider, provider_intent_id) where provider_intent_id is not null;

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
create index if not exists idx_loyalty_transactions_customer_id on public.loyalty_transactions(customer_id);
create unique index if not exists uq_loyalty_transactions_transaction_earn on public.loyalty_transactions(transaction_id) where transaction_id is not null and type = 'earn';

-- =====================================================================
-- FUNÇÕES UTILITÁRIAS E TRIGGERS BÁSICOS
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_barbers_updated_at on public.barbers;
create trigger trg_barbers_updated_at
before update on public.barbers
for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_intents_updated_at on public.payment_intents;
create trigger trg_payment_intents_updated_at
before update on public.payment_intents
for each row execute function public.set_updated_at();

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  return new;
end
$$;

drop trigger if exists trg_sync_profile_from_auth_user on auth.users;
create trigger trg_sync_profile_from_auth_user
after insert or update on auth.users
for each row execute function public.sync_profile_from_auth_user();

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('master_admin', 'owner', 'barber')
  );
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.user_id = auth.uid()
  order by c.created_at asc
  limit 1;
$$;

create or replace function public.ensure_loyalty_wallet(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _customer_id is null then
    return;
  end if;

  insert into public.loyalty_points (customer_id)
  values (_customer_id)
  on conflict (customer_id) do nothing;
end
$$;

create or replace function public.recompute_customer_metrics(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_visit timestamptz;
  v_last_visit timestamptz;
  v_total_visits integer;
begin
  if _customer_id is null then
    return;
  end if;

  select
    min(a.starts_at),
    max(a.starts_at),
    count(*)::integer
  into v_first_visit, v_last_visit, v_total_visits
  from public.appointments a
  where a.customer_id = _customer_id
    and a.status = 'completed';

  update public.customers
  set
    first_visit_at = v_first_visit,
    last_visit_at = v_last_visit,
    total_visits = coalesce(v_total_visits, 0),
    updated_at = now()
  where id = _customer_id;
end
$$;

create or replace function public.recompute_customer_spend(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
begin
  if _customer_id is null then
    return;
  end if;

  select coalesce(sum(t.amount_cents), 0)
  into v_total
  from public.transactions t
  where t.customer_id = _customer_id
    and t.status = 'paid';

  update public.customers
  set
    total_spent_cents = v_total,
    updated_at = now()
  where id = _customer_id;
end
$$;

create or replace function public.recompute_loyalty_balance(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_earned integer;
begin
  if _customer_id is null then
    return;
  end if;

  perform public.ensure_loyalty_wallet(_customer_id);

  select
    coalesce(sum(case when lt.type in ('earn', 'adjust') then lt.points when lt.type in ('redeem', 'expire') then -lt.points else 0 end), 0),
    coalesce(sum(case when lt.type = 'earn' then lt.points else 0 end), 0)
  into v_balance, v_earned
  from public.loyalty_transactions lt
  where lt.customer_id = _customer_id;

  update public.loyalty_points
  set
    balance = greatest(v_balance, 0),
    lifetime_earned = greatest(v_earned, 0),
    updated_at = now()
  where customer_id = _customer_id;
end
$$;

create or replace function public.sync_appointment_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_history (appointment_id, changed_by, from_status, to_status, reason)
    values (new.id, auth.uid(), null, new.status, 'created');
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.appointment_history (appointment_id, changed_by, from_status, to_status, reason)
    values (new.id, auth.uid(), old.status, new.status, 'status_change');
  end if;

  return new;
end
$$;

drop trigger if exists trg_sync_appointment_history on public.appointments;
create trigger trg_sync_appointment_history
after insert or update on public.appointments
for each row execute function public.sync_appointment_history();

create or replace function public.sync_customer_metrics_from_appointments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_customer_metrics(old.customer_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform public.recompute_customer_metrics(old.customer_id);
  end if;

  perform public.recompute_customer_metrics(new.customer_id);
  return new;
end
$$;

drop trigger if exists trg_sync_customer_metrics_from_appointments on public.appointments;
create trigger trg_sync_customer_metrics_from_appointments
after insert or update or delete on public.appointments
for each row execute function public.sync_customer_metrics_from_appointments();

create or replace function public.sync_customer_spend_from_transactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_customer_spend(old.customer_id);
    perform public.recompute_loyalty_balance(old.customer_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform public.recompute_customer_spend(old.customer_id);
    perform public.recompute_loyalty_balance(old.customer_id);
  end if;

  perform public.recompute_customer_spend(new.customer_id);
  return new;
end
$$;

drop trigger if exists trg_sync_customer_spend_from_transactions on public.transactions;
create trigger trg_sync_customer_spend_from_transactions
after insert or update or delete on public.transactions
for each row execute function public.sync_customer_spend_from_transactions();

create or replace function public.sync_loyalty_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_points integer;
begin
  if tg_op = 'DELETE' then
    delete from public.loyalty_transactions
    where transaction_id = old.id
      and type = 'earn';

    perform public.recompute_loyalty_balance(old.customer_id);
    return old;
  end if;

  v_customer_id := coalesce(new.customer_id, (
    select a.customer_id
    from public.appointments a
    where a.id = new.appointment_id
    limit 1
  ));

  if v_customer_id is null then
    return new;
  end if;

  if new.status = 'paid' then
    v_points := greatest(floor(new.amount_cents / 100.0)::integer, 1);

    insert into public.loyalty_transactions (
      customer_id,
      appointment_id,
      transaction_id,
      type,
      points,
      note
    )
    values (
      v_customer_id,
      new.appointment_id,
      new.id,
      'earn',
      v_points,
      'Pontos por pagamento confirmado'
    )
    on conflict (transaction_id) where type = 'earn'
    do update set
      customer_id = excluded.customer_id,
      appointment_id = excluded.appointment_id,
      points = excluded.points,
      note = excluded.note;
  else
    delete from public.loyalty_transactions
    where transaction_id = new.id
      and type = 'earn';
  end if;

  perform public.recompute_loyalty_balance(v_customer_id);
  return new;
end
$$;

drop trigger if exists trg_sync_loyalty_from_transaction on public.transactions;
create trigger trg_sync_loyalty_from_transaction
after insert or update or delete on public.transactions
for each row execute function public.sync_loyalty_from_transaction();

create or replace function public.fill_customer_note_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id is null then
    new.author_id = auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists trg_fill_customer_note_author on public.customer_notes;
create trigger trg_fill_customer_note_author
before insert on public.customer_notes
for each row execute function public.fill_customer_note_author();

create or replace function public.fill_created_by_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'appointments' and new.created_by is null then
    new.created_by = auth.uid();
  elsif tg_table_name = 'transactions' and new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists trg_fill_appointments_created_by on public.appointments;
create trigger trg_fill_appointments_created_by
before insert on public.appointments
for each row execute function public.fill_created_by_fields();

drop trigger if exists trg_fill_transactions_created_by on public.transactions;
create trigger trg_fill_transactions_created_by
before insert on public.transactions
for each row execute function public.fill_created_by_fields();

create or replace function public.ensure_self_customer()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_customer_id uuid;
  v_name text;
  v_email text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.user_id = auth.uid()
  limit 1;

  if v_customer_id is not null then
    perform public.ensure_loyalty_wallet(v_customer_id);
    return v_customer_id;
  end if;

  select
    coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
    u.email,
    coalesce(p.phone, nullif(u.raw_user_meta_data ->> 'phone', ''))
  into v_name, v_email, v_phone
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();

  insert into public.customers (user_id, full_name, email, phone)
  values (auth.uid(), coalesce(v_name, 'Cliente'), v_email, v_phone)
  returning id into v_customer_id;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'customer')
  on conflict (user_id, role) do nothing;

  perform public.ensure_loyalty_wallet(v_customer_id);

  return v_customer_id;
end
$$;

create or replace function public.handle_leonardo_owner_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_barber_id uuid;
  v_email text;
begin
  v_email := lower(coalesce(new.email, ''));

  if v_email = 'leonardomoraes712@gmail.com' then
    insert into public.user_roles (user_id, role)
    values
      (new.id, 'master_admin'),
      (new.id, 'owner'),
      (new.id, 'barber')
    on conflict (user_id, role) do nothing;

    select b.id into v_barber_id
    from public.barbers b
    where lower(b.name) = 'leonardo moraes'
    order by b.created_at asc
    limit 1;

    if v_barber_id is null then
      insert into public.barbers (user_id, name, bio, active, display_order)
      values (
        new.id,
        'Leonardo Moraes',
        'Barbeiro proprietário.',
        true,
        1
      )
      returning id into v_barber_id;
    else
      update public.barbers
      set
        user_id = new.id,
        active = true,
        display_order = 1,
        updated_at = now()
      where id = v_barber_id;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_handle_leonardo_owner_access on auth.users;
create trigger trg_handle_leonardo_owner_access
after insert or update on auth.users
for each row execute function public.handle_leonardo_owner_access();

-- =====================================================================
-- RPCS OPERACIONAIS
-- =====================================================================

create or replace function public.get_available_slots(
  _barber_id uuid,
  _service_id uuid,
  _date date,
  _slot_minutes integer default 15
)
returns table (slot timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration_minutes integer;
  v_opens_at time;
  v_closes_at time;
  v_cursor timestamptz;
  v_end_limit timestamptz;
  v_weekday integer;
  v_timezone constant text := 'America/Sao_Paulo';
begin
  if _barber_id is null then
    raise exception 'Barbeiro é obrigatório';
  end if;

  if _service_id is null then
    raise exception 'Serviço é obrigatório';
  end if;

  if _date is null then
    raise exception 'Data é obrigatória';
  end if;

  if _slot_minutes is null or _slot_minutes <= 0 then
    _slot_minutes := 15;
  end if;

  select s.duration_minutes
  into v_duration_minutes
  from public.services s
  where s.id = _service_id
    and s.active = true;

  if v_duration_minutes is null then
    raise exception 'Serviço não encontrado ou inativo';
  end if;

  v_weekday := extract(dow from _date)::integer;

  select bh.opens_at, bh.closes_at
  into v_opens_at, v_closes_at
  from public.business_hours bh
  where bh.barber_id = _barber_id
    and bh.weekday = v_weekday
    and bh.active = true
  limit 1;

  if v_opens_at is null or v_closes_at is null then
    return;
  end if;

  v_cursor := ((_date::text || ' ' || v_opens_at::text || ' ' || v_timezone)::timestamptz);
  v_end_limit := ((_date::text || ' ' || v_closes_at::text || ' ' || v_timezone)::timestamptz);

  while v_cursor + make_interval(mins => v_duration_minutes) <= v_end_limit loop
    if v_cursor > now()
      and not exists (
        select 1
        from public.barber_time_off bto
        where bto.barber_id = _barber_id
          and tstzrange(bto.starts_at, bto.ends_at, '[)') && tstzrange(v_cursor, v_cursor + make_interval(mins => v_duration_minutes), '[)')
      )
      and not exists (
        select 1
        from public.appointments a
        where a.barber_id = _barber_id
          and a.status not in ('cancelled', 'no_show')
          and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_cursor, v_cursor + make_interval(mins => v_duration_minutes), '[)')
      ) then
      slot := v_cursor;
      return next;
    end if;

    v_cursor := v_cursor + make_interval(mins => _slot_minutes);
  end loop;
end
$$;

create or replace function public.book_appointment(
  _barber_id uuid,
  _service_id uuid,
  _starts_at timestamptz,
  _notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_customer_id uuid;
  v_service public.services%rowtype;
  v_business_day date;
  v_business_weekday integer;
  v_open time;
  v_close time;
  v_appointment_id uuid;
  v_ends_at timestamptz;
  v_timezone constant text := 'America/Sao_Paulo';
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if _barber_id is null or _service_id is null or _starts_at is null then
    raise exception 'Parâmetros obrigatórios ausentes';
  end if;

  select *
  into v_service
  from public.services s
  where s.id = _service_id
    and s.active = true;

  if v_service.id is null then
    raise exception 'Serviço não encontrado ou inativo';
  end if;

  v_customer_id := public.ensure_self_customer();
  v_ends_at := _starts_at + make_interval(mins => v_service.duration_minutes);
  v_business_day := (_starts_at at time zone v_timezone)::date;
  v_business_weekday := extract(dow from (_starts_at at time zone v_timezone))::integer;

  select bh.opens_at, bh.closes_at
  into v_open, v_close
  from public.business_hours bh
  where bh.barber_id = _barber_id
    and bh.weekday = v_business_weekday
    and bh.active = true
  limit 1;

  if v_open is null or v_close is null then
    raise exception 'Barbeiro indisponível nesta data';
  end if;

  if ((_starts_at at time zone v_timezone)::time < v_open)
     or ((v_ends_at at time zone v_timezone)::time > v_close) then
    raise exception 'Horário fora do expediente';
  end if;

  if exists (
    select 1
    from public.barber_time_off bto
    where bto.barber_id = _barber_id
      and tstzrange(bto.starts_at, bto.ends_at, '[)') && tstzrange(_starts_at, v_ends_at, '[)')
  ) then
    raise exception 'Barbeiro indisponível neste horário';
  end if;

  insert into public.appointments (
    customer_id,
    barber_id,
    service_id,
    starts_at,
    ends_at,
    status,
    price_cents,
    notes,
    created_by
  )
  values (
    v_customer_id,
    _barber_id,
    _service_id,
    _starts_at,
    v_ends_at,
    'scheduled',
    v_service.price_cents,
    _notes,
    auth.uid()
  )
  returning id into v_appointment_id;

  return v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'appointments_no_overlap';
end
$$;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.barbers enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.barber_time_off enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_intents enable row level security;
alter table public.loyalty_points enable row level security;
alter table public.loyalty_transactions enable row level security;

-- profiles

drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists profiles_insert_own_or_staff on public.profiles;
create policy profiles_insert_own_or_staff on public.profiles
for insert to authenticated
with check (id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists profiles_update_own_or_staff on public.profiles;
create policy profiles_update_own_or_staff on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_staff(auth.uid()))
with check (id = auth.uid() or public.is_staff(auth.uid()));

-- user_roles

drop policy if exists user_roles_select_own_or_staff on public.user_roles;
create policy user_roles_select_own_or_staff on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'master_admin') or public.has_role(auth.uid(), 'owner'));

drop policy if exists user_roles_manage_admin_only on public.user_roles;
create policy user_roles_manage_admin_only on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(), 'master_admin') or public.has_role(auth.uid(), 'owner'))
with check (public.has_role(auth.uid(), 'master_admin') or public.has_role(auth.uid(), 'owner'));

-- barbers

drop policy if exists barbers_public_read on public.barbers;
create policy barbers_public_read on public.barbers
for select to anon, authenticated
using (active = true or public.is_staff(auth.uid()));

drop policy if exists barbers_staff_write on public.barbers;
create policy barbers_staff_write on public.barbers
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- service_categories

drop policy if exists service_categories_public_read on public.service_categories;
create policy service_categories_public_read on public.service_categories
for select to anon, authenticated
using (true);

drop policy if exists service_categories_staff_write on public.service_categories;
create policy service_categories_staff_write on public.service_categories
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- services

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
for select to anon, authenticated
using (active = true or public.is_staff(auth.uid()));

drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- business_hours

drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours
for select to anon, authenticated
using (active = true or public.is_staff(auth.uid()));

drop policy if exists business_hours_staff_write on public.business_hours;
create policy business_hours_staff_write on public.business_hours
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- barber_time_off

drop policy if exists barber_time_off_staff_manage on public.barber_time_off;
create policy barber_time_off_staff_manage on public.barber_time_off
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- customers

drop policy if exists customers_select_own_or_staff on public.customers;
create policy customers_select_own_or_staff on public.customers
for select to authenticated
using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists customers_insert_own_or_staff on public.customers;
create policy customers_insert_own_or_staff on public.customers
for insert to authenticated
with check (user_id = auth.uid() or user_id is null or public.is_staff(auth.uid()));

drop policy if exists customers_update_own_or_staff on public.customers;
create policy customers_update_own_or_staff on public.customers
for update to authenticated
using (user_id = auth.uid() or public.is_staff(auth.uid()))
with check (user_id = auth.uid() or public.is_staff(auth.uid()));

-- customer_notes

drop policy if exists customer_notes_select_own_or_staff on public.customer_notes;
create policy customer_notes_select_own_or_staff on public.customer_notes
for select to authenticated
using (
  public.is_staff(auth.uid())
  or exists (
    select 1 from public.customers c
    where c.id = customer_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists customer_notes_staff_insert on public.customer_notes;
create policy customer_notes_staff_insert on public.customer_notes
for insert to authenticated
with check (public.is_staff(auth.uid()));

drop policy if exists customer_notes_staff_update on public.customer_notes;
create policy customer_notes_staff_update on public.customer_notes
for update to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists customer_notes_staff_delete on public.customer_notes;
create policy customer_notes_staff_delete on public.customer_notes
for delete to authenticated
using (public.is_staff(auth.uid()));

-- appointments

drop policy if exists appointments_select_own_or_staff on public.appointments;
create policy appointments_select_own_or_staff on public.appointments
for select to authenticated
using (
  public.is_staff(auth.uid())
  or customer_id = public.current_customer_id()
);

drop policy if exists appointments_staff_insert on public.appointments;
create policy appointments_staff_insert on public.appointments
for insert to authenticated
with check (public.is_staff(auth.uid()));

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
for update to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists appointments_customer_cancel on public.appointments;
create policy appointments_customer_cancel on public.appointments
for update to authenticated
using (customer_id = public.current_customer_id())
with check (customer_id = public.current_customer_id() and status = 'cancelled');

-- appointment_history

drop policy if exists appointment_history_select_own_or_staff on public.appointment_history;
create policy appointment_history_select_own_or_staff on public.appointment_history
for select to authenticated
using (
  public.is_staff(auth.uid())
  or exists (
    select 1
    from public.appointments a
    where a.id = appointment_id
      and a.customer_id = public.current_customer_id()
  )
);

drop policy if exists appointment_history_staff_write on public.appointment_history;
create policy appointment_history_staff_write on public.appointment_history
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- transactions

drop policy if exists transactions_select_own_or_staff on public.transactions;
create policy transactions_select_own_or_staff on public.transactions
for select to authenticated
using (
  public.is_staff(auth.uid())
  or customer_id = public.current_customer_id()
);

drop policy if exists transactions_staff_write on public.transactions;
create policy transactions_staff_write on public.transactions
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- payment_intents

drop policy if exists payment_intents_select_own_or_staff on public.payment_intents;
create policy payment_intents_select_own_or_staff on public.payment_intents
for select to authenticated
using (
  public.is_staff(auth.uid())
  or customer_id = public.current_customer_id()
);

drop policy if exists payment_intents_staff_write on public.payment_intents;
create policy payment_intents_staff_write on public.payment_intents
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- loyalty_points

drop policy if exists loyalty_points_select_own_or_staff on public.loyalty_points;
create policy loyalty_points_select_own_or_staff on public.loyalty_points
for select to authenticated
using (
  public.is_staff(auth.uid())
  or customer_id = public.current_customer_id()
);

drop policy if exists loyalty_points_staff_write on public.loyalty_points;
create policy loyalty_points_staff_write on public.loyalty_points
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- loyalty_transactions

drop policy if exists loyalty_transactions_select_own_or_staff on public.loyalty_transactions;
create policy loyalty_transactions_select_own_or_staff on public.loyalty_transactions
for select to authenticated
using (
  public.is_staff(auth.uid())
  or customer_id = public.current_customer_id()
);

drop policy if exists loyalty_transactions_staff_write on public.loyalty_transactions;
create policy loyalty_transactions_staff_write on public.loyalty_transactions
for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- =====================================================================
-- GRANTS
-- =====================================================================

grant usage on schema public to anon, authenticated;
grant select on public.barbers, public.service_categories, public.services, public.business_hours to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.ensure_self_customer() to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, integer) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;

-- =====================================================================
-- SEEDS OPERACIONAIS
-- =====================================================================

insert into public.service_categories (name, display_order)
select 'Cortes', 1
where not exists (
  select 1 from public.service_categories where lower(name) = 'cortes'
);

insert into public.service_categories (name, display_order)
select 'Barba', 2
where not exists (
  select 1 from public.service_categories where lower(name) = 'barba'
);

insert into public.service_categories (name, display_order)
select 'Sobrancelha', 3
where not exists (
  select 1 from public.service_categories where lower(name) = 'sobrancelha'
);

insert into public.service_categories (name, display_order)
select 'Combos', 4
where not exists (
  select 1 from public.service_categories where lower(name) = 'combos'
);

do $$
declare
  v_cat_cortes uuid;
  v_cat_barba uuid;
  v_cat_sobrancelha uuid;
  v_cat_combos uuid;
begin
  select id into v_cat_cortes from public.service_categories where lower(name) = 'cortes' limit 1;
  select id into v_cat_barba from public.service_categories where lower(name) = 'barba' limit 1;
  select id into v_cat_sobrancelha from public.service_categories where lower(name) = 'sobrancelha' limit 1;
  select id into v_cat_combos from public.service_categories where lower(name) = 'combos' limit 1;

  insert into public.services (category_id, name, description, duration_minutes, price_cents, active)
  select v_cat_cortes, 'Corte', 'Corte masculino com acabamento premium.', 45, 5000, true
  where not exists (
    select 1 from public.services where lower(name) = 'corte'
  );

  insert into public.services (category_id, name, description, duration_minutes, price_cents, active)
  select v_cat_barba, 'Barba', 'Barba completa com desenho e acabamento.', 30, 5000, true
  where not exists (
    select 1 from public.services where lower(name) = 'barba'
  );

  insert into public.services (category_id, name, description, duration_minutes, price_cents, active)
  select v_cat_sobrancelha, 'Sobrancelha', 'Alinhamento e desenho de sobrancelha.', 15, 3000, true
  where not exists (
    select 1 from public.services where lower(name) = 'sobrancelha'
  );

  insert into public.services (category_id, name, description, duration_minutes, price_cents, active)
  select v_cat_combos, 'Combo (Corte + Barba)', 'Sessão completa com corte e barba.', 60, 9000, true
  where not exists (
    select 1 from public.services where lower(name) = 'combo (corte + barba)'
  );
end
$$;

do $$
declare
  v_user_id uuid;
  v_barber_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = 'leonardomoraes712@gmail.com'
  limit 1;

  if v_user_id is not null then
    insert into public.user_roles (user_id, role)
    values
      (v_user_id, 'master_admin'),
      (v_user_id, 'owner'),
      (v_user_id, 'barber')
    on conflict (user_id, role) do nothing;
  end if;

  select id into v_barber_id
  from public.barbers
  where lower(name) = 'leonardo moraes'
  limit 1;

  if v_barber_id is null then
    insert into public.barbers (user_id, name, bio, active, display_order)
    values (v_user_id, 'Leonardo Moraes', 'Barbeiro proprietário.', true, 1)
    returning id into v_barber_id;
  else
    update public.barbers
    set
      user_id = coalesce(v_user_id, user_id),
      active = true,
      display_order = 1,
      updated_at = now()
    where id = v_barber_id;
  end if;

  if v_barber_id is not null then
    insert into public.business_hours (barber_id, weekday, opens_at, closes_at, active)
    values
      (v_barber_id, 2, '09:00', '20:00', true),
      (v_barber_id, 3, '09:00', '20:00', true),
      (v_barber_id, 4, '09:00', '20:00', true),
      (v_barber_id, 5, '09:00', '20:00', true),
      (v_barber_id, 6, '09:00', '20:00', true)
    on conflict (barber_id, weekday)
    do update set
      opens_at = excluded.opens_at,
      closes_at = excluded.closes_at,
      active = excluded.active;
  end if;
end
$$;

-- =====================================================================
-- BACKFILL DE PERFIS E CARTEIRA DE FIDELIDADE
-- =====================================================================

insert into public.profiles (id, full_name, email, phone)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.email,
  nullif(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

insert into public.loyalty_points (customer_id)
select c.id
from public.customers c
where not exists (
  select 1 from public.loyalty_points lp where lp.customer_id = c.id
);

update public.transactions t
set customer_id = a.customer_id
from public.appointments a
where t.appointment_id = a.id
  and t.customer_id is null
  and a.customer_id is not null;

with customers_to_refresh as (
  select id as customer_id from public.customers
)
select public.recompute_customer_metrics(customer_id) from customers_to_refresh;

with customers_to_refresh as (
  select id as customer_id from public.customers
)
select public.recompute_customer_spend(customer_id) from customers_to_refresh;

with customers_to_refresh as (
  select id as customer_id from public.customers
)
select public.recompute_loyalty_balance(customer_id) from customers_to_refresh;

-- =====================================================================
-- VIEWS OPERACIONAIS DO DASHBOARD ADMIN
-- =====================================================================

create or replace view public.dashboard_admin_today as
select
  current_date as reference_date,
  count(*) filter (where a.starts_at::date = current_date) as appointments_today,
  count(*) filter (where a.starts_at::date = current_date and a.status = 'completed') as completed_today,
  count(*) filter (where a.starts_at::date = current_date and a.status = 'no_show') as no_show_today,
  count(*) filter (where a.starts_at::date = current_date and a.status in ('scheduled', 'confirmed', 'in_progress')) as open_today
from public.appointments a;

create or replace view public.dashboard_admin_month as
select
  date_trunc('month', now())::date as reference_month,
  coalesce(sum(t.amount_cents) filter (where t.status = 'paid' and date_trunc('month', t.occurred_at) = date_trunc('month', now())), 0) as revenue_month_cents,
  (select count(*) from public.customers) as total_customers,
  (select count(*) from public.appointments where starts_at >= date_trunc('month', now())) as appointments_month,
  (select count(*) from public.appointments where starts_at >= now()) as future_appointments
from public.transactions t;

grant select on public.dashboard_admin_today, public.dashboard_admin_month to authenticated;

-- =====================================================================
-- FIM DA MIGRAÇÃO
-- =====================================================================

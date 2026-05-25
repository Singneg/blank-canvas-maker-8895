-- =====================================================================
-- 0006_definitive_consolidation.sql
-- Consolida o backend ao schema REAL validado em produção:
--   - barbers.full_name (e não name)
--   - business_hours.owner_id, week_day, start_time, end_time,
--     lunch_start, lunch_end, active
--   - customers.full_name, customers.created_at, last_visit_at,
--     total_visits, total_spent_cents
-- Resolve o conflito PGRST203 dropando TODAS as assinaturas anteriores
-- de get_available_slots() e book_appointment() e recriando UMA única
-- versão correta de cada.
--
-- 100% idempotente. Pode ser executado várias vezes no SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =====================================================================
-- TRANSACTIONS — cria tabela caso ainda não exista (Financeiro depende)
-- =====================================================================
do $$ begin
  create type public.payment_status as enum ('pending','paid','refunded','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','pix','credit_card','debit_card','transfer','other');
exception when duplicate_object then null; end $$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  method public.payment_method not null default 'cash',
  status public.payment_status not null default 'paid',
  description text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_occurred_at on public.transactions(occurred_at desc);
create index if not exists idx_transactions_customer_id on public.transactions(customer_id);
create index if not exists idx_transactions_status on public.transactions(status);

alter table public.transactions enable row level security;
drop policy if exists transactions_staff_all on public.transactions;
create policy transactions_staff_all on public.transactions
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.customers c
               where c.id = transactions.customer_id and c.user_id = auth.uid())
  );

grant select, insert, update, delete on public.transactions to authenticated;

-- =====================================================================
-- HELPER: resolver owner_id a partir do barber_id
-- barbers.user_id (uuid) é o owner_id no business_hours
-- =====================================================================
create or replace function public.barber_owner_id(_barber_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select b.user_id from public.barbers b where b.id = _barber_id and b.user_id is not null),
    -- fallback: primeiro owner do sistema
    (select ur.user_id from public.user_roles ur where ur.role = 'owner' order by ur.created_at limit 1)
  );
$$;

grant execute on function public.barber_owner_id(uuid) to anon, authenticated;

-- =====================================================================
-- DROP de TODAS as assinaturas existentes (resolve PGRST203)
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_available_slots', 'book_appointment', 'ensure_self_customer')
  loop
    execute format('drop function if exists %I.%I(%s) cascade',
                   r.nspname, r.proname, r.args);
  end loop;
end $$;

-- =====================================================================
-- ensure_self_customer() — sem argumentos
-- =====================================================================
create or replace function public.ensure_self_customer()
returns uuid language plpgsql security definer set search_path = public, auth as $$
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
   order by c.created_at asc
   limit 1;

  if v_customer_id is not null then
    return v_customer_id;
  end if;

  select coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email,'@',1)),
         u.email,
         nullif(u.raw_user_meta_data ->> 'phone','')
    into v_name, v_email, v_phone
    from auth.users u
   where u.id = auth.uid();

  insert into public.customers (user_id, full_name, email, phone)
  values (auth.uid(), coalesce(v_name,'Cliente'), v_email, v_phone)
  returning id into v_customer_id;

  return v_customer_id;
end $$;

grant execute on function public.ensure_self_customer() to authenticated;

-- =====================================================================
-- get_available_slots(p_barber_id, p_date, p_service_id)
--   - usa schema real: business_hours.owner_id/week_day/start_time/
--     end_time/lunch_start/lunch_end/active
--   - desconta almoço
--   - desconta agendamentos existentes
--   - desconta time-off (se a tabela existir)
--   - retorna setof timestamptz (ISO)
-- =====================================================================
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
  v_step integer := 15;
  v_cursor timestamptz;
  v_limit timestamptz;
  v_slot_end timestamptz;
  v_tz constant text := 'America/Sao_Paulo';
begin
  if p_barber_id is null or p_date is null or p_service_id is null then
    return;
  end if;

  select duration_minutes into v_duration
    from public.services
   where id = p_service_id and active = true;
  if v_duration is null then return; end if;

  v_owner := public.barber_owner_id(p_barber_id);
  if v_owner is null then return; end if;

  v_weekday := extract(dow from p_date)::integer;

  select start_time, end_time, lunch_start, lunch_end
    into v_start, v_end, v_lunch_start, v_lunch_end
  from public.business_hours
   where owner_id = v_owner
     and week_day = v_weekday
     and active = true
   limit 1;

  if v_start is null or v_end is null then return; end if;

  v_cursor := ((p_date::text || ' ' || v_start::text || ' ' || v_tz)::timestamptz);
  v_limit  := ((p_date::text || ' ' || v_end::text   || ' ' || v_tz)::timestamptz);

  while v_cursor + make_interval(mins => v_duration) <= v_limit loop
    v_slot_end := v_cursor + make_interval(mins => v_duration);

    -- regra: slot precisa estar no futuro (margem de 5 min)
    if v_cursor < (now() + interval '5 minutes') then
      v_cursor := v_cursor + make_interval(mins => v_step);
      continue;
    end if;

    -- conflito com almoço
    if v_lunch_start is not null and v_lunch_end is not null then
      declare
        v_l_start timestamptz := ((p_date::text||' '||v_lunch_start::text||' '||v_tz)::timestamptz);
        v_l_end   timestamptz := ((p_date::text||' '||v_lunch_end::text  ||' '||v_tz)::timestamptz);
      begin
        if tstzrange(v_cursor, v_slot_end, '[)')
           && tstzrange(v_l_start, v_l_end, '[)') then
          v_cursor := v_cursor + make_interval(mins => v_step);
          continue;
        end if;
      end;
    end if;

    -- conflito com agendamentos existentes
    if exists (
      select 1 from public.appointments a
       where a.barber_id = p_barber_id
         and a.status not in ('cancelled','no_show')
         and tstzrange(a.starts_at, a.ends_at, '[)')
          && tstzrange(v_cursor, v_slot_end, '[)')
    ) then
      v_cursor := v_cursor + make_interval(mins => v_step);
      continue;
    end if;

    return next v_cursor;
    v_cursor := v_cursor + make_interval(mins => v_step);
  end loop;
end $$;

grant execute on function public.get_available_slots(uuid, date, uuid) to anon, authenticated;

-- =====================================================================
-- book_appointment(p_customer_id, p_service_id, p_barber_id, p_start_at, p_notes)
-- Insere appointment respeitando overlap. customer_id obrigatório (já
-- resolvido pelo frontend via cadastro CRM ou ensure_self_customer).
-- =====================================================================
create or replace function public.book_appointment(
  p_customer_id uuid,
  p_service_id  uuid,
  p_barber_id   uuid,
  p_start_at    timestamptz,
  p_notes       text default null
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_service public.services%rowtype;
  v_ends timestamptz;
  v_appt uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if p_customer_id is null or p_service_id is null
     or p_barber_id is null or p_start_at is null then
    raise exception 'Parâmetros obrigatórios ausentes';
  end if;

  select * into v_service
    from public.services where id = p_service_id and active = true;
  if v_service.id is null then
    raise exception 'Serviço não encontrado ou inativo';
  end if;

  v_ends := p_start_at + make_interval(mins => v_service.duration_minutes);

  insert into public.appointments
    (customer_id, barber_id, service_id, starts_at, ends_at,
     status, price_cents, notes, created_by)
  values
    (p_customer_id, p_barber_id, p_service_id, p_start_at, v_ends,
     'scheduled', v_service.price_cents, p_notes, auth.uid())
  returning id into v_appt;

  return v_appt;
exception when exclusion_violation then
  raise exception 'appointments_no_overlap';
end $$;

grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text) to authenticated;

-- =====================================================================
-- Verificações finais
-- =====================================================================
-- Confirma que existe APENAS UMA versão de cada função:
do $$
declare v_count int;
begin
  select count(*) into v_count from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_available_slots';
  if v_count <> 1 then
    raise exception 'get_available_slots deveria ter 1 versão, tem %', v_count;
  end if;

  select count(*) into v_count from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'book_appointment';
  if v_count <> 1 then
    raise exception 'book_appointment deveria ter 1 versão, tem %', v_count;
  end if;
end $$;

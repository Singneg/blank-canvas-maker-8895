-- =====================================================================
-- LÉO MORAES BARBER — FIX DE GRANTS (Fase 2)
-- =====================================================================
-- Execute este script no SQL Editor do Supabase.
-- Ele apenas concede permissões de SELECT/INSERT/UPDATE/DELETE necessárias
-- para que o frontend autenticado consiga ler user_roles, services,
-- appointments, customers, transactions etc.
--
-- Sintoma corrigido:
--   "permission denied for table user_roles" (HTTP 403)
--
-- Seguro reexecutar quantas vezes precisar — GRANTs são idempotentes.
-- =====================================================================

-- 1) Acesso básico ao schema
grant usage on schema public to anon, authenticated;

-- 2) Leitura pública (landing page e fluxo de agendamento anônimo)
grant select on public.barbers           to anon, authenticated;
grant select on public.service_categories to anon, authenticated;
grant select on public.services          to anon, authenticated;
grant select on public.business_hours    to anon, authenticated;

-- 3) Acesso completo para usuários autenticados (RLS controla as linhas)
grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                  on all sequences in schema public to authenticated;

-- 4) Garantia explícita para tabelas críticas (caso alguma RLS antiga
--    tenha sido aplicada antes do GRANT global)
grant select, insert, update, delete on public.user_roles    to authenticated;
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.customers     to authenticated;
grant select, insert, update, delete on public.appointments  to authenticated;
grant select, insert, update, delete on public.transactions  to authenticated;
grant select, insert, update, delete on public.loyalty_points to authenticated;

-- 5) Execução das funções RPC usadas pelo frontend
grant execute on function public.has_role(uuid, public.app_role)              to authenticated;
grant execute on function public.is_staff(uuid)                                to authenticated;
grant execute on function public.current_customer_id()                         to authenticated;
grant execute on function public.ensure_self_customer()                        to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, integer) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;

-- 6) Views administrativas
grant select on public.dashboard_admin_today to authenticated;
grant select on public.dashboard_admin_month to authenticated;

-- 7) Defaults para qualquer tabela/função futura criada pelo owner do schema
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- 8) Garantir que Leonardo Moraes tenha as roles owner/master_admin/barber
--    (caso o trigger de auto-owner não tenha disparado para o usuário existente)
do $$
declare
  v_user_id uuid;
  v_barber_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = 'leonardomoraes712@gmail.com'
  limit 1;

  if v_user_id is null then
    raise notice 'Usuário leonardomoraes712@gmail.com ainda não existe em auth.users — faça login primeiro.';
    return;
  end if;

  -- profile
  insert into public.profiles (id, email, full_name)
  values (v_user_id, 'leonardomoraes712@gmail.com', 'Leonardo Moraes')
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  -- roles
  insert into public.user_roles (user_id, role) values (v_user_id, 'master_admin') on conflict do nothing;
  insert into public.user_roles (user_id, role) values (v_user_id, 'owner')        on conflict do nothing;
  insert into public.user_roles (user_id, role) values (v_user_id, 'barber')       on conflict do nothing;

  -- barber link
  select id into v_barber_id from public.barbers where user_id = v_user_id limit 1;
  if v_barber_id is null then
    insert into public.barbers (user_id, name, active, display_order)
    values (v_user_id, 'Leonardo Moraes', true, 1)
    on conflict do nothing;
  end if;

  raise notice 'Permissões de owner aplicadas para %', v_user_id;
end$$;

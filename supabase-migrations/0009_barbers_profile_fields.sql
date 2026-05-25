-- =====================================================================
-- 0009_barbers_profile_fields.sql
-- Garante colunas de perfil em public.barbers (schema real do projeto).
-- A página de Configurações persiste o perfil do operador aqui.
-- 100% idempotente.
-- =====================================================================

-- Renomeia coluna name -> full_name caso ainda exista (legado 0001/0003)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'barbers' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'barbers' and column_name = 'full_name'
  ) then
    alter table public.barbers rename column name to full_name;
  end if;
end $$;

-- Garante full_name
alter table public.barbers add column if not exists full_name text;
update public.barbers set full_name = coalesce(full_name, 'Profissional') where full_name is null;
alter table public.barbers alter column full_name set not null;

-- Campos de contato do perfil
alter table public.barbers add column if not exists phone text;
alter table public.barbers add column if not exists email text;

-- Garante 1 registro de barber para cada owner do sistema
insert into public.barbers (user_id, full_name, active, display_order)
select ur.user_id,
       coalesce(au.raw_user_meta_data->>'full_name', au.email, 'Owner'),
       true, 0
from public.user_roles ur
join auth.users au on au.id = ur.user_id
where ur.role = 'owner'
  and not exists (select 1 from public.barbers b where b.user_id = ur.user_id)
on conflict do nothing;

-- RLS: permitir que o próprio usuário (staff) atualize sua linha em barbers
do $$ begin
  drop policy if exists barbers_self_update on public.barbers;
  create policy barbers_self_update on public.barbers
    for update to authenticated
    using (user_id = auth.uid() or public.is_staff(auth.uid()))
    with check (user_id = auth.uid() or public.is_staff(auth.uid()));
exception when others then null; end $$;

do $$ begin
  drop policy if exists barbers_staff_all on public.barbers;
  create policy barbers_staff_all on public.barbers
    for all to authenticated
    using (public.is_staff(auth.uid()))
    with check (public.is_staff(auth.uid()));
exception when others then null; end $$;

grant select, insert, update on public.barbers to authenticated;

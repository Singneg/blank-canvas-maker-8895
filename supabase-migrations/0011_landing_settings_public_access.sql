-- =====================================================================
-- LÉO MORAES BARBER — FIX DE ACESSO PÚBLICO (Fase 4)
-- =====================================================================
-- Execute este script no SQL Editor do Supabase para liberar a landing page.
-- =====================================================================

-- 1) Garantir acesso ao schema
grant usage on schema public to anon, authenticated;

-- 2) Conceder SELECT para o papel 'anon' (visitantes sem login)
grant select on public.landing_settings to anon;
grant select on public.services         to anon;
grant select on public.portfolio        to anon;
grant select on public.barbers          to anon;

-- 3) Criar Políticas de RLS para landing_settings (leitura pública)
alter table public.landing_settings enable row level security;

drop policy if exists "Landing settings are public" on public.landing_settings;
create policy "Landing settings are public" on public.landing_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can update their own landing settings" on public.landing_settings;
create policy "Users can update their own landing settings" on public.landing_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Garantir que outras tabelas da landing também tenham políticas públicas
alter table public.services enable row level security;
drop policy if exists "Services are public" on public.services;
create policy "Services are public" on public.services
  for select
  to anon, authenticated
  using (active = true);

alter table public.portfolio enable row level security;
drop policy if exists "Portfolio is public" on public.portfolio;
create policy "Portfolio is public" on public.portfolio
  for select
  to anon, authenticated
  using (is_active = true and show_on_landing = true);

alter table public.barbers enable row level security;
drop policy if exists "Barbers are public" on public.barbers;
create policy "Barbers are public" on public.barbers
  for select
  to anon, authenticated
  using (active = true);

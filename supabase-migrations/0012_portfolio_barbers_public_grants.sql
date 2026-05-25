-- Garantir acesso público de leitura para portfolio e barbers
grant usage on schema public to anon, authenticated;

grant select on public.portfolio to anon, authenticated;
grant select on public.barbers   to anon, authenticated;

alter table public.portfolio enable row level security;
drop policy if exists "Portfolio is public" on public.portfolio;
create policy "Portfolio is public" on public.portfolio
  for select
  to anon, authenticated
  using (show_on_landing = true);

alter table public.barbers enable row level security;
drop policy if exists "Barbers are public" on public.barbers;
create policy "Barbers are public" on public.barbers
  for select
  to anon, authenticated
  using (active = true);

-- =====================================================================
-- 0008: Corrige SELECT em appointments
-- Problema: agendamento é inserido com sucesso (book_appointment retorna id)
-- mas SELECT subsequente retorna [], indicando RLS bloqueando leitura.
-- =====================================================================

-- Garantir que RLS está ativo
alter table public.appointments enable row level security;

-- Limpar TODAS as policies existentes em appointments (evita conflitos)
do $$
declare pol record;
begin
  for pol in
    select polname from pg_policy where polrelid = 'public.appointments'::regclass
  loop
    execute format('drop policy if exists %I on public.appointments', pol.polname);
  end loop;
end $$;

-- SELECT: staff vê tudo; cliente vê os próprios
create policy appointments_select_staff on public.appointments
  for select to authenticated
  using (public.is_staff(auth.uid()));

create policy appointments_select_own on public.appointments
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = appointments.customer_id and c.user_id = auth.uid()
    )
  );

-- INSERT
create policy appointments_insert_staff on public.appointments
  for insert to authenticated
  with check (public.is_staff(auth.uid()));

-- UPDATE
create policy appointments_update_staff on public.appointments
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create policy appointments_update_own_cancel on public.appointments
  for update to authenticated
  using (
    exists (select 1 from public.customers c
            where c.id = appointments.customer_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.customers c
            where c.id = appointments.customer_id and c.user_id = auth.uid())
  );

-- DELETE
create policy appointments_delete_staff on public.appointments
  for delete to authenticated
  using (public.is_staff(auth.uid()));

grant select, insert, update, delete on public.appointments to authenticated;

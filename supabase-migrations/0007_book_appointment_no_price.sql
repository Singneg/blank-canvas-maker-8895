-- =====================================================================
-- 0007: Corrige book_appointment removendo price_cents de appointments
-- A tabela appointments NÃO possui a coluna price_cents.
-- O preço deve ser sempre derivado de services.price_cents.
-- =====================================================================

drop function if exists public.book_appointment(uuid, uuid, uuid, timestamptz, text);

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
    (customer_id, barber_id, service_id, starts_at, ends_at, status, notes)
  values
    (p_customer_id, p_barber_id, p_service_id, p_start_at, v_ends,
     'scheduled', p_notes)
  returning id into v_appt;

  return v_appt;
exception when exclusion_violation then
  raise exception 'appointments_no_overlap';
end $$;

grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text) to authenticated;

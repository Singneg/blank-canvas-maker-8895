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

  -- Arredonda v_cursor para o próximo múltiplo de 30 minutos se necessário
  if extract(minute from v_cursor)::integer % 30 != 0 then
    v_cursor := v_cursor + (30 - (extract(minute from v_cursor)::integer % 30)) * interval '1 minute';
  end if;
  v_cursor := date_trunc('minute', v_cursor);

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
  -- Validar se o horário de início é múltiplo de 30 minutos
  if extract(minute from p_start_at)::integer % 30 != 0 then
    raise exception 'Horários de agendamento devem ser em intervalos de 30 minutos (ex: 09:00, 09:30).';
  end if;

  select duration_minutes into v_duration from public.services where id = p_service_id;
  v_end_at := p_start_at + make_interval(mins => v_duration);
  
  insert into public.appointments (customer_id, service_id, barber_id, starts_at, ends_at, notes)
  values (p_customer_id, p_service_id, p_barber_id, p_start_at, v_end_at, p_notes)
  returning id into v_id;
  
  return v_id;
end;
$$;
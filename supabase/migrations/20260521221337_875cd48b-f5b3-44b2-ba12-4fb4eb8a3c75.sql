CREATE OR REPLACE FUNCTION public.get_available_slots(p_barber_id uuid, p_date date, p_service_id uuid)
 RETURNS SETOF timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_duration integer;
  v_owner uuid;
  v_start time;
  v_end time;
  v_lunch_start time;
  v_lunch_end time;
  v_weekday integer;
  v_step integer := 30; -- Força 30 minutos
  v_cursor timestamptz;
  v_limit timestamptz;
  v_slot_end timestamptz;
  v_tz constant text := 'America/Sao_Paulo';
begin
  -- Carrega duração do serviço
  select duration_minutes into v_duration from public.services where id = p_service_id;
  if v_duration is null then return; end if;

  -- Resolve o owner (para buscar o expediente)
  v_owner := public.barber_owner_id(p_barber_id);
  v_weekday := extract(dow from p_date)::integer;

  -- Carrega expediente do dia
  select start_time, end_time, lunch_start, lunch_end
  into v_start, v_end, v_lunch_start, v_lunch_end
  from public.business_hours
  where owner_id = v_owner and week_day = v_weekday and active = true limit 1;

  if v_start is null or v_end is null then return; end if;

  -- Define limites do dia
  v_cursor := ((p_date::text || ' ' || v_start::text || ' ' || v_tz)::timestamptz);
  v_limit  := ((p_date::text || ' ' || v_end::text   || ' ' || v_tz)::timestamptz);

  -- 1. Garante que o cursor comece em um múltiplo de 30 minutos (:00 ou :30)
  if extract(minute from v_cursor)::integer % 30 != 0 then
    v_cursor := v_cursor + (30 - (extract(minute from v_cursor)::integer % 30)) * interval '1 minute';
  end if;
  v_cursor := date_trunc('minute', v_cursor);

  while v_cursor + make_interval(mins => v_duration) <= v_limit loop
    -- 2. FILTRO OBRIGATÓRIO: O horário deve começar com :00 ou :30
    if extract(minute from v_cursor)::integer % 30 != 0 then
      v_cursor := v_cursor + make_interval(mins => 1);
      continue;
    end if;

    v_slot_end := v_cursor + make_interval(mins => v_duration);
    
    -- Ignora horários no passado (margem de 5 min)
    if v_cursor < (now() + interval '5 minutes') then
      v_cursor := v_cursor + make_interval(mins => v_step);
      continue;
    end if;

    -- Verifica conflito com Almoço
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

    -- Verifica conflito com Agendamentos Existentes
    if not exists (
      select 1 from public.appointments a
      where a.barber_id = p_barber_id
        and a.status not in ('cancelled','no_show')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_cursor, v_slot_end, '[)')
    ) then
      return next v_cursor;
    end if;
    
    -- Próximo slot (pula 30 min)
    v_cursor := v_cursor + make_interval(mins => v_step);
  end loop;
end;
$function$;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, date, uuid) TO anon, authenticated;

-- Overload with 2 arguments (p_date, p_service_id)
CREATE OR REPLACE FUNCTION public.get_available_slots(p_date date, p_service_id uuid)
 RETURNS SETOF timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_barber_id uuid;
begin
  -- Seleciona o primeiro barbeiro ativo
  select id into v_barber_id from public.barbers where active = true order by created_at limit 1;
  
  -- Fallback se não houver barbeiro ativo
  if v_barber_id is null then
    select id into v_barber_id from public.barbers order by created_at limit 1;
  end if;

  return query select public.get_available_slots(v_barber_id, p_date, p_service_id);
end;
$function$;

-- Grant permission to overload
GRANT EXECUTE ON FUNCTION public.get_available_slots(date, uuid) TO anon, authenticated;
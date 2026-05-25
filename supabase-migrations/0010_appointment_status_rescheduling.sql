-- =====================================================================
-- 0010_appointment_status_rescheduling.sql
-- Adiciona o valor 'rescheduling' ao enum appointment_status para
-- permitir que o barbeiro sinalize um pedido de reagendamento direto
-- na agenda (com notificação automática ao cliente via WhatsApp).
-- 100% idempotente.
-- =====================================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'appointment_status'
      and e.enumlabel = 'rescheduling'
  ) then
    alter type public.appointment_status add value 'rescheduling';
  end if;
end $$;

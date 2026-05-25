CREATE OR REPLACE FUNCTION public.check_appointment_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- Só aplica se o status estiver mudando para 'cancelled'
  IF (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled')) THEN
    -- Pula verificação se for staff (barbeiro/admin)
    IF is_staff(auth.uid()) THEN
      RETURN NEW;
    END IF;

    -- Bloqueia se faltar menos de 1 hora
    IF (OLD.starts_at - now() < interval '1 hour') THEN
      RAISE EXCEPTION 'Cancelamentos não podem ser realizados com menos de 1 hora de antecedência. Entre em contato diretamente com o barbeiro.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o trigger se já existir para evitar erros
DROP TRIGGER IF EXISTS enforce_cancellation_policy ON public.appointments;

CREATE TRIGGER enforce_cancellation_policy
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_cancellation();
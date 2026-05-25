CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Tentar atualizar o registro existente
  UPDATE public.customers
  SET 
    platform_logins = platform_logins + 1,
    total_visits = total_visits + 1,
    last_login_at = now(),
    last_visit_at = now(),
    archived = false
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

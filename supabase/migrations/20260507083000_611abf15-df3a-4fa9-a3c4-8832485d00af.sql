-- Atualizar RPC track_platform_login
CREATE OR REPLACE FUNCTION public.track_platform_login(arg_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.customers (
        user_id, 
        platform_logins, 
        total_visits,
        last_login_at, 
        last_visit_at,
        archived
    )
    VALUES (
        arg_user_id, 
        1, 
        1,
        now(), 
        now(),
        false
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        platform_logins = COALESCE(customers.platform_logins, 0) + 1,
        total_visits = COALESCE(customers.total_visits, 0) + 1,
        last_login_at = now(),
        last_visit_at = now(),
        archived = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar trigger handle_user_login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.customers
  SET 
    platform_logins = COALESCE(platform_logins, 0) + 1,
    total_visits = COALESCE(total_visits, 0) + 1,
    last_login_at = now(),
    last_visit_at = now(),
    archived = false
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar trigger handle_new_user_crm_sync (caso ocorra conflito)
CREATE OR REPLACE FUNCTION public.handle_new_user_crm_sync()
RETURNS TRIGGER AS $$
DECLARE
    meta_full_name TEXT;
    meta_phone TEXT;
    existing_id UUID;
BEGIN
    meta_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
    meta_phone := COALESCE(new.raw_user_meta_data->>'phone', '');

    SELECT id INTO existing_id FROM public.customers WHERE email = new.email AND user_id IS NULL LIMIT 1;

    IF existing_id IS NOT NULL THEN
        UPDATE public.customers
        SET 
            user_id = new.id,
            full_name = CASE WHEN full_name = '' OR full_name IS NULL THEN COALESCE(meta_full_name, split_part(new.email, '@', 1)) ELSE full_name END,
            phone = CASE WHEN phone IS NULL THEN meta_phone ELSE phone END,
            platform_logins = COALESCE(platform_logins, 0) + 1,
            total_visits = COALESCE(total_visits, 0) + 1,
            last_login_at = now(),
            last_visit_at = now()
        WHERE id = existing_id;
    ELSE
        INSERT INTO public.customers (
            user_id,
            full_name,
            email,
            phone,
            created_at,
            platform_logins,
            total_visits,
            last_login_at,
            last_visit_at,
            archived
        )
        VALUES (
            new.id,
            CASE WHEN meta_full_name = '' THEN split_part(new.email, '@', 1) ELSE meta_full_name END,
            new.email,
            CASE WHEN meta_phone = '' THEN NULL ELSE meta_phone END,
            new.created_at,
            1,
            1,
            now(),
            now(),
            false
        )
        ON CONFLICT (user_id) DO UPDATE
        SET 
            email = EXCLUDED.email,
            platform_logins = COALESCE(customers.platform_logins, 0) + 1,
            total_visits = COALESCE(customers.total_visits, 0) + 1,
            last_login_at = now(),
            last_visit_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

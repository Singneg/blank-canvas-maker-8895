CREATE OR REPLACE FUNCTION public.track_platform_login(arg_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_full_name TEXT;
BEGIN
    -- Tenta pegar o nome dos metadados do auth.users
    SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Cliente')
    INTO v_full_name
    FROM auth.users
    WHERE id = arg_user_id;

    INSERT INTO public.customers (
        user_id, 
        full_name,
        platform_logins, 
        last_login_at,
        archived
    )
    VALUES (
        arg_user_id, 
        COALESCE(v_full_name, 'Cliente'),
        1, 
        now(),
        false
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        platform_logins = COALESCE(customers.platform_logins, 0) + 1,
        last_login_at = now(),
        archived = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.track_platform_login(arg_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.customers (
        user_id, 
        platform_logins, 
        last_login_at,
        archived
    )
    VALUES (
        arg_user_id, 
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
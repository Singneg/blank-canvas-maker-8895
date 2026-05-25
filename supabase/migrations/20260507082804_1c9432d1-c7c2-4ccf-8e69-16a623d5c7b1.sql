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
        platform_logins = customers.platform_logins + 1,
        total_visits = customers.total_visits + 1,
        last_login_at = now(),
        last_visit_at = now(),
        archived = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

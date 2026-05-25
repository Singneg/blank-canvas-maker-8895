CREATE OR REPLACE FUNCTION public.handle_new_user_crm_sync()
RETURNS TRIGGER AS $$
DECLARE
    meta_full_name TEXT;
    meta_phone TEXT;
    existing_id UUID;
BEGIN
    -- Tenta extrair dados do metadata do Supabase Auth
    meta_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
    meta_phone := COALESCE(new.raw_user_meta_data->>'phone', '');

    -- Verifica se já existe um cliente com este e-mail mas sem user_id vinculado
    SELECT id INTO existing_id FROM public.customers WHERE email = new.email AND user_id IS NULL LIMIT 1;

    IF existing_id IS NOT NULL THEN
        -- Vincula o usuário ao registro existente
        UPDATE public.customers
        SET 
            user_id = new.id,
            full_name = CASE WHEN full_name = '' OR full_name IS NULL THEN COALESCE(meta_full_name, split_part(new.email, '@', 1)) ELSE full_name END,
            phone = CASE WHEN phone IS NULL THEN meta_phone ELSE phone END,
            platform_logins = platform_logins + 1,
            total_visits = total_visits + 1,
            last_login_at = now(),
            last_visit_at = now()
        WHERE id = existing_id;
    ELSE
        -- Insere novo registro se não existir por user_id (ON CONFLICT handles if user_id exists)
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
            platform_logins = customers.platform_logins + 1,
            total_visits = customers.total_visits + 1,
            last_login_at = now(),
            last_visit_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

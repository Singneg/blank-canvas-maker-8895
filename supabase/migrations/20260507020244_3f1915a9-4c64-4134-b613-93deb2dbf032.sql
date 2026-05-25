-- Função para processar novos usuários e sincronizar com o CRM
CREATE OR REPLACE FUNCTION public.handle_new_user_crm_sync()
RETURNS TRIGGER AS $$
DECLARE
    meta_full_name TEXT;
    meta_phone TEXT;
BEGIN
    -- Tenta extrair dados do metadata do Supabase Auth
    meta_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
    meta_phone := COALESCE(new.raw_user_meta_data->>'phone', '');

    -- Insere no CRM se não existir
    INSERT INTO public.customers (
        user_id,
        full_name,
        email,
        phone,
        created_at,
        platform_logins,
        archived
    )
    VALUES (
        new.id,
        CASE WHEN meta_full_name = '' THEN split_part(new.email, '@', 1) ELSE meta_full_name END,
        new.email,
        CASE WHEN meta_phone = '' THEN NULL ELSE meta_phone END,
        new.created_at,
        0,
        false
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = CASE WHEN customers.full_name = '' OR customers.full_name IS NULL THEN EXCLUDED.full_name ELSE customers.full_name END,
        phone = CASE WHEN customers.phone IS NULL THEN EXCLUDED.phone ELSE customers.phone END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created_crm ON auth.users;
CREATE TRIGGER on_auth_user_created_crm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_crm_sync();

-- Backfill: Sincronizar usuários existentes
INSERT INTO public.customers (
    user_id,
    full_name,
    email,
    phone,
    created_at,
    platform_logins,
    archived
)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    email,
    raw_user_meta_data->>'phone',
    created_at,
    0,
    false
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

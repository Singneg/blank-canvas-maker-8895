-- Adicionar colunas de engajamento na tabela customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS platform_logins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Função para registrar login e incrementar contador
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Tentar atualizar o registro existente
  UPDATE public.customers
  SET 
    platform_logins = platform_logins + 1,
    last_login_at = now()
  WHERE user_id = NEW.id;

  -- Se não atualizou nada, o cliente ainda não existe na tabela (usuário novo ou vindo do auth direto)
  -- Mas o ideal é que a trigger de INSERT em auth.users crie o registro se quisermos "todos" os usuários
  -- Vamos focar no incremento por enquanto.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para capturar logins (quando last_sign_in_at muda)
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
EXECUTE FUNCTION public.handle_user_login();

-- Garantir que todos os usuários atuais de auth.users que não estão em customers sejam adicionados
-- Nota: Isso requer acesso a auth.users, que o agente geralmente tem via RPC ou direct SQL se permitido.
INSERT INTO public.customers (user_id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email
FROM auth.users u
LEFT JOIN public.customers c ON u.id = c.user_id
WHERE c.id IS NULL;

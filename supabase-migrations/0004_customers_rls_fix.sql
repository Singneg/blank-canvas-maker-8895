-- =====================================================================
-- 0004_customers_rls_fix.sql
-- Corrige RLS da tabela public.customers para permitir cadastro
-- administrativo por owner / master_admin / barber, mantendo o cliente
-- comum com acesso apenas ao próprio registro.
--
-- Idempotente: pode rodar várias vezes sem erro.
-- Executar no SQL Editor do Supabase.
-- =====================================================================

-- Garantir RLS habilitado
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Função auxiliar (SECURITY DEFINER) para evitar recursão de RLS
-- ao consultar public.user_roles dentro das policies.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'master_admin', 'barber')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- Limpeza de policies anteriores (idempotente)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.customers'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', pol.polname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- SELECT
--   - staff (owner/master_admin/barber): vê todos os clientes
--   - customer: vê apenas o próprio registro (user_id = auth.uid())
-- ---------------------------------------------------------------------
CREATE POLICY "customers_select_staff"
ON public.customers
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "customers_select_own"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- INSERT
--   - staff: pode inserir qualquer cliente (cadastro manual no painel)
--   - customer: pode inserir o próprio registro (self-service)
-- ---------------------------------------------------------------------
CREATE POLICY "customers_insert_staff"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "customers_insert_own"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- UPDATE
--   - staff: pode editar qualquer cliente
--   - customer: pode editar apenas o próprio registro
-- ---------------------------------------------------------------------
CREATE POLICY "customers_update_staff"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "customers_update_own"
ON public.customers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- DELETE
--   - apenas staff (owner/master_admin/barber)
-- ---------------------------------------------------------------------
CREATE POLICY "customers_delete_staff"
ON public.customers
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- Grants básicos (RLS continua aplicando o filtro real)
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;

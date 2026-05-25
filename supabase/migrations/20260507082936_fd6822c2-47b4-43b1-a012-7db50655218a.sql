-- Política para permitir que staff (admin/barbeiro) veja todos os clientes
CREATE POLICY "Staff can view all customers" 
ON public.customers 
FOR SELECT 
USING (is_staff(auth.uid()));

-- Política para permitir que staff gerencie clientes
CREATE POLICY "Staff can manage customers" 
ON public.customers 
FOR ALL 
USING (is_staff(auth.uid()));

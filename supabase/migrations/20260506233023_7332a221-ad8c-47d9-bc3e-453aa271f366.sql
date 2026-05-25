-- Adicionar colunas faltantes em barbers
alter table public.barbers add column if not exists email text;

-- Criar tabela de fidelidade
create table if not exists public.loyalty_points (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Criar tabela de notas de clientes
create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

-- Criar tabela de transações (Financeiro)
do $$ begin
  create type public.payment_status as enum ('pending','paid','refunded','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','pix','credit_card','debit_card','transfer','other');
exception when duplicate_object then null; end $$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  amount_cents integer not null,
  method public.payment_method not null default 'cash',
  status public.payment_status not null default 'paid',
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Habilitar RLS
alter table public.loyalty_points enable row level security;
alter table public.customer_notes enable row level security;
alter table public.transactions enable row level security;

-- Políticas
create policy "Staff manage loyalty" on public.loyalty_points for all using (public.is_staff(auth.uid()));
create policy "Users view own loyalty" on public.loyalty_points for select using (
  exists (select 1 from public.customers c where c.id = loyalty_points.customer_id and c.user_id = auth.uid())
);

create policy "Staff manage notes" on public.customer_notes for all using (public.is_staff(auth.uid()));
create policy "Staff manage transactions" on public.transactions for all using (public.is_staff(auth.uid()));

-- Grants
grant select, insert, update on public.loyalty_points to authenticated;
grant select, insert, update on public.customer_notes to authenticated;
grant select, insert, update on public.transactions to authenticated;
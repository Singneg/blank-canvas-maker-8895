-- Tabela de configurações da Landing Page
create table if not exists public.landing_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null,
  hero_title text default 'Corte de Cabelo e Barba de Respeito',
  hero_subtitle text default 'Experiência premium para o homem moderno.',
  hero_button_text text default 'Agendar Agora',
  services_title text default 'Nossos Serviços',
  portfolio_title text default 'Nosso Portfólio',
  portfolio_description text default 'Confira alguns de nossos trabalhos mais recentes.',
  about_title text default 'Sobre a Barbearia',
  about_description text default 'Mais que um corte, uma experiência.',
  about_barber_name text default 'Léo Moraes',
  barber_title text default 'Barbeiro Master',
  barber_photo_url text,
  barber_image_url text, -- duplicado para compatibilidade
  instagram text,
  rating decimal(3,1) default 5.0,
  clients_count integer default 100,
  specialties text default 'Degradê, Barba Terapia, Pigmentação',
  years_experience integer default 5,
  created_at timestamptz default now()
);

-- Tabela de Portfólio
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  image_url text not null,
  show_on_landing boolean default true,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Habilitar RLS
alter table public.landing_settings enable row level security;
alter table public.portfolio enable row level security;

-- Políticas
create policy "Public view landing_settings" on public.landing_settings for select using (true);
create policy "Staff manage landing_settings" on public.landing_settings for all using (public.is_staff(auth.uid()));

create policy "Public view portfolio" on public.portfolio for select using (is_active = true);
create policy "Staff manage portfolio" on public.portfolio for all using (public.is_staff(auth.uid()));

-- Grants
grant select on public.landing_settings to anon, authenticated;
grant select on public.portfolio to anon, authenticated;
grant insert, update, delete on public.landing_settings to authenticated;
grant insert, update, delete on public.portfolio to authenticated;
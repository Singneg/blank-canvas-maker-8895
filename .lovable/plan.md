# LÉO MORAES BARBER — Plano de Execução Definitivo

## Credenciais recebidas
- **Supabase URL**: `https://wvqvndxchoqpwxbvwzhv.supabase.co`
- **Anon Key**: `sb_publishable_oN35sS8oZRxVJ9qXkJm0ug_odrWQKCH`
- **Service Role Key**: será solicitada no momento exato da configuração server-side (Fase 1, passo 2)

Toda a infraestrutura será criada **exclusivamente no seu projeto Supabase próprio**. Zero uso de Lovable Cloud, zero banco interno, zero tabelas paralelas.

---

## Fase 1 — Fundação (entrega única, executada após aprovação)

### 1.1 Conexão Supabase próprio
- Criar `src/integrations/supabase/client.ts` (browser, anon key — via `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`)
- Criar `src/integrations/supabase/client.server.ts` (admin, service role — via `process.env.SUPABASE_SERVICE_ROLE_KEY`)
- Criar `src/integrations/supabase/auth-middleware.ts` (server functions autenticadas com RLS)
- Gravar as 3 credenciais como secrets do projeto Lovable (eu solicito a Service Role Key no momento exato)

### 1.2 Migration única no seu PostgreSQL Supabase
**SQL completo a executar manualmente no SQL Editor do seu Supabase** (vou gerar o arquivo `supabase-migrations/0001_init.sql` no repositório para você copiar/colar):

- Extensions: `pgcrypto`, `btree_gist`
- Enums: `app_role` (`master_admin`, `owner`, `barber`, `customer`), `appointment_status`, `payment_status`, `payment_method`, `loyalty_tx_type`
- 23 tabelas: `profiles`, `user_roles`, `barbers`, `services`, `service_categories`, `appointments`, `appointment_history`, `customers`, `customer_notes`, `transactions`, `payment_intents`, `loyalty_points`, `loyalty_transactions`, `vip_subscriptions`, `products`, `product_categories`, `inventory_movements`, `portfolio_items`, `whatsapp_templates`, `whatsapp_queue`, `whatsapp_logs`, `audit_logs`, `system_settings`
- FKs, índices em colunas de busca/ordenação, triggers `updated_at`
- **Constraint anti-overbooking** via `EXCLUDE USING gist` em `appointments` (impede dois agendamentos sobrepostos para o mesmo barbeiro a nível de hardware)
- Função `has_role(uuid, app_role)` `SECURITY DEFINER` com `search_path = public`
- RLS ativo em **todas** as 23 tabelas + policies por papel
- Trigger `handle_new_user` para popular `profiles` automaticamente no signup

### 1.3 Auth + RBAC
- Páginas: `/auth` (login), `/auth/signup`, `/auth/reset`
- Email/senha + Google OAuth (você habilita Google no painel do seu Supabase)
- Hook `useAuth` + `useRole` lendo de `user_roles` (nunca de `profiles`)
- Guards de rota: `master_admin` → `/admin`, `owner` → `/dashboard`, `customer` → `/cliente`

### 1.4 Identidade visual editorial dark
- Tokens em `src/styles.css` (Tailwind v4 native): `--bg #0A0A0A`, `--fg #FFFFFF`, `--gold #C9A24B`, `--gold-soft #E0C078`, `--surface-1 #121212`, `--surface-2 #1A1A1A`, `--border #2A2A2A`
- Tipografia: serif display para títulos (Playfair Display), sans para corpo (Inter)
- Logo "LÉO MORAES BARBER" + watermark dourado 4–6% opacity em fundos de dashboard
- Componentes shadcn re-skinados: botões dourados com hover sutil, cards com bordas finas, inputs minimalistas

### 1.5 Landing pública (/)
- Hero com logo + tagline + CTA "Agendar agora"
- Seções: Serviços, Portfólio (placeholders), Sobre, Localização, CTA final
- SEO completo no `head()` da rota
- Botão login no canto superior

### 1.6 Agenda Inteligente (`/dashboard/agenda` — owner/barber)
- Visão dia/semana com slots
- Criar/editar/cancelar agendamento
- Status: `scheduled`, `confirmed`, `in_progress`, `completed`, `no_show`, `cancelled`
- Realtime via Supabase Realtime (canal por barbeiro)
- Bloqueio de horário (folga, almoço)
- Histórico em `appointment_history`

### 1.7 CRM (`/dashboard/clientes` — owner)
- Lista de clientes com busca, filtros (último atendimento, ticket médio, frequência)
- Ficha do cliente: histórico de atendimentos, notas internas, tags, pontos de fidelidade
- **Score de churn** computado (dias sem visita vs. frequência média)
- **Score de recorrência** (visitas/mês)

### 1.8 Área do Cliente (`/cliente`)
- Próximo agendamento + histórico
- Botão "Reagendar" / "Cancelar" (respeita política de antecedência)
- Saldo de pontos de fidelidade
- Status VIP (se houver)

### 1.9 Dashboard Executivo (`/dashboard` — owner)
- KPIs: faturamento mês, agendamentos hoje, ticket médio, taxa no-show, novos clientes
- Gráfico de receita 30 dias
- Top serviços, top clientes
- Próximos agendamentos (live)

---

## Fases seguintes (não executadas agora — aguardam Fase 1 estável)

- **Fase 2 — Financeiro + Mercado Pago**: lançamento manual de transações, conciliação, estrutura preparada para webhook PIX/cartão Mercado Pago
- **Fase 3 — Fidelidade + VIP**: regras de pontos por R$ gasto, resgate, assinatura recorrente VIP com benefícios
- **Fase 4 — Produtos + Portfólio**: estoque com movimentações, upload de fotos no Supabase Storage com RLS por bucket
- **Fase 5 — WhatsApp (Evolution API) + Master Admin + Auditoria**: templates, fila, logs, painel master multi-unidade, audit trail completo

---

## Ordem técnica de execução (Fase 1)
```text
1. Secrets (URL, Anon, Service Role)
2. Cliente Supabase (browser + admin + auth middleware)
3. Migration SQL → você cola no SQL Editor do seu Supabase
4. Design tokens + tipografia + logo
5. Auth (páginas + hooks + guards)
6. Landing pública
7. Agenda + CRM + Área Cliente + Dashboard
8. QA visual + ajustes
```

---

## O que preciso de você para começar
1. **Aprovar este plano** (botão abaixo)
2. Após aprovação, vou pedir a **Service Role Key** via secret seguro (nunca exposta no frontend)
3. Você executa a migration SQL no SQL Editor do seu projeto Supabase (vou fornecer o arquivo pronto)
4. Você habilita Google OAuth no painel do seu Supabase (Authentication → Providers)

Sem improviso. Sem Lovable Cloud. Tudo no seu Supabase.
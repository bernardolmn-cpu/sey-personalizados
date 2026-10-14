create table public.store_settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'SEY PERSONALIZADOS' check (char_length(brand_name) between 1 and 80),
  tagline text not null default '' check (char_length(tagline) <= 160),
  announcement text not null default '' check (char_length(announcement) <= 180),
  contact_email text not null default '' check (contact_email = '' or contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  instagram_url text not null default '' check (instagram_url = '' or instagram_url ~ '^https://(www\.)?instagram\.com/'),
  logo_url text not null default '' check (logo_url = '' or logo_url ~ '^https://'),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id, brand_name)
values (true, 'SEY PERSONALIZADOS')
on conflict (id) do nothing;

create trigger store_settings_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;

create policy "Anyone can read store branding"
on public.store_settings for select to anon, authenticated
using (true);

create policy "Only admins can update store branding"
on public.store_settings for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create table public.content_pages (
  slug text primary key check (slug in ('about', 'faq', 'shipping', 'returns', 'privacy', 'terms')),
  title text not null check (char_length(title) between 1 and 120),
  introduction text not null default '' check (char_length(introduction) <= 500),
  body text not null default '' check (char_length(body) <= 20000),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.content_pages (slug, title, introduction)
values
  ('about', 'Quem somos', 'Conte a história da sua marca.'),
  ('faq', 'Perguntas frequentes', 'Responda às principais dúvidas dos seus clientes.'),
  ('shipping', 'Entregas e prazos', 'Informe prazos, regiões atendidas e custos de entrega.'),
  ('returns', 'Trocas e devoluções', 'Explique como funcionam trocas, devoluções e reembolsos.'),
  ('privacy', 'Privacidade', 'Descreva como os dados pessoais são utilizados e protegidos.'),
  ('terms', 'Termos de uso', 'Defina as condições de uso da loja.')
on conflict (slug) do nothing;

create trigger content_pages_updated_at
before update on public.content_pages
for each row execute function public.set_updated_at();

alter table public.content_pages enable row level security;
grant select on public.content_pages to anon, authenticated;
grant insert, update on public.content_pages to authenticated;

create policy "Anyone can read published content pages"
on public.content_pages for select to anon, authenticated
using (published or (select public.is_admin()));

create policy "Only admins can create content pages"
on public.content_pages for insert to authenticated
with check ((select public.is_admin()));

create policy "Only admins can update content pages"
on public.content_pages for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create table public.faq_items (
  id uuid primary key default extensions.gen_random_uuid(),
  question text not null check (char_length(question) between 5 and 240),
  answer text not null check (char_length(answer) between 1 and 3000),
  sort_order integer not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faq_items_public_order_idx on public.faq_items (active, sort_order, created_at);

create trigger faq_items_updated_at
before update on public.faq_items
for each row execute function public.set_updated_at();

alter table public.faq_items enable row level security;
grant select on public.faq_items to anon, authenticated;
grant insert, update, delete on public.faq_items to authenticated;

create policy "Anyone can read active FAQs"
on public.faq_items for select to anon, authenticated
using (active or (select public.is_admin()));

create policy "Only admins can manage FAQs"
on public.faq_items for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

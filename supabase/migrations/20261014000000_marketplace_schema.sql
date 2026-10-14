create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create type public.account_role as enum ('customer', 'admin');
create type public.order_status as enum ('awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'refunded');
create type public.discount_kind as enum ('percentage', 'fixed');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.account_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.site_banners (
  id uuid primary key default extensions.gen_random_uuid(),
  eyebrow text not null default '' check (char_length(eyebrow) <= 100),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 500),
  image_url text not null check (image_url ~ '^https://'),
  cta_label text not null default 'Descobrir' check (char_length(cta_label) between 1 and 40),
  destination text not null default '/catalogo' check (destination like '/%' and destination not like '//%'),
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= price),
  stock integer not null default 0 check (stock >= 0),
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_type public.discount_kind not null,
  discount_value numeric(12, 2) not null check (discount_value > 0),
  minimum_subtotal numeric(12, 2) not null default 0 check (minimum_subtotal >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (max_uses is null or uses <= max_uses)
);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_number text not null unique default ('VT-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12))),
  user_id uuid not null references public.profiles (user_id),
  status public.order_status not null default 'awaiting_payment',
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0 and discount_amount <= subtotal),
  total numeric(12, 2) not null check (total = subtotal + shipping_amount - discount_amount),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  coupon_id uuid references public.coupons (id) on delete set null,
  payment_provider text,
  provider_checkout_id text unique,
  provider_payment_id text unique,
  checkout_url text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  stock_released_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null check (char_length(product_name) between 1 and 160),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

create index products_public_listing_idx on public.products (published, featured, created_at desc);
create index products_category_listing_idx on public.products (category_id, price);
create index categories_parent_idx on public.categories (parent_id);
create index site_banners_active_order_idx on public.site_banners (active, sort_order);
create index orders_owner_history_idx on public.orders (user_id, created_at desc);
create index order_items_order_idx on public.order_items (order_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger site_banners_updated_at before update on public.site_banners
for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'admin'::public.account_role
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Somente um administrador pode alterar papéis de usuário.';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role before update of role on public.profiles
for each row execute function public.protect_profile_role();

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.site_banners enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant select, update on public.profiles to authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.site_banners to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.coupons to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.site_banners to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.coupons to authenticated;

create policy "Users can read their own profile; admins can read all"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Users can update their own profile; admins can update all"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Anyone can read active categories"
on public.categories for select to anon, authenticated
using (active or (select public.is_admin()));

create policy "Anyone can read active banners"
on public.site_banners for select to anon, authenticated
using (active or (select public.is_admin()));

create policy "Only admins can manage banners"
on public.site_banners for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Anyone can read published products"
on public.products for select to anon, authenticated
using (published or (select public.is_admin()));

create policy "Only admins can create products"
on public.products for insert to authenticated
with check ((select public.is_admin()));

create policy "Only admins can update products"
on public.products for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Only admins can delete products"
on public.products for delete to authenticated
using ((select public.is_admin()));

create policy "Only admins can manage categories"
on public.categories for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Only admins can manage coupons"
on public.coupons for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Users can read their own orders; admins can read all"
on public.orders for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Users can read their own order items; admins can read all"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  )
  or (select public.is_admin())
);

create policy "Only admins can manage order items"
on public.order_items for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.order_status;
  allowed_transition boolean;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo não autorizado.';
  end if;

  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if current_status is null then
    raise exception 'Pedido não encontrado.';
  end if;

  allowed_transition := case current_status
    when 'awaiting_payment' then p_status = 'cancelled'
    when 'paid' then p_status in ('processing', 'cancelled')
    when 'processing' then p_status in ('shipped', 'cancelled')
    when 'shipped' then p_status = 'delivered'
    else false
  end;

  if not allowed_transition then
    raise exception 'Transição de status inválida. Confirme o pagamento pelo provedor antes de avançar o pedido.';
  end if;

  update public.orders
  set status = p_status
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_update_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.admin_update_order_status(uuid, public.order_status) to authenticated;

create function public.create_pending_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  requested record;
  product_record record;
  coupon_record public.coupons%rowtype;
  new_order public.orders%rowtype;
  line_records jsonb := '[]'::jsonb;
  subtotal_amount numeric(12, 2) := 0;
  discount_amount numeric(12, 2) := 0;
  shipping_amount numeric(12, 2) := 0;
  total_amount numeric(12, 2);
  quantity_total integer := 0;
  item_count integer := 0;
  normalized_coupon text;
  safe_address jsonb;
begin
  if current_user_id is null then
    raise exception 'Entre na sua conta antes de finalizar o pedido.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'O pedido deve conter entre 1 e 30 produtos.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as input_rows(item)
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'product_id') is distinct from 'string'
      or coalesce(item ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item -> 'quantity') is distinct from 'number'
      or coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]?$'
  ) then
    raise exception 'Um ou mais produtos ou quantidades do pedido são inválidos.';
  end if;

  if (
    select count(*) <> count(distinct (item ->> 'product_id')::uuid)
    from jsonb_array_elements(p_items) as input_rows(item)
  ) then
    raise exception 'Remova produtos duplicados e tente novamente.';
  end if;

  select sum((item ->> 'quantity')::integer)::integer into quantity_total
  from jsonb_array_elements(p_items) as input_rows(item);
  if quantity_total > 30 then
    raise exception 'O limite por pedido é de 30 unidades.';
  end if;

  if jsonb_typeof(p_shipping_address) <> 'object'
    or length(trim(coalesce(p_shipping_address ->> 'full_name', ''))) not between 2 and 120
    or coalesce(p_shipping_address ->> 'phone', '') !~ '^\+?[0-9][0-9 ()-]{7,19}$'
    or regexp_replace(coalesce(p_shipping_address ->> 'postal_code', ''), '\D', '', 'g') !~ '^[0-9]{8}$'
    or length(trim(coalesce(p_shipping_address ->> 'street', ''))) not between 2 and 160
    or length(trim(coalesce(p_shipping_address ->> 'number', ''))) not between 1 and 20
    or length(trim(coalesce(p_shipping_address ->> 'neighborhood', ''))) not between 2 and 100
    or length(trim(coalesce(p_shipping_address ->> 'city', ''))) not between 2 and 100
    or upper(coalesce(p_shipping_address ->> 'state', '')) !~ '^[A-Z]{2}$' then
    raise exception 'Confira os campos obrigatórios do endereço de entrega.';
  end if;

  safe_address := jsonb_build_object(
    'full_name', trim(p_shipping_address ->> 'full_name'),
    'phone', trim(p_shipping_address ->> 'phone'),
    'postal_code', regexp_replace(p_shipping_address ->> 'postal_code', '\D', '', 'g'),
    'street', trim(p_shipping_address ->> 'street'),
    'number', trim(p_shipping_address ->> 'number'),
    'complement', left(trim(coalesce(p_shipping_address ->> 'complement', '')), 100),
    'neighborhood', trim(p_shipping_address ->> 'neighborhood'),
    'city', trim(p_shipping_address ->> 'city'),
    'state', upper(trim(p_shipping_address ->> 'state'))
  );

  for requested in
    select (item ->> 'product_id')::uuid as product_id,
      (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as input_rows(item)
    order by (item ->> 'product_id')::uuid
  loop
    select id, name, price, stock into product_record
    from public.products
    where id = requested.product_id and published = true
    for update;

    if not found then
      raise exception 'Um produto do pedido não está mais disponível.';
    end if;
    if product_record.stock < requested.quantity then
      raise exception 'Estoque insuficiente para o produto "%".', product_record.name;
    end if;

    item_count := item_count + 1;
    subtotal_amount := subtotal_amount + product_record.price * requested.quantity;
    line_records := line_records || jsonb_build_array(jsonb_build_object(
      'product_id', product_record.id,
      'product_name', product_record.name,
      'unit_price', product_record.price,
      'quantity', requested.quantity
    ));
  end loop;

  normalized_coupon := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  if normalized_coupon is not null then
    select * into coupon_record
    from public.coupons
    where code = normalized_coupon
      and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (max_uses is null or uses < max_uses)
    for update;

    if not found then
      raise exception 'Cupom inválido, expirado ou sem usos disponíveis.';
    end if;
    if subtotal_amount < coupon_record.minimum_subtotal then
      raise exception 'O pedido não alcançou o valor mínimo deste cupom.';
    end if;
    discount_amount := case coupon_record.discount_type
      when 'percentage' then round(subtotal_amount * coupon_record.discount_value / 100, 2)
      else least(subtotal_amount, coupon_record.discount_value)
    end;
    if discount_amount >= subtotal_amount then
      raise exception 'O valor do cupom precisa ser menor que o subtotal do pedido.';
    end if;
  end if;

  shipping_amount := case when subtotal_amount >= 299 then 0 else 18.90 end;
  total_amount := subtotal_amount + shipping_amount - discount_amount;

  insert into public.orders (
    user_id, status, payment_status, subtotal, shipping_amount, discount_amount,
    total, shipping_address, coupon_id
  ) values (
    current_user_id,
    'awaiting_payment',
    'pending',
    subtotal_amount,
    shipping_amount,
    discount_amount,
    total_amount,
    safe_address,
    coupon_record.id
  )
  returning * into new_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
  select new_order.id,
    (item ->> 'product_id')::uuid,
    item ->> 'product_name',
    (item ->> 'unit_price')::numeric,
    (item ->> 'quantity')::integer
  from jsonb_array_elements(line_records) as order_lines(item);

  update public.products as product
  set stock = product.stock - (item ->> 'quantity')::integer
  from jsonb_array_elements(line_records) as order_lines(item)
  where product.id = (item ->> 'product_id')::uuid;

  if coupon_record.id is not null then
    update public.coupons set uses = uses + 1 where id = coupon_record.id;
  end if;

  return jsonb_build_object(
    'order_id', new_order.id,
    'order_number', new_order.order_number,
    'subtotal', new_order.subtotal,
    'discount_amount', new_order.discount_amount,
    'shipping_amount', new_order.shipping_amount,
    'total', new_order.total,
    'expires_at', new_order.expires_at,
    'items', line_records
  );
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.create_pending_order(jsonb, jsonb, text) to authenticated;

create function public.release_pending_order(
  p_order_id uuid,
  p_payment_status public.payment_status default 'rejected'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_payment_status not in ('rejected', 'pending') then
    raise exception 'Status de pagamento inválido para liberar estoque.';
  end if;

  select * into order_record
  from public.orders
  where id = p_order_id
  for update;

  if not found or order_record.status <> 'awaiting_payment' or order_record.stock_released_at is not null then
    return;
  end if;

  update public.products as product
  set stock = product.stock + order_item.quantity
  from public.order_items as order_item
  where order_item.order_id = order_record.id
    and order_item.product_id = product.id;

  if order_record.coupon_id is not null then
    update public.coupons
    set uses = greatest(uses - 1, 0)
    where id = order_record.coupon_id;
  end if;

  update public.orders
  set status = 'cancelled',
      payment_status = p_payment_status,
      stock_released_at = now()
  where id = order_record.id;
end;
$$;

revoke all on function public.release_pending_order(uuid, public.payment_status) from public, anon, authenticated;
grant execute on function public.release_pending_order(uuid, public.payment_status) to service_role;

create function public.release_expired_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_order record;
  order_item record;
  released_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'Acesso não autorizado.';
  end if;

  for expired_order in
    select id, coupon_id
    from public.orders
    where status = 'awaiting_payment'
      and stock_released_at is null
      and expires_at <= now()
    order by expires_at
    for update skip locked
    limit 100
  loop
    for order_item in
      select product_id, quantity
      from public.order_items
      where order_id = expired_order.id and product_id is not null
      order by product_id
    loop
      update public.products
      set stock = stock + order_item.quantity
      where id = order_item.product_id;
    end loop;

    if expired_order.coupon_id is not null then
      update public.coupons
      set uses = greatest(uses - 1, 0)
      where id = expired_order.coupon_id;
    end if;

    update public.orders
    set status = 'cancelled',
        payment_status = 'rejected',
        stock_released_at = now()
    where id = expired_order.id;
    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$$;

revoke all on function public.release_expired_orders() from public, anon, authenticated;
grant execute on function public.release_expired_orders() to service_role, postgres;

select cron.schedule(
  'vitrine-release-expired-orders',
  '* * * * *',
  'select public.release_expired_orders();'
);

create function public.apply_mercadopago_payment(
  p_order_id uuid,
  p_payment_id text,
  p_status text,
  p_transaction_amount numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_payment_id !~ '^[0-9]{1,30}$' then
    raise exception 'Identificador de pagamento inválido.';
  end if;

  select * into order_record
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if order_record.provider_payment_id = p_payment_id
    and order_record.payment_status = 'approved' then
    return;
  end if;

  if order_record.provider_payment_id = p_payment_id
    and order_record.status <> 'awaiting_payment' then
    return;
  end if;

  if order_record.status <> 'awaiting_payment' then
    raise exception 'O pedido não aceita novas alterações de pagamento.';
  end if;
  if order_record.provider_payment_id is not null
    and order_record.provider_payment_id <> p_payment_id then
    raise exception 'O pedido já está vinculado a outro pagamento.';
  end if;

  if p_status = 'approved' then
    if upper(coalesce(p_currency, '')) <> 'BRL' or p_transaction_amount <> order_record.total then
      raise exception 'O valor ou a moeda do pagamento não corresponde ao pedido.';
    end if;
    if order_record.stock_released_at is not null then
      raise exception 'A reserva do pedido expirou; é necessária uma nova tentativa de compra.';
    end if;
    update public.orders
    set payment_status = 'approved',
        status = 'paid',
        payment_provider = 'mercadopago',
        provider_payment_id = p_payment_id,
        paid_at = now()
    where id = order_record.id;
  elsif p_status in ('rejected', 'cancelled') then
    update public.orders
    set payment_provider = 'mercadopago',
        provider_payment_id = p_payment_id
    where id = order_record.id;
    perform public.release_pending_order(order_record.id, 'rejected');
  elsif p_status = 'refunded' then
    if order_record.payment_status <> 'approved' then
      raise exception 'Não é possível reembolsar um pagamento não aprovado.';
    end if;
    update public.orders
    set payment_status = 'refunded',
        status = 'refunded',
        payment_provider = 'mercadopago',
        provider_payment_id = p_payment_id
    where id = order_record.id;
  elsif p_status in ('pending', 'in_process', 'in_mediation') then
    update public.orders
    set payment_provider = 'mercadopago',
        provider_payment_id = p_payment_id
    where id = order_record.id;
  else
    raise exception 'Status de pagamento não reconhecido.';
  end if;
end;
$$;

revoke all on function public.apply_mercadopago_payment(uuid, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.apply_mercadopago_payment(uuid, text, text, numeric, text) to service_role;

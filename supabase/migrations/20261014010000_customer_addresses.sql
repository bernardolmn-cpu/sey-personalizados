create table public.customer_addresses (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9][0-9 ()-]{7,19}$'),
  postal_code text not null check (regexp_replace(postal_code, '\D', '', 'g') ~ '^[0-9]{8}$'),
  street text not null check (char_length(street) between 2 and 160),
  number text not null check (char_length(number) between 1 and 20),
  complement text not null default '' check (char_length(complement) <= 100),
  neighborhood text not null check (char_length(neighborhood) between 2 and 100),
  city text not null check (char_length(city) between 2 and 100),
  state text not null check (upper(state) ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_owner_idx
on public.customer_addresses (user_id, is_default desc, created_at desc);

create unique index customer_addresses_one_default_per_user_idx
on public.customer_addresses (user_id)
where is_default;

create trigger customer_addresses_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

create function public.set_customer_address_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.customer_addresses
    set is_default = false
    where user_id = new.user_id
      and id is distinct from new.id
      and is_default;
  end if;
  return new;
end;
$$;

create trigger customer_addresses_default
before insert or update on public.customer_addresses
for each row execute function public.set_customer_address_default();

revoke all on function public.set_customer_address_default() from public, anon, authenticated;

alter table public.customer_addresses enable row level security;

grant select, insert, update, delete on public.customer_addresses to authenticated;

create policy "Users can read their own saved addresses"
on public.customer_addresses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own saved addresses"
on public.customer_addresses for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved addresses"
on public.customer_addresses for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved addresses"
on public.customer_addresses for delete to authenticated
using ((select auth.uid()) = user_id);

alter table public.store_settings
add column hero_title text not null default 'Cartonagem e papelaria para suas ideias.'
  check (char_length(hero_title) between 1 and 180),
add column hero_description text not null default 'Peças personalizadas para organizar, criar e presentear em cada ocasião.'
  check (char_length(hero_description) <= 500);

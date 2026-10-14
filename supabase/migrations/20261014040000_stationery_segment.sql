update public.store_settings
set hero_title = case
      when hero_title = 'Personalize do seu jeito.' then 'Cartonagem e papelaria para suas ideias.'
      else hero_title
    end,
    hero_description = case
      when hero_description = 'Ideias com a sua identidade, para presentear ou deixar cada momento ainda mais seu.'
        then 'Peças personalizadas para organizar, criar e presentear em cada ocasião.'
      else hero_description
    end,
    tagline = case
      when tagline = '' then 'Cartonagem e papelaria personalizada para organizar, criar e presentear.'
      else tagline
    end
where id = true
  and (
    (hero_title = 'Personalize do seu jeito.'
      and hero_description = 'Ideias com a sua identidade, para presentear ou deixar cada momento ainda mais seu.')
    or tagline = ''
  );

insert into public.categories (name, slug)
values
  ('Cartonagem', 'cartonagem'),
  ('Papelaria personalizada', 'papelaria-personalizada'),
  ('Cadernos e planners', 'cadernos-e-planners'),
  ('Caixas e embalagens', 'caixas-e-embalagens'),
  ('Álbuns e memórias', 'albuns-e-memorias'),
  ('Kits para presente', 'kits-para-presente')
on conflict do nothing;

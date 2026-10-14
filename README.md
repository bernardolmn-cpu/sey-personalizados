# SEY PERSONALIZADOS — loja online

Loja responsiva SEY PERSONALIZADOS, focada em cartonagem e papelaria personalizada, em React, TypeScript e Vite. O projeto inclui catálogo conectado ao Supabase, autenticação, políticas RLS, painel administrativo, configuração da marca, categorias dinâmicas, páginas institucionais, FAQ, reserva transacional de estoque, cupons e histórico de pedidos.

> **Mercado Pago pendente.** O checkout está desativado por padrão. Não cadastre credenciais de pagamento agora: finalize primeiro Supabase, Auth, catálogo, endereços e testes. Nenhum cartão é processado nem armazenado pela loja.

## Requisitos

- Node.js 22.12+ (ou 24.x)
- npm
- Uma conta/projeto Supabase para habilitar dados, login e compras
- Credenciais do Mercado Pago para habilitar pagamentos; use credenciais de teste antes da produção

## Executar a interface de demonstração

```bash
npm install
npm run dev
```

O servidor Vite informa a URL local. A demonstração tem busca, filtros, ordenação, favoritos e carrinho salvo no navegador; pedidos e pagamentos não são criados enquanto as integrações não estiverem configuradas.

## Validar e compilar

```bash
npm run typecheck
npm test
npm run build
npm run preview
npm audit
```

## Configurar o Supabase

1. Crie um projeto Supabase e copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública/anon do projeto. Essas são as únicas chaves permitidas no navegador.
3. Instale/execute a Supabase CLI e aplique todas as migrations (incluindo a tabela de endereços salvos):

   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```

4. Em **Authentication → URL Configuration**, defina `http://localhost:5173` como **Site URL** e permita os redirecionamentos locais `http://localhost:5173/**` e `http://127.0.0.1:5173/**`, além do domínio HTTPS de produção. Mantenha a confirmação por e-mail habilitada em produção.
5. Crie sua conta em `/conta`, confirme o e-mail e promova somente a conta proprietária inicial a administradora pelo SQL Editor do Supabase:

   ```sql
   update public.profiles
   set role = 'admin'
   where user_id in (
     select id from auth.users where email = 'SEU_EMAIL_DE_ADMIN'
   );
   ```

   Não existe cadastro público de administradores. A função é armazenada no banco e protegida contra alteração pelo próprio usuário; o painel e as políticas RLS consultam essa função no servidor.

As migrations em `supabase/migrations/` criam perfis, categorias/subcategorias, produtos, banners, cupons, pedidos e itens. O RLS limita dados de perfil e pedidos aos respectivos clientes e exige o papel de administrador para operações de gestão. O banco calcula preços, cupons e frete; valores enviados pelo navegador não são considerados autoritativos.

Endereços salvos ficam em uma tabela separada protegida por RLS. Cada cliente pode ler e alterar somente os próprios endereços; um único endereço pode ser marcado como padrão. O checkout pode carregar endereços salvos, mas não aceita compras até a integração de pagamento ser ativada.

A migration `20261014020000_store_content.sql` instala a identidade da loja e as tabelas de páginas institucionais e FAQ; `20261014030000_brand_home_copy.sql` acrescenta campos editáveis para o texto da página inicial. O painel **Marca e conteúdo** permite alterar nome, faixa, frase, logotipo por URL HTTPS, contatos, apresentação inicial, textos de páginas e FAQ. Páginas e perguntas permanecem em rascunho até serem publicadas. As categorias ativas são exibidas dinamicamente na navegação e no catálogo.

A migration `20261014040000_stationery_segment.sql` atualiza o texto inicial padrão para cartonagem e papelaria e cria categorias iniciais para cartonagem, papelaria personalizada, cadernos e planners, caixas e embalagens, álbuns e memórias e kits para presente. Você pode renomear, desativar ou complementar essas categorias pelo painel. Os produtos de exemplo usados sem Supabase são ilustrativos; cadastre seus produtos e preços reais antes de vender.

A logo enviada da SEY fica em `public/logo-sey-personalizados.png` e é usada no cabeçalho, rodapé, prévia de marca e favicon. A paleta do site usa rosa da marca com tons ameixa escuros para preservar o contraste. Uma URL pública HTTPS cadastrada no painel pode substituir a imagem padrão.

## Mercado Pago — configuração pendente

O checkout permanece bloqueado. **Não configure token/segredo agora.** Depois de concluir o setup do Supabase e aprovar os testes, configure o Checkout Pro seguindo estes passos:

1. Cadastre/configure as URLs de retorno no Mercado Pago e crie uma URL de webhook para o evento **payment** em:

   ```text
   https://SEU_PROJETO.supabase.co/functions/v1/mercadopago-webhook
   ```

2. Copie a assinatura secreta do webhook e use um token de teste do Mercado Pago primeiro.
3. Cadastre as variáveis **como secrets das Edge Functions**, não no `.env.local` do Vite:

   ```bash
   npx supabase secrets set SITE_URL=http://localhost:5173 MP_ACCESS_TOKEN=SEU_TOKEN_DE_TESTE MP_WEBHOOK_SECRET=SUA_ASSINATURA_SECRETA
   ```

   Em produção, `SITE_URL` deve ser o domínio HTTPS público. O URL, a chave pública e a chave `service_role` do Supabase são fornecidos às Edge Functions pelo ambiente Supabase; **nunca copie `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` ou `MP_WEBHOOK_SECRET` para `VITE_*` ou para arquivos do frontend.**

4. Publique as funções:

   ```bash
   npx supabase functions deploy create-checkout
   npx supabase functions deploy mercadopago-webhook
   ```

   `create-checkout` exige JWT válido. O webhook aceita chamadas sem JWT, mas verifica o HMAC `x-signature`, consulta o pagamento diretamente à API oficial do Mercado Pago, compara o checkout, o pedido, o valor e a moeda e só então atualiza o pedido. Assinaturas/valores divergentes não confirmam compras.

5. Somente depois de confirmar as credenciais e as Edge Functions, defina `VITE_CHECKOUT_ENABLED=true` no ambiente de build e recompile. A chave de ambiente apenas habilita a interface; não substitui a validação de segredos no backend.

A migration reserva o estoque enquanto o pagamento está pendente, libera reservas expiradas em uma tarefa `pg_cron` por minuto e torna a atualização de status de pagamento idempotente. O checkout cria preferências no servidor; o cliente recebe apenas a URL segura do Mercado Pago. Não são aceitos dados de cartão no site.

Documentação oficial: [Mercado Pago — preferências do Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/create-payment-preference), [Mercado Pago — Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks) e [Supabase — secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets).

## Executar Supabase local

Para testar Auth, migrations e Edge Functions sem publicar, instale Docker Desktop e a Supabase CLI:

```bash
npx supabase start
npx supabase functions serve --env-file supabase/functions/.env
```

Copie `supabase/functions/.env.example` para `supabase/functions/.env` e substitua os placeholders por **credenciais de teste**. Esse arquivo é ignorado pelo Git. O runtime Edge local também precisa da configuração `SITE_URL` correspondente à origem local.

## Estrutura

```text
marketplace/
├── src/
│   ├── components/       # Navegação, catálogo, layout e endereços salvos
│   ├── context/          # Sessão, favoritos, carrinho e marca/categorias
│   ├── data/             # Itens exclusivamente demonstrativos
│   ├── hooks/            # Carregamento do catálogo e banner
│   ├── integrations/     # Cliente público do Supabase
│   ├── pages/            # Loja, conta, conteúdo institucional, pedidos e painel admin
│   ├── services/         # Auth e integração de checkout
│   ├── types/            # Tipos da aplicação
│   └── styles.css
├── supabase/
│   ├── functions/        # Criação de checkout e webhook assinado
│   └── migrations/       # Esquema, RLS, pedidos, marca e conteúdo
├── tests/                # Testes de preços e HMAC
├── .env.example
└── README.md
```

## Transparência de dados

- Sem `.env.local`, a aplicação serve exemplos de produtos, preços, estoque e avaliações; os rótulos de demonstração são visíveis.
- Com Supabase configurado, o catálogo e os banners vêm do banco. Falhas de conexão são exibidas, não substituídas silenciosamente por dados fictícios.
- Clientes leem somente os próprios pedidos e itens conforme políticas RLS. O painel limita dados de contato de outros clientes.
- Checkout e pagamentos reais dependem de configuração externa e credenciais próprias do operador da loja.

## Publicação

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Publique `dist/` em uma hospedagem estática com fallback de rotas SPA para `index.html`. Configure domínio HTTPS, URLs de autenticação/retorno, secrets de produção e webhook no provedor de pagamento antes de habilitar vendas.

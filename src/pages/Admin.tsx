import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Check, ChevronDown, CircleDollarSign, ClipboardList, FileText, Image, LayoutDashboard, PackagePlus, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import AdminStoreContent from '../components/AdminStoreContent'
import Brand from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { supabase } from '../integrations/supabase/client'
import type { Database } from '../types/database'

type Category = { id: string; name: string; slug: string; active: boolean; parent_id: string | null }
type ProductRow = { id: string; name: string; slug: string; description: string; image_url: string; category_id: string | null; price: number; compare_at_price: number | null; stock: number; featured: boolean; published: boolean }
type OrderRow = { id: string; order_number: string; status: Database['public']['Enums']['order_status']; payment_status: string; total: number; created_at: string; shipping_address: unknown }
type ProfileRow = { user_id: string; full_name: string; role: string }
type CouponRow = { id: string; code: string; discount_type: string; discount_value: number; active: boolean; uses: number; max_uses: number | null }
type BannerRow = { id: string; eyebrow: string; title: string; description: string; image_url: string; cta_label: string; destination: string; active: boolean; sort_order: number }
type ProductValues = { name: string; category_id: string; description: string; image_url: string; price: number; compare_at_price?: number; stock: number; featured: boolean; published: boolean }
type CategoryValues = { name: string; parent_id: string }
type CouponValues = { code: string; discount_type: 'percentage' | 'fixed'; discount_value: number; max_uses?: number }
type BannerValues = { eyebrow: string; title: string; description: string; image_url: string; cta_label: string; destination: string; active: boolean; sort_order: number }

const productSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(160),
  category_id: z.string(),
  description: z.string().max(5000),
  image_url: z.union([z.literal(''), z.url('Informe uma URL válida para a imagem.')]),
  price: z.number().finite().min(0, 'O preço não pode ser negativo.'),
  compare_at_price: z.number().finite().min(0).optional(),
  stock: z.number().int().min(0, 'O estoque não pode ser negativo.'),
  featured: z.boolean(),
  published: z.boolean(),
}).refine((values) => values.compare_at_price === undefined || values.compare_at_price >= values.price, {
  message: 'O preço anterior deve ser igual ou maior que o preço atual.',
  path: ['compare_at_price'],
})
const categorySchema = z.object({ name: z.string().trim().min(2).max(80), parent_id: z.string() })
const bannerSchema = z.object({
  eyebrow: z.string().max(100),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(500),
  image_url: z.url().refine((value) => value.startsWith('https://'), 'Use uma URL HTTPS para a imagem.'),
  cta_label: z.string().trim().min(1).max(40),
  destination: z.string().regex(/^\/(?!\/)/, 'Use uma rota interna, por exemplo /catalogo.'),
  active: z.boolean(),
  sort_order: z.number().int(),
})
const couponSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use apenas letras, números, hífen ou sublinhado.'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().finite().positive('O desconto deve ser maior que zero.'),
  max_uses: z.number().int().positive().optional(),
}).refine((values) => values.discount_type !== 'percentage' || values.discount_value <= 100, {
  message: 'Desconto percentual máximo: 100%.',
  path: ['discount_value'],
})

const statusLabels: Record<Database['public']['Enums']['order_status'], string> = {
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  processing: 'Em preparação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}

type Panel = 'overview' | 'products' | 'orders' | 'customers' | 'coupons' | 'banners' | 'content'

function requireSupabase() {
  if (!supabase) throw new Error('Configure o Supabase para usar o painel administrativo.')
  return supabase
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getError(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status as keyof typeof statusLabels] ?? status}</span>
}

export default function Admin() {
  const { role, loading: authLoading, session } = useAuth()
  const { refresh: refreshStore } = useStore()
  const [panel, setPanel] = useState<Panel>('overview')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customers, setCustomers] = useState<ProfileRow[]>([])
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [banners, setBanners] = useState<BannerRow[]>([])
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const productForm = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', category_id: '', description: '', image_url: '', price: 0, compare_at_price: undefined, stock: 0, featured: false, published: false },
  })
  const categoryForm = useForm<CategoryValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: '', parent_id: '' } })
  const couponForm = useForm<CouponValues>({ resolver: zodResolver(couponSchema), defaultValues: { code: '', discount_type: 'percentage', discount_value: 10, max_uses: undefined } })
  const bannerForm = useForm<BannerValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { eyebrow: '', title: '', description: '', image_url: '', cta_label: 'Descobrir', destination: '/catalogo', active: false, sort_order: 0 },
  })

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const client = requireSupabase()
      const [productResult, categoryResult, orderResult, customerResult, couponResult, bannerResult] = await Promise.all([
        client.from('products').select('id,name,slug,description,image_url,category_id,price,compare_at_price,stock,featured,published').order('created_at', { ascending: false }),
        client.from('categories').select('id,name,slug,active,parent_id').order('name'),
        client.from('orders').select('id,order_number,status,payment_status,total,created_at,shipping_address').order('created_at', { ascending: false }).limit(100),
        client.from('profiles').select('user_id,full_name,role').order('created_at', { ascending: false }).limit(100),
        client.from('coupons').select('id,code,discount_type,discount_value,active,uses,max_uses').order('created_at', { ascending: false }),
        client.from('site_banners').select('id,eyebrow,title,description,image_url,cta_label,destination,active,sort_order').order('sort_order'),
      ])
      assertNoError(productResult.error)
      assertNoError(categoryResult.error)
      assertNoError(orderResult.error)
      assertNoError(customerResult.error)
      assertNoError(couponResult.error)
      assertNoError(bannerResult.error)
      setProducts((productResult.data ?? []) as ProductRow[])
      setCategories((categoryResult.data ?? []) as Category[])
      setOrders((orderResult.data ?? []) as OrderRow[])
      setCustomers((customerResult.data ?? []) as ProfileRow[])
      setCoupons((couponResult.data ?? []) as CouponRow[])
      setBanners((bannerResult.data ?? []) as BannerRow[])
    } catch (loadError) {
      setError(getError(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && role === 'admin') void loadDashboard()
  }, [authLoading, loadDashboard, role])

  const paidOrders = useMemo(() => orders.filter((order) => ['approved'].includes(order.payment_status)), [orders])
  const revenue = useMemo(() => paidOrders.reduce((sum, order) => sum + Number(order.total), 0), [paidOrders])
  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setDate(1)
      date.setMonth(date.getMonth() - (5 - index))
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date), value: 0 }
    })
    for (const order of paidOrders) {
      const date = new Date(order.created_at)
      const month = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`)
      if (month) month.value += Number(order.total)
    }
    const max = Math.max(1, ...months.map((month) => month.value))
    return months.map((month) => ({ ...month, height: Math.max(3, month.value / max * 100) }))
  }, [paidOrders])

  async function refresh(message?: string) {
    if (message) setNotice(message)
    await loadDashboard()
  }

  async function saveProduct(values: ProductValues) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const client = requireSupabase()
      const data = productSchema.parse(values)
      const record = {
        name: data.name,
        slug: slugify(data.name),
        category_id: data.category_id || null,
        description: data.description,
        image_url: data.image_url,
        price: data.price,
        compare_at_price: data.compare_at_price ?? null,
        stock: data.stock,
        featured: data.featured,
        published: data.published,
      }
      const result = editingProduct
        ? await client.from('products').update(record).eq('id', editingProduct.id)
        : await client.from('products').insert(record)
      assertNoError(result.error)
      setEditingProduct(null)
      productForm.reset({ name: '', category_id: '', description: '', image_url: '', price: 0, compare_at_price: undefined, stock: 0, featured: false, published: false })
      setNotice(editingProduct ? 'Produto atualizado.' : 'Produto cadastrado.')
      await loadDashboard()
    } catch (saveError) {
      setError(getError(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function deleteProduct(product: ProductRow) {
    if (!window.confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) return
    setBusy(true)
    setError('')
    try {
      const { error: deleteError } = await requireSupabase().from('products').delete().eq('id', product.id)
      assertNoError(deleteError)
      setNotice('Produto excluído.')
      await loadDashboard()
    } catch (deleteError) {
      setError(getError(deleteError))
    } finally {
      setBusy(false)
    }
  }

  async function saveCategory(values: CategoryValues) {
    setBusy(true)
    setError('')
    try {
      const name = categorySchema.parse(values).name
      const parentId = categoryForm.getValues('parent_id')
      const { error: insertError } = await requireSupabase().from('categories').insert({ name, slug: slugify(name), parent_id: parentId || null })
      assertNoError(insertError)
      categoryForm.reset({ name: '', parent_id: '' })
      setNotice(parentId ? 'Subcategoria criada.' : 'Categoria criada.')
      await loadDashboard()
      await refreshStore()
    } catch (saveError) {
      setError(getError(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleCategory(category: Category) {
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await requireSupabase().from('categories').update({ active: !category.active }).eq('id', category.id)
      assertNoError(updateError)
      setNotice(category.active ? 'Categoria desativada.' : 'Categoria ativada.')
      await loadDashboard()
      await refreshStore()
    } catch (updateError) {
      setError(getError(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function renameCategory(category: Category) {
    const proposedName = window.prompt('Novo nome da categoria:', category.name)
    if (proposedName === null || proposedName.trim() === category.name) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { name } = categorySchema.parse({ name: proposedName, parent_id: category.parent_id ?? '' })
      const { error: updateError } = await requireSupabase().from('categories')
        .update({ name, slug: slugify(name) })
        .eq('id', category.id)
      assertNoError(updateError)
      setNotice('Categoria atualizada.')
      await loadDashboard()
      await refreshStore()
    } catch (updateError) {
      setError(getError(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function updateOrderStatus(orderId: string, status: Database['public']['Enums']['order_status']) {
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await requireSupabase().rpc('admin_update_order_status', { p_order_id: orderId, p_status: status })
      assertNoError(updateError)
      setNotice('Status do pedido atualizado.')
      await loadDashboard()
    } catch (updateError) {
      setError(getError(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function saveCoupon(values: CouponValues) {
    setBusy(true)
    setError('')
    try {
      const data = couponSchema.parse(values)
      const { error: insertError } = await requireSupabase().from('coupons').insert({
        code: data.code.trim().toUpperCase(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses ?? null,
      })
      assertNoError(insertError)
      couponForm.reset({ code: '', discount_type: 'percentage', discount_value: 10, max_uses: undefined })
      setNotice('Cupom criado.')
      await loadDashboard()
    } catch (saveError) {
      setError(getError(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleCoupon(coupon: CouponRow) {
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await requireSupabase().from('coupons').update({ active: !coupon.active }).eq('id', coupon.id)
      assertNoError(updateError)
      setNotice(coupon.active ? 'Cupom desativado.' : 'Cupom ativado.')
      await loadDashboard()
    } catch (updateError) {
      setError(getError(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function saveBanner(values: BannerValues) {
    setBusy(true)
    setError('')
    try {
      const banner = bannerSchema.parse(values)
      const { error: insertError } = await requireSupabase().from('site_banners').insert(banner)
      assertNoError(insertError)
      bannerForm.reset({ eyebrow: '', title: '', description: '', image_url: '', cta_label: 'Descobrir', destination: '/catalogo', active: false, sort_order: 0 })
      setNotice('Banner cadastrado.')
      await loadDashboard()
    } catch (saveError) {
      setError(getError(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleBanner(banner: BannerRow) {
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await requireSupabase().from('site_banners').update({ active: !banner.active }).eq('id', banner.id)
      assertNoError(updateError)
      setNotice(banner.active ? 'Banner desativado.' : 'Banner ativado.')
      await loadDashboard()
    } catch (updateError) {
      setError(getError(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function deleteBanner(banner: BannerRow) {
    if (!window.confirm(`Excluir o banner "${banner.title}"?`)) return
    setBusy(true)
    setError('')
    try {
      const { error: deleteError } = await requireSupabase().from('site_banners').delete().eq('id', banner.id)
      assertNoError(deleteError)
      setNotice('Banner excluído.')
      await loadDashboard()
    } catch (deleteError) {
      setError(getError(deleteError))
    } finally {
      setBusy(false)
    }
  }

  function editProduct(product: ProductRow) {
    setEditingProduct(product)
    productForm.reset({
      name: product.name,
      category_id: product.category_id ?? '',
      description: product.description,
      image_url: product.image_url,
      price: Number(product.price),
      compare_at_price: product.compare_at_price === null ? undefined : Number(product.compare_at_price),
      stock: product.stock,
      featured: product.featured,
      published: product.published,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (authLoading) return <main className="admin-loading page-shell" role="status">Verificando acesso seguro…</main>
  if (!session) return <main className="admin-loading page-shell"><h1>Entre para continuar.</h1><p>O painel administrativo exige uma conta autorizada.</p><Link className="button button-dark" to="/conta">Acessar minha conta</Link></main>
  if (role !== 'admin') return <main className="admin-loading page-shell"><ShieldCheck size={32} /><h1>Acesso restrito.</h1><p>Esta área está disponível somente para usuários autorizados como administradores.</p><Link className="button button-dark" to="/">Voltar à loja</Link></main>

  const tabs: { id: Panel; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'products', label: 'Produtos', icon: Box },
    { id: 'orders', label: 'Pedidos', icon: ClipboardList },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'coupons', label: 'Cupons', icon: CircleDollarSign },
    { id: 'banners', label: 'Banners', icon: Image },
    { id: 'content', label: 'Marca e conteúdo', icon: FileText },
  ]

  return (
    <main className="admin-page">
      <header className="admin-header"><Brand /><div><span>{session.user.email}</span><Link to="/">Voltar à loja</Link></div></header>
      <div className="admin-layout">
        <aside className="admin-sidebar"><span className="eyebrow">GESTÃO DA SEY</span><h1>Painel<br />administrativo</h1><nav aria-label="Seções administrativas">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={panel === id ? 'admin-tab admin-tab-active' : 'admin-tab'} onClick={() => { setPanel(id); setError(''); setNotice('') }}><Icon size={17} />{label}{id === 'orders' && orders.filter((order) => order.status === 'awaiting_payment').length > 0 && <span className="admin-tab-count">{orders.filter((order) => order.status === 'awaiting_payment').length}</span>}</button>)}</nav><div className="admin-security-note"><ShieldCheck size={17} /><span>Permissões validadas no banco de dados.</span></div></aside>
        <section className="admin-content">
          <div className="admin-page-heading"><div><span className="eyebrow">{tabs.find((tab) => tab.id === panel)?.label.toUpperCase()}</span><h2>{panel === 'overview' ? `Olá, ${session.user.user_metadata.full_name ?? 'administrador'}.` : tabs.find((tab) => tab.id === panel)?.label}</h2></div><button className="admin-refresh" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Atualizar</button></div>
          {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
          {notice && <div className="admin-alert admin-alert-success" role="status"><Check size={16} />{notice}</div>}
          {loading && <div className="admin-loading-inline" role="status">Carregando dados do banco…</div>}
          {!loading && panel === 'overview' && <section className="admin-overview">
            <div className="admin-stat-grid"><article className="admin-stat"><span><Box size={16} /> Produtos publicados</span><strong>{products.filter((product) => product.published).length}</strong><small>{products.length} cadastrados</small></article><article className="admin-stat"><span><ClipboardList size={16} /> Pedidos</span><strong>{orders.length}</strong><small>{orders.filter((order) => order.status === 'awaiting_payment').length} aguardando</small></article><article className="admin-stat"><span><CircleDollarSign size={16} /> Vendas aprovadas</span><strong>{formatPrice(revenue)}</strong><small>{paidOrders.length} pagamento(s) confirmado(s)</small></article><article className="admin-stat"><span><Users size={16} /> Clientes</span><strong>{customers.filter((customer) => customer.role === 'customer').length}</strong><small>contas registradas</small></article></div>
            <div className="admin-dashboard-grid"><article className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">ÚLTIMOS 6 MESES</span><h3>Vendas aprovadas</h3></div></div><div className="admin-chart" role="img" aria-label="Gráfico de vendas aprovadas nos últimos seis meses">{chartData.map((month) => <div className="admin-chart-column" key={month.key}><span>{month.value ? formatPrice(month.value) : '—'}</span><div className="admin-chart-track"><i style={{ height: `${month.height}%` }} /></div><small>{month.label}</small></div>)}</div></article><article className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h3>Pedidos recentes</h3></div><button onClick={() => setPanel('orders')}>Ver todos</button></div>{orders.slice(0, 4).map((order) => <div className="admin-mini-order" key={order.id}><span><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString('pt-BR')}</small></span><span><StatusBadge status={order.status} /><strong>{formatPrice(Number(order.total))}</strong></span></div>)}{orders.length === 0 && <p className="admin-empty">Pedidos aparecerão aqui após integrar o checkout seguro.</p>}</article></div>
          </section>}
          {!loading && panel === 'content' && <AdminStoreContent />}
          {!loading && panel === 'products' && <section className="admin-products-panel">
            <div className="admin-panel admin-editor"><div className="admin-panel-heading"><div><span className="eyebrow">{editingProduct ? 'EDIÇÃO' : 'NOVO CADASTRO'}</span><h3>{editingProduct ? 'Editar produto' : 'Adicionar produto'}</h3></div>{editingProduct && <button className="admin-icon-button" onClick={() => { setEditingProduct(null); productForm.reset() }} aria-label="Cancelar edição"><X size={17} /></button>}</div>
              <form className="admin-form" onSubmit={productForm.handleSubmit(saveProduct)}>
                <label>Nome do produto<input {...productForm.register('name')} placeholder="Ex.: Caneca artesanal" />{productForm.formState.errors.name && <small>{productForm.formState.errors.name.message}</small>}</label>
                <div className="admin-form-grid"><label>Categoria<select {...productForm.register('category_id')}><option value="">Sem categoria</option>{categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Estoque<input type="number" min="0" step="1" {...productForm.register('stock', { valueAsNumber: true })} />{productForm.formState.errors.stock && <small>{productForm.formState.errors.stock.message}</small>}</label></div>
                <label>Descrição<textarea rows={3} {...productForm.register('description')} placeholder="Conte a história desta peça." /></label>
                <label>URL da imagem<input type="url" {...productForm.register('image_url')} placeholder="https://..." />{productForm.formState.errors.image_url && <small>{productForm.formState.errors.image_url.message}</small>}</label>
                <div className="admin-form-grid"><label>Preço (R$)<input type="number" min="0" step="0.01" {...productForm.register('price', { valueAsNumber: true })} />{productForm.formState.errors.price && <small>{productForm.formState.errors.price.message}</small>}</label><label>Preço anterior (R$)<input type="number" min="0" step="0.01" {...productForm.register('compare_at_price', { setValueAs: (value: string) => value === '' ? undefined : Number(value) })} />{productForm.formState.errors.compare_at_price && <small>{productForm.formState.errors.compare_at_price.message}</small>}</label></div>
                <div className="admin-checks"><label><input type="checkbox" {...productForm.register('published')} /> Publicado na loja</label><label><input type="checkbox" {...productForm.register('featured')} /> Em destaque</label></div>
                <button className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : <>{editingProduct ? 'Salvar alterações' : 'Cadastrar produto'} <PackagePlus size={16} /></>}</button>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">{products.length} ITENS</span><h3>Produtos cadastrados</h3></div></div>{products.length === 0 && <p className="admin-empty">Cadastre o primeiro produto de cartonagem ou papelaria.</p>}{products.map((product) => <article className="admin-product-row" key={product.id}><div><strong>{product.name}</strong><span>{categories.find((category) => category.id === product.category_id)?.name ?? 'Sem categoria'} · {formatPrice(Number(product.price))} · estoque {product.stock}</span></div><div><span className={`product-visibility ${product.published ? 'is-published' : ''}`}>{product.published ? 'Publicado' : 'Rascunho'}</span><button className="admin-icon-button" onClick={() => editProduct(product)} aria-label={`Editar ${product.name}`}><Pencil size={16} /></button><button className="admin-icon-button admin-delete" disabled={busy} onClick={() => void deleteProduct(product)} aria-label={`Excluir ${product.name}`}><Trash2 size={16} /></button></div></article>)}</div>
            <div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h3>Categorias e subcategorias</h3></div></div><form className="admin-inline-form admin-category-form" onSubmit={categoryForm.handleSubmit(saveCategory)}><div><label className="sr-only" htmlFor="admin-category">Nome</label><input id="admin-category" {...categoryForm.register('name')} placeholder="Nome da categoria" />{categoryForm.formState.errors.name && <small>{categoryForm.formState.errors.name.message}</small>}</div><label className="sr-only" htmlFor="admin-parent-category">Categoria principal</label><select id="admin-parent-category" {...categoryForm.register('parent_id')}><option value="">Categoria principal</option>{categories.filter((category) => !category.parent_id && category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button className="button button-dark" disabled={busy}><Plus size={15} /> Adicionar</button></form>{categories.map((category) => <div className="admin-product-row" key={category.id}><div><strong>{category.parent_id && '↳ '}{category.name}</strong><span>{category.parent_id ? `Subcategoria de ${categories.find((parent) => parent.id === category.parent_id)?.name ?? 'categoria removida'}` : `/${category.slug}`}</span></div><div className="category-row-actions"><button className="admin-icon-button" aria-label={`Renomear ${category.name}`} disabled={busy} onClick={() => void renameCategory(category)}><Pencil size={14} /></button><button className="category-toggle" disabled={busy} onClick={() => void toggleCategory(category)}>{category.active ? 'Ativa' : 'Inativa'} <ChevronDown size={14} /></button></div></div>)}</div>
          </section>}
          {!loading && panel === 'orders' && <section className="admin-panel admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Data</th><th>Pagamento</th><th>Total</th><th>Status do pedido</th></tr></thead><tbody>{orders.map((order) => { const nextStatuses: Database['public']['Enums']['order_status'][] = order.status === 'awaiting_payment' ? ['cancelled'] : order.status === 'paid' ? ['processing', 'cancelled'] : order.status === 'processing' ? ['shipped', 'cancelled'] : order.status === 'shipped' ? ['delivered'] : []; return <tr key={order.id}><td><strong>{order.order_number}</strong></td><td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td><td>{order.payment_status}</td><td>{formatPrice(Number(order.total))}</td><td><select aria-label={`Status do pedido ${order.order_number}`} value={order.status} disabled={busy || nextStatuses.length === 0} onChange={(event) => void updateOrderStatus(order.id, event.target.value as Database['public']['Enums']['order_status'])}><option value={order.status}>{statusLabels[order.status]}</option>{nextStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></td></tr> })}</tbody></table>{orders.length === 0 && <p className="admin-empty">Os pedidos aparecerão aqui após implementar o checkout e o provedor de pagamentos.</p>}</section>}
          {!loading && panel === 'customers' && <section className="admin-panel admin-table-wrap"><table className="admin-table"><thead><tr><th>Nome</th><th>Conta</th><th>Permissão</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.user_id}><td>{customer.full_name || 'Nome não informado'}</td><td>{customer.user_id === session.user.id ? session.user.email : 'Protegido'}</td><td>{customer.role === 'admin' ? 'Administrador' : 'Cliente'}</td></tr>)}</tbody></table><p className="admin-privacy-note">Endereços e e-mails de outros clientes não são exibidos neste painel.</p></section>}
          {!loading && panel === 'coupons' && <section className="admin-products-panel"><div className="admin-panel admin-editor"><div className="admin-panel-heading"><div><span className="eyebrow">PROMOÇÕES</span><h3>Criar cupom</h3></div></div><form className="admin-form" onSubmit={couponForm.handleSubmit(saveCoupon)}><label>Código<input {...couponForm.register('code')} placeholder="BEMVINDO10" />{couponForm.formState.errors.code && <small>{couponForm.formState.errors.code.message}</small>}</label><div className="admin-form-grid"><label>Tipo<select {...couponForm.register('discount_type')}><option value="percentage">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label><label>Desconto<input type="number" min="0.01" step="0.01" {...couponForm.register('discount_value', { valueAsNumber: true })} />{couponForm.formState.errors.discount_value && <small>{couponForm.formState.errors.discount_value.message}</small>}</label></div><label>Limite de usos (opcional)<input type="number" min="1" step="1" {...couponForm.register('max_uses', { valueAsNumber: true, setValueAs: (value: string) => value === '' ? undefined : Number(value) })} /></label><button className="button button-dark" disabled={busy}>Criar cupom <Plus size={16} /></button></form></div><div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">{coupons.length} CUPONS</span><h3>Cupons cadastrados</h3></div></div>{coupons.length === 0 && <p className="admin-empty">Ainda não há cupons cadastrados.</p>}{coupons.map((coupon) => <article className="admin-product-row" key={coupon.id}><div><strong>{coupon.code}</strong><span>{coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatPrice(Number(coupon.discount_value))} de desconto · {coupon.uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''} uso(s)</span></div><button className="category-toggle" disabled={busy} onClick={() => void toggleCoupon(coupon)}>{coupon.active ? 'Ativo' : 'Inativo'} <ChevronDown size={14} /></button></article>)}</div></section>}
          {!loading && panel === 'banners' && <section className="admin-products-panel"><div className="admin-panel admin-editor"><div className="admin-panel-heading"><div><span className="eyebrow">VITRINE PÚBLICA</span><h3>Novo banner</h3></div></div><form className="admin-form" onSubmit={bannerForm.handleSubmit(saveBanner)}><label>Chamada pequena<input {...bannerForm.register('eyebrow')} placeholder="Ex.: PEQUENOS ACHADOS" />{bannerForm.formState.errors.eyebrow && <small>{bannerForm.formState.errors.eyebrow.message}</small>}</label><label>Título<input {...bannerForm.register('title')} placeholder="Título do banner" />{bannerForm.formState.errors.title && <small>{bannerForm.formState.errors.title.message}</small>}</label><label>Descrição<textarea rows={2} {...bannerForm.register('description')} placeholder="Mensagem para os clientes" /></label><label>Imagem (URL HTTPS)<input type="url" {...bannerForm.register('image_url')} placeholder="https://..." />{bannerForm.formState.errors.image_url && <small>{bannerForm.formState.errors.image_url.message}</small>}</label><div className="admin-form-grid"><label>Texto do botão<input {...bannerForm.register('cta_label')} />{bannerForm.formState.errors.cta_label && <small>{bannerForm.formState.errors.cta_label.message}</small>}</label><label>Destino interno<input {...bannerForm.register('destination')} placeholder="/catalogo" />{bannerForm.formState.errors.destination && <small>{bannerForm.formState.errors.destination.message}</small>}</label></div><div className="admin-form-grid"><label>Ordem<input type="number" step="1" {...bannerForm.register('sort_order', { valueAsNumber: true })} /></label><label className="admin-banner-active"><span>Publicar</span><input type="checkbox" {...bannerForm.register('active')} /></label></div><button className="button button-dark" disabled={busy}>Cadastrar banner <Plus size={16} /></button></form></div><div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">{banners.length} BANNERS</span><h3>Gerenciar banners</h3></div></div>{banners.length === 0 && <p className="admin-empty">Cadastre um banner. A página inicial usa a imagem de demonstração enquanto nenhum banner estiver publicado.</p>}{banners.map((banner) => <article className="admin-product-row" key={banner.id}><div><strong>{banner.title}</strong><span>{banner.destination} · ordem {banner.sort_order}</span></div><div><button className="category-toggle" disabled={busy} onClick={() => void toggleBanner(banner)}>{banner.active ? 'Publicado' : 'Rascunho'} <ChevronDown size={14} /></button><button className="admin-icon-button admin-delete" disabled={busy} onClick={() => void deleteBanner(banner)} aria-label={`Excluir o banner ${banner.title}`}><Trash2 size={16} /></button></div></article>)}</div></section>}
        </section>
      </div>
    </main>
  )
}

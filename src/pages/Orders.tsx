import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Clock3, RefreshCw, ShoppingBag } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../integrations/supabase/client'

type OrderLine = { id: string; product_name: string; quantity: number; unit_price: number }
type CustomerOrder = {
  id: string
  order_number: string
  status: string
  payment_status: string
  subtotal: number
  shipping_amount: number
  discount_amount: number
  total: number
  created_at: string
  order_items: OrderLine[]
}

const orderLabels: Record<string, string> = {
  awaiting_payment: 'Aguardando confirmação do pagamento',
  paid: 'Pagamento aprovado',
  processing: 'Em preparação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}

function currency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Orders() {
  const { session, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    if (!supabase || !session) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase.from('orders')
        .select('id,order_number,status,payment_status,subtotal,shipping_amount,discount_amount,total,created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (queryError) throw queryError
      const orderData = data ?? []
      const ids = orderData.map((order) => order.id)
      const itemsByOrder = new Map<string, OrderLine[]>()
      if (ids.length) {
        const { data: lineData, error: lineError } = await supabase.from('order_items')
          .select('id,order_id,product_name,quantity,unit_price')
          .in('order_id', ids)
        if (lineError) throw lineError
        for (const line of lineData ?? []) {
          const orderLines = itemsByOrder.get(line.order_id) ?? []
          orderLines.push({ id: line.id, product_name: line.product_name, quantity: line.quantity, unit_price: Number(line.unit_price) })
          itemsByOrder.set(line.order_id, orderLines)
        }
      }
      setOrders(orderData.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal),
        shipping_amount: Number(order.shipping_amount),
        discount_amount: Number(order.discount_amount),
        total: Number(order.total),
        order_items: itemsByOrder.get(order.id) ?? [],
      })))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus pedidos.')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (!authLoading) void loadOrders()
  }, [authLoading, loadOrders])

  const message = params.get('pagamento') === 'sucesso'
    ? 'Retorno do provedor recebido. A aprovação do pagamento ainda precisa ser confirmada pelo Mercado Pago.'
    : params.get('pagamento') === 'pendente'
      ? 'O pagamento está em análise. Atualize esta página para consultar o status confirmado.'
      : params.get('pagamento') === 'recusado'
        ? 'O pagamento não foi aprovado. O status final aparecerá quando o provedor confirmar a notificação.'
        : ''

  return (
    <>
      <Header />
      <main className="orders-page page-shell">
        <div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><Link to="/conta">Minha conta</Link><span>/</span><span>Meus pedidos</span></div>
        <div className="catalog-heading"><div><span className="eyebrow">ACOMPANHE SUA COMPRA</span><h1>Meus <em>pedidos.</em></h1><p>Atualizações confirmadas pelo servidor sobre suas compras.</p></div><button className="orders-refresh" disabled={loading} onClick={() => void loadOrders()}><RefreshCw size={15} /> Atualizar</button></div>
        {message && <div className="order-notice" role="status"><Clock3 size={17} />{message}</div>}
        {!isSupabaseConfigured && <div className="integration-alert"><strong>Histórico ainda não configurado.</strong><span>Configure o Supabase para registrar pedidos reais com segurança.</span></div>}
        {error && <div className="order-error" role="alert">{error}</div>}
        {loading ? <p className="catalog-feedback" role="status">Carregando seus pedidos…</p> : !session ? <div className="empty-state"><ShoppingBag size={35} /><h2>Entre para acompanhar seus pedidos.</h2><Link className="button button-dark" to="/conta?redirect=%2Fpedidos">Entrar na minha conta</Link></div> : orders.length === 0 ? <div className="empty-state"><ShoppingBag size={35} /><h2>Você ainda não tem pedidos.</h2><p>Quando uma compra for confirmada, os detalhes estarão aqui.</p><Link className="button button-dark" to="/catalogo">Ver produtos</Link></div> : <section className="order-history">{orders.map((order) => <article className="history-card" key={order.id}><div className="history-heading"><span><small>PEDIDO</small><strong>{order.order_number}</strong></span><span className={`history-status history-${order.status}`}><i />{orderLabels[order.status] ?? order.status}</span><span><small>DATA</small><strong>{new Date(order.created_at).toLocaleDateString('pt-BR')}</strong></span></div><div className="history-items">{order.order_items.map((item) => <div className="history-item" key={item.id}><span>{item.product_name} <small>× {item.quantity}</small></span><strong>{currency(item.unit_price * item.quantity)}</strong></div>)}</div><div className="history-total"><span>Pagamento: {order.payment_status}</span><strong>Total {currency(order.total)}</strong></div></article>)}</section>}
        <Link className="back-link" to="/conta"><ArrowLeft size={15} /> Minha conta</Link>
      </main>
      <Footer />
    </>
  )
}

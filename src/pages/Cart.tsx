import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { isCheckoutEnabled, isSupabaseConfigured } from '../integrations/supabase/client'
import { listCustomerAddresses, type CustomerAddress } from '../services/addresses'
import { createCheckout, type ShippingAddress } from '../services/checkout'

const checkoutSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe o nome de quem receberá o pedido.').max(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{7,19}$/, 'Informe um telefone válido com DDD.'),
  postal_code: z.string().trim().regex(/^[0-9]{5}-?[0-9]{3}$/, 'Informe um CEP válido.'),
  street: z.string().trim().min(2, 'Informe o endereço.').max(160),
  number: z.string().trim().min(1, 'Informe o número.').max(20),
  complement: z.string().max(100),
  neighborhood: z.string().trim().min(2, 'Informe o bairro.').max(100),
  city: z.string().trim().min(2, 'Informe a cidade.').max(100),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Informe a sigla do estado.'),
  coupon_code: z.string().max(40),
})
type CheckoutValues = z.infer<typeof checkoutSchema>

export default function Cart() {
  const { items, subtotal, removeItem, setQuantity } = useCart()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const checkoutForm = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { full_name: typeof session?.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : '', phone: '', postal_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', coupon_code: '' },
  })
  const shipping = subtotal >= 299 || subtotal === 0 ? 0 : 18.9

  useEffect(() => {
    if (!checkoutOpen || !session) return
    let active = true
    void listCustomerAddresses().then((addresses) => {
      if (!active) return
      setSavedAddresses(addresses)
      const defaultAddress = addresses.find((address) => address.is_default)
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id)
        for (const field of ['full_name', 'phone', 'postal_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const) {
          const value = defaultAddress[field]
          checkoutForm.setValue(field, field === 'postal_code' ? value.replace(/^(\d{5})(\d{3})$/, '$1-$2') : value)
        }
      }
    }).catch((error: unknown) => {
      if (active) setCheckoutError(error instanceof Error ? error.message : 'Não foi possível carregar seus endereços salvos.')
    })
    return () => { active = false }
  }, [checkoutForm, checkoutOpen, session])

  function useSavedAddress(addressId: string) {
    setSelectedAddressId(addressId)
    const address = savedAddresses.find((candidate) => candidate.id === addressId)
    if (!address) return
    for (const field of ['full_name', 'phone', 'postal_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const) {
      const value = address[field]
      checkoutForm.setValue(field, field === 'postal_code' ? value.replace(/^(\d{5})(\d{3})$/, '$1-$2') : value)
    }
  }

  async function submitCheckout(values: CheckoutValues) {
    if (!session) {
      navigate('/conta?redirect=%2Fcarrinho')
      return
    }
    setCheckoutBusy(true)
    setCheckoutError('')
    try {
      const address: ShippingAddress = {
        full_name: values.full_name,
        phone: values.phone,
        postal_code: values.postal_code,
        street: values.street,
        number: values.number,
        complement: values.complement,
        neighborhood: values.neighborhood,
        city: values.city,
        state: values.state.toUpperCase(),
      }
      const result = await createCheckout(items, address, values.coupon_code)
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Não foi possível iniciar o checkout. Tente novamente.')
    } finally {
      setCheckoutBusy(false)
    }
  }

  return (
    <>
      <Header />
      <main className="cart-page page-shell">
        <div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><span>Sua sacola</span></div>
        <div className="catalog-heading"><div><span className="eyebrow">SEUS PRODUTOS</span><h1>Sua <em>sacola.</em></h1></div>{items.length > 0 && <span className="catalog-results">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>}</div>
        {items.length === 0 ? <div className="empty-state"><ShoppingBag size={34} strokeWidth={1.3} /><h2>Sua sacola está esperando.</h2><p>Explore papelaria e cartonagem para encontrar sua próxima ideia.</p><Link className="button button-dark" to="/catalogo">Explorar produtos <ArrowRight size={17} /></Link></div> : <div className="cart-layout">
          <section className="cart-items" aria-label="Itens na sacola">{items.map(({ product, quantity }) => <article className="cart-item" key={product.id}><Link to={`/produto/${product.id}`} className="cart-item-photo"><img src={product.image} alt={product.name} /></Link><div className="cart-item-info"><span className="eyebrow">{product.category}</span><Link to={`/produto/${product.id}`} className="cart-item-name">{product.name}</Link><span className="cart-item-price">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div><div className="quantity-control"><button aria-label="Diminuir quantidade" onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={14} /></button><span>{quantity}</span><button aria-label="Aumentar quantidade" disabled={quantity >= product.stock} onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={14} /></button></div><strong className="cart-line-total">{(product.price * quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><button className="remove-item" aria-label={`Remover ${product.name}`} onClick={() => removeItem(product.id)}><Trash2 size={17} /></button></article>)}
          <Link className="back-link" to="/catalogo"><ArrowLeft size={15} /> Continuar descobrindo</Link></section>
          <aside className="order-summary"><span className="eyebrow">RESUMO DA COMPRA</span><div><span>Subtotal estimado</span><strong>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div><div><span>Entrega estimada</span><strong>{shipping === 0 ? 'Grátis' : shipping.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>{subtotal < 299 && <p>Faltam {(299 - subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ganhar frete grátis.</p>}<hr /><div className="summary-total"><span>Total estimado</span><strong>{(subtotal + shipping).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>{!isSupabaseConfigured ? <><button className="button button-dark checkout-disabled" disabled>Checkout não configurado <ArrowRight size={17} /></button><span className="demo-note">Demonstração: nenhum pedido ou pagamento será criado. Configure o Supabase para ativar os dados da loja.</span></> : !isCheckoutEnabled ? <><button className="button button-dark checkout-disabled" disabled>Pagamento ainda não ativado <ArrowRight size={17} /></button><span className="demo-note">A configuração do Mercado Pago está pendente. Nenhum pedido ou cobrança será criada até a ativação do checkout seguro.</span></> : !checkoutOpen ? <><button className="button button-dark" onClick={() => { if (!session) navigate('/conta?redirect=%2Fcarrinho'); else setCheckoutOpen(true) }}>Continuar para entrega <ArrowRight size={17} /></button><span className="demo-note">Os valores exibidos são estimativas. O estoque e os preços serão confirmados no servidor.</span></> : <form className="checkout-form" onSubmit={checkoutForm.handleSubmit(submitCheckout)}><h2>Endereço de entrega</h2>{savedAddresses.length > 0 && <label className="saved-address-picker">Usar endereço salvo<select value={selectedAddressId} onChange={(event) => useSavedAddress(event.target.value)}><option value="">Informar outro endereço</option>{savedAddresses.map((address) => <option key={address.id} value={address.id}>{address.label}{address.is_default ? ' (padrão)' : ''} — {address.city}/{address.state}</option>)}</select><Link to="/conta">Gerenciar endereços</Link></label>}<div className="checkout-fields"><label>Nome completo<input autoComplete="name" {...checkoutForm.register('full_name')} />{checkoutForm.formState.errors.full_name && <small>{checkoutForm.formState.errors.full_name.message}</small>}</label><label>Telefone<input type="tel" autoComplete="tel" {...checkoutForm.register('phone')} placeholder="(11) 99999-9999" />{checkoutForm.formState.errors.phone && <small>{checkoutForm.formState.errors.phone.message}</small>}</label><label>CEP<input autoComplete="postal-code" {...checkoutForm.register('postal_code')} placeholder="00000-000" />{checkoutForm.formState.errors.postal_code && <small>{checkoutForm.formState.errors.postal_code.message}</small>}</label><label>Endereço<input autoComplete="street-address" {...checkoutForm.register('street')} />{checkoutForm.formState.errors.street && <small>{checkoutForm.formState.errors.street.message}</small>}</label><label>Número<input {...checkoutForm.register('number')} />{checkoutForm.formState.errors.number && <small>{checkoutForm.formState.errors.number.message}</small>}</label><label>Complemento<input {...checkoutForm.register('complement')} /></label><label>Bairro<input autoComplete="address-level3" {...checkoutForm.register('neighborhood')} />{checkoutForm.formState.errors.neighborhood && <small>{checkoutForm.formState.errors.neighborhood.message}</small>}</label><label>Cidade<input autoComplete="address-level2" {...checkoutForm.register('city')} />{checkoutForm.formState.errors.city && <small>{checkoutForm.formState.errors.city.message}</small>}</label><label>Estado (UF)<input autoComplete="address-level1" maxLength={2} {...checkoutForm.register('state')} />{checkoutForm.formState.errors.state && <small>{checkoutForm.formState.errors.state.message}</small>}</label><label className="coupon-field">Cupom (opcional)<input autoComplete="off" {...checkoutForm.register('coupon_code')} placeholder="Código promocional" />{checkoutForm.formState.errors.coupon_code && <small>{checkoutForm.formState.errors.coupon_code.message}</small>}</label></div>{checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}<button className="button button-dark" disabled={checkoutBusy}>{checkoutBusy ? 'Preparando pagamento seguro…' : <>Ir para pagamento seguro <ArrowRight size={17} /></>}</button><span className="demo-note">O pagamento será processado em ambiente seguro do Mercado Pago. Dados de cartão não passam pela loja.</span></form>}</aside>
        </div>}
      </main>
      <Footer />
    </>
  )
}

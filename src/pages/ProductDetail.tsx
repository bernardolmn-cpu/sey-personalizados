import { useState } from 'react'
import { ArrowLeft, ArrowRight, Heart, PackageCheck, ShieldCheck, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../hooks/useProducts'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'

export default function ProductDetail() {
  const { id } = useParams()
  const { products, status, error } = useProducts()
  const product = products.find((item) => item.id === id)
  const { addItem } = useCart()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const [added, setAdded] = useState(false)

  if (status === 'loading') return <><Header /><main className="empty-state page-shell" role="status"><span>✳</span><h1>Carregando este produto…</h1></main><Footer /></>
  if (status === 'error') return <><Header /><main className="empty-state page-shell" role="alert"><span>✳</span><h1>Não foi possível carregar este produto.</h1><p>{error}</p><Link className="button button-dark" to="/catalogo">Voltar ao catálogo</Link></main><Footer /></>
  if (!product) return <><Header /><main className="empty-state page-shell"><span>✳</span><h1>Este produto não está disponível.</h1><Link className="button button-dark" to="/catalogo">Voltar ao catálogo</Link></main><Footer /></>

  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
  const saved = favoriteIds.includes(product.id)

  return (
    <>
      <Header />
      <main className="page-shell detail-page">
        <div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><Link to="/catalogo">Produtos</Link><span>/</span><span>{product.name}</span></div>
        <Link className="back-link" to="/catalogo"><ArrowLeft size={15} /> Voltar aos produtos</Link>
        <section className="detail-layout">
          <div className="detail-photo"><img src={product.image} alt={product.name} /><span className="detail-photo-caption">papelaria e cartonagem</span></div>
          <div className="detail-info"><span className="eyebrow">{product.category}</span><h1>{product.name}</h1><div className="detail-rating">{product.rating === undefined ? <span>Sem avaliações cadastradas</span> : <><Star size={15} fill="currentColor" /> {product.rating.toFixed(1)} <span>({product.reviews ?? 0} avaliações demonstrativas)</span></>}</div><div className="detail-price">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{product.oldPrice && <del>{product.oldPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</del>}</div><p className="detail-description">{product.description}</p><span className={`stock-label ${product.stock > 0 ? '' : 'out-of-stock'}`}>{product.stock > 0 ? `${product.stock} disponíveis no estoque ${status === 'demo' ? 'demonstrativo' : ''}` : 'Indisponível'}</span><div className="detail-actions"><button className="button button-dark" disabled={product.stock < 1} onClick={() => { addItem(product); setAdded(true); window.setTimeout(() => setAdded(false), 1600) }}>{added ? 'Adicionado à sacola!' : <>Adicionar à sacola <ArrowRight size={17} /></>}</button><button className={`detail-favorite ${saved ? 'is-saved' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label="Salvar nos favoritos"><Heart size={20} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="detail-promises"><span><PackageCheck size={18} /> Preparado com cuidado</span><span><ShieldCheck size={18} /> Compra protegida no checkout seguro</span></div><p className="demo-note">{status === 'demo' ? 'Catálogo e disponibilidade ilustrativos. Pedidos e pagamentos reais ainda não estão ativados.' : 'O checkout de compras ainda não está configurado.'}</p></div>
        </section>
        {related.length > 0 && <section className="section related-section"><div className="section-heading"><div><span className="eyebrow">TALVEZ VOCÊ GOSTE</span><h2>Mais para <em>descobrir.</em></h2></div></div><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
      </main>
      <Footer />
    </>
  )
}

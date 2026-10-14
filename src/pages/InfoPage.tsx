import { ArrowLeft, Heart } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import { useFavorites } from '../context/FavoritesContext'
import { useProducts } from '../hooks/useProducts'

const messages: Record<string, { title: string; description: string }> = {
  '/conta': { title: 'Sua conta está quase pronta.', description: 'A autenticação segura estará disponível quando o Supabase estiver configurado neste projeto.' },
  '/favoritos': { title: 'Seus favoritos moram aqui.', description: 'Toque no coração de um produto para guardá-lo enquanto navega.' },
}

export default function InfoPage() {
  const { pathname } = useLocation()
  const { favoriteIds } = useFavorites()
  const { products, status, error } = useProducts()
  const page = messages[pathname] ?? messages['/conta']
  if (pathname === '/favoritos') {
    const favorites = products.filter((product) => favoriteIds.includes(product.id))
    return <><Header /><main className="catalog-page page-shell"><div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><span>Favoritos</span></div><div className="catalog-heading"><div><span className="eyebrow">GUARDADOS COM CARINHO</span><h1>Seus <em>favoritos.</em></h1></div><span className="catalog-results">{favorites.length} {favorites.length === 1 ? 'peça' : 'peças'}</span></div>{status === 'loading' && <p className="catalog-feedback" role="status">Carregando favoritos…</p>}{status === 'error' && <p className="catalog-feedback catalog-feedback-error" role="alert">{error}</p>}{status !== 'loading' && status !== 'error' && (favorites.length ? <div className="product-grid">{favorites.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><Heart size={34} strokeWidth={1.3} /><h2>Seus favoritos moram aqui.</h2><p>Toque no coração de um produto para guardá-lo enquanto navega.</p><Link className="button button-dark" to="/catalogo">Descobrir produtos</Link></div>)}</main><Footer /></>
  }
  return <><Header /><main className="empty-state page-shell"><Heart size={34} strokeWidth={1.3} /><span className="eyebrow">UM PASSO DE CADA VEZ</span><h1>{page.title}</h1><p>{page.description}</p><Link className="button button-dark" to="/catalogo"><ArrowLeft size={16} /> Voltar aos produtos</Link></main><Footer /></>
}

import { useState } from 'react'
import { Heart, Plus, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import type { Product } from '../types'

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const [added, setAdded] = useState(false)
  const saved = favoriteIds.includes(product.id)

  function addToCart() {
    addItem(product)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1400)
  }

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link to={`/produto/${product.id}`} className="product-image-link" aria-label={`Ver ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>
        {product.badge && <span className={`product-badge ${product.badge.includes('%') || product.badge === 'Oferta' ? 'badge-sale' : ''}`}>{product.badge}</span>}
        <button className={`favorite-toggle ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-pressed={saved} onClick={() => toggleFavorite(product.id)}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
        <button className={`quick-add ${added ? 'quick-added' : ''}`} onClick={addToCart} disabled={product.stock < 1} aria-label={`Adicionar ${product.name} à sacola`}>{added ? 'Adicionado!' : <><Plus size={16} /> Adicionar</>}</button>
      </div>
      <div className="product-meta"><span>{product.category}</span>{product.rating === undefined ? <span className="no-rating">Sem avaliações</span> : <span><Star size={13} fill="currentColor" /> {product.rating.toFixed(1)} <i>({product.reviews ?? 0})</i></span>}</div>
      <Link to={`/produto/${product.id}`} className="product-name">{product.name}</Link>
      <div className="product-prices"><strong>{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>{product.oldPrice && <del>{product.oldPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</del>}</div>
    </article>
  )
}

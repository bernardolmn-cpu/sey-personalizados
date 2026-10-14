import { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import { useStore } from '../context/StoreContext'
import { useProducts } from '../hooks/useProducts'

export default function Catalog() {
  const { products, status, error } = useProducts()
  const { categories: storeCategories } = useStore()
  const [params, setParams] = useSearchParams()
  const [maxPrice, setMaxPrice] = useState(1000)
  const selectedCategory = params.get('categoria') ?? 'Todos os produtos'
  const search = params.get('q') ?? ''
  const onlyOffers = params.get('ofertas') === '1'
  const sort = params.get('ordem') ?? 'destaques'
  const categories = ['Todos os produtos', ...new Set([...storeCategories.map((category) => category.name), ...products.map((product) => product.category)])]

  const visibleProducts = useMemo(() => {
    const result = products.filter((product) => {
      const matchesCategory = selectedCategory === 'Todos os produtos' || product.category === selectedCategory
      const matchesSearch = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch && product.price <= maxPrice && (!onlyOffers || Boolean(product.oldPrice))
    })
    if (sort === 'preco-menor') result.sort((a, b) => a.price - b.price)
    else if (sort === 'preco-maior') result.sort((a, b) => b.price - a.price)
    else if (sort === 'popularidade') result.sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
    else if (sort === 'novidades') result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return result
  }, [maxPrice, onlyOffers, search, selectedCategory, sort])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  return (
    <>
      <Header />
      <main className="catalog-page page-shell">
        <div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><span>Produtos</span></div>
        <div className="catalog-heading"><div><span className="eyebrow">CARTONAGEM E PAPELARIA</span><h1>Um mundo de <em>ideias.</em></h1><p>Explore cadernos, caixas e papelaria para criar e presentear.</p></div><span className="catalog-results">{visibleProducts.length} {visibleProducts.length === 1 ? 'produto' : 'produtos'}</span></div>
        <div className="catalog-controls">
          <label className="filter-control"><SlidersHorizontal size={17} /><span>Categoria</span><select value={selectedCategory} onChange={(event) => updateParam('categoria', event.target.value === 'Todos os produtos' ? '' : event.target.value)} aria-label="Filtrar por categoria">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="filter-control price-filter"><span>Até {maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><input aria-label="Preço máximo" type="range" min="50" max="1000" step="10" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /></label>
          <label className="filter-control offers-filter"><input type="checkbox" checked={onlyOffers} onChange={(event) => updateParam('ofertas', event.target.checked ? '1' : '')} /><span>Somente ofertas</span></label>
          <label className="sort-control">Ordenar por <select value={sort} onChange={(event) => updateParam('ordem', event.target.value)} aria-label="Ordenar produtos"><option value="destaques">Destaques</option><option value="preco-menor">Menor preço</option><option value="preco-maior">Maior preço</option><option value="popularidade">Popularidade</option><option value="novidades">Novidades</option></select></label>
        </div>
        {search && <p className="search-results-label">Resultados para <strong>“{search}”</strong> <button onClick={() => updateParam('q', '')}>Limpar busca</button></p>}
        {status === 'demo' && <p className="demo-catalog-notice">Catálogo de demonstração — nomes, preços e estoque são exemplos, não ofertas reais.</p>}
        {status === 'loading' && <p className="catalog-feedback" role="status">Carregando produtos publicados…</p>}
        {status === 'error' && <p className="catalog-feedback catalog-feedback-error" role="alert">{error}</p>}
        {status !== 'loading' && status !== 'error' && (visibleProducts.length ? <div className="product-grid catalog-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><span>✳</span><h2>Nenhum produto por aqui.</h2><p>Tente ajustar os filtros para encontrar o que procura.</p><button className="button button-dark" onClick={() => { setParams(new URLSearchParams()); setMaxPrice(1000) }}>Limpar filtros</button></div>)}
      </main>
      <Footer />
    </>
  )
}

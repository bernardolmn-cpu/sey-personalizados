import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Heart, Menu, Search, ShoppingBag, X } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import Brand from './Brand'
import { supabase } from '../integrations/supabase/client'

export default function Header() {
  const { count } = useCart()
  const { session, role, signOut } = useAuth()
  const { settings, categories } = useStore()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(`/catalogo?q=${encodeURIComponent(query)}`)
    setMenuOpen(false)
  }

  return (
    <>
      <div className="announcement">{settings.announcement || settings.brand_name}</div>
      <header className="site-header">
        <div className="header-main page-shell">
          <button className="icon-button mobile-menu-button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Brand />
          <form className="search-box" onSubmit={search}>
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="O que você está procurando?" aria-label="Buscar produtos" />
            <button aria-label="Buscar"><ArrowRight size={17} /></button>
          </form>
          <div className="header-actions">
            <Link to={role === 'admin' ? '/admin' : '/conta'} className="account-link"><span className="account-greeting">{session?.user.user_metadata.full_name ? `Olá, ${session.user.user_metadata.full_name}` : session ? 'Olá, cliente' : 'Olá, visitante'}</span><strong>{role === 'admin' ? 'Painel administrativo' : session ? 'Minha conta' : 'Entre ou cadastre-se'}</strong></Link>
            {session && <button className="header-signout" onClick={() => { void signOut().catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')) }} aria-label="Sair da conta">Sair</button>}
            <Link to="/favoritos" className="icon-button favorites-button" aria-label="Favoritos"><Heart size={21} /></Link>
            <Link to="/carrinho" className="icon-button bag-button" aria-label={`Sacola, ${count} itens`}>
              <ShoppingBag size={21} />
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>
          </div>
          {import.meta.env.DEV && !supabase && <span className="setup-banner">Demonstração: configure o Supabase em .env.local</span>}
        </div>
        <nav className={`category-nav ${menuOpen ? 'category-nav-open' : ''}`} aria-label="Categorias">
          <div className="page-shell nav-inner">
            {categories.map((category) => <Link key={category.id} to={`/catalogo?categoria=${encodeURIComponent(category.name)}`} onClick={() => setMenuOpen(false)}>{category.name}</Link>)}
            <Link to="/catalogo?ofertas=1" className="nav-offers" onClick={() => setMenuOpen(false)}>Ofertas especiais <span>↗</span></Link>
          </div>
        </nav>
      </header>
    </>
  )
}

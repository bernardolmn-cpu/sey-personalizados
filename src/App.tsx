import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Cart from './pages/Cart'
import Catalog from './pages/Catalog'
import Home from './pages/Home'
import InfoPage from './pages/InfoPage'
import ProductDetail from './pages/ProductDetail'

const Account = lazy(() => import('./pages/Account'))
const Admin = lazy(() => import('./pages/Admin'))
const Orders = lazy(() => import('./pages/Orders'))
const ContentPage = lazy(() => import('./pages/ContentPage'))

export default function App() {
  return (
    <Suspense fallback={<main className="admin-loading page-shell" role="status">Carregando…</main>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/produto/:id" element={<ProductDetail />} />
        <Route path="/carrinho" element={<Cart />} />
        <Route path="/conta" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/favoritos" element={<InfoPage />} />
        <Route path="/sobre" element={<ContentPage slug="about" />} />
        <Route path="/faq" element={<ContentPage slug="faq" />} />
        <Route path="/entregas" element={<ContentPage slug="shipping" />} />
        <Route path="/trocas-e-devolucoes" element={<ContentPage slug="returns" />} />
        <Route path="/privacidade" element={<ContentPage slug="privacy" />} />
        <Route path="/termos" element={<ContentPage slug="terms" />} />
        <Route path="*" element={<InfoPage />} />
      </Routes>
    </Suspense>
  )
}

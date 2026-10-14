import { ArrowDownRight, ArrowRight, ArrowUpRight, HeartHandshake, Leaf, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import Newsletter from '../components/Newsletter'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../hooks/useProducts'
import { useBanner } from '../hooks/useBanner'
import { useStore } from '../context/StoreContext'

const benefits = [
  { icon: HeartHandshake, title: 'Personalize suas ideias', text: 'Papelaria e cartonagem para combinar com seu jeito e sua ocasião.' },
  { icon: PackageCheck, title: 'Detalhes que fazem diferença', text: 'Peças pensadas para guardar, organizar e presentear.' },
  { icon: Leaf, title: 'Criatividade no dia a dia', text: 'Cadernos, caixas e acessórios para transformar ideias em momentos especiais.' },
  { icon: ShieldCheck, title: 'Compra com tranquilidade', text: 'Informações claras para você escolher com confiança.' },
]

export default function Home() {
  const { products, status, error } = useProducts()
  const { settings } = useStore()
  const { banner, status: bannerStatus, error: bannerError } = useBanner()
  const isDemo = status === 'demo'
  const featured = products.filter((product) => product.featured).slice(0, 4)
  const popular = [...products].sort((a, b) => isDemo
    ? (b.sold ?? 0) - (a.sold ?? 0)
    : b.createdAt.localeCompare(a.createdAt)).slice(0, 4)
  const discounted = products.filter((product) => product.oldPrice)

  return (
    <>
      <Header />
      <main>
        {status === 'demo' && <div className="demo-shop-notice page-shell">Demonstração: imagens, produtos, preços e estoque abaixo são exemplos ilustrativos.</div>}
        {bannerStatus === 'error' && <div className="page-shell"><p className="catalog-feedback catalog-feedback-error" role="alert">{bannerError}</p></div>}
        <section className="hero page-shell">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> {banner?.eyebrow || 'CARTONAGEM, PAPELARIA E PERSONALIZAÇÃO'}</span>
            <h1>{banner ? banner.title : settings.hero_title}</h1>
            <p>{banner?.description || settings.hero_description}</p>
            <div className="hero-actions"><Link to={banner?.destination || '/catalogo'} className="button button-dark">{banner?.ctaLabel || 'Encontre seu próximo favorito'} <ArrowRight size={17} /></Link><Link to="/sobre" className="hero-text-link">Conheça {settings.brand_name} <ArrowDownRight size={15} /></Link></div>
            <div className="hero-proof"><span>Criatividade em papel, forma e cor.</span></div>
          </div>
          <div className="hero-visual">
            <img src={banner?.imageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1400&q=90'} alt={banner ? banner.title : 'Imagem ilustrativa de caderno e papelaria'} />
            <div className="hero-caption"><span>{banner ? `campanha de ${settings.brand_name}` : 'imagem ilustrativa'}</span><span>1 / 04</span></div>
            <div className="hero-stamp"><span>ideias</span><strong>em<br />papel</strong><span>✳</span></div>
          </div>
          <div className="hero-number">01 <span>/ 04</span></div>
        </section>

        <section className="section section-featured">
          <div className="page-shell">
            <div className="section-heading"><div><span className="eyebrow">PAPELARIA E CARTONAGEM</span><h2>Ideias que ganham <em>forma.</em></h2><p>Peças para organizar, criar e transformar em presentes especiais.</p></div><Link className="section-link" to="/catalogo">Ver produtos <ArrowUpRight size={16} /></Link></div>
            {status === 'loading' && <p className="catalog-feedback" role="status">Carregando produtos publicados…</p>}
            {status === 'error' && <p className="catalog-feedback catalog-feedback-error" role="alert">{error}</p>}
            {status !== 'loading' && status !== 'error' && (featured.length ? <div className="product-grid">{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="catalog-feedback">Em breve, novos produtos de cartonagem e papelaria.</p>)}
          </div>
        </section>

        <section className="category-feature page-shell">
          <div className="category-story">
            <span className="eyebrow eyebrow-light">FEITO PARA SUAS IDEIAS</span>
            <h2>Papel que vira<br /><em>memória.</em></h2>
            <p>Cartonagem e papelaria personalizada para guardar histórias, organizar a rotina e presentear com carinho.</p>
            <Link to="/catalogo" className="button button-light">Explore a coleção <ArrowRight size={17} /></Link>
          </div>
          <div className="category-photo category-photo-one"><img src="https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=85" alt="Imagem ilustrativa de caderno aberto com anotações" /><span>Cadernos e planners <ArrowUpRight size={15} /></span></div>
          <div className="category-photo category-photo-two"><img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85" alt="Imagem ilustrativa de materiais criativos e papelaria" /><span>Criar e personalizar <ArrowUpRight size={15} /></span></div>
          <div className="category-sticker" aria-hidden="true">feito de<br />ideias <span>✳</span></div>
        </section>

        <section className="section section-offers">
          <div className="page-shell">
            <div className="offer-band">
              <div className="offer-copy"><span className="eyebrow eyebrow-light">PRESENTES COM A SUA CARA</span><h2>Surpreenda com<br /><em>detalhes únicos.</em></h2><p>Encontre papelaria e cartonagem para presentear em cada ocasião.</p><Link to="/catalogo?ofertas=1" className="button button-light">Ver ofertas <ArrowRight size={17} /></Link></div>
              <div className="offer-products">{discounted.slice(0, 2).map((product) => <Link key={product.id} to={`/produto/${product.id}`} className="offer-product"><img src={product.image} alt={product.name} /><span className="offer-tag">ACHADO ESPECIAL</span><span className="offer-product-name">{product.name}</span><strong>{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></Link>)}{discounted.length === 0 && <p className="offer-empty">{status === 'demo' ? 'Novas ofertas a caminho.' : 'No momento não há ofertas cadastradas.'}</p>}</div>
              <span className="offer-spark" aria-hidden="true">✳</span>
            </div>
          </div>
        </section>

        <section className="section section-bestsellers">
          <div className="page-shell">
            <div className="section-heading"><div><span className="eyebrow">{isDemo ? 'EXEMPLOS DE PAPELARIA' : 'NOVIDADES DA LOJA'}</span><h2>{isDemo ? <>Um mundo de papel <em>para criar.</em></> : <>Novas ideias para <em>descobrir.</em></>}</h2><p>{isDemo ? 'Produtos ilustrativos do segmento; os itens reais serão cadastrados pela loja.' : 'Confira os produtos publicados recentemente.'}</p></div><Link className="section-link" to={isDemo ? '/catalogo?ordem=popularidade' : '/catalogo?ordem=novidades'}>{isDemo ? 'Ver exemplos' : 'Novidades'} <ArrowUpRight size={16} /></Link></div>
            {status === 'error' && <p className="catalog-feedback catalog-feedback-error" role="alert">{error}</p>}
            {status !== 'loading' && status !== 'error' && (popular.length ? <div className="product-grid">{popular.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="catalog-feedback">Os produtos desta seleção ainda não estão disponíveis.</p>)}
          </div>
        </section>

        <section className="benefits-section">
          <div className="page-shell"><div className="benefits-intro"><span className="eyebrow">CRIATIVIDADE EM CADA DETALHE</span><h2>Boas ideias<br /><em>merecem papel.</em></h2></div><div className="benefits-grid">{benefits.map(({ icon: Icon, title, text }, index) => <article className="benefit" key={title}><span className="benefit-number">0{index + 1}</span><Icon size={23} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p></article>)}</div></div>
        </section>

        <section className="section reviews-section">
          <div className="page-shell review-content"><span className="eyebrow">UMA IDEIA PARA PRESENTEAR</span><div className="review-stars"><Sparkles size={22} /></div><blockquote>“Um caderno personalizado pode transformar anotações do dia a dia em lembranças cheias de significado.”</blockquote><div className="review-author"><div className="review-avatar">✳</div><span><strong>Inspiração da SEY</strong><small>Mensagem institucional, não é uma avaliação de cliente.</small></span></div><div className="review-disclaimer">Esta seção é inspiracional e não representa depoimento ou avaliação de cliente.</div></div>
        </section>
        <div className="page-shell"><Newsletter /></div>
      </main>
      <Footer />
    </>
  )
}

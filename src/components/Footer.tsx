import { Instagram, Mail, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand'
import { useStore } from '../context/StoreContext'

export default function Footer() {
  const { settings, categories } = useStore()

  return (
    <footer className="site-footer">
      <div className="page-shell footer-main">
        <div className="footer-brand-column">
          <Brand footer />
          {settings.tagline && <p>{settings.tagline}</p>}
          {settings.instagram_url && <a className="social-link" href={settings.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /> Instagram</a>}
        </div>
        <div className="footer-column"><h3>Descubra</h3><Link to="/catalogo">Todos os produtos</Link><Link to="/catalogo?ofertas=1">Ofertas especiais</Link>{categories.slice(0, 4).map((category) => <Link key={category.id} to={`/catalogo?categoria=${encodeURIComponent(category.name)}`}>{category.name}</Link>)}</div>
        <div className="footer-column"><h3>Institucional</h3><Link to="/sobre">Quem somos</Link><Link to="/faq">Perguntas frequentes</Link><Link to="/entregas">Entregas e prazos</Link><Link to="/trocas-e-devolucoes">Trocas e devoluções</Link><Link to="/privacidade">Privacidade</Link><Link to="/termos">Termos de uso</Link>{settings.contact_email && <a href={`mailto:${settings.contact_email}`}>Fale com a gente</a>}</div>
        <div className="footer-column footer-newsletter"><h3>Novidades feitas de papel.</h3><p>Inspiração e novidades de cartonagem e papelaria.</p><form onSubmit={(event) => { event.preventDefault(); window.alert('Cadastro demonstrativo: configure o backend para ativar a newsletter.') }}><label className="sr-only" htmlFor="newsletter-email">Seu e-mail</label><input id="newsletter-email" type="email" placeholder="Seu melhor e-mail" required /><button aria-label="Inscrever-se"><Send size={16} /></button></form><span className="demo-footnote">Inscrição demonstrativa, sem envio de dados.</span></div>
      </div>
      <div className="page-shell footer-bottom"><span>© {new Date().getFullYear()} {settings.brand_name}</span><div>{settings.contact_email && <a href={`mailto:${settings.contact_email}`}><Mail size={14} /> {settings.contact_email}</a>}</div></div>
    </footer>
  )
}

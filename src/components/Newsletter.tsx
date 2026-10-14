import { ArrowRight } from 'lucide-react'

export default function Newsletter() {
  return (
    <section className="newsletter-section">
      <div className="newsletter-copy"><span className="eyebrow eyebrow-light">UM BILHETE DA SEY</span><h2>Inspiração para<br />suas próximas ideias.</h2><p>Novidades de cartonagem, papelaria e personalização.</p></div>
      <form className="newsletter-form" onSubmit={(event) => { event.preventDefault(); window.alert('Cadastro demonstrativo: conecte um serviço de newsletter para ativar.') }}><label htmlFor="home-newsletter">Seu e-mail</label><div><input id="home-newsletter" type="email" placeholder="voce@email.com" required /><button type="submit" aria-label="Inscrever-se"><ArrowRight size={20} /></button></div><span>Cadastro demonstrativo. Nenhum dado será enviado.</span></form>
      <div className="newsletter-flower" aria-hidden="true">✳</div>
    </section>
  )
}

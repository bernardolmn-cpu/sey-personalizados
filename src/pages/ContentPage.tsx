import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { supabase } from '../integrations/supabase/client'
import { useStore } from '../context/StoreContext'

type ContentRecord = {
  slug: string
  title: string
  introduction: string
  body: string
}

type FaqRecord = {
  id: string
  question: string
  answer: string
}

const titles: Record<string, string> = {
  about: 'Quem somos',
  faq: 'Perguntas frequentes',
  shipping: 'Entregas e prazos',
  returns: 'Trocas e devoluções',
  privacy: 'Privacidade',
  terms: 'Termos de uso',
}

export default function ContentPage({ slug }: { slug: string }) {
  const { settings } = useStore()
  const [content, setContent] = useState<ContentRecord | null>(null)
  const [faqs, setFaqs] = useState<FaqRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        if (!supabase || !titles[slug]) {
          if (active) setContent(null)
          return
        }
        const { data, error: pageError } = await supabase.from('content_pages')
          .select('slug,title,introduction,body')
          .eq('slug', slug)
          .eq('published', true)
          .maybeSingle()
        if (pageError) throw pageError
        if (!active) return
        setContent(data)

        if (slug === 'faq') {
          const { data: faqData, error: faqError } = await supabase.from('faq_items')
            .select('id,question,answer')
            .eq('active', true)
            .order('sort_order')
            .order('created_at')
          if (faqError) throw faqError
          if (active) setFaqs(faqData ?? [])
        } else if (active) {
          setFaqs([])
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar esta página.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [slug])

  const title = content?.title ?? titles[slug] ?? 'Informações'
  const paragraphs = content?.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? []
  const isDemo = !supabase

  return (
    <>
      <Header />
      <main className="content-page page-shell">
        <div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><span>{title}</span></div>
        <article className="content-article">
          <span className="eyebrow">{settings.brand_name}</span>
          <h1>{title}</h1>
          {isDemo ? <div className="integration-alert" role="status"><strong>Conteúdo de demonstração.</strong><span>As informações institucionais serão exibidas aqui depois da configuração da loja.</span></div>
            : loading ? <p className="catalog-feedback" role="status">Carregando informações…</p>
              : error ? <p className="catalog-feedback catalog-feedback-error" role="alert">{error}</p>
                : !content ? <div className="content-unpublished"><h2>Conteúdo em preparação</h2><p>Esta página ainda não foi publicada pela administração da loja.</p><Link className="button button-dark" to="/">Voltar à loja</Link></div>
                  : <>
                    {content.introduction && <p className="content-introduction">{content.introduction}</p>}
                    {slug === 'faq' && faqs.length > 0 && <section className="faq-list" aria-label="Perguntas frequentes">{faqs.map((item) => <details key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
                    {paragraphs.map((paragraph, index) => <p className="content-paragraph" key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>)}
                    {slug === 'faq' && faqs.length === 0 && paragraphs.length === 0 && <p className="content-paragraph">Ainda não há perguntas publicadas.</p>}
                  </>}
        </article>
      </main>
      <Footer />
    </>
  )
}

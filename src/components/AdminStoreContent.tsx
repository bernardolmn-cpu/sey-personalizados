import { useEffect, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { z } from 'zod'
import { useStore, type StoreSettings } from '../context/StoreContext'
import { supabase } from '../integrations/supabase/client'

type Page = { slug: string; title: string; introduction: string; body: string; published: boolean }
type Faq = { id: string; question: string; answer: string; sort_order: number; active: boolean }
type PageSlug = Page['slug']

const pageLabels: Record<PageSlug, string> = {
  about: 'Quem somos',
  faq: 'Perguntas frequentes',
  shipping: 'Entregas e prazos',
  returns: 'Trocas e devoluções',
  privacy: 'Privacidade',
  terms: 'Termos de uso',
}

const settingsSchema = z.object({
  brand_name: z.string().trim().min(1, 'Informe o nome da loja.').max(80),
  tagline: z.string().max(160),
  announcement: z.string().max(180),
  contact_email: z.union([z.literal(''), z.email('Informe um e-mail válido.')]),
  instagram_url: z.union([z.literal(''), z.url().refine((url) => /^https:\/\/(www\.)?instagram\.com\//.test(url), 'Informe uma URL HTTPS do Instagram.')]),
  logo_url: z.union([z.literal(''), z.url().refine((url) => url.startsWith('https://'), 'Use uma URL HTTPS.')]),
  hero_title: z.string().trim().min(1, 'Informe o título da página inicial.').max(180),
  hero_description: z.string().max(500),
})
const faqSchema = z.object({
  question: z.string().trim().min(5, 'Escreva uma pergunta mais completa.').max(240),
  answer: z.string().trim().min(1, 'Informe a resposta.').max(3000),
})
const pageSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título.').max(120),
  introduction: z.string().max(500),
  body: z.string().max(20000),
  published: z.boolean(),
})

function requireClient() {
  if (!supabase) throw new Error('Configure o Supabase para editar o conteúdo da loja.')
  return supabase
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível salvar as alterações.'
}

export default function AdminStoreContent() {
  const { updateSettings, refresh: refreshStore } = useStore()
  const [settings, setSettings] = useState<StoreSettings>({
    brand_name: 'SEY PERSONALIZADOS',
    tagline: '',
    announcement: '',
    contact_email: '',
    instagram_url: '',
    logo_url: '',
    hero_title: 'Cartonagem e papelaria para suas ideias.',
    hero_description: 'Peças personalizadas para organizar, criar e presentear em cada ocasião.',
  })
  const [pages, setPages] = useState<Page[]>([])
  const [selectedPage, setSelectedPage] = useState<PageSlug>('about')
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [faqDraft, setFaqDraft] = useState({ question: '', answer: '' })
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = pages.find((page) => page.slug === selectedPage)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const client = requireClient()
      const [settingsResult, pagesResult, faqResult] = await Promise.all([
        client.from('store_settings').select('brand_name,tagline,announcement,contact_email,instagram_url,logo_url,hero_title,hero_description').eq('id', true).single(),
        client.from('content_pages').select('slug,title,introduction,body,published').order('slug'),
        client.from('faq_items').select('id,question,answer,sort_order,active').order('sort_order').order('created_at'),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (pagesResult.error) throw pagesResult.error
      if (faqResult.error) throw faqResult.error
      setSettings(settingsResult.data)
      setPages(pagesResult.data as Page[])
      setFaqs(faqResult.data as Faq[])
    } catch (loadError) {
      setError(errorText(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function updateSettingsField(field: keyof StoreSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = settingsSchema.parse(settings)
      const { error: saveError } = await requireClient().from('store_settings').update(data).eq('id', true)
      if (saveError) throw saveError
      updateSettings(data)
      await refreshStore()
      setNotice('Identidade da loja atualizada.')
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = pageSchema.parse(selected)
      const { error: saveError } = await requireClient().from('content_pages').update(data).eq('slug', selected.slug)
      if (saveError) throw saveError
      setNotice(`${pageLabels[selected.slug]} ${data.published ? 'publicada' : 'salva como rascunho'}.`)
      await load()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusy(false)
    }
  }

  function updateSelectedPage(field: keyof Omit<Page, 'slug'>, value: string | boolean) {
    setPages((current) => current.map((page) => page.slug === selectedPage ? { ...page, [field]: value } : page))
  }

  async function saveFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const values = faqSchema.parse(faqDraft)
      const client = requireClient()
      const result = editingFaqId
        ? await client.from('faq_items').update(values).eq('id', editingFaqId)
        : await client.from('faq_items').insert({ ...values, sort_order: faqs.length })
      if (result.error) throw result.error
      setFaqDraft({ question: '', answer: '' })
      setEditingFaqId(null)
      setNotice(editingFaqId ? 'Pergunta atualizada.' : 'Pergunta adicionada como rascunho.')
      await load()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleFaq(faq: Faq) {
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await requireClient().from('faq_items').update({ active: !faq.active }).eq('id', faq.id)
      if (updateError) throw updateError
      setNotice(faq.active ? 'Pergunta retirada do site.' : 'Pergunta publicada.')
      await load()
    } catch (updateError) {
      setError(errorText(updateError))
    } finally {
      setBusy(false)
    }
  }

  async function deleteFaq(faq: Faq) {
    if (!window.confirm(`Excluir a pergunta "${faq.question}"?`)) return
    setBusy(true)
    setError('')
    try {
      const { error: deleteError } = await requireClient().from('faq_items').delete().eq('id', faq.id)
      if (deleteError) throw deleteError
      setNotice('Pergunta removida.')
      await load()
    } catch (deleteError) {
      setError(errorText(deleteError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="catalog-feedback" role="status">Carregando conteúdo da loja…</p>

  return (
    <div className="store-content-admin">
      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {notice && <p className="admin-alert admin-alert-success" role="status">{notice}</p>}
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="eyebrow">MARCA E CONTATO</span><h3>Identidade da loja</h3></div></div>
        <p className="admin-empty">A logo da SEY PERSONALIZADOS e a paleta rosa da marca já estão aplicadas no cabeçalho e no rodapé. Se preferir outra versão da logo, informe abaixo uma URL pública HTTPS.</p>
        <div className="store-logo-preview"><img src={settings.logo_url || `${import.meta.env.BASE_URL}logo-sey-personalizados.png`} alt="Prévia da logo da loja" /></div>
        <form className="admin-form" onSubmit={(event) => void saveSettings(event)}>
          <div className="admin-form-grid">
            <label>Nome da loja<input maxLength={80} value={settings.brand_name} onChange={(event) => updateSettingsField('brand_name', event.target.value)} required /></label>
            <label>Frase da marca (opcional)<input maxLength={160} value={settings.tagline} onChange={(event) => updateSettingsField('tagline', event.target.value)} /></label>
            <label>Faixa de anúncio<input maxLength={180} value={settings.announcement} onChange={(event) => updateSettingsField('announcement', event.target.value)} placeholder="Deixe vazio para mostrar o nome da loja" /></label>
            <label>E-mail de contato<input type="email" maxLength={254} value={settings.contact_email} onChange={(event) => updateSettingsField('contact_email', event.target.value)} /></label>
            <label>Instagram (URL HTTPS)<input type="url" value={settings.instagram_url} onChange={(event) => updateSettingsField('instagram_url', event.target.value)} placeholder="https://instagram.com/sua-loja" /></label>
            <label>Substituir logo (opcional)<input type="url" value={settings.logo_url} onChange={(event) => updateSettingsField('logo_url', event.target.value)} placeholder="URL HTTPS; deixe vazio para usar a logo da SEY" /></label>
            <label>Título da página inicial<input maxLength={180} value={settings.hero_title} onChange={(event) => updateSettingsField('hero_title', event.target.value)} required /></label>
            <label>Texto de apresentação<textarea rows={3} maxLength={500} value={settings.hero_description} onChange={(event) => updateSettingsField('hero_description', event.target.value)} /></label>
          </div>
          <button className="button button-dark" type="submit" disabled={busy}><Save size={15} /> Salvar identidade</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="eyebrow">PÁGINAS DO SITE</span><h3>Quem somos e informações</h3></div></div>
        <p className="admin-empty">Preencha os textos com informações verdadeiras da sua operação. Rascunhos não aparecem ao público.</p>
        {selected && <form className="admin-form" onSubmit={(event) => void savePage(event)}>
          <label>Editar página<select value={selectedPage} onChange={(event) => setSelectedPage(event.target.value as PageSlug)}>{Object.entries(pageLabels).map(([slug, label]) => <option value={slug} key={slug}>{label}</option>)}</select></label>
          <label>Título<input maxLength={120} value={selected.title} onChange={(event) => updateSelectedPage('title', event.target.value)} required /></label>
          <label>Apresentação curta<textarea rows={2} maxLength={500} value={selected.introduction} onChange={(event) => updateSelectedPage('introduction', event.target.value)} /></label>
          <label>Conteúdo<textarea rows={9} maxLength={20000} value={selected.body} onChange={(event) => updateSelectedPage('body', event.target.value)} placeholder="Escreva um parágrafo por linha. Não inclua dados que ainda não confirmou." /></label>
          <label className="admin-banner-active"><input type="checkbox" checked={selected.published} onChange={(event) => updateSelectedPage('published', event.target.checked)} /> Publicar esta página</label>
          <button className="button button-dark" type="submit" disabled={busy}><Save size={15} /> Salvar página</button>
        </form>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="eyebrow">ATENDIMENTO</span><h3>Perguntas frequentes</h3></div></div>
        <div className="store-faq-admin-list">{faqs.map((faq) => <article className="store-faq-admin-row" key={faq.id}>
          <div><strong>{faq.question}</strong><p>{faq.answer}</p><small>{faq.active ? 'Publicada' : 'Rascunho'}</small></div>
          <div><button className="admin-icon-button" type="button" aria-label={`Editar pergunta ${faq.question}`} disabled={busy} onClick={() => { setEditingFaqId(faq.id); setFaqDraft({ question: faq.question, answer: faq.answer }) }}><Pencil size={14} /></button><button className="admin-icon-button" type="button" disabled={busy} onClick={() => void toggleFaq(faq)}>{faq.active ? <X size={14} /> : <Check size={14} />}</button><button className="admin-icon-button admin-delete" type="button" aria-label={`Excluir pergunta ${faq.question}`} disabled={busy} onClick={() => void deleteFaq(faq)}><Trash2 size={14} /></button></div>
        </article>)}</div>
        <form className="admin-form store-faq-form" onSubmit={(event) => void saveFaq(event)}>
          <h4>{editingFaqId ? 'Editar pergunta' : 'Adicionar pergunta'}</h4>
          <label>Pergunta<input maxLength={240} value={faqDraft.question} onChange={(event) => setFaqDraft((current) => ({ ...current, question: event.target.value }))} required /></label>
          <label>Resposta<textarea rows={4} maxLength={3000} value={faqDraft.answer} onChange={(event) => setFaqDraft((current) => ({ ...current, answer: event.target.value }))} required /></label>
          <div className="address-form-actions"><button className="button button-dark" type="submit" disabled={busy}><Plus size={15} /> {editingFaqId ? 'Salvar pergunta' : 'Adicionar como rascunho'}</button>{editingFaqId && <button className="back-link" type="button" onClick={() => { setEditingFaqId(null); setFaqDraft({ question: '', answer: '' }) }}>Cancelar</button>}</div>
        </form>
      </section>
    </div>
  )
}

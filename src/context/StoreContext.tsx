import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../integrations/supabase/client'

export type StoreSettings = {
  brand_name: string
  tagline: string
  announcement: string
  contact_email: string
  instagram_url: string
  logo_url: string
  hero_title: string
  hero_description: string
}

export type StoreCategory = {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

const initialSettings: StoreSettings = {
  brand_name: 'SEY PERSONALIZADOS',
  tagline: '',
  announcement: '',
  contact_email: '',
  instagram_url: '',
  logo_url: '',
  hero_title: 'Cartonagem e papelaria para suas ideias.',
  hero_description: 'Peças personalizadas para organizar, criar e presentear em cada ocasião.',
}

const demoCategories: StoreCategory[] = [
  { id: 'demo-cartonagem', name: 'Cartonagem', slug: 'cartonagem', parent_id: null },
  { id: 'demo-papelaria', name: 'Papelaria personalizada', slug: 'papelaria-personalizada', parent_id: null },
  { id: 'demo-cadernos', name: 'Cadernos e planners', slug: 'cadernos-e-planners', parent_id: null },
  { id: 'demo-caixas', name: 'Caixas e embalagens', slug: 'caixas-e-embalagens', parent_id: null },
  { id: 'demo-albuns', name: 'Álbuns e memórias', slug: 'albuns-e-memorias', parent_id: null },
  { id: 'demo-kits', name: 'Kits para presente', slug: 'kits-para-presente', parent_id: null },
]

type StoreContextValue = {
  settings: StoreSettings
  categories: StoreCategory[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  updateSettings: (settings: StoreSettings) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(initialSettings)
  const [categories, setCategories] = useState(isSupabaseConfigured ? [] : demoCategories)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  async function refresh() {
    if (!supabase) {
      setSettings(initialSettings)
      setCategories(demoCategories)
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const [settingsResult, categoryResult] = await Promise.all([
        supabase.from('store_settings').select('brand_name,tagline,announcement,contact_email,instagram_url,logo_url,hero_title,hero_description').eq('id', true).single(),
        supabase.from('categories').select('id,name,slug,parent_id').eq('active', true).is('parent_id', null).order('name'),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (categoryResult.error) throw categoryResult.error
      setSettings(settingsResult.data)
      setCategories(categoryResult.data ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as informações da loja.')
      throw loadError
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh().catch((loadError: unknown) => {
      console.error('Não foi possível carregar a identidade da loja.', loadError)
    })
  }, [])

  useEffect(() => {
    document.title = `${settings.brand_name} — loja oficial`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = settings.tagline || `Conheça a ${settings.brand_name}.`
  }, [settings.brand_name, settings.tagline])

  const value = useMemo<StoreContextValue>(() => ({
    settings,
    categories,
    loading,
    error,
    refresh,
    updateSettings: setSettings,
  }), [categories, error, loading, settings])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore precisa ser usado dentro de StoreProvider')
  return context
}

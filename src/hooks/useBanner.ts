import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'

export type SiteBanner = {
  eyebrow: string
  title: string
  description: string
  imageUrl: string
  ctaLabel: string
  destination: string
}

type BannerState = {
  banner: SiteBanner | null
  status: 'loading' | 'ready' | 'demo' | 'error'
  error: string
}

export function useBanner(): BannerState {
  const [state, setState] = useState<BannerState>({
    banner: null,
    status: supabase ? 'loading' : 'demo',
    error: '',
  })

  useEffect(() => {
    if (!supabase) {
      setState({ banner: null, status: 'demo', error: '' })
      return
    }
    let active = true
    async function loadBanner() {
      const { data, error } = await supabase!.from('site_banners')
        .select('eyebrow,title,description,image_url,cta_label,destination')
        .eq('active', true)
        .order('sort_order')
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (error) {
        setState({ banner: null, status: 'error', error: `Não foi possível carregar o banner: ${error.message}` })
        return
      }
      setState({
        banner: data ? {
          eyebrow: data.eyebrow,
          title: data.title,
          description: data.description,
          imageUrl: data.image_url,
          ctaLabel: data.cta_label,
          destination: data.destination,
        } : null,
        status: 'ready',
        error: '',
      })
    }
    void loadBanner().catch((error: unknown) => {
      console.error('Falha ao carregar o banner da página inicial.', error)
      if (active) setState({
        banner: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Não foi possível carregar o banner.',
      })
    })
    return () => { active = false }
  }, [])

  return state
}

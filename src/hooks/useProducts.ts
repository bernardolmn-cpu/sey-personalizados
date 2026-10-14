import { useEffect, useState } from 'react'
import { products as demoProducts } from '../data/products'
import { isSupabaseConfigured, supabase } from '../integrations/supabase/client'
import type { Product } from '../types'

type ProductQuery = {
  id: string
  name: string
  description: string
  price: number
  compare_at_price: number | null
  stock: number
  featured: boolean
  image_url: string
  created_at: string
  category: { name: string } | { name: string }[] | null
}

type ProductState = {
  products: Product[]
  status: 'loading' | 'ready' | 'demo' | 'error'
  error: string
}

function toProduct(row: ProductQuery): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: Array.isArray(row.category) ? row.category[0]?.name ?? 'Sem categoria' : row.category?.name ?? 'Sem categoria',
    price: Number(row.price),
    oldPrice: row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    stock: row.stock,
    featured: row.featured,
    image: row.image_url,
    createdAt: row.created_at,
    rating: undefined,
    reviews: undefined,
    sold: 0,
  }
}

export function useProducts(): ProductState {
  const [state, setState] = useState<ProductState>(() => ({
    products: isSupabaseConfigured ? [] : demoProducts,
    status: isSupabaseConfigured ? 'loading' : 'demo',
    error: '',
  }))

  useEffect(() => {
    if (!supabase) {
      setState({ products: demoProducts, status: 'demo', error: '' })
      return
    }

    let active = true
    async function loadProducts() {
      const { data, error } = await supabase!.from('products')
        .select('id,name,description,price,compare_at_price,stock,featured,image_url,created_at,category:categories(name)')
        .eq('published', true)
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) {
        setState({ products: [], status: 'error', error: `Não foi possível carregar o catálogo: ${error.message}` })
        return
      }
      setState({ products: (data ?? []).map((item) => toProduct(item as ProductQuery)), status: 'ready', error: '' })
    }

    void loadProducts().catch((error: unknown) => {
      console.error('Falha ao carregar produtos do Supabase.', error)
      if (active) setState({
        products: [],
        status: 'error',
        error: error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.',
      })
    })
    return () => { active = false }
  }, [])

  return state
}

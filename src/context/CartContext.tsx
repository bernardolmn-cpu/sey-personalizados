import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartItem, Product } from '../types'

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const storageKey = 'vitrine-cart-v1'

function isProductSnapshot(value: unknown): value is Product {
  if (typeof value !== 'object' || value === null) return false
  if (!('id' in value) || typeof value.id !== 'string' || !('name' in value) || typeof value.name !== 'string' ||
    !('category' in value) || typeof value.category !== 'string' ||
    !('price' in value) || typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price < 0 ||
    !('stock' in value) || typeof value.stock !== 'number' || !Number.isInteger(value.stock) || value.stock < 1 ||
    !('description' in value) || typeof value.description !== 'string' ||
    !('image' in value) || typeof value.image !== 'string' ||
    !('createdAt' in value) || typeof value.createdAt !== 'string') return false
  if ('oldPrice' in value && value.oldPrice !== undefined && (typeof value.oldPrice !== 'number' || !Number.isFinite(value.oldPrice) || value.oldPrice < value.price)) return false
  if ('rating' in value && value.rating !== undefined && (typeof value.rating !== 'number' || !Number.isFinite(value.rating) || value.rating < 0 || value.rating > 5)) return false
  if ('reviews' in value && value.reviews !== undefined && (typeof value.reviews !== 'number' || !Number.isInteger(value.reviews) || value.reviews < 0)) return false
  return true
}

function readCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): CartItem[] => {
      if (typeof item !== 'object' || item === null || !('product' in item) || !('quantity' in item)) return []
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) return []
      if (!isProductSnapshot(item.product)) return []
      const product = item.product
      return [{ product, quantity: Math.min(item.quantity, product.stock) }]
    })
  } catch (error) {
    console.error('Não foi possível carregar o carrinho local.', error)
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch (error) {
      console.error('Não foi possível salvar o carrinho neste navegador.', error)
    }
  }, [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.product.price * item.quantity, 0),
    addItem: (product) => setItems((current) => {
      if (product.stock < 1) return current
      const existing = current.find((item) => item.product.id === product.id)
      if (!existing) return [...current, { product, quantity: 1 }]
      if (existing.quantity >= product.stock) return current
      return current.map((item) => item.product.id === product.id
        ? { ...item, quantity: item.quantity + 1 }
        : item)
    }),
    removeItem: (productId) => setItems((current) => current.filter((item) => item.product.id !== productId)),
    setQuantity: (productId, quantity) => setItems((current) => current.flatMap((item) => {
      if (item.product.id !== productId) return [item]
      if (!Number.isInteger(quantity)) return [item]
      if (quantity <= 0) return []
      return [{ ...item, quantity: Math.min(quantity, item.product.stock) }]
    })),
    clear: () => setItems([]),
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart precisa ser usado dentro de CartProvider')
  return context
}

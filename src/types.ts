export type Product = {
  id: string
  name: string
  category: string
  price: number
  oldPrice?: number
  rating?: number
  reviews?: number
  image: string
  description: string
  badge?: string
  featured?: boolean
  sold?: number
  createdAt: string
  stock: number
}

export type CartItem = {
  product: Product
  quantity: number
}

import { supabase } from '../integrations/supabase/client'
import type { CartItem } from '../types'

export type ShippingAddress = {
  full_name: string
  phone: string
  postal_code: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export async function createCheckout(items: CartItem[], address: ShippingAddress, couponCode: string) {
  if (!supabase) throw new Error('O checkout ainda não está configurado.')
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      items: items.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
      shipping_address: address,
      coupon_code: couponCode.trim() || null,
    },
  })
  if (error) {
    if (error.context instanceof Response) {
      const responseBody: unknown = await error.context.json().catch(() => null)
      if (typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody && typeof responseBody.error === 'string') {
        throw new Error(responseBody.error)
      }
    }
    throw new Error(error.message)
  }
  if (typeof data !== 'object' || data === null || !('checkout_url' in data) ||
    typeof data.checkout_url !== 'string') {
    throw new Error('O checkout não retornou um endereço de pagamento válido.')
  }
  const checkoutUrl = new URL(data.checkout_url)
  if (checkoutUrl.protocol !== 'https:' ||
    !['www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(checkoutUrl.hostname)) {
    throw new Error('O provedor retornou um endereço de pagamento não autorizado.')
  }
  return { checkoutUrl: checkoutUrl.toString() }
}

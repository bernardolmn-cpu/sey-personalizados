import { describe, expect, it } from 'vitest'
import { createPreferenceItems, type PendingOrder } from '../supabase/functions/_shared/preference-items'

function order(overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    order_id: 'order-id',
    order_number: 'VT-EXAMPLE',
    subtotal: 30,
    discount_amount: 0,
    shipping_amount: 18.9,
    total: 48.9,
    expires_at: '2026-10-14T13:00:00.000Z',
    items: [
      { product_id: 'product-a', product_name: 'Caneca', unit_price: 10, quantity: 2 },
      { product_id: 'product-b', product_name: 'Vaso', unit_price: 10, quantity: 1 },
    ],
    ...overrides,
  }
}

describe('createPreferenceItems', () => {
  it('preserves the server-calculated subtotal and shipping when there is no coupon', () => {
    const items = createPreferenceItems(order())
    expect(items).toEqual([
      { id: 'product-a', title: 'Caneca', quantity: 2, unit_price: 10, currency_id: 'BRL' },
      { id: 'product-b', title: 'Vaso', quantity: 1, unit_price: 10, currency_id: 'BRL' },
      { id: 'shipping', title: 'Frete', quantity: 1, unit_price: 18.9, currency_id: 'BRL' },
    ])
  })

  it('allocates a fixed coupon exactly across units and keeps the provider total aligned', () => {
    const items = createPreferenceItems(order({ discount_amount: 7.01, total: 41.89 }))
    const totalCents = items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0)
    expect(totalCents).toBe(4189)
    expect(items.filter((item) => item.id !== 'shipping').reduce((sum, item) => sum + item.quantity, 0)).toBe(3)
  })

  it('does not create negative provider prices for a percentage discount', () => {
    const items = createPreferenceItems(order({
      discount_amount: 29.99,
      shipping_amount: 0,
      total: 0.01,
    }))
    expect(items.every((item) => item.unit_price >= 0)).toBe(true)
    expect(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0)).toBe(1)
  })

  it('rejects a client/provider total that does not match the order calculation', () => {
    expect(() => createPreferenceItems(order({ total: 999 }))).toThrow('O total do pedido não é compatível')
  })

  it('rejects item lines that do not reconcile to the subtotal', () => {
    expect(() => createPreferenceItems(order({
      items: [{ product_id: 'product-a', product_name: 'Caneca', unit_price: 2, quantity: 2 }],
    }))).toThrow('não correspondem ao subtotal')
  })

  it('rejects more units than the server-side checkout limit', () => {
    expect(() => createPreferenceItems(order({
      items: [{ product_id: 'product-a', product_name: 'Caneca', unit_price: 1, quantity: 31 }],
      subtotal: 31,
      discount_amount: 0,
      shipping_amount: 18.9,
      total: 49.9,
    }))).toThrow('inválido')
  })
})

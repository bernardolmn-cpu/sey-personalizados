import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyMercadoPagoSignature } from '../supabase/functions/_shared/mercadopago-signature'

const secret = 'test-webhook-secret'
const requestId = 'request-123'
const dataId = '123456'
const timestamp = '1704908010'
const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`
const signature = createHmac('sha256', secret).update(manifest).digest('hex')

describe('Mercado Pago webhook signature', () => {
  it('accepts a valid HMAC signature over the notification manifest', async () => {
    await expect(verifyMercadoPagoSignature(secret, `ts=${timestamp},v1=${signature}`, requestId, dataId)).resolves.toBe(true)
  })

  it('rejects a signature for a different request id, payment id, or secret', async () => {
    await expect(verifyMercadoPagoSignature(secret, `ts=${timestamp},v1=${signature}`, 'other-request', dataId)).resolves.toBe(false)
    await expect(verifyMercadoPagoSignature(secret, `ts=${timestamp},v1=${signature}`, requestId, '654321')).resolves.toBe(false)
    await expect(verifyMercadoPagoSignature('wrong-secret', `ts=${timestamp},v1=${signature}`, requestId, dataId)).resolves.toBe(false)
  })

  it('rejects missing or malformed signature fields', async () => {
    await expect(verifyMercadoPagoSignature(secret, `ts=${timestamp}`, requestId, dataId)).resolves.toBe(false)
    await expect(verifyMercadoPagoSignature(secret, 'ts=not-a-number,v1=xyz', requestId, dataId)).resolves.toBe(false)
  })
})

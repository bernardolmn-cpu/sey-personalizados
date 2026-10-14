import { supabase } from '../integrations/supabase/client'

export type CustomerAddress = {
  id: string
  label: string
  full_name: string
  phone: string
  postal_code: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  is_default: boolean
}

export type CustomerAddressInput = Omit<CustomerAddress, 'id'>

function requireSupabase() {
  if (!supabase) throw new Error('Configure o Supabase para gerenciar endereços.')
  return supabase
}

export async function listCustomerAddresses(): Promise<CustomerAddress[]> {
  const { data, error } = await requireSupabase()
    .from('customer_addresses')
    .select('id,label,full_name,phone,postal_code,street,number,complement,neighborhood,city,state,is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CustomerAddress[]
}

export async function saveCustomerAddress(address: CustomerAddressInput, id?: string) {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Entre na sua conta para salvar um endereço.')

  const { error } = await client.from('customer_addresses').upsert({
    ...address,
    user_id: user.id,
    postal_code: address.postal_code.replace(/\D/g, ''),
    state: address.state.trim().toUpperCase(),
    ...(id ? { id } : {}),
  }, { onConflict: 'id' })
  if (error) throw error
}

export async function deleteCustomerAddress(id: string) {
  const { error } = await requireSupabase()
    .from('customer_addresses')
    .delete()
    .eq('id', id)
  if (error) throw error
}

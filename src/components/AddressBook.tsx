import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { deleteCustomerAddress, listCustomerAddresses, saveCustomerAddress, type CustomerAddress, type CustomerAddressInput } from '../services/addresses'

const addressSchema = z.object({
  label: z.string().trim().min(1, 'Informe um nome para identificar o endereço.').max(60),
  full_name: z.string().trim().min(2, 'Informe o nome de quem receberá.').max(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{7,19}$/, 'Informe um telefone válido com DDD.'),
  postal_code: z.string().trim().regex(/^[0-9]{5}-?[0-9]{3}$/, 'Informe um CEP válido.'),
  street: z.string().trim().min(2, 'Informe o endereço.').max(160),
  number: z.string().trim().min(1, 'Informe o número.').max(20),
  complement: z.string().max(100),
  neighborhood: z.string().trim().min(2, 'Informe o bairro.').max(100),
  city: z.string().trim().min(2, 'Informe a cidade.').max(100),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Informe a sigla do estado.'),
  is_default: z.boolean(),
})

type AddressValues = z.infer<typeof addressSchema>

const emptyAddress: AddressValues = {
  label: '',
  full_name: '',
  phone: '',
  postal_code: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  is_default: false,
}

function formValues(address: CustomerAddress): AddressValues {
  return {
    ...address,
    postal_code: address.postal_code.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
  }
}

export default function AddressBook({ defaultName = '' }: { defaultName?: string }) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { ...emptyAddress, full_name: defaultName, is_default: true },
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAddresses(await listCustomerAddresses())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus endereços.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  function startNewAddress() {
    setEditingId(null)
    form.reset({ ...emptyAddress, full_name: defaultName, is_default: addresses.length === 0 })
    setFormOpen(true)
    setError('')
    setNotice('')
  }

  function startEdit(address: CustomerAddress) {
    setEditingId(address.id)
    form.reset(formValues(address))
    setFormOpen(true)
    setError('')
    setNotice('')
  }

  async function submit(values: AddressValues) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const address: CustomerAddressInput = {
        ...values,
        state: values.state.toUpperCase(),
        is_default: values.is_default || addresses.length === 0,
      }
      await saveCustomerAddress(address, editingId ?? undefined)
      setNotice(editingId ? 'Endereço atualizado.' : 'Endereço salvo.')
      setFormOpen(false)
      setEditingId(null)
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o endereço.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(address: CustomerAddress) {
    if (!window.confirm(`Remover o endereço "${address.label}"?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await deleteCustomerAddress(address.id)
      setNotice('Endereço removido.')
      await refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover o endereço.')
    } finally {
      setBusy(false)
    }
  }

  async function makeDefault(address: CustomerAddress) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await saveCustomerAddress({ ...address, is_default: true }, address.id)
      setNotice('Endereço padrão atualizado.')
      await refresh()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Não foi possível atualizar o endereço padrão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="address-book">
      <div className="address-book-heading">
        <div><span className="eyebrow">ENTREGA</span><h2>Meus endereços</h2></div>
        {!formOpen && <button className="button button-light" type="button" onClick={startNewAddress}><Plus size={15} /> Adicionar endereço</button>}
      </div>
      <p>Salve seus endereços para preencher a entrega mais rapidamente na próxima compra.</p>
      {error && <div className="form-feedback form-feedback-error" role="alert">{error}</div>}
      {notice && <div className="form-feedback" role="status">{notice}</div>}
      {loading ? <p className="catalog-feedback" role="status">Carregando endereços…</p> : addresses.length === 0 && !formOpen ? <div className="address-empty"><MapPin size={20} /><span>Nenhum endereço salvo ainda.</span></div> : <div className="saved-address-list">{addresses.map((address) => (
        <article className="saved-address" key={address.id}>
          <div className="saved-address-heading"><strong><MapPin size={15} /> {address.label}</strong>{address.is_default && <span><Star size={12} fill="currentColor" /> Padrão</span>}</div>
          <p>{address.full_name} · {address.phone}<br />{address.street}, {address.number}{address.complement ? `, ${address.complement}` : ''}<br />{address.neighborhood}, {address.city} - {address.state} · {address.postal_code}</p>
          <div className="saved-address-actions">
            {!address.is_default && <button type="button" disabled={busy} onClick={() => void makeDefault(address)}>Tornar padrão</button>}
            <button type="button" aria-label={`Editar endereço ${address.label}`} disabled={busy} onClick={() => startEdit(address)}><Pencil size={14} /> Editar</button>
            <button type="button" aria-label={`Remover endereço ${address.label}`} disabled={busy} onClick={() => void remove(address)}><Trash2 size={14} /> Remover</button>
          </div>
        </article>
      ))}</div>}
      {formOpen && <form className="address-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <div className="address-form-heading"><h3>{editingId ? 'Editar endereço' : 'Novo endereço'}</h3><button type="button" className="admin-icon-button" aria-label="Cancelar edição" onClick={() => { setFormOpen(false); setEditingId(null) }}><X size={15} /></button></div>
        <div className="checkout-fields">
          <label>Identificação<input autoComplete="off" placeholder="Casa, trabalho…" {...form.register('label')} />{form.formState.errors.label && <small>{form.formState.errors.label.message}</small>}</label>
          <label>Nome completo<input autoComplete="name" {...form.register('full_name')} />{form.formState.errors.full_name && <small>{form.formState.errors.full_name.message}</small>}</label>
          <label>Telefone<input type="tel" autoComplete="tel" placeholder="(11) 99999-9999" {...form.register('phone')} />{form.formState.errors.phone && <small>{form.formState.errors.phone.message}</small>}</label>
          <label>CEP<input autoComplete="postal-code" placeholder="00000-000" {...form.register('postal_code')} />{form.formState.errors.postal_code && <small>{form.formState.errors.postal_code.message}</small>}</label>
          <label>Endereço<input autoComplete="street-address" {...form.register('street')} />{form.formState.errors.street && <small>{form.formState.errors.street.message}</small>}</label>
          <label>Número<input {...form.register('number')} />{form.formState.errors.number && <small>{form.formState.errors.number.message}</small>}</label>
          <label>Complemento<input {...form.register('complement')} />{form.formState.errors.complement && <small>{form.formState.errors.complement.message}</small>}</label>
          <label>Bairro<input autoComplete="address-level3" {...form.register('neighborhood')} />{form.formState.errors.neighborhood && <small>{form.formState.errors.neighborhood.message}</small>}</label>
          <label>Cidade<input autoComplete="address-level2" {...form.register('city')} />{form.formState.errors.city && <small>{form.formState.errors.city.message}</small>}</label>
          <label>Estado (UF)<input autoComplete="address-level1" maxLength={2} {...form.register('state')} />{form.formState.errors.state && <small>{form.formState.errors.state.message}</small>}</label>
        </div>
        <label className="address-default-checkbox"><input type="checkbox" {...form.register('is_default')} /><span>Usar como endereço padrão</span></label>
        <div className="address-form-actions"><button className="button button-dark" type="submit" disabled={busy}><Check size={15} /> {busy ? 'Salvando…' : 'Salvar endereço'}</button><button className="back-link" type="button" disabled={busy} onClick={() => { setFormOpen(false); setEditingId(null) }}>Cancelar</button></div>
      </form>}
    </section>
  )
}

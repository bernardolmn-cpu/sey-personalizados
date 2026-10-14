import { Link } from 'react-router-dom'
import { useStore } from '../context/StoreContext'

export default function Brand({ footer = false }: { footer?: boolean }) {
  const { settings } = useStore()
  const name = settings.brand_name || 'SEY PERSONALIZADOS'
  const logo = settings.logo_url || `${import.meta.env.BASE_URL}logo-sey-personalizados.png`

  return (
    <Link className={`brand${footer ? ' footer-brand' : ''}`} to="/" aria-label={`${name} — página inicial`}>
      <img className="brand-logo" src={logo} alt="" />
      {settings.logo_url && <span className="brand-name">{name}</span>}
    </Link>
  )
}

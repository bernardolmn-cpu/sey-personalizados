import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type FavoritesContextValue = {
  favoriteIds: string[]
  toggleFavorite: (id: string) => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)
const storageKey = 'vitrine-favorites-v1'

function readFavorites(): string[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      throw new Error('Formato inesperado para os favoritos armazenados.')
    }
    return parsed
  } catch (error) {
    console.error('Não foi possível carregar os favoritos locais.', error)
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState(readFavorites)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(favoriteIds))
    } catch (error) {
      console.error('Não foi possível salvar os favoritos neste navegador.', error)
    }
  }, [favoriteIds])

  const value = useMemo(() => ({
    favoriteIds,
    toggleFavorite: (id: string) => setFavoriteIds((current) =>
      current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id],
    ),
  }), [favoriteIds])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites precisa ser usado dentro de FavoritesProvider')
  return context
}

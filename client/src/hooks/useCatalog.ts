import { useEffect, useState, useCallback } from 'react'
import { CatalogResponse } from '../types'
import api from '../lib/api'

export function useCatalog() {
  const [data, setData]       = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchCatalog = useCallback(async () => {
    try {
      const { data: res } = await api.get<CatalogResponse>('/catalogo')
      setData(res)
      setError(null)
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo cargar la carta')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCatalog()

    const es = new EventSource('/api/catalogo/events')
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string }
        if (msg.type === 'catalog_update') fetchCatalog()
      } catch {
        // ping o payload malformado — ignorar
      }
    }
    // El navegador reintenta solo si hay error, pero callbackeamos por las dudas
    es.onerror = () => {
      // EventSource reconecta automáticamente (~3s)
    }

    return () => es.close()
  }, [fetchCatalog])

  return { data, loading, error, refetch: fetchCatalog }
}

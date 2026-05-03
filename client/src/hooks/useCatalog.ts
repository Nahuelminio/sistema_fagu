import { useEffect, useState, useCallback } from 'react'
import { CatalogResponse } from '../types'
import api from '../lib/api'

export function useCatalog() {
  const [data, setData] = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCatalog = useCallback(async () => {
    const { data: res } = await api.get<CatalogResponse>('/catalogo')
    setData(res)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCatalog()

    const es = new EventSource('/api/catalogo/events')
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string }
      if (msg.type === 'catalog_update') fetchCatalog()
    }

    return () => es.close()
  }, [fetchCatalog])

  return { data, loading, refetch: fetchCatalog }
}

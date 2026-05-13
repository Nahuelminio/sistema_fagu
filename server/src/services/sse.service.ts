import { Response } from 'express'

const clients = new Set<Response>()

export function addClient(res: Response): void {
  clients.add(res)
  res.on('close', () => clients.delete(res))
  res.on('error', () => clients.delete(res))
}

export function broadcastCatalogUpdate(): void {
  const data = `data: ${JSON.stringify({ type: 'catalog_update' })}\n\n`
  clients.forEach((res) => {
    try {
      res.write(data)
    } catch {
      // Si el socket está cerrado, lo removemos para que no rompa el loop
      clients.delete(res)
    }
  })
}

// Keep-alive: evita que proxies/reverse cierren conexiones SSE idle
setInterval(() => {
  clients.forEach((res) => {
    try { res.write(': ping\n\n') } catch { clients.delete(res) }
  })
}, 25_000)

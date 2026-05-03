import { Response } from 'express'

const clients = new Set<Response>()

export function addClient(res: Response): void {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

export function broadcastCatalogUpdate(): void {
  const data = `data: ${JSON.stringify({ type: 'catalog_update' })}\n\n`
  clients.forEach((res) => res.write(data))
}

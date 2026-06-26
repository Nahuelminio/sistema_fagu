import { TragoBotella } from '../types'

/**
 * Costo por oz de un ingrediente, considerando su grupo.
 *
 * Si el producto pertenece a un grupo con varias variantes, promediamos
 * (costPrice / bottleSize) entre todas las variantes con datos completos.
 * Esto refleja la realidad de que el bar puede usar cualquier variante
 * del grupo para hacer el trago.
 *
 * Si el producto no tiene grupo, usamos su propio costPrice / bottleSize
 * (o capacidad de la botella abierta si la hay).
 */
export function costoPorOzIngrediente(ing: TragoBotella): number {
  const grupo = ing.product.grupo
  if (grupo?.products && grupo.products.length > 0) {
    const costosPorOz: number[] = []
    for (const variante of grupo.products) {
      const precio   = Number(variante.costPrice ?? 0)
      const capacidad = Number(variante.bottleSize ?? 0)
      if (precio > 0 && capacidad > 0) costosPorOz.push(precio / capacidad)
    }
    if (costosPorOz.length > 0) {
      return costosPorOz.reduce((s, c) => s + c, 0) / costosPorOz.length
    }
  }
  const precio = Number(ing.product.costPrice ?? 0)
  const capacidad =
    Number(ing.product.botellaActiva?.capacidad ?? 0) ||
    Number(ing.product.bottleSize ?? 0)
  return capacidad > 0 ? precio / capacidad : 0
}

/** Costo parcial de un ingrediente (oz × costo por oz). null si no se puede calcular. */
export function costoIngrediente(ing: TragoBotella): number | null {
  const c = costoPorOzIngrediente(ing)
  if (c <= 0) return null
  return Number(ing.cantidad) * c
}

/** Costo total del trago. */
export function costoTotalTrago(ings: TragoBotella[]): number {
  return ings.reduce((sum, ing) => sum + Number(ing.cantidad) * costoPorOzIngrediente(ing), 0)
}

/** True si TODOS los ingredientes tienen costo calculable. */
export function costoEsCompleto(ings: TragoBotella[]): boolean {
  for (const ing of ings) {
    if (Number(ing.cantidad) <= 0) continue
    if (costoPorOzIngrediente(ing) <= 0) return false
  }
  return true
}

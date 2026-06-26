/**
 * Cálculo de costo de un trago.
 *
 * Para cada ingrediente con grupo: el costo por oz se calcula como el
 * PROMEDIO de (costPrice / bottleSize) de todos los productos del grupo
 * que tengan ambos valores cargados. Así si tenés Bombay ($35.750) y
 * Beefeater ($22.270) en el grupo "Gin Importado", el costo del trago
 * refleja un valor intermedio, no un costo fijo.
 *
 * Para ingredientes sin grupo: usa el costo del propio producto.
 *
 * Si no se puede calcular (sin precio, sin tamaño, etc.) devuelve null.
 */

type ProductoMin = {
  costPrice: { toString(): string } | string | number | null
  bottleSize: { toString(): string } | string | number | null
}

type GrupoMin = {
  products?: ProductoMin[]
}

type IngredienteMin = {
  cantidad: { toString(): string } | string | number
  product: ProductoMin & {
    grupo?: GrupoMin | null
    botellaActiva?: { capacidad: { toString(): string } | string | number } | null
  }
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

/** Devuelve el costo por oz para un ingrediente, considerando grupo. */
export function costoPorOzIngrediente(ing: IngredienteMin): number {
  const grupo = ing.product.grupo
  // Si el producto pertenece a un grupo con varios productos válidos,
  // promediar el costo por oz de todos los que tengan datos completos.
  if (grupo?.products && grupo.products.length > 0) {
    const costosPorOz: number[] = []
    for (const variante of grupo.products) {
      const precio = toNum(variante.costPrice)
      const capacidad = toNum(variante.bottleSize)
      if (precio > 0 && capacidad > 0) {
        costosPorOz.push(precio / capacidad)
      }
    }
    if (costosPorOz.length > 0) {
      return costosPorOz.reduce((s, c) => s + c, 0) / costosPorOz.length
    }
    // si el grupo no tiene ningún producto con datos → fallback al propio producto
  }

  const precio = toNum(ing.product.costPrice)
  const capacidad =
    toNum(ing.product.botellaActiva?.capacidad) || toNum(ing.product.bottleSize)
  return capacidad > 0 ? precio / capacidad : 0
}

/** Costo total de un trago (suma de costos por ingrediente). */
export function costoTotalTrago(ingredientes: IngredienteMin[]): number {
  return ingredientes.reduce((sum, ing) => {
    const cantidad = toNum(ing.cantidad)
    return sum + cantidad * costoPorOzIngrediente(ing)
  }, 0)
}

/** True si TODOS los ingredientes tienen costo calculable (>0). */
export function costoEsCompleto(ingredientes: IngredienteMin[]): boolean {
  for (const ing of ingredientes) {
    const cantidad = toNum(ing.cantidad)
    if (cantidad <= 0) continue
    if (costoPorOzIngrediente(ing) <= 0) return false
  }
  return true
}

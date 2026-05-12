/**
 * Calcula el nuevo costPrice usando Costo Promedio Ponderado (CPP).
 *
 * Fórmula:
 *   nuevoCosto = (stockActual × costoActual + cantidadNueva × costoNuevo)
 *                / (stockActual + cantidadNueva)
 *
 * Edge cases:
 *  - Si no hay stock previo o no hay costo previo: usa el costo nuevo
 *  - Si el costo nuevo es 0 o null: NO actualiza (devuelve el costo actual)
 *  - El total se redondea a 2 decimales (centavos)
 *
 * Es el método contable aceptado por AFIP en Argentina (junto con PEPS).
 */
export function calcularCostoPromedioPonderado(args: {
  stockActual:   number
  costoActual:   number | null | undefined
  cantidadNueva: number
  costoNuevo:    number | null | undefined
}): number | null {
  const { stockActual, cantidadNueva } = args
  const costoActual = Number(args.costoActual ?? 0)
  const costoNuevo  = Number(args.costoNuevo  ?? 0)

  // Sin costo nuevo no podemos calcular nada útil — mantenemos el actual
  if (!costoNuevo || costoNuevo <= 0) return null

  // Si no había stock previo o no había costo cargado, usamos el costo nuevo
  if (stockActual <= 0 || costoActual <= 0) {
    return Math.round(costoNuevo * 100) / 100
  }

  const totalValor    = stockActual * costoActual + cantidadNueva * costoNuevo
  const totalUnidades = stockActual + cantidadNueva
  const promedio      = totalValor / totalUnidades

  return Math.round(promedio * 100) / 100
}

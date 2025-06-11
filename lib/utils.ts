
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combina múltiples nombres de clase o arrays de valores de clase en una única cadena,
 * resolviendo conflictos de clases de Tailwind CSS.
 * Utiliza `clsx` para la unión flexible de nombres de clase y `tailwind-merge` para la resolución de conflictos.
 *
 * @param {...ClassValue[]} inputs - Una lista de nombres de clase o arrays de valores de clase.
 * @returns {string} Una cadena de nombres de clase combinados y fusionados.
 *
 * @example
 * cn("p-4", "bg-red-500", { "text-white": true }); // "p-4 bg-red-500 text-white"
 * cn("p-2", "p-4"); // "p-4" (tailwind-merge resuelve el conflicto)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

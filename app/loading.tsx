
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Componente de carga que se muestra durante las transiciones de ruta de Next.js o cuando se están obteniendo datos.
 * Utiliza componentes Skeleton de ShadCN UI para proporcionar una indicación visual del estado de carga.
 * Esto ayuda a mejorar la experiencia del usuario al mostrar que el contenido está en camino.
 *
 * @returns {JSX.Element} La interfaz de usuario del estado de carga.
 */
export default function Loading(): JSX.Element {
  // Esta UI se mostrará como alternativa mientras se carga el contenido de la página.
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
       {/* Esqueleto para un título o encabezado de página */}
       <Skeleton className="h-10 w-1/3" />

       {/* Esqueleto para un bloque de contenido (p. ej., pestañas y tabla) */}
       <div className="space-y-4">
          <Skeleton className="h-10 w-full" /> {/* Podría representar la navegación por pestañas */}
          <Skeleton className="h-64 w-full" /> {/* Podría representar una tabla o un área de contenido grande */}
       </div>

       {/* Esqueleto para otro bloque de contenido */}
       <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
       </div>
    </div>
    )
}

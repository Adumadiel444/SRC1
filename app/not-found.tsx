
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * El componente NotFound se muestra cuando un usuario navega a una ruta que no existe (error 404).
 * Proporciona un mensaje amigable para el usuario y un enlace para volver a la página de inicio.
 *
 * @returns {JSX.Element} La interfaz de usuario de la página de error 404.
 */
export default function NotFound(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] text-center px-4 py-10">
      <Card className="w-full max-w-lg shadow-xl border border-border/60">
        <CardHeader className="items-center">
          <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
          <CardTitle className="text-4xl font-bold text-foreground">Error 404</CardTitle>
          <CardDescription className="text-xl text-muted-foreground pt-2">
            Página No Encontrada
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 pt-2 pb-8">
          <p className="text-muted-foreground max-w-sm">
            Lo sentimos, la página que estás buscando no existe, ha sido movida o no tienes permiso para acceder a ella.
          </p>
          <Button asChild size="lg" className="mt-4">
            <Link href="/">Volver al Inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

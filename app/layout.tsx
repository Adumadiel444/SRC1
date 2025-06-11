
'use client'; // Convertir RootLayout en un componente cliente para usar hooks

import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import Header from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { InventoryProvider } from '@/context/InventoryContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation'; // Importar useRouter y usePathname
import React, { useEffect } from 'react'; // Importar useEffect

/**
 * Metadatos para la aplicación.
 * Nota: El objeto Metadata en sí mismo no puede ser dinámico en la exportación de un componente cliente.
 * Para títulos dinámicos, normalmente usarías `document.title` en un useEffect o un componente Head dentro de las páginas.
 * Estos metadatos estáticos se aplicarán de forma general.
 */
// export const metadata: Metadata = { // Los metadatos estáticos se pueden definir fuera
//   title: 'Centro de Inventario Belleza',
//   description: 'Gestión de inventario para negocios de belleza',
// };


/**
 * El componente ProtectedRoutes maneja la redirección para usuarios no autenticados.
 * Verifica el estado de autenticación y redirige a la página de inicio de sesión si es necesario.
 *
 * @param {Readonly<{ children: React.ReactNode }>} props - Las props para el componente.
 * @param {React.ReactNode} props.children - Los componentes hijos que se renderizarán.
 * @returns {JSX.Element | null} Los hijos si está autenticado, o null si está redirigiendo.
 */
function ProtectedRoutes({ children }: Readonly<{ children: React.ReactNode }>): JSX.Element | null {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!currentUser || currentUser.id === 'user-0') && pathname !== '/login') {
      router.push('/login');
    }
  }, [currentUser, isLoading, router, pathname]);

  // Mientras se carga, o si el usuario no está autenticado y está en la página de login, o si el usuario está autenticado
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><p>Cargando aplicación...</p></div>; // O un spinner de carga adecuado
  }

  if ((!currentUser || currentUser.id === 'user-0') && pathname !== '/login') {
    return null; // No renderizar nada mientras se redirige
  }

  return <>{children}</>;
}


/**
 * Componente de diseño raíz para la aplicación.
 * Este componente envuelve todas las páginas y proporciona elementos de diseño globales como
 * encabezado, pie de página y proveedores de contexto.
 * También incluye protección de rutas.
 *
 * @param {Readonly<{ children: React.ReactNode }>} props - Las props para el componente.
 * @param {React.ReactNode} props.children - Los componentes hijos que se renderizarán dentro del diseño.
 * @returns {JSX.Element} La estructura del diseño raíz.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  // Establecer el título dinámicamente para el componente cliente
  useEffect(() => {
    document.title = 'Centro de Inventario Belleza';
  }, []);
  
  return (
    <html lang="es">
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <AuthProvider>
          <InventoryProvider>
            <ProtectedRoutes>
              <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-grow container mx-auto px-4 py-10 md:py-12">
                    {children}
                  </main>
                  {/* Pie de página opcional
                  <footer className="border-t py-4 text-center text-sm text-muted-foreground">
                      © 2024 Centro de Inventario Belleza
                  </footer>
                  */}
              </div>
              <Toaster />
            </ProtectedRoutes>
          </InventoryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

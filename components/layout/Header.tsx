
'use client'; 

import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { Package, ShoppingCart, Truck, Menu, Store, LogOut, LogIn, PackageSearch, Layers, Receipt, PackageIcon, Banknote, AlertTriangle, BarChart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from '@/context/AuthContext'; 
import { Separator } from '@/components/ui/separator';
import React, { useMemo } from 'react';

/**
 * Componente de encabezado para la aplicación.
 * Proporciona enlaces de navegación para vistas de escritorio y móviles.
 * Incluye un botón de Cerrar Sesión si un usuario está autenticado.
 */
export default function Header(): JSX.Element {
  const { currentUser, logout, isLoading } = useAuth(); 
  const router = useRouter(); 

  const isAdmin = useMemo(() => currentUser?.allowedPOS.includes('*'), [currentUser]);

  const navItems = [
    { href: "/", label: "Inventario", icon: Package, adminOnly: false },
    { href: "/product-descriptions", label: "Descripciones", icon: PackageIcon, adminOnly: false },
    { href: "/out-of-stock", label: "Agotados", icon: PackageSearch, adminOnly: false },
    { href: "/low-stock", label: "Casi Agotados", icon: AlertTriangle, adminOnly: false },
    { href: "/sales", label: "Ventas", icon: ShoppingCart, adminOnly: false },
    { href: "/wholesale-sales", label: "Ventas al Por Mayor", icon: Layers, adminOnly: false },
    { href: "/suppliers", label: "Proveedores", icon: Truck, adminOnly: false },
    { href: "/invoices", label: "Facturas", icon: Receipt, adminOnly: false }, 
    { href: "/caja", label: "Caja", icon: Banknote, adminOnly: true },
    { href: "/grafica", label: "Gráfica", icon: BarChart, adminOnly: false },
  ];

  const visibleNavItems = navItems.filter(item => !item.adminOnly || (item.adminOnly && isAdmin));

  const handleLogout = () => {
    logout(); 
  };

  const isAuthenticated = currentUser && currentUser.id !== 'user-0';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center px-4 md:px-6">
        <div className="mr-6 hidden items-center md:flex">
          <Link href="/" className="mr-8 flex items-center space-x-2 group">
             <Store className="h-6 w-6 text-primary group-hover:text-primary/90 transition-colors" />
            <span className="font-semibold text-lg group-hover:text-foreground/80 transition-colors">Centro Inv. Belleza</span>
          </Link>
          {isAuthenticated && ( 
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center transition-colors hover:text-primary text-foreground/70"
                >
                  <item.icon className="mr-1.5 h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="hidden md:flex flex-grow"></div>

        {isAuthenticated && ( 
          <div className="hidden md:flex items-center gap-4 ml-auto">
            <span className="text-sm text-muted-foreground">
              Hola, <span className="font-medium text-foreground">{currentUser.name}</span>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoading}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        )}

        <div className="flex flex-1 items-center justify-between md:hidden">
           <Link href="/" className="flex items-center space-x-2">
             <Store className="h-6 w-6 text-primary" />
             <span className="font-semibold">Centro Belleza</span>
          </Link>

          {isAuthenticated && ( 
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-md">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir Menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
                 <div className="p-6 border-b">
                    <Link href="/" className="flex items-center space-x-2 mb-2">
                       <Store className="h-6 w-6 text-primary" />
                       <span className="font-semibold text-lg">Centro Inv. Belleza</span>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Usuario: <span className="font-medium text-foreground">{currentUser.name}</span>
                    </p>
                 </div>
                 <nav className="flex-1 grid gap-2 p-4 text-base font-medium">
                    {visibleNavItems.map((item) => (
                     <SheetClose asChild key={item.href}>
                         <Link
                           href={item.href}
                           className="flex items-center space-x-3 rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground text-foreground/80"
                         >
                           <item.icon className="h-5 w-5 text-muted-foreground" />
                           <span>{item.label}</span>
                         </Link>
                     </SheetClose>
                    ))}
                 </nav>
                  <Separator />
                  <div className="p-4 mt-auto">
                      <Button variant="outline" className="w-full" onClick={handleLogout} disabled={isLoading}>
                          <LogOut className="mr-2 h-4 w-4" />
                          Cerrar Sesión
                      </Button>
                  </div>
              </SheetContent>
            </Sheet>
          )}
          {!isAuthenticated && !isLoading && (
             <Button asChild variant="outline" size="sm">
                <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Iniciar Sesión
                </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

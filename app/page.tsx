
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InventoryTable from '@/components/inventory/InventoryTable';
// import OutOfStockTable, { type OutOfStockProduct } from '@/components/inventory/OutOfStockTable'; // Eliminado ya que ahora es una página separada
import { useInventoryContext } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'; // Importaciones ajustadas
import { Lock } from 'lucide-react';

/**
 * Componente de la página de inicio que muestra el resumen del inventario.
 * Muestra los datos del inventario en pestañas, categorizados por punto de venta.
 * El acceso a los puntos de venta se determina según los permisos del usuario actual.
 *
 * @returns {JSX.Element} La interfaz de usuario de la página de inicio.
 */
export default function Home(): JSX.Element {
  const { inventory, isInventoryLoaded, getPointsOfSaleForUser } = useInventoryContext();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  // Obtener los puntos de venta accesibles para el usuario actual
  const accessiblePointsOfSale = useMemo(() => getPointsOfSaleForUser(), [getPointsOfSaleForUser]);

  /**
   * Hook useEffect para actualizar la pestaña activa cuando el usuario actual o sus
   * puntos de venta accesibles cambian. Si la pestaña activa actual ya no es
   * accesible, se restablece a la primera accesible.
   */
  useEffect(() => {
    if (accessiblePointsOfSale.length > 0) {
      if (!activeTab || !accessiblePointsOfSale.includes(activeTab)) {
        setActiveTab(accessiblePointsOfSale[0]);
      }
    } else {
      setActiveTab(undefined); // Sin PDV accesibles, sin pestaña activa
    }
  }, [accessiblePointsOfSale, activeTab]);


  // Manejar estados de carga para la autenticación y los datos del inventario
  if (isAuthLoading || !isInventoryLoaded) {
    // Mostrar UI de esqueleto de carga mientras se obtienen los datos
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-1/3 mb-6" /> {/* Esqueleto del título */}
        {/* Esqueleto de las pestañas */}
        <div className="flex space-x-1 p-1 bg-muted rounded-md h-10 mb-4">
          <Skeleton className="flex-1 h-full rounded-sm" />
          <Skeleton className="flex-1 h-full rounded-sm" />
        </div>
        {/* Esqueleto del contenido */}
        <div className="space-y-6 pt-4">
          <Skeleton className="h-64 w-full" />{/* Esqueleto de la tabla */}
        </div>
      </div>
    );
  }

  // Manejar caso donde el usuario no tiene puntos de venta accesibles
  if (accessiblePointsOfSale.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Resumen de Inventario</h1>
        <Card className="w-full text-center shadow-none border-dashed">
          <CardHeader>
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Acceso Denegado o Sin Ubicaciones</CardTitle>
            <CardDescription>
              {currentUser && currentUser.id !== 'user-0'
                ? `El usuario "${currentUser.name}" no tiene acceso a ninguna ubicación de inventario.`
                : "Por favor, inicie sesión con un usuario con permisos de acceso."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Determinar los activadores de pestañas y el valor de pestaña predeterminado para el componente Tabs
  const tabTriggers = [...accessiblePointsOfSale];
  const defaultTabValue = activeTab && tabTriggers.includes(activeTab) 
                          ? activeTab 
                          : (accessiblePointsOfSale.length > 0 ? accessiblePointsOfSale[0] : undefined);

  if (!defaultTabValue && accessiblePointsOfSale.length > 0) {
     // Este caso idealmente no debería ocurrir debido a que useEffect establece activeTab
     return (
      <div className="flex items-center justify-center h-screen"><p>Cargando Puntos de Venta...</p></div>
    );
  }
   if (!defaultTabValue && accessiblePointsOfSale.length === 0) {
    // Cubierto por la verificación principal de accessiblePointsOfSale.length === 0 anterior.
    // Esta verificación explícita puede eliminarse o ser una alternativa si es necesario.
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Resumen de Inventario</h1>
        <Card className="w-full text-center shadow-none border-dashed">
          <CardHeader>
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Sin Ubicaciones Disponibles</CardTitle>
            <CardDescription>
              No hay puntos de venta configurados o accesibles para mostrar inventario.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Resumen de Inventario</h1>

      {/* Pestañas dinámicas basadas en los puntos de venta ACCESIBLES */}
      {defaultTabValue && (
        <Tabs value={defaultTabValue} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-${Math.min(Math.max(1, tabTriggers.length), 4)} mb-4`}>
            {accessiblePointsOfSale.map((pos) => (
              <TabsTrigger key={pos} value={pos}>{pos}</TabsTrigger>
            ))}
          </TabsList>

          {accessiblePointsOfSale.map((pos) => (
            <TabsContent key={pos} value={pos} className="mt-6">
              <InventoryTable
                inventoryData={inventory[pos] || {}}
                pointOfSale={pos}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

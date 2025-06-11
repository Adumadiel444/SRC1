
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import LowStockTable, { type GroupedLowStockProducts } from '@/components/inventory/LowStockTable';
import { useInventoryContext } from '@/context/InventoryContext';
import type { InventoryData, Product } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock, PackageOpen, Search, Barcode } from 'lucide-react';

const DEFAULT_LOW_STOCK_THRESHOLD = 5; // Umbral global por defecto

/**
 * La página LowStockPage muestra todos los productos que tienen bajo stock
 * (cantidad <= umbral personalizado o global, y > 0)
 * en todos los puntos de venta accesibles para el usuario actual, agrupados por marca y filtrables por búsqueda.
 *
 * @returns {JSX.Element} La interfaz de usuario de la página de bajo stock.
 */
export default function LowStockPage(): JSX.Element {
  const { inventory, isInventoryLoaded, getPointsOfSaleForUser } = useInventoryContext();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const accessiblePointsOfSale = useMemo(() => getPointsOfSaleForUser(), [getPointsOfSaleForUser]);

  /**
   * Objeto memoizado de productos con bajo stock, agrupados por marca y filtrados por searchTerm.
   * Itera a través de los puntos de venta accesibles y su inventario para encontrar productos con baja cantidad,
   * considerando umbrales personalizados por producto o el umbral global.
   */
  const lowStockProductsByBrand = useMemo((): GroupedLowStockProducts => {
    const groupedProducts: GroupedLowStockProducts = {};
    if (!isInventoryLoaded || accessiblePointsOfSale.length === 0) {
      return groupedProducts;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    accessiblePointsOfSale.forEach(pos => {
      const posInventory: InventoryData = inventory[pos] || {};
      Object.entries(posInventory).forEach(([brand, products]) => {
        if (Array.isArray(products)) {
          products.forEach(product => {
            const threshold = (product.lowStockThreshold != null && product.lowStockThreshold > 0)
              ? product.lowStockThreshold
              : DEFAULT_LOW_STOCK_THRESHOLD;

            if (product.quantity > 0 && product.quantity <= threshold) {
              const matchesSearch = lowerSearchTerm === "" ||
                product.name.toLowerCase().includes(lowerSearchTerm) ||
                product.barcode.toLowerCase().includes(lowerSearchTerm) ||
                brand.toLowerCase().includes(lowerSearchTerm);
              
              if (matchesSearch) {
                const brandKey = brand || "Marca Desconocida";
                if (!groupedProducts[brandKey]) {
                  groupedProducts[brandKey] = [];
                }
                const existingProductIndex = groupedProducts[brandKey].findIndex(
                  p => p.barcode === product.barcode && p.pointOfSale === pos
                );
                if (existingProductIndex === -1) {
                    groupedProducts[brandKey].push({ ...product, pointOfSale: pos });
                }
              }
            }
          });
        }
      });
    });

    for (const brand in groupedProducts) {
        groupedProducts[brand].sort((a, b) => a.name.localeCompare(b.name));
    }

    const sortedBrands = Object.keys(groupedProducts).sort();
    const sortedGroupedProducts: GroupedLowStockProducts = {};
    sortedBrands.forEach(brand => {
        sortedGroupedProducts[brand] = groupedProducts[brand];
    });

    return sortedGroupedProducts;
  }, [inventory, isInventoryLoaded, accessiblePointsOfSale, searchTerm]);


  if (isAuthLoading || !isInventoryLoaded) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (accessiblePointsOfSale.length === 0 && currentUser && currentUser.id !== 'user-0') {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Productos Casi Agotados</h1>
        <Card className="w-full text-center shadow-none border-dashed">
          <CardHeader>
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Sin Acceso a Ubicaciones</CardTitle>
            <CardDescription>
              {`El usuario "${currentUser.name}" no tiene acceso a ninguna ubicación de inventario para verificar productos con stock bajo.`}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  const totalProductsInitiallyLowStock = useMemo(() => {
    let count = 0;
     accessiblePointsOfSale.forEach(pos => {
        const posInventory = inventory[pos] || {};
        Object.values(posInventory).flat().forEach(prod => {
             const threshold = (prod.lowStockThreshold != null && prod.lowStockThreshold > 0)
                ? prod.lowStockThreshold
                : DEFAULT_LOW_STOCK_THRESHOLD;
             if(prod.quantity > 0 && prod.quantity <= threshold) count++;
        });
    });
    return count;
  }, [inventory, accessiblePointsOfSale, isInventoryLoaded]);


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Productos Casi Agotados</h1>
        <AlertTriangle className="h-8 w-8 text-primary" />
      </div>
      <p className="text-muted-foreground">
        Listado de productos con {DEFAULT_LOW_STOCK_THRESHOLD} unidades o menos (o según umbral personalizado), pero más de 0. Puedes buscar por nombre, código o marca.
      </p>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Buscar por nombre, código de barras o marca..."
            className="pl-10 w-full h-11 rounded-md shadow-sm border-border/70"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" aria-label="Escanear código de barras" className="h-11 w-11 rounded-md shadow-sm border-border/70" onClick={() => searchInputRef.current?.focus()}>
          <Barcode className="h-5 w-5"/>
        </Button>
      </div>

      <LowStockTable productsByBrand={lowStockProductsByBrand} searchTerm={searchTerm} totalInitially={totalProductsInitiallyLowStock} defaultLowStockThreshold={DEFAULT_LOW_STOCK_THRESHOLD}/>
    </div>
  );
}

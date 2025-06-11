
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useInventoryContext, type Product, type InventoryData } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PackageIcon, Lock, PackageOpen, Search, Barcode } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

// SVG de marcador de posición para imágenes de productos si la imagen real no se carga o no está disponible.
const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

// Interfaz para un producto que incluye su información de punto de venta,
// utilizada específicamente dentro de la lógica de esta página.
interface DescribedProduct extends Product {
  pointOfSale: string; // Para saber de qué PDV proviene, si es necesario para la visualización
}

// Interfaz para agrupar productos descritos por su nombre de marca.
interface GroupedDescribedProducts {
  [brandName: string]: DescribedProduct[];
}


/**
 * La página ProductDescriptionsPage muestra productos y sus descripciones,
 * agrupados por marca, desde los puntos de venta accesibles.
 * Permite a los usuarios ver información detallada sobre los productos,
 * lo cual es especialmente útil para comprender las características y usos del producto.
 * Incluye funcionalidad de búsqueda.
 *
 * @returns {JSX.Element} La interfaz de usuario para la página de descripciones de productos.
 */
export default function ProductDescriptionsPage(): JSX.Element {
  const { inventory, isInventoryLoaded, getPointsOfSaleForUser } = useInventoryContext();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Lista memoizada de puntos de venta accesibles para el usuario actual.
  const accessiblePointsOfSale = useMemo(() => getPointsOfSaleForUser(), [getPointsOfSaleForUser]);

  /**
   * Lista memoizada y agrupada de productos que tienen descripciones, filtrada por searchTerm.
   * Itera a través de los puntos de venta accesibles, encuentra productos con descripciones,
   * los filtra, los agrupa por marca y ordena las marcas y productos alfabéticamente.
   */
  const productsWithDescriptionsByBrand = useMemo((): GroupedDescribedProducts => {
    const grouped: GroupedDescribedProducts = {};
    if (!isInventoryLoaded || accessiblePointsOfSale.length === 0) {
      return grouped;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    let allDescribedProducts: DescribedProduct[] = [];

    accessiblePointsOfSale.forEach(pos => {
      const posInventory: InventoryData = inventory[pos] || {};
      Object.entries(posInventory).forEach(([brand, products]) => {
        if (Array.isArray(products)) {
          products.forEach(product => {
            if (product.description && product.description.trim() !== "") {
              const matchesSearch = lowerSearchTerm === "" ||
                product.name.toLowerCase().includes(lowerSearchTerm) ||
                product.barcode.toLowerCase().includes(lowerSearchTerm) ||
                brand.toLowerCase().includes(lowerSearchTerm);

              if (matchesSearch) {
                // Evitar duplicados si el mismo producto (barcode) existe en múltiples PDVs accesibles con descripción
                if (!allDescribedProducts.some(p => p.barcode === product.barcode && p.pointOfSale === pos)) {
                    allDescribedProducts.push({ ...product, pointOfSale: pos });
                }
              }
            }
          });
        }
      });
    });

    // Agrupar por marca
    allDescribedProducts.forEach(product => {
        const brandKey = product.brand || "Marca Desconocida";
        if (!grouped[brandKey]) {
            grouped[brandKey] = [];
        }
        grouped[brandKey].push(product);
    });
    
    for (const brand in grouped) {
        grouped[brand].sort((a, b) => a.name.localeCompare(b.name));
    }

    const sortedBrands = Object.keys(grouped).sort();
    const sortedGroupedProducts: GroupedDescribedProducts = {};
    sortedBrands.forEach(brand => {
        sortedGroupedProducts[brand] = grouped[brand];
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
        <h1 className="text-3xl font-bold text-foreground mb-6">Descripciones de Productos</h1>
        <Card className="w-full text-center shadow-none border-dashed">
          <CardHeader>
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Acceso Denegado o Sin Ubicaciones</CardTitle>
            <CardDescription>
              {`El usuario "${currentUser.name}" no tiene acceso a ninguna ubicación de inventario para ver descripciones.`}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  const brandsWithDescriptions = Object.keys(productsWithDescriptionsByBrand);
  const totalProductsWithDescriptionInitially = useMemo(() => {
    let count = 0;
    accessiblePointsOfSale.forEach(pos => {
        const posInventory = inventory[pos] || {};
        Object.values(posInventory).flat().forEach(prod => {
            if(prod.description && prod.description.trim() !== "") count++;
        });
    });
    return count;
  }, [inventory, accessiblePointsOfSale, isInventoryLoaded]);


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Descripciones de Productos</h1>
        <PackageIcon className="h-8 w-8 text-primary" />
      </div>
      <p className="text-muted-foreground">
        Consulta las descripciones y funciones de los productos disponibles en tu inventario. Puedes buscar por nombre, código o marca.
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

      {brandsWithDescriptions.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={brandsWithDescriptions}>
          {brandsWithDescriptions.map((brand) => (
            <AccordionItem value={brand} key={brand} className="border border-border/60 rounded-lg shadow-sm overflow-hidden bg-card">
              <AccordionTrigger className="text-lg font-semibold px-6 py-4 hover:bg-muted/30 transition-colors">
                {brand}
                <Badge variant="secondary" className="ml-3">{productsWithDescriptionsByBrand[brand].length} producto(s) con descripción</Badge>
              </AccordionTrigger>
              <AccordionContent className="px-1 pt-0 pb-2">
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Descripciones para productos de la marca {brand}.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px] pl-6">Imagen</TableHead>
                        <TableHead>Nombre Producto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="w-[150px]">Punto de Venta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsWithDescriptionsByBrand[brand].map((product) => (
                        <TableRow key={`${product.id}-${product.pointOfSale}`} className="hover:bg-muted/20">
                          <TableCell className="pl-6">
                            <Image
                              src={product.imageUrl || placeholderSvg}
                              alt={product.name || "Imagen del producto"}
                              width={50}
                              height={50}
                              className="rounded-md object-cover border border-border/50 shadow-sm"
                              data-ai-hint={product["data-ai-hint"] || "producto belleza"}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src !== placeholderSvg) {
                                  target.src = placeholderSvg;
                                }
                                target.onerror = null;
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap max-w-md">{product.description}</TableCell>
                          <TableCell>{product.pointOfSale}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Card className="w-full text-center shadow-none border-dashed border-border/80 mt-8">
          <CardHeader>
            <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>
              {searchTerm ? "Sin Resultados de Búsqueda" : "Sin Descripciones Disponibles"}
            </CardTitle>
            <CardDescription>
              {searchTerm
                ? `Tu búsqueda de "${searchTerm}" no coincidió con ningún producto con descripción en las ubicaciones accesibles.`
                : totalProductsWithDescriptionInitially > 0
                    ? "No hay productos que coincidan con los criterios actuales o las ubicaciones accesibles no tienen productos con descripción."
                    : "No se encontraron productos con descripciones en las ubicaciones accesibles. Puedes añadir descripciones en la sección de 'Proveedores'."
              }
            </CardDescription>
          </CardHeader>
           {searchTerm && (
              <CardContent>
                  <Button variant="outline" onClick={() => setSearchTerm("")}>Limpiar Búsqueda</Button>
              </CardContent>
           )}
        </Card>
      )}
    </div>
  );
}

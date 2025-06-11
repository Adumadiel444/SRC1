
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Image from 'next/image';
import { AlertTriangle, PackageOpen, Search } from "lucide-react";
import type { Product } from '@/context/InventoryContext';
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Importar Tooltip

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGxcPSJjY2MiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjZweCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+";

export interface LowStockProduct extends Product {
  pointOfSale: string;
}

export interface GroupedLowStockProducts {
  [brandName: string]: LowStockProduct[];
}

interface LowStockTableProps {
  productsByBrand: GroupedLowStockProducts;
  searchTerm: string;
  totalInitially: number;
  defaultLowStockThreshold: number; // Umbral global por defecto
}

/**
 * El componente LowStockTable muestra una lista de productos que tienen baja cantidad,
 * agrupados por marca en un acordeón.
 * Muestra detalles como la imagen del producto, nombre, código de barras, su punto de venta y la cantidad actual.
 * Considera umbrales de bajo stock personalizados.
 *
 * @param {LowStockTableProps} props - Las props para el componente.
 * @param {GroupedLowStockProducts} props.productsByBrand - Los productos con bajo stock agrupados por marca.
 * @param {string} props.searchTerm - El término de búsqueda actual.
 * @param {number} props.totalInitially - El número total de productos inicialmente con bajo stock.
 * @param {number} props.defaultLowStockThreshold - El umbral global por defecto para bajo stock.
 * @returns {JSX.Element} La interfaz de usuario de la tabla de bajo stock con acordeones.
 */
export default function LowStockTable({ productsByBrand, searchTerm, totalInitially, defaultLowStockThreshold }: LowStockTableProps): JSX.Element {
  const brandsWithLowStockProducts = Object.keys(productsByBrand).filter(
    brand => productsByBrand[brand] && productsByBrand[brand].length > 0
  );

  if (brandsWithLowStockProducts.length === 0) {
    return (
      <Card className="w-full text-center shadow-none border-dashed border-border/80 mt-8">
        <CardHeader>
          {searchTerm ? <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" /> : <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" /> }
          <CardTitle>
            {searchTerm ? "Sin Resultados de Búsqueda" : (totalInitially > 0 ? "Productos con Bajo Stock Filtrados" : "¡Buen Stock!")}
          </CardTitle>
          <CardDescription>
            {searchTerm
              ? `Tu búsqueda de "${searchTerm}" no coincidió con ningún producto con bajo stock en las ubicaciones accesibles.`
              : (totalInitially > 0 ? "Todos los productos con bajo stock han sido filtrados o ya no cumplen los criterios." : `No hay productos con stock bajo (cantidad menor o igual a ${defaultLowStockThreshold} o su umbral personalizado) en tus ubicaciones accesibles en este momento.`)
            }
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }


  return (
    <TooltipProvider>
      <Accordion type="multiple" className="w-full space-y-4" defaultValue={brandsWithLowStockProducts}>
        {brandsWithLowStockProducts.map((brand) => (
          <AccordionItem value={brand} key={brand} className="border border-border/60 rounded-lg shadow-sm overflow-hidden bg-card">
            <AccordionTrigger className="text-lg font-semibold px-6 py-4 hover:bg-muted/30 transition-colors">
              {brand}
              <Badge variant="secondary" className="ml-3">{productsByBrand[brand].length} producto(s) con stock bajo</Badge>
            </AccordionTrigger>
            <AccordionContent className="px-1 pt-0 pb-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Productos con stock bajo de la marca {brand}.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px] pl-6">Imagen</TableHead>
                      <TableHead>Nombre Producto</TableHead>
                      <TableHead>Código Barras</TableHead>
                      <TableHead>Punto de Venta</TableHead>
                      <TableHead className="text-center pr-6 w-[150px]">Cantidad (Umbral)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsByBrand[brand].map((product) => {
                      const threshold = (product.lowStockThreshold != null && product.lowStockThreshold > 0)
                        ? product.lowStockThreshold
                        : defaultLowStockThreshold;
                      const isCustomThreshold = product.lowStockThreshold != null && product.lowStockThreshold > 0;

                      return (
                        <TableRow key={`${product.id}-${product.pointOfSale}`} className="hover:bg-muted/20">
                          <TableCell className="pl-6">
                            <Image
                              src={product.imageUrl || `https://placehold.co/50x50.png`}
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
                          <TableCell className="text-muted-foreground font-mono text-xs">{product.barcode}</TableCell>
                          <TableCell>{product.pointOfSale}</TableCell>
                          <TableCell className="text-center pr-6">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="px-1.5 py-0.5 text-xs cursor-default">
                                  <AlertTriangle className="h-3 w-3 mr-1" /> {product.quantity} / {threshold}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Cantidad actual: {product.quantity}</p>
                                <p>Umbral {isCustomThreshold ? "personalizado" : "global"}: {threshold}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </TooltipProvider>
  );
}

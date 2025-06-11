
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
import { PackageOpen, AlertCircle, Search } from "lucide-react";
import type { Product } from '@/context/InventoryContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGxcPSJjY2MiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjZweCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+";

export interface OutOfStockProduct extends Product {
  pointOfSale: string;
}

export interface GroupedOutOfStockProducts {
  [brandName: string]: OutOfStockProduct[];
}

interface OutOfStockTableProps {
  productsByBrand: GroupedOutOfStockProducts;
  searchTerm: string;
  totalInitially: number;
}

/**
 * El componente OutOfStockTable muestra una lista de productos que tienen cantidad cero,
 * agrupados por marca en un acordeón.
 * Muestra detalles como la imagen del producto, nombre, código de barras y su punto de venta.
 *
 * @param {OutOfStockTableProps} props - Las props para el componente.
 * @param {GroupedOutOfStockProducts} props.productsByBrand - Los productos agotados agrupados por marca.
 * @param {string} props.searchTerm - El término de búsqueda actual.
 * @param {number} props.totalInitially - El número total de productos inicialmente agotados antes de aplicar el filtro de búsqueda.
 * @returns {JSX.Element} La interfaz de usuario de la tabla de productos agotados con acordeones.
 */
export default function OutOfStockTable({ productsByBrand, searchTerm, totalInitially }: OutOfStockTableProps): JSX.Element {
  const brandsWithOutOfStockProducts = Object.keys(productsByBrand).filter(
    brand => productsByBrand[brand] && productsByBrand[brand].length > 0
  );

  if (brandsWithOutOfStockProducts.length === 0) {
    return (
      <Card className="w-full text-center shadow-none border-dashed border-border/80 mt-8">
        <CardHeader>
          {searchTerm ? <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" /> : <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" /> }
          <CardTitle>
            {searchTerm ? "Sin Resultados de Búsqueda" : (totalInitially > 0 ? "Productos Agotados Filtrados" : "¡Todo en Orden!")}
          </CardTitle>
          <CardDescription>
            {searchTerm
              ? `Tu búsqueda de "${searchTerm}" no coincidió con ningún producto agotado en las ubicaciones accesibles.`
              : (totalInitially > 0 ? "Todos los productos agotados han sido filtrados por su búsqueda actual o ya no cumplen los criterios." : "No hay productos agotados en tus ubicaciones accesibles en este momento.")
            }
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Accordion type="multiple" className="w-full space-y-4" defaultValue={brandsWithOutOfStockProducts}>
      {brandsWithOutOfStockProducts.map((brand) => (
        <AccordionItem value={brand} key={brand} className="border border-border/60 rounded-lg shadow-sm overflow-hidden bg-card">
          <AccordionTrigger className="text-lg font-semibold px-6 py-4 hover:bg-muted/30 transition-colors">
            {brand}
            <Badge variant="secondary" className="ml-3">{productsByBrand[brand].length} producto(s) agotado(s)</Badge>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-0 pb-2">
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>Productos agotados de la marca {brand}.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] pl-6">Imagen</TableHead>
                    <TableHead>Nombre Producto</TableHead>
                    <TableHead>Código Barras</TableHead>
                    <TableHead>Punto de Venta</TableHead>
                    <TableHead className="text-center pr-6 w-[120px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsByBrand[brand].map((product) => (
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
                        <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" /> Agotado
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

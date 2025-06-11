
'use client';

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
} from "@/components/ui/table";
import Image from 'next/image';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Barcode, AlertCircle, PackageOpen } from "lucide-react";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { InventoryData, Product } from '@/context/InventoryContext';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Función de debounce para limitar la frecuencia con la que se llama a una función.
 * @template F - El tipo de la función a la que se aplica debounce.
 * @param {F} func - La función a la que se aplica debounce.
 * @param {number} delay - El retardo en milisegundos.
 * @returns {(...args: Parameters<F>) => void} Una nueva función que solo llamará a `func` después de `delay` milisegundos.
 */
const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<F>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

// SVG de marcador de posición para imágenes de productos si la imagen real no se carga o no está disponible.
const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGxcPSJjY2MiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjZweCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+";


/**
 * Props para el componente InventoryTable.
 * @interface InventoryTableProps
 */
interface InventoryTableProps {
  /**
   * Los datos del inventario para un punto de venta específico, agrupados por marca.
   * @type {InventoryData}
   */
  inventoryData: InventoryData;
  /**
   * El nombre del punto de venta para el cual se está mostrando el inventario.
   * @type {string}
   */
  pointOfSale: string;
}

/**
 * El componente InventoryTable muestra los productos para un punto de venta dado.
 * Presenta funcionalidad de búsqueda con sugerencias y agrupa los productos por marca en un acordeón.
 * Los artículos con bajo stock y agotados se resaltan.
 *
 * @param {InventoryTableProps} props - Las props para el componente.
 * @returns {JSX.Element} La interfaz de usuario de la tabla de inventario.
 */
export default function InventoryTable({ inventoryData, pointOfSale }: InventoryTableProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState<InventoryData>(inventoryData);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  /**
   * Filtra los datos del inventario basándose en un término de búsqueda.
   * Coincide con el nombre del producto, el código de barras y la marca.
   * @param {InventoryData} data - Los datos del inventario a filtrar.
   * @param {string} term - El término de búsqueda.
   * @returns {InventoryData} Los datos del inventario filtrados.
   */
  const filterInventory = useCallback((data: InventoryData, term: string): InventoryData => {
     if (!term) { // Si no hay término de búsqueda, devolver todos los datos
      return data;
    }
    const lowerCaseTerm = term.toLowerCase();
    const newFilteredData: InventoryData = {};

    Object.entries(data).forEach(([brand, products]) => {
       const safeProducts = Array.isArray(products) ? products : [];
      const filteredProducts = safeProducts.filter(product =>
        product.name.toLowerCase().includes(lowerCaseTerm) ||
        product.barcode.includes(lowerCaseTerm) ||
        brand.toLowerCase().includes(lowerCaseTerm)
      );
      if (filteredProducts.length > 0) {
        newFilteredData[brand] = filteredProducts;
      }
    });
    return newFilteredData;
  }, []);

  /**
   * Genera sugerencias de búsqueda basadas en el término de entrada.
   * @param {InventoryData} data - Los datos del inventario donde buscar.
   * @param {string} term - El término de búsqueda.
   * @param {number} [limit=7] - El número máximo de sugerencias a devolver.
   * @returns {Product[]} Un array de sugerencias de productos.
   */
   const generateSuggestions = useCallback((data: InventoryData, term: string, limit: number = 7): Product[] => {
       if (!term.trim()) {
           return [];
       }
       const lowerCaseTerm = term.toLowerCase();
       const results: Product[] = [];

       for (const brand in data) {
           const safeProducts = Array.isArray(data[brand]) ? data[brand] : [];
           for (const product of safeProducts) {
               if (results.length >= limit) break;
               if (
                   product.name.toLowerCase().includes(lowerCaseTerm) ||
                   product.barcode.includes(lowerCaseTerm) ||
                   brand.toLowerCase().includes(lowerCaseTerm)
               ) {
                   results.push(product);
               }
           }
           if (results.length >= limit) break;
       }
       return results;
   }, []);

   // Función de búsqueda con debounce para actualizar datos filtrados y sugerencias.
   const debouncedSearch = useMemo(
       () => debounce((term: string) => {
           const filtered = filterInventory(inventoryData, term);
           setFilteredData(filtered);

           const suggs = generateSuggestions(inventoryData, term);
           setSuggestions(suggs);
           setIsSuggestionsOpen(term.length > 0 && suggs.length > 0);
           setActiveSuggestionIndex(-1);
       }, 300), // Retardo de debounce de 300ms
       [inventoryData, filterInventory, generateSuggestions]
   );

   // Efecto para ejecutar la búsqueda con debounce cuando searchTerm cambia.
   useEffect(() => {
       debouncedSearch(searchTerm);
   }, [searchTerm, debouncedSearch]);

    // Efecto para actualizar los datos filtrados cuando inventoryData o searchTerm cambian.
    // Esto asegura que la tabla refleje las actualizaciones externas del inventario o la búsqueda borrada.
    useEffect(() => {
        const filtered = filterInventory(inventoryData, searchTerm);
        setFilteredData(filtered);
        if (searchTerm.trim() === "") {
          setIsSuggestionsOpen(false);
          setSuggestions([]);
        }
    }, [inventoryData, searchTerm, filterInventory]);

  /**
   * Maneja los cambios en el campo de entrada de búsqueda.
   * Actualiza el estado de searchTerm y gestiona la visibilidad de las sugerencias.
   * @param {React.ChangeEvent<HTMLInputElement>} event - El evento de cambio del input.
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);

    if (newSearchTerm.length > 0) {
        const newSuggestions = generateSuggestions(inventoryData, newSearchTerm);
        setSuggestions(newSuggestions);
        setIsSuggestionsOpen(newSuggestions.length > 0);
        setActiveSuggestionIndex(-1);
    } else {
      setIsSuggestionsOpen(false);
      setSuggestions([]);
    }
  };

  /**
   * Maneja el clic en una sugerencia de búsqueda.
   * Establece el término de búsqueda al nombre del producto, filtra los datos y cierra las sugerencias.
   * @param {Product} product - El producto seleccionado de las sugerencias.
   */
   const handleSuggestionClick = (product: Product) => {
      setSearchTerm(product.name); // Establecer la barra de búsqueda al nombre del producto
      const filtered = filterInventory(inventoryData, product.name); // Filtrar por este nombre
      setFilteredData(filtered);
      setIsSuggestionsOpen(false); 
      setSuggestions([]); 
      setActiveSuggestionIndex(-1);
      searchInputRef.current?.focus(); // Devolver el foco al input de búsqueda
   };

  /**
   * Maneja la navegación por teclado (ArrowUp, ArrowDown, Enter, Escape) para las sugerencias de búsqueda.
   * @param {React.KeyboardEvent<HTMLInputElement>} event - El evento de teclado.
   */
   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionsOpen || suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
          event.preventDefault();
          handleSuggestionClick(suggestions[activeSuggestionIndex]);
        }
        break;
      case 'Escape':
        setIsSuggestionsOpen(false);
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        break;
    }
  };


  return (
    <div className="space-y-6">
       {/* Input de Búsqueda y Botón de Escaneo de Código de Barras */}
       <div className="flex gap-2 mb-6">
         <Popover open={isSuggestionsOpen && searchTerm.trim().length > 0 && suggestions.length > 0} onOpenChange={(open) => {
             if (!open) {
                // Retrasar el cierre de las sugerencias para permitir el clic en el ítem de sugerencia.
                setTimeout(() => {
                    if (!document.activeElement?.closest(`#search-suggestions-${pointOfSale}`)) {
                        setIsSuggestionsOpen(false);
                    }
                }, 100);
             } else {
                setIsSuggestionsOpen(true);
             }
         }}>
           <PopoverTrigger asChild>
             <div className="relative flex-grow">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
               <Input
                 id={`inventory-search-input-${pointOfSale}`}
                 ref={searchInputRef}
                 type="search"
                 placeholder="Buscar por nombre, código de barras o marca..."
                 className="pl-10 w-full h-11 rounded-md shadow-sm border-border/70"
                 value={searchTerm}
                 onChange={handleSearchChange}
                 onKeyDown={handleKeyDown}
                 onFocus={() => { // Mostrar sugerencias al enfocar si hay un término de búsqueda
                     if (searchTerm.trim().length > 0) {
                        const currentSuggestions = generateSuggestions(inventoryData, searchTerm);
                        if (currentSuggestions.length > 0) {
                           setSuggestions(currentSuggestions);
                           setIsSuggestionsOpen(true);
                        }
                     }
                 }}
                 aria-autocomplete="list"
                 aria-controls={`search-suggestions-${pointOfSale}`}
                 autoComplete="off"
               />
             </div>
           </PopoverTrigger>
           {/* Contenido del Popover para Sugerencias de Búsqueda */}
           <PopoverContent
                id={`search-suggestions-${pointOfSale}`}
                className="w-[--radix-popover-trigger-width] p-0" // Coincidir con el ancho del activador
                align="start"
                sideOffset={5}
                onOpenAutoFocus={(e) => e.preventDefault()} // Evitar que el popover robe el foco
            >
             <div className="max-h-60 overflow-y-auto">
               {suggestions.map((product, index) => (
                 <button
                   key={product.id}
                   className={`flex items-center w-full px-4 py-2 text-sm focus:outline-none ${activeSuggestionIndex === index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/80'}`}
                   onClick={() => handleSuggestionClick(product)}
                   onMouseDown={(e) => e.preventDefault()} // Evitar el desenfoque del input al hacer clic
                   role="option"
                   aria-selected={activeSuggestionIndex === index}
                 >
                    <Image
                       src={product.imageUrl || `https://placehold.co/30x30.png`}
                       alt={product.name || "Imagen del producto"}
                       width={30}
                       height={30}
                       className="rounded-sm object-cover mr-3 border border-border/30"
                       data-ai-hint={product["data-ai-hint"] || "producto belleza"}
                       onError={(e) => { // Alternativa al SVG de marcador de posición si la imagen no se carga
                         const target = e.target as HTMLImageElement;
                         if (target.src !== placeholderSvg) {
                           target.src = placeholderSvg;
                         }
                         target.onerror = null; 
                       }}
                    />
                   <div className="flex-grow text-left">
                       <span className="font-medium">{product.name}</span>
                       <span className="text-xs text-muted-foreground ml-2">({product.brand})</span>
                   </div>
                   <span className="text-xs text-muted-foreground ml-auto">{product.barcode}</span>
                 </button>
               ))}
             </div>
           </PopoverContent>
         </Popover>

         {/* Botón de Escaneo de Código de Barras (solo visual, sin funcionalidad de escaneo real implementada) */}
         <Button variant="outline" size="icon" aria-label="Escanear código de barras" className="h-11 w-11 rounded-md shadow-sm border-border/70" onClick={() => searchInputRef.current?.focus()}>
           <Barcode className="h-5 w-5"/>
         </Button>
       </div>

      {/* Acordeón para mostrar productos agrupados por marca */}
      {Object.keys(filteredData).length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={Object.keys(filteredData).filter(brand => Array.isArray(filteredData[brand]) && filteredData[brand].length > 0)}>
            {Object.entries(filteredData).map(([brand, products]) => {
             const safeProducts = Array.isArray(products) ? products : [];
             if (safeProducts.length === 0) return null; // No renderizar ítem de acordeón si no hay productos para esta marca
             return(
              <AccordionItem value={brand} key={`${pointOfSale}-${brand}`} className="border border-border/60 rounded-lg shadow-sm overflow-hidden bg-card">
                <AccordionTrigger className="text-lg font-semibold px-6 py-4 hover:bg-muted/30 transition-colors">
                  {brand}
                  <Badge variant="secondary" className="ml-3">{safeProducts.length} producto(s)</Badge>
                </AccordionTrigger>
                <AccordionContent className="px-1 pt-0 pb-2">
                  <div className="overflow-x-auto">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead className="w-[80px] pl-6">Imagen</TableHead>
                           <TableHead>Nombre Producto</TableHead>
                           <TableHead>Código Barras</TableHead>
                           <TableHead className="text-center w-[100px]">Cantidad</TableHead>
                           <TableHead className="text-right pr-6 w-[120px]">Precio</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {safeProducts.map((product) => (
                           <TableRow key={product.id} className="hover:bg-muted/20">
                             <TableCell className="pl-6">
                               <Image
                                 src={product.imageUrl || `https://placehold.co/50x50.png`}
                                 alt={product.name || "Imagen del producto"}
                                 width={50}
                                 height={50}
                                 className="rounded-md object-cover border border-border/50 shadow-sm"
                                 data-ai-hint={product["data-ai-hint"] || "producto belleza"}
                                 onError={(e) => { // Alternativa para errores de imagen
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
                             <TableCell className="text-center">
                                 {/* Insignias para bajo stock o agotado */}
                                 {product.quantity <= 5 && product.quantity > 0 && (
                                     <Badge variant="destructive" className="mr-2 px-1.5 py-0.5 text-xs">
                                         <AlertCircle className="h-3 w-3 mr-1" /> Bajo
                                     </Badge>
                                 )}
                                 {product.quantity === 0 && (
                                      <Badge variant="destructive" className="mr-2 px-1.5 py-0.5 text-xs">
                                           Agotado
                                      </Badge>
                                 )}
                                  <span className={`font-semibold ${product.quantity <= 5 ? 'text-destructive' : ''}`}>
                                    {product.quantity}
                                  </span>
                             </TableCell>
                             <TableCell className="text-right font-semibold pr-6">${typeof product.price === 'number' ? product.price.toFixed(3) : '0.000'}</TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
             );
            })}
        </Accordion>
        ) : (
            // Se muestra cuando no hay productos que coincidan con la búsqueda o el inventario está vacío
            <Card className="w-full text-center shadow-none border-dashed border-border/80 mt-8">
               <CardHeader>
                    <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <CardTitle>
                       {searchTerm ? `Sin Resultados` : `Inventario Vacío para ${pointOfSale}`}
                    </CardTitle>
                    <CardDescription>
                       {searchTerm
                        ? `Tu búsqueda de "${searchTerm}" no coincidió con ningún producto en esta ubicación.`
                        : `Actualmente no hay productos registrados en ${pointOfSale}. Añade stock a través de la página 'Proveedores'.`}
                    </CardDescription>
               </CardHeader>
                {/* Botón para limpiar la búsqueda si había un término de búsqueda */}
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

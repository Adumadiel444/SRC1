
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LayersIcon, PackageSearchIcon, CalendarDaysIcon, BarChartIcon, XCircle } from 'lucide-react';
import Image from 'next/image';
import { MonthPicker } from "@/components/MonthPicker";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { useInventoryContext, type Product as InventoryProduct, type InventoryData } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

interface SaleRecordItem {
  barcode: string;
  productName: string;
  brandName: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  dateTime: Date;
  pointOfSale: string;
  items: SaleRecordItem[];
  paymentMethod: "cash" | "card" | "transfer";
  totalAmount: number;
}

const SALES_HISTORY_LOCAL_STORAGE_KEY = 'salesHistory';
const WHOLESALE_SALES_HISTORY_LOCAL_STORAGE_KEY = 'wholesaleSalesHistory';

interface ProductSalesMatrixRow {
  barcode: string;
  productName: string;
  brandName: string;
  imageUrl?: string;
  'data-ai-hint'?: string;
  dailySales: { [dateKey: string]: number }; // Clave 'dd/MM'
  totalSalesInRange: number;
}

interface BrandSalesMatrix {
  dates: string[]; // Formato 'dd/MM'
  products: ProductSalesMatrixRow[];
}

interface GroupedProductSalesMatrix {
  [brandName: string]: BrandSalesMatrix;
}

interface ChartDataPoint {
  date: string; // Para eje X, usualmente solo el día 'dd'
  sales: number;
}


export default function DesgloseVentasPage(): JSX.Element {
  const [isClient, setIsClient] = useState(false);
  const { inventory, isInventoryLoaded, getAllPointsOfSale } = useInventoryContext();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [selectedMonthDateRange, setSelectedMonthDateRange] = React.useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });

  const [allSalesData, setAllSalesData] = useState<SaleRecord[]>([]);
  const [allWholesaleSalesData, setAllWholesaleSalesData] = useState<SaleRecord[]>([]);
  const [productSalesMatrixByBrand, setProductSalesMatrixByBrand] = useState<GroupedProductSalesMatrix>({});
  const [brandsForAccordion, setBrandsForAccordion] = useState<string[]>([]);

  const [selectedProductBarcode, setSelectedProductBarcode] = useState<string | null>(null);
  const [productDailySalesChartData, setProductDailySalesChartData] = useState<ChartDataPoint[]>([]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const regularSalesRaw = localStorage.getItem(SALES_HISTORY_LOCAL_STORAGE_KEY);
      const wholesaleSalesRaw = localStorage.getItem(WHOLESALE_SALES_HISTORY_LOCAL_STORAGE_KEY);
      try {
        setAllSalesData(regularSalesRaw ? JSON.parse(regularSalesRaw).map((s: SaleRecord) => ({ ...s, dateTime: new Date(s.dateTime) })) : []);
      } catch (e) { console.error("Error al analizar ventas regulares para desglose:", e); setAllSalesData([]); }
      try {
        setAllWholesaleSalesData(wholesaleSalesRaw ? JSON.parse(wholesaleSalesRaw).map((s: SaleRecord) => ({ ...s, dateTime: new Date(s.dateTime) })) : []);
      } catch (e) { console.error("Error al analizar ventas mayoristas para desglose:", e); setAllWholesaleSalesData([]); }
    }
  }, [isClient]);

  useEffect(() => {
    if (!selectedMonthDateRange?.from || !isClient || !isInventoryLoaded || Object.keys(inventory).length === 0) {
      setProductSalesMatrixByBrand({});
      setBrandsForAccordion([]);
      // No limpiar selectedProductBarcode aquí para permitir que el gráfico se muestre incluso si los datos del inventario cambian
      return;
    }

    const startDate = selectedMonthDateRange.from;
    const endDate = selectedMonthDateRange.to || selectedMonthDateRange.from;
    const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
    const dateKeys = daysInPeriod.map(day => format(day, 'dd/MM', { locale: es }));

    const productDailySales: { [barcode: string]: ProductSalesMatrixRow } = {};

    const allInventoryProducts = new Map<string, InventoryProduct>();
    const posList = getAllPointsOfSale();
    posList.forEach(pos => {
        const posInventory = inventory[pos];
        if (posInventory) {
            Object.values(posInventory).flat().forEach(product => {
                if (product && !allInventoryProducts.has(product.barcode)) {
                    allInventoryProducts.set(product.barcode, product);
                }
            });
        }
    });

    allInventoryProducts.forEach(invProduct => {
        productDailySales[invProduct.barcode] = {
            barcode: invProduct.barcode,
            productName: invProduct.name,
            brandName: invProduct.brand.trim(),
            imageUrl: invProduct.imageUrl,
            'data-ai-hint': invProduct['data-ai-hint'],
            dailySales: Object.fromEntries(dateKeys.map(key => [key, 0])),
            totalSalesInRange: 0,
        };
    });

    const combinedSales = [...allSalesData, ...allWholesaleSalesData];
    const salesInPeriod = combinedSales.filter(sale => {
      if (!isValid(new Date(sale.dateTime))) return false;
      const saleDate = new Date(sale.dateTime);
      return saleDate >= startDate && saleDate <= endDate;
    });

    salesInPeriod.forEach(sale => {
      sale.items.forEach(item => {
        if (productDailySales[item.barcode]) {
          const dayKey = format(new Date(sale.dateTime), 'dd/MM', { locale: es });
          productDailySales[item.barcode].dailySales[dayKey] = (productDailySales[item.barcode].dailySales[dayKey] || 0) + item.quantity;
          productDailySales[item.barcode].totalSalesInRange += item.quantity;
        }
      });
    });

    const groupedByBrand: GroupedProductSalesMatrix = {};
    const brandNormalizationMap = new Map<string, string>();

    Object.values(productDailySales).forEach(productSummary => {
      const originalBrandName = productSummary.brandName || "Marca Desconocida";
      const normalizedBrandKey = originalBrandName.toLowerCase();

      if (!brandNormalizationMap.has(normalizedBrandKey)) {
          brandNormalizationMap.set(normalizedBrandKey, originalBrandName);
      }
      const displayBrandName = brandNormalizationMap.get(normalizedBrandKey)!;

      if (!groupedByBrand[displayBrandName]) {
        groupedByBrand[displayBrandName] = {
          dates: dateKeys,
          products: [],
        };
      }
      groupedByBrand[displayBrandName].products.push(productSummary);
    });

    Object.values(groupedByBrand).forEach(brandData => {
      brandData.products.sort((a, b) => a.productName.localeCompare(b.productName));
    });

    const sortedBrandNames = Object.keys(groupedByBrand).sort((a,b) => a.localeCompare(b));
    const sortedGroupedByBrand: GroupedProductSalesMatrix = {};
    sortedBrandNames.forEach(brand => {
        sortedGroupedByBrand[brand] = groupedByBrand[brand];
    });

    setProductSalesMatrixByBrand(sortedGroupedByBrand);
    setBrandsForAccordion(sortedBrandNames);

  }, [selectedMonthDateRange, allSalesData, allWholesaleSalesData, isClient, inventory, isInventoryLoaded, getAllPointsOfSale]);

  const actualSelectedProductObject = useMemo(() => {
    if (!selectedProductBarcode || Object.keys(productSalesMatrixByBrand).length === 0) {
      return null;
    }
    for (const brandData of Object.values(productSalesMatrixByBrand)) {
      const product = brandData.products.find(p => p.barcode === selectedProductBarcode);
      if (product) return product;
    }
    return null;
  }, [productSalesMatrixByBrand, selectedProductBarcode]);


  useEffect(() => {
    if (actualSelectedProductObject && selectedMonthDateRange?.from) {
      const startDate = selectedMonthDateRange.from;
      const endDate = selectedMonthDateRange.to || selectedMonthDateRange.from;
      const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
      const dateKeyFormatForChart = 'dd';

      const chartData = daysInPeriod.map(day => {
        const dayKeyForMatrix = format(day, 'dd/MM', { locale: es });
        const salesForDay = actualSelectedProductObject.dailySales[dayKeyForMatrix] || 0;
        return {
          date: format(day, dateKeyFormatForChart, { locale: es }),
          sales: salesForDay,
        };
      });
      setProductDailySalesChartData(chartData);
    } else {
      setProductDailySalesChartData([]);
    }
  }, [actualSelectedProductObject, selectedMonthDateRange]);

  const handleProductRowClick = (product: ProductSalesMatrixRow) => {
    if (selectedProductBarcode && selectedProductBarcode === product.barcode) {
        setSelectedProductBarcode(null);
    } else {
        setSelectedProductBarcode(product.barcode);
    }
  };

  const handleMonthChange = useCallback((newRange: DateRange | undefined) => {
    setSelectedMonthDateRange(newRange);
    setSelectedProductBarcode(null); 
  }, []); 


  if (authIsLoading || !isInventoryLoaded || !isClient) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Desglose de Ventas por Marca y Producto</h1>
        <LayersIcon className="h-8 w-8 text-primary" />
      </div>
      <p className="text-muted-foreground">
        Analiza las ventas diarias de cada producto del inventario, agrupadas por marca, para el mes seleccionado. Haz clic en una fila de producto para ver su gráfico de ventas diarias.
      </p>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarDaysIcon className="mr-3 h-6 w-6 text-primary" />Seleccionar Mes</CardTitle>
          <CardDescription>
            Elige el mes para ver el desglose detallado de las ventas de todos los productos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthPicker
            onMonthChange={handleMonthChange}
            initialDate={selectedMonthDateRange?.from}
          />
        </CardContent>
      </Card>

      {brandsForAccordion.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={brandsForAccordion.length > 0 ? [brandsForAccordion[0]] : []}>
          {brandsForAccordion.map((brandName) => {
            const brandData = productSalesMatrixByBrand[brandName];
            if (!brandData || brandData.products.length === 0) return null;

            return (
              <AccordionItem value={brandName} key={brandName} className="border border-border/60 rounded-lg shadow-sm overflow-hidden bg-card">
                <AccordionTrigger className="text-lg font-semibold px-6 py-4 hover:bg-muted/30 transition-colors">
                  {brandName}
                  <Badge variant="secondary" className="ml-3">{brandData.products.length} producto(s) en inventario</Badge>
                </AccordionTrigger>
                <AccordionContent className="px-1 pt-0 pb-2">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>Ventas diarias para productos de {brandName} en {selectedMonthDateRange?.from ? format(selectedMonthDateRange.from, "MMMM yyyy", { locale: es }) : "el mes seleccionado"}.</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-card z-10 min-w-[250px] pl-6">Producto</TableHead>
                          {brandData.dates.map(date => (
                            <TableHead key={date} className="text-center min-w-[60px]">{date.split('/')[0]}</TableHead>
                          ))}
                          <TableHead className="text-right min-w-[100px] pr-6">Total Mes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {brandData.products.map((product) => (
                          <TableRow
                            key={product.barcode}
                            className={`hover:bg-muted/20 cursor-pointer ${product.totalSalesInRange === 0 ? 'opacity-70' : ''} ${selectedProductBarcode === product.barcode ? 'bg-accent/50' : ''}`}
                            onClick={() => handleProductRowClick(product)}
                          >
                            <TableCell className="sticky left-0 bg-card z-10 font-medium pl-6">
                              <div className="flex items-center gap-3">
                                <Image
                                  src={product.imageUrl || placeholderSvg}
                                  alt={product.productName}
                                  width={40}
                                  height={40}
                                  className="rounded object-cover border border-border/50 shadow-sm"
                                  data-ai-hint={product['data-ai-hint'] || "producto belleza"}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src !== placeholderSvg) { target.src = placeholderSvg; }
                                    target.onerror = null;
                                  }}
                                />
                                <div>
                                  <p className="font-semibold">{product.productName}</p>
                                  <p className="text-xs text-muted-foreground">{product.barcode}</p>
                                </div>
                              </div>
                            </TableCell>
                            {brandData.dates.map(dateKey => (
                              <TableCell key={`${product.barcode}-${dateKey}`} className="text-center">
                                {product.dailySales[dateKey] > 0 ? product.dailySales[dateKey] : <span className="text-muted-foreground/70">-</span>}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-semibold pr-6">{product.totalSalesInRange}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {actualSelectedProductObject && actualSelectedProductObject.brandName === brandName && productDailySalesChartData.length > 0 && (
                    <Card className="mt-6 mx-4 mb-2 shadow-md border border-border/60">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center text-lg">
                                    <BarChartIcon className="mr-2 h-5 w-5 text-primary" />
                                    Ventas Diarias: {actualSelectedProductObject.productName}
                                </CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedProductBarcode(null)} aria-label="Cerrar gráfico">
                                    <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                                </Button>
                            </div>
                            <CardDescription>
                                Unidades vendidas por día en {selectedMonthDateRange?.from ? format(selectedMonthDateRange.from, "MMMM yyyy", { locale: es }) : "el mes seleccionado"}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] bg-muted p-3 rounded-md">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={productDailySalesChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" />
                                        <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                                            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                            formatter={(value: number, name, props) => [`${value} unid.`, `Día ${props.payload.date}`]}
                                            labelFormatter={(label) => `Día ${label}, ${selectedMonthDateRange?.from ? format(selectedMonthDateRange.from, "MMM yy", { locale: es }) : ''}`}
                                        />
                                        <Legend wrapperStyle={{fontSize: "11px"}} formatter={() => "Unidades Vendidas"}/>
                                        <Bar dataKey="sales" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} barSize={15} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Card className="w-full text-center shadow-none border-dashed border-border/80 mt-8">
          <CardHeader>
            <PackageSearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Sin Productos en Inventario</CardTitle>
            <CardDescription>
              No se encontraron productos en el inventario para mostrar en el desglose de ventas
              ({selectedMonthDateRange?.from ? format(selectedMonthDateRange.from, "MMMM yyyy", { locale: es }) : "N/A"}).
              Verifica tu inventario o selecciona otro mes.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}


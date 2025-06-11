
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart as BarChartIcon, CalendarIcon, PackageIcon, ShoppingCart, ReceiptText, LayersIcon, ExternalLinkIcon, Barcode, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from "@/components/MonthPicker";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts'; // Importar Cell
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid, subMonths, eachMonthOfInterval, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { useInventoryContext, type Product as InventoryProduct } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


// Interfaces
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

interface InvoiceRecord {
  id: string;
  invoiceDate: string; // "YYYY-MM-DD"
  supplierName?: string;
  totalAmount: number;
}

const SALES_HISTORY_LOCAL_STORAGE_KEY = 'salesHistory';
const WHOLESALE_SALES_HISTORY_LOCAL_STORAGE_KEY = 'wholesaleSalesHistory';
const INVOICES_LOCAL_STORAGE_KEY = 'invoiceHistoryBeautyApp';

interface ProductForSelector extends InventoryProduct {
  uniqueId: string; // ID único para el selector, usualmente el código de barras
  displayName: string; // Nombre para mostrar en el selector
}

interface ChartDataPoint {
  date: string; // Fecha para el eje X (ej: "dd/MM" o "dd")
  sales: number; // Ventas para el eje Y
}

interface MonthlySummaryDataPoint {
  name: string; // Nombre del mes (ej: "Ene 23")
  totalVentas?: number; // Ventas totales para gráficos de ventas
  totalGastos?: number; // Gastos totales para gráficos de gastos
}

// Paleta de colores para el gráfico de arcoíris
const rainbowColors = [
  "hsl(var(--chart-1))", 
  "hsl(var(--chart-2))", 
  "hsl(var(--chart-3))",  
  "hsl(var(--chart-4))",   
  "hsl(var(--chart-5))", 
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
  "hsl(var(--chart-9))",
  "hsl(var(--chart-10))",
  "hsl(var(--chart-11))",
  "hsl(var(--chart-12))",
];


export default function GraficaPage(): JSX.Element {
  const [isClient, setIsClient] = useState(false);
  const { inventory, isInventoryLoaded, getPointsOfSaleForUser } = useInventoryContext();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [productList, setProductList] = useState<ProductForSelector[]>([]);
  const [selectedProductBarcode, setSelectedProductBarcode] = useState<string | null>(null);
  const [productChartDateRange, setProductChartDateRange] = React.useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const [productSalesChartData, setProductSalesChartData] = useState<ChartDataPoint[]>([]);

  const [monthlySalesChartData, setMonthlySalesChartData] = useState<MonthlySummaryDataPoint[]>([]);
  const [monthlyExpensesChartData, setMonthlyExpensesChartData] = useState<MonthlySummaryDataPoint[]>([]);

  const [allSalesData, setAllSalesData] = useState<SaleRecord[]>([]);
  const [allWholesaleSalesData, setAllWholesaleSalesData] = useState<SaleRecord[]>([]);
  const [allInvoicesData, setAllInvoicesData] = useState<InvoiceRecord[]>([]);

  // Estados para el desglose de ventas diarias del mes seleccionado
  const [selectedMonthForDailyChart, setSelectedMonthForDailyChart] = useState<Date | null>(null);
  const [dailySalesForSelectedMonthChartData, setDailySalesForSelectedMonthChartData] = useState<ChartDataPoint[]>([]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isInventoryLoaded && currentUser && isClient) {
      const accessiblePOS = getPointsOfSaleForUser();
      const products: ProductForSelector[] = [];
      const uniqueBarcodes = new Set<string>();

      accessiblePOS.forEach(pos => {
        const posInventory = inventory[pos];
        if (posInventory) {
          Object.values(posInventory).flat().forEach(product => {
            if (product && !uniqueBarcodes.has(product.barcode)) {
              products.push({
                ...product,
                uniqueId: product.barcode,
                displayName: `${product.name} (${product.brand}) - ${product.barcode}`
              });
              uniqueBarcodes.add(product.barcode);
            }
          });
        }
      });
      products.sort((a,b) => a.displayName.localeCompare(b.displayName));
      setProductList(products);
    }
  }, [inventory, isInventoryLoaded, currentUser, getPointsOfSaleForUser, isClient]);

  useEffect(() => {
    if (isClient) {
      const regularSalesRaw = localStorage.getItem(SALES_HISTORY_LOCAL_STORAGE_KEY);
      const wholesaleSalesRaw = localStorage.getItem(WHOLESALE_SALES_HISTORY_LOCAL_STORAGE_KEY);
      const invoicesRaw = localStorage.getItem(INVOICES_LOCAL_STORAGE_KEY);

      try {
        setAllSalesData(regularSalesRaw ? JSON.parse(regularSalesRaw).map((s: SaleRecord) => ({...s, dateTime: new Date(s.dateTime)})) : []);
      } catch (e) { console.error("Error al analizar ventas regulares para gráficos:", e); setAllSalesData([]); }

      try {
        setAllWholesaleSalesData(wholesaleSalesRaw ? JSON.parse(wholesaleSalesRaw).map((s: SaleRecord) => ({...s, dateTime: new Date(s.dateTime)})) : []);
      } catch (e) { console.error("Error al analizar ventas mayoristas para gráficos:", e); setAllWholesaleSalesData([]); }

      try {
        setAllInvoicesData(invoicesRaw ? JSON.parse(invoicesRaw) : []);
      } catch (e) { console.error("Error al analizar facturas para gráficos:", e); setAllInvoicesData([]); }
    }
  }, [isClient]);

  // Efecto para calcular los datos del gráfico de ventas del producto
  useEffect(() => {
    if (!selectedProductBarcode || !productChartDateRange?.from || !isClient || (allSalesData.length === 0 && allWholesaleSalesData.length === 0)) {
      setProductSalesChartData([]);
      return;
    }

    const combinedSales = [...allSalesData, ...allWholesaleSalesData];
    const startDate = productChartDateRange.from;
    const endDate = productChartDateRange.to || productChartDateRange.from;

    const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
    const chartDataMap = new Map<string, number>();

    daysInPeriod.forEach(day => {
      chartDataMap.set(format(day, 'dd/MM', { locale: es }), 0);
    });

    combinedSales.forEach(sale => {
      if (!isValid(new Date(sale.dateTime))) return;
      const saleDate = new Date(sale.dateTime);

      if (saleDate >= startDate && saleDate <= endDate) {
        sale.items.forEach(item => {
          if (item.barcode === selectedProductBarcode) {
            const dayKey = format(saleDate, 'dd/MM', { locale: es });
            chartDataMap.set(dayKey, (chartDataMap.get(dayKey) || 0) + item.quantity);
          }
        });
      }
    });

    const formattedChartData = Array.from(chartDataMap.entries())
      .map(([date, sales]) => ({ date, sales }))
      .sort((a,b) => {
          const [dayA, monthA] = a.date.split('/').map(Number);
          const [dayB, monthB] = b.date.split('/').map(Number);
          if (monthA !== monthB) return monthA - monthB;
          return dayA - dayB;
      });

    setProductSalesChartData(formattedChartData);

  }, [selectedProductBarcode, productChartDateRange, allSalesData, allWholesaleSalesData, isClient]);


  // Efecto para calcular los datos del gráfico de resumen de ventas mensuales
  useEffect(() => {
    if (!isClient || (allSalesData.length === 0 && allWholesaleSalesData.length === 0)) {
      setMonthlySalesChartData([]);
      return;
    }
    const combinedSales = [...allSalesData, ...allWholesaleSalesData];
    const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));
    const currentMonthStart = startOfMonth(new Date());
    const monthsInterval = eachMonthOfInterval({ start: twelveMonthsAgo, end: currentMonthStart });

    const data: MonthlySummaryDataPoint[] = monthsInterval.map(monthStart => {
      let totalSalesMonth = 0;
      const monthEnd = endOfMonth(monthStart);

      combinedSales.forEach(sale => {
        if (!isValid(new Date(sale.dateTime))) return;
        const saleDate = new Date(sale.dateTime);
        if (saleDate >= monthStart && saleDate <= monthEnd) {
          totalSalesMonth += sale.totalAmount;
        }
      });
      return {
        name: format(monthStart, 'MMM yy', { locale: es }),
        totalVentas: totalSalesMonth,
      };
    });
    setMonthlySalesChartData(data);
  }, [allSalesData, allWholesaleSalesData, isClient]);

  // Efecto para calcular los datos del gráfico de resumen de gastos mensuales
  useEffect(() => {
    if (!isClient || allInvoicesData.length === 0) {
      setMonthlyExpensesChartData([]);
      return;
    }
    const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));
    const currentMonthStart = startOfMonth(new Date());
    const monthsInterval = eachMonthOfInterval({ start: twelveMonthsAgo, end: currentMonthStart });

    const data: MonthlySummaryDataPoint[] = monthsInterval.map(monthStart => {
      let totalExpensesMonth = 0;
      const monthEnd = endOfMonth(monthStart);

      allInvoicesData.forEach(invoice => {
        try {
          const invDate = parseISO(invoice.invoiceDate); // Asumimos que invoiceDate es "YYYY-MM-DD"
          if (isValid(invDate) && invDate >= monthStart && invDate <= monthEnd) {
            totalExpensesMonth += invoice.totalAmount;
          }
        } catch (e) { console.error("Error al analizar fecha de factura para gráficos:", e); }
      });
      return {
        name: format(monthStart, 'MMM yy', { locale: es }),
        totalGastos: totalExpensesMonth,
      };
    });
    setMonthlyExpensesChartData(data);
  }, [allInvoicesData, isClient]);

  // Efecto para calcular los datos del gráfico de ventas diarias para el mes seleccionado
  useEffect(() => {
    if (!selectedMonthForDailyChart || !isClient || (allSalesData.length === 0 && allWholesaleSalesData.length === 0)) {
      setDailySalesForSelectedMonthChartData([]);
      return;
    }

    const combinedSales = [...allSalesData, ...allWholesaleSalesData];
    const startDate = startOfMonth(selectedMonthForDailyChart);
    const endDate = endOfMonth(selectedMonthForDailyChart);

    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
    const dailyChartDataMap = new Map<string, number>();

    daysInMonth.forEach(day => {
      dailyChartDataMap.set(format(day, 'dd', { locale: es }), 0); // Usar solo el día como clave
    });

    combinedSales.forEach(sale => {
      if (!isValid(new Date(sale.dateTime))) return;
      const saleDate = new Date(sale.dateTime);

      if (saleDate >= startDate && saleDate <= endDate) {
        const dayKey = format(saleDate, 'dd', { locale: es });
        dailyChartDataMap.set(dayKey, (dailyChartDataMap.get(dayKey) || 0) + sale.totalAmount);
      }
    });

    const formattedDailyChartData = Array.from(dailyChartDataMap.entries())
      .map(([day, totalSales]) => ({ date: day, sales: totalSales }))
      .sort((a,b) => parseInt(a.date) - parseInt(b.date)); // Ordenar por día

    setDailySalesForSelectedMonthChartData(formattedDailyChartData);

  }, [selectedMonthForDailyChart, allSalesData, allWholesaleSalesData, isClient]);

  const handleMonthBarClick = (data: any) => {
    if (data && data.payload && data.payload.name) {
      try {
        const [monthAbbrevInput, yearShort] = data.payload.name.split(' ');
        const monthAbbrev = monthAbbrevInput.toLowerCase().replace('.', ''); // Quitar el punto si existe y asegurar minúsculas
        const yearFull = `20${yearShort}`;
        
        const monthMap: { [key: string]: number } = {
          'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        };
        const monthIndex = monthMap[monthAbbrev];

        if (monthIndex !== undefined && !isNaN(parseInt(yearFull))) {
          const parsedDate = new Date(parseInt(yearFull), monthIndex, 1);
          setSelectedMonthForDailyChart(parsedDate);
        } else {
          console.error("Error al parsear la fecha del mes desde el gráfico:", data.payload.name, "Procesado como:", monthAbbrev, yearFull);
          setSelectedMonthForDailyChart(null);
        }
      } catch (error) {
        console.error("Error al parsear la fecha del mes:", error);
        setSelectedMonthForDailyChart(null);
      }
    }
  };

  const clearSelectedMonthForDailyChart = () => {
    setSelectedMonthForDailyChart(null);
  };


  // Manejo de estado de carga
  if (authIsLoading || !isInventoryLoaded || !isClient) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full mt-8" />
        <Skeleton className="h-64 w-full mt-8" />
        <Skeleton className="h-64 w-full mt-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Análisis Gráfico</h1>
        <BarChartIcon className="h-8 w-8 text-primary" />
      </div>
      <p className="text-muted-foreground">
        Visualiza datos importantes de tu negocio a través de gráficos interactivos.
      </p>

      <Card className="shadow-md border border-border/60" id="product-sales-graph-card">
        <CardHeader>
          <CardTitle className="flex items-center"><PackageIcon className="mr-3 h-6 w-6 text-primary" />Ventas Diarias de Producto (Detallado)</CardTitle>
          <CardDescription>
            Selecciona un producto y un mes para ver su rendimiento de ventas diarias en unidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center w-full sm:w-[380px]">
              <Select onValueChange={setSelectedProductBarcode} value={selectedProductBarcode || undefined}>
                <SelectTrigger className="rounded-r-none flex-grow">
                  <PackageIcon className="h-4 w-4 mr-2 inline-block text-muted-foreground" />
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {productList.length > 0 ? productList.map(p => (
                    <SelectItem key={p.uniqueId} value={p.barcode}>
                      {p.displayName}
                    </SelectItem>
                  )) : <SelectItem value="no-products" disabled>No hay productos en inventario accesible</SelectItem>}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-l-none border-l-0 shrink-0" aria-label="Escanear código de barras">
                <Barcode className="h-5 w-5" />
              </Button>
            </div>
            <MonthPicker
              onMonthChange={setProductChartDateRange}
              initialDate={productChartDateRange?.from}
            />
          </div>

          <div className="h-[400px] bg-muted p-4 rounded-md mt-4">
            {selectedProductBarcode && productSalesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productSalesChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    formatter={(value: number) => [`${value} unid.`, "Vendido"]}
                  />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="sales" fill="hsl(var(--chart-1))" name="Unidades Vendidas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-center">
                  {selectedProductBarcode ? "No hay datos de ventas para este producto en el mes seleccionado." : "Selecciona un producto y un mes para ver el detalle diario."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
            <CardTitle className="flex items-center"><LayersIcon className="mr-3 h-6 w-6 text-primary" />Desglose de Ventas por Marca y Producto</CardTitle>
            <CardDescription>
                Para un análisis detallado de las ventas de todos los productos agrupados por marca y día, utilice la opción a continuación.
            </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-10">
            <p className="text-muted-foreground mb-6">
                Esta sección proporcionará una vista completa de todas las ventas por marca y producto para el mes seleccionado.
            </p>
            <Button variant="outline" asChild>
                <Link href="/grafica/desglose">
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    Ver Desglose Completo
                </Link>
            </Button>
        </CardContent>
      </Card>


      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center"><ShoppingCart className="mr-3 h-6 w-6 text-primary" />Resumen de Ventas Mensuales (Últimos 12 Meses)</CardTitle>
          <CardDescription>
            Total de ingresos por ventas (normales y por mayor) de los últimos 12 meses. Haz clic en una barra para ver el detalle diario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-muted p-4 rounded-md">
            {monthlySalesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySalesChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toLocaleString('es-CL')}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    formatter={(value: number) => [`$${value.toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, "Total Ventas"]}
                  />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="totalVentas" name="Ventas Mensuales" radius={[4, 4, 0, 0]} onClick={handleMonthBarClick} cursor="pointer">
                    {monthlySalesChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={rainbowColors[index % rainbowColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No hay datos de ventas para mostrar.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedMonthForDailyChart && (
        <Card className="shadow-md border border-border/60">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <CalendarIcon className="mr-3 h-6 w-6 text-primary" />
                Ventas Diarias de {format(selectedMonthForDailyChart, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={clearSelectedMonthForDailyChart} aria-label="Limpiar selección de mes">
                <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
            <CardDescription>
              Total de ingresos por ventas (normales y por mayor) para cada día del mes seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] bg-muted p-4 rounded-md">
              {dailySalesForSelectedMonthChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySalesForSelectedMonthChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" />
                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toLocaleString('es-CL')}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                      labelFormatter={(label) => `Día ${label}, ${format(selectedMonthForDailyChart, "MMM yyyy", { locale: es })}`}
                      formatter={(value: number) => [`$${value.toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, "Total Ventas Día"]}
                    />
                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                    <Bar dataKey="sales" fill="hsl(var(--chart-3))" name="Ventas Diarias" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No hay datos de ventas diarias para mostrar para {format(selectedMonthForDailyChart, "MMMM yyyy", { locale: es })}.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

       <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center"><ReceiptText className="mr-3 h-6 w-6 text-primary" />Resumen de Gastos Mensuales (Últimos 12 Meses)</CardTitle>
          <CardDescription>
            Total de gastos basados en facturas de proveedores registradas en los últimos 12 meses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-muted p-4 rounded-md">
            {monthlyExpensesChartData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyExpensesChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toLocaleString('es-CL')}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    formatter={(value: number) => [`$${value.toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, "Total Gastos"]}
                  />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="totalGastos" fill="hsl(var(--chart-4))" name="Gastos Mensuales (Facturas)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No hay datos de gastos (facturas) para mostrar.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}


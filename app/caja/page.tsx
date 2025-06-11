
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Banknote, TrendingUp, TrendingDown, ShieldCheck, ShieldX, CreditCard, ArrowRightLeft, CalendarDays, ClipboardList, HomeIcon, FileTextIcon, UsersIcon, Save, Edit, XCircle, PlusCircle, Trash2 } from 'lucide-react';
import { format, isToday, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";

interface SaleRecordItem {
  barcode: string;
  productName: string;
  brandName: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  dateTime: string | Date;
  pointOfSale: string;
  items: SaleRecordItem[];
  paymentMethod: "cash" | "card" | "transfer";
  totalAmount: number;
  receiptPdfDataUri?: string;
}

interface InvoiceRecord {
  id: string;
  invoiceDate: string; // "YYYY-MM-DD"
  totalAmount: number;
}

interface FixedExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface CajaSettings {
  saldoInicial: number;
  egresosDiarios: number;
  fixedExpenses: FixedExpenseItem[];
}

const SALES_HISTORY_LOCAL_STORAGE_KEY = 'salesHistory';
const WHOLESALE_SALES_HISTORY_LOCAL_STORAGE_KEY = 'wholesaleSalesHistory';
const INVOICES_LOCAL_STORAGE_KEY = 'invoiceHistoryBeautyApp';
const CAJA_SETTINGS_LOCAL_STORAGE_KEY = 'cajaSettingsBeautyApp';

const defaultFixedExpenses: FixedExpenseItem[] = [
  { id: 'rent', name: 'Arriendo Local', amount: 500000 },
  { id: 'services', name: 'Facturas de Servicios', amount: 80000 },
  { id: 'salaries', name: 'Salarios Personal', amount: 1200000 },
];

const defaultSettings: CajaSettings = {
  saldoInicial: 50000,
  egresosDiarios: 30000,
  fixedExpenses: defaultFixedExpenses,
};

export default function CajaPage(): JSX.Element {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  const [dailyCashIncome, setDailyCashIncome] = useState(0);
  const [dailyCardIncome, setDailyCardIncome] = useState(0);
  const [dailyTransferIncome, setDailyTransferIncome] = useState(0);
  const [totalDailySalesIncome, setTotalDailySalesIncome] = useState(0);
  const [monthlyExpensesFromInvoices, setMonthlyExpensesFromInvoices] = useState(0);

  const [isCajaOpen, setIsCajaOpen] = useState(true);

  const [saldoInicial, setSaldoInicial] = useState(defaultSettings.saldoInicial);
  const [egresosDiarios, setEgresosDiarios] = useState(defaultSettings.egresosDiarios);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseItem[]>(JSON.parse(JSON.stringify(defaultSettings.fixedExpenses))); 

  const [isEditingSettings, setIsEditingSettings] = useState(false);

  const isAdmin = useMemo(() => currentUser?.allowedPOS.includes('*'), [currentUser]);

  const loadSettings = useCallback(() => {
    const storedSettings = localStorage.getItem(CAJA_SETTINGS_LOCAL_STORAGE_KEY);
    if (storedSettings) {
      try {
        const settings: CajaSettings = JSON.parse(storedSettings);
        setSaldoInicial(settings.saldoInicial ?? defaultSettings.saldoInicial);
        setEgresosDiarios(settings.egresosDiarios ?? defaultSettings.egresosDiarios);
        if (Array.isArray(settings.fixedExpenses) && settings.fixedExpenses.every(exp => exp && typeof exp.id === 'string' && typeof exp.name === 'string' && typeof exp.amount === 'number')) {
          setFixedExpenses(settings.fixedExpenses);
        } else {
          setFixedExpenses(JSON.parse(JSON.stringify(defaultSettings.fixedExpenses)));
        }
      } catch (e) {
        console.error("Error al analizar los ajustes de caja desde localStorage:", e);
        setSaldoInicial(defaultSettings.saldoInicial);
        setEgresosDiarios(defaultSettings.egresosDiarios);
        setFixedExpenses(JSON.parse(JSON.stringify(defaultSettings.fixedExpenses)));
      }
    } else {
        setSaldoInicial(defaultSettings.saldoInicial);
        setEgresosDiarios(defaultSettings.egresosDiarios);
        setFixedExpenses(JSON.parse(JSON.stringify(defaultSettings.fixedExpenses)));
    }
  }, []);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !authIsLoading) {
      if (!isAdmin) {
        toast({
          title: "Acceso Denegado",
          description: "No tienes permiso para acceder a la sección de Caja.",
          variant: "destructive",
        });
        router.push('/');
      } else {
        loadSettings();
      }
    }
  }, [isClient, authIsLoading, isAdmin, router, toast, loadSettings]);

  useEffect(() => {
    if (isClient && isAdmin) {
      const regularSalesData = localStorage.getItem(SALES_HISTORY_LOCAL_STORAGE_KEY);
      const wholesaleSalesData = localStorage.getItem(WHOLESALE_SALES_HISTORY_LOCAL_STORAGE_KEY);
      
      let allSales: SaleRecord[] = [];
      if (regularSalesData) {
        try { allSales = allSales.concat(JSON.parse(regularSalesData)); }
        catch (e) { console.error("Error al analizar ventas regulares:", e); }
      }
      if (wholesaleSalesData) {
        try { allSales = allSales.concat(JSON.parse(wholesaleSalesData)); }
        catch (e) { console.error("Error al analizar ventas mayoristas:", e); }
      }
      
      const todaySales = allSales.filter(sale => {
        const saleDate = new Date(sale.dateTime);
        return isValid(saleDate) && isToday(saleDate);
      });

      setDailyCashIncome(todaySales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0));
      setDailyCardIncome(todaySales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.totalAmount, 0));
      setDailyTransferIncome(todaySales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.totalAmount, 0));
      
      const invoicesData = localStorage.getItem(INVOICES_LOCAL_STORAGE_KEY);
      let allInvoices: InvoiceRecord[] = [];
      if (invoicesData) {
        try { allInvoices = JSON.parse(invoicesData); }
        catch (e) { console.error("Error al analizar facturas:", e); }
      }

      const now = new Date();
      const firstDay = startOfMonth(now);
      const lastDay = endOfMonth(now);

      const currentMonthInvoices = allInvoices.filter(invoice => {
        try {
          const invDate = parseISO(invoice.invoiceDate);
          return isValid(invDate) && invDate >= firstDay && invDate <= lastDay;
        } catch { return false; }
      });
      setMonthlyExpensesFromInvoices(currentMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0));
    }
  }, [isClient, isAdmin]);

  useEffect(() => {
    setTotalDailySalesIncome(dailyCashIncome + dailyCardIncome + dailyTransferIncome);
  }, [dailyCashIncome, dailyCardIncome, dailyTransferIncome]);

  const totalGastosFijos = useMemo(() => {
    return fixedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  }, [fixedExpenses]);

  const saldoEsperadoEnCajaHoy = saldoInicial + totalDailySalesIncome - egresosDiarios;
  const currentDateFormatted = isClient ? format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es }) : "Cargando fecha...";
  const currentMonthYearFormatted = isClient ? format(new Date(), "MMMM 'de' yyyy", { locale: es }) : "Cargando mes...";

  const handleSaveSettings = useCallback(() => {
    if (!isAdmin) return;
    const settingsToSave: CajaSettings = {
      saldoInicial,
      egresosDiarios,
      fixedExpenses: fixedExpenses.map(exp => ({...exp, amount: Number(exp.amount) || 0}))
    };
    localStorage.setItem(CAJA_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settingsToSave));
    toast({
      title: "Ajustes Guardados",
      description: "Los ajustes de la caja han sido guardados exitosamente.",
    });
    setIsEditingSettings(false);
  }, [isAdmin, saldoInicial, egresosDiarios, fixedExpenses, toast, setIsEditingSettings]);

  const handleCancelEdit = useCallback(() => {
    loadSettings(); 
    setIsEditingSettings(false);
     toast({
      title: "Edición Cancelada",
      description: "Los cambios no guardados han sido descartados.",
      variant: "default"
    });
  }, [loadSettings, setIsEditingSettings, toast]);
  
  const handleSaldoInicialChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) setSaldoInicial(num);
    else if (e.target.value === "") setSaldoInicial(0);
  }, [setSaldoInicial]);

  const handleEgresosDiariosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) setEgresosDiarios(num);
    else if (e.target.value === "") setEgresosDiarios(0);
  }, [setEgresosDiarios]);

  const handleFixedExpenseChange = useCallback((id: string, field: 'name' | 'amount', value: string | number) => {
    setFixedExpenses(prevExpenses =>
      prevExpenses.map(exp => {
        if (exp.id === id) {
          if (field === 'amount') {
            const numAmount = parseFloat(String(value));
            return { ...exp, amount: isNaN(numAmount) ? 0 : numAmount };
          }
          return { ...exp, [field]: value };
        }
        return exp;
      })
    );
  }, [setFixedExpenses]);

  const handleAddFixedExpense = useCallback(() => {
    setFixedExpenses(prevExpenses => [
      ...prevExpenses,
      { id: `expense-${Date.now()}`, name: 'Nuevo Gasto', amount: 0 },
    ]);
  }, [setFixedExpenses]);

  const handleDeleteFixedExpense = useCallback((id: string) => {
    setFixedExpenses(prevExpenses => prevExpenses.filter(exp => exp.id !== id));
  }, [setFixedExpenses]);


  if (authIsLoading || !isClient || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Cargando o verificando acceso...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Caja</h1>
        <Banknote className="h-8 w-8 text-primary" />
      </div>
      <p className="text-muted-foreground">
        Administra la apertura, cierre, movimientos y arqueo de tu caja diaria. Visualiza resúmenes de ingresos y gastos.
        {isAdmin && " Puedes editar los valores base para los cálculos."}
      </p>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center"><Banknote className="mr-3 h-6 w-6 text-primary" />Flujo de Caja del Día</CardTitle>
            {isCajaOpen ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Caja Abierta
              </Badge>
            ) : (
              <Badge variant="destructive">
                <ShieldX className="mr-2 h-4 w-4" />
                Caja Cerrada
              </Badge>
            )}
          </div>
          <CardDescription className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> {currentDateFormatted}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCajaOpen ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                  {isAdmin && isEditingSettings ? (
                    <Input 
                      type="number" 
                      value={saldoInicial} 
                      onChange={handleSaldoInicialChange}
                      className="text-xl font-semibold mt-1"
                    />
                  ) : (
                    <p className="text-xl font-semibold">${saldoInicial.toLocaleString('es-CL')}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Egresos del Día (Estimado)</p>
                  {isAdmin && isEditingSettings ? (
                     <Input 
                       type="number" 
                       value={egresosDiarios} 
                       onChange={handleEgresosDiariosChange}
                       className="text-xl font-semibold text-red-600 mt-1" 
                     />
                  ) : (
                    <p className="text-xl font-semibold text-red-600">-${egresosDiarios.toLocaleString('es-CL')}</p>
                  )}
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <p className="text-base font-medium text-center text-primary mb-3">Ingresos por Ventas (Hoy)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col items-center p-3 bg-accent/50 rounded-lg">
                        <Banknote className="h-6 w-6 text-green-600 mb-1" />
                        <p className="text-xs text-muted-foreground">Efectivo</p>
                        <p className="text-lg font-semibold text-green-600">${dailyCashIncome.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-accent/50 rounded-lg">
                        <CreditCard className="h-6 w-6 text-green-600 mb-1" />
                        <p className="text-xs text-muted-foreground">Tarjeta</p>
                        <p className="text-lg font-semibold text-green-600">${dailyCardIncome.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-accent/50 rounded-lg">
                        <ArrowRightLeft className="h-6 w-6 text-green-600 mb-1" />
                        <p className="text-xs text-muted-foreground">Transferencia</p>
                        <p className="text-lg font-semibold text-green-600">${dailyTransferIncome.toLocaleString('es-CL')}</p>
                    </div>
                </div>
              </div>
              <div className="col-span-2 md:col-span-3 flex flex-col items-center border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">Total Ingresos por Ventas (Hoy)</p>
                <p className="text-xl font-semibold text-green-600">${totalDailySalesIncome.toLocaleString('es-CL')}</p>
              </div>
              
              <div className="pt-4 text-center border-t mt-4">
                <p className="text-lg text-muted-foreground">Saldo Esperado en Caja (Hoy)</p>
                <p className="text-3xl font-bold text-primary">${saldoEsperadoEnCajaHoy.toLocaleString('es-CL')}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button className="flex-1" disabled>
                  <TrendingUp className="mr-2 h-4 w-4" /> Registrar Ingreso
                </Button>
                <Button variant="outline" className="flex-1" disabled>
                  <TrendingDown className="mr-2 h-4 w-4" /> Registrar Egreso
                </Button>
                <Button variant="destructive" className="flex-1" disabled>
                  <ShieldX className="mr-2 h-4 w-4" /> Cerrar Caja
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-lg text-muted-foreground mb-4">La caja se encuentra actualmente cerrada.</p>
              <Button size="lg" disabled>
                <ShieldCheck className="mr-2 h-5 w-5" /> Abrir Caja
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center"><ClipboardList className="mr-3 h-6 w-6 text-primary" />Resumen de Gastos (Facturas Proveedores)</CardTitle>
          <CardDescription className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> {currentMonthYearFormatted}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">Total Gastos de Proveedores (Facturas Registradas)</p>
            <p className="text-3xl font-bold text-destructive mt-1">${monthlyExpensesFromInvoices.toLocaleString('es-CL')}</p>
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center"><FileTextIcon className="mr-3 h-6 w-6 text-primary" />Detalle de Gastos Fijos Mensuales</CardTitle>
           <CardDescription className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> {currentMonthYearFormatted} 
            {isAdmin && !isEditingSettings && " (Haz clic en 'Editar Ajustes' para modificar)"}
            {isAdmin && isEditingSettings && " (Modo Edición Activo)"}
            {!isAdmin && " (Valores Estimados)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fixedExpenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
              {isEditingSettings && isAdmin ? (
                <>
                  <Input
                    type="text"
                    value={expense.name}
                    onChange={(e) => handleFixedExpenseChange(expense.id, 'name', e.target.value)}
                    className="text-sm text-foreground mr-2 flex-grow"
                    placeholder="Nombre del Gasto"
                  />
                  <Input
                    type="number"
                    value={expense.amount}
                    onChange={(e) => handleFixedExpenseChange(expense.id, 'amount', e.target.value)}
                    className="text-lg font-semibold text-destructive w-40 text-right"
                    placeholder="Monto"
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteFixedExpense(expense.id)} className="ml-2 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center">
                    <span className="text-sm text-foreground">{expense.name}</span>
                  </div>
                  <span className="text-lg font-semibold text-destructive">-${(expense.amount || 0).toLocaleString('es-CL')}</span>
                </>
              )}
            </div>
          ))}

          {isEditingSettings && isAdmin && (
            <Button variant="outline" onClick={handleAddFixedExpense} className="w-full mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Gasto Fijo
            </Button>
          )}
          
          <div className="pt-4 text-center border-t mt-4">
            <p className="text-sm text-muted-foreground">Total Gastos Fijos {isAdmin && isEditingSettings ? "Editables" : "Estimados"}</p>
            <p className="text-2xl font-bold text-destructive mt-1">-${totalGastosFijos.toLocaleString('es-CL')}</p>
          </div>

          {isAdmin && (
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              {!isEditingSettings ? (
                <Button onClick={() => setIsEditingSettings(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Ajustes de Caja
                </Button>
              ) : (
                <>
                  <Button onClick={handleSaveSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar Edición
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>
            Historial de los últimos movimientos de caja (funcionalidad próxima).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            Aquí se listarán los ingresos, egresos y detalles del arqueo cuando la funcionalidad esté implementada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
    

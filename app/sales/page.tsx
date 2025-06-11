
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, MinusCircle, Barcode, DollarSign, Store, Search, CreditCard, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useToast } from "@/hooks/use-toast";
import { useInventoryContext, type Product as InventoryProduct } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { DatePickerWithRange } from "@/components/DatePickerWithRange";

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

const saleItemSchema = z.object({
  identifier: z.string().min(1, "Identificador de producto requerido.").or(z.literal("")), 
  barcode: z.string().min(1, "El código de barras es requerido."), 
  productName: z.string().min(1, "El nombre del producto es requerido."), 
  brandName: z.string().min(1, "La marca es requerida."), 
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1.").default(1), 
  price: z.coerce.number().nonnegative("El precio no puede ser negativo.").default(0), 
  originalPrice: z.coerce.number().optional(), 
  isKnownProduct: z.boolean().optional().default(false), 
  stock: z.number().optional().default(0), 
});

const salesFormSchema = z.object({
  pointOfSale: z.string().min(1, "El Punto de Venta es requerido."), 
  paymentMethod: z.enum(["cash", "card", "transfer"], { required_error: "El método de pago es requerido."}), 
  items: z.array(saleItemSchema).min(1, "Se requiere al menos un ítem para la venta.") 
    .refine(items => items.every(item => item.barcode && item.barcode.trim() !== "" && item.productName && item.productName.trim() !== "" && item.quantity > 0), {
        message: "Asegúrese de que todos los ítems tengan código de barras, nombre y cantidad válidos.", 
        path: ["items"], 
    })
    .refine(items => items.every(item => item.isKnownProduct ? item.quantity <= (item.stock ?? 0) : true), {
        message: "Uno o más ítems exceden el stock disponible. Por favor, ajuste las cantidades.", 
        path: ["items"], 
    }),
});

type SalesFormValues = z.infer<typeof salesFormSchema>;
export type SaleItemForm = z.infer<typeof saleItemSchema>;

interface SaleRecordItem {
  barcode: string; 
  productName: string; 
  brandName: string; 
  quantity: number; 
  price: number; 
}

interface SaleRecord {
  id: string; 
  dateTime: Date | string; // Acepta Date para uso interno, string para datos de API
  pointOfSale: string; 
  userId: string | null; 
  userName?: string; 
  items: SaleRecordItem[]; 
  paymentMethod: "cash" | "card" | "transfer"; 
  totalAmount: number; 
  receiptPdfDataUri?: string; // Para almacenar el PDF como data URI (opcional)
}

// Ya no se usa para la carga principal, pero puede usarse para la lógica de descarga PDF de momento.
// const SALES_HISTORY_LOCAL_STORAGE_KEY = 'salesHistory';

export default function SalesLogPage(): JSX.Element {
  const { toast } = useToast(); 
  const {
    isInventoryLoaded, 
    getProductDetailsInPos, 
    // updateProductQuantity, // El backend se encargará de actualizar el stock
    getPointsOfSaleForUser, 
    inventory, 
  } = useInventoryContext(); 
  const { currentUser, isLoading: isAuthLoading } = useAuth(); 

  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]); 
  const [filteredSalesHistory, setFilteredSalesHistory] = useState<SaleRecord[]>([]); 
  const [historyDateRange, setHistoryDateRange] = React.useState<DateRange | undefined>(undefined); 
  const [isClient, setIsClient] = useState(false); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [suggestions, setSuggestions] = useState<Array<InventoryProduct>>([]); 
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1); 
  const [currentFocusIndex, setCurrentFocusIndex] = useState<number | null>(null); 
  const [identifierInputRefs, setIdentifierInputRefs] = useState<Array<React.RefObject<HTMLInputElement>>>([]); 
  const initialFocusDoneRef = useRef(false); 
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false); 
  const processingBarcodeRef = useRef(false);

  const accessiblePOS = useMemo(() => getPointsOfSaleForUser(), [getPointsOfSaleForUser]);
  const canUserSell = accessiblePOS.length > 0;
  const accessiblePOSKey = useMemo(() => [...accessiblePOS].sort().join(','), [accessiblePOS]);

  const form = useForm<SalesFormValues>({
    resolver: zodResolver(salesFormSchema), 
    defaultValues: {
      pointOfSale: accessiblePOS[0] || "", 
      paymentMethod: "cash", 
      items: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice: 0, isKnownProduct: false, stock:0 }], 
    },
    mode: "onChange", 
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control, 
    name: "items", 
  });

  const resetSaleFormAndFocus = useCallback((currentData: SalesFormValues) => {
    form.reset({
      pointOfSale: currentData.pointOfSale, 
      paymentMethod: currentData.paymentMethod, 
      items: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice: 0, isKnownProduct: false, stock:0 }], 
    });
    initialFocusDoneRef.current = false; 
    setSuggestions([]); 
    setActiveSuggestionIndex(-1); 
    setCurrentFocusIndex(null); 
    if (identifierInputRefs[0]?.current) {
        setTimeout(()=> {
          if(identifierInputRefs[0].current) { 
              identifierInputRefs[0].current.focus();
              setCurrentFocusIndex(0);
              initialFocusDoneRef.current = true; 
          }
        },0);
    }
  }, [form, identifierInputRefs]);

  // Cargar historial de ventas desde el backend al montar.
  useEffect(() => {
    setIsClient(true);
    const fetchSalesHistory = async () => {
      if (!canUserSell) {
        setSalesHistory([]);
        return;
      }
      setIsLoadingHistory(true);
      try {
        // TODO USUARIO: Reemplaza con la URL real de tu endpoint PHP para obtener el historial de ventas.
        const response = await fetch('/api/php/get_sales_history.php');
        if (!response.ok) {
          throw new Error(`Error del servidor: ${response.status}`);
        }
        const data: SaleRecord[] = await response.json();
        // Asegurar que dateTime se convierta a Date si viene como string.
        setSalesHistory(data.map(sale => ({ ...sale, dateTime: new Date(sale.dateTime) })));
      } catch (error) {
        console.error("Falló al cargar el historial de ventas desde el backend:", error);
        toast({
          variant: "destructive",
          title: "Error al Cargar Historial",
          description: "No se pudo cargar el historial de ventas. Verifica tu conexión o el backend.",
        });
        setSalesHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchSalesHistory();
  }, [isClient, canUserSell, toast]);

  // Filtrar historial de ventas según el rango de fechas.
  useEffect(() => {
    let newFilteredHistory = salesHistory;
    if (historyDateRange?.from) { 
      newFilteredHistory = newFilteredHistory.filter(sale => {
        const saleDate = new Date(sale.dateTime);
        saleDate.setHours(0,0,0,0); 
        const fromDate = new Date(historyDateRange.from!);
        fromDate.setHours(0,0,0,0); 
        let toDate = historyDateRange.to ? new Date(historyDateRange.to) : new Date(historyDateRange.from!);
        toDate.setHours(23,59,59,999); 
        return saleDate >= fromDate && saleDate <= toDate;
      });
    }
    setFilteredSalesHistory(newFilteredHistory.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));
  }, [salesHistory, historyDateRange]); 

  useEffect(() => {
    setIdentifierInputRefs(prevRefs =>
      Array(fields.length)
        .fill(null)
        .map((_, i) => prevRefs[i] || React.createRef<HTMLInputElement>())
    );
  }, [fields.length]); 

  const calculateTotalSale = (): number => {
    const items = form.getValues("items"); 
    return items.reduce((total, item) => total + ((item.price || 0) * (item.quantity || 0)), 0);
  };

  const handleIdentifierChange = useCallback((index: number, identifierValue: string) => {
    setCurrentFocusIndex(index); 
    form.setValue(`items.${index}.identifier`, identifierValue, { shouldValidate: true, shouldDirty: true }); 
    const formItemValues = form.getValues(`items.${index}`); 
    const targetPos = form.getValues("pointOfSale"); 

    if (!identifierValue.trim() || !targetPos || !isInventoryLoaded || !currentUser || isAuthLoading) {
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        setIsSuggestionsOpen(false);
        if (!identifierValue.trim() && formItemValues.isKnownProduct) {
            update(index, {
                ...formItemValues,
                identifier: "", barcode: "", productName: "", brandName: "",
                price: 0, originalPrice:0, isKnownProduct: false, stock:0,
                quantity: formItemValues.quantity || 1, 
            });
        }
        return;
    }
    form.clearErrors(`items.${index}.identifier`); 

    const productInfo = getProductDetailsInPos(targetPos, identifierValue); 

    if (productInfo && identifierValue === productInfo.barcode) { 
        processingBarcodeRef.current = true;
        update(index, {
            identifier: productInfo.name,
            barcode: productInfo.barcode,
            productName: productInfo.name,
            brandName: productInfo.brand,
            price: productInfo.price, 
            originalPrice: productInfo.price,
            isKnownProduct: true,
            stock: productInfo.quantity,
            quantity: 1, 
        });
        setSuggestions([]);
        setIsSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
        form.trigger(`items.${index}`);

        if (index === fields.length - 1) {
            append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice:0, isKnownProduct: false, stock:0 });
            setTimeout(() => {
                const newIndex = fields.length -1; 
                if (identifierInputRefs[newIndex]?.current) {
                    identifierInputRefs[newIndex].current?.focus();
                    setCurrentFocusIndex(newIndex);
                }
                processingBarcodeRef.current = false;
            }, 0);
        } else {
            identifierInputRefs[index + 1]?.current?.focus();
            setCurrentFocusIndex(index + 1);
            processingBarcodeRef.current = false;
        }
        return; 
    }
    
    if (productInfo) { 
      update(index, {
        ...formItemValues,
        identifier: productInfo.name, 
        barcode: productInfo.barcode,
        productName: productInfo.name,
        brandName: productInfo.brand,
        price: productInfo.price, 
        originalPrice: productInfo.price, 
        isKnownProduct: true, 
        stock: productInfo.quantity, 
        quantity: form.getValues(`items.${index}.quantity`) || 1, 
      });
      setSuggestions([]); 
      setIsSuggestionsOpen(false); 
      setActiveSuggestionIndex(-1);
      form.trigger(`items.${index}`);
      setTimeout(() => document.getElementById(`items.${index}.quantity`)?.focus(), 0); 
    } else {
      const lowerIdentifier = identifierValue.toLowerCase();
      let productsInPos: InventoryProduct[] = [];
      if (inventory[targetPos] && typeof inventory[targetPos] === 'object') {
          Object.values(inventory[targetPos]).flat().forEach(product => {
              if (product && (product.name.toLowerCase().includes(lowerIdentifier) || product.barcode.includes(lowerIdentifier))) {
                   if (!productsInPos.some(p => p.barcode === product.barcode)) {
                      productsInPos.push(product);
                  }
              }
          });
      }

      if (formItemValues.isKnownProduct && formItemValues.barcode) {
        productsInPos = productsInPos.filter(p => p.barcode !== formItemValues.barcode);
      }

      const newSuggestions = productsInPos.slice(0, 7); 
      setSuggestions(newSuggestions);
      setActiveSuggestionIndex(-1); 
      setIsSuggestionsOpen(newSuggestions.length > 0 && identifierValue.trim().length > 0 && !formItemValues.isKnownProduct);

      if (formItemValues.isKnownProduct && (identifierValue.toLowerCase() !== formItemValues.productName.toLowerCase() && identifierValue !== formItemValues.barcode)) {
          update(index, {
              ...formItemValues,
              barcode: "", 
              productName: "", 
              brandName: "", 
              price: 0, 
              originalPrice: 0, 
              isKnownProduct: false, 
              stock: 0, 
              identifier: identifierValue, 
          });
      }
    }
     form.trigger(`items.${index}.identifier`); 
  }, [getProductDetailsInPos, update, form, isInventoryLoaded, currentUser, isAuthLoading, inventory, fields.length, identifierInputRefs, append]); 

  const handleSuggestionClick = (index: number, product: InventoryProduct) => {
    form.setValue(`items.${index}.identifier`, product.name, { shouldValidate: true }); 
    update(index, {
        ...form.getValues(`items.${index}`), 
        identifier: product.name, 
        barcode: product.barcode,
        productName: product.name,
        brandName: product.brand,
        price: product.price, 
        originalPrice: product.price, 
        isKnownProduct: true, 
        stock: product.quantity, 
        quantity: 1, 
    });
    setIsSuggestionsOpen(false); 
    setSuggestions([]); 
    setActiveSuggestionIndex(-1); 
    form.trigger(`items.${index}`); 

    setTimeout(() => {
        const quantityInput = document.getElementById(`items.${index}.quantity`);
        if (quantityInput) {
            quantityInput.focus(); 
            if (typeof (quantityInput as HTMLInputElement).select === 'function') {
                (quantityInput as HTMLInputElement).select(); 
            }
        } else {
            const nextIdentifierInput = identifierInputRefs[index + 1]?.current;
            if (nextIdentifierInput) {
                nextIdentifierInput.focus();
                setCurrentFocusIndex(index + 1);
            } else {
                 append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice:0, isKnownProduct: false, stock:0 });
                 setTimeout(() => {
                    const newAppendedIndex = fields.length -1; 
                    if(identifierInputRefs[newAppendedIndex]?.current) { 
                        identifierInputRefs[newAppendedIndex].current?.focus();
                        setCurrentFocusIndex(newAppendedIndex);
                    }
                 }, 0);
            }
        }
    }, 0);
  };

 const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (processingBarcodeRef.current && event.key === 'Enter') {
        processingBarcodeRef.current = false; 
        event.preventDefault();
        return; 
    }

    const isCurrentItemFocused = currentFocusIndex === index; 
    const currentIdentifierValue = form.getValues(`items.${index}.identifier`); 
    const currentItemIsKnown = form.getValues(`items.${index}.isKnownProduct`); 

    if (isSuggestionsOpen && isCurrentItemFocused && suggestions.length > 0 && currentIdentifierValue && currentIdentifierValue.trim() !== "" && !currentItemIsKnown) {
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
                    handleSuggestionClick(index, suggestions[activeSuggestionIndex]); 
                    return; 
                }
                setIsSuggestionsOpen(false);
                setSuggestions([]);
                setActiveSuggestionIndex(-1);
                break;
            case 'Escape':
                event.preventDefault(); 
                setIsSuggestionsOpen(false); 
                setSuggestions([]);
                setActiveSuggestionIndex(-1);
                break;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape') {
            return;
        }
    }

    if (event.key === 'Enter' && identifierInputRefs[index]?.current === document.activeElement) {
        event.preventDefault(); 
        if(isSuggestionsOpen && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) { 
            handleSuggestionClick(index, suggestions[activeSuggestionIndex]); 
            return;
        }

        setIsSuggestionsOpen(false);
        setSuggestions([]);
        setActiveSuggestionIndex(-1);

        const currentIdentifier = form.getValues(`items.${index}.identifier`).trim(); 
        const targetPos = form.getValues("pointOfSale"); 

        if (currentIdentifier && targetPos) {
            const productInfo = getProductDetailsInPos(targetPos, currentIdentifier);
            if (productInfo) {
                update(index, {
                    identifier: productInfo.name,
                    barcode: productInfo.barcode,
                    productName: productInfo.name,
                    brandName: productInfo.brand,
                    price: productInfo.price, 
                    originalPrice: productInfo.price,
                    isKnownProduct: true,
                    stock: productInfo.quantity,
                    quantity: form.getValues(`items.${index}.quantity`) || 1, 
                });
                form.trigger(`items.${index}`); 

                if (currentIdentifier === productInfo.barcode) { 
                    processingBarcodeRef.current = true; 
                    if (index === fields.length - 1) {
                        append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice:0, isKnownProduct: false, stock:0 });
                        setTimeout(() => {
                            const nextIndex = fields.length -1; 
                            identifierInputRefs[nextIndex]?.current?.focus();
                            setCurrentFocusIndex(nextIndex);
                            processingBarcodeRef.current = false;
                        }, 0);
                    } else {
                        identifierInputRefs[index + 1]?.current?.focus();
                        setCurrentFocusIndex(index + 1);
                        processingBarcodeRef.current = false;
                    }
                } else { 
                    const quantityInput = document.getElementById(`items.${index}.quantity`);
                    if (quantityInput) { quantityInput.focus(); if(typeof (quantityInput as HTMLInputElement).select === 'function') (quantityInput as HTMLInputElement).select(); }
                }
            } else { 
                toast({ variant:"destructive", title: "Producto no encontrado", description: `No se encontró "${currentIdentifier}" en ${targetPos}. Añada manualmente si es un producto que no está en el inventario de este PDV o es completamente nuevo.` });
            }
        } else { 
            if (index === fields.length - 1) { 
                append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice:0, isKnownProduct: false, stock:0 });
                setTimeout(() => {
                    const nextAppendedIndex = fields.length -1; 
                    if(identifierInputRefs[nextAppendedIndex]?.current) { 
                        identifierInputRefs[nextAppendedIndex].current?.focus();
                        setCurrentFocusIndex(nextAppendedIndex); 
                    }
                }, 0);
            } else { 
                identifierInputRefs[index + 1]?.current?.focus();
                setCurrentFocusIndex(index + 1);
            }
        }
    }
 };

   useEffect(() => {
    const currentPointOfSale = form.getValues("pointOfSale"); 
    const defaultPOS = accessiblePOS.length > 0 ? accessiblePOS[0] : ""; 

    let needsReset = false; 
    if (accessiblePOS.length > 0 && (!currentPointOfSale || !accessiblePOS.includes(currentPointOfSale))) {
        needsReset = true;
    } 
    else if (accessiblePOS.length === 0 && currentPointOfSale) {
        needsReset = true;
    }

    if (needsReset) { 
        form.reset({ 
            pointOfSale: defaultPOS, 
            paymentMethod: form.getValues("paymentMethod") || "cash", 
            items: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice: 0, isKnownProduct: false, stock: 0 }], 
        });
        initialFocusDoneRef.current = false; 
    } 
    else if (!currentPointOfSale && defaultPOS) {
        form.setValue("pointOfSale", defaultPOS); 
         if (form.getValues("items").length === 0 || (form.getValues("items").length === 1 && !form.getValues("items.0.identifier"))) {
            form.setValue("items", [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice: 0, isKnownProduct: false, stock: 0 }]);
        }
        initialFocusDoneRef.current = false; 
    }

    setSuggestions([]); 
    setActiveSuggestionIndex(-1); 

    const posToFocus = form.getValues("pointOfSale") || defaultPOS; 
    if (posToFocus && fields.length > 0 && identifierInputRefs[0]?.current && !initialFocusDoneRef.current) {
      setTimeout(() => { 
        if (identifierInputRefs[0]?.current) { 
            identifierInputRefs[0].current?.focus(); 
            setCurrentFocusIndex(0); 
            initialFocusDoneRef.current = true; 
        }
      }, 100); 
    } else if (!posToFocus) { 
        initialFocusDoneRef.current = false;
    }
  }, [currentUser?.id, accessiblePOSKey, form, fields.length, identifierInputRefs]); 

  const generateSaleReceiptPdf = (saleData: SaleRecord) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [55, 200] 
    });

    const actualPageWidth = doc.internal.pageSize.getWidth(); 
    const margin = 3;
    const contentWidth = actualPageWidth - (margin * 2); 

    doc.setFontSize(12); 
    doc.text("RECIBO DE VENTA", actualPageWidth / 2, 10, { align: 'center' });

    doc.setFontSize(7); 
    doc.text(`ID: ${saleData.id.slice(-10)}`, margin, 16);
    doc.text(`Fecha: ${format(new Date(saleData.dateTime), "dd/MM/yy HH:mm", { locale: es })}`, margin, 19);
    doc.text(`PDV: ${saleData.pointOfSale}`, margin, 22);
    if (saleData.userName) {
      doc.text(`Cajero: ${saleData.userName}`, margin, 25);
    }
    doc.text(`Pago: ${saleData.paymentMethod === "cash" ? "Efectivo" : saleData.paymentMethod === "card" ? "Tarjeta" : "Transferencia"}`, margin, saleData.userName ? 28 : 25);
    
    const startYForTable = (saleData.userName ? 28 : 25) + 3;
    doc.setLineWidth(0.1);
    doc.line(margin, startYForTable - 1, actualPageWidth - margin, startYForTable - 1);

    const tableColumn = ["Producto", "Cant.", "Precio", "Subtotal"];
    const tableRows: any[][] = [];

    saleData.items.forEach(item => {
      const itemData = [
        item.productName,
        item.quantity,
        `$${item.price.toFixed(3)}`,
        `$${(item.price * item.quantity).toFixed(3)}`
      ];
      tableRows.push(itemData);
    });
    
    const prodW = contentWidth * 0.45; 
    const cantW = contentWidth * 0.15;   
    const precioW = contentWidth * 0.20; 
    const subtotalW = contentWidth - prodW - cantW - precioW; 

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: startYForTable + 1,
      theme: 'plain',
      styles: { fontSize: 6.5, cellPadding: 0.5, overflow: 'linebreak' },
      headStyles: { fontSize: 6.5, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 20, cellPadding: {top:1, right:0.5, bottom:1, left:0.5} },
      columnStyles: {
        0: { cellWidth: prodW, fontStyle: 'bold' }, 
        1: { cellWidth: cantW, halign: 'center' }, 
        2: { cellWidth: precioW, halign: 'right' }, 
        3: { cellWidth: subtotalW, halign: 'right' }, 
      },
      margin: { top: 5, right: margin, bottom: 5, left: margin },
      tableWidth: contentWidth,
    });

    const finalY = (doc as any).lastAutoTable.finalY || startYForTable + 20;
    doc.setLineWidth(0.1);
    doc.line(margin, finalY + 2, actualPageWidth - margin, finalY + 2); 

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${saleData.totalAmount.toFixed(3)}`, actualPageWidth - margin, finalY + 6, { align: 'right' });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("¡Gracias por su compra!", actualPageWidth / 2, finalY + 10, { align: 'center' });
    
    // Generar PDF como Data URI para adjuntar o descargar después
    // Esto es solo un ejemplo, podrías querer guardarlo en el estado o enviarlo al backend
    const pdfDataUri = doc.output('datauristring');
    // doc.save(`recibo_venta_${saleData.id.slice(-6)}.pdf`); // Comentado para evitar descarga inmediata

    // Devolver el data URI para potencialmente guardarlo en el registro de venta
    return pdfDataUri; 
  };

  const onSubmit = async (data: SalesFormValues) => {
    if (!currentUser || !canUserSell || !accessiblePOS.includes(data.pointOfSale)) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permiso para registrar ventas en esta ubicación." });
      return;
    }

    const itemsToProcess = data.items.filter(item =>
        item.isKnownProduct && 
        item.barcode && item.barcode.trim() !== "" && 
        item.productName && item.productName.trim() !== "" && 
        item.quantity > 0 
    );

    if (itemsToProcess.length === 0) {
        toast({ variant: "destructive", title: "Venta Vacía", description: "No hay ítems válidos para vender." });
        return;
    }
    
    // Validar stock antes de enviar al backend (el backend también debería validar)
    for (const item of itemsToProcess) {
        const productInStock = getProductDetailsInPos(data.pointOfSale, item.barcode); 
        if (!productInStock || productInStock.quantity < item.quantity) {
            toast({
                variant: "destructive",
                title: "Stock Insuficiente",
                description: `No hay suficiente stock para "${item.productName}" (${item.barcode}) en ${data.pointOfSale}. Disponible: ${productInStock?.quantity || 0}.`
            });
            const itemIndexInFullForm = data.items.findIndex(i => i.barcode === item.barcode);
            if (itemIndexInFullForm !== -1) {
                form.setError(`items.${itemIndexInFullForm}.quantity`, { type: "manual", message: `Stock: ${productInStock?.quantity || 0}` });
            }
            return; 
        }
    }

    const salePayload = {
      pointOfSale: data.pointOfSale,
      paymentMethod: data.paymentMethod,
      userId: currentUser.id,
      userName: currentUser.name,
      items: itemsToProcess.map(item => ({
        barcode: item.barcode,
        productName: item.productName,
        brandName: item.brandName,
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: calculateTotalSale(),
    };

    try {
      // TODO USUARIO: Reemplaza con la URL real de tu endpoint PHP para registrar la venta.
      const response = await fetch('/api/php/record_sale.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Error del servidor: ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `Error del servidor: ${response.status}`);
      }

      const savedSale: SaleRecord = await response.json();
      // Asumimos que el backend devuelve el ID y dateTime generados por el servidor.
      // Convertir dateTime de string a Date si es necesario.
      const saleWithDateObject = { ...savedSale, dateTime: new Date(savedSale.dateTime) };
      
      // Generar PDF
      const pdfUri = generateSaleReceiptPdf(saleWithDateObject);
      const saleWithPdf = { ...saleWithDateObject, receiptPdfDataUri: pdfUri };

      // Aquí podrías optar por no agregar directamente al historial local, sino recargar desde el backend
      // para tener la "fuente de verdad" del backend. Por simplicidad, lo agregamos localmente.
      setSalesHistory(prevHistory => [saleWithPdf, ...prevHistory]);
      
      // El inventario (stock) debería ser actualizado por el backend.
      // Aquí podrías invalidar el caché del inventario para forzar una recarga si es necesario,
      // o si tu InventoryContext se actualiza basado en eventos/WebSockets, eso se encargaría.
      // Por ahora, la UI del inventario podría no reflejar el cambio de stock inmediatamente
      // a menos que se recargue la página o el componente de inventario se recargue.

      toast({
        title: "Venta Registrada",
        description: `Venta N° ${savedSale.id.slice(-6)} procesada. El recibo (simulado) se generó.`,
      });
      resetSaleFormAndFocus(data);

    } catch (error: any) {
      console.error("Error al registrar la venta:", error);
      toast({
        variant: "destructive",
        title: "Error al Registrar Venta",
        description: error.message || "No se pudo registrar la venta. Intente de nuevo.",
      });
    }
  };


  const handleGenerateHistoryPdf = () => {
    const doc = new jsPDF(); 
    const tableColumn = ["Fecha y Hora", "PDV", "Usuario", "Ítems", "Método Pago", "Monto Total"]; 
    const tableRows: any[][] = []; 

    const title = `Historial de Ventas ${historyDateRange?.from ? `(${format(historyDateRange.from, "dd/MM/yy", { locale: es })} - ${historyDateRange.to ? format(historyDateRange.to, "dd/MM/yy", { locale: es }) : format(historyDateRange.from, "dd/MM/yy", { locale: es })})` : '(Todas las Fechas)'}`;
    doc.setFontSize(18);
    doc.text(title, 14, 15); 
    doc.setFontSize(11);
    doc.setTextColor(100); 

    filteredSalesHistory.forEach(sale => {
      const itemsString = sale.items?.map(item => `${item.productName} (${item.brandName}) x${item.quantity} @ $${item.price.toFixed(3)}`).join("\n") || "N/A";
      const saleData = [
        format(new Date(sale.dateTime), "dd/MM/yyyy HH:mm", { locale: es }), 
        sale.pointOfSale,
        sale.userName || sale.userId || "N/A", 
        itemsString, 
        sale.paymentMethod === "cash" ? "Efectivo"
          : sale.paymentMethod === "card" ? "Tarjeta"
          : "Transferencia",
        `$${typeof sale.totalAmount === 'number' ? sale.totalAmount.toFixed(3) : '0.000'}`
      ];
      tableRows.push(saleData);
    });

    autoTable(doc, {
      head: [tableColumn], 
      body: tableRows, 
      startY: 20, 
      theme: 'grid', 
      headStyles: { fillColor: [22, 160, 133] }, 
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' }, 
      columnStyles: {
        0: { cellWidth: 30 }, 
        1: { cellWidth: 25 }, 
        2: { cellWidth: 25 }, 
        3: { cellWidth: 'auto' }, 
        4: { cellWidth: 20 }, 
        5: { cellWidth: 20, halign: 'right' }, 
      }
    });
    doc.save(`historial_ventas_${format(new Date(), "yyyyMMddHHmmss")}.pdf`); 
    toast({title: "PDF Generado", description: "El historial de ventas ha sido descargado."}); 
  };


  if (isAuthLoading || (!isInventoryLoaded && !isClient) || (!isClient && !isAuthLoading)) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Registrar Venta</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/2 mb-2" /> 
            <Skeleton className="h-4 w-3/4" /> 
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" /> 
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" /> 
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" /> 
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canUserSell) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Registrar Venta</h1>
        <Card className="w-full text-center shadow-md border border-border/60">
          <CardHeader>
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>
              El usuario "{currentUser?.name || 'N/A'}" no tiene permiso para registrar ventas en ninguna ubicación.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Registrar Venta</h1>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle>Nueva Venta</CardTitle>
          <CardDescription>
            Añada productos a la venta y complete la transacción. El stock se deducirá de la ubicación seleccionada a través del backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={200}> 
            <Form {...form}> 
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <FormField
                    control={form.control}
                    name="pointOfSale"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Punto de Venta</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value); 
                            form.reset({
                              ...form.getValues(), 
                              pointOfSale: value, 
                              items: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice: 0, isKnownProduct: false, stock: 0 }], 
                            });
                            setSuggestions([]); 
                            setActiveSuggestionIndex(-1);
                            setCurrentFocusIndex(null); 
                          }}
                          value={field.value || ""} 
                          disabled={!canUserSell || accessiblePOS.length <= 1} 
                        >
                          <FormControl>
                            <SelectTrigger>
                              <Store className="h-4 w-4 mr-2 inline-block text-muted-foreground" />
                              <SelectValue placeholder="Seleccionar punto de venta..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accessiblePOS.map(pos => (
                              <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage /> 
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de Pago</FormLabel>
                        <Select
                          onValueChange={field.onChange} 
                          value={field.value || "cash"} 
                          disabled={!canUserSell || !form.watch("pointOfSale")} 
                        >
                          <FormControl>
                            <SelectTrigger>
                              <CreditCard className="h-4 w-4 mr-2 inline-block text-muted-foreground" />
                              <SelectValue placeholder="Seleccionar método de pago..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="card">Tarjeta</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /> 
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6">
                  <FormLabel className="text-xl font-semibold text-foreground">Ítems de la Venta</FormLabel>
                  {fields.map((itemField, index) => { 
                    const currentItem = form.watch(`items.${index}`); 
                    const showSuggestionsForThisItem = currentFocusIndex === index &&
                                                       isSuggestionsOpen &&
                                                       suggestions.length > 0 &&
                                                       !!form.getValues("pointOfSale") && 
                                                       !!currentItem.identifier && 
                                                       !currentItem.isKnownProduct; 

                    return (
                      <Card key={itemField.id} className="border p-5 rounded-lg space-y-4 relative shadow-sm bg-card overflow-hidden">
                        <div className="flex justify-between items-start">
                            <p className="text-lg font-medium text-primary">Ítem #{index + 1}</p>
                            {fields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(index)} 
                                    className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-7 w-7"
                                    aria-label="Quitar ítem de la venta"
                                    disabled={!canUserSell} 
                                >
                                    <MinusCircle className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <FormField
                          control={form.control}
                          name={`items.${index}.identifier`}
                          render={({ field: identifierField }) => (
                            <FormItem>
                              <FormLabel>Buscar/Ingresar Producto (Nombre o Código)</FormLabel>
                              <Popover
                                open={showSuggestionsForThisItem} 
                                onOpenChange={(open) => {
                                  if (!open && currentFocusIndex === index) {
                                    setTimeout(() => {
                                      if (!document.activeElement?.closest(`#item-${index}-suggestions-sales`) &&
                                          document.activeElement !== identifierInputRefs[index]?.current) {
                                        setIsSuggestionsOpen(false);
                                      }
                                    }, 50); 
                                  } else if (open && identifierField.value && !form.watch(`items.${index}.isKnownProduct`)) {
                                     handleIdentifierChange(index, identifierField.value);
                                  } else {
                                    setIsSuggestionsOpen(open); 
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <div className="flex items-center">
                                    <div className="relative flex-grow"> 
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                      <FormControl>
                                        <Input
                                          placeholder="Escanear o ingresar producto/código..."
                                          {...identifierField} 
                                          value={identifierField.value || ''} 
                                          ref={(e) => { 
                                            identifierField.ref(e); 
                                            if(e && (!identifierInputRefs[index] || identifierInputRefs[index].current !== e)) {
                                              const currentRefs = [...identifierInputRefs];
                                              currentRefs[index] = { current: e };
                                              setIdentifierInputRefs(currentRefs); 
                                            }
                                          }}
                                          onChange={(e) => { 
                                            identifierField.onChange(e); 
                                            handleIdentifierChange(index, e.target.value); 
                                          }}
                                          onFocus={() => { 
                                            setCurrentFocusIndex(index); 
                                            const currentIdVal = form.getValues(`items.${index}.identifier`);
                                            const isProdKnown = form.getValues(`items.${index}.isKnownProduct`);
                                            if (currentIdVal && !isProdKnown) {
                                              handleIdentifierChange(index, currentIdVal);
                                            } else if (currentIdVal && isProdKnown) {
                                              const knownProduct = getProductDetailsInPos(form.getValues("pointOfSale"), form.getValues(`items.${index}.barcode`) || "");
                                              if (knownProduct && currentIdVal.toLowerCase() !== knownProduct.name.toLowerCase() && currentIdVal !== knownProduct.barcode) {
                                                handleIdentifierChange(index, currentIdVal); 
                                              } else if (!knownProduct && currentIdVal) { 
                                                handleIdentifierChange(index, currentIdVal);
                                              } else { 
                                                setIsSuggestionsOpen(false);
                                                setSuggestions([]);
                                              }
                                            } else { 
                                              setIsSuggestionsOpen(false);
                                              setSuggestions([]);
                                            }
                                          }}
                                          onKeyDown={(e) => handleKeyDown(e, index)} 
                                          className="pl-10 pr-2 w-full rounded-r-none" 
                                          disabled={!canUserSell || !form.watch("pointOfSale")} 
                                          autoComplete="off" 
                                        />
                                      </FormControl>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-10 px-3 border-l-0 rounded-l-none"
                                      aria-label="Escanear código de barras"
                                      onClick={() => {
                                        identifierInputRefs[index]?.current?.focus(); 
                                      }}
                                      disabled={!canUserSell || !form.watch("pointOfSale")}
                                    >
                                      <Barcode className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent
                                  key={`popover-sales-${index}-${suggestions.map(s=>s.id).join('-')}`} 
                                  id={`item-${index}-suggestions-sales`} 
                                  className="w-[--radix-popover-trigger-width] p-0" 
                                  align="start" 
                                  sideOffset={5} 
                                  onOpenAutoFocus={(e) => { 
                                      e.preventDefault();
                                      identifierInputRefs[index]?.current?.focus(); 
                                  }}
                                  onInteractOutside={(e) => { 
                                      if (identifierInputRefs[index]?.current && identifierInputRefs[index].current.contains(e.target as Node)) {
                                          e.preventDefault();
                                      } else if (!document.activeElement?.closest(`#item-${index}-suggestions-sales`)) {
                                          setIsSuggestionsOpen(false);
                                      }
                                  }}
                                >
                                  <div className="max-h-60 overflow-y-auto"> 
                                    {suggestions.map((product, suggIndex) => (
                                      <button
                                        key={`${product.id}-${suggIndex}`} 
                                        type="button"
                                        className={`flex items-center w-full px-4 py-2 text-sm focus:outline-none ${activeSuggestionIndex === suggIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/80'}`}
                                        onClick={() => handleSuggestionClick(index, product)} 
                                        onMouseDown={(e) => e.preventDefault()} 
                                        role="option"
                                        aria-selected={activeSuggestionIndex === suggIndex}
                                      >
                                        <Image
                                          src={product.imageUrl || `https://placehold.co/30x30.png`}
                                          alt={product.name || "Imagen del producto"}
                                          width={30} height={30}
                                          className="rounded-sm object-cover mr-3 border border-border/30"
                                          data-ai-hint={product['data-ai-hint'] || "producto belleza"}
                                          onError={(e) => { 
                                            const target = e.target as HTMLImageElement;
                                            if (target.src !== placeholderSvg) { target.src = placeholderSvg; }
                                            target.onerror = null;
                                          }}
                                        />
                                        <div className="flex-grow text-left">
                                          <span className="font-medium">{product.name}</span>
                                          <span className="text-xs text-muted-foreground ml-2">({product.brand})</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-auto mr-2">{product.barcode}</span>
                                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">Stock: {product.quantity}</Badge>
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <FormMessage /> 
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_100px_120px] gap-4 items-end">
                          <FormField
                            control={form.control}
                            name={`items.${index}.productName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre Producto</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nombre del producto" {...field} value={field.value || ''} disabled id={`items.${index}.productName`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={form.control}
                            name={`items.${index}.brandName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Marca</FormLabel>
                                <FormControl>
                                  <Input placeholder="Marca del producto" {...field} value={field.value || ''} disabled id={`items.${index}.brandName`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cantidad</FormLabel>
                                <FormControl>
                                 <Input
                                    type="number" min="1" placeholder="Cant."
                                    {...field}
                                    id={`items.${index}.quantity`}
                                    value={field.value === undefined || field.value === null || isNaN(field.value) ? '' : String(field.value)} 
                                    onChange={e => { 
                                        const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                        field.onChange(val); 
                                        const stock = form.getValues(`items.${index}.stock`) ?? 0;
                                        if (val !== undefined && val > stock && form.getValues(`items.${index}.isKnownProduct`)) {
                                            form.setError(`items.${index}.quantity`, { type: "manual", message: `Máx: ${stock}`});
                                        } else {
                                            form.clearErrors(`items.${index}.quantity`);
                                        }
                                    }}
                                    disabled={!canUserSell || !form.watch(`items.${index}.isKnownProduct`)} 
                                    onFocus={(e) => e.target.select()} 
                                />
                                </FormControl>
                                <FormMessage /> 
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Precio / Ud.</FormLabel>
                                <FormControl>
                                  <div className="relative"> 
                                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                      <Input
                                        type="number" step="0.001" placeholder="Precio"
                                        {...field}
                                        id={`items.${index}.price`}
                                        value={field.value === undefined || field.value === null || isNaN(field.value) ? '' : String(field.value)} 
                                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                        disabled={true} 
                                        className="pl-8" 
                                        onFocus={(e) => e.target.select()} 
                                      />
                                  </div>
                                </FormControl>
                                <FormMessage /> 
                              </FormItem>
                            )}
                          />
                        </div>
                         {currentItem.isKnownProduct && (
                             <Badge variant="secondary" className="mt-2 text-xs">
                                Stock disponible en {form.getValues("pointOfSale") || 'PDV'}: {currentItem.stock}
                             </Badge>
                         )}
                      </Card>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { 
                      append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, price: 0, originalPrice:0, isKnownProduct: false, stock:0 });
                       setTimeout(() => {
                            const newIndex = fields.length; 
                            if (identifierInputRefs[newIndex]?.current) { 
                               identifierInputRefs[newIndex].current.focus();
                               setCurrentFocusIndex(newIndex); 
                            }
                        }, 0);
                    }}
                    disabled={!isInventoryLoaded || !canUserSell || !form.watch("pointOfSale")} 
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Otro Ítem
                  </Button>

                  {form.formState.errors.items?.root?.message && (
                      <p className="text-sm font-medium text-destructive pt-2">{form.formState.errors.items.root.message}</p>
                  )}
                   {form.formState.errors.items?.message && typeof form.formState.errors.items.message === 'string' && (
                       <p className="text-sm font-medium text-destructive pt-2">{form.formState.errors.items.message}</p>
                   )}
                  {form.formState.errors.items && !form.formState.errors.items.root && !(typeof form.formState.errors.items.message === 'string') && Object.values(form.formState.errors.items).some(err => err?.message) && (
                       <p className="text-sm font-medium text-destructive pt-2">Por favor, compruebe los detalles individuales del producto en busca de errores arriba.</p>
                   )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t">
                    <div className="text-2xl font-bold text-foreground mb-4 sm:mb-0">
                        Total Venta: ${calculateTotalSale().toFixed(3)}
                    </div>
                    <Button
                        type="submit"
                        size="lg"
                        disabled={ 
                            !form.formState.isValid || 
                            form.formState.isSubmitting || 
                            !isInventoryLoaded || 
                            !canUserSell || 
                            form.getValues("items").filter(p => p.isKnownProduct && p.barcode && p.quantity > 0).length === 0
                        }
                        className="w-full sm:w-auto"
                    >
                        {form.formState.isSubmitting ? "Procesando..." : "Completar Venta"}
                    </Button>
                </div>
                {!isInventoryLoaded && <p className="text-sm text-muted-foreground mt-2">Cargando datos de inventario, por favor espera...</p>}
                {!canUserSell && <p className="text-sm text-destructive mt-2">No tienes permiso para registrar ventas en esta ubicación.</p>}
              </form>
            </Form>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle>Historial de Ventas</CardTitle>
                <CardDescription>Un registro de todas las ventas pasadas.</CardDescription>
            </div>
            <div className="flex gap-2 items-center">
                 <DatePickerWithRange onDateChange={setHistoryDateRange} /> 
                 <Button onClick={handleGenerateHistoryPdf} disabled={filteredSalesHistory.length === 0}> 
                    <FileDown className="mr-2 h-4 w-4" />
                    Descargar PDF
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isClient && !isLoadingHistory ? (
            <div className="overflow-x-auto"> 
              <Table>
                <TableCaption>Una lista de ventas recientes.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                    <TableHead>PDV</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Ítems Vendidos</TableHead>
                    <TableHead className="w-[120px]">Método Pago</TableHead>
                    <TableHead className="text-right w-[120px]">Monto Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSalesHistory.length > 0 ? filteredSalesHistory.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30"> 
                      <TableCell className="font-medium whitespace-nowrap text-sm">
                        {format(new Date(sale.dateTime), "d MMM, yyyy h:mm a", { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm">{sale.pointOfSale}</TableCell>
                      <TableCell className="text-sm">{sale.userName || sale.userId || 'N/A'}</TableCell>
                      <TableCell>
                        <ul className="list-none space-y-1 text-sm">
                          {sale.items && Array.isArray(sale.items) && sale.items.length > 0 ? sale.items.map((item, idx) => (
                            <li key={`${sale.id}-item-${idx}-${item.barcode}`} className="text-xs"> 
                              {item.productName} ({item.brandName}) - Cant: {item.quantity} @ ${item.price ? item.price.toFixed(3) : '0.000'}
                            </li>
                          )) : (
                            <li className="text-xs text-muted-foreground">No hay ítems en esta venta.</li>
                          )}
                        </ul>
                      </TableCell>
                      <TableCell className="text-sm">
                         <Badge variant={ 
                             sale.paymentMethod === 'cash' ? 'default'
                           : sale.paymentMethod === 'card' ? 'secondary'
                           : 'outline'
                         } className="capitalize">
                           {sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">${typeof sale.totalAmount === 'number' ? sale.totalAmount.toFixed(3) : '0.000'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        {historyDateRange?.from ? "No hay ventas en el rango de fechas seleccionado." : "Aún no hay ventas."}
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4 py-6">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <p className="text-center text-muted-foreground">Cargando historial de ventas...</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    
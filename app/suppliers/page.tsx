
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
import { Textarea } from "@/components/ui/textarea";
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
import { PlusCircle, MinusCircle, Barcode, DollarSign, Building, Image as ImageIcon, Info, Lock, Search, FileText, Layers, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { useInventoryContext } from '@/context/InventoryContext';
import type { Product } from '@/context/InventoryContext'; // Ya estaba como Product, no ProductInventory
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

const supplierProductSchema = z.object({
  identifier: z.string().min(1, "Código de barras o nombre requerido.").or(z.literal("")),
  barcode: z.string().min(1, "El código de barras es requerido."),
  productName: z.string().min(1, "El nombre del producto es requerido."),
  brandName: z.string().min(1, "El nombre de la marca es requerido."),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1.").default(1),
  purchasePrice: z.coerce.number().positive("El precio de compra debe ser un número positivo.").default(0.001),
  sellingPrice: z.coerce.number().positive("El precio de venta debe ser un número positivo.").optional().nullable(),
  imageUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal("")).nullable(),
  description: z.string().optional().or(z.literal("")).nullable(),
  aiHint: z.string().optional().nullable(),
  isKnownProduct: z.boolean().optional().default(false),
  wholesaleQuantityThreshold: z.coerce.number().min(1, "Debe ser al menos 1 si se especifica.").optional().nullable(),
  wholesalePrice: z.coerce.number().positive("Debe ser positivo si se especifica.").optional().nullable(),
  lowStockThreshold: z.coerce.number().min(0, "Debe ser 0 o mayor si se especifica.").optional().nullable(),
});

const supplierFormSchema = z.object({
  supplierName: z.string().min(1, "El nombre del proveedor es requerido."),
  pointOfSale: z.string().min(1, "El Punto de Venta de destino es requerido."),
  products: z.array(supplierProductSchema).min(1, "Se requiere al menos un producto.")
    .refine(items => items.every(item => item.barcode && item.barcode.trim() !== "" && item.productName && item.productName.trim() !== "" && item.brandName && item.brandName.trim() !== ""), {
        message: "Asegúrese de que todos los productos tengan código de barras, nombre y marca válidos.",
        path: ["products"],
    }),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export interface SupplierRecordProduct {
    barcode: string;
    productName: string;
    brandName: string;
    quantity: number;
    purchasePrice: number;
    description?: string | null;
    oldSellingPrice?: number;
    newSellingPrice?: number | null;
    wholesaleQuantityThreshold?: number | null;
    wholesalePrice?: number | null;
    lowStockThreshold?: number | null;
}
export interface SupplierRecord {
  id: string;
  dateTime: string; // Cambiado a string para ser compatible con lo que vendría de un backend JSON
  supplierName: string;
  pointOfSale: string;
  userId: string | null;
  userName?: string;
  products: SupplierRecordProduct[];
}

// const SUPPLIER_HISTORY_LOCAL_STORAGE_KEY = 'supplierHistory'; // Ya no se usará directamente aquí

export default function SuppliersPage(): JSX.Element {
  const { toast } = useToast();
  const {
      isInventoryLoaded,
      getProductDetailsAnywhere,
      getProductDetailsInPos,
      // Las funciones updateProductQuantity, addProduct, updateProductPrice ahora se manejarían en el backend
      getPointsOfSaleForUser,
      inventory, // Aún se podría usar para obtener detalles de productos existentes para autocompletar
  } = useInventoryContext(); // El contexto necesitará ser adaptado si también obtiene datos del backend
  const { currentUser, isLoading: isAuthLoading } = useAuth();

  const [supplierHistory, setSupplierHistory] = useState<SupplierRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<Product & { pos: string }>>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [currentFocusIndex, setCurrentFocusIndex] = useState<number | null>(null);
  const [identifierInputRefs, setIdentifierInputRefs] = useState<Array<React.RefObject<HTMLInputElement>>>([]);
  const initialFocusDoneRef = useRef(false);
  const [isSuggestionsOpen, setIsSuggestionsOpenState] = useState(false);

  const accessiblePOS = useMemo(() => getPointsOfSaleForUser(), [getPointsOfSaleForUser]);
  const canUserAddStock = accessiblePOS.length > 0;
  const accessiblePOSKey = useMemo(() => [...accessiblePOS].sort().join(','), [accessiblePOS]);

  // Cargar historial de proveedores desde el backend al montar
  useEffect(() => {
    setIsClient(true);
    const fetchSupplierHistory = async () => {
      setIsLoadingHistory(true);
      try {
        // TODO USUARIO: Reemplaza '/api/php/get_supplier_entries.php' con la URL real de tu endpoint PHP
        const response = await fetch('/api/php/get_supplier_entries.php'); // Endpoint hipotético
        if (!response.ok) {
          throw new Error(`Error del servidor: ${response.status}`);
        }
        const data: SupplierRecord[] = await response.json();
        // Asegúrate de que dateTime se convierta a Date si es necesario (aunque para la tabla se puede usar string)
        setSupplierHistory(data.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));
      } catch (error) {
        console.error("Falló al cargar el historial de proveedores desde el backend:", error);
        toast({
          variant: "destructive",
          title: "Error al Cargar Historial",
          description: "No se pudo cargar el historial de proveedores. Verifica tu conexión o el backend.",
        });
        setSupplierHistory([]); // Establecer a vacío en caso de error
      } finally {
        setIsLoadingHistory(false);
      }
    };

    if (canUserAddStock) {
        fetchSupplierHistory();
    }
  }, [isClient, toast, canUserAddStock]); // No se necesita `supplierHistory` como dependencia aquí


  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      supplierName: "",
      pointOfSale: accessiblePOS[0] || "",
      products: [{ identifier: "", barcode: "", productName: "", brandName:"", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl: null, description: null, aiHint: null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null }],
    },
     mode: "onChange",
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "products",
  });

  useEffect(() => {
    setIdentifierInputRefs(prevRefs =>
      Array(fields.length)
        .fill(null)
        .map((_, i) => prevRefs[i] || React.createRef<HTMLInputElement>())
    );
  }, [fields.length]);

  const handleIdentifierChange = useCallback((index: number, identifierValue: string) => {
    setCurrentFocusIndex(index);
    form.setValue(`products.${index}.identifier`, identifierValue, { shouldValidate: true, shouldDirty: true });
    const formItemValues = form.getValues(`products.${index}`);

    if (!identifierValue.trim() || !isInventoryLoaded || !currentUser || isAuthLoading) {
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        setIsSuggestionsOpenState(false);
        if (!identifierValue.trim() && formItemValues.isKnownProduct) {
            update(index, {
                ...formItemValues,
                identifier: "", barcode: "", productName: "",
                brandName: "", sellingPrice: null, imageUrl: null, description: null, aiHint: null, isKnownProduct: false,
                wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null,
                quantity: formItemValues.quantity || 1,
                purchasePrice: formItemValues.purchasePrice || 0.001,
            });
        }
        return;
    }
    form.clearErrors(`products.${index}.identifier`);

    const lowerIdentifier = identifierValue.toLowerCase();
    const allProductsFound: Array<Product & { pos: string }> = [];

    // La lógica para obtener productos para sugerencias aún podría usar el inventario local (InventoryContext)
    // o podrías tener otro endpoint para buscar productos globalmente si es necesario.
    // Por ahora, mantenemos la lógica de sugerencias basada en el inventario cargado en el cliente.
    if (isInventoryLoaded && inventory) {
        Object.entries(inventory).forEach(([pos, brands]) => {
            Object.values(brands).flat().forEach(product => {
                if (product.name.toLowerCase().includes(lowerIdentifier) || product.barcode.includes(lowerIdentifier)) {
                    if (!allProductsFound.some(p => p.barcode === product.barcode && p.pos === pos)) {
                        allProductsFound.push({ ...product, pos });
                    }
                }
            });
        });
    }

    const knownProductName = formItemValues.productName;
    const knownBarcode = formItemValues.barcode;

    if (formItemValues.isKnownProduct &&
        ((knownProductName && identifierValue.toLowerCase() === knownProductName.toLowerCase()) ||
         (knownBarcode && identifierValue === knownBarcode) )) {
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        setIsSuggestionsOpenState(false);
    } else {
        const newSuggestions = allProductsFound.slice(0, 7);
        setSuggestions(newSuggestions);
        setActiveSuggestionIndex(-1);
        const show = newSuggestions.length > 0 && identifierValue.trim().length > 0 && !formItemValues.isKnownProduct;
        setIsSuggestionsOpenState(show);
    }

    if (formItemValues.isKnownProduct) {
        const previouslySelectedProduct = getProductDetailsAnywhere(formItemValues.barcode || "");
        if (previouslySelectedProduct &&
            identifierValue.toLowerCase() !== previouslySelectedProduct.name.toLowerCase() &&
            identifierValue !== previouslySelectedProduct.barcode) {
            update(index, {
                ...formItemValues,
                barcode: "", productName: "", brandName: "", description: null,
                sellingPrice: null, imageUrl: null, aiHint: null, isKnownProduct: false,
                wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null,
            });
        }
    } else {
         if (formItemValues.identifier !== identifierValue || formItemValues.isKnownProduct) {
             update(index, {
                 ...formItemValues,
                 identifier: identifierValue,
                 isKnownProduct: false,
             });
         }
    }
    form.trigger(`products.${index}.identifier`);
}, [getProductDetailsAnywhere, update, form, isInventoryLoaded, currentUser, isAuthLoading, inventory]);


    const handleSuggestionClick = (index: number, product: Product & { pos: string }) => {
        form.setValue(`products.${index}.identifier`, product.name, { shouldValidate: true });
        update(index, {
            ...form.getValues(`products.${index}`),
            identifier: product.name,
            barcode: product.barcode,
            productName: product.name,
            brandName: product.brand,
            sellingPrice: product.price,
            imageUrl: product.imageUrl || null,
            description: product.description || null,
            aiHint: product['data-ai-hint'] || null,
            wholesaleQuantityThreshold: product.wholesaleQuantityThreshold ?? null,
            wholesalePrice: product.wholesalePrice ?? null,
            lowStockThreshold: product.lowStockThreshold ?? null,
            isKnownProduct: true,
            quantity: form.getValues(`products.${index}.quantity`) || 1,
            purchasePrice: form.getValues(`products.${index}.purchasePrice`) || 0.001,
        });
        setIsSuggestionsOpenState(false);
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        form.trigger(`products.${index}`);
        setTimeout(() => {
            const quantityInput = document.getElementById(`products.${index}.quantity`);
            if (quantityInput) {
                quantityInput.focus();
                if (typeof (quantityInput as HTMLInputElement).select === 'function') {
                    (quantityInput as HTMLInputElement).select();
                }
            }
        }, 0);
    };

   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    const isCurrentItemFocused = currentFocusIndex === index;
    const currentIdentifierValue = form.getValues(`products.${index}.identifier`);
    const currentItemIsKnown = form.getValues(`products.${index}.isKnownProduct`);

    if (isSuggestionsOpen && isCurrentItemFocused && suggestions.length > 0 && currentIdentifierValue && currentIdentifierValue.trim() !== "" && !currentItemIsKnown) {
        switch (event.key) {
            case 'ArrowDown': event.preventDefault(); setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length); break;
            case 'ArrowUp': event.preventDefault(); setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length); break;
            case 'Enter': if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) { event.preventDefault(); handleSuggestionClick(index, suggestions[activeSuggestionIndex]); return; } setIsSuggestionsOpenState(false); setSuggestions([]); setActiveSuggestionIndex(-1); break;
            case 'Escape': event.preventDefault(); setIsSuggestionsOpenState(false); setSuggestions([]); setActiveSuggestionIndex(-1); break;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape') return;
    }

    if (event.key === 'Enter' && identifierInputRefs[index]?.current === document.activeElement) {
        event.preventDefault();
        if(isSuggestionsOpen) { setIsSuggestionsOpenState(false); setSuggestions([]); setActiveSuggestionIndex(-1); }

        const currentIdentifier = form.getValues(`products.${index}.identifier`).trim();
        const itemIsNowKnown = form.getValues(`products.${index}.isKnownProduct`);

        if (itemIsNowKnown) {
            const quantityInput = document.getElementById(`products.${index}.quantity`);
            if (quantityInput) { quantityInput.focus(); if(typeof (quantityInput as HTMLInputElement).select === 'function') (quantityInput as HTMLInputElement).select();}
        } else if (currentIdentifier) {
             const productInfo = getProductDetailsAnywhere(currentIdentifier);
             if (productInfo) {
                 handleSuggestionClick(index, { ...productInfo, pos: productInfo.pos || form.getValues("pointOfSale") });
             } else {
                toast({ title: "Nuevo Producto", description: `Registrando "${currentIdentifier}" como nuevo. Complete los detalles.` });
                const currentItemVals = form.getValues(`products.${index}`);
                const isLikelyBarcode = /^\d{6,}$/.test(currentIdentifier);
                update(index, { ...currentItemVals, identifier: currentIdentifier, barcode: isLikelyBarcode && !currentItemVals.barcode ? currentIdentifier : currentItemVals.barcode || "", productName: !isLikelyBarcode && !currentItemVals.productName ? currentIdentifier : currentItemVals.productName || "", isKnownProduct: false });
                if (!form.getValues(`products.${index}.barcode`)) document.getElementById(`products.${index}.barcode`)?.focus();
                else if (!form.getValues(`products.${index}.productName`)) document.getElementById(`products.${index}.productName`)?.focus();
                else if (!form.getValues(`products.${index}.brandName`)) document.getElementById(`products.${index}.brandName`)?.focus();
                else document.getElementById(`products.${index}.quantity`)?.focus();
             }
        } else {
            if (index === fields.length - 1) {
                append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl:null, description: null, aiHint:null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null });
                setTimeout(() => { const nextIndex = fields.length; if (identifierInputRefs[nextIndex]?.current) { identifierInputRefs[nextIndex]?.current?.focus(); setCurrentFocusIndex(nextIndex);}}, 0);
            } else { identifierInputRefs[index + 1]?.current?.focus(); setCurrentFocusIndex(index + 1); }
        }
    }
 };

   useEffect(() => {
        const defaultPOS = accessiblePOS.length > 0 ? accessiblePOS[0] : "";
        const currentPOSInForm = form.getValues("pointOfSale");
        let resetNeeded = false;
        if ( (currentPOSInForm && !accessiblePOS.includes(currentPOSInForm) && defaultPOS) || (!currentPOSInForm && defaultPOS) ) resetNeeded = true;
        else if (currentPOSInForm && accessiblePOS.length === 0) resetNeeded = true;
        if (resetNeeded) {
            form.reset({ supplierName: form.getValues("supplierName") || "", pointOfSale: defaultPOS, products: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl: null, description: null, aiHint:null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null }]});
            initialFocusDoneRef.current = false;
        }
        const items = form.getValues("products");
        if (!items || items.length === 0 || (items.length === 1 && !items[0].identifier && !items[0].barcode) ) {
             const defaultProduct = { identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl: null, description: null, aiHint:null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null };
            if (items.length === 0 || JSON.stringify(items[0]) !== JSON.stringify(defaultProduct) ) form.setValue("products", [defaultProduct]);
        }
        setSuggestions([]); setActiveSuggestionIndex(-1);
        const posToFocus = form.getValues("pointOfSale");
        if (posToFocus && fields.length > 0 && identifierInputRefs[0]?.current && !initialFocusDoneRef.current) {
          setTimeout(() => { if (identifierInputRefs[0]?.current) { identifierInputRefs[0].current.focus(); setCurrentFocusIndex(0); initialFocusDoneRef.current = true; }}, 100);
        } else if (!posToFocus) initialFocusDoneRef.current = false;
    }, [currentUser?.id, accessiblePOSKey, form, fields.length, identifierInputRefs]);

  async function onSubmit(data: SupplierFormValues) {
     if (!currentUser || !canUserAddStock || !accessiblePOS.includes(data.pointOfSale)) {
         toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permiso para añadir stock a esta ubicación." });
         return;
     }

    const newEntryPayload = {
      supplierName: data.supplierName,
      pointOfSale: data.pointOfSale,
      userId: currentUser.id,
      userName: currentUser.name,
      products: data.products.filter(p => p.barcode && p.productName && p.brandName && p.quantity > 0).map(p => ({
        barcode: p.barcode,
        productName: p.productName,
        brandName: p.brandName,
        quantity: p.quantity,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        imageUrl: p.imageUrl,
        description: p.description,
        aiHint: p.aiHint,
        wholesaleQuantityThreshold: p.wholesaleQuantityThreshold,
        wholesalePrice: p.wholesalePrice,
        lowStockThreshold: p.lowStockThreshold,
        // Campos para el backend sobre el estado del producto antes de esta entrada
        isKnownProductInPos: !!getProductDetailsInPos(data.pointOfSale, p.barcode),
        currentSellingPriceInPos: getProductDetailsInPos(data.pointOfSale, p.barcode)?.price
      })),
      dateTime: new Date().toISOString(), // El backend podría generar esto también
    };

    if (newEntryPayload.products.length === 0) {
        toast({ variant: "destructive", title: "Entrada Inválida", description: "No se incluyeron productos válidos. Asegúrese de que cada producto tenga código de barras, nombre, marca y cantidad." });
        return;
    }

    // TODO USUARIO: Reemplaza '/api/php/add_supplier_entry.php' con la URL real de tu endpoint PHP
    try {
      const response = await fetch('/api/php/add_supplier_entry.php', { // Endpoint hipotético
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntryPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Error del servidor: ${response.status}` }));
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      const savedEntry: SupplierRecord = await response.json(); // Asume que el backend devuelve la entrada guardada

      // Actualizar el historial local (opcional, podrías recargar desde el backend)
      setSupplierHistory(prev => [savedEntry, ...prev].sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));

      toast({
        title: "Entrada de Proveedor Registrada",
        description: `${newEntryPayload.products.length} línea(s) de producto de ${data.supplierName} procesadas para ${data.pointOfSale}.`,
      });

      // Resetear formulario
      form.reset({
         supplierName: data.supplierName,
         pointOfSale: data.pointOfSale,
         products: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl: null, description: null, aiHint:null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null }],
      });
      initialFocusDoneRef.current = false;
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      if (identifierInputRefs[0]?.current) {
          setTimeout(()=> { if(identifierInputRefs[0].current) { identifierInputRefs[0].current.focus(); setCurrentFocusIndex(0); initialFocusDoneRef.current = true; }},0);
      }
       // Aquí podrías llamar a una función del InventoryContext para invalidar y recargar el inventario si es necesario
       // ej: inventoryContext.refreshInventoryForPos(data.pointOfSale);

    } catch (error: any) {
      console.error("Error al guardar la entrada de proveedor:", error);
      toast({
        variant: "destructive",
        title: "Error al Guardar",
        description: error.message || "No se pudo registrar la entrada de proveedor. Intente de nuevo.",
      });
    }
  }

   if (isAuthLoading || (!isInventoryLoaded && !isLoadingHistory) || !isClient) {
       return ( <div className="space-y-8"> <h1 className="text-3xl font-bold text-foreground mb-6">Entrada de Stock de Proveedor</h1> <Card><CardHeader><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card> <Card><CardHeader><Skeleton className="h-8 w-1/3 mb-2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card> </div> );
   }

    if (!canUserAddStock) {
        return ( <div className="space-y-8"> <h1 className="text-3xl font-bold text-foreground mb-6">Entrada de Stock de Proveedor</h1> <Card className="w-full text-center shadow-md border border-border/60"><CardHeader><Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><CardTitle>Acceso Denegado</CardTitle><CardDescription>El usuario "{currentUser?.name || 'N/A'}" no tiene permiso para añadir stock.</CardDescription></CardHeader></Card> </div> );
    }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Entrada de Stock de Proveedor</h1>
      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle>Registrar Stock Entrante</CardTitle>
          <CardDescription>Registra los productos recibidos de un proveedor. El stock se añadirá/actualizará en la base de datos a través de tu backend PHP.</CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={200}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                   <Card className="bg-card p-6 rounded-lg shadow-sm border">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                           <FormField control={form.control} name="supplierName" render={({ field }) => ( <FormItem> <FormLabel>Proveedor</FormLabel> <FormControl> <div className="relative"> <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input placeholder="Escriba el nombre del proveedor..." {...field} className="pl-10" disabled={!canUserAddStock}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                            <FormField control={form.control} name="pointOfSale" render={({ field }) => ( <FormItem> <FormLabel>Punto de Venta Destino</FormLabel> <Select onValueChange={(value) => { field.onChange(value); form.reset({ ...form.getValues(), pointOfSale: value, products: [{ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl: null, description: null, aiHint:null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null }]}); initialFocusDoneRef.current = false; setTimeout(() => { if(identifierInputRefs[0]?.current) { identifierInputRefs[0]?.current.focus(); setCurrentFocusIndex(0); initialFocusDoneRef.current = true; }},0);}} value={field.value || ""} disabled={!canUserAddStock || accessiblePOS.length <=1}> <FormControl> <SelectTrigger> <Building className="h-4 w-4 mr-2 inline-block text-muted-foreground" /> <SelectValue placeholder="Seleccionar destino accesible..." /> </SelectTrigger> </FormControl> <SelectContent> {accessiblePOS.map(pos => ( <SelectItem key={pos} value={pos}>{pos}</SelectItem> ))} </SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                       </div>
                   </Card>
                  <div className="space-y-6">
                     <FormLabel className="text-xl font-semibold text-foreground">Productos Recibidos</FormLabel>
                     {fields.map((itemField, index) => {
                        const currentItem = form.watch(`products.${index}`);
                        const showSuggestionsForThisItem = currentFocusIndex === index && isSuggestionsOpen && suggestions.length > 0 && !!form.getValues("pointOfSale") && !!currentItem.identifier && !currentItem.isKnownProduct;
                        return (
                        <Card key={itemField.id} className="border p-5 rounded-lg space-y-4 relative shadow-sm bg-card overflow-hidden">
                            {fields.length > 1 && ( <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="absolute top-3 right-3 text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-7 w-7" aria-label="Quitar entrada de producto" disabled={!canUserAddStock}> <MinusCircle className="h-4 w-4" /> </Button> )}
                           <FormField control={form.control} name={`products.${index}.identifier`} render={({ field: identifierField }) => ( <FormItem> <FormLabel>Buscar/Ingresar Producto (Nombre o Código)</FormLabel> <Popover open={showSuggestionsForThisItem} onOpenChange={(open) => { if (!open && currentFocusIndex === index) { setTimeout(() => { if (!document.activeElement?.closest(`#item-${index}-suggestions-supplier`) && document.activeElement !== identifierInputRefs[index]?.current) { setIsSuggestionsOpenState(false); }}, 50); } else if (open && identifierField.value && !form.watch(`products.${index}.isKnownProduct`)) { handleIdentifierChange(index, identifierField.value); } else if (!open && form.watch(`products.${index}.isKnownProduct`)) { setIsSuggestionsOpenState(false); setSuggestions([]); setActiveSuggestionIndex(-1); } else { setIsSuggestionsOpenState(open); }}}> <PopoverTrigger asChild> <div className="relative flex items-center"> <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <FormControl> <Input placeholder="Buscar o ingresar producto/código..." {...identifierField} value={identifierField.value || ''} ref={(e) => { identifierField.ref(e); if(e && identifierInputRefs[index]?.current !== e) { const currentRefs = [...identifierInputRefs]; currentRefs[index] = { current: e }; setIdentifierInputRefs(currentRefs);}}} onChange={(e) => { identifierField.onChange(e); handleIdentifierChange(index, e.target.value);}} onFocus={() => { setCurrentFocusIndex(index); const currentIdVal = form.getValues(`products.${index}.identifier`); const isProdKnown = form.getValues(`products.${index}.isKnownProduct`); if (currentIdVal && !isProdKnown) { handleIdentifierChange(index, currentIdVal); } else if (currentIdVal && isProdKnown) { const knownProduct = getProductDetailsAnywhere(form.getValues(`products.${index}.barcode` || "")); if (knownProduct && currentIdVal.toLowerCase() !== knownProduct.name.toLowerCase() && currentIdVal !== knownProduct.barcode) { handleIdentifierChange(index, currentIdVal); } else { setIsSuggestionsOpenState(false); setSuggestions([]); }} else { setIsSuggestionsOpenState(false); setSuggestions([]);}}} onKeyDown={(e) => handleKeyDown(e, index)} className="pl-10 pr-2 flex-grow rounded-r-none" disabled={!canUserAddStock || !form.watch("pointOfSale")} autoComplete="off"/> </FormControl> <Button type="button" variant="outline" className="h-10 px-3 border-l-0 rounded-l-none" aria-label="Escanear código de barras" disabled={!canUserAddStock || !form.watch("pointOfSale")} onClick={() =>{ identifierInputRefs[index]?.current?.focus();}}> <Barcode className="h-4 w-4" /> </Button> </div> </PopoverTrigger> <PopoverContent key={`popover-supplier-${index}-${suggestions.map(s=>s.id).join('-')}`} id={`item-${index}-suggestions-supplier`} className="w-[--radix-popover-trigger-width] p-0" align="start" sideOffset={5} onOpenAutoFocus={(e) => { e.preventDefault(); identifierInputRefs[index]?.current?.focus(); }} onInteractOutside={(e) => { if (identifierInputRefs[index]?.current && identifierInputRefs[index].current.contains(e.target as Node)) { e.preventDefault(); } else if (!document.activeElement?.closest(`#item-${index}-suggestions-supplier`)) { setIsSuggestionsOpenState(false); }}}> <div className="max-h-60 overflow-y-auto"> {suggestions.map((product, suggIndex) => ( <button key={`${product.id}-${product.pos}-${suggIndex}`} type="button" className={`flex items-center w-full px-4 py-2 text-sm focus:outline-none ${activeSuggestionIndex === suggIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/80'}`} onClick={() => handleSuggestionClick(index, product)} onMouseDown={(e) => e.preventDefault()} role="option" aria-selected={activeSuggestionIndex === suggIndex}> <Image src={product.imageUrl || placeholderSvg} alt={product.name || "Imagen del producto"} width={30} height={30} className="rounded-sm object-cover mr-3 border border-border/30" data-ai-hint={product['data-ai-hint'] || "producto belleza"} onError={(e) => { const target = e.target as HTMLImageElement; if (target.src !== placeholderSvg) { target.src = placeholderSvg; } target.onerror = null; }}/> <div className="flex-grow text-left"> <span className="font-medium">{product.name}</span> <span className="text-xs text-muted-foreground ml-2">({product.brand})</span> </div> <span className="text-xs text-muted-foreground ml-auto mr-2">{product.barcode}</span> <Badge variant="secondary" className="text-xs">{product.pos}</Badge> </button> ))} </div> </PopoverContent> </Popover> <FormMessage /> </FormItem> )}/>
                            <FormField control={form.control} name={`products.${index}.barcode`} render={({ field: barcodeField }) => ( <FormItem> <FormLabel>Código de Barras</FormLabel> <FormControl> <Input placeholder="Ej: 123456789012" {...barcodeField} value={barcodeField.value || ''} id={`products.${index}.barcode`} disabled={!canUserAddStock || (currentItem.isKnownProduct && !!barcodeField.value)} onChange={(e) => { barcodeField.onChange(e); if (currentItem.isKnownProduct) { form.setValue(`products.${index}.isKnownProduct`, false); form.setValue(`products.${index}.productName`, ""); form.setValue(`products.${index}.brandName`, ""); form.setValue(`products.${index}.sellingPrice`, null); form.setValue(`products.${index}.imageUrl`, null); form.setValue(`products.${index}.description`, null); } if(currentItem.identifier === currentItem.productName || !currentItem.identifier){ form.setValue(`products.${index}.identifier`, e.target.value);}}}/> </FormControl> <FormMessage /> </FormItem> )}/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <FormField control={form.control} name={`products.${index}.productName`} render={({ field: productNameField }) => ( <FormItem> <FormLabel>Nombre del Producto</FormLabel> <FormControl> <Input id={`products.${index}.productName`} placeholder="Ej: Champú Hidratante" {...productNameField} value={productNameField.value || ''} disabled={!canUserAddStock || (currentItem.isKnownProduct && !!productNameField.value && !!form.getValues(`products.${index}.barcode`))} onChange={(e) => { productNameField.onChange(e); if (currentItem.isKnownProduct) form.setValue(`products.${index}.isKnownProduct`, false); if(currentItem.identifier === currentItem.barcode || !currentItem.identifier) form.setValue(`products.${index}.identifier`, e.target.value);}}/> </FormControl> <FormMessage /> </FormItem> )}/>
                                   <FormField control={form.control} name={`products.${index}.brandName`} render={({ field: brandNameField }) => ( <FormItem> <FormLabel>Nombre de la Marca</FormLabel> <FormControl> <Input id={`products.${index}.brandName`} placeholder="Ej: L'Oréal" {...brandNameField} value={brandNameField.value || ''} disabled={!canUserAddStock || (currentItem.isKnownProduct && !!brandNameField.value)} onChange={(e) => { brandNameField.onChange(e); if (currentItem.isKnownProduct) form.setValue(`products.${index}.isKnownProduct`, false); }}/> </FormControl> <FormMessage /> </FormItem> )}/>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                  <FormField control={form.control} name={`products.${index}.quantity`} render={({ field : quantityField }) => ( <FormItem> <FormLabel>Cantidad Recibida</FormLabel> <FormControl> <Input type="number" min="1" placeholder="Cant" id={`products.${index}.quantity`} value={quantityField.value === undefined || quantityField.value === null || isNaN(quantityField.value) ? '' : String(quantityField.value)} onChange={e => quantityField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)} onFocus={(e) => e.target.select()}/> </FormControl> <FormMessage /> </FormItem> )}/>
                                  <FormField control={form.control} name={`products.${index}.purchasePrice`} render={({ field : purchasePriceField }) => ( <FormItem> <FormLabel>Precio Compra / Ud.</FormLabel> <FormControl> <div className="relative"> <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input type="number" step="0.001" min="0.001" placeholder="Precio pagado" className="pl-8" value={purchasePriceField.value === undefined || purchasePriceField.value === null || isNaN(purchasePriceField.value) ? '' : String(purchasePriceField.value)} onChange={e => purchasePriceField.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)} onFocus={(e) => e.target.select()}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                                   <FormField control={form.control} name={`products.${index}.sellingPrice`} render={({ field : sellingPriceField }) => ( <FormItem> <FormLabel> Precio Venta / Ud. <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 ml-1 inline-block text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent><p>Opcional. Establecer/actualizar precio para el PDV. Si está en blanco en un producto nuevo, toma el precio de compra.</p></TooltipContent></Tooltip> </FormLabel> <FormControl> <div className="relative"> <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input type="number" step="0.001" min="0" placeholder="Establecer/Act. precio" className="pl-8" value={sellingPriceField.value === undefined || sellingPriceField.value === null || isNaN(sellingPriceField.value) ? '' : String(sellingPriceField.value)} onChange={e => sellingPriceField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)} onFocus={(e) => e.target.select()}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                                   <FormField control={form.control} name={`products.${index}.lowStockThreshold`} render={({ field : lowStockField }) => ( <FormItem> <FormLabel> Umbral Bajo Stock <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 ml-1 inline-block text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent><p>Opcional. Si se deja vacío o 0, se usa el umbral global (ej: 5).</p></TooltipContent></Tooltip> </FormLabel> <FormControl> <div className="relative"> <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input type="number" min="0" placeholder="Global (ej: 5)" className="pl-8" value={lowStockField.value === undefined || lowStockField.value === null || isNaN(lowStockField.value) ? '' : String(lowStockField.value)} onChange={e => lowStockField.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={form.control} name={`products.${index}.wholesaleQuantityThreshold`} render={({ field }) => ( <FormItem> <FormLabel> Cant. Mín. Por Mayor <span className='text-xs text-muted-foreground ml-1'>(Opcional)</span> </FormLabel> <FormControl> <div className="relative"> <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input  type="number"  min="1"  placeholder="Ej: 10"  {...field}  value={field.value === undefined || field.value === null || isNaN(field.value) ? '' : String(field.value)} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} className="pl-8"  disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                                  <FormField control={form.control} name={`products.${index}.wholesalePrice`} render={({ field }) => ( <FormItem> <FormLabel> Precio Por Mayor / Ud. <span className='text-xs text-muted-foreground ml-1'>(Opcional)</span> </FormLabel> <FormControl> <div className="relative"> <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input  type="number"  step="0.001"  min="0"  placeholder="Ej: 15.000"  {...field}  value={field.value === undefined || field.value === null || isNaN(field.value) ? '' : String(field.value)} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="pl-8"  disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct) || !form.watch(`products.${index}.wholesaleQuantityThreshold`)}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={form.control} name={`products.${index}.imageUrl`} render={({ field: imageUrlField }) => ( <FormItem> <FormLabel> URL de Imagen <span className='text-xs text-muted-foreground ml-1'>(Opcional)</span> </FormLabel> <FormControl> <div className="relative"> <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input type="url" placeholder="https://..." {...imageUrlField} value={imageUrlField.value || ''} className="pl-8" disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                                   <FormField control={form.control} name={`products.${index}.aiHint`} render={({ field: aiHintField }) => ( <FormItem> <FormLabel> Pista IA Imagen <span className='text-xs text-muted-foreground ml-1'>(Opcional, 1-2 palabras)</span> </FormLabel> <FormControl> <div className="relative"> <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> <Input placeholder="Ej: tubo labial rojo" {...aiHintField} value={aiHintField.value || ''} className="pl-8" disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)}/> </div> </FormControl> <FormMessage /> </FormItem> )}/>
                             </div>
                             <FormField control={form.control} name={`products.${index}.description`} render={({ field }) => ( <FormItem> <FormLabel> Descripción del Producto <span className='text-xs text-muted-foreground ml-1'>(Opcional)</span> </FormLabel> <FormControl> <Textarea placeholder="Describe la función o uso del producto aquí..." {...field} value={field.value || ''} className="min-h-[60px]" disabled={!canUserAddStock || (!form.watch(`products.${index}.barcode`) && !currentItem.isKnownProduct)}/> </FormControl> <FormMessage /> </FormItem> )}/>
                        </Card>
                        );
                     })}
                     <Button type="button" variant="outline" size="sm" onClick={() => { append({ identifier: "", barcode: "", productName: "", brandName: "", quantity: 1, purchasePrice: 0.001, sellingPrice: null, imageUrl:null, description:null, aiHint:null, isKnownProduct: false, wholesaleQuantityThreshold: null, wholesalePrice: null, lowStockThreshold: null }); setTimeout(() => { const newIndex = fields.length; if(identifierInputRefs[newIndex]?.current) { identifierInputRefs[newIndex].current.focus(); setCurrentFocusIndex(newIndex); }}, 0);}} disabled={!isInventoryLoaded || !canUserAddStock || !form.watch("pointOfSale")}> <PlusCircle className="mr-2 h-4 w-4" /> Añadir Otra Línea de Producto </Button>
                     {form.formState.errors.products?.root?.message && ( <p className="text-sm font-medium text-destructive pt-2">{form.formState.errors.products.root.message}</p> )}
                     {form.formState.errors.products?.message && typeof form.formState.errors.products.message === 'string' && ( <p className="text-sm font-medium text-destructive pt-2">{form.formState.errors.products.message}</p> )}
                    {form.formState.errors.products && !form.formState.errors.products.root && !(typeof form.formState.errors.products.message === 'string') && Object.values(form.formState.errors.products).some(err => err?.message) && ( <p className="text-sm font-medium text-destructive pt-2">Por favor, compruebe los detalles individuales del producto en busca de errores arriba.</p> )}
                   </div>
                  <Button type="submit" size="lg" disabled={!form.formState.isValid || form.formState.isSubmitting || !isInventoryLoaded || !canUserAddStock || form.getValues("products").filter(p => p.barcode && p.productName && p.brandName && p.quantity > 0).length === 0} className="w-full md:w-auto mt-6"> {form.formState.isSubmitting ? "Registrando Stock..." : "Registrar Entrada de Stock"} </Button>
                  {!isInventoryLoaded && <p className="text-sm text-muted-foreground mt-2">Cargando datos de inventario, por favor espera...</p>}
                  {!canUserAddStock && <p className="text-sm text-destructive mt-2">No tienes permiso para añadir stock.</p>}
                </form>
              </Form>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle>Historial de Entradas de Proveedor</CardTitle>
          <CardDescription>Un registro de todas las entradas de stock pasadas de proveedores. (Obtenido de tu backend PHP)</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoadingHistory ? (
             <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <p className="text-center text-muted-foreground">Cargando historial...</p>
             </div>
           ) : isClient && supplierHistory.length > 0 ? (
             <div className="overflow-x-auto">
                 <Table>
                   <TableCaption>Una lista de entradas de stock recientes de proveedores.</TableCaption>
                   <TableHeader> <TableRow> <TableHead className="w-[180px]">Fecha y Hora</TableHead> <TableHead>Proveedor</TableHead> <TableHead>PDV Destino</TableHead> <TableHead className="w-[150px]">Usuario</TableHead> <TableHead>Productos Recibidos y Precios</TableHead> </TableRow> </TableHeader>
                   <TableBody>
                     {supplierHistory.map((entry) => (
                       <TableRow key={entry.id} className="hover:bg-muted/30">
                         <TableCell className="font-medium whitespace-nowrap text-sm"> {format(new Date(entry.dateTime), "d MMM, yyyy h:mm a", { locale: es })} </TableCell>
                         <TableCell className="text-sm">{entry.supplierName}</TableCell>
                         <TableCell className="text-sm">{entry.pointOfSale}</TableCell>
                         <TableCell className="text-sm">{entry.userName || entry.userId || 'N/A'}</TableCell>
                         <TableCell>
                           <ul className="list-none space-y-2 text-sm">
                             {entry.products.map((p, index) => {
                               const sellingPriceChanged = p.newSellingPrice !== undefined && p.newSellingPrice !== null && p.newSellingPrice !== p.oldSellingPrice && p.oldSellingPrice !== undefined;
                               const isNewProductToPOS = p.oldSellingPrice === undefined && p.newSellingPrice !== undefined && p.newSellingPrice !== null;
                               return ( <li key={`${entry.id}-item-${index}-${p.barcode}`} className="border-b border-border/40 pb-2 last:border-b-0"> <span className='font-medium'>{p.productName}</span> ({p.brandName}) - Cant: <span className='font-semibold'>{p.quantity}</span> {p.description && <p className="text-xs text-muted-foreground italic mt-0.5">"{p.description}"</p>} <div className="text-xs text-muted-foreground mt-1 space-y-0.5"> <div> <span>Comp: <span className="text-foreground">${p.purchasePrice.toFixed(3)}</span></span> {sellingPriceChanged && ( <span className="text-orange-600 dark:text-orange-400 ml-3"> PVP: ${p.oldSellingPrice?.toFixed(3)} → <span className='font-bold'>${p.newSellingPrice?.toFixed(3)}</span> </span> )} {!sellingPriceChanged && p.newSellingPrice !== undefined && p.newSellingPrice !== null && ( <span className="ml-3"> PVP: <span className="text-foreground">${p.newSellingPrice?.toFixed(3)}</span> {isNewProductToPOS && <span className="text-green-600 dark:text-green-400 ml-1">(Nuevo en PDV)</span>} </span> )} {!sellingPriceChanged && (p.newSellingPrice === undefined || p.newSellingPrice === null) && p.oldSellingPrice !== undefined && ( <span className="ml-3"> PVP: <span className="text-foreground">${p.oldSellingPrice.toFixed(3)}</span> (Sin cambios) </span> )} </div> {(p.wholesaleQuantityThreshold !== undefined && p.wholesaleQuantityThreshold !== null && p.wholesalePrice !== undefined && p.wholesalePrice !== null) && ( <div> <span className="text-blue-600 dark:text-blue-400"> Por Mayor: {p.wholesaleQuantityThreshold}+ uds. a ${p.wholesalePrice.toFixed(3)} c/u </span> </div> )} {(p.lowStockThreshold !== undefined && p.lowStockThreshold !== null && p.lowStockThreshold > 0) && ( <div> <span className="text-amber-600 dark:text-amber-400"> Alerta Bajo Stock: {p.lowStockThreshold} uds. </span> </div> )} </div> </li> );
                             })}
                           </ul>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
             </div>
           ) : (
              <p className="text-muted-foreground text-center py-6">{isClient ? "Aún no hay entradas de proveedores." : "Cargando historial..."}</p>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

    
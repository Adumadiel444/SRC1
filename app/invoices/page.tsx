
'use client';

import React, { useState, useEffect, type ChangeEvent, useRef, useCallback } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Receipt, FileText, Camera, PlusCircle, Edit, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';

// Esquema Zod para una factura
const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "El número de factura es requerido."),
  supplierName: z.string().min(1, "El nombre del proveedor/marca es requerido."),
  invoiceDate: z.string().min(1, "La fecha de la factura es requerida.").regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha debe ser YYYY-MM-DD"),
  dueDate: z.string().min(1, "La fecha de vencimiento es requerida.").regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha debe ser YYYY-MM-DD"),
  totalAmount: z.coerce.number().positive("El monto total debe ser un número positivo."),
  status: z.enum(["pendiente", "parcialmente_pagada", "pagada"], { required_error: "El estado es requerido." }),
  pdfFileName: z.string().optional().describe("Nombre del archivo PDF de la factura (opcional)"),
  paymentProofDataUrl: z.string().optional().describe("Prueba de pago como Data URI (opcional)"),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceRecord extends InvoiceFormValues {
  id: string;
  registrationDate: Date; 
  lastModifiedDate?: Date; 
}

const INVOICES_LOCAL_STORAGE_KEY = 'invoiceHistoryBeautyApp';
const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT1taWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";


export default function InvoicesPage(): JSX.Element {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    const storedInvoices = localStorage.getItem(INVOICES_LOCAL_STORAGE_KEY);
    if (storedInvoices) {
      try {
        const parsedInvoices = JSON.parse(storedInvoices).map((inv: any) => ({
          ...inv,
          registrationDate: new Date(inv.registrationDate),
          lastModifiedDate: inv.lastModifiedDate ? new Date(inv.lastModifiedDate) : undefined,
        }));
        setInvoices(parsedInvoices);
      } catch (error) {
        console.error("Error al cargar facturas desde localStorage:", error);
        localStorage.removeItem(INVOICES_LOCAL_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(INVOICES_LOCAL_STORAGE_KEY, JSON.stringify(invoices));
    }
  }, [invoices, isClient]);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceNumber: "",
      supplierName: "",
      invoiceDate: "",
      dueDate: "",
      totalAmount: 0,
      status: "pendiente",
      pdfFileName: "",
      paymentProofDataUrl: "",
      notes: "",
    },
    mode: "onChange",
  });

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        form.setValue("paymentProofDataUrl", dataUrl, { shouldValidate: true, shouldDirty: true });
        setPaymentProofPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue("paymentProofDataUrl", "", { shouldValidate: true, shouldDirty: true });
      setPaymentProofPreview(null);
    }
  }, [form, setPaymentProofPreview]);

  const handleEditInvoice = useCallback((invoiceId: string) => {
    const invoiceToEdit = invoices.find(inv => inv.id === invoiceId);
    if (invoiceToEdit) {
      setEditingInvoiceId(invoiceId);
      form.reset({
        ...invoiceToEdit,
        totalAmount: Number(invoiceToEdit.totalAmount)
      });
      setPaymentProofPreview(invoiceToEdit.paymentProofDataUrl || null);
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [invoices, setEditingInvoiceId, form, setPaymentProofPreview, formRef]);
  
  const handleCancelEdit = useCallback(() => {
    setEditingInvoiceId(null);
    form.reset({ 
      invoiceNumber: "",
      supplierName: "",
      invoiceDate: "",
      dueDate: "",
      totalAmount: 0,
      status: "pendiente",
      pdfFileName: "",
      paymentProofDataUrl: "",
      notes: "",
    });
    setPaymentProofPreview(null);
  }, [setEditingInvoiceId, form, setPaymentProofPreview]);

  const onSubmit = (data: InvoiceFormValues) => {
    const now = new Date();
    if (editingInvoiceId) {
      const originalInvoice = invoices.find(inv => inv.id === editingInvoiceId);
      if (!originalInvoice) return;

      let changedFields: string[] = [];
      if (data.invoiceNumber !== originalInvoice.invoiceNumber) changedFields.push("Nº Factura");
      if (data.supplierName !== originalInvoice.supplierName) changedFields.push("Proveedor");
      if (data.invoiceDate !== originalInvoice.invoiceDate) changedFields.push("Fecha Fact.");
      if (data.dueDate !== originalInvoice.dueDate) changedFields.push("Fecha Venc.");
      if (data.totalAmount !== originalInvoice.totalAmount) changedFields.push("Monto");
      if (data.status !== originalInvoice.status) changedFields.push("Estado");
      if ((data.pdfFileName || "") !== (originalInvoice.pdfFileName || "")) changedFields.push("PDF Factura");
      if ((data.paymentProofDataUrl || "") !== (originalInvoice.paymentProofDataUrl || "")) changedFields.push("Prueba de Pago");
      
      let editNote = "";
      if (changedFields.length > 0) {
        const formattedDate = format(now, "dd/MM/yyyy HH:mm", { locale: es });
        editNote = `--- Editado (${formattedDate}): ${changedFields.join(', ')} actualizado(s). ---\n`;
      }
      
      const updatedNotes = editNote + (data.notes || ""); 

      setInvoices(prev => 
        prev.map(inv => 
          inv.id === editingInvoiceId 
            ? { ...inv, ...data, notes: updatedNotes, lastModifiedDate: now }
            : inv
        ).sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      );
      toast({
        title: "Factura Actualizada",
        description: `Factura N° ${data.invoiceNumber} de ${data.supplierName} actualizada con éxito.`,
      });
    } else {
      const newInvoice: InvoiceRecord = {
        id: `invoice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        registrationDate: now,
        ...data,
      };
      setInvoices(prev => [newInvoice, ...prev].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()));
      toast({
        title: "Factura Registrada",
        description: `Factura N° ${data.invoiceNumber} de ${data.supplierName} registrada con éxito.`,
      });
    }
    handleCancelEdit(); 
  };
  
  const getStatusBadgeVariant = (status: InvoiceRecord['status']) => {
    switch (status) {
      case 'pagada':
        return 'bg-green-500 hover:bg-green-600';
      case 'parcialmente_pagada':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'pendiente':
      default:
        return 'bg-red-500 hover:bg-red-600';
    }
  };

  if (!isClient) {
    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Facturas</h1>
            <p>Cargando facturas...</p>
        </div>
    );
  }
  
  const currentEditingInvoiceNumber = editingInvoiceId ? invoices.find(inv => inv.id === editingInvoiceId)?.invoiceNumber : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Facturas</h1>
        <Receipt className="h-8 w-8 text-primary" />
      </div>
      <p className="text-muted-foreground">
        Registra, visualiza y actualiza las facturas de tus proveedores. Adjunta el PDF de la factura (nombre) y la prueba de pago (imagen).
      </p>

      <div ref={formRef}>
        <Card className="shadow-md border border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center">
              {editingInvoiceId ? <Edit className="mr-2 h-6 w-6 text-primary" /> : <PlusCircle className="mr-2 h-6 w-6 text-primary" />}
              {editingInvoiceId ? `Editar Factura ${currentEditingInvoiceNumber ? `(N° ${currentEditingInvoiceNumber})` : ''}` : 'Registrar Nueva Factura'}
            </CardTitle>
            <CardDescription>
              {editingInvoiceId ? 'Modifica los detalles de la factura seleccionada. Los cambios se registrarán en las notas.' : 'Completa los detalles de la factura recibida.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Factura</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: F001-12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor / Marca</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del proveedor o marca" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="invoiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Factura</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="YYYY-MM-DD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Vencimiento</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="YYYY-MM-DD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto Total</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0.000" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="parcialmente_pagada">Pagada Parcialmente</SelectItem>
                            <SelectItem value="pagada">Pagada</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="pdfFileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                          <FileText className="mr-2 h-4 w-4 text-muted-foreground" /> Nombre Archivo PDF Factura 
                          <span className="text-xs text-muted-foreground ml-1">(Opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: factura_proveedor_abril.pdf" {...field} value={field.value || ''}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel className="flex items-center">
                      <Camera className="mr-2 h-4 w-4 text-muted-foreground" /> Prueba de Pago (Imagen)
                      <span className="text-xs text-muted-foreground ml-1">(Opcional)</span>
                  </FormLabel>
                  <FormControl>
                      <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange} 
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                  </FormControl>
                  {paymentProofPreview && (
                    <div className="mt-2">
                      <Image src={paymentProofPreview} alt="Vista previa de prueba de pago" width={100} height={100} className="rounded-md object-cover border" data-ai-hint="comprobante pago"/>
                    </div>
                  )}
                  <FormMessage>{form.formState.errors.paymentProofDataUrl?.message}</FormMessage>
                </FormItem>


                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas Adicionales / Modificaciones</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Abono realizado, detalles de pago, historial de cambios..." {...field} value={field.value || ''} rows={editingInvoiceId ? 6 : 3}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center gap-x-3">
                  <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting 
                      ? (editingInvoiceId ? "Actualizando..." : "Registrando...") 
                      : (editingInvoiceId ? "Actualizar Factura" : "Registrar Factura")
                    }
                  </Button>
                  {editingInvoiceId && (
                    <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full md:w-auto">
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar Edición
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border border-border/60">
        <CardHeader>
          <CardTitle>Historial de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>Lista de facturas registradas. Las modificaciones se muestran en 'Notas'.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Factura</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha Fact.</TableHead>
                    <TableHead>Fecha Venc.</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead>Prueba Pago</TableHead>
                    <TableHead>Notas / Modificaciones</TableHead>
                    <TableHead>Registrada</TableHead>
                    <TableHead>Últ. Modif.</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.supplierName}</TableCell>
                      <TableCell>{invoice.invoiceDate}</TableCell>
                      <TableCell>{invoice.dueDate}</TableCell>
                      <TableCell className="text-right">${invoice.totalAmount.toFixed(3)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getStatusBadgeVariant(invoice.status)}`}>
                          {invoice.status === "pendiente" ? "Pendiente" : invoice.status === "parcialmente_pagada" ? "Parcial" : "Pagada"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {invoice.pdfFileName || <span className="italic">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {invoice.paymentProofDataUrl ? (
                          <Image src={invoice.paymentProofDataUrl} alt="Prueba de pago" width={60} height={60} className="rounded-md object-cover border" data-ai-hint="comprobante pago" 
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src !== placeholderSvg) { target.src = placeholderSvg; }
                                target.onerror = null;
                            }}
                          />
                        ) : (<span className="italic text-xs text-muted-foreground">N/A</span>)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs whitespace-pre-wrap">
                        {invoice.notes || <span className="italic">N/A</span>}
                      </TableCell>
                       <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(invoice.registrationDate), "dd MMM yy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {invoice.lastModifiedDate ? format(new Date(invoice.lastModifiedDate), "dd MMM yy, HH:mm", { locale: es }) : <span className="italic">N/A</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleEditInvoice(invoice.id)}>
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">No hay facturas registradas todavía.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

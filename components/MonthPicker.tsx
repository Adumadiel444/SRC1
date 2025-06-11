
"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale" // Importar locale español
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MonthPickerProps {
  onMonthChange: (dateRange: DateRange | undefined) => void; // Devolución de llamada cuando cambia el mes
  initialDate?: Date; // Fecha inicial opcional para establecer el mes
  className?: string; // Clases CSS opcionales para el contenedor
}

export function MonthPicker({ onMonthChange, initialDate, className }: MonthPickerProps) {
  // Estado para la fecha que representa el mes seleccionado.
  const [selectedMonthDate, setSelectedMonthDate] = React.useState<Date | undefined>(
    initialDate ? startOfMonth(initialDate) : startOfMonth(new Date())
  );
  // Estado para controlar la visibilidad del popover.
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  // Efecto para llamar a onMonthChange cuando selectedMonthDate cambia.
  React.useEffect(() => {
    if (selectedMonthDate) {
      const firstDay = startOfMonth(selectedMonthDate);
      const lastDay = endOfMonth(selectedMonthDate);
      onMonthChange({ from: firstDay, to: lastDay });
    } else {
      onMonthChange(undefined);
    }
  }, [selectedMonthDate, onMonthChange]);

  // Manejador para cuando se selecciona un día en el calendario.
  const handleDaySelect = (day: Date | undefined) => {
    if (day) {
      setSelectedMonthDate(startOfMonth(day)); // Actualizar basado en el mes del día seleccionado
      setPopoverOpen(false); // Cerrar popover después de la selección
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            id="month-picker"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[280px] justify-start text-left font-normal",
              !selectedMonthDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedMonthDate ? (
              format(selectedMonthDate, "MMMM yyyy", { locale: es }) // Usar locale español para el formato
            ) : (
              <span>Seleccionar mes</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single" // Seleccionar un solo día para determinar el mes
            selected={selectedMonthDate}
            onSelect={handleDaySelect}
            initialFocus
            defaultMonth={selectedMonthDate || new Date()}
            captionLayout="dropdown-buttons" // Habilitar selectores de mes/año en el caption
            fromYear={2020} // Año mínimo para el selector
            toYear={new Date().getFullYear() + 5} // Año máximo para el selector
            locale={es} // Usar locale español en el calendario
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

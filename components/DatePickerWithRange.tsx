
"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, format } from "date-fns"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Props para el componente DatePickerWithRange.
 * @interface DatePickerWithRangeProps
 * @extends React.HTMLAttributes<HTMLDivElement>
 */
interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Función de devolución de llamada que se invoca cuando cambia el rango de fechas seleccionado.
   * @param {DateRange | undefined} dateRange - El nuevo rango de fechas.
   */
  onDateChange?: (dateRange: DateRange | undefined) => void;
}

/**
 * Un componente selector de fechas que permite seleccionar un rango de fechas.
 * Utiliza componentes de ShadCN UI (Popover, Button, Calendar).
 *
 * @param {DatePickerWithRangeProps} props - Las props para el componente.
 * @param {string} [props.className] - Nombre de clase CSS opcional para el div contenedor.
 * @param {(dateRange: DateRange | undefined) => void} [props.onDateChange] - Devolución de llamada para cuando cambia el rango de fechas.
 * @returns {JSX.Element} El componente selector de rango de fechas.
 */
export function DatePickerWithRange({ className, onDateChange }: DatePickerWithRangeProps): JSX.Element {
  // Estado para mantener el rango de fechas seleccionado. Por defecto, los últimos 7 días.
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  })

  // Efecto para llamar a la devolución de llamada onDateChange cuando cambia el estado de la fecha.
  React.useEffect(() => {
    if (onDateChange) {
      onDateChange(date);
    }
  }, [date, onDateChange]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground" // Estilo diferente si no se selecciona ninguna fecha
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                // Formato para un rango de fechas seleccionado
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                // Formato si solo se selecciona la fecha 'desde'
                format(date.from, "LLL dd, y")
              )
            ) : (
              // Texto de marcador de posición si no se selecciona ninguna fecha
              <span>Seleccionar rango de fechas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus // Enfocar el calendario cuando se abre
            mode="range" // Habilitar modo de selección de rango
            defaultMonth={date?.from} // Establecer el mes inicial basado en la fecha 'desde' seleccionada
            selected={date} // El rango de fechas actualmente seleccionado
            onSelect={setDate} // Actualizar el estado de la fecha cuando se selecciona un nuevo rango
            numberOfMonths={2} // Mostrar dos meses para facilitar la selección de rango
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

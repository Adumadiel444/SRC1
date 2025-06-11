
"use client"

// Inspirado en la biblioteca react-hot-toast
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1 // Número máximo de toasts visibles a la vez
const TOAST_REMOVE_DELAY = 1000000 // Un retraso muy largo, efectivamente significa que los toasts se eliminan manualmente o cuando se alcanza el límite

/**
 * Representa un objeto toast con sus propiedades y estado.
 * @typedef {ToastProps & { id: string, title?: React.ReactNode, description?: React.ReactNode, action?: ToastActionElement }} ToasterToast
 */
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// Tipos de acción para el reductor de toasts.
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0 // Contador para generar IDs de toast únicos.

/**
 * Genera un ID único para un toast.
 * @returns {string} Un ID de cadena único.
 */
function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

/**
 * Representa una acción que se puede despachar al reductor de toasts.
 * @typedef {object} Action
 * @property {ActionType[keyof ActionType]} type - El tipo de la acción.
 * @property {ToasterToast} [toast] - Los datos del toast (para ADD_TOAST, UPDATE_TOAST).
 * @property {string} [toastId] - El ID del toast (para DISMISS_TOAST, REMOVE_TOAST).
 */
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

/**
 * Representa el estado del sistema de toasts.
 * @interface State
 */
interface State {
  toasts: ToasterToast[]
}

// Mapa para almacenar tiempos de espera para eliminar toasts.
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Añade un ID de toast a una cola para su eliminación después de un retraso.
 * Esto es parte del mecanismo para limpiar automáticamente los toasts.
 * @param {string} toastId - El ID del toast a eliminar.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return // Ya está en cola
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * Función reductora para gestionar el estado de los toasts.
 * Maneja la adición, actualización, descarte y eliminación de toasts.
 * @param {State} state - El estado actual.
 * @param {Action} action - La acción a realizar.
 * @returns {State} El nuevo estado.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // Añadir nuevo toast al principio y cortar para mantener el límite
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      // Actualizar un toast existente por su ID
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action
      // Añadir a la cola de eliminación (efectivamente marca para eliminación futura)
      if (toastId) {
        addToRemoveQueue(toastId)
      } else { // Descartar todos los toasts
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }
      // Establecer 'open' a false para el/los toast(s) descartado(s)
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      // Eliminar un toast específico o todos los toasts si no se proporciona ID
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Array de funciones listener que se llamarán cuando cambie el estado.
const listeners: Array<(state: State) => void> = []

// Estado en memoria para el sistema de toasts.
let memoryState: State = { toasts: [] }

/**
 * Despacha una acción al reductor de toasts y notifica a los listeners.
 * @param {Action} action - La acción a despachar.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

/**
 * Tipo para las propiedades de un nuevo toast, excluyendo el 'id'.
 * @typedef {Omit<ToasterToast, "id">} Toast
 */
type Toast = Omit<ToasterToast, "id">

/**
 * Función para crear y mostrar un nuevo toast.
 * @param {Toast} props - Las propiedades del toast a mostrar.
 * @returns {{ id: string, dismiss: () => void, update: (props: ToasterToast) => void }}
 *          Un objeto con el ID del toast y funciones para descartarlo o actualizarlo.
 */
function toast({ ...props }: Toast) {
  const id = genId() // Generar un ID único para el nuevo toast

  /**
   * Actualiza un toast existente.
   * @param {ToasterToast} props - Las nuevas propiedades para el toast.
   */
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })

  /**
   * Descarta el toast actual.
   */
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // Despachar acción para añadir el nuevo toast
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true, // Los toasts están inicialmente abiertos
      onOpenChange: (open) => { // Manejar cierre manual desde la UI
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * El hook personalizado `useToast` proporciona acceso al estado y funciones del sistema de toasts.
 * Permite a los componentes mostrar toasts y gestionar su ciclo de vida.
 *
 * @returns {{ toasts: ToasterToast[], toast: (props: Toast) => { id: string, dismiss: () => void, update: (props: ToasterToast) => void }, dismiss: (toastId?: string) => void }}
 *          Un objeto que contiene los toasts actuales, una función para crear nuevos toasts y una función para descartar toasts.
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  // Suscribirse a los cambios de estado al montar y desuscribirse al desmontar.
  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }

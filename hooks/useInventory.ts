
'use client';

import { useState, useEffect, useCallback } from 'react';

// --- Definición de Tipos ---

/**
 * Representa un producto en el inventario.
 * @interface Product
 */
export interface Product {
  /** Identificador único para el producto en todo el sistema de inventario. */
  id: string;
  /** Nombre del producto. */
  name: string;
  /** Cantidad actual del producto en stock. */
  quantity: number;
  /** Código de barras del producto. */
  barcode: string;
  /** URL de la imagen del producto. */
  imageUrl: string;
  /** Precio de venta del producto. */
  price: number;
  /** Nombre de la marca asociada al producto. */
  brand: string;
  /** Descripción opcional de la función o uso del producto. */
  description?: string;
  /** Pista opcional para la generación de imágenes por IA, típicamente 1-2 palabras clave. */
  'data-ai-hint'?: string;
  /** Cantidad mínima opcional para precios mayoristas. */
  wholesaleQuantityThreshold?: number;
  /** Precio mayorista opcional por unidad. */
  wholesalePrice?: number;
  /** Umbral de bajo stock personalizado para este producto. Si es null o <= 0, se usa el global. */
  lowStockThreshold?: number | null;
}

/**
 * Representa los datos del inventario para un único Punto de Venta (PDV),
 * donde los productos se agrupan por el nombre de su marca.
 * @interface InventoryData
 * @property {Product[]} [brandName] - Un array de productos que pertenecen a la marca.
 */
export interface InventoryData {
  [brandName: string]: Product[];
}

/**
 * Representa todo el inventario en todos los Puntos de Venta (PDV).
 * @interface Inventory
 * @property {InventoryData} [pointOfSale] - Datos de inventario para un PDV específico.
 */
export interface Inventory {
  [pointOfSale: string]: InventoryData;
}

// El endpoint PHP para obtener el inventario. Deberás crear este script.
const INVENTORY_API_ENDPOINT = '/api/php/get_inventory.php';


// --- Implementación del Hook Personalizado: useInventory ---

/**
 * El hook personalizado `useInventory` gestiona el estado del inventario de la aplicación.
 * Carga el inventario desde un backend PHP y proporciona funciones para acceder a los datos.
 * Las modificaciones directas al inventario (cantidad, precio, adición de productos)
 * ahora son manejadas por los scripts PHP del backend (ej: al registrar una venta o entrada de proveedor).
 */
export function useInventory() {
  const [inventory, setInventory] = useState<Inventory>({});
  const [isInventoryLoaded, setIsInventoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Efecto para cargar el inventario inicial desde el backend PHP cuando el componente se monta.
  useEffect(() => {
    const fetchInitialInventory = async () => {
      setIsInventoryLoaded(false);
      setError(null);
      try {
        const response = await fetch(INVENTORY_API_ENDPOINT);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Error del servidor: ${response.status}` }));
          throw new Error(errorData.message || `Error al cargar el inventario: ${response.statusText}`);
        }
        const data: Inventory = await response.json();
        setInventory(data);
      } catch (err: any) {
        console.error("Error al cargar el inventario desde el backend:", err);
        setError(err.message || "No se pudo cargar el inventario.");
        setInventory({}); // Dejar el inventario vacío en caso de error
      } finally {
        setIsInventoryLoaded(true);
      }
    };

    fetchInitialInventory();
  }, []); // El array de dependencias vacío asegura que este efecto se ejecute solo una vez al montar.


  /**
   * Obtiene una lista ordenada de todos los nombres de Puntos de Venta (PDV) del inventario.
   * @returns {string[]} Un array de nombres de PDV, ordenados alfabéticamente.
   */
  const getPointsOfSale = useCallback((): string[] => {
     return Object.keys(inventory).sort();
  }, [inventory]);

    /**
     * Recupera detalles de un producto por su identificador (nombre o código de barras) desde un Punto de Venta específico.
     * @param {string} pos - El Punto de Venta donde buscar.
     * @param {string} identifier - El nombre o código de barras del producto.
     * @returns {Product | null} Los detalles del producto, o null si no se encuentra en el PDV especificado.
     */
    const getProductDetailsInPos = useCallback((pos: string, identifier: string): Product | null => {
        if (!inventory[pos]) {
            return null;
        }
        const lowerIdentifier = identifier.toLowerCase();
        for (const brand in inventory[pos]) {
            const products = Array.isArray(inventory[pos][brand]) ? inventory[pos][brand] : [];
            const product = products.find(p =>
                p.barcode === identifier ||
                p.name.toLowerCase() === lowerIdentifier
            );
            if (product) {
                return { ...product };
            }
        }
        return null;
    }, [inventory]);

    /**
     * Recupera detalles de un producto por su identificador (nombre o código de barras) desde cualquier Punto de Venta.
     * @param {string} identifier - El nombre o código de barras del producto.
     * @returns {(Product & { pos: string }) | null} Los detalles del producto incluyendo su PDV, o null si no se encuentra.
     */
    const getProductDetails = useCallback((identifier: string): (Product & { pos: string }) | null => {
        for (const pos in inventory) {
            const details = getProductDetailsInPos(pos, identifier);
            if (details) {
                return { ...details, pos };
            }
        }
        return null;
    }, [inventory, getProductDetailsInPos]);

  // Funciones como updateProductQuantity, addProduct, updateProductPrice
  // se eliminan de este hook, ya que la lógica de modificación del inventario
  // ahora reside en el backend PHP y se activa a través de otros flujos
  // (ej: registrar una venta, registrar una entrada de proveedor).
  // Si se necesita una actualización optimista o una recarga explícita del inventario
  // después de tales operaciones, se podría añadir una función `refetchInventory` aquí.

  return {
      inventory,
      isInventoryLoaded,
      error, // Exponer el estado de error
      getPointsOfSale,
      getProductDetails,
      getProductDetailsInPos,
    };
}

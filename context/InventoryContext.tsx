
'use client';

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useInventory } from '@/hooks/useInventory';
import type { Inventory, Product, InventoryData } from '@/hooks/useInventory'; // Asegurar que Product incluya campos de descripción y venta al por mayor
import { useAuth } from './AuthContext';

/**
 * Define la forma del contexto de inventario.
 * @interface InventoryContextType
 */
interface InventoryContextType {
    /** Los datos completos del inventario, potencialmente filtrables por permisos de usuario. */
    inventory: Inventory;
    /** Booleano que indica si los datos del inventario se han cargado. */
    isInventoryLoaded: boolean;
    /**
     * Obtiene un array de nombres de Puntos de Venta (PDV) accesibles por el usuario actual.
     * @returns {string[]} Array de nombres de PDV accesibles.
     */
    getPointsOfSaleForUser: () => string[];
    /**
     * Obtiene un array de todos los nombres de Puntos de Venta (PDV) en el sistema, independientemente del usuario.
     * @returns {string[]} Array de todos los nombres de PDV.
     */
    getAllPointsOfSale: () => string[];
    /**
     * Actualiza la cantidad de un producto en un PDV específico.
     * @param {string} pos - El nombre del Punto de Venta.
     * @param {string} barcode - El código de barras del producto a actualizar.
     * @param {number} change - La cantidad en la que cambiar la cantidad (puede ser positiva o negativa).
     * @returns {boolean} Verdadero si la actualización se inició con éxito, falso en caso contrario (p. ej., producto no encontrado).
     */
    updateProductQuantity: (pos: string, barcode: string, change: number) => boolean;
    /**
     * Añade un nuevo producto a un PDV específico. Si el producto (por código de barras) ya existe, se actualiza su cantidad.
     * @param {string} pos - El nombre del Punto de Venta.
     * @param {Omit<Product, 'id'>} newProduct - Los datos del producto (el ID se generará internamente). Esto incluye campos de descripción y venta al por mayor.
     */
    addProduct: (pos: string, newProduct: Omit<Product, 'id'>) => void;
    /**
     * Actualiza el precio de venta de un producto en un PDV específico.
     * @param {string} pos - El nombre del Punto de Venta.
     * @param {string} barcode - El código de barras del producto a actualizar.
     * @param {number} newPrice - El nuevo precio de venta.
     * @returns {boolean} Verdadero si la actualización se inició con éxito, falso en caso contrario.
     */
    updateProductPrice: (pos: string, barcode: string, newPrice: number) => boolean;
    /**
     * Obtiene detalles de un producto (por nombre o código de barras) solo de los PDV accesibles para el usuario actual.
     * @param {string} identifier - El nombre o código de barras del producto.
     * @returns {(Product & { pos: string; brand: string }) | null} Los detalles del producto incluyendo PDV y marca, o null si no se encuentra o no es accesible.
     */
    getProductDetailsForUser: (identifier: string) => (Product & { pos: string; brand: string }) | null;
    /**
     * Obtiene detalles de un producto (por nombre o código de barras) de cualquier PDV en el sistema.
     * Útil para fines administrativos.
     * @param {string} identifier - El nombre o código de barras del producto.
     * @returns {(Product & { pos: string; brand: string }) | null} Los detalles del producto incluyendo PDV y marca, o null si no se encuentra.
     */
    getProductDetailsAnywhere: (identifier: string) => (Product & { pos: string; brand: string }) | null;
    /**
     * Obtiene detalles de un producto (por nombre o código de barras) dentro de un Punto de Venta específico.
     * @param {string} pos - El nombre del Punto de Venta.
     * @param {string} identifier - El nombre o código de barras del producto.
     * @returns {Product | null} Los detalles del producto, o null si no se encuentra en el PDV especificado.
     */
    getProductDetailsInPos: (pos: string, identifier: string) => Product | null;
}

// Crear el contexto de inventario.
const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

/**
 * El componente InventoryProvider gestiona el estado del inventario (datos, estado de carga)
 * y lo proporciona a sus hijos a través de InventoryContext.
 * Se integra con AuthContext para filtrar datos según los permisos del usuario.
 *
 * @param {object} props - Las props del componente.
 * @param {ReactNode} props.children - Los componentes hijos que tendrán acceso al contexto de inventario.
 * @returns {JSX.Element} El componente InventoryProvider.
 */
export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const inventoryHookData = useInventory(); // Hook personalizado para gestionar datos brutos de inventario
  const { currentUser } = useAuth(); // Obtener usuario actual de AuthContext para comprobaciones de permisos

  /**
   * Recupera una lista de nombres de Puntos de Venta (PDV) que son accesibles para el usuario actualmente conectado.
   * Si el usuario tiene '*' en sus allowedPOS, se devuelven todos los PDV.
   * @returns {string[]} Un array de nombres de PDV accesibles.
   */
  const getPointsOfSaleForUser = useCallback((): string[] => {
    const allPos = inventoryHookData.getPointsOfSale();
    if (!currentUser || !currentUser.allowedPOS || currentUser.allowedPOS.length === 0) {
        return []; // Sin usuario o sin PDV permitidos significa sin acceso
    }
    if (currentUser.allowedPOS.includes('*')) {
        return allPos; // '*' significa acceso a todos los PDV
    }
    // Filtrar la lista de todos los PDV por los PDV permitidos del usuario
    return allPos.filter(pos => currentUser.allowedPOS.includes(pos));
  }, [inventoryHookData.getPointsOfSale, currentUser]);

  /**
   * Recupera detalles del producto (por nombre o código de barras) solo de Puntos de Venta (PDV)
   * a los que el usuario actual tiene permitido acceder.
   * @param {string} identifier - El nombre o código de barras del producto.
   * @returns {(Product & { pos: string; brand: string }) | null} Detalles del producto si se encuentra y es accesible, de lo contrario null.
   */
  const getProductDetailsForUser = useCallback((identifier: string): (Product & { pos: string; brand: string }) | null => {
      if (!currentUser || !currentUser.allowedPOS || currentUser.allowedPOS.length === 0) {
          return null; // Sin acceso, sin detalles
      }
      // Determinar la lista de PDV donde buscar según los permisos del usuario
      const accessiblePOS = currentUser.allowedPOS.includes('*')
          ? inventoryHookData.getPointsOfSale()
          : currentUser.allowedPOS;

      for (const pos of accessiblePOS) {
          const details = inventoryHookData.getProductDetailsInPos(pos, identifier);
          if (details) {
              return { ...details, pos: pos, brand: details.brand }; // Incluir PDV y marca en el objeto devuelto
          }
      }
      return null; // No encontrado en PDV accesibles
  }, [currentUser, inventoryHookData.getPointsOfSale, inventoryHookData.getProductDetailsInPos]);


  // Exponer el getProductDetails original del hook como getProductDetailsAnywhere.
  const getProductDetailsAnywhere = inventoryHookData.getProductDetails;
  // Exponer getProductDetailsInPos directamente del hook.
  const getProductDetailsInPos = inventoryHookData.getProductDetailsInPos;

  // Exponer todos los nombres de PDV, sin filtrar (útil para vistas de administrador o escenarios específicos).
  const getAllPointsOfSale = inventoryHookData.getPointsOfSale;


  // Memoizar el valor del contexto para prevenir re-renderizaciones innecesarias de los componentes consumidores.
  const contextValue = useMemo(() => ({
    inventory: inventoryHookData.inventory,
    isInventoryLoaded: inventoryHookData.isInventoryLoaded,
    getPointsOfSaleForUser,
    getAllPointsOfSale,
    updateProductQuantity: inventoryHookData.updateProductQuantity,
    addProduct: inventoryHookData.addProduct,
    updateProductPrice: inventoryHookData.updateProductPrice,
    getProductDetailsForUser,
    getProductDetailsAnywhere,
    getProductDetailsInPos,
  }), [
      inventoryHookData.inventory,
      inventoryHookData.isInventoryLoaded,
      getPointsOfSaleForUser,
      getAllPointsOfSale,
      inventoryHookData.updateProductQuantity,
      inventoryHookData.addProduct,
      inventoryHookData.updateProductPrice,
      getProductDetailsForUser,
      getProductDetailsAnywhere,
      getProductDetailsInPos,
  ]);


  return (
    <InventoryContext.Provider value={contextValue}>
      {children}
    </InventoryContext.Provider>
  );
};

/**
 * Hook personalizado para acceder fácilmente al contexto de inventario.
 * Lanza un error si se usa fuera de un InventoryProvider.
 *
 * @returns {InventoryContextType} El contexto de inventario.
 * @throws {Error} Si se usa fuera de un InventoryProvider.
 */
export const useInventoryContext = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventoryContext debe usarse dentro de un InventoryProvider');
  }
  return context;
};

// Reexportar tipos del hook useInventory para un acceso más fácil.
export type { Inventory, Product, InventoryData } from '@/hooks/useInventory';

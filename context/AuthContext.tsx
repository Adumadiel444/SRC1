
'use client';

import { useRouter } from 'next/navigation'; // Importar useRouter
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';

/**
 * Interfaz que representa un usuario en la aplicación.
 * @interface User
 */
export interface User {
  /** El identificador único para el usuario. */
  id: string;
  /** El nombre del usuario. */
  name: string;
  /** El nombre de usuario para iniciar sesión. */
  username: string;
  /** La contraseña para iniciar sesión (texto plano para el prototipo). */
  password?: string; // Opcional para 'Ningún Usuario Seleccionado'
  /** Un array de identificadores de Puntos de Venta (PDV) a los que el usuario tiene permitido acceder. Un '*' indica acceso a todos los PDV. */
  allowedPOS: string[];
}

/**
 * Datos de usuario simulados para fines de demostración.
 * Simula diferentes usuarios con distintos niveles de acceso.
 */
const mockUsers: User[] = [
  { id: 'user-0', name: 'Ningún Usuario Seleccionado', username: '', password: '', allowedPOS: [] },
  { id: 'admin-user', name: 'Administrador', username: 'admin', password: 'adminpassword', allowedPOS: ['*'] },
  { id: 'mainstore-user', name: 'Usuario Tienda Principal', username: 'tienda', password: 'tiendapassword', allowedPOS: ['Main Store'] },
  { id: 'warehouse-user', name: 'Usuario Almacén', username: 'almacen', password: 'almacenpassword', allowedPOS: ['Warehouse'] },
];

/**
 * Define la forma del contexto de autenticación.
 * @interface AuthContextType
 */
interface AuthContextType {
  /** El usuario actualmente autenticado, o null si no hay ningún usuario seleccionado/iniciado sesión. */
  currentUser: User | null;
  /** Un array de todos los usuarios simulados disponibles (se puede usar para fines administrativos, no para cambiar). */
  availableUsers: User[];
  /**
   * Inicia sesión de un usuario mediante su nombre de usuario y contraseña.
   * @param {string} username - El nombre de usuario.
   * @param {string} password - La contraseña.
   * @returns {boolean} Verdadero si el inicio de sesión es exitoso, falso en caso contrario.
   */
  login: (username: string, password: string) => boolean;
  /** Cierra la sesión del usuario actual, estableciéndolo en el estado 'Ningún Usuario Seleccionado'. */
  logout: () => void;
  /** Booleano que indica si el estado de autenticación se está cargando actualmente. */
  isLoading: boolean;
}

// Crear el contexto de autenticación.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * El componente AuthProvider gestiona el estado de autenticación (usuario actual, estado de carga)
 * y lo proporciona a sus hijos a través de AuthContext.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

   /**
    * Simula la carga del estado inicial del usuario.
    * Por defecto, es 'Ningún Usuario Seleccionado'.
    */
   useEffect(() => {
     setIsLoading(true);
     const timer = setTimeout(() => {
         const initialUser = mockUsers.find(u => u.id === 'user-0');
         setCurrentUser(initialUser || null);
         setIsLoading(false);
     }, 50);

     return () => clearTimeout(timer);
   }, []);


  /**
   * Inicia sesión de un usuario haciendo coincidir el nombre de usuario y la contraseña.
   * @param {string} username - El nombre de usuario.
   * @param {string} password - La contraseña.
   * @returns {boolean} Verdadero si el inicio de sesión es exitoso, falso en caso contrario.
   */
  const login = useCallback((username: string, password: string): boolean => {
    const userToLogin = mockUsers.find(user => user.username === username && user.password === password);
    if (userToLogin) {
        setIsLoading(true);
        setTimeout(() => {
            setCurrentUser(userToLogin);
            setIsLoading(false);
        }, 50);
        return true;
    } else {
        // Asegurar que "Ningún Usuario Seleccionado" se establezca si el inicio de sesión falla
        const noUser = mockUsers.find(u => u.id === 'user-0');
        setCurrentUser(noUser || null);
        return false;
    }
  }, [setCurrentUser, setIsLoading]);

  /**
   * Cierra la sesión del usuario actual.
   */
  const logout = useCallback(() => {
      setIsLoading(true);
      setTimeout(() => {
          const noUser = mockUsers.find(u => u.id === 'user-0');
          setCurrentUser(noUser || null);
          setIsLoading(false);
          router.push('/login'); // Redirigir a la página de inicio de sesión al cerrar sesión
      }, 50);
  }, [setCurrentUser, setIsLoading, router]);

  const value = useMemo(() => ({
    currentUser,
    availableUsers: mockUsers,
    login,
    logout,
    isLoading,
  }), [currentUser, isLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook personalizado para acceder fácilmente al contexto de autenticación.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

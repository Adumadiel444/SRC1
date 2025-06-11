
'use client';

import React from 'react';
import { useAuth, User } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { User as UserIcon } from 'lucide-react';

/**
 * El componente UserSwitcher permite al usuario cambiar entre diferentes cuentas de usuario simuladas.
 * Muestra un menú desplegable (componente Select) con los usuarios disponibles.
 * Cuando se selecciona un usuario, se llama a la función `login` de `AuthContext`.
 * Muestra un cargador esqueleto mientras se cargan los datos del usuario.
 *
 * @returns {JSX.Element} La interfaz de usuario del cambiador de usuario.
 */
export default function UserSwitcher(): JSX.Element {
  const { currentUser, availableUsers, login, isLoading } = useAuth();

  /**
   * Maneja el evento de cambio del menú desplegable de selección de usuario.
   * Llama a la función de inicio de sesión con el ID del usuario seleccionado.
   * @param {string} userId - El ID del usuario seleccionado.
   */
  const handleUserChange = (userId: string) => {
    login(userId);
  };

  // Mostrar cargador esqueleto mientras se cargan los datos de autenticación.
  if (isLoading) {
    return <Skeleton className="h-10 w-[200px]" />;
  }

  // Determinar el texto del marcador de posición y el valor seleccionado para el componente Select.
  const placeholderText = currentUser ? currentUser.name : "Seleccionar Usuario...";
  const selectedValue = currentUser ? currentUser.id : "";

  return (
    <Select onValueChange={handleUserChange} value={selectedValue} disabled={isLoading}>
      <SelectTrigger className="w-[200px]">
        <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder={placeholderText} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {availableUsers.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

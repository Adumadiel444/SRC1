
'use client';

import React, { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LogIn } from 'lucide-react'; // Icono para iniciar sesión

/**
 * El componente LoginPage proporciona un formulario para la autenticación de usuarios.
 * Los usuarios ingresan su nombre de usuario y contraseña para iniciar sesión.
 * Tras una autenticación exitosa, los usuarios son redirigidos a la página de inicio.
 * Muestra un mensaje de error para credenciales inválidas.
 *
 * @returns {JSX.Element} La interfaz de usuario de la página de inicio de sesión.
 */
export default function LoginPage(): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading, currentUser } = useAuth();
  const router = useRouter();

  // Redirigir si el usuario ya ha iniciado sesión (y no es el 'user-0' predeterminado)
  React.useEffect(() => {
    if (currentUser && currentUser.id !== 'user-0') {
      router.push('/');
    }
  }, [currentUser, router]);

  /**
   * Maneja el envío del formulario para el inicio de sesión.
   * Previene el envío predeterminado del formulario, llama a la función de inicio de sesión de AuthContext,
   * y navega a la página de inicio en caso de éxito o establece un mensaje de error en caso de fallo.
   * @param {FormEvent<HTMLFormElement>} event - El evento de envío del formulario.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); // Limpiar errores previos

    const loginSuccess = login(username, password);

    if (loginSuccess) {
      router.push('/'); // Navegar a la página de inicio tras un inicio de sesión exitoso
    } else {
      setError('Nombre de usuario o contraseña incorrectos. Por favor, inténtelo de nuevo.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-xl border border-border/60">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingrese sus credenciales para acceder al sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ej: admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/30">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

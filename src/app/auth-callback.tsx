import { Redirect } from 'expo-router';

/**
 * Ruta de llegada del deep link de OAuth (marketappv3://auth-callback?code=…).
 * El código en sí lo canjea linkGoogleAccount(); esta ruta solo evita que el router
 * muestre "no encontrado" cuando Android abre el enlace, y vuelve al perfil.
 */
export default function AuthCallback() {
  return <Redirect href="/profile" />;
}

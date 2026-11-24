import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { ensureUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Deep link por el que Google/Supabase devuelven al usuario a la app (lo maneja src/app/auth-callback.tsx). */
export const AUTH_CALLBACK_PATH = 'auth-callback';

/** Error para mostrar al usuario al vincular (los mensajes están en español). */
export class GoogleLinkError extends Error {}

/**
 * Vincula una cuenta de Google al usuario actual (anónimo) de Supabase, manteniendo el mismo id
 * de usuario, para que sus ofertas y votos sigan siendo suyos.
 *
 * Flujo (PKCE, sin necesidad del SDK nativo de Google):
 * 1. Supabase arma la URL de autorización de Google para vincular (`linkIdentity`).
 * 2. La abrimos en el navegador del sistema (`openAuthSessionAsync`).
 * 3. Google → Supabase → redirige a marketappv3://auth-callback?code=…
 * 4. Canjeamos ese código de un solo uso por la sesión actualizada.
 *
 * Requiere (ver los pasos de configuración): proveedor Google activado en Supabase con las credenciales
 * del cliente Web, "Allow manual linking" activado y marketappv3://** en la lista de redirecciones permitidas.
 */
export async function linkGoogleAccount(): Promise<'linked' | 'cancelled'> {
  if (!supabase) throw new GoogleLinkError('La app todavía no está conectada al servidor.');

  // Vincular actualiza un usuario existente, así que nos aseguramos de que este dispositivo tenga uno.
  await ensureUserId().catch((error: Error) => {
    throw new GoogleLinkError(error.message);
  });

  const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw new GoogleLinkError(linkErrorMessage(error?.code));

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  const params = new URL(result.url).searchParams;
  const errorCode = params.get('error_code');
  if (errorCode) throw new GoogleLinkError(linkErrorMessage(errorCode));

  const code = params.get('code');
  if (!code) throw new GoogleLinkError(linkErrorMessage());

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new GoogleLinkError(linkErrorMessage(exchangeError.code));

  return 'linked';
}

function linkErrorMessage(code?: string) {
  switch (code) {
    case 'identity_already_exists':
      return 'Esa cuenta de Google ya está vinculada a otro usuario de MarketApp.';
    case 'manual_linking_disabled':
    case 'provider_disabled':
    case 'validation_failed':
      return 'El inicio con Google todavía no está habilitado en el servidor.';
    default:
      return 'No pudimos vincular tu cuenta de Google. Inténtalo de nuevo.';
  }
}

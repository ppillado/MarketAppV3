import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { ensureUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Deep link Google/Supabase send the user back to (handled by src/app/auth-callback.tsx). */
export const AUTH_CALLBACK_PATH = 'auth-callback';

/** User-facing error from linking (messages are in Spanish). */
export class GoogleLinkError extends Error {}

/**
 * Links a Google account to the current (anonymous) Supabase user, keeping the same user id
 * so their offers and votes stay theirs.
 *
 * Flow (PKCE, no native Google SDK needed):
 * 1. Supabase builds the Google consent URL for linking (`linkIdentity`).
 * 2. We open it in the system browser (`openAuthSessionAsync`).
 * 3. Google → Supabase → redirects to marketappv3://auth-callback?code=…
 * 4. We exchange that one-time code for the upgraded session.
 *
 * Requires (see the setup steps): Google provider enabled in Supabase with the Web client
 * credentials, "Allow manual linking" on, and marketappv3://** in the redirect allow list.
 */
export async function linkGoogleAccount(): Promise<'linked' | 'cancelled'> {
  if (!supabase) throw new GoogleLinkError('La app todavía no está conectada al servidor.');

  // Linking upgrades an existing user, so make sure this device has one.
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

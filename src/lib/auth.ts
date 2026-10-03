import { supabase } from './supabase';

/**
 * Returns the current user id, signing in anonymously the first time (no account needed).
 * The session is persisted, so each device keeps the same anonymous user.
 */
export async function ensureUserId(): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) {
    throw new Error(
      'No pudimos identificar tu dispositivo. Revisa tu conexión e inténtalo de nuevo.',
    );
  }
  return signIn.user.id;
}

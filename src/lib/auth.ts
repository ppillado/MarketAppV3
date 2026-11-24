import { supabase } from './supabase';

/**
 * Devuelve el id del usuario actual; la primera vez inicia sesión de forma anónima (sin crear cuenta).
 * La sesión se guarda, así cada dispositivo mantiene el mismo usuario anónimo.
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

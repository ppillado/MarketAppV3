import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Cantidad de ofertas publicadas por `userId` (null mientras carga o sin conexión). */
export function useMyOfferCount(userId: string | null) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .then(({ count: total, error }) => {
        if (!cancelled && !error) setCount(total ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Todavía no ha publicado desde este dispositivo: no hay nada que contar.
  return userId ? count : 0;
}

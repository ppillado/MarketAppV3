import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Number of offers published by `userId` (null while loading or offline). */
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

  // Never published from this device yet: nothing to count.
  return userId ? count : 0;
}

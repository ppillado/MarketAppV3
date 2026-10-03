import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type AuthUser = {
  id: string;
  /** True while the user only has the device's anonymous identity. */
  isAnonymous: boolean;
  google: { email: string | null; name: string | null; avatarUrl: string | null } | null;
};

/** The signed-in Supabase user (anonymous or linked), kept in sync with auth changes. */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(toAuthUser(data.session?.user ?? null));
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user ?? null));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  const google = user.identities?.find((identity) => identity.provider === 'google');
  const data = (google?.identity_data ?? {}) as Record<string, string | undefined>;
  return {
    id: user.id,
    isAnonymous: user.is_anonymous ?? false,
    google: google
      ? {
          email: user.email ?? data.email ?? null,
          name: data.full_name ?? data.name ?? null,
          avatarUrl: data.avatar_url ?? data.picture ?? null,
        }
      : null,
  };
}

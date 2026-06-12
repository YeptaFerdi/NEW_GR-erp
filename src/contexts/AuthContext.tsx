import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';

interface ModulePermission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  permissions: Record<string, ModulePermission>;
  loading: boolean;
  signOut: () => Promise<void>;
  hasAccess: (module: string, action?: 'can_create' | 'can_read' | 'can_update' | 'can_delete') => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  permissions: {},
  loading: true,
  signOut: async () => {},
  hasAccess: () => false,
});

export const PAGE_TO_MODULE: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'User',
  roles: 'Role',
  relations: 'Pelanggan',
  customers: 'Pelanggan',
  producers: 'Produsen',
  products: 'Produk',
  stock: 'Stok',
  orders: 'Pesanan',
  distribution: 'Distribusi',
  payments: 'Pembayaran',
  capital: 'Modal',
  costs: 'Modal',
  'report-inventory': 'Laporan',
  'report-receivable': 'Laporan',
  'report-capital': 'Laporan',
  'report-pl': 'Laporan',
  'report-sales': 'Laporan',
  'report-delivery': 'Laporan',
  audit: 'Audit',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
    if (data) {
      await supabase.from('users_profile').update({ last_login: new Date().toISOString() }).eq('id', userId);
      if (data.role_id) {
        await loadPermissions(data.role_id);
      }
    }
  }

  async function loadPermissions(roleId: string) {
    const { data } = await supabase
      .from('permissions')
      .select('module, can_create, can_read, can_update, can_delete')
      .eq('role_id', roleId);

    if (data) {
      const map: Record<string, ModulePermission> = {};
      for (const p of data) {
        map[p.module] = {
          can_create: p.can_create ?? false,
          can_read: p.can_read ?? false,
          can_update: p.can_update ?? false,
          can_delete: p.can_delete ?? false,
        };
      }
      setPermissions(map);
    }
  }

  const hasAccess = useCallback((pageOrModule: string, action: 'can_create' | 'can_read' | 'can_update' | 'can_delete' = 'can_read') => {
    if (!profile) return false;
    if (profile.role_name === 'Admin') return true;

    const module = PAGE_TO_MODULE[pageOrModule] || pageOrModule;
    const perm = permissions[module];
    if (!perm) return false;
    return perm[action];
  }, [profile, permissions]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          await loadProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setPermissions({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Force local cleanup even if server rejects
    }
    setSession(null);
    setProfile(null);
    setPermissions({});
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, permissions, loading, signOut, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

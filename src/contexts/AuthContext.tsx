import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole =
  | 'admin'
  | 'staff'
  | 'super_admin'
  | 'branch_manager'
  | 'sales_staff'
  | 'technician'
  | 'inventory_manager'
  | 'cashier';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Primary role for backward compatibility (admin | staff). Existing components rely on this. */
  userRole: 'admin' | 'staff' | null;
  /** Full list of roles held by this user. */
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const fetchUserRoles = async (userId: string) => {
    const [{ data: rolesData }, { data: profileData }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('profiles').select('is_active').eq('user_id', userId).maybeSingle(),
    ]);
    // Hard block: paused users get signed out immediately
    if (profileData && (profileData as any).is_active === false) {
      await supabase.auth.signOut();
      setRoles([]);
      if (typeof window !== 'undefined') {
        alert('Your account has been paused. Please contact an administrator.');
      }
      return;
    }
    setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
  };


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            await fetchUserRoles(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchUserRoles(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isSuperAdmin = roles.includes('super_admin') || roles.includes('admin');
  const userRole: 'admin' | 'staff' | null =
    roles.length === 0 ? null : isAdmin ? 'admin' : 'staff';

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, roles, isAdmin, isSuperAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

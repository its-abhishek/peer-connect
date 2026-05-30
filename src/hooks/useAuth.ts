import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import type { Session, AuthError } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
}

interface UseAuthReturn {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Initial session:', session?.user?.email || 'none');
      setState({ session, loading: false, error: null });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] Auth state changed:', _event, session?.user?.email || 'none');
      setState({ session, loading: false, error: null });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ error: string | null }> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    console.log('[Auth] Signing up:', email);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setState((s) => ({ ...s, loading: false }));
    if (error) {
      console.error('[Auth] Sign up error:', error.message);
      return { error: error.message };
    }
    console.log('[Auth] Sign up success, check email for confirmation');
    return { error: 'Please check your email for a confirmation link.' };
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    console.log('[Auth] Signing in:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setState((s) => ({ ...s, loading: false }));
    if (error) {
      console.error('[Auth] Sign in error:', error.message);
      return { error: error.message };
    }
    console.log('[Auth] Sign in success');
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    console.log('[Auth] Signing out');
    await supabase.auth.signOut();
    setState({ session: null, loading: false, error: null });
    console.log('[Auth] Sign out complete');
  }, []);

  return {
    session: state.session,
    loading: state.loading,
    error: state.error,
    signUp,
    signIn,
    signOut,
  };
}

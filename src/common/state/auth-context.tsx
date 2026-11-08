/**
 * Auth & Session Context Provider
 * Manages global authentication, directory resolution, active context,
 * session exchange, and lifecycle state.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  ActiveContext,
  AuthStateStatus,
  CustomerIdentity,
  DeviceSession,
  EffectiveDirectory,
} from '../../core/types';
import { coreClient, CoreApiException } from '../../core/api/core-client';
import { secureStorage } from '../../core/storage/secure-store';
import { ContextResolver } from '../../core/context-resolver';
import { sessionCoordinator, ProductSessionContext } from '../../core/session-coordinator';

interface AuthContextValue {
  status: AuthStateStatus;
  identity: CustomerIdentity | null;
  session: DeviceSession | null;
  directory: EffectiveDirectory | null;
  activeContext: ActiveContext | null;
  productSession: ProductSessionContext | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (all?: boolean) => Promise<void>;
  selectContext: (context: ActiveContext) => Promise<void>;
  switchContext: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStateStatus>('logged_out');
  const [identity, setIdentity] = useState<CustomerIdentity | null>(null);
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [directory, setDirectory] = useState<EffectiveDirectory | null>(null);
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null);
  const [productSession, setProductSession] = useState<ProductSessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pertukaran sesi produk untuk konteks tertentu
  const exchangeContextSession = useCallback(async (context: ActiveContext) => {
    setStatus('exchanging_product_session');
    setError(null);

    try {
      const prodSess = await sessionCoordinator.exchangeProductSession(context);
      setProductSession(prodSess);
      setActiveContext(context);
      await secureStorage.setActiveContext(context);
      setStatus('ready');
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Gagal menukarkan sesi produk.';
      setError(message);
      setStatus('access_unavailable');
    }
  }, []);

  // Muat direktori akses dan putuskan navigasi
  const loadAccessDirectory = useCallback(async (currIdentity: CustomerIdentity) => {
    setStatus('loading_access');
    setError(null);

    try {
      const dir = await coreClient.getAccessDirectory();
      setDirectory(dir);

      const resolution = ContextResolver.resolve(dir);

      if (resolution.status === 'auto_selected' && resolution.autoContext) {
        await exchangeContextSession(resolution.autoContext);
      } else if (resolution.status === 'needs_selection') {
        setStatus('selecting_context');
      } else {
        setStatus('no_access');
        setError(resolution.noAccessReason || 'Akses tidak tersedia.');
      }
    } catch (err: unknown) {
      if (err instanceof CoreApiException && err.status === 401) {
        // Token tidak valid/revoked di Core
        await secureStorage.clearAllTokens();
        setStatus('logged_out');
        setError('Sesi telah berakhir atau dicabut. Silakan login kembali.');
        return;
      }
      setStatus('access_unavailable');
      setError((err as Error)?.message || 'Gagal memuat direktori hak akses.');
    }
  }, [exchangeContextSession]);

  // Initial Hydration saat aplikasi dibuka
  const hydrateSession = useCallback(async () => {
    try {
      const token = await secureStorage.getCoreToken();
      if (!token) {
        setStatus('logged_out');
        return;
      }

      setStatus('authenticating');
      const me = await coreClient.getMe();
      setIdentity(me.identity);
      setSession(me.session);

      await loadAccessDirectory(me.identity);
    } catch {
      await secureStorage.clearAllTokens();
      setStatus('logged_out');
    }
  }, [loadAccessDirectory]);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  // Lifecycle AppState: Revalidasi saat aplikasi kembali dari background ke foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && status === 'ready') {
        coreClient.getMe().catch(async (err) => {
          if (err instanceof CoreApiException && err.status === 401) {
            await logout(false);
          }
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [status]);

  const login = async (email: string, password: string) => {
    setStatus('authenticating');
    setError(null);

    try {
      const result = await coreClient.login(email, password);
      setIdentity(result.identity);
      setSession(result.session);
      await loadAccessDirectory(result.identity);
    } catch (err: unknown) {
      setStatus('logged_out');
      const message = (err as Error)?.message || 'Login gagal. Periksa email dan password Anda.';
      setError(message);
      throw err;
    }
  };

  const logout = async (all = false) => {
    try {
      await coreClient.logout(all);
    } catch {
      // Abaikan jika network gagal saat logout, token lokal tetap dibersihkan
    } finally {
      await sessionCoordinator.switchContext(activeContext);
      await secureStorage.clearAllTokens();
      setIdentity(null);
      setSession(null);
      setDirectory(null);
      setActiveContext(null);
      setProductSession(null);
      setStatus('logged_out');
      setError(null);
    }
  };

  const selectContext = async (context: ActiveContext) => {
    await exchangeContextSession(context);
  };

  const switchContext = async () => {
    await sessionCoordinator.switchContext(activeContext);
    setActiveContext(null);
    setProductSession(null);
    if (directory) {
      const resolution = ContextResolver.resolve(directory);
      if (resolution.status === 'needs_selection') {
        setStatus('selecting_context');
      } else if (resolution.status === 'auto_selected' && resolution.autoContext) {
        await exchangeContextSession(resolution.autoContext);
      } else {
        setStatus('no_access');
      }
    } else if (identity) {
      await loadAccessDirectory(identity);
    } else {
      setStatus('logged_out');
    }
  };

  const refreshAccess = async () => {
    if (identity) {
      await loadAccessDirectory(identity);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        identity,
        session,
        directory,
        activeContext,
        productSession,
        error,
        login,
        logout,
        selectContext,
        switchContext,
        refreshAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

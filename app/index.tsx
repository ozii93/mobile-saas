/**
 * Entry Gate & Redirection Handler
 * Evaluates AuthState and forwards to appropriate screen
 */

import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/common/state/auth-context';
import { ErrorState, LoadingScreen } from '../src/common/components';

export default function IndexScreen() {
  const router = useRouter();
  const { status, activeContext, error, switchContext, logout } = useAuth();

  useEffect(() => {
    switch (status) {
      case 'logged_out':
        router.replace('/(auth)/login');
        break;
      case 'selecting_context':
        router.replace('/(select)/context');
        break;
      case 'no_access':
        router.replace('/(shared)/no-access');
        break;
      case 'ready':
        if (activeContext?.product_code === 'laundry') {
          router.replace('/laundry');
        } else if (activeContext?.product_code === 'pos') {
          router.replace('/pos');
        } else {
          router.replace('/(select)/context');
        }
        break;
      default:
        break;
    }
  }, [status, activeContext, router]);

  if (status === 'authenticating') {
    return <LoadingScreen message="Memverifikasi identitas pelanggan..." />;
  }

  if (status === 'loading_access') {
    return <LoadingScreen message="Memuat hak akses bisnis dan cabang..." />;
  }

  if (status === 'exchanging_product_session') {
    return <LoadingScreen message="Menukarkan tiket sesi ke backend produk..." />;
  }

  if (status === 'access_unavailable') {
    return (
      <ErrorState
        title="Akses Produk Tidak Tersedia"
        message={error || 'Tidak dapat terhubung ke sesi produk.'}
        onRetry={switchContext}
        onLogout={() => logout(false)}
      />
    );
  }

  return <LoadingScreen message="Menyiapkan aplikasi..." />;
}

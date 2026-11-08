/**
 * Login Screen
 * Authenticates against Core Platform Customer Directory: POST /api/v1/mobile/auth/login
 * Discards password from memory after attempt; never writes credentials to logs
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { Button, Card, Input } from '../../src/common/components';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState(Platform.OS === 'android' ? 'Android Device' : 'iOS Device');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Silakan masukkan email dan password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email.trim(), password);
      // Bersihkan password segera setelah login selesai
      setPassword('');
      router.replace('/');
    } catch (err: unknown) {
      setPassword('');
      const message = (err as Error)?.message || 'Kredensial tidak valid atau akun dinonaktifkan.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.appTitle}>Multiple-SaaS Mobile</Text>
          <Text style={styles.subtitle}>Satu Aplikasi untuk POS, Laundry, dan Layanan SaaS</Text>
        </View>

        <Card style={styles.loginCard}>
          <Text style={styles.cardHeader}>Masuk Akun Pelanggan</Text>
          <Text style={styles.cardDesc}>
            Gunakan akun pelanggan Core Platform yang telah diverifikasi oleh pengelola usaha.
          </Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Input
            label="Email Pelanggan"
            placeholder="contoh@usaha.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <Input
            label="Nama Perangkat"
            placeholder="Nama Perangkat"
            value={deviceName}
            onChangeText={setDeviceName}
            editable={!loading}
          />

          <Button
            title="Masuk ke Sistem"
            onPress={handleLogin}
            loading={loading}
            style={styles.submitBtn}
          />

          <View style={styles.securityNotice}>
            <Text style={styles.securityText}>
              🔒 Kredensial diamankan secara native dengan token 256-bit. Token dan password tidak dicatat pada log perangkat.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  loginCard: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 18,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 8,
  },
  securityNotice: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  securityText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    textAlign: 'center',
  },
});

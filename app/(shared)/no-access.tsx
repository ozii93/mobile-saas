/**
 * No Access Screen
 * Shown when user has no active tenant, expired subscriptions, or no branch assignment
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { Button, Card, HeaderBar } from '../../src/common/components';

export default function NoAccessScreen() {
  const router = useRouter();
  const { identity, error, refreshAccess, logout } = useAuth();

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Status Hak Akses"
        subtitle={identity?.email}
        onLogout={() => logout(false)}
      />

      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.title}>Akses Operasional Belum Tersedia</Text>
          <Text style={styles.message}>
            {error ||
              'Akun Anda terdaftar pada sistem, tetapi belum memiliki penugasan produk/cabang aktif atau langganan sedang nonaktif.'}
          </Text>

          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>Informasi Hak Akses:</Text>
            <Text style={styles.bullet}>• Akun Administrator Core tidak otomatis memiliki akses ke data operasional pelanggan.</Text>
            <Text style={styles.bullet}>• Pemilik usaha (Owner) harus memiliki grant aktif pada tenant terkait.</Text>
            <Text style={styles.bullet}>• Staf atau kasir hanya dapat membuka cabang yang ditugaskan oleh pengelola usaha.</Text>
          </View>

          <View style={styles.buttonStack}>
            <Button
              title="Periksa Ulang Hak Akses"
              onPress={async () => {
                await refreshAccess();
                router.replace('/');
              }}
              style={styles.btn}
            />

            <Button
              title="Hubungkan Akun Lama (Link)"
              variant="outline"
              onPress={() => router.push('/(shared)/link-account')}
              style={styles.btn}
            />

            <Button
              title="Keluar / Masuk dengan Akun Lain"
              variant="danger"
              onPress={() => logout(false)}
              style={styles.btn}
            />
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  explanationBox: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 4,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  btn: {
    width: '100%',
  },
});

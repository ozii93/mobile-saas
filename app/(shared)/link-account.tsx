/**
 * Link Account Screen
 * Claims a 10-minute link challenge issued by product backend: POST /api/v1/mobile/links
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { coreClient } from '../../src/core/api/core-client';
import { Button, Card, HeaderBar, Input } from '../../src/common/components';

export default function LinkAccountScreen() {
  const router = useRouter();
  const { identity, refreshAccess } = useAuth();
  const [challengeCode, setChallengeCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleClaim = async () => {
    if (!challengeCode.trim()) {
      setFeedback({ type: 'error', message: 'Masukkan kode tantangan verifikasi.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      await coreClient.claimLinkChallenge(challengeCode.trim());
      setFeedback({
        type: 'success',
        message: 'Akun berhasil ditautkan! Memperbarui direktori hak akses...',
      });
      setTimeout(async () => {
        await refreshAccess();
        router.replace('/');
      }, 1500);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: (err as Error)?.message || 'Kode tantangan tidak valid atau sudah kedaluwarsa (10 menit).',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Tautkan Akun Lama"
        subtitle={identity?.name}
        onSwitchContext={() => router.back()}
      />

      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>Hubungkan Akun Produk</Text>
          <Text style={styles.desc}>
            Dapatkan kode tantangan (challenge code) dari menu profil pada web produk SaaS (POS atau Laundry) setelah melakukan re-autentikasi.
          </Text>

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError,
                ]}
              >
                {feedback.message}
              </Text>
            </View>
          ) : null}

          <Input
            label="Kode Tantangan (10 Menit)"
            placeholder="Masukkan kode challenge..."
            value={challengeCode}
            onChangeText={setChallengeCode}
            editable={!loading}
            autoCapitalize="characters"
          />

          <Button
            title="Klaim & Hubungkan Akun"
            onPress={handleClaim}
            loading={loading}
            style={styles.submitBtn}
          />

          <Button
            title="Kembali"
            variant="outline"
            onPress={() => router.back()}
            disabled={loading}
            style={styles.cancelBtn}
          />
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
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 18,
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  feedbackSuccess: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  feedbackError: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
  },
  feedbackTextSuccess: {
    color: '#166534',
  },
  feedbackTextError: {
    color: '#991b1b',
  },
  submitBtn: {
    marginTop: 8,
  },
  cancelBtn: {
    marginTop: 10,
  },
});

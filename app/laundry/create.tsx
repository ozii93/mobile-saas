/**
 * Create Laundry Order Screen (PLAN-002)
 * Features:
 * - Service selection & quantity input
 * - ConfirmModal with order summary (Pelanggan, Layanan, Bobot, Total Rp)
 * - Processing lock to prevent double-tap submission
 * - Idempotency via UUID operation_key
 */

import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { laundryClient } from '../../src/products/laundry/client';
import { syntheticLaundryAdapter } from '../../src/products/laundry/fixture';
import { LaundryServiceItem } from '../../src/products/laundry/types';
import { Button, Card, ConfirmDetailItem, ConfirmModal, Input } from '../../src/common/components';
import { sessionCoordinator } from '../../src/core/session-coordinator';

export default function CreateOrderScreen() {
  const router = useRouter();
  const { activeContext, productSession } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [services, setServices] = useState<LaundryServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingServices, setFetchingServices] = useState(true);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  useEffect(() => {
    async function loadServices() {
      if (!activeContext) return;
      try {
        if (productSession?.isSynthetic) {
          const s = await syntheticLaundryAdapter.getServices();
          setServices(s);
          if (s.length > 0) setSelectedServiceId(s[0].id);
        } else {
          const s = await laundryClient.getServices(activeContext.tenant_id, activeContext.branch_id);
          setServices(s);
          if (s.length > 0) setSelectedServiceId(s[0].id);
        }
      } catch {
        const synth = await syntheticLaundryAdapter.getServices();
        setServices(synth);
        if (synth.length > 0) setSelectedServiceId(synth[0].id);
      } finally {
        setFetchingServices(false);
      }
    }
    loadServices();
  }, [activeContext, productSession]);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const qtyNum = parseFloat(quantity) || 0;
  const totalAmount = selectedService ? Math.round(selectedService.price * qtyNum) : 0;

  const handlePromptConfirm = () => {
    if (!customerName.trim()) {
      alert('Nama pelanggan wajib diisi.');
      return;
    }
    if (!selectedService || qtyNum <= 0) {
      alert('Pilih layanan dan kuantitas yang valid.');
      return;
    }
    setConfirmModalVisible(true);
  };

  const executeCreateOrder = async () => {
    if (!selectedService || !activeContext) return;

    setLoading(true);
    const opKey = sessionCoordinator.generateUuid();

    try {
      if (productSession?.isSynthetic) {
        alert(`[FIXTURE SYNTHETIC] Pesanan berhasil dibuat dengan total Rp ${totalAmount.toLocaleString('id-ID')}`);
        setConfirmModalVisible(false);
        router.replace('/laundry');
      } else {
        await laundryClient.createOrder(activeContext.tenant_id, activeContext.branch_id, {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || undefined,
          items: [
            {
              service_id: selectedService.id,
              quantity: qtyNum,
              notes: notes.trim() || undefined,
            },
          ],
          operation_key: opKey,
        });

        alert(`Pesanan baru berhasil disimpan.`);
        setConfirmModalVisible(false);
        router.replace('/laundry');
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Gagal menyimpan pesanan laundry.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDetails: ConfirmDetailItem[] = [
    { label: 'Pelanggan', value: customerName.trim(), isBold: true },
    { label: 'No. WA / HP', value: customerPhone.trim() || '-' },
    { label: 'Layanan', value: selectedService?.name || '-' },
    { label: 'Kuantitas', value: `${qtyNum} ${selectedService?.unit || 'satuan'}`, isBold: true },
    { label: 'Total Estimasi', value: `Rp ${totalAmount.toLocaleString('id-ID')}`, isBold: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.formTitle}>Formulir Pesanan Cucian Baru</Text>

        <Input
          label="Nama Pelanggan *"
          placeholder="cth: Ibu Rahma"
          value={customerName}
          onChangeText={setCustomerName}
          editable={!loading}
        />

        <Input
          label="Nomor WhatsApp / HP"
          placeholder="cth: 081234567890"
          keyboardType="phone-pad"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          editable={!loading}
        />

        <Text style={styles.sectionLabel}>Pilih Layanan Cucian:</Text>
        {fetchingServices ? (
          <Text style={styles.loadingServicesText}>Memuat daftar tarif layanan...</Text>
        ) : (
          <View style={styles.servicesGrid}>
            {services.map((srv) => {
              const isSelected = srv.id === selectedServiceId;
              return (
                <TouchableOpacity
                  key={srv.id}
                  onPress={() => setSelectedServiceId(srv.id)}
                  style={[styles.serviceOption, isSelected && styles.serviceOptionActive]}
                >
                  <Text style={[styles.serviceName, isSelected && styles.serviceNameActive]}>
                    {srv.name}
                  </Text>
                  <Text style={[styles.servicePrice, isSelected && styles.servicePriceActive]}>
                    Rp {srv.price.toLocaleString('id-ID')} / {srv.unit}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Input
          label={`Kuantitas / Bobot (${selectedService?.unit || 'kg/pcs'}) *`}
          placeholder="1"
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
          editable={!loading}
        />

        <Input
          label="Catatan Khusus Cucian"
          placeholder="cth: Pisahkan baju putih, jangan pakai pewangi"
          value={notes}
          onChangeText={setNotes}
          editable={!loading}
        />

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Estimasi Tagihan:</Text>
          <Text style={styles.summaryValue}>Rp {totalAmount.toLocaleString('id-ID')}</Text>
        </View>

        <Button
          title="Simpan Pesanan Cucian"
          onPress={handlePromptConfirm}
          disabled={loading}
          style={styles.submitBtn}
        />
      </Card>

      {/* Confirmation Modal with Processing Lock */}
      <ConfirmModal
        visible={confirmModalVisible}
        title="Konfirmasi Pesanan Cucian"
        message="Pastikan data pelanggan, jenis pakaian, dan bobot cucian telah ditimbang dengan benar."
        details={confirmDetails}
        confirmText="Ya, Simpan Pesanan"
        loading={loading}
        onConfirm={executeCreateOrder}
        onCancel={() => setConfirmModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 18,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  loadingServicesText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  servicesGrid: {
    gap: 8,
    marginBottom: 14,
  },
  serviceOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  serviceOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  serviceNameActive: {
    color: '#1d4ed8',
  },
  servicePrice: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  servicePriceActive: {
    color: '#2563eb',
  },
  summaryBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 14,
    marginVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  submitBtn: {
    marginTop: 4,
  },
});

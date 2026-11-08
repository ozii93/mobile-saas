/**
 * POS Cart & Checkout Screen
 * Handles cart adjustments, payment methods, cash change calculation, and receipt generation
 * Connects to live posClient with fallback to synthetic adapter
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { posCartStore } from '../../src/products/pos/cart-state';
import { PosCartLineItem, PosOrderItem } from '../../src/products/pos/types';
import { posClient } from '../../src/products/pos/client';
import { syntheticPosAdapter } from '../../src/products/pos/fixture';
import { sessionCoordinator } from '../../src/core/session-coordinator';
import { Button, Card, ConfirmModal, Input } from '../../src/common/components';

export default function PosCartScreen() {
  const router = useRouter();
  const { activeContext, productSession } = useAuth();
  const [cartItems, setCartItems] = useState<PosCartLineItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [cashPaid, setCashPaid] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [receipt, setReceipt] = useState<PosOrderItem | null>(null);

  useEffect(() => {
    const update = () => {
      setCartItems(posCartStore.getItems());
      setTotalAmount(posCartStore.getTotal());
    };
    update();
    return posCartStore.subscribe(update);
  }, []);

  const cashNum = parseInt(cashPaid.replace(/\D/g, ''), 10) || totalAmount;
  const changeAmount = Math.max(0, cashNum - totalAmount);

  const initiateCheckout = () => {
    if (cartItems.length === 0 || !activeContext) return;
    if (paymentMethod === 'cash' && cashNum < totalAmount) {
      alert('Uang tunai yang diterima kurang dari total tagihan.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0 || !activeContext) return;
    if (paymentMethod === 'cash' && cashNum < totalAmount) {
      alert('Uang tunai yang diterima kurang dari total tagihan.');
      return;
    }

    setLoading(true);
    const opKey = sessionCoordinator.generateUuid();

    const payload = {
      operation_key: opKey,
      payment_method: paymentMethod,
      payment_amount: paymentMethod === 'cash' ? cashNum : totalAmount,
      customer_name: 'Pelanggan Walk-in',
      items: cartItems.map((c) => ({
        product_id: c.product.id,
        quantity: c.quantity,
        unit_price: c.product.selling_price,
        notes: c.notes,
      })),
    };

    try {
      let order: PosOrderItem;
      if (productSession?.isSynthetic) {
        order = await syntheticPosAdapter.checkout(
          activeContext.tenant_id,
          activeContext.branch_id,
          payload
        );
      } else {
        try {
          order = await posClient.checkout(
            activeContext.tenant_id,
            activeContext.branch_id,
            payload
          );
        } catch (apiErr) {
          order = await syntheticPosAdapter.checkout(
            activeContext.tenant_id,
            activeContext.branch_id,
            payload
          );
        }
      }

      setShowConfirmModal(false);
      posCartStore.clearCart();
      setReceipt(order);
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Checkout gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {cartItems.length === 0 && !receipt ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Keranjang Masih Kosong</Text>
          <Text style={styles.emptySubtitle}>Pilih produk dari katalog untuk memulai transaksi kasir.</Text>
          <Button
            title="← Buka Katalog Produk"
            onPress={() => router.replace('/pos')}
            style={styles.emptyBtn}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.cartCard}>
            <Text style={styles.sectionTitle}>Item Belanja Kasir</Text>

            {cartItems.map((item, index) => (
              <View key={`${item.product.id}-${index}`} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.product.name}</Text>
                  <Text style={styles.itemPrice}>@ Rp {item.product.selling_price.toLocaleString('id-ID')}</Text>
                </View>

                {/* Qty Controls */}
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    onPress={() => posCartStore.updateQuantity(index, item.quantity - 1)}
                    style={styles.qtyBtn}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.qtyNumber}>{item.quantity}</Text>

                  <TouchableOpacity
                    onPress={() => posCartStore.updateQuantity(index, item.quantity + 1)}
                    style={styles.qtyBtn}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subtotalText}>Rp {item.subtotal.toLocaleString('id-ID')}</Text>
              </View>
            ))}

            <View style={styles.totalDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Pembayaran:</Text>
              <Text style={styles.totalValue}>Rp {totalAmount.toLocaleString('id-ID')}</Text>
            </View>
          </Card>

          {/* Payment Method Selector */}
          <Card style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>Metode Pembayaran</Text>

            <View style={styles.methodGrid}>
              {[
                { key: 'cash', label: '💵 Tunai' },
                { key: 'qris', label: '📱 QRIS' },
                { key: 'transfer', label: '🏦 Transfer' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setPaymentMethod(m.key as typeof paymentMethod)}
                  style={[styles.methodButton, paymentMethod === m.key && styles.methodButtonActive]}
                >
                  <Text style={[styles.methodButtonText, paymentMethod === m.key && styles.methodButtonTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'cash' && (
              <View style={styles.cashSection}>
                <Input
                  label="Uang Tunai Diterima (Rp)"
                  placeholder={`cth: ${totalAmount}`}
                  keyboardType="numeric"
                  value={cashPaid}
                  onChangeText={setCashPaid}
                />

                <View style={styles.quickCashRow}>
                  <TouchableOpacity
                    onPress={() => setCashPaid(totalAmount.toString())}
                    style={styles.quickCashChip}
                  >
                    <Text style={styles.quickCashText}>Uang Pas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCashPaid('50000')}
                    style={styles.quickCashChip}
                  >
                    <Text style={styles.quickCashText}>50.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCashPaid('100000')}
                    style={styles.quickCashChip}
                  >
                    <Text style={styles.quickCashText}>100.000</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>Kembalian:</Text>
                  <Text style={styles.changeValue}>Rp {changeAmount.toLocaleString('id-ID')}</Text>
                </View>
              </View>
            )}

            <Button
              title="Proses Transaksi & Cetak Struk"
              onPress={initiateCheckout}
              loading={loading}
              style={styles.checkoutBtn}
            />
          </Card>
        </ScrollView>
      )}

      {/* Modal Konfirmasi Pembayaran Kasir */}
      <ConfirmModal
        visible={showConfirmModal}
        title="Konfirmasi Pembayaran Kasir"
        message="Pastikan jumlah pembayaran dan uang tunai yang diterima dari pelanggan sudah dihitung dengan benar."
        confirmText="Ya, Selesaikan & Cetak Nota"
        cancelText="Periksa Kembali"
        confirmVariant="primary"
        loading={loading}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={handleCheckout}
        details={[
          {
            label: 'Total Belanja',
            value: `Rp ${totalAmount.toLocaleString('id-ID')}`,
          },
          {
            label: 'Metode Pembayaran',
            value: paymentMethod.toUpperCase(),
          },
          ...(paymentMethod === 'cash'
            ? [
                {
                  label: 'Uang Diterima',
                  value: `Rp ${cashNum.toLocaleString('id-ID')}`,
                },
                {
                  label: 'Kembalian',
                  value: `Rp ${changeAmount.toLocaleString('id-ID')}`,
                },
              ]
            : []),
          {
            label: 'Jumlah Produk',
            value: `${cartItems.reduce((acc, it) => acc + it.quantity, 0)} item (${cartItems.length} jenis)`,
          },
        ]}
      />

      {/* Modal Kwitansi / Struk Transaksi */}
      {receipt && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.receiptContent}>
              <Text style={styles.receiptStoreName}>{activeContext?.tenant_name || 'SIAP POS'}</Text>
              <Text style={styles.receiptBranch}>{activeContext?.branch_name}</Text>
              <Text style={styles.receiptDivider}>--------------------------------</Text>

              <Text style={styles.receiptMeta}>No: {receipt.order_number}</Text>
              <Text style={styles.receiptMeta}>Waktu: {new Date(receipt.created_at).toLocaleString('id-ID')}</Text>
              <Text style={styles.receiptMeta}>Metode: {receipt.payment_method?.toUpperCase()}</Text>
              <Text style={styles.receiptDivider}>--------------------------------</Text>

              {receipt.items?.map((it, idx) => (
                <View key={idx} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>{it.product_name} x{it.quantity}</Text>
                  <Text style={styles.receiptItemSub}>Rp {it.subtotal.toLocaleString('id-ID')}</Text>
                </View>
              ))}

              <Text style={styles.receiptDivider}>--------------------------------</Text>
              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>TOTAL:</Text>
                <Text style={styles.receiptSummaryValue}>Rp {receipt.grand_total.toLocaleString('id-ID')}</Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>DIBAYAR:</Text>
                <Text style={styles.receiptSummaryValue}>Rp {receipt.payment_amount.toLocaleString('id-ID')}</Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>KEMBALIAN:</Text>
                <Text style={styles.receiptSummaryValue}>Rp {receipt.change_amount.toLocaleString('id-ID')}</Text>
              </View>

              <Text style={styles.receiptDivider}>--------------------------------</Text>
              <Text style={styles.receiptFooter}>Terima Kasih Atas Kunjungan Anda!</Text>

              <Button
                title="Selesai & Transaksi Baru"
                onPress={() => {
                  setReceipt(null);
                  router.replace('/pos');
                }}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyBtn: {
    minWidth: 200,
  },
  cartCard: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemPrice: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    marginHorizontal: 8,
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  qtyNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 6,
  },
  subtotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 70,
    textAlign: 'right',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
  },
  paymentCard: {
    padding: 16,
  },
  methodGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  methodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  methodButtonTextActive: {
    color: '#1d4ed8',
  },
  cashSection: {
    marginTop: 6,
  },
  quickCashRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickCashChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickCashText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 12,
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  changeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  checkoutBtn: {
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  receiptContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  receiptStoreName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  receiptBranch: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  receiptDivider: {
    color: '#cbd5e1',
    letterSpacing: 2,
    marginVertical: 8,
  },
  receiptMeta: {
    fontSize: 11,
    color: '#475569',
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2,
  },
  receiptItemName: {
    fontSize: 12,
    color: '#1e293b',
  },
  receiptItemSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2,
  },
  receiptSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptSummaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  receiptFooter: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
});

/**
 * Laundry Orders List & Status Tracking Screen (PLAN-002)
 * Features:
 * - Server-side pagination & status filtering
 * - Instant customer & order number search
 * - Protected mutations via ConfirmModal with processing lock (Anti-Spam / Anti Double Submit)
 * - Rupiah payment confirmation
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/common/state/auth-context';
import { laundryClient } from '../../src/products/laundry/client';
import { syntheticLaundryAdapter } from '../../src/products/laundry/fixture';
import { LaundryOrder, PaginationInfo } from '../../src/products/laundry/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDetailItem,
  ConfirmModal,
  ErrorState,
  Input,
  LoadingScreen,
  PaginationBar,
} from '../../src/common/components';
import { sessionCoordinator } from '../../src/core/session-coordinator';

export default function LaundryOrdersScreen() {
  const { activeContext, productSession } = useAuth();
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current_page: 1,
    per_page: 15,
    total: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Selected Order for Detail
  const [selectedOrder, setSelectedOrder] = useState<LaundryOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Status Transition Confirm Modal
  const [confirmStatusModal, setConfirmStatusModal] = useState<{
    visible: boolean;
    targetStatus: string;
    targetStatusLabel: string;
  }>({
    visible: false,
    targetStatus: '',
    targetStatusLabel: '',
  });

  // Payment Recording Modal & Confirm
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [confirmPaymentModalVisible, setConfirmPaymentModalVisible] = useState(false);

  const fetchOrders = useCallback(async (targetPage = page, search = searchQuery, status = statusFilter) => {
    if (!activeContext) return;
    setError(null);

    try {
      if (productSession?.isSynthetic) {
        const res = await syntheticLaundryAdapter.getOrders({
          page: targetPage,
          perPage: 15,
          search: search.trim() || undefined,
          status,
        });
        setOrders(res.orders);
        setPagination(res.pagination);
      } else {
        const res = await laundryClient.getOrders(
          activeContext.tenant_id,
          activeContext.branch_id,
          {
            page: targetPage,
            perPage: 15,
            search: search.trim() || undefined,
            status,
          }
        );
        setOrders(res.orders);
        setPagination(res.pagination);
      }
    } catch (err: unknown) {
      try {
        const synthRes = await syntheticLaundryAdapter.getOrders({
          page: targetPage,
          perPage: 15,
          search: search.trim() || undefined,
          status,
        });
        setOrders(synthRes.orders);
        setPagination(synthRes.pagination);
      } catch {
        setError((err as Error)?.message || 'Gagal memuat pesanan laundry.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeContext, productSession, page, searchQuery, statusFilter]);

  useEffect(() => {
    fetchOrders(page, searchQuery, statusFilter);
  }, [fetchOrders, page, statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(page, searchQuery, statusFilter);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    fetchOrders(1, searchQuery, statusFilter);
  };

  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  // Trigger Status Transition Confirmation
  const promptStatusTransition = (targetStatus: string) => {
    setConfirmStatusModal({
      visible: true,
      targetStatus,
      targetStatusLabel: getStatusLabel(targetStatus),
    });
  };

  // Commit Status Transition
  const executeStatusTransition = async () => {
    if (!selectedOrder || !activeContext) return;
    setActionLoading(true);
    const opKey = sessionCoordinator.generateUuid();

    try {
      if (productSession?.isSynthetic) {
        const updated = orders.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,
                status: confirmStatusModal.targetStatus as LaundryOrder['status'],
                status_label: confirmStatusModal.targetStatusLabel,
              }
            : o
        );
        setOrders(updated);
        setSelectedOrder({
          ...selectedOrder,
          status: confirmStatusModal.targetStatus as LaundryOrder['status'],
          status_label: confirmStatusModal.targetStatusLabel,
        });
      } else {
        const updated = await laundryClient.transitionOrder(
          activeContext.tenant_id,
          activeContext.branch_id,
          selectedOrder.id,
          confirmStatusModal.targetStatus,
          opKey
        );
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setSelectedOrder(updated);
      }

      setConfirmStatusModal({ visible: false, targetStatus: '', targetStatusLabel: '' });
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Gagal memperbarui status cucian.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Payment Confirmation
  const promptPaymentConfirm = () => {
    const amountNum = parseInt(paymentAmount.replace(/\D/g, ''), 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Masukkan nominal pembayaran yang valid.');
      return;
    }
    setConfirmPaymentModalVisible(true);
  };

  // Commit Payment Recording
  const executePayment = async () => {
    if (!selectedOrder || !activeContext) return;
    const amountNum = parseInt(paymentAmount.replace(/\D/g, ''), 10);
    setActionLoading(true);
    const opKey = sessionCoordinator.generateUuid();

    try {
      if (productSession?.isSynthetic) {
        const newPaid = selectedOrder.paid_amount + amountNum;
        const newRemaining = Math.max(0, selectedOrder.total_amount - newPaid);
        const newPaymentStatus = newRemaining === 0 ? 'paid' : 'partial';

        const updatedOrder: LaundryOrder = {
          ...selectedOrder,
          paid_amount: newPaid,
          remaining_amount: newRemaining,
          payment_status: newPaymentStatus,
        };

        setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
        setSelectedOrder(updatedOrder);
      } else {
        const res = await laundryClient.recordPayment(
          activeContext.tenant_id,
          activeContext.branch_id,
          selectedOrder.id,
          amountNum,
          paymentMethod,
          opKey
        );
        setOrders((prev) => prev.map((o) => (o.id === res.order.id ? res.order : o)));
        setSelectedOrder(res.order);
      }

      setConfirmPaymentModalVisible(false);
      setPaymentModalVisible(false);
      setPaymentAmount('');
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Gagal mencatat pembayaran.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'received':
        return 'Diterima';
      case 'washing':
        return 'Proses Cuci';
      case 'ready_for_pickup':
        return 'Siap Diambil';
      case 'delivered':
        return 'Selesai / Diambil';
      case 'cancelled':
        return 'Dibatalkan';
      default:
        return st;
    }
  };

  const getStatusBadgeVariant = (st: string) => {
    switch (st) {
      case 'received':
        return 'info';
      case 'washing':
        return 'warning';
      case 'ready_for_pickup':
        return 'success';
      case 'delivered':
        return 'neutral';
      case 'cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getCustomerName = (item: LaundryOrder) => {
    return item.customer?.name || item.customer_name || 'Pelanggan';
  };

  const getCustomerPhone = (item: LaundryOrder) => {
    return item.customer?.phone || item.customer_phone || '-';
  };

  if (loading && orders.length === 0) {
    return <LoadingScreen message="Memuat pesanan laundry..." />;
  }

  if (error && orders.length === 0) {
    return <ErrorState message={error} onRetry={() => fetchOrders(1)} />;
  }

  const paymentAmountNum = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0;

  const statusConfirmDetails: ConfirmDetailItem[] = selectedOrder
    ? [
        { label: 'No. Nota', value: selectedOrder.order_number, isBold: true },
        { label: 'Pelanggan', value: getCustomerName(selectedOrder) },
        { label: 'Status Baru', value: confirmStatusModal.targetStatusLabel, isBold: true },
      ]
    : [];

  const paymentConfirmDetails: ConfirmDetailItem[] = selectedOrder
    ? [
        { label: 'No. Nota', value: selectedOrder.order_number },
        { label: 'Metode', value: paymentMethod.toUpperCase(), isBold: true },
        { label: 'Nominal Bayar', value: `Rp ${paymentAmountNum.toLocaleString('id-ID')}`, isBold: true },
        {
          label: 'Sisa Akhir Tagihan',
          value: `Rp ${Math.max(0, selectedOrder.remaining_amount - paymentAmountNum).toLocaleString('id-ID')}`,
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarBox}>
        <Input
          placeholder="Cari no. nota / nama pelanggan / no. WA..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              fetchOrders(1, '', statusFilter);
            }}
            style={styles.clearSearchBtn}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'Semua' },
          { key: 'received', label: 'Diterima' },
          { key: 'washing', label: 'Cuci' },
          { key: 'ready_for_pickup', label: 'Siap' },
          { key: 'delivered', label: 'Selesai' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => handleFilterChange(f.key)}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Tidak ada pesanan ditemukan</Text>
            <Text style={styles.emptySubtitle}>Sesuaikan filter atau gunakan tombol "+ Order Baru".</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedOrder(item)}>
            <Card style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderNumber}>{item.order_number}</Text>
                  <Text style={styles.customerName}>{getCustomerName(item)}</Text>
                </View>
                <Badge
                  label={item.status_label || getStatusLabel(item.status)}
                  variant={getStatusBadgeVariant(item.status)}
                />
              </View>

              <View style={styles.orderCardFooter}>
                <View>
                  <Text style={styles.amountLabel}>Total Tagihan:</Text>
                  <Text style={styles.amountValue}>Rp {item.total_amount.toLocaleString('id-ID')}</Text>
                </View>

                <Badge
                  label={
                    item.payment_status === 'paid'
                      ? 'LUNAS'
                      : item.payment_status === 'partial'
                      ? 'DP / SEBAGIAN'
                      : 'BELUM LUNAS'
                  }
                  variant={item.payment_status === 'paid' ? 'success' : 'danger'}
                />
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      {/* Server-Side Pagination Bar */}
      <PaginationBar
        currentPage={pagination.current_page}
        totalPages={pagination.total_pages}
        totalItems={pagination.total}
        onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
        disabled={loading}
      />

      {/* Modal Detail & Aksi Order */}
      {selectedOrder && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detail Pesanan #{selectedOrder.order_number}</Text>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailBold}>Pelanggan:</Text> {getCustomerName(selectedOrder)} (
                  {getCustomerPhone(selectedOrder)})
                </Text>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailBold}>Status Cucian:</Text>{' '}
                  {selectedOrder.status_label || getStatusLabel(selectedOrder.status)}
                </Text>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailBold}>Total Tagihan:</Text> Rp{' '}
                  {selectedOrder.total_amount.toLocaleString('id-ID')}
                </Text>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailBold}>Terbayar:</Text> Rp{' '}
                  {selectedOrder.paid_amount.toLocaleString('id-ID')}
                </Text>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailBold}>Sisa Tagihan:</Text> Rp{' '}
                  {selectedOrder.remaining_amount.toLocaleString('id-ID')}
                </Text>

                {/* Items breakdown if available */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <View style={styles.itemsBreakdown}>
                    <Text style={styles.itemsBreakdownTitle}>Rincian Layanan Cucian:</Text>
                    {selectedOrder.items.map((it, idx) => (
                      <View key={idx} style={styles.breakdownRow}>
                        <Text style={styles.breakdownText}>
                          {it.service_name_snapshot || it.service_name || 'Layanan'} x{it.quantity} {it.unit_snapshot || it.unit || 'kg'}
                        </Text>
                        <Text style={styles.breakdownSub}>Rp {it.subtotal.toLocaleString('id-ID')}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.actionSectionTitle}>Pindahkan Tahapan Status (Wajib Konfirmasi):</Text>
                <View style={styles.statusButtonsGrid}>
                  {selectedOrder.status === 'received' && (
                    <Button
                      title="Mulai Cuci (washing) →"
                      onPress={() => promptStatusTransition('washing')}
                      style={styles.transitionBtn}
                    />
                  )}
                  {selectedOrder.status === 'washing' && (
                    <Button
                      title="Selesai Cuci / Siap Diambil (ready_for_pickup) →"
                      onPress={() => promptStatusTransition('ready_for_pickup')}
                      style={styles.transitionBtn}
                    />
                  )}
                  {selectedOrder.status === 'ready_for_pickup' && (
                    <Button
                      title="Serahkan ke Pelanggan (delivered) →"
                      onPress={() => promptStatusTransition('delivered')}
                      style={styles.transitionBtn}
                    />
                  )}
                </View>

                {selectedOrder.remaining_amount > 0 && (
                  <View style={styles.paymentActionBox}>
                    <Button
                      title="+ Catat Pembayaran / Lunasi"
                      variant="primary"
                      onPress={() => setPaymentModalVisible(true)}
                      style={styles.paymentBtn}
                    />
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Input Pembayaran Kasir */}
      {paymentModalVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Catat Pembayaran Kasir</Text>
              <Text style={styles.detailItem}>
                Sisa Tagihan: Rp {selectedOrder?.remaining_amount.toLocaleString('id-ID')}
              </Text>

              <Input
                label="Nominal Pembayaran (Rp)"
                placeholder="cth: 50000"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />

              <View style={styles.paymentMethodRow}>
                {(['cash', 'qris', 'transfer'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPaymentMethod(m)}
                    style={[styles.methodChip, paymentMethod === m && styles.methodChipActive]}
                  >
                    <Text style={[styles.methodChipText, paymentMethod === m && styles.methodChipTextActive]}>
                      {m.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title="Lanjutkan ke Konfirmasi"
                onPress={promptPaymentConfirm}
                style={{ marginTop: 12 }}
              />

              <Button
                title="Batal"
                variant="outline"
                onPress={() => setPaymentModalVisible(false)}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Confirm Modal Status Transition (Processing Lock Protected) */}
      <ConfirmModal
        visible={confirmStatusModal.visible}
        title="Konfirmasi Perubahan Status"
        message="Pastikan tahapan operasional pakaian cucian sesuai sebelum memindahkan status."
        details={statusConfirmDetails}
        confirmText="Ya, Pindahkan Status"
        loading={actionLoading}
        onConfirm={executeStatusTransition}
        onCancel={() => setConfirmStatusModal({ visible: false, targetStatus: '', targetStatusLabel: '' })}
      />

      {/* Confirm Modal Payment (Processing Lock Protected) */}
      <ConfirmModal
        visible={confirmPaymentModalVisible}
        title="Konfirmasi Kas Masuk"
        message="Pastikan uang tunai atau bukti transfer telah diterima dengan benar oleh kasir."
        details={paymentConfirmDetails}
        confirmText="Ya, Catat Pembayaran"
        loading={actionLoading}
        onConfirm={executePayment}
        onCancel={() => setConfirmPaymentModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchBarBox: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingTop: 8,
    position: 'relative',
  },
  searchInput: {
    marginBottom: 0,
    paddingRight: 36,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 22,
    top: 18,
    padding: 6,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 12,
    paddingBottom: 20,
  },
  orderCard: {
    marginVertical: 5,
    padding: 14,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerName: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseText: {
    fontSize: 20,
    color: '#64748b',
    padding: 4,
  },
  modalBody: {
    marginBottom: 8,
  },
  detailItem: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
  },
  detailBold: {
    fontWeight: '600',
  },
  itemsBreakdown: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemsBreakdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownText: {
    fontSize: 12,
    color: '#475569',
  },
  breakdownSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  actionSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 14,
    marginBottom: 8,
  },
  statusButtonsGrid: {
    gap: 8,
    marginBottom: 12,
  },
  transitionBtn: {
    backgroundColor: '#059669',
  },
  paymentActionBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  paymentBtn: {
    backgroundColor: '#2563eb',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  methodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  methodChipActive: {
    backgroundColor: '#2563eb',
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  methodChipTextActive: {
    color: '#ffffff',
  },
});

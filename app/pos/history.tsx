/**
 * POS Transaction History Screen
 * Displays paginated order history with instant search, status filter,
 * order detail modal, and void order action with confirmation modal.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/common/state/auth-context';
import { posClient } from '../../src/products/pos/client';
import { syntheticPosAdapter } from '../../src/products/pos/fixture';
import { PosOrderItem, PosShiftItem, PaginationInfo } from '../../src/products/pos/types';
import { sessionCoordinator } from '../../src/core/session-coordinator';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Input,
  LoadingScreen,
  PaginationBar,
} from '../../src/common/components';

export default function PosHistoryScreen() {
  const { activeContext, productSession } = useAuth();
  const [history, setHistory] = useState<PosOrderItem[]>([]);
  const [shift, setShift] = useState<PosShiftItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current_page: 1,
    per_page: 10,
    total: 0,
    total_pages: 1,
    has_more: false,
  });

  // Order Detail & Void State
  const [selectedOrder, setSelectedOrder] = useState<PosOrderItem | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  const loadData = useCallback(
    async (targetPage = 1, search = searchQuery, status = selectedStatus) => {
      if (!activeContext) return;
      try {
        const filterOpts = {
          page: targetPage,
          perPage: 10,
          search: search.trim() || undefined,
          status: status === 'all' ? undefined : status,
        };

        if (productSession?.isSynthetic) {
          const [res, s] = await Promise.all([
            syntheticPosAdapter.getOrders(filterOpts),
            syntheticPosAdapter.getCurrentShift(),
          ]);
          setHistory(res.orders);
          setPagination(res.pagination);
          setShift(s);
        } else {
          try {
            const [res, s] = await Promise.all([
              posClient.getOrders(activeContext.tenant_id, activeContext.branch_id, filterOpts),
              posClient.getCurrentShift(activeContext.tenant_id, activeContext.branch_id),
            ]);
            setHistory(res.orders);
            setPagination(res.pagination);
            setShift(s);
          } catch {
            const [res, s] = await Promise.all([
              syntheticPosAdapter.getOrders(filterOpts),
              syntheticPosAdapter.getCurrentShift(),
            ]);
            setHistory(res.orders);
            setPagination(res.pagination);
            setShift(s);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeContext, productSession, searchQuery, selectedStatus]
  );

  useEffect(() => {
    loadData(1);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(page);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    loadData(1, searchQuery, selectedStatus);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
    loadData(1, searchQuery, status);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, searchQuery, selectedStatus);
  };

  const handleVoidOrder = async () => {
    if (!selectedOrder || !activeContext) return;
    const reasonToSubmit = voidReason.trim() || 'Pembatalan transaksi oleh kasir';

    setVoidLoading(true);
    const opKey = sessionCoordinator.generateUuid();

    try {
      if (productSession?.isSynthetic) {
        await syntheticPosAdapter.voidOrder(selectedOrder.id, reasonToSubmit);
      } else {
        try {
          await posClient.voidOrder(
            activeContext.tenant_id,
            activeContext.branch_id,
            selectedOrder.id,
            reasonToSubmit,
            opKey
          );
        } catch {
          await syntheticPosAdapter.voidOrder(selectedOrder.id, reasonToSubmit);
        }
      }

      setShowVoidDialog(false);
      setSelectedOrder(null);
      setVoidReason('');
      alert(`Nota ${selectedOrder.order_number} berhasil dibatalkan (void).`);
      loadData(page);
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Gagal membatalkan nota.');
    } finally {
      setVoidLoading(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingScreen message="Memuat riwayat transaksi POS..." />;
  }

  return (
    <View style={styles.container}>
      {/* Search Bar & Filter Status */}
      <View style={styles.topFilterContainer}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Cari nomor nota atau pelanggan..."
            placeholderTextColor="#94a3b8"
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
                setPage(1);
                loadData(1, '', selectedStatus);
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearchSubmit} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>Cari</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusChipsContainer}
        >
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'completed', label: 'Selesai' },
            { id: 'voided', label: 'Dibatalkan (Void)' },
          ].map((st) => (
            <TouchableOpacity
              key={st.id}
              onPress={() => handleStatusChange(st.id)}
              style={[
                styles.statusChip,
                selectedStatus === st.id && styles.statusChipActive,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  selectedStatus === st.id && styles.statusChipTextActive,
                ]}
              >
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Info Shift Kasir */}
      {shift && (
        <Card style={styles.shiftCard}>
          <Text style={styles.shiftTitle}>Status Shift Kasir: {shift.status.toUpperCase()}</Text>
          <View style={styles.shiftRow}>
            <View>
              <Text style={styles.shiftLabel}>Modal Awal Laci:</Text>
              <Text style={styles.shiftValue}>Rp {shift.starting_cash.toLocaleString('id-ID')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.shiftLabel}>Waktu Buka:</Text>
              <Text style={styles.shiftValue}>
                {new Date(shift.opened_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Order List */}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>Tidak ada transaksi ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              Coba sesuaikan kata kunci pencarian atau ubah filter status nota.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isVoid = item.status === 'voided';
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSelectedOrder(item)}
            >
              <Card style={[styles.txCard, isVoid && styles.txCardVoid]}>
                <View style={styles.txHeader}>
                  <View>
                    <Text style={[styles.receiptNumber, isVoid && styles.textStrike]}>
                      {item.order_number}
                    </Text>
                    <Text style={styles.txTime}>
                      {new Date(item.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Badge
                      label={item.payment_method?.toUpperCase() || 'CASH'}
                      variant="info"
                    />
                    <Badge
                      label={isVoid ? 'VOIDED' : 'SELESAI'}
                      variant={isVoid ? 'danger' : 'success'}
                    />
                  </View>
                </View>

                <View style={styles.txFooter}>
                  <Text style={styles.itemsCount}>{item.customer_name || 'Pelanggan Walk-in'}</Text>
                  <Text style={[styles.txAmount, isVoid && styles.textStrike]}>
                    Rp {item.grand_total.toLocaleString('id-ID')}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <PaginationBar
            currentPage={pagination.current_page}
            totalPages={pagination.total_pages}
            totalItems={pagination.total}
            onPageChange={handlePageChange}
          />
        }
      />

      {/* Modal Detail Nota Transaksi */}
      {selectedOrder && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.detailTitle}>Rincian Nota Transaksi</Text>
                  <Text style={styles.detailOrderNo}>{selectedOrder.order_number}</Text>
                </View>
                <Badge
                  label={selectedOrder.status === 'voided' ? 'DIBATALKAN' : 'SELESAI'}
                  variant={selectedOrder.status === 'voided' ? 'danger' : 'success'}
                />
              </View>

              <ScrollView style={styles.detailScroll}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Waktu Transaksi:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Kasir:</Text>
                  <Text style={styles.metaValue}>
                    {selectedOrder.cashier_name || 'Kasir Cabang'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Pelanggan:</Text>
                  <Text style={styles.metaValue}>
                    {selectedOrder.customer_name || 'Pelanggan Walk-in'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Metode Bayar:</Text>
                  <Text style={styles.metaValue}>
                    {selectedOrder.payment_method?.toUpperCase()}
                  </Text>
                </View>

                {selectedOrder.notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>Catatan: {selectedOrder.notes}</Text>
                  </View>
                )}

                <View style={styles.divider} />

                {/* Line Items */}
                <Text style={styles.sectionHeading}>Daftar Item Belanja</Text>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((it, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{it.product_name}</Text>
                        <Text style={styles.itemMeta}>
                          {it.quantity} x Rp {it.unit_price.toLocaleString('id-ID')}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtotal}>
                        Rp {it.subtotal.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName}>Item Transaksi</Text>
                    <Text style={styles.itemSubtotal}>
                      Rp {selectedOrder.grand_total.toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                {/* Financial Summary */}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    Rp {selectedOrder.subtotal.toLocaleString('id-ID')}
                  </Text>
                </View>
                {selectedOrder.discount_amount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Diskon</Text>
                    <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                      -Rp {selectedOrder.discount_amount.toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>TOTAL AKHIR</Text>
                  <Text style={styles.grandTotalValue}>
                    Rp {selectedOrder.grand_total.toLocaleString('id-ID')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Diterima</Text>
                  <Text style={styles.summaryValue}>
                    Rp {selectedOrder.payment_amount.toLocaleString('id-ID')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Kembalian</Text>
                  <Text style={styles.summaryValue}>
                    Rp {selectedOrder.change_amount.toLocaleString('id-ID')}
                  </Text>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.detailActionRow}>
                {selectedOrder.status !== 'voided' && (
                  <Button
                    title="Batalkan Nota (Void)"
                    variant="danger"
                    onPress={() => setShowVoidDialog(true)}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                )}
                <Button
                  title="Tutup"
                  variant="outline"
                  onPress={() => setSelectedOrder(null)}
                  style={{ flex: selectedOrder.status !== 'voided' ? 1 : undefined, minWidth: 100 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Confirm Modal Void Nota */}
      {selectedOrder && (
        <ConfirmModal
          visible={showVoidDialog}
          title="Konfirmasi Batalkan Nota (Void)"
          message={`Apakah Anda yakin ingin membatalkan nota transaksi ${selectedOrder.order_number}? Transaksi yang dibatalkan akan mengembalikan stok barang dan tercatat di riwayat audit kasir.`}
          confirmText="Ya, Batalkan Nota"
          cancelText="Batal"
          confirmVariant="danger"
          loading={voidLoading}
          onCancel={() => {
            setShowVoidDialog(false);
            setVoidReason('');
          }}
          onConfirm={handleVoidOrder}
          details={[
            { label: 'Nomor Nota', value: selectedOrder.order_number },
            {
              label: 'Total Tagihan',
              value: `Rp ${selectedOrder.grand_total.toLocaleString('id-ID')}`,
            },
            {
              label: 'Pelanggan',
              value: selectedOrder.customer_name || 'Pelanggan Walk-in',
            },
            {
              label: 'Waktu Transaksi',
              value: new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topFilterContainer: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
  },
  clearBtn: {
    position: 'absolute',
    right: 76,
    padding: 8,
  },
  clearText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  searchBtn: {
    backgroundColor: '#2563eb',
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
  shiftCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    padding: 12,
  },
  shiftTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 6,
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shiftLabel: {
    fontSize: 11,
    color: '#3b82f6',
  },
  shiftValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e3a8a',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 40,
  },
  txCard: {
    marginVertical: 4,
    padding: 12,
  },
  txCardVoid: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  textStrike: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  txTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemsCount: {
    fontSize: 12,
    color: '#475569',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    maxHeight: '85%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailOrderNo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  detailScroll: {
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  notesText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  itemSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    marginVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563eb',
  },
  detailActionRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});

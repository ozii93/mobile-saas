/**
 * Courier Deliveries & Pickups Screen
 * Manages pickup & delivery task assignments for couriers
 */

import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../src/common/state/auth-context';
import { laundryClient } from '../../src/products/laundry/client';
import { syntheticLaundryAdapter } from '../../src/products/laundry/fixture';
import { LaundryDeliveryTask } from '../../src/products/laundry/types';
import { Badge, Button, Card, LoadingScreen } from '../../src/common/components';

export default function LaundryDeliveriesScreen() {
  const { activeContext, productSession } = useAuth();
  const [tasks, setTasks] = useState<LaundryDeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    if (!activeContext) return;
    try {
      if (productSession?.isSynthetic) {
        const d = await syntheticLaundryAdapter.getDeliveries();
        setTasks(d);
      } else {
        const d = await laundryClient.getDeliveries(activeContext.tenant_id, activeContext.branch_id);
        setTasks(d);
      }
    } catch {
      const synth = await syntheticLaundryAdapter.getDeliveries();
      setTasks(synth);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeContext, productSession]);

  const handleUpdateStatus = (taskId: string, newStatus: LaundryDeliveryTask['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    alert(`Status tugas berhasil diubah menjadi: ${newStatus}`);
  };

  if (loading) {
    return <LoadingScreen message="Memuat tugas antar-jemput kurir..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Tidak ada tugas kurir</Text>
            <Text style={styles.emptySubtitle}>Semua penugasan antar atau jemput telah selesai.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.taskCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.taskType}>
                  {item.type === 'pickup' ? '📦 Jemput Cucian Kotor' : '🛵 Antar Cucian Bersih'}
                </Text>
                <Text style={styles.orderRef}>Ref Order: #{item.order_number}</Text>
              </View>
              <Badge
                label={item.status.toUpperCase()}
                variant={
                  item.status === 'completed'
                    ? 'success'
                    : item.status === 'in_progress'
                    ? 'warning'
                    : item.status === 'failed'
                    ? 'danger'
                    : 'info'
                }
              />
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.customerName}>{item.customer_name} ({item.customer_phone})</Text>
              <Text style={styles.addressText}>{item.address}</Text>
              {item.notes ? <Text style={styles.notesText}>Catatan: {item.notes}</Text> : null}
            </View>

            <View style={styles.actionsRow}>
              {item.status === 'assigned' && (
                <Button
                  title="Mulai Jalan"
                  variant="primary"
                  onPress={() => handleUpdateStatus(item.id, 'in_progress')}
                  style={styles.actionBtn}
                />
              )}
              {item.status === 'in_progress' && (
                <>
                  <Button
                    title="Selesai Diantar"
                    variant="primary"
                    onPress={() => handleUpdateStatus(item.id, 'completed')}
                    style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                  />
                  <Button
                    title="Gagal"
                    variant="danger"
                    onPress={() => handleUpdateStatus(item.id, 'failed')}
                    style={styles.actionBtn}
                  />
                </>
              )}
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  taskCard: {
    marginVertical: 6,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderRef: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  cardBody: {
    paddingVertical: 6,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  addressText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  notesText: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    minHeight: 38,
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
  },
});

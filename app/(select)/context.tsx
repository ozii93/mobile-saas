/**
 * Context Selector Screen
 * Allows user to pick Tenant, Product (POS / Laundry), and Branch based on verified grants
 * Shows disabled badges for expired / pending provisioning products
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { ActiveContext, EffectiveBranch, EffectiveProduct, EffectiveTenant } from '../../src/core/types';
import { Badge, Button, Card, HeaderBar, LoadingScreen } from '../../src/common/components';

export default function ContextSelectorScreen() {
  const router = useRouter();
  const { directory, identity, status, selectContext, logout, refreshAccess } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<EffectiveTenant | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<EffectiveProduct | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  if (status === 'exchanging_product_session' || loadingContext) {
    return <LoadingScreen message="Menukarkan tiket sesi ke backend produk terpilih..." />;
  }

  const tenants = directory?.tenants || [];

  const handleBranchSelect = async (tenant: EffectiveTenant, product: EffectiveProduct, branch: EffectiveBranch) => {
    setLoadingContext(true);
    try {
      const activeCtx: ActiveContext = {
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.name,
        product_code: product.product_code as 'pos' | 'laundry',
        branch_id: branch.branch_id,
        branch_name: branch.name,
        role: tenant.role,
      };

      await selectContext(activeCtx);
      router.replace('/');
    } catch {
      // Error ditangani di context state
    } finally {
      setLoadingContext(false);
    }
  };

  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'available':
        return <Badge label="Aktif" variant="success" />;
      case 'subscription_expired':
        return <Badge label="Langganan Berakhir (402)" variant="danger" />;
      case 'provisioning_pending':
        return <Badge label="Sedang Disiapkan (409)" variant="warning" />;
      case 'product_unavailable':
        return <Badge label="Tidak Aktif" variant="neutral" />;
      case 'branch_unavailable':
        return <Badge label="Cabang Tidak Tersedia" variant="warning" />;
      default:
        return <Badge label={availability} variant="neutral" />;
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Pilih Konteks Operasional"
        subtitle={identity?.name || 'Pelanggan'}
        onLogout={() => logout(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.introBox}>
          <Text style={styles.introTitle}>Selamat datang, {identity?.name}</Text>
          <Text style={styles.introText}>
            Pilih cabang dan produk yang ingin Anda kelola. Hak akses disesuaikan dengan grant terverifikasi server.
          </Text>
        </View>

        {tenants.map((tenant) => {
          const isTenantExpanded = selectedTenant?.tenant_id === tenant.tenant_id || tenants.length === 1;

          return (
            <Card key={tenant.tenant_id} style={styles.tenantCard}>
              <TouchableOpacity
                onPress={() => setSelectedTenant(isTenantExpanded && tenants.length > 1 ? null : tenant)}
                style={styles.tenantHeader}
              >
                <View>
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  <Text style={styles.tenantRole}>Peran: {tenant.role === 'owner' ? 'Pemilik Usaha (Owner)' : 'Staf / Kasir'}</Text>
                </View>
                <Badge
                  label={tenant.role === 'owner' ? 'Owner' : 'Staf'}
                  variant={tenant.role === 'owner' ? 'info' : 'neutral'}
                />
              </TouchableOpacity>

              {isTenantExpanded && (
                <View style={styles.productsList}>
                  <Text style={styles.sectionLabel}>Produk Tersedia:</Text>

                  {tenant.products.map((product) => {
                    const isAvailable = product.availability === 'available' && product.branches.length > 0;
                    const isProductActive = selectedProduct?.grant_id === product.grant_id;
                    const productName = product.product_code.toUpperCase() === 'POS' ? 'Point of Sale (POS)' : 'SIAP Laundry';

                    return (
                      <View key={product.grant_id} style={styles.productBlock}>
                        <View style={styles.productRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.productTitle}>{productName}</Text>
                            <Text style={styles.productScope}>Cakupan Cabang: {product.branch_scope === 'all' ? 'Semua Cabang' : 'Cabang Terpilih'}</Text>
                          </View>
                          {getAvailabilityBadge(product.availability)}
                        </View>

                        {isAvailable ? (
                          <View style={styles.branchesBox}>
                            <Text style={styles.branchesLabel}>Pilih Cabang Operasional:</Text>
                            <View style={styles.branchButtonsGrid}>
                              {product.branches.map((branch) => (
                                <Button
                                  key={branch.branch_id}
                                  title={`Outlet ${branch.name}`}
                                  variant="outline"
                                  onPress={() => handleBranchSelect(tenant, product, branch)}
                                  style={styles.branchButton}
                                />
                              ))}
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.disabledNotice}>
                            Produk ini tidak dapat dibuka saat ini.
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}

        <Button
          title="Muat Ulang Hak Akses"
          variant="outline"
          onPress={refreshAccess}
          style={styles.refreshBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  introBox: {
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  introText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  tenantCard: {
    marginBottom: 16,
  },
  tenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  tenantRole: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  productsList: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  productBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  productScope: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  branchesBox: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  branchesLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  branchButtonsGrid: {
    gap: 8,
  },
  branchButton: {
    backgroundColor: '#ffffff',
    justifyContent: 'flex-start',
    paddingVertical: 10,
  },
  disabledNotice: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 6,
  },
  refreshBtn: {
    marginTop: 12,
  },
});

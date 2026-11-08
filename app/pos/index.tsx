/**
 * POS Catalog & Sales Terminal Screen
 * Loads live catalog and categories via posClient with fallback to synthetic adapter
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { posClient } from '../../src/products/pos/client';
import { syntheticPosAdapter } from '../../src/products/pos/fixture';
import { PosCategoryItem, PosProductItem } from '../../src/products/pos/types';
import { posCartStore } from '../../src/products/pos/cart-state';
import { Badge, Button, Card, LoadingScreen } from '../../src/common/components';

export default function PosCatalogScreen() {
  const router = useRouter();
  const { activeContext, productSession } = useAuth();
  const [catalog, setCatalog] = useState<PosProductItem[]>([]);
  const [categories, setCategories] = useState<PosCategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  const loadData = useCallback(async () => {
    if (!activeContext) return;
    try {
      if (productSession?.isSynthetic) {
        const [cats, prods] = await Promise.all([
          syntheticPosAdapter.getCategories(),
          syntheticPosAdapter.getProducts(),
        ]);
        setCategories(cats);
        setCatalog(prods);
      } else {
        const [cats, prods] = await Promise.all([
          posClient.getCategories(activeContext.tenant_id, activeContext.branch_id),
          posClient.getProducts(activeContext.tenant_id, activeContext.branch_id),
        ]);
        setCategories(cats);
        setCatalog(prods);
      }
    } catch {
      // Fallback ke fixture jika backend POS belum merespons
      const [cats, prods] = await Promise.all([
        syntheticPosAdapter.getCategories(),
        syntheticPosAdapter.getProducts(),
      ]);
      setCategories(cats);
      setCatalog(prods);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeContext, productSession]);

  useEffect(() => {
    loadData();

    const unsubscribe = posCartStore.subscribe(() => {
      setCartCount(posCartStore.getItemCount());
      setCartTotal(posCartStore.getTotal());
    });

    setCartCount(posCartStore.getItemCount());
    setCartTotal(posCartStore.getTotal());

    return unsubscribe;
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredItems = catalog.filter((item) => {
    if (selectedCategoryId === 'all') return true;
    return item.category?.id === selectedCategoryId;
  });

  const handleAddToCart = (product: PosProductItem) => {
    posCartStore.addItem(product, 1);
  };

  if (loading) {
    return <LoadingScreen message="Memuat katalog POS..." />;
  }

  return (
    <View style={styles.container}>
      {/* Synthetic Notice Banner only if isSynthetic is true */}
      {productSession?.isSynthetic ? (
        <View style={styles.syntheticNotice}>
          <Text style={styles.syntheticNoticeText}>
            ⚠️ Menggunakan mode [FIXTURE SYNTHETIC] (koneksi offline / simulasi).
          </Text>
        </View>
      ) : null}

      {/* Category Chips */}
      <View style={styles.categoryRow}>
        <TouchableOpacity
          onPress={() => setSelectedCategoryId('all')}
          style={[styles.catChip, selectedCategoryId === 'all' && styles.catChipActive]}
        >
          <Text style={[styles.catChipText, selectedCategoryId === 'all' && styles.catChipTextActive]}>
            Semua
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedCategoryId(cat.id)}
            style={[styles.catChip, selectedCategoryId === cat.id && styles.catChipActive]}
          >
            <Text style={[styles.catChipText, selectedCategoryId === cat.id && styles.catChipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Product Catalog Grid */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.gridContent}
        numColumns={2}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleAddToCart(item)}
            style={styles.gridItemWrapper}
          >
            <Card style={styles.productCard}>
              <View style={styles.cardTop}>
                <Badge label={item.category?.name || 'Umum'} variant="neutral" />
                <Text style={styles.stockLabel}>Stok: {item.current_stock}</Text>
              </View>

              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.skuText}>{item.sku}</Text>

              <View style={styles.cardBottom}>
                <Text style={styles.priceText}>Rp {item.selling_price.toLocaleString('id-ID')}</Text>
                <View style={styles.addBadge}>
                  <Text style={styles.addBadgeText}>+ Tambah</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      {/* Floating Cart Bar */}
      {cartCount > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartBarCount}>{cartCount} Item di Keranjang</Text>
            <Text style={styles.cartBarTotal}>Rp {cartTotal.toLocaleString('id-ID')}</Text>
          </View>
          <Button
            title="Lihat Keranjang & Bayar →"
            onPress={() => router.push('/pos/cart')}
            style={styles.cartBarBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  syntheticNotice: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  syntheticNoticeText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  catChipActive: {
    backgroundColor: '#2563eb',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  catChipTextActive: {
    color: '#ffffff',
  },
  gridContent: {
    padding: 8,
    paddingBottom: 90,
  },
  gridItemWrapper: {
    flex: 0.5,
    padding: 4,
  },
  productCard: {
    marginVertical: 4,
    padding: 12,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 17,
  },
  skuText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  addBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  cartBarCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cartBarTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  cartBarBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 40,
  },
});

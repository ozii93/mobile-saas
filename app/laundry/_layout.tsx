/**
 * Laundry Module Shell Layout
 * Displays top header bar with Tenant & Branch context, switch context action, and navigation tabs
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useAuth } from '../../src/common/state/auth-context';
import { HeaderBar } from '../../src/common/components';

export default function LaundryLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeContext, productSession, switchContext, logout } = useAuth();

  const isTabActive = (route: string) => {
    return pathname === route;
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="SIAP Laundry"
        subtitle={`${activeContext?.tenant_name || 'Laundry'} • ${activeContext?.branch_name || 'Cabang'}`}
        onSwitchContext={switchContext}
        onLogout={() => logout(false)}
        isSynthetic={productSession?.isSynthetic}
      />

      {/* Navigation Sub-Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => router.replace('/laundry')}
          style={[styles.tabItem, isTabActive('/laundry') && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, isTabActive('/laundry') && styles.tabTextActive]}>
            Pesanan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/laundry/create')}
          style={[styles.tabItem, isTabActive('/laundry/create') && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, isTabActive('/laundry/create') && styles.tabTextActive]}>
            + Order Baru
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/laundry/deliveries')}
          style={[styles.tabItem, isTabActive('/laundry/deliveries') && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, isTabActive('/laundry/deliveries') && styles.tabTextActive]}>
            Kurir / Antar
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
  },
});

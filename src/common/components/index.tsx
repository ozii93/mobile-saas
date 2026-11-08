/**
 * Reusable Common UI Primitives
 * Conforms to engineering standards: loading states, double tap prevention, error states,
 * confirmation modal with processing lock, and pagination controls.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

// --- BUTTON COMPONENT ---
interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  ...props
}) => {
  const getBackgroundColor = () => {
    if (disabled || loading) return '#94a3b8';
    switch (variant) {
      case 'secondary':
        return '#475569';
      case 'danger':
        return '#ef4444';
      case 'outline':
        return 'transparent';
      case 'primary':
      default:
        return '#2563eb';
    }
  };

  const getTextColor = () => {
    if (variant === 'outline') return '#2563eb';
    return '#ffffff';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: '#2563eb',
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: getTextColor() }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

// --- INPUT COMPONENT ---
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
  return (
    <View style={styles.inputContainer}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// --- CARD COMPONENT ---
export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

// --- BADGE COMPONENT ---
export const Badge: React.FC<{
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}> = ({ label, variant = 'info' }) => {
  const getStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: '#dcfce7', text: '#15803d' };
      case 'warning':
        return { bg: '#fef3c7', text: '#b45309' };
      case 'danger':
        return { bg: '#fee2e2', text: '#b91c1c' };
      case 'neutral':
        return { bg: '#f1f5f9', text: '#475569' };
      case 'info':
      default:
        return { bg: '#e0f2fe', text: '#0369a1' };
    }
  };

  const s = getStyles();

  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>{label}</Text>
    </View>
  );
};

// --- CONFIRMATION MODAL WITH PROCESSING LOCK (PLAN-002 STANDARD) ---
export interface ConfirmDetailItem {
  label: string;
  value: string;
  isBold?: boolean;
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  details?: ConfirmDetailItem[];
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  details = [],
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.confirmModalContent}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>

          {details.length > 0 && (
            <View style={styles.confirmDetailsBox}>
              {details.map((d, idx) => (
                <View key={idx} style={styles.confirmDetailRow}>
                  <Text style={styles.confirmDetailLabel}>{d.label}:</Text>
                  <Text
                    style={[
                      styles.confirmDetailValue,
                      d.isBold ? styles.confirmDetailBold : null,
                    ]}
                  >
                    {d.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.confirmActionsRow}>
            <Button
              title={cancelText}
              variant="outline"
              disabled={loading}
              onPress={onCancel}
              style={styles.confirmBtn}
            />
            <Button
              title={confirmText}
              variant={confirmVariant}
              loading={loading}
              onPress={onConfirm}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- PAGINATION BAR COMPONENT ---
interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  totalItems,
  onPrevPage,
  onNextPage,
  onPageChange,
  disabled = false,
}) => {
  const handlePrev = () => {
    if (onPrevPage) {
      onPrevPage();
    } else if (onPageChange && currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (onNextPage) {
      onNextPage();
    } else if (onPageChange && currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <View style={styles.paginationBar}>
      <TouchableOpacity
        onPress={handlePrev}
        disabled={disabled || currentPage <= 1}
        style={[styles.pageBtn, (disabled || currentPage <= 1) && styles.pageBtnDisabled]}
      >
        <Text style={[styles.pageBtnText, (disabled || currentPage <= 1) && styles.pageBtnTextDisabled]}>
          ← Sebelumnya
        </Text>
      </TouchableOpacity>

      <View style={styles.pageInfo}>
        <Text style={styles.pageInfoText}>
          Hal {currentPage} dari {Math.max(1, totalPages)}
        </Text>
        {totalItems !== undefined && (
          <Text style={styles.pageItemsCount}>({totalItems} total data)</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={handleNext}
        disabled={disabled || currentPage >= totalPages}
        style={[styles.pageBtn, (disabled || currentPage >= totalPages) && styles.pageBtnDisabled]}
      >
        <Text style={[styles.pageBtnText, (disabled || currentPage >= totalPages) && styles.pageBtnTextDisabled]}>
          Selanjutnya →
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- LOADING SCREEN ---
export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Memuat...' }) => {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
};

// --- ERROR STATE ---
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
  onLogout?: () => void;
}> = ({ title = 'Terjadi Gangguan', message, requestId, onRetry, onLogout }) => {
  return (
    <View style={styles.centerContainer}>
      <Card style={styles.errorCard}>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorMessage}>{message}</Text>
        {requestId ? <Text style={styles.errorReqId}>Request ID: {requestId}</Text> : null}

        <View style={styles.actionRow}>
          {onRetry ? (
            <Button title="Coba Lagi" onPress={onRetry} style={styles.actionBtn} />
          ) : null}
          {onLogout ? (
            <Button
              title="Keluar / Ganti Akun"
              variant="outline"
              onPress={onLogout}
              style={styles.actionBtn}
            />
          ) : null}
        </View>
      </Card>
    </View>
  );
};

// --- TOP HEADER BAR ---
export const HeaderBar: React.FC<{
  title: string;
  subtitle?: string;
  onSwitchContext?: () => void;
  onLogout?: () => void;
  isSynthetic?: boolean;
}> = ({ title, subtitle, onSwitchContext, onLogout, isSynthetic }) => {
  return (
    <View style={styles.headerBar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        {isSynthetic ? (
          <Badge label="[FIXTURE SYNTHETIC]" variant="warning" />
        ) : null}
      </View>
      <View style={styles.headerActions}>
        {onSwitchContext ? (
          <TouchableOpacity onPress={onSwitchContext} style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>Ganti Cabang</Text>
          </TouchableOpacity>
        ) : null}
        {onLogout ? (
          <TouchableOpacity onPress={onLogout} style={[styles.headerIconBtn, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.headerIconText, { color: '#dc2626' }]}>Keluar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  errorReqId: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 16,
  },
  actionRow: {
    width: '100%',
    gap: 10,
  },
  actionBtn: {
    width: '100%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  headerIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  confirmMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  confirmDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  confirmDetailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  confirmDetailValue: {
    fontSize: 12,
    color: '#1e293b',
  },
  confirmDetailBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    flex: 1,
    minHeight: 42,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  pageBtnDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageInfo: {
    alignItems: 'center',
  },
  pageInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  pageItemsCount: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
});

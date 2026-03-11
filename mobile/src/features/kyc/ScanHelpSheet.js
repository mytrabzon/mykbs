import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

export default function ScanHelpSheet({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Okuma ipuçları</Text>
            <TouchableOpacity onPress={onClose} hitSlop={16} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Item icon="flash-outline" text="Karanlıkta flaş kullanın." />
            <Item icon="sunny-outline" text="Yansıma MRZ üzerine gelmesin." />
            <Item icon="document-text-outline" text="Belgeyi düz tutun, çizgiler net görünsün." />
            <Item icon="barcode-outline" text="Türkiye Cumhuriyeti kimlik kartı: arka yüzde 3 satır MRZ; pasaport: 2 satır MRZ." />
          </View>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Tamam</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Item({ icon, text }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemIconWrap}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: 0.2 },
  closeBtn: { padding: 4 },
  card: {
    backgroundColor: theme.colors.background || '#F5F5F5',
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  list: { marginBottom: theme.spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  itemIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  itemText: { marginLeft: theme.spacing.base, fontSize: 15, color: theme.colors.textSecondary, flex: 1, fontWeight: '500' },
  button: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

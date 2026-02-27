import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

export default function ScanHelpSheet({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Okuma ipuçları</Text>
            <TouchableOpacity onPress={onClose} hitSlop={16}>
              <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.list}>
            <Item icon="flash-outline" text="Karanlıkta: Flaş (torch) açın; ekrandaki flaş düğmesini kullanın" />
            <Item icon="sunny-outline" text="Aydınlıkta: Doğrudan güneş/yansıma MRZ üzerine gelmesin" />
            <Item icon="document-text-outline" text="Belgeyi düz tutun, MRZ çizgileri net görünsün" />
            <Item icon="scan-outline" text="Çerçeve MRZ alanını tam içine alsın" />
            <Item icon="hand-left-outline" text="Gölge veya parmak MRZ üzerine düşmesin" />
          </View>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Item({ icon, text }) {
  return (
    <View style={styles.item}>
      <Ionicons name={icon} size={24} color={theme.colors.primary} />
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: theme.spacing.lg, paddingBottom: theme.spacing.xl + 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.textPrimary },
  list: { marginBottom: theme.spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.base },
  itemText: { marginLeft: theme.spacing.base, fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, flex: 1 },
  button: { ...theme.styles.button.primary },
  buttonText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold },
});

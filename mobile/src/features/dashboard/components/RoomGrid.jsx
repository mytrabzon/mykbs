/**
 * Oda grid — büyük kartlar, KBS Prime B2B renk paleti (COLORS)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../theme/colors';

const statusColors = {
  dolu: COLORS.roomOccupied,
  bos: COLORS.roomAvailable,
  temizlik: COLORS.roomCleaning,
  bakim: COLORS.roomMaintenance,
};

export function RoomCard({ room, onMrz, onAction }) {
  const statusColor = statusColors[room.durum] || COLORS.roomMaintenance;
  const durumLabel = { dolu: 'Dolu', bos: 'Boş', temizlik: 'Temizlik', bakim: 'Bakım' }[room.durum] || room.durum;

  return (
    <View style={[styles.card, { borderLeftColor: statusColor }]}>
      <View style={styles.header}>
        <Text style={styles.roomNumber}>{room.oda_no ?? room.odaNumarasi}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{durumLabel}</Text>
        </View>
      </View>
      {room.misafir && (
        <View style={styles.guestInfo}>
          <Text style={styles.guestName}>{room.misafir.ad_soyad ?? [room.misafir.ad, room.misafir.soyad].filter(Boolean).join(' ')}</Text>
          <Text style={styles.guestDetail}>
            {room.misafir.belge_tipi ?? 'Belge'} · {room.misafir.belge_no ?? '—'}
          </Text>
          {room.misafir.cikis_saati && (
            <Text style={styles.checkout}>Çıkış: {room.misafir.cikis_saati}</Text>
          )}
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onMrz?.(room)}>
          <Ionicons name="camera" size={20} color={COLORS.text} />
          <Text style={styles.actionText}>MRZ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onAction?.(room)}>
          <Ionicons name="person" size={20} color={COLORS.text} />
          <Text style={styles.actionText}>İşlem</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RoomGrid({ rooms = [], onRoomPress, onMrzPress }) {
  return (
    <View style={styles.grid}>
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          onMrz={onMrzPress}
          onAction={onRoomPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '100%',
    minWidth: 160,
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    ...Platform?.select?.({ ios: { shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) || {},
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  guestInfo: {
    marginBottom: 10,
  },
  guestName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  guestDetail: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  checkout: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
});

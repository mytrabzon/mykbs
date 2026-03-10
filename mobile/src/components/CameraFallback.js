import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

/**
 * Kamera açılamadığında gösterilen fallback: Galeriden seç veya uygulamayı yeniden başlat.
 */
export function CameraFallback({ onImageSelected, onRetry }) {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      onImageSelected?.(result.assets[0]);
    }
  };

  return (
    <View style={styles.fallbackContainer}>
      <Ionicons name="camera-outline" size={50} color="#EF4444" />
      <Text style={styles.fallbackTitle}>Kamera Açılamadı</Text>
      <Text style={styles.fallbackText}>
        Galeriden bir görsel seçin veya uygulamayı yeniden başlatın
      </Text>

      <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
        <Text style={styles.pickButtonText}>Galeriden Seç</Text>
      </TouchableOpacity>

      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A1929',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 28,
  },
  pickButton: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

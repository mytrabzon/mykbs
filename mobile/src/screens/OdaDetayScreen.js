import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';
import { dataService } from '../services/dataService';
import Toast from 'react-native-toast-message';

export default function OdaDetayScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { odaId } = route.params;
  const [oda, setOda] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOdaDetay();
  }, []);

  const loadOdaDetay = async () => {
    try {
      const response = await api.get(`/oda/${odaId}`);
      setOda(response.data.oda);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Oda bilgisi yüklenemedi'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    if (!oda?.misafirler?.[0]) {
      Alert.alert('Hata', 'Bu odada aktif misafir yok');
      return;
    }

    Alert.alert(
      'Çıkış Yap',
      'Misafir çıkışını yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          onPress: async () => {
            try {
              await api.post(`/misafir/checkout/${oda.misafirler[0].id}`);
              Toast.show({
                type: 'success',
                text1: 'Başarılı',
                text2: 'Çıkış yapıldı'
              });
              navigation.goBack();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Hata',
                text2: 'Çıkış yapılamadı'
              });
            }
          }
        }
      ]
    );
  };

  const handleDeleteOda = () => {
    const hasMisafir = oda?.misafirler?.length > 0 && oda.misafirler.some(m => !m.cikisTarihi);
    if (hasMisafir) {
      Alert.alert('Silinemez', 'Dolu oda silinemez. Önce misafir çıkışı yapın.');
      return;
    }
    Alert.alert(
      'Odayı Sil',
      `"Oda ${oda.odaNumarasi}" kalıcı olarak silinecek. Emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
            onPress: async () => {
            try {
              await api.delete(`/oda/${odaId}`);
              dataService.clearCache().catch(() => {});
              Toast.show({ type: 'success', text1: 'Oda silindi' });
              navigation.goBack();
            } catch (err) {
              const msg = err?.response?.data?.message || err?.message || 'Oda silinemedi';
              Toast.show({ type: 'error', text1: 'Hata', text2: msg });
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  if (!oda) {
    return (
      <View style={styles.center}>
        <Text>Oda bulunamadı</Text>
      </View>
    );
  }

  const misafir = oda.misafirler?.[0];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Oda {oda.odaNumarasi}</Text>
        <Text style={styles.subtitle}>{oda.odaTipi} - {oda.kapasite} Kişi</Text>

        {misafir ? (
          <View style={styles.misafirCard}>
            <Text style={styles.cardTitle}>Misafir Bilgileri</Text>
            <Text style={styles.infoText}>Ad: {misafir.ad}</Text>
            <Text style={styles.infoText}>Soyad: {misafir.soyad}</Text>
            <Text style={styles.infoText}>
              Giriş: {new Date(misafir.girisTarihi).toLocaleDateString('tr-TR')}
            </Text>

            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={handleCheckout}
            >
              <Text style={styles.checkoutButtonText}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Oda Boş</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.deleteButton, (oda?.misafirler?.length > 0 && oda.misafirler.some(m => !m.cikisTarihi)) && styles.deleteButtonDisabled]}
          onPress={handleDeleteOda}
          disabled={!!(oda?.misafirler?.length > 0 && oda.misafirler.some(m => !m.cikisTarihi))}
        >
          <Text style={styles.deleteButtonText}>Odayı Sil</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20
  },
  misafirCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333'
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10
  },
  checkoutButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24
  },
  deleteButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.7
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  }
});


import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme } from '../../theme';

/**
 * MRZ minimal payload onayı sonrası server'a gönderim (POST /kyc/mrz-verify).
 * Roadmap: verification_id, status, next döner.
 */
export default function KycSubmitScreen({ route, navigation }) {
  const minimal = route?.params?.minimal ?? null;
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!minimal) return;
    setLoading(true);
    try {
      const { data } = await require('../../services/api').api.post('/kyc/mrz-verify', minimal);
      setDone(true);
      if (data?.next === 'DONE') navigation.replace('Main');
      else navigation.replace('Main');
    } catch (e) {
      setLoading(false);
    }
  };

  if (!minimal) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Veri yok</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doğrulamayı gönder</Text>
      <Text style={styles.subtitle}>Sadece belge no, doğum ve son kullanma tarihi sunucuya iletilecek.</Text>
      {done ? (
        <Text style={styles.done}>Gönderildi.</Text>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Gönder</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.sm },
  subtitle: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl },
  text: { marginBottom: theme.spacing.lg },
  done: { color: theme.colors.success, fontWeight: theme.typography.fontWeight.semibold },
  button: { ...theme.styles.button.primary, marginTop: theme.spacing.base },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
});

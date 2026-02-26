import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

/**
 * Manuel giriş fallback – sadece pasaport no, doğum, son kullanma (NFC için).
 * Roadmap: MRZ yoksa bile ilerleyebilsin.
 */
export default function KycManualEntryScreen({ navigation }) {
  const [passportNumber, setPassportNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const handleContinue = () => {
    const minimal = {
      passportNumber: passportNumber.trim(),
      birthDate: birthDate.trim(),
      expiryDate: expiryDate.trim(),
      issuingCountry: '',
      docType: 'OTHER',
    };
    navigation.replace('KycSubmit', { minimal, fromMrz: false });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manuel giriş</Text>
      <Text style={styles.subtitle}>NFC için belge no, doğum ve son kullanma tarihi (YYMMDD veya YYYY-MM-DD).</Text>
      <TextInput style={styles.input} placeholder="Belge numarası" value={passportNumber} onChangeText={setPassportNumber} autoCapitalize="characters" />
      <TextInput style={styles.input} placeholder="Doğum tarihi (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
      <TextInput style={styles.input} placeholder="Son kullanma (YYYY-MM-DD)" value={expiryDate} onChangeText={setExpiryDate} />
      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Devam et</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.sm },
  subtitle: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl },
  input: { ...theme.styles.input, marginBottom: theme.spacing.base },
  button: { ...theme.styles.button.primary, marginTop: theme.spacing.lg },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
});

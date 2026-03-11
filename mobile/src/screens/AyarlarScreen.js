import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api, getBackendUrl } from '../services/api';
import { supabase } from '../lib/supabase/supabase';
import { dataService } from '../services/dataService';
import { backendHealth } from '../services/backendHealth';
import { getApiBaseUrl, isSupabaseConfigured } from '../config/api';
import { getNfcEnabled, setNfcEnabled } from '../utils/nfcSetting';
import { getTtsEnabled, setTtsEnabled, getHapticEnabled, setHapticEnabled, loadFeedbackSettings } from '../utils/feedback';
import { useLanguage } from '../context/LanguageContext';
import { exportGuestsToExcel } from '../utils/exportExcel';
import { createBackup } from '../utils/backup';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Button, Banner, SegmentedControl, Input } from '../components/ui';
import { typography, spacing } from '../theme';
import AppHeader from '../components/AppHeader';

const PROFILE_SAVE_TIMEOUT_MS = 30000;
function withTimeout(promise, ms, msg = 'İstek zaman aşımına uğradı') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

export default function AyarlarScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { logout, tesis, user, setTesis, token, getSupabaseToken, refreshMe } = useAuth();
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [tesisDetail, setTesisDetail] = useState(null);
  const [tesisAdiEdit, setTesisAdiEdit] = useState('');
  const [tesisAdiSaving, setTesisAdiSaving] = useState(false);
  const canEditTesis = user?.yetkiler?.bilgiDuzenleme === true;
  const [kbsSettings, setKbsSettings] = useState({
    kbsTuru: '',
    kbsTesisKodu: '',
    kbsWebServisSifre: '',
    ipKisitAktif: false,
  });
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sifreValue, setSifreValue] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [sifreLoading, setSifreLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ configured: false, isOnline: false, error: null });
  const [supabaseStatus, setSupabaseStatus] = useState({ configured: false, isOnline: false, error: null });
  const [credentialState, setCredentialState] = useState(null);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [changeTesisKodu, setChangeTesisKodu] = useState('');
  const [changeSifre, setChangeSifre] = useState('');
  const [kbsImportLoading, setKbsImportLoading] = useState(false);
  const [kbsImportResult, setKbsImportResult] = useState(null);
  const [kbsServerIp, setKbsServerIp] = useState(null);
  const [okutulanBelgeler, setOkutulanBelgeler] = useState([]);
  const [okutulanBelgelerLoading, setOkutulanBelgelerLoading] = useState(false);
  const [okutulanBelgeDetail, setOkutulanBelgeDetail] = useState(null);
  const [nfcEnabled, setNfcEnabledState] = useState(false);
  const [ttsEnabled, setTtsEnabledState] = useState(true);
  const [hapticEnabled, setHapticEnabledState] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const { language, setLanguage, t, languageLabels } = useLanguage();
  const settingsLoadedRef = useRef(false);
  // Profil (birleştirilmiş profil düzenleme)
  const [displayName, setDisplayName] = useState(() => (user?.adSoyad || '').trim());
  const [title, setTitle] = useState('');
  const [telefon, setTelefon] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUrlTs, setAvatarUrlTs] = useState(0);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const loadOkutulanBelgeler = async () => {
    setOkutulanBelgelerLoading(true);
    try {
      const res = await api.get('/okutulan-belgeler?limit=50');
      setOkutulanBelgeler(res.data?.items ?? []);
    } catch (_) {
      setOkutulanBelgeler([]);
    } finally {
      setOkutulanBelgelerLoading(false);
    }
  };

  const loadCredentialStatus = async () => {
    try {
      const res = await api.get('/kbs/credentials/status');
      setCredentialState(res.data?.state ?? 'NONE');
    } catch (_) {
      setCredentialState(null);
    }
  };

  const loadKbsServerIp = async () => {
    try {
      const res = await api.get('/tesis/kbs/server-ip');
      setKbsServerIp(res.data?.serverIp ?? null);
    } catch (_) {
      setKbsServerIp(null);
    }
  };

  useEffect(() => {
    getNfcEnabled().then(setNfcEnabledState);
    loadFeedbackSettings().then(() => {
      setTtsEnabledState(getTtsEnabled());
      setHapticEnabledState(getHapticEnabled());
    });
  }, []);

  // Tek seferde tüm ayar verilerini yükle (429 rate limit önlemi: aynı anda 4+ istek yerine tek batch)
  useEffect(() => {
    if (!token) {
      settingsLoadedRef.current = false;
      return;
    }
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    setLoading(true);
    const loadAll = async () => {
      try {
        await Promise.all([
          loadKBSSettings(),
          loadCredentialStatus(),
          loadKbsServerIp(),
          loadOkutulanBelgeler(),
        ]);
        dataService.getTesis(true).then((t) => setTesisDetail(t)).catch(() => {});
      } catch (e) {
        console.error('Ayarlar veri yüklenemedi:', e);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [token]);

  useEffect(() => {
    const backendUrl = getApiBaseUrl();
    const supabaseCfg = isSupabaseConfigured();
    setBackendStatus((prev) => ({ ...prev, configured: !!backendUrl }));
    setSupabaseStatus((prev) => ({ ...prev, configured: supabaseCfg }));

    const updateBackend = (status) => setBackendStatus({ configured: !!backendUrl, isOnline: status.isOnline, error: status.error });
    const updateSupabase = (status) => setSupabaseStatus({ configured: status.configured, isOnline: status.isOnline, error: status.error });

    backendHealth.checkHealth().then(updateBackend);
    if (supabaseCfg) backendHealth.checkSupabaseHealth().then(updateSupabase);

    const unsubBackend = backendHealth.onStatusChange(updateBackend);
    const unsubSupabase = backendHealth.onSupabaseStatusChange(updateSupabase);
    return () => {
      if (typeof unsubBackend === 'function') unsubBackend();
      if (typeof unsubSupabase === 'function') unsubSupabase();
    };
  }, []);

  useEffect(() => {
    if (tesis?.tesisAdi != null && tesisAdiEdit === '') setTesisAdiEdit(tesis.tesisAdi);
  }, [tesis?.tesisAdi]);

  // Profil verisi yükle (Supabase me veya backend /auth/profile)
  useEffect(() => {
    if (profileLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await getSupabaseToken?.();
        if (t) {
          let me = await withTimeout(communityApi.getMe(t), 6000).catch(() => null);
          if (!me && t) {
            await new Promise((r) => setTimeout(r, 400));
            me = await withTimeout(communityApi.getMe(t), 6000).catch(() => null);
          }
          if (!cancelled && me) {
            setDisplayName((me.display_name || user?.adSoyad || '').trim());
            setTitle(me.title || '');
            setAvatarUrl(me.avatar_url || null);
          }
        } else {
          const res = await withTimeout(api.get('/auth/profile'), 6000).catch(() => null);
          const data = res?.data || {};
          if (!cancelled && (data.display_name != null || data.title != null || data.avatar_url != null || data.telefon != null)) {
            setDisplayName((data.display_name || user?.adSoyad || '').trim());
            setTitle(data.title || '');
            setAvatarUrl(data.avatar_url || null);
            if (data.telefon) setTelefon(String(data.telefon).replace(/^\+\d*/, '').replace(/\D/g, '').replace(/^0?/, '').slice(0, 11) || '');
          }
        }
        if (!cancelled && user?.telefon && user.telefon !== '-') {
          setTelefon((prev) => (prev || String(user.telefon).replace(/^\+\d*/, '').replace(/\D/g, '').replace(/^0?/, '').slice(0, 11) || ''));
        }
      } catch (_) {}
      if (!cancelled) {
        setDisplayName((prev) => prev || (user?.adSoyad || '').trim());
        setProfileLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [profileLoaded, user?.adSoyad, user?.telefon, getSupabaseToken]);

  const handleTesisAdiSave = async () => {
    const name = (tesisAdiEdit && String(tesisAdiEdit).trim()) || '';
    if (!name) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Tesis adı boş olamaz' });
      return;
    }
    setTesisAdiSaving(true);
    try {
      const res = await api.put('/tesis/bilgi', { tesisAdi: name });
      if (res.data?.tesis && setTesis) {
        setTesis({ ...tesis, tesisAdi: res.data.tesis.tesisAdi });
      }
      Toast.show({ type: 'success', text1: 'Kaydedildi', text2: 'Tesis adı güncellendi' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Tesis adı güncellenemedi' });
    } finally {
      setTesisAdiSaving(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri erişimi gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType?.Images ?? 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      let uri = result.assets[0].uri;
      try {
        const Manipulator = require('expo-image-manipulator');
        if (Manipulator?.manipulateAsync) {
          const m = await Manipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.8 });
          if (m?.uri) uri = m.uri;
        }
      } catch (_) {}
      setLocalAvatarUri(uri);
    }
  };

  const handleProfileSave = async () => {
    const backendAvailable = !!getBackendUrl?.();
    const t = await getSupabaseToken?.();
    if (!backendAvailable && !t) {
      Toast.show({ type: 'error', text1: 'Profil düzenleme', text2: 'E-posta veya telefon ile giriş yaparak profil düzenleyebilirsiniz.' });
      return;
    }
    setProfileSaving(true);
    try {
      const body = {
        display_name: (displayName || '').trim() || null,
        title: (title || '').trim() || null,
        telefon: (telefon || '').trim() ? String(telefon).trim().replace(/\D/g, '') : '',
        avatar_url: avatarUrl || null,
      };
      if (localAvatarUri) {
        let base64;
        try {
          base64 = await FileSystem.readAsStringAsync(localAvatarUri, { encoding: FileSystem.EncodingType.Base64 });
        } catch (readErr) {
          if (localAvatarUri.startsWith('content://') || localAvatarUri.startsWith('file://')) {
            try {
              const cachePath = `${FileSystem.cacheDirectory}avatar_${Date.now()}.jpg`;
              await FileSystem.copyAsync({ from: localAvatarUri, to: cachePath });
              base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: FileSystem.EncodingType.Base64 });
              await FileSystem.deleteAsync(cachePath, { idempotent: true });
            } catch (copyErr) {
              Toast.show({ type: 'error', text1: 'Profil resmi okunamadı', text2: 'Görseli tekrar seçin.' });
              setProfileSaving(false);
              return;
            }
          } else {
            Toast.show({ type: 'error', text1: 'Profil resmi okunamadı', text2: readErr?.message || 'Görseli tekrar seçin.' });
            setProfileSaving(false);
            return;
          }
        }
        if (typeof base64 === 'string') base64 = base64.replace(/^data:image\/[^;]+;base64,/i, '').replace(/[^A-Za-z0-9+/=]/g, '');
        if (base64?.length > 0) body.avatar_base64 = base64;
        else {
          Toast.show({ type: 'error', text1: 'Profil resmi boş', text2: 'Başka bir görsel seçin.' });
          setProfileSaving(false);
          return;
        }
      }
      if (backendAvailable) {
        await withTimeout(api.put('/auth/profile', body), PROFILE_SAVE_TIMEOUT_MS, 'Kayıt zaman aşımına uğradı.');
        const res = await api.get('/auth/profile').catch(() => null);
        if (res?.data?.avatar_url) setAvatarUrl(res.data.avatar_url);
      } else {
        let finalAvatarUrl = body.avatar_url;
        if (body.avatar_base64) finalAvatarUrl = await withTimeout(communityApi.uploadAvatar(body.avatar_base64, t), PROFILE_SAVE_TIMEOUT_MS);
        await withTimeout(
          communityApi.updateProfile({ display_name: body.display_name, avatar_url: finalAvatarUrl, title: body.title }, t),
          PROFILE_SAVE_TIMEOUT_MS
        );
        if (finalAvatarUrl) {
          setAvatarUrl(finalAvatarUrl);
          setAvatarUrlTs(Date.now());
        }
      }
      if (localAvatarUri) setLocalAvatarUri(null);
      if (typeof refreshMe === 'function') await refreshMe();
      Toast.show({ type: 'success', text1: 'Profil kaydedildi' });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Kaydedilemedi';
      Toast.show({ type: 'error', text1: 'Kaydedilemedi', text2: msg });
    } finally {
      setProfileSaving(false);
    }
  };

  const loadKBSSettings = async () => {
    try {
      const response = await api.get('/tesis/kbs');
      setKbsSettings((prev) => ({
        ...prev,
        ...response.data,
        kbsWebServisSifre: response.data.kbsWebServisSifre !== undefined && response.data.kbsWebServisSifre !== null
          ? response.data.kbsWebServisSifre
          : prev.kbsWebServisSifre,
      }));
    } catch (e) {
      console.error('KBS ayarları yüklenemedi:', e);
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      if (status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Oturum süresi dolmuş olabilir',
          text2: 'Lütfen tekrar giriş yapın.',
          visibilityTime: 5000,
        });
      } else if (msg) {
        Toast.show({ type: 'error', text1: 'KBS ayarları', text2: msg, visibilityTime: 4000 });
      }
    }
  };

  const handleKBSTest = async () => {
    const kbsTuru = kbsSettings.kbsTuru || 'jandarma';
    const kbsTesisKodu = (kbsSettings.kbsTesisKodu || '').trim();
    const kbsWebServisSifre = kbsSettings.kbsWebServisSifre || '';
    if (!kbsTesisKodu || !kbsWebServisSifre) {
      Toast.show({ type: 'error', text1: 'Eksik alan', text2: 'KBS tesis kodu ve web servis şifresini girin.' });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const response = await api.post('/tesis/kbs/test', {
        kbsTuru,
        kbsTesisKodu,
        kbsWebServisSifre,
      });
      setTestResult(response.data);
      if (response.data.success) {
        Toast.show({ type: 'success', text1: 'Başarılı', text2: 'KBS bağlantısı başarılı' });
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: response.data.message });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || '';
      const isNetwork = /network|fetch|bağlantı|connection|failed/i.test(msg) || (e?.message && !e?.response);
      const userMsg = isNetwork
        ? 'Backend\'e ulaşılamadı. EXPO_PUBLIC_BACKEND_URL ve interneti kontrol edin.'
        : (msg || 'Test başarısız');
      Toast.show({ type: 'error', text1: isNetwork ? 'Bağlantı hatası' : 'Hata', text2: userMsg });
      setTestResult({ success: false, message: userMsg });
    } finally {
      setTestLoading(false);
    }
  };

  const handleKBSImport = async () => {
    const kbsTuru = kbsSettings.kbsTuru || 'jandarma';
    const kbsTesisKodu = (kbsSettings.kbsTesisKodu || '').trim();
    const kbsWebServisSifre = kbsSettings.kbsWebServisSifre || '';
    if (!kbsTesisKodu || !kbsWebServisSifre) {
      Toast.show({ type: 'error', text1: 'Eksik alan', text2: 'KBS tesis kodu ve web servis şifresini girin.' });
      return;
    }
    setKbsImportLoading(true);
    setKbsImportResult(null);
    try {
      const response = await api.post('/tesis/kbs/import', {
        kbsTuru,
        kbsTesisKodu,
        kbsWebServisSifre,
      });
      const data = response.data || {};
      setKbsImportResult(data);
      const msg = data.message || (data.imported > 0 ? `${data.imported} misafir aktarıldı.` : 'Aktarım tamamlandı.');
      if (data.imported > 0) {
        dataService.clearCache().catch(() => {});
        Toast.show({ type: 'success', text1: 'KBS aktarımı', text2: msg, visibilityTime: 5000 });
      } else {
        Toast.show({ type: 'info', text1: 'KBS aktarımı', text2: msg, visibilityTime: 5000 });
      }
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.message || 'Aktarım başarısız';
      setKbsImportResult({ error: errMsg });
      Toast.show({ type: 'error', text1: 'KBS aktarımı', text2: errMsg, visibilityTime: 5000 });
    } finally {
      setKbsImportLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (credentialState === 'NONE' || credentialState === null) {
        await api.post('/kbs/credentials/request', {
          action: 'create',
          tesis_kodu: kbsSettings.kbsTesisKodu,
          web_servis_sifre: kbsSettings.kbsWebServisSifre,
        });
        Toast.show({ type: 'success', text1: 'Talep iletildi', text2: 'Onay bekleniyor', visibilityTime: 4000 });
        await loadCredentialStatus();
      } else {
        await api.put('/tesis/kbs', {
          ...kbsSettings,
          kbsWebServisSifre: kbsSettings.kbsWebServisSifre,
        });
        Toast.show({ type: 'success', text1: 'Başarılı', text2: 'Ayarlar kaydedildi' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'İşlem başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const handleKbsRequest = async (action, tesisKodu, webServisSifre) => {
    setCredentialLoading(true);
    try {
      await api.post('/kbs/credentials/request', {
        action,
        tesis_kodu: tesisKodu || '',
        web_servis_sifre: webServisSifre || '',
      });
      Toast.show({ type: 'success', text1: 'Talep iletildi', text2: 'Admin onayından sonra işlem yapılacaktır.', visibilityTime: 4000 });
      await loadCredentialStatus();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Talep gönderilemedi' });
    } finally {
      setCredentialLoading(false);
    }
  };

  const handleKbsTalep = async (type) => {
    if (type === 'change') {
      setChangeTesisKodu(kbsSettings.kbsTesisKodu || '');
      setChangeSifre(kbsSettings.kbsWebServisSifre || '');
      setChangeModalVisible(true);
      return;
    }
    if (type === 'remove') {
      Alert.alert(
        'KBS Kaldırma',
        'KBS bilgilerini kaldırmak için talep göndereceksiniz. Onay sonrası kaldırılır.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Gönder', onPress: () => handleKbsRequest('delete', '', '') },
        ]
      );
      return;
    }
    try {
      await api.post('/tesis/kbs/talebi', { type });
      Toast.show({ type: 'success', text1: 'Talep iletildi', text2: 'Admin onayından sonra işlem yapılacaktır.', visibilityTime: 4000 });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Talep gönderilemedi' });
    }
  };

  const submitChangeModal = () => {
    if (!changeTesisKodu.trim() || !changeSifre.trim()) {
      Toast.show({ type: 'error', text1: 'Tesis kodu ve şifre gerekli' });
      return;
    }
    setChangeModalVisible(false);
    handleKbsRequest('update', changeTesisKodu.trim(), changeSifre);
  };

  const handleSifreSave = async () => {
    if (!sifreValue || sifreValue.length < 6) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Şifre en az 6 karakter olmalıdır' });
      return;
    }
    if (sifreValue !== sifreTekrar) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Şifreler eşleşmiyor' });
      return;
    }
    setSifreLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: sifreValue });
        if (error) throw error;
      } else {
        await api.post('/auth/sifre', { sifre: sifreValue, sifreTekrar });
      }
      Toast.show({ type: 'success', text1: 'Başarılı', text2: 'Şifre kaydedildi.' });
      setSifreValue('');
      setSifreTekrar('');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || e?.response?.data?.message || 'Şifre kaydedilemedi' });
    } finally {
      setSifreLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
      ]
    );
  };

  const supportEmail = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com';
  const supportPhone = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE || '0850 304 5061';
  const supportPhoneTel = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE_TEL || 'tel:08503045061';

  const handleRequestAccountDeletion = () => {
    Alert.alert(
      'Hesabı sil',
      'Hesabınız 7 gün içinde kalıcı olarak silinecektir. Tüm verileriniz (belgeler, işlemler, KBS kayıtları) silinecektir. Bu süre içinde giriş yaparak hesabı geri alabilirsiniz. Silme işlemini onaylıyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, hesabımı sil',
          style: 'destructive',
          onPress: async () => {
            setDeleteAccountLoading(true);
            try {
              await api.post('/auth/request-account-deletion');
              Toast.show({ type: 'info', text1: 'Talep alındı', text2: '7 gün içinde hesabınız silinecek. Bu sürede giriş yaparak geri alabilirsiniz.' });
              await logout();
            } catch (e) {
              const code = e?.response?.data?.code;
              const msg = e?.response?.data?.message || e?.message || '';
              const isNotSupported = code === 'NOT_SUPPORTED' || /e-posta|telefon ile giriş|yalnızca/.test(msg);
              const text2 = isNotSupported
                ? 'Bu işlem yalnızca e-posta veya telefon ile giriş yapan hesaplar için geçerlidir. Misafir hesaptan çıkış yaparak oturumu kapatabilirsiniz.'
                : (msg || 'İşlem yapılamadı.');
              Toast.show({ type: 'error', text1: 'Hata', text2 });
            } finally {
              setDeleteAccountLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Profil ve Ayarlar"
        tesis={tesis}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
        onNotification={() => navigation.navigate('Bildirimler')}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profil</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Avatar</Text>
          <TouchableOpacity onPress={pickAvatar} style={[styles.avatarWrap, { backgroundColor: colors.background }]}>
            {(localAvatarUri || avatarUrl) ? (
              <Image source={{ uri: localAvatarUri || (avatarUrl ? `${avatarUrl}${avatarUrlTs ? `?t=${avatarUrlTs}` : ''}` : '') }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={48} color={colors.textSecondary} />
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          {(user?.email || (user?.telefon && user?.telefon !== '-')) ? (
            <View style={styles.accountRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Hesap (giriş)</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>{user?.email || user?.telefon}</Text>
            </View>
          ) : null}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad / Görünen ad</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Adınız"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ünvan / Pozisyon</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Resepsiyon, Ön Büro Müdürü..."
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon (isteğe bağlı)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            value={telefon}
            onChangeText={(t) => setTelefon(t.replace(/\D/g, '').slice(0, 11))}
            placeholder="5XX XXX XX XX"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
          <Button
            variant="primary"
            onPress={handleProfileSave}
            loading={profileSaving}
            disabled={profileSaving}
            style={{ marginTop: spacing.sm }}
          >
            Profil bilgilerini kaydet
          </Button>
          <TouchableOpacity
            style={[styles.menuRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md }]}
            onPress={() => navigation.navigate('ProfilIletisim')}
          >
            <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>Telefon ve e-posta bağla / değiştir</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Kimlik / Pasaport</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Belge okuma için öncelik MRZ (kamera) ile okumadır. İsterseniz NFC ile okumayı açabilirsiniz.
          </Text>
          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>NFC ile okumayı kullan</Text>
            <Switch
              value={nfcEnabled}
              onValueChange={async (v) => {
                await setNfcEnabled(v);
                setNfcEnabledState(v);
                Toast.show({ type: 'info', text1: v ? 'NFC açıldı' : 'NFC kapatıldı', text2: v ? 'Kimlik ekranında NFC önce denenecek' : 'Öncelik MRZ (kamera)' });
              }}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={nfcEnabled ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Kullanım kolaylığı</Text>
          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Titreşimli geri bildirim</Text>
            <Switch
              value={hapticEnabled}
              onValueChange={(v) => { setHapticEnabled(v); setHapticEnabledState(v); }}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={hapticEnabled ? colors.primary : colors.textSecondary}
            />
          </View>
          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Sesli yönlendirme (TTS)</Text>
            <Switch
              value={ttsEnabled}
              onValueChange={(v) => { setTtsEnabled(v); setTtsEnabledState(v); }}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={ttsEnabled ? colors.primary : colors.textSecondary}
            />
          </View>
          <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('settings.language')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(languageLabels || {}).map(([code, label]) => (
                <TouchableOpacity
                  key={code}
                  onPress={() => setLanguage(code)}
                  style={[styles.langChip, { backgroundColor: language === code ? colors.primary + '25' : colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.langChipText, { color: language === code ? colors.primary : colors.textPrimary }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Raporlar ve yedek</Text>
          <TouchableOpacity
            style={[styles.menuRow, { borderColor: colors.border }]}
            onPress={async () => {
              if (exportLoading) return;
              setExportLoading(true);
              try {
                await exportGuestsToExcel();
                Toast.show({ type: 'success', text1: 'Excel aktarıldı', text2: 'Dosyayı paylaşabilirsiniz.' });
              } catch (e) {
                Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'Aktarılamadı.' });
              } finally {
                setExportLoading(false);
              }
            }}
            disabled={exportLoading}
          >
            <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>{exportLoading ? 'Hazırlanıyor...' : "Excel'e aktar"}</Text>
            {exportLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="download-outline" size={20} color={colors.textSecondary} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, { borderColor: colors.border }]}
            onPress={async () => {
              if (backupLoading) return;
              setBackupLoading(true);
              try {
                await createBackup();
                Toast.show({ type: 'success', text1: 'Yedek oluşturuldu', text2: 'Dosyayı paylaşabilirsiniz.' });
              } catch (e) {
                Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'Yedek alınamadı.' });
              } finally {
                setBackupLoading(false);
              }
            }}
            disabled={backupLoading}
          >
            <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>{backupLoading ? 'Hazırlanıyor...' : 'Yedekle'}</Text>
            {backupLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="cloud-upload-outline" size={20} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Okutulan kimlikler</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Kimlik veya pasaport okuttuktan sonra "Kaydet" ile kaydettiğiniz belgeler burada listelenir.
          </Text>
          {okutulanBelgelerLoading ? (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
          ) : okutulanBelgeler.length === 0 ? (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Henüz kayıt yok.</Text>
          ) : (
            okutulanBelgeler.slice(0, 30).map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.okutulanBelgeRow, { borderBottomColor: colors.border }]}
                onPress={() => setOkutulanBelgeDetail(b)}
                activeOpacity={0.7}
              >
                <View style={styles.okutulanBelgeMain}>
                  <Text style={[styles.okutulanBelgeName, { color: colors.textPrimary }]}>
                    {b.ad} {b.soyad}
                  </Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    {b.belgeTuru === 'kimlik' ? 'Kimlik' : 'Pasaport'}
                    {(b.kimlikNo || b.pasaportNo || b.belgeNo) && ` · ${b.kimlikNo || b.pasaportNo || b.belgeNo}`}
                    {' · '}
                    {b.createdAt ? new Date(b.createdAt).toLocaleDateString('tr-TR') : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tesis Bilgileri</Text>
          {canEditTesis ? (
            <>
              <Input
                label="Tesis / Otel adı"
                value={tesisAdiEdit}
                onChangeText={setTesisAdiEdit}
                placeholder="Örn. Örnek Otel"
              />
              <Button
                variant="secondary"
                onPress={handleTesisAdiSave}
                loading={tesisAdiSaving}
                disabled={tesisAdiSaving || (tesisAdiEdit || '').trim() === '' || (tesisAdiEdit || '').trim() === (tesis?.tesisAdi || '')}
              >
                Tesis adını kaydet
              </Button>
            </>
          ) : (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Tesis: {tesis?.tesisAdi}</Text>
          )}
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Paket: {tesis?.paket}</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Kota: {tesis?.kullanilanKota} / {tesis?.kota}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Güvenlik & Giriş</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Uygulamaya sadece telefon veya e-posta + şifre ile giriş yapılır. Şifrenizi buradan güncelleyebilirsiniz.
          </Text>
          <Text style={[styles.label, { color: colors.textPrimary, marginTop: spacing.lg }]}>Yeni Şifre</Text>
          <Input value={sifreValue} onChangeText={setSifreValue} placeholder="En az 6 karakter" secureTextEntry />
          <Input value={sifreTekrar} onChangeText={setSifreTekrar} placeholder="Yeni şifre tekrar" secureTextEntry />
          <Button
            variant="secondary"
            onPress={handleSifreSave}
            loading={sifreLoading}
            disabled={sifreLoading || sifreValue.length < 6 || sifreValue !== sifreTekrar}
          >
            Şifreyi Güncelle
          </Button>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KBS Ayarları (Tesis Bilgileri)</Text>
          {credentialState === 'PENDING' && (
            <View style={[styles.badge, { backgroundColor: colors.textSecondary }]}>
              <Ionicons name="time-outline" size={18} color="#fff" />
              <Text style={styles.badgeText}>Onay bekleniyor</Text>
            </View>
          )}
          {credentialState === 'APPROVED' && (
            <View style={[styles.badge, { backgroundColor: colors.success || '#22c55e' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.badgeText}>Onaylandı</Text>
            </View>
          )}
          {tesisDetail && tesisDetail.kbsConnected === false && credentialState !== 'APPROVED' && (
            <Banner
              type="info"
              message="Kimlik bildirimi (KBS) bu tesis için henüz yapılandırılmadı. Bağlantı kurulduğunda bu bölümden test edebilirsiniz."
            />
          )}

          <Text style={[styles.label, { color: colors.textPrimary }]}>KBS Türü</Text>
          <SegmentedControl
            options={[
              { key: 'jandarma', label: 'Jandarma KBS' },
              { key: 'polis', label: 'Polis (EMN) KBS' },
            ]}
            value={kbsSettings.kbsTuru}
            onChange={(v) => setKbsSettings((prev) => ({ ...prev, kbsTuru: v }))}
            style={styles.segmented}
          />

          <Input
            label="KBS Tesis Kodu"
            value={kbsSettings.kbsTesisKodu}
            onChangeText={(t) => setKbsSettings((prev) => ({ ...prev, kbsTesisKodu: t }))}
            placeholder="KBS Tesis Kodu"
            editable={credentialState !== 'PENDING'}
          />
          <Input
            label="Web Servis Şifresi"
            value={kbsSettings.kbsWebServisSifre || ''}
            onChangeText={(t) => setKbsSettings((prev) => ({ ...prev, kbsWebServisSifre: t }))}
            placeholder="Web Servis Şifresi"
            secureTextEntry={true}
            autoComplete="off"
            editable={credentialState !== 'PENDING'}
          />

          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>IP Kısıtı</Text>
            <Switch
              value={kbsSettings.ipKisitAktif}
              onValueChange={(v) => setKbsSettings((prev) => ({ ...prev, ipKisitAktif: v }))}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={kbsSettings.ipKisitAktif ? colors.primary : colors.textSecondary}
            />
          </View>

          {kbsServerIp ? (
            <View style={[styles.serverIpBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Sunucu IP'si</Text>
              <Text style={[styles.serverIpText, { color: colors.textPrimary }]} selectable>{kbsServerIp}</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 4 }]}>
                Gerekirse teknik destekte kullanın.
              </Text>
            </View>
          ) : null}

          <Button variant="secondary" onPress={handleKBSTest} loading={testLoading} disabled={testLoading}>
            Bağlantıyı Test Et
          </Button>
          {testResult && (
            <View
              style={[
                styles.testResult,
                { backgroundColor: testResult.success ? colors.successSoft : colors.errorSoft },
              ]}
            >
              <Text style={[styles.testResultText, { color: colors.textPrimary }]}>{testResult.message}</Text>
            </View>
          )}

          <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            Farklı bir sistemden geçtiyseniz, KBS bilgilerinizi kaydettikten sonra aşağıdaki butonla daha önce KBS'e bildirdiğiniz misafirleri sistemimize aktarabilirsiniz; kaldığınız yerden devam edersiniz.
          </Text>
          <Button
            variant="secondary"
            onPress={handleKBSImport}
            loading={kbsImportLoading}
            disabled={kbsImportLoading || !kbsSettings.kbsTesisKodu?.trim()}
            style={{ marginTop: spacing.sm }}
          >
            KBS'ten mevcut misafirleri getir
          </Button>
          {kbsImportResult && (
            <View
              style={[
                styles.testResult,
                { marginTop: spacing.sm, backgroundColor: kbsImportResult.error ? (colors.errorSoft || '#fef2f2') : (colors.successSoft || '#f0fdf4') },
              ]}
            >
              <Text style={[styles.testResultText, { color: colors.textPrimary }]}>
                {kbsImportResult.error || kbsImportResult.message || (kbsImportResult.imported > 0 ? `${kbsImportResult.imported} misafir aktarıldı.` : 'İşlem tamamlandı.')}
              </Text>
            </View>
          )}

          {credentialState !== 'PENDING' && (
            <Button variant="primary" onPress={handleSave} loading={loading} disabled={loading} style={styles.saveBtn}>
              {credentialState === 'APPROVED' ? 'Güncelle (talep açar)' : 'Kaydet'}
            </Button>
          )}

          {credentialState === 'APPROVED' && (
            <View style={styles.kbsTalepRow}>
              <Button variant="secondary" onPress={() => handleKbsTalep('change')} style={styles.kbsTalepBtn} disabled={credentialLoading}>
                Değiştir
              </Button>
              <Button variant="secondary" onPress={() => handleKbsTalep('remove')} style={[styles.kbsTalepBtn, { borderColor: colors.error }]} disabled={credentialLoading}>
                Sil
              </Button>
            </View>
          )}

          {credentialState !== 'APPROVED' && credentialState !== 'PENDING' && (
            <View style={styles.kbsTalepRow}>
              <Button variant="secondary" onPress={() => handleKbsTalep('change')} style={styles.kbsTalepBtn}>
                Değişiklik talebi
              </Button>
              <Button variant="secondary" onPress={() => handleKbsTalep('remove')} style={[styles.kbsTalepBtn, { borderColor: colors.error }]}>
                Kaldırma talebi
              </Button>
            </View>
          )}

          <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            KBS tesis kodu ve şifresi talep sonrası admin onayı ile geçerli olur. Değiştir/Sil de onay gerektirir.
          </Text>
        </View>

        <Modal visible={!!okutulanBelgeDetail} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setOkutulanBelgeDetail(null)}
          >
            <TouchableOpacity
              style={[styles.modalContent, styles.okutulanDetailModal, { backgroundColor: colors.surface }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.okutulanDetailHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Belge detayı (KBS bildirim bilgileri)</Text>
                <TouchableOpacity onPress={() => setOkutulanBelgeDetail(null)} hitSlop={16}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {okutulanBelgeDetail && (
                <ScrollView style={styles.okutulanDetailScroll} showsVerticalScrollIndicator={false}>
                  {okutulanBelgeDetail.photoUrl && (() => {
                    const baseUrl = getApiBaseUrl();
                    const photoUri = baseUrl ? `${baseUrl.replace(/\/$/, '')}${okutulanBelgeDetail.photoUrl}` : null;
                    return photoUri ? (
                      <View style={styles.okutulanDetailPhotoWrap}>
                        <Image source={{ uri: photoUri }} style={styles.okutulanDetailPhoto} resizeMode="cover" />
                      </View>
                    ) : null;
                  })()}
                  <View style={styles.okutulanDetailFields}>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Ad</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>{okutulanBelgeDetail.ad || '—'}</Text>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Soyad</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>{okutulanBelgeDetail.soyad || '—'}</Text>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Belge türü</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                      {okutulanBelgeDetail.belgeTuru === 'kimlik' ? 'Kimlik' : 'Pasaport'}
                    </Text>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>
                      {okutulanBelgeDetail.belgeTuru === 'kimlik' ? 'Kimlik no' : 'Pasaport no'}
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                      {okutulanBelgeDetail.kimlikNo || okutulanBelgeDetail.pasaportNo || okutulanBelgeDetail.belgeNo || '—'}
                    </Text>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Doğum tarihi</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                      {okutulanBelgeDetail.dogumTarihi || '—'}
                    </Text>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Uyruk</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                      {okutulanBelgeDetail.uyruk || '—'}
                    </Text>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Kayıt tarihi</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      {okutulanBelgeDetail.createdAt ? new Date(okutulanBelgeDetail.createdAt).toLocaleString('tr-TR') : '—'}
                    </Text>
                  </View>
                  <Button variant="secondary" onPress={() => setOkutulanBelgeDetail(null)} style={{ marginTop: spacing.md }}>
                    Kapat
                  </Button>
                </ScrollView>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal visible={changeModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KBS Değişiklik Talebi</Text>
              <Input label="KBS Tesis Kodu" value={changeTesisKodu} onChangeText={setChangeTesisKodu} placeholder="Tesis kodu" />
              <Input label="Web Servis Şifresi" value={changeSifre} onChangeText={setChangeSifre} placeholder="Şifre" secureTextEntry />
              <View style={styles.modalButtons}>
                <Button variant="secondary" onPress={() => setChangeModalVisible(false)}>İptal</Button>
                <Button variant="primary" onPress={submitChangeModal} loading={credentialLoading}>Gönder</Button>
              </View>
            </View>
          </View>
        </Modal>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Hesap</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Hesabınızı silmek 7 gün içinde tüm verilerinizin (belgeler, işlemler, KBS kayıtları) kalıcı olarak silinmesini başlatır. Bu sürede giriş yaparak talebi iptal edebilirsiniz.
          </Text>
          <Button
            variant="destructive"
            onPress={handleRequestAccountDeletion}
            loading={deleteAccountLoading}
            disabled={deleteAccountLoading}
          >
            Hesabı sil
          </Button>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>İletişim</Text>
          <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Destek e-posta:</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${supportEmail}`)}>
            <Text style={[styles.contactLink, { color: colors.primary }]}>{supportEmail}</Text>
          </TouchableOpacity>
          <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Destek telefon:</Text>
          <TouchableOpacity onPress={() => Linking.openURL(supportPhoneTel)}>
            <Text style={[styles.contactLink, { color: colors.primary }]}>{supportPhone}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Button variant="destructive" onPress={handleLogout}>
            Çıkış Yap
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.screenPadding, paddingBottom: 120 },
  section: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.text.h2.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  infoText: { fontSize: typography.text.body.fontSize, marginBottom: spacing.xs },
  label: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  segmented: { marginBottom: spacing.md },
  langChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  langChipText: { fontSize: 14, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  serverIpBox: {
    padding: spacing.md,
    borderRadius: spacing.borderRadius.input,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  serverIpText: {
    fontSize: typography.text.body.fontSize,
    marginTop: 2,
  },
  testResult: {
    padding: spacing.md,
    borderRadius: spacing.borderRadius.input,
    marginBottom: spacing.md,
  },
  testResultText: { fontSize: typography.text.body.fontSize },
  saveBtn: { marginTop: spacing.xs },
  kbsTalepRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  kbsTalepBtn: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.input,
    gap: 6,
    marginBottom: spacing.md,
  },
  badgeText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    justifyContent: 'flex-end',
  },
  contactLabel: { fontSize: typography.text.body.fontSize, marginBottom: 4 },
  contactLink: { fontSize: typography.text.body.fontSize },
  okutulanDetailModal: { maxHeight: '85%' },
  okutulanDetailScroll: { maxHeight: 400 },
  okutulanDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  okutulanDetailPhotoWrap: {
    alignSelf: 'center',
    width: 140,
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: spacing.lg,
  },
  okutulanDetailPhoto: { width: '100%', height: '100%' },
  okutulanDetailFields: { marginBottom: spacing.sm },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountRow: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.text.body.fontSize,
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  menuRowText: { fontSize: typography.text.body.fontSize },
  okutulanBelgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  okutulanBelgeMain: { flex: 1 },
  okutulanBelgeName: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.semibold,
  },
});

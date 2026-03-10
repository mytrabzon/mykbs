/**
 * NFC otomatik dinleyici — pasaport/kimlik kartı yaklaştığında tag discovery.
 * react-native-nfc-manager kullanır; tag algılanınca onTagDetected(tag) çağrılır.
 * Backend /nfc/okut ile DG1/MRZ işlenebilir.
 */
import { useEffect, useState, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import { logger } from '../../utils/logger';

let NfcManager = null;
let NfcEvents = null;
try {
  const pkg = require('react-native-nfc-manager');
  NfcManager = pkg.default;
  NfcEvents = pkg.NfcEvents;
} catch (e) {
  logger.warn('NfcAutoScanner: react-native-nfc-manager yok', e?.message);
}

export const useNfcAutoScanner = (options = {}) => {
  const {
    onTagDetected,
    enabled = true,
    alertMessage = 'Pasaport veya kimlik kartını telefonun arkasına yaklaştırın…',
  } = options;

  const [isScanning, setIsScanning] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const processingRef = useRef(false);
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!NfcManager || !NfcEvents || !enabled) {
      setIsSupported(false);
      return;
    }

    let cancelled = false;

    const checkAndStart = async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (cancelled) return;
        setIsSupported(!!supported);
        if (!supported) {
          setLastError('NFC desteklenmiyor');
          return;
        }
        await NfcManager.start();
        if (NfcManager.isEnabled && typeof NfcManager.isEnabled === 'function') {
          const nfcEnabled = await NfcManager.isEnabled();
          if (!nfcEnabled) {
            setLastError('NFC kapalı. Ayarlardan açın.');
            return;
          }
        }
        setLastError(null);

        const onTagDiscover = (tag) => {
          if (cancelled || processingRef.current) return;
          processingRef.current = true;
          logger.info('[NfcAutoScanner] Tag algılandı', { tagId: tag?.id });
          try {
            if (Platform.OS === 'ios') {
              try {
                const Haptics = require('expo-haptics');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success ?? 1).catch(() => {});
              } catch (_) {}
            }
            Vibration.vibrate(100);
          } catch (_) {}
          if (onTagDetected && typeof onTagDetected === 'function') {
            try {
              onTagDetected(tag);
            } catch (e) {
              logger.warn('[NfcAutoScanner] onTagDetected error', e?.message);
            }
          }
          setTimeout(() => {
            processingRef.current = false;
          }, 2000);
        };

        listenerRef.current = onTagDiscover;
        NfcManager.setEventListener(NfcEvents.DiscoverTag, onTagDiscover);
        await NfcManager.registerTagEvent({
          invalidateAfterFirstRead: false,
          alertMessage,
        });
        if (cancelled) return;
        setIsScanning(true);
        logger.info('[NfcAutoScanner] Dinleme başlatıldı');
      } catch (err) {
        if (!cancelled) {
          logger.warn('[NfcAutoScanner] Başlatılamadı', err?.message);
          setLastError(err?.message || 'NFC başlatılamadı');
          setIsScanning(false);
        }
      }
    };

    checkAndStart();

    return () => {
      cancelled = true;
      processingRef.current = false;
      if (NfcManager) {
        NfcManager.setEventListener(NfcEvents?.DiscoverTag ?? 'DiscoverTag', null);
        NfcManager.unregisterTagEvent().catch(() => {});
      }
      setIsScanning(false);
      logger.info('[NfcAutoScanner] Dinleme durduruldu');
    };
  }, [enabled, alertMessage]);

  const stopScan = () => {
    if (NfcManager) NfcManager.unregisterTagEvent().catch(() => {});
    setIsScanning(false);
  };

  return {
    isScanning,
    lastError,
    isSupported: NfcManager ? isSupported : false,
    stopScan,
  };
};

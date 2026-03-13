/**
 * KBS Prime — Anlık geri bildirim: titreşim (haptic) + sesli yönlendirme (TTS).
 * Eldivenle kullanım için receptionist bakmadan anlasın.
 */
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = { TTS: '@mykbs:settings:ttsEnabled', HAPTIC: '@mykbs:settings:hapticEnabled' };

let ttsEnabled = true;
let hapticEnabled = true;

export function setTtsEnabled(enabled) {
  ttsEnabled = !!enabled;
  AsyncStorage.setItem(STORAGE_KEYS.TTS, enabled ? '1' : '0').catch(() => {});
}

export function setHapticEnabled(enabled) {
  hapticEnabled = !!enabled;
  AsyncStorage.setItem(STORAGE_KEYS.HAPTIC, enabled ? '1' : '0').catch(() => {});
}

export async function loadFeedbackSettings() {
  try {
    const [tts, haptic] = await Promise.all([AsyncStorage.getItem(STORAGE_KEYS.TTS), AsyncStorage.getItem(STORAGE_KEYS.HAPTIC)]);
    if (tts !== null) ttsEnabled = tts === '1';
    if (haptic !== null) hapticEnabled = haptic === '1';
  } catch (_) {}
}

export function getTtsEnabled() {
  return ttsEnabled;
}

export function getHapticEnabled() {
  return hapticEnabled;
}

/** Başarılı okuma sonrası kısa titreşim */
export async function hapticSuccess() {
  if (!hapticEnabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}

/** Hata titreşimi */
export async function hapticError() {
  if (!hapticEnabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {}
}

/** Hafif dokunma (seçim) */
export async function hapticSelection() {
  if (!hapticEnabled) return;
  try {
    await Haptics.selectionAsync();
  } catch (_) {}
}

/**
 * Sesli yönlendirme. Dil kodu: 'tr-TR', 'en-US', 'de-DE', 'ru-RU' vb.
 */
export function speak(text, options = {}) {
  if (!ttsEnabled || !text || typeof text !== 'string') return;
  try {
    Speech.speak(text.trim(), {
      language: options.language || 'tr-TR',
      pitch: options.pitch ?? 1,
      rate: options.rate ?? 0.9,
      onDone: options.onDone,
      onStopped: options.onStopped,
      onError: options.onError,
    });
  } catch (_) {}
}

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch (_) {}
}

/** Uygulama dil kodu (tr, en, ar ...) → TTS locale (tr-TR, en-US, ar-SY ...) */
export function getTtsLocale(appLanguageCode) {
  const map = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', ru: 'ru-RU', ar: 'ar-SY' };
  return map[appLanguageCode] || 'tr-TR';
}

/** "Lütfen pasaportu yaklaştırın" */
export function speakApproachPassport(language = 'tr-TR') {
  const phrases = {
    'tr-TR': 'Lütfen pasaportu yaklaştırın.',
    'en-US': 'Please bring the passport closer.',
    'de-DE': 'Bitte führen Sie den Pass näher.',
    'ru-RU': 'Пожалуйста, поднесите паспорт ближе.',
    'ar-SY': 'يرجى تقريب جواز السفر.',
  };
  speak(phrases[language] || phrases['tr-TR'], { language });
}

/** "Okuma başarılı" */
export function speakReadSuccess(language = 'tr-TR') {
  const phrases = {
    'tr-TR': 'Okuma başarılı.',
    'en-US': 'Read successful.',
    'de-DE': 'Lesen erfolgreich.',
    'ru-RU': 'Чтение успешно.',
    'ar-SY': 'تمت القراءة بنجاح.',
  };
  speak(phrases[language] || phrases['tr-TR'], { language });
}

/** "Kimliği yaklaştırın" (NFC) */
export function speakApproachId(language = 'tr-TR') {
  const phrases = {
    'tr-TR': 'Kimliği telefonun arkasına yaklaştırın.',
    'en-US': 'Bring the ID close to the back of the phone.',
    'de-DE': 'Führen Sie den Ausweis an die Rückseite des Telefons.',
    'ru-RU': 'Поднесите документ к задней части телефона.',
    'ar-SY': 'قرّب الهوية من ظهر الهاتف.',
  };
  speak(phrases[language] || phrases['tr-TR'], { language });
}

/** "Pasaport veya kimliğin MRZ bölgesini kameraya gösterin" (MRZ kamera okuma) */
export function speakMrzCameraHint(language = 'tr-TR') {
  const phrases = {
    'tr-TR': 'Pasaport veya kimliğin arka yüzündeki MRZ çizgilerini kameraya gösterin.',
    'en-US': 'Show the MRZ lines on the back of your passport or ID to the camera.',
    'de-DE': 'Zeigen Sie die MRZ-Zeilen auf der Rückseite von Pass oder Ausweis in die Kamera.',
    'ru-RU': 'Покажите камере MRZ-линии на обратной стороне паспорта или документа.',
    'ar-SY': 'اعرض خطوط MRZ في ظهر جواز السفر أو الهوية للكاميرا.',
  };
  speak(phrases[language] || phrases['tr-TR'], { language });
}

/** Başarılı check-in: titreşim + ses */
export async function feedbackCheckInSuccess(language = 'tr-TR') {
  await hapticSuccess();
  speakReadSuccess(language);
}

/** Başarılı MRZ/NFC okuma: titreşim + ses */
export async function feedbackReadSuccess(language = 'tr-TR') {
  await hapticSuccess();
  speakReadSuccess(language);
}

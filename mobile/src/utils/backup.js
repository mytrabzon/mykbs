/**
 * Otomatik / manuel yedek: Offline kuyruk + (opsiyonel) önbellek verisi.
 * Her gece otomatik yedek için expo-task veya uygulama açılışında "son yedek" kontrolü kullanılabilir.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getPendingQueue } from '../services/offlineKbsDB';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const BACKUP_PREFIX = '@mykbs:data:';
const CACHE_KEYS = ['@mykbs:data:tesis', '@mykbs:data:odalar', '@mykbs:data:misafirler', '@mykbs:data:lastSync'];

export async function createBackup() {
  try {
    const [queue, ...cacheValues] = await Promise.all([
      getPendingQueue(1000),
      ...CACHE_KEYS.map((k) => AsyncStorage.getItem(k)),
    ]);
    const backup = {
      createdAt: new Date().toISOString(),
      queue: queue || [],
      cache: {
        tesis: cacheValues[0],
        odalar: cacheValues[1],
        misafirler: cacheValues[2],
        lastSync: cacheValues[3],
      },
    };
    const json = JSON.stringify(backup, null, 2);
    const filename = `KBS_Backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    const path = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Yedekle' });
    }
    return { success: true, path, queueCount: (queue || []).length };
  } catch (e) {
    logger.error('backup error', e);
    throw e;
  }
}

/**
 * Bildirilen misafirleri Excel'e aktar (xlsx) ve paylaş
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { dataService } from '../services/dataService';
import { logger } from './logger';

export async function exportGuestsToExcel() {
  try {
    const misafirler = await dataService.getMisafirler(true);
    const rows = (misafirler || []).map((m) => ({
      Ad: m.ad || '',
      Soyad: m.soyad || '',
      'Kimlik No': m.kimlikNo || '',
      'Pasaport No': m.pasaportNo || '',
      'Doğum Tarihi': m.dogumTarihi || '',
      Uyruk: m.uyruk || '',
      'Giriş Tarihi': m.girisTarihi || '',
      'Çıkış Tarihi': m.cikisTarihi || '',
      'Oda No': m.odaNumarasi || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Misafirler');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const filename = `KBS_Misafirler_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const path = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, wbout, { encoding: FileSystem.EncodingType.Base64 });
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Excel\'e aktar' });
    }
    return { success: true, path };
  } catch (e) {
    logger.error('exportExcel error', e);
    throw e;
  }
}

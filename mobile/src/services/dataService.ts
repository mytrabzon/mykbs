import { callFn } from '../lib/supabase/functions';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';

// Veri tipleri
export interface TesisData {
  id: string;
  tesisAdi: string;
  paket: string;
  kota: number;
  kullanilanKota: number;
  /** Deneme süresi bitişi; paket alınca null */
  trialEndsAt?: string | null;
  kbsTuru?: string;
  /** Kimlik bildirimi (KBS) bu tesis için yapılandırıldı mı */
  kbsConnected?: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  ozet: {
    toplamOda: number;
    doluOda: number;
    bugunGiris: number;
    bugunCikis: number;
    hataliBildirim: number;
  };
}

export interface OdaData {
  id: string;
  odaNumarasi: string;
  odaTipi: string;
  kapasite: number;
  fotograf?: string;
  durum: 'bos' | 'dolu' | 'temizlik' | 'bakim';
  fiyat?: number;
  /** Tek kaynak: uygulama. true = şu anda odada (KBS’e bağlı değil). */
  odadaMi?: boolean;
  misafir?: {
    id: string;
    ad: string;
    soyad: string;
    girisTarihi: string;
    cikisTarihi?: string;
  };
  kbsDurumu?: string;
  kbsHataMesaji?: string;
}

export interface MisafirData {
  id: string;
  ad: string;
  soyad: string;
  kimlikNo: string;
  pasaportNo?: string;
  dogumTarihi: string;
  uyruk: string;
  girisTarihi: string;
  cikisTarihi?: string;
  odaId: string;
  odaNumarasi: string;
}

// Uygulama prefix'i (AsyncStorage izolasyonu için)
// app.config.js'deki slug kullanılıyor: "mykbs"
const APP_PREFIX = 'mykbs';

// Auth key'leri (AuthContext ile aynı – token yokken fallback için)
const AUTH_KEYS = {
  TOKEN: `@${APP_PREFIX}:auth:token`,
  SUPABASE_TOKEN: `@${APP_PREFIX}:auth:supabase_token`,
};

// Cache anahtarları (uygulama prefix'i ile)
const CACHE_KEYS = {
  TESIS: `@${APP_PREFIX}:data:tesis`,
  ODALAR: `@${APP_PREFIX}:data:odalar`,
  MISAFIRLER: `@${APP_PREFIX}:data:misafirler`,
  LAST_SYNC: `@${APP_PREFIX}:data:lastSync`,
};

// Cache süresi: odalar için 45 sn (sekme geçişi hızlı, veri güncel)
const CACHE_DURATION = 45 * 1000;

export type DataServiceTokenProvider = () => Promise<string | null> | string | null;

/** Açılışta hemen token kullanılsın: modül yüklenir yüklenmez AsyncStorage'dan okuyan sağlayıcı. AuthContext init sonra güncelleyebilir. */
let tokenProvider: DataServiceTokenProvider | null = () => AsyncStorage.getItem(AUTH_KEYS.TOKEN);

/** Edge Function çağrıları için token (AsyncStorage'taki TOKEN/SUPABASE_TOKEN). AuthContext girişte ayarlar. */
export function setDataServiceTokenProvider(provider: DataServiceTokenProvider | null) {
  tokenProvider = provider;
}

async function getAccessToken(): Promise<string | null> {
  if (tokenProvider) {
    const t = tokenProvider();
    const token = t instanceof Promise ? await t : t;
    if (token) return token;
  }
  // Fallback: Auth henüz yüklenmeden çağrı yapılıyorsa AsyncStorage'dan oku (race önleme)
  try {
    const supabase = await AsyncStorage.getItem(AUTH_KEYS.SUPABASE_TOKEN);
    if (supabase) return supabase;
    const node = await AsyncStorage.getItem(AUTH_KEYS.TOKEN);
    return node;
  } catch {
    return null;
  }
}

class DataService {
  private tesisCache: TesisData | null = null;
  private odalarCache: Map<string, OdaData[]> = new Map(); // filtre -> odalar
  private misafirlerCache: MisafirData[] | null = null;
  private lastSync: Date | null = null;
  private syncInProgress = false;
  private listeners: Map<string, Set<Function>> = new Map();
  /** Açılışta disk cache yüklenene kadar beklemek için; getTesis/getOdalar ilk cache kontrolünden önce buna await eder. */
  private cacheReadyPromise: Promise<void>;

  constructor() {
    this.cacheReadyPromise = this.loadCache();
  }

  /**
   * Cache'i yükle
   */
  private async loadCache() {
    try {
      const [tesisStr, odalarStr, misafirlerStr, lastSyncStr] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.TESIS),
        AsyncStorage.getItem(CACHE_KEYS.ODALAR),
        AsyncStorage.getItem(CACHE_KEYS.MISAFIRLER),
        AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC),
      ]);

      if (tesisStr) {
        this.tesisCache = JSON.parse(tesisStr);
      }

      if (odalarStr) {
        const odalarData = JSON.parse(odalarStr);
        Object.entries(odalarData).forEach(([key, value]) => {
          this.odalarCache.set(key, value as OdaData[]);
        });
      }

      if (misafirlerStr) {
        this.misafirlerCache = JSON.parse(misafirlerStr);
      }

      if (lastSyncStr) {
        this.lastSync = new Date(lastSyncStr);
      }

      logger.log('Cache loaded', {
        hasTesis: !!this.tesisCache,
        odalarFilters: this.odalarCache.size,
        hasMisafirler: !!this.misafirlerCache,
        lastSync: this.lastSync,
      });
    } catch (error) {
      logger.error('Cache load error', error);
    }
  }

  /**
   * Cache'i kaydet
   */
  private async saveCache() {
    try {
      const odalarData: Record<string, OdaData[]> = {};
      this.odalarCache.forEach((value, key) => {
        odalarData[key] = value;
      });

      await Promise.all([
        this.tesisCache
          ? AsyncStorage.setItem(CACHE_KEYS.TESIS, JSON.stringify(this.tesisCache))
          : Promise.resolve(),
        AsyncStorage.setItem(CACHE_KEYS.ODALAR, JSON.stringify(odalarData)),
        this.misafirlerCache
          ? AsyncStorage.setItem(CACHE_KEYS.MISAFIRLER, JSON.stringify(this.misafirlerCache))
          : Promise.resolve(),
        AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString()),
      ]);

      logger.log('Cache saved');
    } catch (error) {
      logger.error('Cache save error', error);
    }
  }

  /**
   * Cache geçerli mi kontrol et
   */
  isCacheValid(): boolean {
    if (!this.lastSync) return false;
    const now = new Date();
    const diff = now.getTime() - this.lastSync.getTime();
    return diff < CACHE_DURATION;
  }

  /**
   * Listener ekle
   */
  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Unsubscribe fonksiyonu döndür
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Event yayınla
   */
  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Listener error', error);
        }
      });
    }
  }

  /** Odalar listesinden misafirleri türet, cache + emit (sadece filtre=tumu sonrası çağrılır). */
  private async deriveAndEmitMisafirlerFromOdalar(odalar: OdaData[]): Promise<void> {
    const misafirler: MisafirData[] = odalar
      .filter((oda) => oda.misafir)
      .map((oda) => ({
        id: oda.misafir!.id,
        ad: oda.misafir!.ad,
        soyad: oda.misafir!.soyad,
        kimlikNo: '',
        pasaportNo: undefined,
        dogumTarihi: '',
        uyruk: '',
        girisTarihi: oda.misafir!.girisTarihi,
        cikisTarihi: oda.misafir!.cikisTarihi,
        odaId: oda.id,
        odaNumarasi: oda.odaNumarasi,
      }));
    this.misafirlerCache = misafirler;
    await this.saveCache();
    this.emit('misafirler:updated', misafirler);
  }

  /**
   * Cache'den misafir listesini al (hemen gösterim için)
   */
  getCachedMisafirler(): MisafirData[] | null {
    return this.misafirlerCache;
  }

  /**
   * Arka planda tesis verisini yenile; bittiğinde emit('tesis:updated')
   */
  private async refreshTesisInBackground(): Promise<void> {
    try {
      const accessToken = await getAccessToken();
      const backendUrl = getApiBaseUrl();
      if (backendUrl) {
        const url = `${backendUrl}/api/tesis`;
        const r = await fetch(url, {
          method: 'GET',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          const tesisData: TesisData = {
            id: data.tesis.id,
            tesisAdi: data.tesis.tesisAdi,
            paket: data.tesis.paket,
            kota: data.tesis.kota,
            kullanilanKota: data.tesis.kullanilanKota ?? 0,
            kbsTuru: data.tesis.kbsTuru,
            kbsConnected: data.tesis.kbsConnected ?? !!data.tesis.kbsTuru,
            ozet: data.ozet,
          };
          this.tesisCache = tesisData;
          await this.saveCache();
          this.emit('tesis:updated', tesisData);
          logger.log('Background tesis refresh done');
        }
        return;
      }
      const responseData = await callFn<{ tesis: any; ozet: any }>('facilities_list', {}, accessToken);
      const tesisData: TesisData = {
        id: responseData.tesis.id,
        tesisAdi: responseData.tesis.tesisAdi,
        paket: responseData.tesis.paket,
        kota: responseData.tesis.kota,
        kullanilanKota: responseData.tesis.kullanilanKota,
        kbsTuru: responseData.tesis.kbsTuru,
        kbsConnected: responseData.tesis.kbsConnected,
        address: responseData.tesis.address,
        latitude: responseData.tesis.latitude,
        longitude: responseData.tesis.longitude,
        ozet: responseData.ozet,
      };
      this.tesisCache = tesisData;
      await this.saveCache();
      this.emit('tesis:updated', tesisData);
      logger.log('Background tesis refresh done');
    } catch (e: any) {
      logger.error('Background tesis refresh error', e);
    }
  }

  /**
   * Tesis bilgilerini getir (önce Node backend dene, yoksa Edge)
   * forceRefresh=true ve cache varsa: hemen cache döner, arka planda yenilenir (stale-while-revalidate).
   */
  async getTesis(forceRefresh = false): Promise<TesisData | null> {
    try {
      // Disk cache yüklenene kadar bekle (cold start'ta önce cache'den gösterebilmek için)
      await this.cacheReadyPromise;
      // Cache geçerliyse ve force refresh değilse cache'den dön
      if (!forceRefresh && this.isCacheValid() && this.tesisCache) {
        logger.log('Returning tesis from cache');
        return this.tesisCache;
      }
      // Stale-while-revalidate: cache varsa hemen dön (geçerli veya süresi dolmuş), arka planda yenile
      if (this.tesisCache) {
        const cached = this.tesisCache;
        this.refreshTesisInBackground().catch(() => {});
        return cached;
      }

      const accessToken = await getAccessToken();
      const backendUrl = getApiBaseUrl();

      // Backend URL varsa sadece Node kullan (Edge Supabase JWT bekler; Node JWT ile 401 alınır)
      if (backendUrl) {
        const url = `${backendUrl}/api/tesis`;
        console.log('[REQUEST] fullUrl=', url);
        logger.log('Fetching tesis from API (Node)');
        const r = await fetch(url, {
          method: 'GET',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const data = await r.json().catch(() => ({}));
        console.log('[REQUEST] status=', r.status, 'ok=', (data as { ok?: boolean })?.ok, 'code=', (data as { code?: string })?.code, 'message=', (data as { message?: string })?.message);
        if (r.ok) {
          const tesisData: TesisData = {
            id: data.tesis.id,
            tesisAdi: data.tesis.tesisAdi,
            paket: data.tesis.paket,
            kota: data.tesis.kota,
            kullanilanKota: data.tesis.kullanilanKota ?? 0,
            kbsTuru: data.tesis.kbsTuru,
            kbsConnected: data.tesis.kbsConnected ?? !!data.tesis.kbsTuru,
            ozet: data.ozet,
          };
          this.tesisCache = tesisData;
          await this.saveCache();
          this.emit('tesis:updated', tesisData);
          return tesisData;
        }
        if (r.status === 409 && (data as { code?: string })?.code === 'BRANCH_NOT_ASSIGNED') {
          logger.log('Tesis skipped: branch not assigned yet');
          return this.tesisCache || null;
        }
        const errData = data as { message?: string; error?: string };
        const msg = errData?.message || errData?.error || 'Tesis alınamadı';
        throw Object.assign(new Error(msg), { response: { status: r.status, data: errData } });
      }

      logger.log('Fetching tesis from API (Supabase)');
      logger.log('[dataService] facilities_list çağrılıyor', { hasToken: !!accessToken });
      const responseData = await callFn<{ tesis: any; ozet: any }>('facilities_list', {}, accessToken);
      const tesisData: TesisData = {
        id: responseData.tesis.id,
        tesisAdi: responseData.tesis.tesisAdi,
        paket: responseData.tesis.paket,
        kota: responseData.tesis.kota,
        kullanilanKota: responseData.tesis.kullanilanKota,
        kbsTuru: responseData.tesis.kbsTuru,
        kbsConnected: responseData.tesis.kbsConnected,
        address: responseData.tesis.address,
        latitude: responseData.tesis.latitude,
        longitude: responseData.tesis.longitude,
        ozet: responseData.ozet,
      };

      this.tesisCache = tesisData;
      await this.saveCache();
      this.emit('tesis:updated', tesisData);

      return tesisData;
    } catch (error: any) {
      if (error?.response?.status === 409 && error?.response?.data?.code === 'BRANCH_NOT_ASSIGNED') {
        logger.log('Returning tesis fallback for unassigned branch');
        return this.tesisCache || null;
      }
      logger.error('Get tesis error', error);

      if (this.tesisCache) {
        logger.log('Returning tesis from cache due to error');
        return this.tesisCache;
      }

      throw error;
    }
  }

  /**
   * Arka planda odaları yenile; bittiğinde emit('odalar:updated') ve filtre=tumu ise emit('misafirler:updated')
   */
  private async refreshOdalarInBackground(filtre: string): Promise<void> {
    const cacheKey = `odalar:${filtre}`;
    try {
      const accessToken = await getAccessToken();
      const backendUrl = getApiBaseUrl();
      if (backendUrl) {
        const url = `${backendUrl}/api/oda?filtre=${encodeURIComponent(filtre)}`;
        const r = await fetch(url, {
          method: 'GET',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const raw = await r.text();
        if (!r.ok) return; // 429 vb. – arka planda sessizce atla, cache kullanılmaya devam eder
        let data: any = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          return; // JSON parse hatası (örn. rate limit düz metin yanıtı) – sessizce çık
        }
        const odalar: OdaData[] = (data.odalar || []).map((oda: any) => ({
          id: oda.id,
          odaNumarasi: oda.odaNumarasi,
          odaTipi: oda.odaTipi || 'Standart Oda',
          kapasite: oda.kapasite || 2,
          fotograf: oda.fotograf,
          durum: oda.durum || 'bos',
          fiyat: oda.fiyat,
          odadaMi: oda.odadaMi ?? (oda.durum === 'dolu' && !!oda.misafir),
          misafir: oda.misafir
            ? {
                id: oda.misafir.id,
                ad: oda.misafir.ad,
                soyad: oda.misafir.soyad,
                girisTarihi: oda.misafir.girisTarihi,
                cikisTarihi: oda.misafir.cikisTarihi,
              }
            : undefined,
          kbsDurumu: oda.kbsDurumu,
          kbsHataMesaji: oda.kbsHataMesaji,
        }));
        this.odalarCache.set(cacheKey, odalar);
        await this.saveCache();
        this.emit('odalar:updated', { filtre, odalar });
        if (filtre === 'tumu') await this.deriveAndEmitMisafirlerFromOdalar(odalar);
        logger.log('[odalar] background refresh done', { filtre, count: odalar.length });
        return;
      }
      const odalarResponse = await callFn<{ odalar?: any[] }>('rooms_list', { filtre }, accessToken);
      const odalar: OdaData[] = (odalarResponse?.odalar || []).map((oda: any) => ({
        id: oda.id,
        odaNumarasi: oda.odaNumarasi,
        odaTipi: oda.odaTipi || 'Standart Oda',
        kapasite: oda.kapasite || 2,
        fotograf: oda.fotograf,
        durum: oda.durum || 'bos',
        fiyat: oda.fiyat,
        odadaMi: oda.odadaMi ?? (oda.durum === 'dolu' && !!oda.misafir),
        misafir: oda.misafir
          ? {
              id: oda.misafir.id,
              ad: oda.misafir.ad,
              soyad: oda.misafir.soyad,
              girisTarihi: oda.misafir.girisTarihi,
              cikisTarihi: oda.misafir.cikisTarihi,
            }
          : undefined,
        kbsDurumu: oda.kbsDurumu,
        kbsHataMesaji: oda.kbsHataMesaji,
      }));
      this.odalarCache.set(cacheKey, odalar);
      await this.saveCache();
      this.emit('odalar:updated', { filtre, odalar });
      if (filtre === 'tumu') await this.deriveAndEmitMisafirlerFromOdalar(odalar);
      logger.log('[odalar] background refresh done', { filtre, count: odalar.length });
    } catch (e: any) {
      logger.error('Background odalar refresh error', e);
    }
  }

  /**
   * Odaları getir (filtreli) – önce Node backend dene, yoksa Edge
   * forceRefresh=true ve cache varsa: hemen cache döner, arka planda yenilenir (stale-while-revalidate).
   */
  async getOdalar(filtre: string = 'tumu', forceRefresh = false): Promise<OdaData[]> {
    const STEP = { CACHE: 'cache', TOKEN: 'token', NODE_REQUEST: 'node_request', NODE_PARSE: 'node_parse', SUPABASE_CALL: 'supabase_call', MAP: 'map' };
    const cacheKey = `odalar:${filtre}`;
    let lastStep = '';

    try {
      // Disk cache yüklenene kadar bekle (cold start'ta önce cache'den gösterebilmek için)
      await this.cacheReadyPromise;
      lastStep = STEP.CACHE;
      if (!forceRefresh && this.isCacheValid() && this.odalarCache.has(cacheKey)) {
        const cached = this.odalarCache.get(cacheKey);
        if (cached) {
          logger.log('[odalar] cache hit', { filtre, count: cached.length, step: STEP.CACHE });
          return cached;
        }
      }
      // Stale-while-revalidate: cache varsa hemen dön (geçerli veya süresi dolmuş), arka planda yenile
      if (this.odalarCache.has(cacheKey)) {
        const cached = this.odalarCache.get(cacheKey)!;
        this.refreshOdalarInBackground(filtre).catch(() => {});
        return cached;
      }

      lastStep = STEP.TOKEN;
      const accessToken = await getAccessToken();
      const backendUrl = getApiBaseUrl();
      logger.log('[odalar] kaynak seçiliyor', { step: STEP.TOKEN, hasBackendUrl: !!backendUrl, hasToken: !!accessToken, filtre });

      if (backendUrl) {
        lastStep = STEP.NODE_REQUEST;
        const url = `${backendUrl}/api/oda?filtre=${encodeURIComponent(filtre)}`;
        logger.log('[odalar] Node API isteği', { step: lastStep, url });
        const r = await fetch(url, {
          method: 'GET',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        lastStep = STEP.NODE_PARSE;
        let data: any = {};
        const raw = await r.text();
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (parseErr: any) {
          // 429 ve diğer hatalarda sunucu bazen JSON yerine düz metin döner (örn. "Too many requests, please try again later.")
          if (r.status === 429 && this.odalarCache.has(cacheKey)) {
            const cached = this.odalarCache.get(cacheKey)!;
            logger.warn('[odalar] 429 (rate limit), cache kullanılıyor', { filtre, count: cached.length });
            return cached;
          }
          const msg = r.status === 429
            ? (raw && raw.length < 200 ? raw : 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.')
            : `Sunucu yanıtı okunamadı (HTTP ${r.status}).`;
          logger.error('[odalar] Node yanıt parse hatası', { step: lastStep, status: r.status, rawPreview: (raw || '').slice(0, 200), parseError: parseErr?.message });
          throw Object.assign(new Error(`Odalar yüklenirken: ${msg}`), { response: { status: r.status, data: {} }, step: lastStep });
        }
        logger.log('[odalar] Node yanıt', { step: lastStep, status: r.status, hasOdalar: Array.isArray(data?.odalar), odalarLength: data?.odalar?.length ?? 0, code: data?.code, message: data?.message });

        if (!r.ok) {
          if (r.status === 409 && data?.code === 'BRANCH_NOT_ASSIGNED') {
            logger.log('[odalar] branch not assigned yet, returning empty list or cache', { filtre, hasCache: this.odalarCache.has(cacheKey) });
            if (this.odalarCache.has(cacheKey)) return this.odalarCache.get(cacheKey)!;
            return [];
          }
          if (r.status === 429 && this.odalarCache.has(cacheKey)) {
            const cached = this.odalarCache.get(cacheKey)!;
            logger.warn('[odalar] 429 (rate limit), cache kullanılıyor', { filtre, count: cached.length });
            return cached;
          }
          const msg = (data?.message || data?.error) || (r.status === 429 ? 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.' : `HTTP ${r.status}`);
          const code = data?.code || (r.status === 401 ? 'UNAUTHORIZED' : r.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
          logger.error('[odalar] Node API hatası', { step: lastStep, status: r.status, code, message: msg });
          throw Object.assign(new Error(`Odalar yüklenirken: ${msg} (Node API, ${r.status}).`), { response: { status: r.status, data: { ...data, code } }, step: lastStep });
        }

        lastStep = STEP.MAP;
        const odalar: OdaData[] = (data.odalar || []).map((oda: any) => ({
          id: oda.id,
          odaNumarasi: oda.odaNumarasi,
          odaTipi: oda.odaTipi || 'Standart Oda',
          kapasite: oda.kapasite || 2,
          fotograf: oda.fotograf,
          durum: oda.durum || 'bos',
          fiyat: oda.fiyat,
          odadaMi: oda.odadaMi ?? (oda.durum === 'dolu' && !!oda.misafir),
          misafir: oda.misafir
            ? {
                id: oda.misafir.id,
                ad: oda.misafir.ad,
                soyad: oda.misafir.soyad,
                girisTarihi: oda.misafir.girisTarihi,
                cikisTarihi: oda.misafir.cikisTarihi,
              }
            : undefined,
          kbsDurumu: oda.kbsDurumu,
          kbsHataMesaji: oda.kbsHataMesaji,
        }));
        this.odalarCache.set(cacheKey, odalar);
        await this.saveCache();
        this.emit('odalar:updated', { filtre, odalar });
        if (filtre === 'tumu') await this.deriveAndEmitMisafirlerFromOdalar(odalar);
        logger.log('[odalar] Node ile tamamlandı', { step: lastStep, count: odalar.length });
        return odalar;
      }

      lastStep = STEP.SUPABASE_CALL;
      logger.log('[odalar] Supabase rooms_list çağrılıyor', { step: lastStep, filtre, hasToken: !!accessToken });
      const odalarResponse = await callFn<{ odalar?: any[] }>('rooms_list', { filtre }, accessToken);
      lastStep = STEP.MAP;
      const odalar: OdaData[] = (odalarResponse?.odalar || []).map((oda: any) => ({
        id: oda.id,
        odaNumarasi: oda.odaNumarasi,
        odaTipi: oda.odaTipi || 'Standart Oda',
        kapasite: oda.kapasite || 2,
        fotograf: oda.fotograf,
        durum: oda.durum || 'bos',
        fiyat: oda.fiyat,
        odadaMi: oda.odadaMi ?? (oda.durum === 'dolu' && !!oda.misafir),
        misafir: oda.misafir
          ? {
              id: oda.misafir.id,
              ad: oda.misafir.ad,
              soyad: oda.misafir.soyad,
              girisTarihi: oda.misafir.girisTarihi,
              cikisTarihi: oda.misafir.cikisTarihi,
            }
          : undefined,
        kbsDurumu: oda.kbsDurumu,
        kbsHataMesaji: oda.kbsHataMesaji,
      }));
      this.odalarCache.set(cacheKey, odalar);
      await this.saveCache();
      this.emit('odalar:updated', { filtre, odalar });
      if (filtre === 'tumu') await this.deriveAndEmitMisafirlerFromOdalar(odalar);
      logger.log('[odalar] Supabase ile tamamlandı', { step: lastStep, count: odalar.length });
      return odalar;
    } catch (error: any) {
      const step = error?.step ?? lastStep;
      const status = error?.response?.status;
      const code = error?.response?.data?.code;
      const hasCache = this.odalarCache.has(cacheKey);
      const useCache = hasCache && this.odalarCache.get(cacheKey);
      const is429WithCache = status === 429 && useCache;
      if (is429WithCache) {
        logger.warn('[odalar] 429, cache ile devam', { filtre, count: useCache.length });
        return useCache;
      }
      if (status === 409 && code === 'BRANCH_NOT_ASSIGNED') {
        logger.log('[odalar] branch not assigned fallback', { filtre, hasCache });
        return useCache || [];
      }
      logger.error('[odalar] hata', {
        step,
        message: error?.message,
        status,
        code,
        name: error?.name,
        stack: error?.stack?.split('\n').slice(0, 3),
      });

      if (hasCache && useCache) {
        logger.log('[odalar] hata sonrası cache fallback', { filtre, count: useCache.length });
        return useCache;
      }

      const friendlyMessage = error?.message || `Odalar yüklenemedi (adım: ${step}).`;
      throw Object.assign(new Error(friendlyMessage), { response: error?.response, step, code: error?.code ?? code });
    }
  }

  /**
   * Misafirleri getir
   * forceRefresh=true ve cache varsa: hemen cache döner, arka planda odalar(tumu) yenilenir ve misafirler güncellenir.
   */
  async getMisafirler(forceRefresh = false): Promise<MisafirData[]> {
    try {
      await this.cacheReadyPromise;
      // Cache geçerliyse ve force refresh değilse cache'den dön
      if (!forceRefresh && this.isCacheValid() && this.misafirlerCache) {
        logger.log('Returning misafirler from cache', { count: this.misafirlerCache.length });
        return this.misafirlerCache;
      }
      // Stale-while-revalidate: cache varsa hemen dön, arka planda odalar(tumu) yenilenir → misafirler:updated emit edilir
      if (forceRefresh && this.misafirlerCache) {
        const cached = this.misafirlerCache;
        this.refreshOdalarInBackground('tumu').catch(() => {});
        return cached;
      }

      logger.log('Fetching misafirler from API');
      // Önce gerçek zamanlı KBS kaynaklı aktif misafirler (Supabase guests) dene
      const backendUrl = getApiBaseUrl();
      const accessToken = await getAccessToken();
      if (backendUrl && accessToken) {
        try {
          const r = await fetch(`${backendUrl}/api/aktif-misafirler`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = (await r.json().catch(() => ({}))) as { toplam?: number; misafirler?: Array<{ id: string; full_name?: string; room_number?: string; checkin_at?: string; document_type?: string; document_no?: string; nationality?: string; birth_date?: string }> };
          const list = data?.misafirler ?? [];
          if (r.ok && list.length >= 0) {
            const misafirler: MisafirData[] = list.map((m) => {
              const parts = (m.full_name || '').trim().split(/\s+/);
              const ad = parts.slice(0, -1).join(' ') || m.full_name || '';
              const soyad = parts.slice(-1)[0] || '—';
              return {
                id: m.id,
                ad,
                soyad,
                kimlikNo: m.document_type === 'tc' ? (m.document_no || '') : '',
                pasaportNo: m.document_type === 'pasaport' ? m.document_no : undefined,
                dogumTarihi: m.birth_date || '',
                uyruk: m.nationality || '',
                girisTarihi: m.checkin_at || '',
                cikisTarihi: undefined,
                odaId: m.id,
                odaNumarasi: (m.room_number || '').toString().trim() || '—',
              };
            });
            this.misafirlerCache = misafirler;
            await this.saveCache();
            this.emit('misafirler:updated', misafirler);
            return misafirler;
          }
        } catch (_) {
          // Aktif-misafirler yoksa veya hata verirse odalardan türet
        }
      }
      const odalar = await this.getOdalar('tumu', forceRefresh);
      const misafirler: MisafirData[] = odalar
        .filter((oda) => oda.misafir)
        .map((oda) => ({
          id: oda.misafir!.id,
          ad: oda.misafir!.ad,
          soyad: oda.misafir!.soyad,
          kimlikNo: '', // Backend'den gelmiyor
          pasaportNo: undefined,
          dogumTarihi: '',
          uyruk: '',
          girisTarihi: oda.misafir!.girisTarihi,
          cikisTarihi: oda.misafir!.cikisTarihi,
          odaId: oda.id,
          odaNumarasi: oda.odaNumarasi,
        }));

      this.misafirlerCache = misafirler;
      await this.saveCache();
      this.emit('misafirler:updated', misafirler);

      return misafirler;
    } catch (error: any) {
      logger.error('Get misafirler error', error);

      // Hata durumunda cache'den dön
      if (this.misafirlerCache) {
        logger.log('Returning misafirler from cache due to error');
        return this.misafirlerCache;
      }

      throw error;
    }
  }

  /**
   * Tüm verileri senkronize et
   */
  async syncAll(forceRefresh = false): Promise<{
    tesis: TesisData | null;
    odalar: OdaData[];
    misafirler: MisafirData[];
  }> {
    if (this.syncInProgress && !forceRefresh) {
      logger.log('Sync already in progress, waiting...');
      // Mevcut sync bitene kadar bekle
      while (this.syncInProgress) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return {
        tesis: this.tesisCache,
        odalar: this.odalarCache.get('odalar:tumu') || [],
        misafirler: this.misafirlerCache || [],
      };
    }

    this.syncInProgress = true;
    try {
      logger.log('Starting full sync', { forceRefresh });

      const [tesis, odalar, misafirler] = await Promise.all([
        this.getTesis(forceRefresh),
        this.getOdalar('tumu', forceRefresh),
        this.getMisafirler(forceRefresh),
      ]);

      this.lastSync = new Date();
      await this.saveCache();
      this.emit('sync:completed', { tesis, odalar, misafirler });

      logger.log('Full sync completed', {
        hasTesis: !!tesis,
        odalarCount: odalar.length,
        misafirlerCount: misafirler.length,
      });

      return { tesis, odalar, misafirler };
    } catch (error) {
      logger.error('Sync error', error);
      this.emit('sync:error', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Oda güncelle (local cache)
   */
  updateOda(odaId: string, updates: Partial<OdaData>) {
    this.odalarCache.forEach((odalar, key) => {
      const updated = odalar.map((oda) => (oda.id === odaId ? { ...oda, ...updates } : oda));
      this.odalarCache.set(key, updated);
    });
    this.saveCache();
    this.emit('oda:updated', { odaId, updates });
  }

  /**
   * Sadece oda listesi cache'ini temizle (bildir sonrası güncel listeyi göstermek için).
   */
  invalidateOdalarCache() {
    this.odalarCache.clear();
    logger.log('[dataService] Odalar cache temizlendi');
    this.emit('cache:cleared');
  }

  /**
   * Cache'i temizle
   */
  async clearCache() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEYS.TESIS),
        AsyncStorage.removeItem(CACHE_KEYS.ODALAR),
        AsyncStorage.removeItem(CACHE_KEYS.MISAFIRLER),
        AsyncStorage.removeItem(CACHE_KEYS.LAST_SYNC),
      ]);

      this.tesisCache = null;
      this.odalarCache.clear();
      this.misafirlerCache = null;
      this.lastSync = null;

      logger.log('Cache cleared');
      this.emit('cache:cleared');
    } catch (error) {
      logger.error('Clear cache error', error);
    }
  }

  /**
   * Cache durumunu al
   */
  getCacheStatus() {
    return {
      hasTesis: !!this.tesisCache,
      odalarFilters: this.odalarCache.size,
      hasMisafirler: !!this.misafirlerCache,
      lastSync: this.lastSync,
      isValid: this.isCacheValid(),
    };
  }

  /**
   * Cache'den tesis verisini al (hata durumunda kullanım için)
   */
  /** Backend URL varsa 'backend', yoksa 'supabase'. Boot log için. */
  getMode(): 'backend' | 'supabase' | 'unknown' {
    try {
      const url = getApiBaseUrl();
      return url && url.length > 0 ? 'backend' : 'supabase';
    } catch {
      return 'unknown';
    }
  }

  getCachedTesis(): TesisData | null {
    return this.tesisCache;
  }

  /**
   * Cache'den odalar verisini al (hata durumunda kullanım için)
   */
  getCachedOdalar(filtre: string = 'tumu'): OdaData[] | null {
    const cacheKey = `odalar:${filtre}`;
    return this.odalarCache.get(cacheKey) || null;
  }
}

export const dataService = new DataService();


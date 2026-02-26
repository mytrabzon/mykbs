import { logger } from '../utils/logger';
import { getApiBaseUrl, getHealthUrl, isSupabaseConfigured } from '../config/api';
import { callFn } from '../lib/supabase/functions';

export interface BackendStatus {
  isOnline: boolean;
  lastChecked: Date | null;
  error?: string;
  /** Test edilen URL (debug) */
  testedUrl?: string;
  /** Son HTTP status (debug) */
  lastStatusCode?: number;
}

export interface SupabaseStatus {
  configured: boolean;
  isOnline: boolean;
  lastChecked: Date | null;
  error?: string;
}

class BackendHealthService {
  private status: BackendStatus = {
    isOnline: false,
    lastChecked: null,
  };

  private supabaseStatus: SupabaseStatus = {
    configured: false,
    isOnline: false,
    lastChecked: null,
  };

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(status: BackendStatus) => void> = [];
  private supabaseListeners: Array<(status: SupabaseStatus) => void> = [];

  async checkHealth(): Promise<BackendStatus> {
    const backendUrl = getApiBaseUrl();
    const healthUrl = getHealthUrl();
    try {
      if (backendUrl && healthUrl) {
        logger.log('Checking backend health (KBS Node backend)...', healthUrl);
        const res = await fetch(healthUrl, { method: 'GET' });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string };
        if (!res.ok || (data.ok !== true && data.status !== 'ok')) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        this.status = {
          isOnline: true,
          lastChecked: new Date(),
          error: undefined,
          testedUrl: healthUrl,
          lastStatusCode: res.status,
        };
      } else {
        logger.log('Checking backend health (Supabase Edge Functions)...');
        await callFn<{ status?: string }>('health', {});
        this.status = {
          isOnline: true,
          lastChecked: new Date(),
          error: undefined,
          testedUrl: 'Supabase Edge Functions',
          lastStatusCode: 200,
        };
      }
      if (__DEV__) {
        logger.log('Backend health OK', {
          healthUrl: healthUrl || this.status.testedUrl,
          backendStatus: this.status.isOnline,
          lastStatusCode: this.status.lastStatusCode,
        });
      } else {
        logger.log('Backend health check successful', this.status);
      }
      this.notifyListeners();
      return this.status;
    } catch (error: unknown) {
      const statusCode = (error as { response?: { status?: number } })?.response?.status;
      const isAuthError = statusCode === 401 || statusCode === 403;
      const message =
        error instanceof Error
          ? error.message
          : backendUrl
            ? 'Backend erişilemiyor'
            : 'Supabase erişilemiyor';
      logger.error('Backend health check failed', error);
      this.status = {
        isOnline: isAuthError ? true : false,
        lastChecked: new Date(),
        error: isAuthError ? undefined : message,
        testedUrl: healthUrl || undefined,
        lastStatusCode: statusCode,
      };
      this.notifyListeners();
      return this.status;
    }
  }

  /** Sadece Supabase Edge health kontrolü */
  async checkSupabaseHealth(): Promise<SupabaseStatus> {
    const configured = isSupabaseConfigured();
    this.supabaseStatus = { ...this.supabaseStatus, configured };
    if (!configured) {
      this.notifySupabaseListeners();
      return this.supabaseStatus;
    }
    try {
      await callFn<{ status?: string }>('health', {});
      this.supabaseStatus = {
        configured: true,
        isOnline: true,
        lastChecked: new Date(),
        error: undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Supabase erişilemiyor';
      this.supabaseStatus = {
        configured: true,
        isOnline: false,
        lastChecked: new Date(),
        error: message,
      };
    }
    this.notifySupabaseListeners();
    return this.supabaseStatus;
  }

  /** Backend + Supabase ikisini de kontrol et (paralel) */
  async checkAll(): Promise<{ backend: BackendStatus; supabase: SupabaseStatus }> {
    const [backend, supabase] = await Promise.all([
      this.checkHealth(),
      this.checkSupabaseHealth(),
    ]);
    return { backend, supabase };
  }

  getSupabaseStatus(): SupabaseStatus {
    return { ...this.supabaseStatus, configured: isSupabaseConfigured() };
  }

  onSupabaseStatusChange(listener: (status: SupabaseStatus) => void) {
    this.supabaseListeners.push(listener);
    return () => {
      this.supabaseListeners = this.supabaseListeners.filter((l) => l !== listener);
    };
  }

  private notifySupabaseListeners() {
    this.supabaseListeners.forEach((listener) => {
      try {
        listener(this.supabaseStatus);
      } catch (error) {
        logger.error('Error in supabase health listener', error);
      }
    });
  }

  startPeriodicCheck(intervalMs: number = 30000) {
    if (this.checkInterval) {
      this.stopPeriodicCheck();
    }
    const run = () => {
      this.checkHealth();
      if (isSupabaseConfigured()) this.checkSupabaseHealth();
    };
    run();
    this.checkInterval = setInterval(run, intervalMs);
    logger.log('Backend periodic health check started', { intervalMs });
  }

  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.log('Backend periodic health check stopped');
    }
  }

  getStatus(): BackendStatus {
    return { ...this.status };
  }

  onStatusChange(listener: (status: BackendStatus) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch (error) {
        logger.error('Error in backend health listener', error);
      }
    });
  }
}

export const backendHealth = new BackendHealthService();

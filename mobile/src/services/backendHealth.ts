import { logger } from '../utils/logger';
import { getApiBaseUrl, getHealthUrl } from '../config/api';
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

class BackendHealthService {
  private status: BackendStatus = {
    isOnline: false,
    lastChecked: null,
  };

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(status: BackendStatus) => void> = [];

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
      logger.log('Backend health check successful', this.status);
      this.notifyListeners();
      return this.status;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : backendUrl
            ? 'Backend erişilemiyor'
            : 'Supabase erişilemiyor';
      logger.error('Backend health check failed', error);
      this.status = {
        isOnline: false,
        lastChecked: new Date(),
        error: message,
        testedUrl: healthUrl || undefined,
        lastStatusCode: (error as { response?: { status?: number } })?.response?.status,
      };
      this.notifyListeners();
      return this.status;
    }
  }

  startPeriodicCheck(intervalMs: number = 30000) {
    if (this.checkInterval) {
      this.stopPeriodicCheck();
    }
    this.checkHealth();
    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
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

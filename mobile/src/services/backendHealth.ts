import { logger } from '../utils/logger';
import { callFn } from '../lib/supabase/functions';

function getBackendUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    return (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
  }
  try {
    const Constants = require('expo-constants').default;
    const url = Constants.expoConfig?.extra?.backendUrl ?? '';
    return String(url).replace(/\/$/, '');
  } catch {
    return '';
  }
}

export interface BackendStatus {
  isOnline: boolean;
  lastChecked: Date | null;
  error?: string;
}

class BackendHealthService {
  private status: BackendStatus = {
    isOnline: false,
    lastChecked: null,
  };

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(status: BackendStatus) => void> = [];

  async checkHealth(): Promise<BackendStatus> {
    const backendUrl = getBackendUrl();
    try {
      if (backendUrl) {
        logger.log('Checking backend health (KBS Node backend)...', backendUrl);
        const res = await fetch(`${backendUrl}/health`, { method: 'GET' });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string };
        if (!res.ok || (data.ok !== true && data.status !== 'ok')) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
      } else {
        logger.log('Checking backend health (Supabase Edge Functions)...');
        await callFn<{ status?: string }>('health', {});
      }
      this.status = {
        isOnline: true,
        lastChecked: new Date(),
      };
      logger.log('Backend health check successful', this.status);
      this.notifyListeners();
      return this.status;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (backendUrl ? 'Backend erişilemiyor' : 'Supabase erişilemiyor');
      logger.error('Backend health check failed', error);
      this.status = {
        isOnline: false,
        lastChecked: new Date(),
        error: message,
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

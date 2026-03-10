/**
 * Tek backend: Supabase Edge Functions.
 * api get/post/put arayüzü apiSupabase üzerinden sağlanır.
 */
import { api, setApiTokenProvider, setOnUnauthorized, getBackendUrl, getApiErrorMessage } from './apiSupabase';
import { logger } from '../utils/logger';

export { setApiTokenProvider, setOnUnauthorized, getBackendUrl, getApiErrorMessage };
export { api };

function buildFullUrl(path) {
  const base = getBackendUrl();
  if (!base) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}/api${p}`;
}

function logApiError(method, path, error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const msg = error?.message;
  const fullUrl = buildFullUrl(path);
  const detail = {
    method,
    path,
    fullUrl,
    status,
    message: msg,
    responseData: data,
  };
  if (status === 429) {
    detail.rateLimit = true;
    detail.hint = 'Çok fazla istek (429) – sunucu geçici sınır uyguluyor, lütfen kısa süre sonra tekrar deneyin.';
  }
  logger.error(`API ${method} Error`, detail);
}

/** 429 alındığında bekleyip tekrar dener (max 3 deneme). Auth path'lerinde retry yapılmaz (kotayı tüketmemek için). */
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;

function isAuthPath(path) {
  const p = typeof path === 'string' ? path : '';
  return p.startsWith('/auth') || p.startsWith('auth');
}

async function requestWithRetry(fn, path) {
  let lastError;
  const skipRetry429 = isAuthPath(path);
  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (status === 429) {
        if (skipRetry429) throw error;
        if (i >= RETRY_COUNT - 1) throw error;
        const waitMs = (i + 1) * RETRY_DELAY_MS;
        if (__DEV__) {
          logger.api?.('RETRY', path, null, { rateLimit: true, waitMs });
        }
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Request/response log (axios interceptor benzeri) + 429 retry
const originalGet = api.get.bind(api);
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);

api.get = async (path, config) => {
  try {
    logger.api('GET', path, null);
    const res = await requestWithRetry(() => originalGet(path, config), path);
    logger.api('GET', path, null, { status: 200, data: res.data });
    return res;
  } catch (error) {
    logApiError('GET', path, error);
    throw error;
  }
};

api.post = async (path, data, config) => {
  try {
    logger.api('POST', path, data);
    const res = await requestWithRetry(() => originalPost(path, data, config), path);
    logger.api('POST', path, null, { status: 200, data: res.data });
    return res;
  } catch (error) {
    logApiError('POST', path, error);
    throw error;
  }
};

api.put = async (path, data, config) => {
  try {
    logger.api('PUT', path, data);
    const res = await requestWithRetry(() => originalPut(path, data, config), path);
    logger.api('PUT', path, null, { status: 200, data: res.data });
    return res;
  } catch (error) {
    logApiError('PUT', path, error);
    throw error;
  }
};

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

// Request/response log (axios interceptor benzeri)
const originalGet = api.get.bind(api);
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);

api.get = async (path, config) => {
  try {
    logger.api('GET', path, null);
    const res = await originalGet(path, config);
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
    const res = await originalPost(path, data, config);
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
    const res = await originalPut(path, data, config);
    logger.api('PUT', path, null, { status: 200, data: res.data });
    return res;
  } catch (error) {
    logApiError('PUT', path, error);
    throw error;
  }
};

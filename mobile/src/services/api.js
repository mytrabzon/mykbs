/**
 * Tek backend: Supabase Edge Functions.
 * api get/post/put arayüzü apiSupabase üzerinden sağlanır.
 */
import { api, setApiTokenProvider, setOnUnauthorized } from './apiSupabase';
import { logger } from '../utils/logger';

export { setApiTokenProvider, setOnUnauthorized };
export { api };

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
    logger.error('API GET Error', { path, message: error?.message, response: error?.response });
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
    logger.error('API POST Error', { path, message: error?.message, response: error?.response });
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
    logger.error('API PUT Error', { path, message: error?.message, response: error?.response });
    throw error;
  }
};

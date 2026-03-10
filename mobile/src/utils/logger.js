// Test Modu Logger – log/info/debug sadece __DEV__'de (gürültüyü azaltır)
const TEST_MODE = true;
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
  log: (message, data = null) => {
    if (TEST_MODE && isDev) {
      console.log(`[LOG] ${message}`, data ?? '');
    }
  },

  error: (message, error = null) => {
    if (TEST_MODE) {
      console.error(`[ERROR] ${message}`, error ?? '');
    }
  },

  warn: (message, data = null) => {
    if (TEST_MODE) {
      console.warn(`[WARN] ${message}`, data ?? '');
    }
  },

  info: (message, data = null) => {
    if (TEST_MODE && isDev) {
      console.info(`[INFO] ${message}`, data ?? '');
    }
  },

  debug: (message, data = null) => {
    if (TEST_MODE && isDev) {
      console.log(`[DEBUG] ${message}`, data ?? '');
    }
  },

  button: (buttonName, action = 'clicked') => {
    if (TEST_MODE && isDev) {
      console.log(`[BUTTON] ${buttonName} ${action}`, new Date().toISOString());
    }
  },
  
  api: (method, url, data = null, response = null) => {
    if (TEST_MODE) {
      console.log(`[API] ${method} ${url}`, {
        request: data,
        response: response
      });
    }
  }
};


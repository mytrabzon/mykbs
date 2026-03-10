import { useState, useEffect } from 'react';

/**
 * Değeri geciktirir (debounce). Arama/input gibi sık değişen değerlerde
 * API isteklerini azaltmak için kullanılır.
 * @param {*} value - Debounce edilecek değer
 * @param {number} delay - Gecikme (ms)
 * @returns {*} - Gecikmiş değer
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

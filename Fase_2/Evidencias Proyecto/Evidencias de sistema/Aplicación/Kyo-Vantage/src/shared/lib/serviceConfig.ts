export const USE_MOCKS = import.meta.env?.VITE_USE_MOCKS === 'true' ||
  (typeof process !== 'undefined' && process.env?.VITE_USE_MOCKS === 'true');

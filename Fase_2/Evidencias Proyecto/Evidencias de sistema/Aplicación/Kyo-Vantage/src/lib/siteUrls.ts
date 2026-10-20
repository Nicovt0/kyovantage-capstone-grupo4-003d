function configuredUrl(value: string | undefined, fallback: string): string {
  return value?.replace(/\/$/, '') || fallback;
}

export function getAppUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_SITE_URL;
  return configuredUrl(envUrl, 'http://localhost:3000');
}

export function getLandingUrl(): string {
  const envUrl = import.meta.env.VITE_LANDING_URL || import.meta.env.VITE_SITE_URL;
  return configuredUrl(envUrl, 'http://localhost:3000');
}

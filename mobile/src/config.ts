import Constants from 'expo-constants';

// Backend port. The Go backend defaults to 8080.
const BACKEND_PORT = 8080;

// In Expo Go on a physical device, "localhost" points at the phone, not the dev
// machine. Constants.expoConfig.hostUri is the Metro bundler host (the dev
// machine's LAN IP), so we reuse its host and swap in the backend port. This
// makes the app reach the backend from a real phone with no manual IP editing.
function resolveApiUrl(): string {
  const override = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (override) return override;

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:${BACKEND_PORT}`;

  return `http://localhost:${BACKEND_PORT}`;
}

export const API_URL = resolveApiUrl();

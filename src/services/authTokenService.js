const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const EXPIRES_AT_KEY = 'expires_at';
const REFRESH_COUNT_KEY = 'refresh_count';

export function saveTokens({ accessToken, refreshToken, expiresAt }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  localStorage.setItem(REFRESH_COUNT_KEY, '0');
}

export function loadTokens() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || null;
  const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY);
  const refreshCountRaw = localStorage.getItem(REFRESH_COUNT_KEY);

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
    refreshCount: refreshCountRaw ? Number(refreshCountRaw) : 0,
  };
}

export function updateAccessToken({ accessToken, expiresAt, refreshToken }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (expiresAt) {
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  const current = Number(localStorage.getItem(REFRESH_COUNT_KEY) || '0') + 1;
  localStorage.setItem(REFRESH_COUNT_KEY, String(current));
  return current;
}

export function resetRefreshCount() {
  localStorage.setItem(REFRESH_COUNT_KEY, '0');
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_COUNT_KEY);
}
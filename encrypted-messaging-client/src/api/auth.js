import apiClient from './client.js';

function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('token', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

export async function login(username, password) {
  const response = await apiClient.post('/auth/login', { username, password });
  saveTokens(response);
  return response;
}

export async function register(username, password, publicKey, encryptedPrivateKeyBackup) {
  const response = await apiClient.post('/auth/register', {
    username,
    password,
    publicKey,
    encryptedPrivateKeyBackup: encryptedPrivateKeyBackup ?? undefined,
  });
  saveTokens(response);
  return response;
}

export async function restoreKeys(password) {
  return apiClient.post('/auth/restore-keys', { password });
}

export async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');
  const response = await apiClient.post('/auth/refresh', { refreshToken });
  saveTokens(response);
  return response;
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout', {
      refreshToken: localStorage.getItem('refreshToken'),
    });
  } catch (e) {
    console.error('Logout error:', e);
  }
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

export function getToken() {
  return localStorage.getItem('token');
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}

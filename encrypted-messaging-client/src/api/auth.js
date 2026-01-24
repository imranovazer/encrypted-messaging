import apiClient from './client.js';


export async function login(username, password) {
  const response = await apiClient.post('/auth/login', {
    username,
    password,
  });
  if (response.accessToken) {
    localStorage.setItem('token', response.accessToken);
  }
  if (response.refreshToken) {
    localStorage.setItem('refreshToken', response.refreshToken);
  }
  return response;
}

export async function register(
  username,
  password,
  publicKey,
  encryptedPrivateKeyBackup
) {
  const response = await apiClient.post('/auth/register', {
    username,
    password,
    publicKey,
    encryptedPrivateKeyBackup: encryptedPrivateKeyBackup ?? undefined,
  });
  if (response.accessToken) {
    localStorage.setItem('token', response.accessToken);
  }
  if (response.refreshToken) {
    localStorage.setItem('refreshToken', response.refreshToken);
  }
  return response;
}

export async function restoreKeys(password) {
  return apiClient.post('/auth/restore-keys', { password });
}

export async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const response = await apiClient.post('/auth/refresh', {
    refreshToken,
  });
  if (response.accessToken) {
    localStorage.setItem('token', response.accessToken);
  }
  return response;
}

export async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

export function getToken() {
  return localStorage.getItem('token');
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}

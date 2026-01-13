import apiClient from './client.js';

export async function register(username, password, publicKey) {
  return apiClient.post('/auth/register', {
    username,
    password,
    publicKey,
  });
}

export async function login(username, password) {
  const response = await apiClient.post('/auth/login', {
    username,
    password,
  });
  if (response.accessToken) {
    localStorage.setItem('token', response.accessToken);
  }
  return response;
}

export function logout() {
  localStorage.removeItem('token');
}

export function getToken() {
  return localStorage.getItem('token');
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}

import apiClient from './client.js';

export async function getCurrentUser() {
  return apiClient.get('/users/me');
}

export async function getUserPublicKey(userId) {
  const response = await apiClient.get(`/users/${userId}/public-key`);
  return response.publicKey;
}

export async function getAllUsers() {
  return apiClient.get('/users');
}

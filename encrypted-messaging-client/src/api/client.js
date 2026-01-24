import axios from 'axios';
import * as authApi from './auth.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(err, token = null) {
  failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  failedQueue = [];
}

function waitForToken() {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  });
}

async function refreshAndRetry(originalRequest) {
  originalRequest._retry = true;
  isRefreshing = true;
  try {
    const { accessToken } = await authApi.refreshToken();
    processQueue(null, accessToken);
    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
    return apiClient(originalRequest);
  } catch (e) {
    processQueue(e, null);
    authApi.logout();
    window.location.href = '/login';
    throw e;
  } finally {
    isRefreshing = false;
  }
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const req = error.config;
    const is401 = error.response?.status === 401 && !req._retry;

    if (is401) {
      if (isRefreshing) {
        try {
          const token = await waitForToken();
          req.headers.Authorization = `Bearer ${token}`;
          return apiClient(req);
        } catch (e) {
          return Promise.reject(e);
        }
      }
      return refreshAndRetry(req);
    }

    return Promise.reject(error.response?.data || error.message);
  }
);

export default apiClient;

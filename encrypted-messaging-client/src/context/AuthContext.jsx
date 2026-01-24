import { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth.js';
import * as usersApi from '../api/users.js';
import { decryptPrivateKeyFromBackup } from '../utils/crypto.js';
import { savePrivateKey, savePublicKey } from '../utils/keyStorage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authApi.isAuthenticated()) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadUser() {
    try {
      const userData = await usersApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
      authApi.logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const response = await authApi.login(username, password);
    const backup = response?.user?.encryptedPrivateKeyBackup;
    if (backup && typeof backup === 'string') {
      try {
        const parsed = JSON.parse(backup);
        const privateKeyPEM = await decryptPrivateKeyFromBackup(parsed, password);
        savePrivateKey(privateKeyPEM);
        if (response.user?.publicKey) {
          savePublicKey(response.user.publicKey);
        }
      } catch (e) {
        console.error('Failed to restore keys from backup:', e);
      }
    }
    await loadUser();
    return response;
  }

  function logout() {
    authApi.logout();
    setUser(null);
  }

  const value = {
    user,
    loading,
    login,
    logout,
    loadUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

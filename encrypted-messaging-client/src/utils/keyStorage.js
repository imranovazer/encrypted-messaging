const PRIVATE_KEY_STORAGE_KEY = 'encrypted_messaging_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'encrypted_messaging_public_key';

export function savePrivateKey(privateKeyPEM) {
  try {
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKeyPEM);
  } catch (error) {
    console.error('Failed to save private key:', error);
    throw new Error('Failed to save private key to localStorage');
  }
}

export function getPrivateKey() {
  try {
    return localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get private key:', error);
    return null;
  }
}

export function savePublicKey(publicKeyPEM) {
  try {
    localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, publicKeyPEM);
  } catch (error) {
    console.error('Failed to save public key:', error);
    throw new Error('Failed to save public key to localStorage');
  }
}

export function getPublicKey() {
  try {
    return localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get public key:', error);
    return null;
  }
}

export function hasKeys() {
  return getPrivateKey() !== null && getPublicKey() !== null;
}

export function clearKeys() {
  try {
    localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear keys:', error);
  }
}

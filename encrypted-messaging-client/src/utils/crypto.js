import forge from 'node-forge';

export async function generateRSAKeyPair() {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
      if (err) reject(err);
      else resolve(keypair);
    });
  });
}

export function exportPublicKey(keypair) {
  return forge.pki.publicKeyToPem(keypair.publicKey);
}

export function exportPrivateKey(keypair) {
  return forge.pki.privateKeyToPem(keypair.privateKey);
}

export function importPublicKey(pem) {
  return forge.pki.publicKeyFromPem(pem);
}

export function importPrivateKey(pem) {
  return forge.pki.privateKeyFromPem(pem);
}

export function encryptRSA(publicKey, data) {
  const encrypted = publicKey.encrypt(data, 'RSA-OAEP');
  return forge.util.encode64(encrypted);
}

export function decryptRSA(privateKey, encryptedData) {
  const decoded = forge.util.decode64(encryptedData);
  return privateKey.decrypt(decoded, 'RSA-OAEP');
}

export async function generateAESKey() {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportAESKey(key) {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

export async function importAESKey(keyBase64) {
  const keyBuffer = base64ToArrayBuffer(keyBase64);
  return await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptAES(message, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(message);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

export async function decryptAES(encrypted, key, iv) {
  const encryptedBuffer = base64ToArrayBuffer(encrypted);
  const ivBuffer = base64ToArrayBuffer(iv);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptMessage(message, recipientPublicKey, senderPublicKey = null) {
  const aesKey = await generateAESKey();
  const aesKeyBase64 = await exportAESKey(aesKey);
  const aesEncrypted = await encryptAES(message, aesKey);
  const encryptedAesKey = encryptRSA(recipientPublicKey, aesKeyBase64);
  
  let senderEncryptedAesKey = null;
  if (senderPublicKey) {
    senderEncryptedAesKey = encryptRSA(senderPublicKey, aesKeyBase64);
  }
  
  return {
    encryptedContent: JSON.stringify({
      data: aesEncrypted.encrypted,
      iv: aesEncrypted.iv,
    }),
    encryptedAesKey,
    senderEncryptedAesKey,
  };
}

export async function decryptMessage(encryptedContent, encryptedAesKey, privateKey) {
  const aesKeyBase64 = decryptRSA(privateKey, encryptedAesKey);
  const aesKey = await importAESKey(aesKeyBase64);
  const contentObj = JSON.parse(encryptedContent);
  return await decryptAES(contentObj.data, aesKey, contentObj.iv);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

const PBKDF2_ITERATIONS = 100_000;

async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder().encode(password);
  const key = await window.crypto.subtle.importKey(
    'raw',
    enc,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKeyForBackup(privateKeyPEM, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);
  const encoded = new TextEncoder().encode(privateKeyPEM);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encrypted),
  };
}

export async function decryptPrivateKeyFromBackup(backup, password) {
  const salt = new Uint8Array(base64ToArrayBuffer(backup.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(backup.iv));
  const data = base64ToArrayBuffer(backup.data);
  const key = await deriveKeyFromPassword(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

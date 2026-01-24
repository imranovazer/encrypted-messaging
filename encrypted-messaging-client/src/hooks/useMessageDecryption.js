import { useCallback } from 'react';
import { decryptMessage, importPrivateKey } from '../utils/crypto.js';
import { getPrivateKey } from '../utils/keyStorage.js';
import { MESSAGE_STATUS } from '../constants/messages.js';

async function decryptWithKey(message, encryptedKey) {
  const privateKeyPEM = getPrivateKey();
  if (!privateKeyPEM) return { ...message, decryptedContent: MESSAGE_STATUS.PRIVATE_KEY_NOT_FOUND };
  try {
    const key = importPrivateKey(privateKeyPEM);
    const decrypted = await decryptMessage(message.encryptedContent, encryptedKey, key);
    return { ...message, decryptedContent: decrypted };
  } catch (err) {
    console.error('Decrypt failed:', err);
    return { ...message, decryptedContent: MESSAGE_STATUS.FAILED };
  }
}

export function useMessageDecryption() {
  const decryptReceivedMessage = useCallback(
    (message) => decryptWithKey(message, message.encryptedAesKey),
    []
  );

  const decryptSentMessage = useCallback(async (message) => {
    if (!message.senderEncryptedAesKey) return { ...message, decryptedContent: MESSAGE_STATUS.SENT };
    return decryptWithKey(message, message.senderEncryptedAesKey);
  }, []);

  return { decryptReceivedMessage, decryptSentMessage };
}

import { useCallback } from 'react';
import { decryptMessage } from '../utils/crypto.js';
import { getPrivateKey } from '../utils/keyStorage.js';
import { importPrivateKey } from '../utils/crypto.js';
import { MESSAGE_STATUS } from '../constants/messages.js';

export function useMessageDecryption() {
  const decryptReceivedMessage = useCallback(async (message) => {
    const privateKeyPEM = getPrivateKey();
    if (!privateKeyPEM) {
      return { ...message, decryptedContent: MESSAGE_STATUS.PRIVATE_KEY_NOT_FOUND };
    }

    try {
      const privateKey = importPrivateKey(privateKeyPEM);
      const decrypted = await decryptMessage(
        message.encryptedContent,
        message.encryptedAesKey,
        privateKey
      );
      return { ...message, decryptedContent: decrypted };
    } catch (err) {
      console.error('Failed to decrypt received message:', err);
      return { ...message, decryptedContent: MESSAGE_STATUS.FAILED };
    }
  }, []);

  const decryptSentMessage = useCallback(async (message) => {
    if (!message.senderEncryptedAesKey) {
      return { ...message, decryptedContent: MESSAGE_STATUS.SENT };
    }

    const privateKeyPEM = getPrivateKey();
    if (!privateKeyPEM) {
      return { ...message, decryptedContent: MESSAGE_STATUS.PRIVATE_KEY_NOT_FOUND };
    }

    try {
      const privateKey = importPrivateKey(privateKeyPEM);
      const decrypted = await decryptMessage(
        message.encryptedContent,
        message.senderEncryptedAesKey,
        privateKey
      );
      return { ...message, decryptedContent: decrypted };
    } catch (err) {
      console.error('Failed to decrypt sent message:', err);
      return { ...message, decryptedContent: MESSAGE_STATUS.FAILED };
    }
  }, []);

  return {
    decryptReceivedMessage,
    decryptSentMessage,
  };
}

import apiClient from './client.js';

export async function sendMessage(recipientId, encryptedContent, encryptedAesKey, senderEncryptedAesKey) {
  return apiClient.post('/messages', {
    recipientId,
    encryptedContent,
    encryptedAesKey,
    senderEncryptedAesKey,
  });
}

export async function getConversation(userId) {
  return apiClient.get(`/messages/conversation/${userId}`);
}

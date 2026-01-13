import apiClient from './client.js';

export async function sendMessage(recipientId, encryptedContent, encryptedAesKey, signature) {
  return apiClient.post('/messages', {
    recipientId,
    encryptedContent,
    encryptedAesKey,
    signature,
  });
}

export async function getMessages() {
  return apiClient.get('/messages');
}

export async function getConversation(userId) {
  return apiClient.get(`/messages/conversation/${userId}`);
}

export async function getMessageById(messageId) {
  return apiClient.get(`/messages/${messageId}`);
}

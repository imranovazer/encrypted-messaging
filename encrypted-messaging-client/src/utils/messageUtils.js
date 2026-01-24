export function sortMessagesByTimestamp(messages) {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
  );
}

export function isMessageForUser(message, userId) {
  return message.recipientId === userId;
}

export function isMessageFromUser(message, userId) {
  return message.senderId === userId;
}

export function isMessageInConversation(message, userId, otherUserId) {
  if (!otherUserId) return false;
  const { senderId, recipientId } = message;
  return (
    (senderId === userId && recipientId === otherUserId) ||
    (senderId === otherUserId && recipientId === userId)
  );
}

export function replaceMessage(messages, messageId, replacement) {
  return messages.map((m) => (m.id === messageId ? replacement : m));
}

export function createTempMessage(text, sender, recipient) {
  return {
    id: `temp-${Date.now()}`,
    senderId: sender.id,
    recipientId: recipient.id,
    decryptedContent: text,
    sender: { id: sender.id, username: sender.username },
    recipient: { id: recipient.id, username: recipient.username },
    timestamp: new Date().toISOString(),
  };
}

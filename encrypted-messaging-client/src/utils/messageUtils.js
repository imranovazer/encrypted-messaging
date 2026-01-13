export function sortMessagesByTimestamp(messages) {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });
}

export function isMessageForUser(message, userId) {
  return message.recipientId === userId;
}

export function isMessageFromUser(message, userId) {
  return message.senderId === userId;
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

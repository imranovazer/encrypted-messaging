import { useEffect, useRef } from 'react';

export default function MessageList({ messages, currentUserId }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="text-center text-gray-500 mt-8">No messages yet. Start a conversation!</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      {messages.map((message) => {
        const isOwn = message.senderId === currentUserId;
        const senderLabel = isOwn ? 'You' : (message.sender?.username || 'Unknown');
        const bubbleClass = isOwn ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-900';
        const timeClass = isOwn ? 'text-indigo-200' : 'text-gray-500';
        const body = message.decryptedContent || (isOwn ? '[Sent]' : 'Decrypting...');
        const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';

        return (
          <div
            key={message.id}
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${bubbleClass}`}>
              <div className="text-sm font-medium mb-1">{senderLabel}</div>
              <div className="text-sm whitespace-pre-wrap break-words">{body}</div>
              <div className={`text-xs mt-1 ${timeClass}`}>{time}</div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

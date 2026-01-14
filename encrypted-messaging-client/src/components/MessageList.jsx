import { useEffect, useRef } from 'react';

export default function MessageList({ messages, currentUserId }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          No messages yet. Start a conversation!
        </div>
      ) : (
        <>
          {messages.map((message) => {
            const isOwn = message.senderId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {isOwn ? 'You' : message.sender?.username || 'Unknown'}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.decryptedContent || (isOwn ? '[Sent]' : 'Decrypting...')}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      isOwn ? 'text-indigo-200' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

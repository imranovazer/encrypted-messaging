import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import * as usersApi from '../api/users.js';
import * as messagesApi from '../api/messages.js';
import { importPublicKey, importPrivateKey, encryptMessage, decryptMessage } from '../utils/crypto.js';
import { getPrivateKey, getPublicKey } from '../utils/keyStorage.js';
import UserList from '../components/UserList.jsx';
import MessageList from '../components/MessageList.jsx';
import MessageInput from '../components/MessageInput.jsx';

export default function Chat() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleNewMessage = useCallback(async (message) => {
    if (!user?.id) {
      console.log('No user ID, ignoring message');
      return;
    }
    
    console.log('Handling new message:', message);
    
    const isForMe = message.recipientId === user.id;
    const isFromMe = message.senderId === user.id;
    
    if (!isForMe && !isFromMe) {
      console.log('Message not for me or from me, ignoring');
      return;
    }

    setMessages((prev) => {
      const existing = prev.find((m) => m.id === message.id);
      
      if (isForMe) {
        if (existing && existing.decryptedContent && existing.decryptedContent !== 'Decrypting...' && existing.decryptedContent !== 'Failed to decrypt') {
          console.log('Message already exists with decrypted content, skipping');
          return prev;
        }
        
        console.log('Decrypting message for me');
        const privateKeyPEM = getPrivateKey();
        if (!privateKeyPEM) {
          console.error('Private key not found');
          return [...prev.filter((m) => m.id !== message.id), { ...message, decryptedContent: 'Private key not found' }];
        }

        const privateKey = importPrivateKey(privateKeyPEM);
        decryptMessage(
          message.encryptedContent,
          message.encryptedAesKey,
          privateKey
        )
          .then((decrypted) => {
            console.log('Message decrypted successfully');
            setMessages((current) => {
              const exists = current.find((m) => m.id === message.id);
              if (exists && exists.decryptedContent && exists.decryptedContent !== 'Decrypting...') {
                return current;
              }
              return current.map((m) =>
                m.id === message.id ? { ...m, decryptedContent: decrypted } : m
              );
            });
          })
          .catch((err) => {
            console.error('Failed to decrypt message:', err);
            setMessages((current) =>
              current.map((m) =>
                m.id === message.id ? { ...m, decryptedContent: 'Failed to decrypt' } : m
              )
            );
          });

        const withoutExisting = prev.filter((m) => m.id !== message.id);
        return [...withoutExisting, { ...message, decryptedContent: 'Decrypting...' }];
      } else if (isFromMe) {
        if (existing) {
          if (existing.decryptedContent && existing.decryptedContent !== 'Decrypting...' && existing.decryptedContent !== '' && existing.decryptedContent !== '[Sent message]') {
            console.log('Updating existing sent message');
            return prev.map((m) => 
              m.id === message.id ? { ...message, decryptedContent: existing.decryptedContent } : m
            );
          }
          console.log('Message from me already exists, skipping');
          return prev;
        }
        
        if (message.senderEncryptedAesKey) {
          console.log('Decrypting sent message via WebSocket');
          const privateKeyPEM = getPrivateKey();
          if (privateKeyPEM) {
            const privateKey = importPrivateKey(privateKeyPEM);
            decryptMessage(
              message.encryptedContent,
              message.senderEncryptedAesKey,
              privateKey
            )
              .then((decrypted) => {
                setMessages((current) =>
                  current.map((m) =>
                    m.id === message.id ? { ...m, decryptedContent: decrypted } : m
                  )
                );
              })
              .catch((err) => {
                console.error('Failed to decrypt sent message:', err);
                setMessages((current) =>
                  current.map((m) =>
                    m.id === message.id ? { ...m, decryptedContent: 'Failed to decrypt' } : m
                  )
                );
              });
          }
          return [...prev.filter((m) => m.id !== message.id), { ...message, decryptedContent: 'Decrypting...' }];
        }
        
        console.log('Adding new message from me');
        return [...prev.filter((m) => m.id !== message.id), { ...message, decryptedContent: message.decryptedContent || '[Sent message]' }];
      }
      
      return prev;
    });
  }, [user?.id]);

  const { joinConversation, leaveConversation } = useWebSocket('chat', handleNewMessage);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadConversation();
      joinConversation(selectedUser.id);
      return () => {
        leaveConversation(selectedUser.id);
      };
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  async function loadUsers() {
    try {
      const usersData = await usersApi.getAllUsers();
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation() {
    if (!selectedUser) return;

    try {
      const conversation = await messagesApi.getConversation(selectedUser.id);
      const privateKeyPEM = getPrivateKey();
      
      if (!privateKeyPEM) {
        setError('Private key not found');
        return;
      }

      const privateKey = importPrivateKey(privateKeyPEM);
      const decryptedMessages = await Promise.all(
        conversation.map(async (msg) => {
          if (msg.recipientId === user.id) {
            try {
              const decrypted = await decryptMessage(
                msg.encryptedContent,
                msg.encryptedAesKey,
                privateKey
              );
              return { ...msg, decryptedContent: decrypted };
            } catch (err) {
              console.error('Failed to decrypt message:', err, msg);
              return { ...msg, decryptedContent: 'Failed to decrypt' };
            }
          } else if (msg.senderId === user.id && msg.senderEncryptedAesKey) {
            try {
              const decrypted = await decryptMessage(
                msg.encryptedContent,
                msg.senderEncryptedAesKey,
                privateKey
              );
              return { ...msg, decryptedContent: decrypted };
            } catch (err) {
              console.error('Failed to decrypt sent message:', err, msg);
              return { ...msg, decryptedContent: 'Failed to decrypt' };
            }
          } else {
            return { ...msg, decryptedContent: '[Sent message]' };
          }
        })
      );

      decryptedMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      setMessages(decryptedMessages);
    } catch (err) {
      setError('Failed to load conversation');
      console.error(err);
    }
  }

  async function handleSendMessage(text) {
    if (!selectedUser || !text.trim()) return;

    setSending(true);
    setError('');

    try {
      const recipientPublicKeyPEM = await usersApi.getUserPublicKey(selectedUser.id);
      const recipientPublicKey = importPublicKey(recipientPublicKeyPEM);
      
      const senderPublicKeyPEM = getPublicKey();
      const senderPublicKey = senderPublicKeyPEM ? importPublicKey(senderPublicKeyPEM) : null;

      const { encryptedContent, encryptedAesKey, senderEncryptedAesKey } = await encryptMessage(text, recipientPublicKey, senderPublicKey);

      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        senderId: user.id,
        recipientId: selectedUser.id,
        encryptedContent,
        encryptedAesKey,
        decryptedContent: text,
        sender: { id: user.id, username: user.username },
        recipient: { id: selectedUser.id, username: selectedUser.username },
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => {
        const updated = [...prev, tempMessage];
        return updated;
      });

      try {
        const newMessage = await messagesApi.sendMessage(
          selectedUser.id,
          encryptedContent,
          encryptedAesKey,
          senderEncryptedAesKey
        );

        const finalMessage = {
          id: newMessage.id,
          senderId: newMessage.senderId || user.id,
          recipientId: newMessage.recipientId || selectedUser.id,
          encryptedContent: newMessage.encryptedContent,
          encryptedAesKey: newMessage.encryptedAesKey,
          signature: newMessage.signature,
          timestamp: newMessage.timestamp || new Date().toISOString(),
          decryptedContent: text,
          sender: newMessage.sender || { id: user.id, username: user.username },
          recipient: newMessage.recipient || { id: selectedUser.id, username: selectedUser.username },
        };
        
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          const withoutDuplicate = withoutTemp.filter((m) => m.id !== newMessage.id);
          const updated = [...withoutDuplicate, finalMessage];
          updated.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeA - timeB;
          });
          return updated;
        });
      } catch (sendErr) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw sendErr;
      }
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Encrypted Messaging</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">Welcome, {user?.username}</span>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        <UserList
          users={users}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
          currentUserId={user?.id}
        />

        <div className="flex-1 flex flex-col bg-white">
          {selectedUser ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedUser.username}
                </h2>
              </div>
              <MessageList messages={messages} currentUserId={user?.id} />
              <MessageInput onSend={handleSendMessage} disabled={sending} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a user to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

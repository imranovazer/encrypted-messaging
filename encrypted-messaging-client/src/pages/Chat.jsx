import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useMessageDecryption } from '../hooks/useMessageDecryption.js';
import * as authApi from '../api/auth.js';
import * as usersApi from '../api/users.js';
import * as messagesApi from '../api/messages.js';
import {
  importPublicKey,
  encryptMessage,
  decryptPrivateKeyFromBackup,
} from '../utils/crypto.js';
import { getPrivateKey, getPublicKey, savePrivateKey, savePublicKey } from '../utils/keyStorage.js';
import {
  sortMessagesByTimestamp,
  isMessageForUser,
  isMessageFromUser,
  isMessageInConversation,
  replaceMessage,
  createTempMessage,
} from '../utils/messageUtils.js';
import { parseJsonIfString } from '../utils/parse.js';
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants/messages.js';
import UserList from '../components/UserList.jsx';
import MessageList from '../components/MessageList.jsx';
import MessageInput from '../components/MessageInput.jsx';
import RestoreKeysForm from '../components/RestoreKeysForm.jsx';

export default function Chat() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);

  const { decryptReceivedMessage, decryptSentMessage } = useMessageDecryption();

  const someMessagesFailedToDecrypt =
    selectedUser && messages.some((m) => m.decryptedContent === MESSAGE_STATUS.FAILED);
  const needsKeyRestore =
    error === ERROR_MESSAGES.PRIVATE_KEY_NOT_FOUND || someMessagesFailedToDecrypt;
  const restoreReason =
    error === ERROR_MESSAGES.PRIVATE_KEY_NOT_FOUND ? 'no-key' : 'decryption-failed';

  const handleNewMessage = useCallback(async (message) => {
    if (!user?.id || !selectedUser) return;
    if (!isMessageInConversation(message, user.id, selectedUser.id)) return;

    const isForMe = isMessageForUser(message, user.id);
    const isFromMe = isMessageFromUser(message, user.id);

    setMessages((prev) => {
      const ex = prev.find((m) => m.id === message.id);
      const skipReceived = ex?.decryptedContent && ex.decryptedContent !== MESSAGE_STATUS.DECRYPTING && ex.decryptedContent !== MESSAGE_STATUS.FAILED;
      const skipFromMe = ex?.decryptedContent && ex.decryptedContent !== MESSAGE_STATUS.DECRYPTING && ex.decryptedContent !== '' && ex.decryptedContent !== MESSAGE_STATUS.SENT;

      if (isForMe) {
        if (skipReceived) return prev;
        const without = prev.filter((m) => m.id !== message.id);
        const placeholder = { ...message, decryptedContent: MESSAGE_STATUS.DECRYPTING };
        decryptReceivedMessage(message)
          .then((decrypted) => {
            setMessages((cur) => {
              const e = cur.find((m) => m.id === message.id);
              if (e?.decryptedContent && e.decryptedContent !== MESSAGE_STATUS.DECRYPTING) return cur;
              return replaceMessage(cur, message.id, decrypted);
            });
          })
          .catch(() => {
            setMessages((cur) => replaceMessage(cur, message.id, { ...message, decryptedContent: MESSAGE_STATUS.FAILED }));
          });
        return [...without, placeholder];
      }

      if (isFromMe) {
        if (skipFromMe) return replaceMessage(prev, message.id, { ...message, decryptedContent: ex.decryptedContent });
        if (ex) return prev;
        if (!message.senderEncryptedAesKey) {
          const without = prev.filter((m) => m.id !== message.id);
          return [...without, { ...message, decryptedContent: message.decryptedContent || MESSAGE_STATUS.SENT }];
        }
        const without = prev.filter((m) => m.id !== message.id);
        const placeholder = { ...message, decryptedContent: MESSAGE_STATUS.DECRYPTING };
        decryptSentMessage(message)
          .then((decrypted) => setMessages((cur) => replaceMessage(cur, message.id, decrypted)))
          .catch(() => setMessages((cur) => replaceMessage(cur, message.id, { ...message, decryptedContent: MESSAGE_STATUS.FAILED })));
        return [...without, placeholder];
      }

      return prev;
    });
  }, [user?.id, selectedUser?.id, decryptReceivedMessage, decryptSentMessage]);

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
      setError(ERROR_MESSAGES.FAILED_TO_LOAD_USERS);
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
        setError(ERROR_MESSAGES.PRIVATE_KEY_NOT_FOUND);
        return;
      }

      const decryptOne = async (msg) => {
        if (isMessageForUser(msg, user.id)) return decryptReceivedMessage(msg);
        if (isMessageFromUser(msg, user.id)) return decryptSentMessage(msg);
        return { ...msg, decryptedContent: MESSAGE_STATUS.SENT };
      };
      const decryptedMessages = await Promise.all(conversation.map(decryptOne));

      setMessages(sortMessagesByTimestamp(decryptedMessages));
    } catch (err) {
      setError(ERROR_MESSAGES.FAILED_TO_LOAD_CONVERSATION);
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

      const { encryptedContent, encryptedAesKey, senderEncryptedAesKey } = await encryptMessage(
        text,
        recipientPublicKey,
        senderPublicKey
      );

      const tempMessage = createTempMessage(text, user, selectedUser);
      tempMessage.encryptedContent = encryptedContent;
      tempMessage.encryptedAesKey = encryptedAesKey;

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const newMessage = await messagesApi.sendMessage(
          selectedUser.id,
          encryptedContent,
          encryptedAesKey,
          senderEncryptedAesKey
        );

        const finalMessage = {
          ...newMessage,
          decryptedContent: text,
          sender: newMessage.sender || { id: user.id, username: user.username },
          recipient: newMessage.recipient || { id: selectedUser.id, username: selectedUser.username },
        };

        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempMessage.id && m.id !== newMessage.id);
          return sortMessagesByTimestamp([...withoutTemp, finalMessage]);
        });
      } catch (sendErr) {
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
        throw sendErr;
      }
    } catch (err) {
      setError(ERROR_MESSAGES.FAILED_TO_SEND_MESSAGE);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  }

  async function handleRestoreKeys(e) {
    e.preventDefault();
    setRestoreError('');
    setRestoreLoading(true);
    try {
      const { encryptedPrivateKeyBackup, publicKey } = await authApi.restoreKeys(restorePassword);
      const backup = parseJsonIfString(encryptedPrivateKeyBackup);
      const privateKeyPEM = await decryptPrivateKeyFromBackup(backup, restorePassword);
      savePrivateKey(privateKeyPEM);
      if (publicKey) savePublicKey(publicKey);

      setError('');
      setRestoreError('');
      setRestorePassword('');
      if (selectedUser) loadConversation();
    } catch (err) {
      setRestoreError(err?.message || err?.response?.data?.message || 'Restore failed');
    } finally {
      setRestoreLoading(false);
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="bg-white shadow flex-shrink-0">
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
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 flex-shrink-0">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {needsKeyRestore && (
        <RestoreKeysForm
          reason={restoreReason}
          password={restorePassword}
          onPasswordChange={setRestorePassword}
          onSubmit={handleRestoreKeys}
          loading={restoreLoading}
          error={restoreError}
        />
      )}

      <div className="flex-1 flex max-w-7xl mx-auto w-full min-h-0 overflow-hidden">
        <UserList
          users={users}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
          currentUserId={user?.id}
        />

        <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
          {selectedUser ? (
            <>
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedUser.username}
                </h2>
              </div>
              <MessageList messages={messages} currentUserId={user?.id} />
              <div className="flex-shrink-0">
                <MessageInput onSend={handleSendMessage} disabled={sending} />
              </div>
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

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import * as authApi from '../api/auth.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useWebSocket(namespace, onMessage) {
  const socketRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const token = authApi.getToken();
    if (!token) {
      return;
    }

    const socket = io(`${API_URL}/${namespace}`, {
      auth: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.on('new-message', (message) => {
      if (onMessageRef.current) {
        onMessageRef.current(message);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [namespace]);

  const joinConversation = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-conversation', { userId });
    } else if (socketRef.current) {
      socketRef.current.once('connect', () => {
        socketRef.current.emit('join-conversation', { userId });
      });
    }
  };

  const leaveConversation = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-conversation', { userId });
    }
  };

  return { joinConversation, leaveConversation };
}

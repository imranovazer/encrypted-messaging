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
      console.log('No token found, skipping WebSocket connection');
      return;
    }

    console.log('Connecting to WebSocket...');
    const socket = io(`${API_URL}/${namespace}`, {
      auth: {
        token: token,
      },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.on('new-message', (message) => {
      console.log('Received new message via WebSocket:', message);
      if (onMessageRef.current) {
        onMessageRef.current(message);
      }
    });

    socketRef.current = socket;

    return () => {
      console.log('Cleaning up WebSocket connection');
      socket.disconnect();
    };
  }, [namespace]);

  const joinConversation = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('Joining conversation with user:', userId);
      socketRef.current.emit('join-conversation', { userId });
    } else {
      console.warn('Socket not connected, cannot join conversation');
      if (socketRef.current) {
        socketRef.current.once('connect', () => {
          console.log('Socket connected, joining conversation with user:', userId);
          socketRef.current.emit('join-conversation', { userId });
        });
      }
    }
  };

  const leaveConversation = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('Leaving conversation with user:', userId);
      socketRef.current.emit('leave-conversation', { userId });
    }
  };

  return { joinConversation, leaveConversation };
}

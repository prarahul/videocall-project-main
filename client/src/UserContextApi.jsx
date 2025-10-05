import { io } from 'socket.io-client';

// Update socket connection
const socket = io(
  process.env.NODE_ENV === 'production' 
    ? window.location.origin  // Use same domain in production
    : 'http://localhost:8000', // Use localhost in development
  {
    transports: ['websocket', 'polling'],
    timeout: 20000,
  }
);
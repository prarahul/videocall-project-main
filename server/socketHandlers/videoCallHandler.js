// Add these new event handlers to your existing socket handlers

// Store peer connections and room participants
const rooms = new Map();
const userSockets = new Map();

// Handle WebRTC signaling for meetings
io.on('connection', (socket) => {
  // ...existing code...

  // Join meeting room
  socket.on('join-meeting-room', (data) => {
    const { roomId, userId, userName } = data;
    
    // Join socket room
    socket.join(roomId);
    userSockets.set(userId, socket.id);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    
    const room = rooms.get(roomId);
    room.set(userId, {
      socketId: socket.id,
      userName,
      joinedAt: Date.now()
    });
    
    // Notify existing participants about new user
    socket.to(roomId).emit('user-joined-meeting', {
      userId,
      userName,
      socketId: socket.id
    });
    
    // Send existing participants to new user
    const participants = Array.from(room.entries())
      .filter(([id]) => id !== userId)
      .map(([id, info]) => ({
        userId: id,
        userName: info.userName,
        socketId: info.socketId
      }));
    
    socket.emit('existing-participants', participants);
    
    console.log(`User ${userName} joined room ${roomId}`);
  });

  // Handle WebRTC offer
  socket.on('webrtc-offer', (data) => {
    const { roomId, to, offer, from } = data;
    io.to(to).emit('webrtc-offer', {
      roomId,
      offer,
      from: socket.id,
      fromUserId: from
    });
  });

  // Handle WebRTC answer
  socket.on('webrtc-answer', (data) => {
    const { roomId, to, answer, from } = data;
    io.to(to).emit('webrtc-answer', {
      roomId,
      answer,
      from: socket.id,
      fromUserId: from
    });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { roomId, to, candidate, from } = data;
    io.to(to).emit('ice-candidate', {
      roomId,
      candidate,
      from: socket.id,
      fromUserId: from
    });
  });

  // Handle user leaving room
  socket.on('leave-meeting-room', (data) => {
    const { roomId, userId } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const userInfo = room.get(userId);
      
      if (userInfo) {
        room.delete(userId);
        userSockets.delete(userId);
        
        // Notify other participants
        socket.to(roomId).emit('user-left-meeting', {
          userId,
          userName: userInfo.userName
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
    
    socket.leave(roomId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Find and remove user from all rooms
    for (const [roomId, room] of rooms.entries()) {
      for (const [userId, userInfo] of room.entries()) {
        if (userInfo.socketId === socket.id) {
          room.delete(userId);
          userSockets.delete(userId);
          
          socket.to(roomId).emit('user-left-meeting', {
            userId,
            userName: userInfo.userName
          });
          
          if (room.size === 0) {
            rooms.delete(roomId);
          }
          break;
        }
      }
    }
  });
});
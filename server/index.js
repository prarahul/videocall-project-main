// Import required modules
import express from "express"; // Express.js framework to create the backend server
import dotenv from "dotenv"; // dotenv is used to load environment variables from a `.env` file
import cors from "cors"; // CORS (Cross-Origin Resource Sharing) allows frontend & backend communication
import cookieParser from "cookie-parser"; // Parses cookies from incoming requests
import { createServer } from "http"; // Creates an HTTP server (needed for WebSocket support)
import { Server } from "socket.io"; // Import `Server` from `socket.io` for real-time communication
import path from "path"; // Node.js module for working with file and directory paths

// Import custom route files
import authRoute from "./rout/authRout.js"; // Import authentication routes (login/signup)
import userRoute from "./rout/userRout.js"; // Import user-related routes (profile, settings)
import dbConnection from "./db/dbConnect.js"; // Import function to connect to MongoDB database

// ✅ Load environment variables (from `.env` file)
dotenv.config();

// 🌍 Create an Express application
const app = express(); 

// 🔧 Set up server port (from `.env` or default to 3000)
const PORT = process.env.PORT || 3000;

// 📡 Create an HTTP server to work with Express (needed for WebSockets)
const server = createServer(app);

// 🌍 Allowed frontend origins for CORS (Cross-Origin Resource Sharing)
const allowedOrigins = [process.env.FRONTEND_URL]; 
console.log(allowedOrigins); // Debugging: Check if the frontend URL is loaded properly

// 🔧 Middleware to handle CORS
app.use(cors({
  origin: function (origin, callback) { 
    if (!origin || allowedOrigins.includes(origin)) { 
      callback(null, true); // ✅ Allow the request if it's from an allowed origin
    } else {
      callback(new Error('Not allowed by CORS')); // ❌ Block requests from unknown origins
    }
  },
  credentials: true, // ✅ Allow sending cookies with requests
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // ✅ Allow these HTTP methods
}));

// 🛠 Middleware for handling JSON requests and cookies
app.use(express.json()); // Enables parsing of JSON request bodies
app.use(cookieParser()); // Enables reading cookies in HTTP requests

// 🔗 Define API routes
app.use("/api/auth", authRoute); // Authentication routes (login, signup, logout)
app.use("/api/user", userRoute); // User-related routes (profile, settings)

// ✅ Test Route to check if the server is running
app.get("/ok", (req, res) => {
  res.json({ message: "Server is running!" }); // Returns a JSON response
});

// 🔥 Initialize Socket.io for real-time communication
const io = new Server(server, {
  pingTimeout: 60000, // ⏳ Set timeout for inactive users (1 minute)
  cors: {
    origin: allowedOrigins[0], // ✅ Allow requests from the frontend URL
    methods: ["GET", "POST"], // ✅ Allow only these methods
  },
});
console.log("[SUCCESS] Socket.io initialized with CORS"); // Debugging message

// 🟢 Store online users and active calls
let onlineUsers = []; // Array to store online users
const activeCalls = new Map(); // Map to track ongoing calls
const meetingRooms = new Map(); // Map to track meeting rooms and their participants

// 🎯 Meeting room limits
const MEETING_LIMITS = {
  MAX_PARTICIPANTS_PER_ROOM: 50,    // Maximum participants per meeting room
  MAX_ROOMS_PER_SERVER: 1000,       // Maximum concurrent meeting rooms
  MAX_MESSAGE_LENGTH: 500,          // Maximum chat message length
  MAX_MESSAGES_PER_ROOM: 1000       // Maximum messages stored per room
};

// 📞 Handle WebSocket (Socket.io) connections
io.on("connection", (socket) => {
      console.log(`[INFO] New connection: ${socket.id}`); // Debugging: User connected
    
    // Test socket connection
    socket.on("test-message", (data) => {
      console.log(`[INFO] 🔵 Received test message from ${socket.id}:`, data);
    });

  // 🔹 Emit an event to send the socket ID to the connected user
  socket.emit("me", socket.id);

  // 📡 User joins the chat system
  socket.on("join", (user) => {
    if (!user || !user.id) {
      console.warn("[WARNING] Invalid user data on join"); // Warn if user data is missing
      return;
    }

    socket.join(user.id); // 🔹 Add user to a room with their ID
    const existingUser = onlineUsers.find((u) => u.userId === user.id); // Check if user is already online

    if (existingUser) {
      existingUser.socketId = socket.id; // Update socket ID if user reconnects
    } else {
      // 🟢 Add new user to online users list
      onlineUsers.push({
        userId: user.id,
        name: user.name,
        socketId: socket.id,
      });
    }

    io.emit("online-users", onlineUsers); // 🔹 Broadcast updated online users list
  });

  // 📞 Handle outgoing call request
  socket.on("callToUser", (data) => {
    const callee = onlineUsers.find((user) => user.userId === data.callToUserId); // Find the user being called

    if (!callee) {
      socket.emit("userUnavailable", { message: "User is offline." }); // ❌ Notify caller if user is offline
      return;
    }

    // 🚫 If the user is already in another call
    if (activeCalls.has(data.callToUserId)) {
      socket.emit("userBusy", { message: "User is currently in another call." });

      io.to(callee.socketId).emit("incomingCallWhileBusy", {
        from: data.from,
        name: data.name,
        email: data.email,
        profilepic: data.profilepic,
      });

      return;
    }

    // 📞 Emit an event to the receiver's socket (callee)
    io.to(callee.socketId).emit("callToUser", {
      signal: data.signalData, // WebRTC signal data
      from: data.from, // Caller ID
      name: data.name, // Caller name
      email: data.email, // Caller email
      profilepic: data.profilepic, // Caller profile picture
    });
  });

  // 📞 Handle when a call is accepted
  socket.on("answeredCall", (data) => {
    io.to(data.to).emit("callAccepted", {
      signal: data.signal, // WebRTC signal
      from: data.from, // Caller ID
    });

    // 📌 Track active calls in a Map
    activeCalls.set(data.from, { with: data.to, socketId: socket.id });
    activeCalls.set(data.to, { with: data.from, socketId: data.to });
  });

  // ❌ Handle call rejection
  socket.on("reject-call", (data) => {
    io.to(data.to).emit("callRejected", {
      name: data.name, // Rejected user's name
      profilepic: data.profilepic // Rejected user's profile picture
    });
  });

  // 📴 Handle call ending
  socket.on("call-ended", (data) => {
    io.to(data.to).emit("callEnded", {
      name: data.name, // User who ended the call
    });

    // 🔥 Remove call from active calls
    activeCalls.delete(data.from);
    activeCalls.delete(data.to);
  });

  // 🚀 Handle instant meeting creation
  socket.on("start-instant-meeting", (data) => {
    const { roomId, hostId, hostName } = data;
    
    console.log(`[INFO] 🔵 Host ${hostName} creating instant meeting room ${roomId}`);
    
    // Check server limits
    if (meetingRooms.size >= MEETING_LIMITS.MAX_ROOMS_PER_SERVER) {
      socket.emit("meeting-error", {
        error: "SERVER_FULL",
        message: "Server has reached maximum room capacity. Please try again later."
      });
      return;
    }
    
    // Create or join a room for the instant meeting
    socket.join(roomId);
    
    console.log(`[INFO] 🔵 Host socket ${socket.id} joined room ${roomId}`);
    
    // Initialize meeting room with host
    if (!meetingRooms.has(roomId)) {
      meetingRooms.set(roomId, []);
    }
    
    const participants = meetingRooms.get(roomId);
    const hostExists = participants.find(p => p.userId === hostId);
    
    if (!hostExists) {
      participants.push({
        userId: hostId,
        userName: hostName,
        socketId: socket.id,
        isHost: true
      });
    }
    
    // Broadcast to all online users that an instant meeting has started
    socket.broadcast.emit("instant-meeting-started", {
      roomId,
      hostId,
      hostName,
      message: `${hostName} started an instant meeting. Room ID: ${roomId}`
    });
    
    // Send current participants to the host
    socket.emit("meeting-participants", participants);
    
    console.log(`[INFO] Instant meeting started by ${hostName} with room ID: ${roomId}`);
  });

  // 🚀 Handle joining instant meeting by room ID
  socket.on("join-meeting-room", (data) => {
    const { roomId, userId, userName } = data;
    
    console.log(`[INFO] 🔵 User ${userName} joining room ${roomId}`);
    
    // Join the meeting room
    socket.join(roomId);
    
    console.log(`[INFO] 🔵 Socket ${socket.id} joined room ${roomId}`);
    
    // Check server limits
    if (meetingRooms.size >= MEETING_LIMITS.MAX_ROOMS_PER_SERVER) {
      socket.emit("meeting-error", {
        error: "SERVER_FULL",
        message: "Server has reached maximum room capacity. Please try again later."
      });
      return;
    }

    // Add participant to meeting room
    if (!meetingRooms.has(roomId)) {
      meetingRooms.set(roomId, []);
    }
    
    const participants = meetingRooms.get(roomId);
    
    // Check participant limit for this room
    if (participants.length >= MEETING_LIMITS.MAX_PARTICIPANTS_PER_ROOM) {
      socket.emit("meeting-error", {
        error: "ROOM_FULL",
        message: `This meeting room is full (${MEETING_LIMITS.MAX_PARTICIPANTS_PER_ROOM} participants maximum). Please try joining later.`
      });
      return;
    }
    
    const userExists = participants.find(p => p.userId === userId);
    
    if (!userExists) {
      participants.push({
        userId,
        userName,
        socketId: socket.id,
        isHost: false
      });
      
      console.log(`[INFO] ✅ ${userName} joined room ${roomId}. Participants: ${participants.length}/${MEETING_LIMITS.MAX_PARTICIPANTS_PER_ROOM}`);
    } else {
      console.log(`[INFO] 🔄 ${userName} rejoined room ${roomId}`);
    }
    
    // Notify others in the room that someone joined
    socket.to(roomId).emit("user-joined-meeting", {
      userId,
      userName,
      userEmail: `${userName}@meeting.local`,
      message: `${userName} joined the meeting`
    });
    
    // Send current participants list to everyone in the room
    io.to(roomId).emit("meeting-participants", participants);
    
    console.log(`[INFO] ${userName} joined meeting room: ${roomId}. Total participants: ${participants.length}`);
  });

  // 🚀 Handle meeting chat messages
  socket.on("send-meeting-chat", (data) => {
    const { roomId, message, senderName, senderId, timestamp } = data;
    
    // Validate message length
    if (!message || message.length > MEETING_LIMITS.MAX_MESSAGE_LENGTH) {
      socket.emit("chat-error", {
        error: "MESSAGE_TOO_LONG",
        message: `Message must be between 1 and ${MEETING_LIMITS.MAX_MESSAGE_LENGTH} characters.`
      });
      return;
    }
    
    // Check if room exists
    if (!meetingRooms.has(roomId)) {
      socket.emit("chat-error", {
        error: "ROOM_NOT_FOUND",
        message: "Meeting room not found. Please rejoin the meeting."
      });
      return;
    }
    
    console.log(`[INFO] 🔵 Received chat message in room ${roomId} from ${senderName}: ${message}`);
    console.log(`[INFO] 🔵 Broadcasting to room participants except sender`);
    
    // Broadcast message to all participants in the room except sender
    socket.to(roomId).emit("meeting-chat-message", {
      message,
      senderName,
      senderId,
      timestamp
    });
    
    console.log(`[INFO] ✅ Chat message broadcast completed`);
    
    // Debug: Show socket rooms
    console.log(`[DEBUG] Socket ${socket.id} is in rooms:`, Array.from(socket.rooms));
  });

  // 🖥️ Handle screen sharing events
  socket.on("screen-share-started", (data) => {
    const { roomId, userId, userName } = data;
    
    // Notify others in the room about screen sharing
    socket.to(roomId).emit("screen-share-started", {
      userId,
      userName,
      message: `${userName} started screen sharing`
    });
    
    console.log(`[INFO] ${userName} started screen sharing in room ${roomId}`);
  });

  socket.on("screen-share-stopped", (data) => {
    const { roomId, userId, userName } = data;
    
    // Notify others in the room that screen sharing stopped
    socket.to(roomId).emit("screen-share-stopped", {
      userId,
      userName,
      message: `${userName} stopped screen sharing`
    });
    
    console.log(`[INFO] ${userName} stopped screen sharing in room ${roomId}`);
  });

  // 📊 Handle polling system
  socket.on("create-poll", (data) => {
    const { roomId, poll } = data;
    
    socket.to(roomId).emit("poll-created", { poll });
    console.log(`[INFO] Poll created in room ${roomId}: ${poll.question}`);
  });

  socket.on("vote-poll", (data) => {
    const { roomId, pollId, optionIndex, userId } = data;
    
    io.to(roomId).emit("poll-voted", { pollId, optionIndex, userId });
    console.log(`[INFO] Vote cast in room ${roomId} for poll ${pollId}`);
  });

  // 📝 Handle notes system
  socket.on("update-notes", (data) => {
    const { roomId, notes, userId, userName } = data;
    
    socket.to(roomId).emit("notes-updated", { notes, userId, userName });
    console.log(`[INFO] Notes updated in room ${roomId} by ${userName}`);
  });

  socket.on("share-notes", (data) => {
    const { roomId, notes, sharedBy } = data;
    
    socket.to(roomId).emit("notes-shared", { notes, sharedBy });
    console.log(`[INFO] Notes shared in room ${roomId} by ${sharedBy}`);
  });

  // 🎨 Handle whiteboard system
  socket.on("whiteboard-draw", (data) => {
    const { roomId, drawing } = data;
    
    socket.to(roomId).emit("whiteboard-drawing", { drawing });
  });

  socket.on("clear-whiteboard", (data) => {
    const { roomId } = data;
    
    socket.to(roomId).emit("whiteboard-cleared");
    console.log(`[INFO] Whiteboard cleared in room ${roomId}`);
  });

  // ❌ Handle user disconnecting from the server
  socket.on("disconnect", () => {
    const user = onlineUsers.find((u) => u.socketId === socket.id); // Find the disconnected user
    if (user) {
      activeCalls.delete(user.userId); // Remove the user from active calls

      // 🔥 Remove all calls associated with this user
      for (const [key, value] of activeCalls.entries()) {
        if (value.with === user.userId) activeCalls.delete(key);
      }

      // 🔥 Remove user from meeting rooms
      for (const [roomId, participants] of meetingRooms.entries()) {
        const updatedParticipants = participants.filter(p => p.socketId !== socket.id);
        if (updatedParticipants.length === 0) {
          meetingRooms.delete(roomId); // Delete room if empty
        } else {
          meetingRooms.set(roomId, updatedParticipants);
          // Notify remaining participants
          socket.to(roomId).emit("meeting-participants", updatedParticipants);
          if (user) {
            socket.to(roomId).emit("user-left-meeting", {
              userId: user.userId,
              userName: user.name,
              message: `${user.name} left the meeting`
            });
          }
        }
      }
    }

    // 🔥 Remove user from the online users list
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    
    // 🔹 Broadcast updated online users list
    io.emit("online-users", onlineUsers);

    // 🔹 Notify others that the user has disconnected
    socket.broadcast.emit("discounnectUser", { disUser: socket.id });

    console.log(`[INFO] Disconnected: ${socket.id}`); // Debugging: User disconnected
  });
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Serve React app for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// 🏁 Start the server after connecting to the database
(async () => {
  try {
    await dbConnection(); // Connect to MongoDB
    server.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
    process.exit(1); // Exit the process if the database connection fails
  }
})();

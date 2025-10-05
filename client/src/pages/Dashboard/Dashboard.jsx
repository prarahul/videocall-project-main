import React, { use, useEffect, useRef, useState } from 'react';
import socketInstance from '../components/socketio/VideoCallSocket';
import { FaBars, FaTimes, FaPhoneAlt, FaMicrophone, FaVideo, FaVideoSlash, FaMicrophoneSlash, FaUsers, FaComment, FaEllipsisV, FaDesktop, FaCopy, FaPlus } from "react-icons/fa";
import Lottie from "lottie-react";
import { Howl } from "howler";
import wavingAnimation from "../../assets/waving.json";
import { FaPhoneSlash } from "react-icons/fa6";
import apiClient from "../../apiClient";
import { useUser } from '../../context/UserContextApi';
import { RiLogoutBoxLine } from "react-icons/ri";
import { useNavigate } from 'react-router-dom';
import Peer from 'simple-peer'
import PollsModal from '../../components/tools/PollsModal';
import NotesModal from '../../components/tools/NotesModal';
import WhiteboardModal from '../../components/tools/WhiteboardModal';

const Dashboard = () => {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOnline, setUserOnline] = useState([]);
  const [stream, setStream] = useState(null);
  const [me, setMe] = useState("");
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const myVideo = useRef(null);
  const preCallVideo = useRef(null);
  const reciverVideo = useRef(null);
  const connectionRef = useRef(null);
  const hasJoined = useRef(false);

  const [reciveCall, setReciveCall] = useState(false);
  const [caller, setCaller] = useState(null);
  const [callerName, setCallerName] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callerWating, setCallerWating] = useState(false)

  const [callRejectedPopUp, setCallRejectedPopUp] = useState(false);
  const [rejectorData, setCallrejectorData] = useState(null);

  // UI state
  const [showDropdown, setShowDropdown] = useState(false);
  const [meetingCode, setMeetingCode] = useState("");
  const [generatedMeetingLink, setGeneratedMeetingLink] = useState("");
  const [showMeetingLinkModal, setShowMeetingLinkModal] = useState(false);
  
  // In-call UI state
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);  
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [showPreCallModal, setShowPreCallModal] = useState(false);
  const [showMeetingReadyCard, setShowMeetingReadyCard] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState("");
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  
  // Tools state
  const [showPollModal, setShowPollModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showWhiteboardModal, setShowWhiteboardModal] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [polls, setPolls] = useState([]);
  const [notes, setNotes] = useState("");
  const [whiteboardData, setWhiteboardData] = useState([]);
  const [debugKey, setDebugKey] = useState(0); // Add this line

  // 🔹 State to track microphone & video status
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  // WebRTC state
  const [peerConnections, setPeerConnections] = useState(new Map());
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);

  // STUN/TURN configuration for NAT traversal
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Add TURN servers for production (required for users behind strict NATs)
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: 'your-username',
      //   credential: 'your-password'
      // }
    ]
  };

  // 🔥 Load ringtone
  const ringtone = new Howl({
    src: ["/ringtone.mp3"], // ✅ Replace with your ringtone file
    loop: false,  // ✅ Keep ringing until stopped
    volume: 1.0, // ✅ Full volume
  });

  const socket = socketInstance.getSocket();

  useEffect(() => {
    // Request notification permission
    if (window.Notification && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Check if `user` and `socket` exist and if the user has not already joined the socket room.
    if (user && socket && !hasJoined.current) {
      // Emit a "join" event to the server with the user's ID and username.
      socket.emit("join", { id: user._id, name: user.username });
      // Mark `hasJoined.current` as `true` to ensure the user does not join multiple times.
      hasJoined.current = true;
    }
    // Listen for the "me" event, which provides the current user's socket ID.
    socket.on("me", (id) => setMe(id));
    // Listen for "callToUser" event, which means another user is calling the current user.
    socket.on("callToUser", (data) => {
      setReciveCall(true);  // Set state to indicate an incoming call.
      setCaller(data);      // Store caller's information in state.
      setCallerName(data.name);  // Store caller's name.
      setCallerSignal(data.signal);  // Store WebRTC signal data for the call.
      // ✅ Start playing ringtone
      ringtone.play();
    });
    // Listen for "callRejected" event, which is triggered when the other user declines the call.
    socket.on("callRejected", (data) => {
      setCallRejectedPopUp(true);
      setCallrejectorData(data);
      // ✅ Stop ringtone in case call is ended before acceptance
      // ✅ Stop ringtone when call is accepted
      ringtone.stop();
    });
    // Listen for "callEnded" event, which is triggered when the other user ends the call.
    socket.on("callEnded", (data) => {
      console.log("Call ended by", data.name); // Log the event in the console.
      // ✅ Stop ringtone in case call is ended before acceptance
      ringtone.stop();
      endCallCleanup();  // Call a function to clean up the call state.
    });
    // Listen for "userUnavailable" event, meaning the user being called is not online.
    socket.on("userUnavailable", (data) => {
      alert(data.message || "User is not available."); // Show an alert.
    });
    // Listen for "userBusy" event, meaning the user is already on another call.
    socket.on("userBusy", (data) => {
      alert(data.message || "User is currently in another call."); // Show an alert.
    });

    // Listen for instant meeting notifications
    socket.on("instant-meeting-started", (data) => {
      // Show notification that someone started an instant meeting
      if (window.Notification && Notification.permission === "granted") {
        new Notification(`Meeting Started`, {
          body: data.message,
          icon: "/vite.svg"
        });
      } else {
        console.log("📢 Meeting notification:", data.message);
      }
    });

    // Listen for users joining meetings
    socket.on("user-joined-meeting", (data) => {
      console.log("👥 Meeting update:", data.message);
      // Add the new user to participants list
      if (data.userId !== user._id) {
        setUsers(prev => {
          const exists = prev.find(u => u._id === data.userId);
          if (!exists) {
            return [...prev, {
              _id: data.userId,
              username: data.userName,
              email: data.userEmail || `${data.userName}@meeting.local`,
              profilepic: `https://ui-avatars.com/api/?name=${data.userName}&background=3b82f6&color=fff&size=128`
            }];
          }
          return prev;
        });
      }
    });

    // Listen for chat messages
    socket.on("meeting-chat-message", (data) => {
      console.log("🟢 Received chat message:", data);
      setChatMessages(prev => [...prev, {
        sender: data.senderName,
        message: data.message,
        timestamp: data.timestamp,
        senderId: data.senderId
      }]);
    });

    // Test socket connection
    socket.on("connect", () => {
      console.log("🟢 Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected");
    });

    // Listen for meeting errors
    socket.on("meeting-error", (data) => {
      console.error("❌ Meeting error:", data);
      alert(data.message);
      
      if (data.error === "ROOM_FULL" || data.error === "SERVER_FULL") {
        // Handle room full - maybe suggest trying again later
        setCallAccepted(false);
        setReciveCall(false);
        setShowPreCallModal(false);
      }
    });

    // Listen for chat errors
    socket.on("chat-error", (data) => {
      console.error("❌ Chat error:", data);
      alert(data.message);
    });

    // Listen for meeting participants list
    socket.on("meeting-participants", (participants) => {
      const otherParticipants = participants.filter(p => p.userId !== user._id);
      setUsers(otherParticipants.map(p => ({
        _id: p.userId,
        username: p.userName,
        email: p.userEmail || `${p.userName}@meeting.local`,
        profilepic: `https://ui-avatars.com/api/?name=${p.userName}&background=3b82f6&color=fff&size=128`
      })));
    });

    // Listen for users leaving meetings
    socket.on("user-left-meeting", (data) => {
      console.log("👋 User left:", data.message);
      setUsers(prev => prev.filter(u => u._id !== data.userId));
    });

    // Listen for screen sharing events
    socket.on("screen-share-started", (data) => {
      console.log(`🖥️ ${data.userName} started screen sharing`);
      if (window.Notification && Notification.permission === "granted") {
        new Notification(`Screen Share Started`, {
          body: `${data.userName} is now sharing their screen`,
          icon: "/vite.svg"
        });
      }
    });

    socket.on("screen-share-stopped", (data) => {
      console.log(`🖥️ ${data.userName} stopped screen sharing`);
    });

    // Listen for tool events
    socket.on("poll-created", (data) => {
      setPolls(prev => [...prev, data.poll]);
      console.log(`📊 New poll created: ${data.poll.question}`);
    });

    socket.on("poll-voted", (data) => {
      setPolls(prev => prev.map(poll => 
        poll.id === data.pollId 
          ? { ...poll, votes: { ...poll.votes, [data.userId]: data.optionIndex } }
          : poll
      ));
    });

    socket.on("notes-updated", (data) => {
      console.log(`📝 Notes updated by ${data.userName}`);
    });

    socket.on("notes-shared", (data) => {
      setNotes(data.notes);
      alert(`📝 ${data.sharedBy} shared meeting notes with everyone`);
    });

    socket.on("whiteboard-drawing", (data) => {
      const canvas = document.getElementById('whiteboard');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const { fromX, fromY, toX, toY, color, size } = data.drawing;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });

    socket.on("whiteboard-cleared", () => {
      const canvas = document.getElementById('whiteboard');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    // Listen for "online-users" event, which provides the list of currently online users.
    socket.on("online-users", (onlineUsers) => {
      setUserOnline(onlineUsers); // Update state with the list of online users.
    });
    // Cleanup function: Runs when the component unmounts or dependencies change.
    return () => {
      socket.off("me");  // Remove listener for "me" event.
      socket.off("callToUser");  // Remove listener for incoming calls.
      socket.off("callRejected");  // Remove listener for call rejection.
      socket.off("callEnded");  // Remove listener for call ending.
      socket.off("userUnavailable");  // Remove listener for unavailable user.
      socket.off("userBusy");  // Remove listener for busy user.
      socket.off("online-users");  // Remove listener for online users list.
    };
  }, [user, socket]); // Dependencies: This effect runs whenever `user` or `socket` changes.


  const startCall = async () => {
    try {
      // Add null check for modalUser
      if (!modalUser) {
        console.error("No user selected for call");
        return;
      }

      // Generate meeting ID for this call
      const meetingId = `call-${Date.now()}-${user._id}`;
      setCurrentMeetingId(meetingId);
      
      // Show pre-call modal first
      setShowPreCallModal(true);
      
      // ✅ Request access to the user's media devices (camera & microphone)
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Enable video
        audio: {
          echoCancellation: true, // ✅ Reduce echo in audio
          noiseSuppression: true  // ✅ Reduce background noise
        }
      });
      // ✅ Store the stream in state so it can be used later
      setStream(currentStream);
      // ✅ Assign the stream to both video elements for preview
      if (preCallVideo.current) {
        preCallVideo.current.srcObject = currentStream;
        preCallVideo.current.muted = true;
        preCallVideo.current.volume = 0;
      }
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        myVideo.current.muted = true; // ✅ Mute local audio to prevent feedback
        myVideo.current.volume = 0;   // ✅ Set volume to zero to avoid echo
      }
      // ✅ Ensure that the audio track is enabled
      currentStream.getAudioTracks().forEach(track => (track.enabled = true));
      // ✅ Close the sidebar (if open) and set the selected user for the call
      setCallRejectedPopUp(false);
      setIsSidebarOpen(false);
      setCallerWating(true);//wating to join reciver
      setSelectedUser(modalUser._id);
      // ✅ Create a new Peer connection (WebRTC) as the call initiator
      const peer = new Peer({
        initiator: true, // ✅ This user starts the call
        trickle: false,  // ✅ Prevents trickling of ICE candidates, ensuring a single signal exchange
        stream: currentStream // ✅ Attach the local media stream
      });
      // ✅ Handle the "signal" event (this occurs when the WebRTC handshake is initiated)
      peer.on("signal", (data) => {
        // ✅ Emit a "callToUser" event to the server with necessary call details
        socket.emit("callToUser", {
          callToUserId: modalUser._id, // ✅ ID of the user being called
          signalData: data, // ✅ WebRTC signal data required for establishing connection
          from: me, // ✅ ID of the caller
          name: user.username, // ✅ Caller’s name
          email: user.email, // ✅ Caller’s email
          profilepic: user.profilepic, // ✅ Caller’s profile picture
        });
      });
      // ✅ Handle the "stream" event (this is triggered when the remote user's media stream is received)
      peer.on("stream", (remoteStream) => {
        if (reciverVideo.current) {
          reciverVideo.current.srcObject = remoteStream; // ✅ Assign remote stream to video element
          reciverVideo.current.muted = false; // ✅ Ensure audio from the remote user is not muted
          reciverVideo.current.volume = 1.0; // ✅ Set volume to normal level
        }
      });
      // ✅ Listen for "callAccepted" event from the server (when the recipient accepts the call)
      socket.once("callAccepted", (data) => {
        setCallRejectedPopUp(false);
        setCallAccepted(true); // ✅ Mark call as accepted
        setCallerWating(false);//reciver join the call
        setCaller(data.from); // ✅ Store caller's ID
        peer.signal(data.signal); // ✅ Pass the received WebRTC signal to establish the connection
      });
      // ✅ Store the peer connection reference to manage later (like ending the call)
      connectionRef.current = peer;
      // ✅ Close the user detail modal after initiating the call
      setShowUserDetailModal(false);
    } catch (error) {
      console.error("Error accessing media devices:", error); // ✅ Handle permission errors or device access failures
    }
  };

  const handelacceptCall = async () => {
    // ✅ Stop ringtone when call is accepted
    ringtone.stop();
    try {
      // ✅ Request access to the user's media devices (camera & microphone)
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Enable video
        audio: {
          echoCancellation: true, // ✅ Reduce echo in audio
          noiseSuppression: true  // ✅ Reduce background noise
        }
      });

      // ✅ Store the stream in state so it can be used later
      setStream(currentStream);

      // ✅ Assign the stream to the local video element for preview
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }

      // ✅ Ensure that the audio track is enabled
      currentStream.getAudioTracks().forEach(track => (track.enabled = true));

      // ✅ Update call state
      setCallAccepted(true); // ✅ Mark call as accepted
      setReciveCall(true); // ✅ Indicate that the user has received the call
      setCallerWating(false);//reciver join the call
      setIsSidebarOpen(false); // ✅ Close the sidebar (if open)

      // ✅ Create a new Peer connection as the receiver (not the initiator)
      const peer = new Peer({
        initiator: false, // ✅ This user is NOT the call initiator
        trickle: false, // ✅ Prevents trickling of ICE candidates, ensuring a single signal exchange
        stream: currentStream // ✅ Attach the local media stream
      });

      // ✅ Handle the "signal" event (this occurs when the WebRTC handshake is completed)
      peer.on("signal", (data) => {
        // ✅ Emit an "answeredCall" event to the server with necessary response details
        socket.emit("answeredCall", {
          signal: data, // ✅ WebRTC signal data required for establishing connection
          from: me, // ✅ ID of the receiver (this user)
          to: caller.from, // ✅ ID of the caller
        });
      });

      // ✅ Handle the "stream" event (this is triggered when the remote user's media stream is received)
      peer.on("stream", (remoteStream) => {
        if (reciverVideo.current) {
          reciverVideo.current.srcObject = remoteStream; // ✅ Assign remote stream to video element
          reciverVideo.current.muted = false; // ✅ Ensure audio from the remote user is not muted
          reciverVideo.current.volume = 1.0; // ✅ Set volume to normal level
        }
      });

      // ✅ If there's an incoming signal (from the caller), process it
      if (callerSignal) peer.signal(callerSignal);

      // ✅ Store the peer connection reference to manage later (like ending the call)
      connectionRef.current = peer;
    } catch (error) {
      console.error("Error accessing media devices:", error); // ✅ Handle permission errors or device access failures
    }
  };

  const handelrejectCall = () => {
    // ✅ Stop ringtone when call is accepted
    ringtone.stop();
    // ✅ Update the state to indicate that the call is rejected
    setCallerWating(false);//reciver reject the call
    setReciveCall(false); // ✅ The user is no longer receiving a call
    setCallAccepted(false); // ✅ Ensure the call is not accepted

    // ✅ Notify the caller that the call was rejected
    socket.emit("reject-call", {
      to: caller.from, // ✅ The caller's ID (who initiated the call)
      name: user.username, // ✅ The name of the user rejecting the call
      profilepic: user.profilepic // ✅ Placeholder profile picture of the user rejecting the call
    });
  };

  const handelendCall = () => {
    // ✅ Stop ringtone when call is accepted
    console.log("🔴 Sending call-ended event...");
    // ✅ Stop ringtone when call is accepted
    ringtone.stop();
    // ✅ Notify the other user that the call has ended
    socket.emit("call-ended", {
      to: caller?.from || selectedUser, // ✅ Send call end signal to the caller or selected user
      name: user.username // ✅ Send the username to inform the other party
    });

    // ✅ Perform cleanup actions after ending the call
    endCallCleanup();
  };

  //  NEW MEETING FEATURES
  const startInstantMeeting = async () => {
    try {
      // Generate a unique room ID for this instant meeting
      const roomId = `instant-${Date.now()}-${user._id}`;
      setCurrentMeetingId(roomId);
      console.log("🔵 Starting instant meeting with room ID:", roomId);
      
      // Show pre-call modal first
      setShowPreCallModal(true);
      
      // Start media devices
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(currentStream);
      
      if (preCallVideo.current) {
        preCallVideo.current.srcObject = currentStream;
        preCallVideo.current.muted = true;
        preCallVideo.current.volume = 0;
      }
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        myVideo.current.muted = true;
        myVideo.current.volume = 0;
      }
      
      setCallAccepted(true);
      setIsSidebarOpen(false);
      
      // Emit to server that user started an instant meeting
      socket.emit("start-instant-meeting", {
        roomId,
        hostId: user._id,
        hostName: user.username
      });
      
      console.log(`Instant meeting started! Room ID: ${roomId}`);
    } catch (error) {
      console.error("Error starting instant meeting:", error);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const createMeetingLink = () => {
    // Generate unique meeting ID with timestamp and random string
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const roomId = `meeting-${timestamp}-${randomStr}-${user._id}`;
    const meetingLink = `${window.location.origin}/join/${roomId}`;
    setGeneratedMeetingLink(meetingLink);
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(generatedMeetingLink);
    alert("Meeting link copied to clipboard!");
  };

  const scheduleInCalendar = () => {
    const roomId = `scheduled-${Date.now()}-${user._id}`;
    const meetingLink = `${window.location.origin}/join/${roomId}`;
    
    // Create calendar event details
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1); // Schedule for 1 hour from now
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // 1 hour duration
    
    const eventTitle = "Connect Pro Video Meeting";
    const eventDescription = `Join the meeting: ${meetingLink}`;
    
    // Format dates for Google Calendar
    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatDate(startTime)}/${formatDate(endTime)}&details=${encodeURIComponent(eventDescription)}`;
    
    // Open Google Calendar in new tab
    window.open(googleCalendarUrl, '_blank');
  };

  const joinMeetingByCode = async () => {
    if (!meetingCode.trim()) {
      alert("Please enter a meeting code or link");
      return;
    }

    try {
      // Extract room ID from the meeting code/link
      let roomId = meetingCode.trim();
      
      // If it's a full URL, extract the room ID
      if (roomId.includes('/join/')) {
        roomId = roomId.split('/join/')[1];
      }
      
      // Start media devices
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(currentStream);
      
      if (preCallVideo.current) {
        preCallVideo.current.srcObject = currentStream;
        preCallVideo.current.muted = true;
        preCallVideo.current.volume = 0;
      }
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        myVideo.current.muted = true;
        myVideo.current.volume = 0;
      }
      
      setCallAccepted(true);
      setIsSidebarOpen(false);
      setCurrentMeetingId(roomId);
      setMeetingStartTime(Date.now());
      
      console.log("🔵 Joining meeting room:", roomId);
      
      // Join the meeting room - this will trigger WebRTC connections
      socket.emit("join-meeting-room", {
        roomId,
        userId: user._id,
        userName: user.username
      });
      
      setMeetingCode(""); // Clear the input
    
    } catch (error) {
      console.error("Error joining meeting:", error);
      alert("Could not access camera/microphone or join meeting. Please check permissions.");
    }
  };

  // 🖥️ Screen Sharing Functions
  const startScreenShare = async () => {
    try {
      // Request screen sharing permission
      const screenShareStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      setScreenStream(screenShareStream);
      setIsScreenSharing(true);
      
      // Replace video track in existing peer connections
      if (connectionRef.current && connectionRef.current.streams && connectionRef.current.streams[0]) {
        const videoTrack = screenShareStream.getVideoTracks()[0];
        const sender = connectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
      
      // Update local video display
      if (myVideo.current) {
        myVideo.current.srcObject = screenShareStream;
      }
      
      // Listen for screen share end (when user clicks "Stop sharing" in browser)
      screenShareStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
      
      // Notify other participants about screen sharing
      socket.emit("screen-share-started", {
        roomId: currentMeetingId,
        userId: user._id,
        userName: user.username
      });
      
      console.log("Screen sharing started");
      
    } catch (error) {
      console.error("Error starting screen share:", error);
      alert("Could not start screen sharing. Please check permissions.");
    }
  };

  const stopScreenShare = async () => {
    try {
      // Stop screen sharing stream
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      
      setIsScreenSharing(false);
      
      // Get back to camera stream
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: isCamOn,
        audio: isMicOn
      });
      
      setStream(cameraStream);
      
      // Replace screen share track with camera track in peer connections
      if (connectionRef.current && connectionRef.current.streams && connectionRef.current.streams[0]) {
        const videoTrack = cameraStream.getVideoTracks()[0];
        const sender = connectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
      
      // Update local video display
      if (myVideo.current) {
        myVideo.current.srcObject = cameraStream;
      }
      if (preCallVideo.current) {
        preCallVideo.current.srcObject = cameraStream;
      }
      
      // Notify other participants that screen sharing stopped
      socket.emit("screen-share-stopped", {
        roomId: currentMeetingId,
        userId: user._id,
        userName: user.username
      });
      
      console.log("Screen sharing stopped");
      
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const endCallCleanup = () => {
    // ✅ Stop all media tracks (video & audio) to release device resources
    console.log("🔴 Stopping all media streams and resetting call...");
    if (stream) {
      stream.getTracks().forEach((track) => track.stop()); // ✅ Stops camera and microphone
    }
    // ✅ Clear the receiver's video (Remote user)
    if (reciverVideo.current) {
      console.log("🔴 Clearing receiver video");
      reciverVideo.current.srcObject = null;
    }
    // ✅ Clear the user's own video
    if (myVideo.current) {
      console.log("🔴 Clearing my video");
      myVideo.current.srcObject = null;
    }
    // ✅ Stop screen sharing if active
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
    // ✅ Destroy the peer-to-peer connection if it exists
    connectionRef.current?.destroy();
    // ✅ Reset all relevant states to indicate call has ended
    // ✅ Stop ringtone when call is accepted
    ringtone.stop();
    setCallerWating(false);
    setStream(null); // ✅ Remove video/audio stream
    setReciveCall(false); // ✅ Indicate no ongoing call
    setCallAccepted(false); // ✅ Ensure call is not mistakenly marked as ongoing
    setSelectedUser(null); // ✅ Reset the selected user
    setTimeout(() => {
      window.location.reload(); // ✅ Force reset if cleanup fails
    }, 100);
  };


  // 🎤 Toggle Microphone
  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCamOn;
        setIsCamOn(videoTrack.enabled);
      }
    }
  };



  const allusers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user');
      if (response.data.success !== false) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    allusers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.dropdown-wrapper')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  const isOnlineUser = (userId) => userOnline.some((u) => u.userId === userId);

  const handelSelectedUser = (userId) => {
    if (callAccepted || reciveCall) {
      alert("You must end the current call before starting a new one.");
      return;
    }
    const selected = filteredUsers.find(user => user._id === userId);
    setModalUser(selected);
    setShowUserDetailModal(true);
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = async () => {
    if (callAccepted || reciveCall) {
      alert("You must end the call before logging out.");
      return;
    }
    try {
      await apiClient.post('/auth/logout');
      socket.off("disconnect");
      socket.disconnect();
      socketInstance.setSocket();
      updateUser(null);
      localStorage.removeItem("userData");
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Format meeting duration
  const formatMeetingTime = () => {
    if (!meetingStartTime) return "00:00";
    const elapsed = Math.floor((Date.now() - meetingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Start timer when call is accepted
  useEffect(() => {
    let timer;
    if (callAccepted && meetingStartTime) {
      timer = setInterval(() => {
        // Force re-render to update time
        setMeetingStartTime(prev => prev);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callAccepted, meetingStartTime]);

  // Ensure video stream is properly assigned when stream changes
  useEffect(() => {
    if (stream) {
      if (preCallVideo.current && !preCallVideo.current.srcObject) {
        preCallVideo.current.srcObject = stream;
        preCallVideo.current.muted = true;
        preCallVideo.current.volume = 0;
      }
      if (myVideo.current && !myVideo.current.srcObject) {
        myVideo.current.srcObject = stream;
        myVideo.current.muted = true;
        myVideo.current.volume = 0;
      }
    }
  }, [stream]);

  // Add this useEffect to force re-render when tools panel opens
  useEffect(() => {
    if (showToolsPanel) {
      setDebugKey(prev => prev + 1);
    }
  }, [showToolsPanel]);

  // Show in-call UI when call is active
  if (callAccepted || reciveCall) {
    return (
      <div className="in-call-container">
        {/* Pre-Call Modal */}
        {showPreCallModal && (
          <div className="pre-call-modal">
            <div className="pre-call-card">
              <h2 style={{marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600'}}>Ready to Connect?</h2>
              <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>Before joining, please select your audio and video preferences.</p>
              
              <div className="pre-call-preview">
                <video ref={preCallVideo} autoPlay muted playsInline />
                {!stream && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f0f0f0',
                    color: '#666',
                    fontSize: '0.8rem'
                  }}>
                    📹 Camera Preview
                  </div>
                )}
              </div>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1.5rem'}}>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setShowPreCallModal(false);
                    setMeetingStartTime(Date.now());
                    setShowMeetingReadyCard(true);
                  }}
                  style={{width: '100%'}}
                >
                  Join Meeting
                </button>
                <button 
                  style={{background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', textDecoration: 'underline'}}
                  onClick={() => {
                    setShowPreCallModal(false);
                    setMeetingStartTime(Date.now());
                  }}
                >
                  Continue without mic & camera
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Grid */}
        <div className="video-grid">
          {/* Main Video Area - Show first remote participant or screen share */}
          <div className="main-video">
            {Array.from(remoteStreams.values()).length > 0 ? (
              <video 
                key={Array.from(remoteStreams.keys())[0]}
                autoPlay 
                playsInline
                ref={(videoEl) => {
                  if (videoEl && Array.from(remoteStreams.values())[0]) {
                    videoEl.srcObject = Array.from(remoteStreams.values())[0];
                  }
                }}
              />
            ) : (
              <div className="no-participants">
                <div className="waiting-message">
                  <h3>Waiting for others to join...</h3>
                  <p>Share your meeting link to invite participants</p>
                </div>
              </div>
            )}
            
            {isScreenSharing && (
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(0, 122, 255, 0.9)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 10
              }}>
                <FaDesktop />
                You're sharing your screen
              </div>
            )}
          </div>

          {/* Participants Grid - Show other remote participants */}
          {Array.from(remoteStreams.entries()).slice(1).map(([userId, stream]) => (
            <div key={userId} className="participant-video">
              <video 
                autoPlay 
                playsInline
                ref={(videoEl) => {
                  if (videoEl) videoEl.srcObject = stream;
                }}
              />
              <div className="participant-name">Participant</div>
            </div>
          ))}

          {/* Self View */}
          <div className="self-view">
            <video ref={myVideo} autoPlay muted playsInline />
            <div className="participant-name">You</div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="control-bar">
          <div className="meeting-info">
            {currentMeetingId && <span>Meeting: {currentMeetingId} • </span>}
            <span>{formatMeetingTime()}</span>
          </div>
          
          {/* Core Controls */}
          <button 
            className={`control-btn ${isMicOn ? 'active' : 'muted'}`}
            onClick={() => {
              setIsMicOn(!isMicOn);
              if (stream) {
                stream.getAudioTracks().forEach(track => {
                  track.enabled = !isMicOn;
                });
              }
            }}
            title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          
          <button 
            className={`control-btn ${isCamOn ? 'active' : 'muted'}`}
            onClick={() => {
              setIsCamOn(!isCamOn);
              if (stream) {
                stream.getVideoTracks().forEach(track => {
                  track.enabled = !isCamOn;
                });
              }
            }}
            title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCamOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
          
          <button 
            className={`control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <FaDesktop />
          </button>
          
          {/* End Call Button */}
          <button 
            className="control-btn end-call-btn"
            onClick={handelendCall}
            title="End call"
          >
            <FaPhoneSlash />
          </button>
          
          {/* Utility Controls */}
          <button 
            className="control-btn utility-btn"
            onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
            title="Show participants"
          >
            <FaUsers />
          </button>
          
          <button 
            className="control-btn utility-btn"
            onClick={() => setShowChatPanel(!showChatPanel)}
            title="Show chat"
          >
            <FaComment />
          </button>
          
          <button 
            className="control-btn utility-btn"
            onClick={() => setShowToolsPanel(!showToolsPanel)}
            title="More options"
          >
            <FaEllipsisV />
          </button>
        </div>

        {/* Tools Modals */}
        <PollsModal
          isOpen={showPollModal}
          onClose={() => setShowPollModal(false)}
          socket={socket}
          currentMeetingId={currentMeetingId}
          user={user}
        />

        <NotesModal 
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          socket={socket}
          currentMeetingId={currentMeetingId}
          user={user}
        />

        <WhiteboardModal 
          isOpen={showWhiteboardModal}
          onClose={() => setShowWhiteboardModal(false)}
          socket={socket}
          currentMeetingId={currentMeetingId}
          user={user}
        />

        {/* Meeting Ready Card */}
        {showMeetingReadyCard && (
          <div className="floating-card meeting-ready-card">
            <button className="card-close" onClick={() => setShowMeetingReadyCard(false)}>×</button>
            <h3 style={{margin: '0 0 1rem 0', fontSize: '1.1rem'}}>Your meeting's ready</h3>
            <p style={{margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)'}}>Share this meeting link with others you want in the meeting</p>
            
            <div className="meeting-link">
              {generatedMeetingLink || `${window.location.origin}/join/${currentMeetingId || 'demo-meeting'}`}
              <button className="copy-link-btn" onClick={copyMeetingLink} title="Copy link">
                <FaCopy />
              </button>
            </div>
            
            <button className="btn-primary" style={{marginTop: '1rem', fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
              <FaPlus style={{marginRight: '0.5rem'}} />
              Add people
            </button>
          </div>
        )}

        {/* Participants Panel */}
        <div className={`side-panel ${showParticipantsPanel ? 'open' : ''}`}>
          <div className="panel-header">
            <h3 className="panel-title">People ({users.length + 1}/50)</h3>
            <button className="panel-close" onClick={() => setShowParticipantsPanel(false)}>×</button>
          </div>
          <div className="panel-content">
            <input 
              type="text" 
              placeholder="Search participants..." 
              style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e9ecef', marginBottom: '1rem'}}
            />
            <button className="btn-primary" style={{width: '100%', marginBottom: '1.5rem', fontSize: '0.9rem'}}>
              <FaPlus style={{marginRight: '0.5rem'}} />
              Add people
            </button>
            
            {/* Current User */}
            <div className="participant-list-item">
              <div className="participant-avatar">
                {user?.username?.charAt(0)?.toUpperCase()}
              </div>
              <div className="participant-info">
                <div className="participant-name-text">{user?.username} (You)</div>
                <div className="participant-role">Host</div>
              </div>
              <div className="participant-status">
                <div className={`status-icon ${isMicOn ? 'active' : 'inactive'}`}>
                  {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </div>
                <div className={`status-icon ${isCamOn ? 'active' : 'inactive'}`}>
                  {isCamOn ? <FaVideo /> : <FaVideoSlash />}
                </div>
              </div>
            </div>
            
            {/* Other Participants */}
            {users.filter(u => u._id !== user?._id).map(participant => (
              <div key={participant._id} className="participant-list-item">
                <div className="participant-avatar">
                  {participant.username?.charAt(0)?.toUpperCase()}
                </div>
                <div className="participant-info">
                  <div className="participant-name-text">{participant.username}</div>
                  <div className="participant-role">Participant</div>
                </div>
                <div className="participant-status">
                  <div className="status-icon active">
                    <FaMicrophone />
                  </div>
                  <div className="status-icon active">
                    <FaVideo />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        <div className={`side-panel ${showChatPanel ? 'open' : ''}`}>
          <div className="panel-header">
            <h3 className="panel-title">In-call messages</h3>
            <button className="panel-close" onClick={() => setShowChatPanel(false)}>×</button>
          </div>
          <div className="panel-content">
            <div style={{marginBottom: '1rem'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'}}>
                <input type="checkbox" defaultChecked />
                Allow others to chat
              </label>
            </div>
            
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} style={{marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px'}}>
                  <div style={{fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem'}}>{msg.sender}</div>
                  <div style={{fontSize: '0.9rem'}}>{msg.message}</div>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.9rem'}}>
                  Messages sent during the call will appear here
                </div>
              )}
            </div>
            
            <div className="chat-input-area">
              <input 
                className="chat-input" 
                placeholder="Type a message..." 
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const message = e.target.value.trim();
                    console.log("🔵 Sending chat message:", { roomId: currentMeetingId, message, sender: user?.username });
                    console.log("🔵 Socket connected?", socket.connected);
                    console.log("🔵 Socket ID:", socket.id);
                    
                    // Test basic socket connection
                    socket.emit("test-message", { test: "hello" });
                    
                    // Send message through socket
                    socket.emit("send-meeting-chat", {
                      roomId: currentMeetingId,
                      message: message,
                      senderName: user?.username || 'You',
                      senderId: user?._id,
                      timestamp: Date.now()
                    });
                    
                    // Add to local messages immediately
                    setChatMessages(prev => [...prev, {
                      sender: user?.username || 'You',
                      message: message,
                      timestamp: Date.now(),
                      senderId: user?._id
                    }]);
                    e.target.value = '';
                  }
                }}
              />
              <button 
                className="chat-send-btn" 
                title="Send message"
                onClick={(e) => {
                  const input = e.target.parentElement.querySelector('.chat-input');
                  if (input.value.trim()) {
                    const message = input.value.trim();
                    console.log("🔵 Sending chat message (button):", { roomId: currentMeetingId, message, sender: user?.username });
                    
                    socket.emit("send-meeting-chat", {
                      roomId: currentMeetingId,
                      message: message,
                      senderName: user?.username || 'You',
                      senderId: user?._id,
                      timestamp: Date.now()
                    });
                    
                    setChatMessages(prev => [...prev, {
                      sender: user?.username || 'You',
                      message: message,
                      timestamp: Date.now(),
                      senderId: user?._id
                    }]);
                    input.value = '';
                  }
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Tools Panel */}
        <div className={`side-panel ${showToolsPanel ? 'open' : ''}`}>
          <div className="panel-header">
            <h3 className="panel-title">Tools & Extensions</h3>
            <button className="panel-close" onClick={() => setShowToolsPanel(false)}>×</button>
          </div>
          <div className="panel-content">
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
              <div 
                style={{textAlign: 'center', padding: '1rem', border: '1px solid #e9ecef', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'}}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Polls clicked");
                  setShowPollModal(prev => {
                    console.log("Setting showPollModal from", prev, "to true");
                    return true;
                  });
                  setForceUpdate(prev => prev + 1);
                }}
                onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>📊</div>
                <div style={{fontSize: '0.8rem'}}>Polls</div>
              </div>
              <div 
                style={{textAlign: 'center', padding: '1rem', border: '1px solid #e9ecef', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'}}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Notes clicked");
                  setShowNotesModal(prev => {
                    console.log("Setting showNotesModal from", prev, "to true");
                    return true;
                  });
                  setForceUpdate(prev => prev + 1);
                }}
                onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>📝</div>
                <div style={{fontSize: '0.8rem'}}>Notes</div>
              </div>
              <div 
                style={{textAlign: 'center', padding: '1rem', border: '1px solid #e9ecef', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'}}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Whiteboard clicked");
                  setShowWhiteboardModal(prev => {
                    console.log("Setting showWhiteboardModal from", prev, "to true");
                    return true;
                  });
                  setForceUpdate(prev => prev + 1);
                }}
                onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>🎨</div>
                <div style={{fontSize: '0.8rem'}}>Whiteboard</div>
              </div>
            </div>
            
            <button 
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--primary-blue)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.5rem'
              }}
              title="Discover more apps"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Header */}
      <header className="cp-header fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button className="md:hidden cp-header-icon" onClick={() => setIsSidebarOpen(true)}><FaBars /></button>
            <div className="cp-logo">Connect Pro</div>
          </div>
          <div className="cp-header-icons">
            <button className="cp-header-icon" title="Help">?</button>
            <button className="cp-header-icon" title="Settings">⚙</button>
            <button className="cp-header-icon" title="Notifications">🔔</button>
            <div className="cp-avatar">
              {user?.profilepic ? <img src={user.profilepic} alt="avatar" className="w-full h-full rounded-full object-cover" /> : user?.username?.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      <div className="pt-16 flex w-full">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      {/* Sidebar */}
      <aside
        className={`cp-sidebar h-full fixed z-20 transition-transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{top: '64px', bottom: 0}}
      >
        <div className="p-4 border-b border-gray-200">
          <button
            type="button"
            className="md:hidden float-right text-gray-500"
            onClick={() => setIsSidebarOpen(false)}
          >
            <FaTimes />
          </button>
          <div className="clear-both"></div>
        </div>

        {/* Navigation */}
        <nav className="py-4">
          <a href="#" className="cp-nav-item active">
            <FaVideo className="cp-nav-icon" />
            <span>Meetings</span>
          </a>
          <a href="#" className="cp-nav-item">
            <FaPhoneAlt className="cp-nav-icon" />
            <span>Calls</span>
          </a>
          <a href="#" className="cp-nav-item">
            <FaVideo className="cp-nav-icon" />
            <span>History</span>
          </a>
        </nav>

        {/* Search & User List */}
        <div className="px-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full mb-4"
          />

          <div className="text-sm font-semibold text-gray-500 mb-2">
            Online Users ({filteredUsers.filter(u => isOnlineUser(u._id)).length})
          </div>
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {filteredUsers.map((user) => (
              <li
                key={user._id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${selectedUser === user._id ? "bg-blue-50" : ""}`}
                onClick={() => handelSelectedUser(user._id)}
              >
                {/* Online Status Indicator */}
                <div className={`w-2 h-2 rounded-full ${isOnlineUser(user._id) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                
                {/* User Info */}
                <div className="flex items-center flex-1 min-w-0 gap-2">
                  <span className="font-medium text-sm truncate">{user.username}</span>
                  {isOnlineUser(user._id) && (
                    <span className="text-xs text-green-600 font-semibold">●</span>
                  )}
                </div>
                
                {/* Call Button */}
                {isOnlineUser(user._id) && (
                  <button 
                    className="text-blue-500 hover:text-blue-700 p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user._id);
                      startCall();
                    }}
                    title="Start call"
                  >
                    <FaPhoneAlt size={12} />
                  </button>
                )}
              </li>
            ))}
            
            {/* Show message if no users online */}
            {filteredUsers.filter(u => isOnlineUser(u._id)).length === 0 && (
              <li className="text-center text-gray-500 text-sm py-4">
                No other users online
              </li>
            )}
          </ul>
        </div>

        {/* Logout */}
        {user && <div
          onClick={handleLogout}
          className="absolute bottom-4 left-4 right-4 flex items-center gap-2 bg-red-500 text-white px-4 py-2 cursor-pointer rounded-lg hover:bg-red-600 transition-colors"
        >
          <RiLogoutBoxLine />
          <span>Logout</span>
        </div>}
      </aside>

      {/* Main Content */}
      {selectedUser || reciveCall || callAccepted ? (
        <div className="relative w-full h-screen bg-black flex items-center justify-center">
          {/* Remote Video */}
          {callerWating ? <div>
              <div className="flex flex-col items-center">
                <p className='font-black text-xl mb-2'>User Details</p>
                <img
                  src={modalUser.profilepic || "/default-avatar.png"}
                  alt="User"
                  className="w-20 h-20 rounded-full border-4 border-blue-500 animate-bounce"
                />
                <h3 className="text-lg font-bold mt-3 text-white">{modalUser.username}</h3>
                <p className="text-sm text-gray-300">{modalUser.email}</p>
              </div>
            </div> : 
          <video
            ref={reciverVideo}
            autoPlay
            className="absolute top-0 left-0 w-full h-full object-contain rounded-lg"
          />
          }
          {/* Local PIP Video */}
          <div className="absolute bottom-[75px] md:bottom-0 right-1 bg-gray-900 rounded-lg overflow-hidden shadow-lg">
         <video
              ref={myVideo}
              autoPlay
              playsInline
              className="w-32 h-40 md:w-56 md:h-52 object-cover rounded-lg"
            />
          </div>

          {/* Username + Sidebar Button */}
          <div className="absolute top-4 left-4 text-white text-lg font-bold flex gap-2 items-center">
            <button
              type="button"
              className="md:hidden text-2xl text-white cursor-pointer"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FaBars />
            </button>
            {callerName || "Caller"}
          </div>

          {/* Call Controls */}
          <div className="absolute bottom-4 w-full flex justify-center gap-4">
            <button
              type="button"
              className="bg-red-600 p-4 rounded-full text-white shadow-lg cursor-pointer"
              onClick={handelendCall}
            >
              <FaPhoneSlash size={24} />
            </button>
            {/* 🎤 Toggle Mic */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-4 rounded-full text-white shadow-lg cursor-pointer transition-colors ${isMicOn ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {isMicOn ? <FaMicrophone size={24} /> : <FaMicrophoneSlash size={24} />}
            </button>

            {/* 📹 Toggle Video */}
            <button
              type="button"
              onClick={toggleCam}
              className={`p-4 rounded-full text-white shadow-lg cursor-pointer transition-colors ${isCamOn ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {isCamOn ? <FaVideo size={24} /> : <FaVideoSlash size={24} />}
            </button>


          </div>
        </div>
      ) : (
        <main className="main-content" style={{marginTop: '64px'}}>
          <div className="main-action-wrapper">
            <div className="main-action-card">
              <h1 className="main-headline">Video Calls & Real-time Collaboration</h1>
              <p className="main-subtext">Connect, collaborate, and celebrate from anywhere with Connect Pro.</p>
              
              <div className="action-bar">
                <div className="dropdown-wrapper">
                  <button 
                    className="btn-primary"
                    onClick={() => setShowDropdown(!showDropdown)}
                  >
                    New Meeting
                    <span style={{marginLeft: '0.5rem'}}>▾</span>
                  </button>
                  {showDropdown && (
                    <div className="dropdown-menu">
                      <button className="dropdown-item" onClick={() => {setShowDropdown(false); startInstantMeeting();}}>
                        Start an instant meeting
                      </button>
                      <button className="dropdown-item" onClick={() => {setShowDropdown(false); createMeetingLink();}}>
                        Create a meeting link
                      </button>
                      <button className="dropdown-item" onClick={() => {setShowDropdown(false); scheduleInCalendar();}}>
                        Schedule in Calendar
                      </button>
                    </div>
                  )}
                </div>
                <input 
                  className="input" 
                  placeholder="Enter a code or link..."
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                />
                <button className="btn-ghost" onClick={joinMeetingByCode}>Join</button>
                
                {/* Created Meeting Links Display */}
                {generatedMeetingLink && (
                  <div className="mt-6 relative meeting-link-container">
                    <div className="bg-blue-500 rounded-xl p-5 shadow-lg meeting-link-glow">
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={() => setGeneratedMeetingLink("")}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 ml-auto"
                          title="Clear link"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="bg-blue-500 rounded-lg p-4 shadow-lg">
                        <div className="bg-white rounded-lg p-3 mb-4">
                          <input
                            type="text"
                            value={generatedMeetingLink}
                            readOnly
                            className="w-full bg-transparent text-sm text-gray-700 font-mono focus:outline-none select-all text-center"
                            onClick={(e) => e.target.select()}
                          />
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (navigator.share) {
                                navigator.share({
                                  title: 'Join my video meeting',
                                  text: 'Click the link to join my video meeting on Connect Pro',
                                  url: generatedMeetingLink
                                });
                              } else {
                                copyMeetingLink();
                              }
                            }}
                            className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                          >
                            <span>📤</span>
                            Share
                          </button>
                          <button
                            onClick={copyMeetingLink}
                            className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center gap-2 justify-center"
                          >
                            <span>📋</span>
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              const subject = encodeURIComponent('Join my video meeting');
                              const body = encodeURIComponent(`Hi! Please join my video meeting using this link: ${generatedMeetingLink}`);
                              window.open(`mailto:?subject=${subject}&body=${body}`);
                            }}
                            className="flex-1 px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                          >
                            <span>📧</span>
                            Email
                          </button>
                        </div>

                      </div>

                    </div>
                  </div>
                )}
              </div>

              <div className="feature-card">
                <div className="feature-card-text">
                  ✨ Try our new screen-sharing features!
                </div>
              </div>

              <div className="mt-8" style={{maxWidth: '300px', margin: '2rem auto 0'}}>
                <Lottie animationData={wavingAnimation} loop autoplay />
              </div>
            </div>
          </div>
        </main>
      )}
      {/*call user pop up */}
      {showUserDetailModal && modalUser && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className='font-black text-xl mb-2'>User Details</p>
              <img
                src={modalUser.profilepic || "/default-avatar.png"}
                alt="User"
                className="w-20 h-20 rounded-full border-4 border-blue-500"
              />
              <h3 className="text-lg font-bold mt-3">{modalUser.username}</h3>
              <p className="text-sm text-gray-500">{modalUser.email}</p>

              <div className="flex gap-4 mt-5">
                <button
                  onClick={() => {
                    setSelectedUser(modalUser._id);
                    startCall(); // function that handles media and calling
                    setShowUserDetailModal(false);
                  }}
                  className="bg-green-600 text-white px-4 py-1 rounded-lg w-28 flex items-center gap-2 justify-center"
                >
                  Call <FaPhoneAlt />
                </button>
                <button
                  onClick={() => setShowUserDetailModal(false)}
                  className="bg-gray-400 text-white px-4 py-1 rounded-lg w-28"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Meeting Link Modal */}
      {showMeetingLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-bold mb-4">Meeting Link Created!</h3>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Share this link with others to join your meeting:
              </p>
              <div className="w-full p-3 bg-gray-100 rounded-lg mb-4 break-all text-sm">
                {generatedMeetingLink}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={copyMeetingLink}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => setShowMeetingLinkModal(false)}
                  className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Call rejection PopUp */}
      {callRejectedPopUp && rejectorData && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">Call Rejected From...</p>
              <img
                src={rejectorData?.profilepic || "/default-avatar.png"}
                alt="Caller"
                className="w-20 h-20 rounded-full border-4 border-green-500"
              />
              <h3 className="text-lg font-bold mt-3">{rejectorData?.name || "Unknown"}</h3>
              <div className="flex gap-4 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    startCall(); // function that handles media and calling
                  }}
                  className="bg-green-500 text-white px-4 py-1 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Call Again <FaPhoneAlt />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    endCallCleanup();
                    setCallRejectedPopUp(false);
                    setShowUserDetailModal(false);
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Back <FaPhoneSlash />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Incoming Call Modal */}
      {reciveCall && !callAccepted && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">Call From...</p>
              <img
                src={caller?.profilepic || "/default-avatar.png"}
                alt="Caller"
                className="w-20 h-20 rounded-full border-4 border-green-500"
              />
              <h3 className="text-lg font-bold mt-3">{callerName}</h3>
              <p className="text-sm text-gray-500">{caller?.email}</p>
              <div className="flex gap-4 mt-5">
                <button
                  type="button"
                  onClick={handelacceptCall}
                  className="bg-green-500 text-white px-4 py-1 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Accept <FaPhoneAlt />
                </button>
                <button
                  type="button"
                  onClick={handelrejectCall}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Reject <FaPhoneSlash />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>

  );
};

export default Dashboard;

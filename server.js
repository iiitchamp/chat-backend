const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.static("public"));

const activeUsers = new Map(); // Map to store active users

// Socket.IO setup
io.on("mongodb+srv://kraj:Champion1685@cluster0.o7g0j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", (socket) => {
  // Assign an anonymous username
  const username = `Guest-${socket.id.slice(0, 5)}`;
  activeUsers.set(socket.id, username);

  console.log(`${username} connected`);

  // Broadcast the updated user list
  io.emit("userList", Array.from(activeUsers.values()));

  // Handle group broadcast chat
  socket.on("chatMessage", (data) => {
    const sender = activeUsers.get(socket.id) || "Anonymous";
    io.emit("chatMessage", { sender, message: data.message });
  });

  // Handle private chat messages
  socket.on("privateMessage", (data) => {
    const { targetUsername, message } = data;
    const targetSocketId = [...activeUsers.entries()].find(
      ([, username]) => username === targetUsername
    )?.[0];

    if (targetSocketId) {
      io.to(targetSocketId).emit("privateMessage", {
        sender: activeUsers.get(socket.id),
        message,
      });
    } else {
      socket.emit("errorMessage", { error: "User not found" });
    }
  });

  // WebRTC signaling for group video calls
  socket.on("joinGroupVideoCall", () => {
    socket.broadcast.emit("userJoinedGroup", socket.id);
  });

  socket.on("offerGroup", (data) => {
    io.to(data.to).emit("offerGroup", { userId: socket.id, offer: data.offer });
  });

  socket.on("answerGroup", (data) => {
    io.to(data.to).emit("answerGroup", { userId: socket.id, answer: data.answer });
  });

  socket.on("iceCandidateGroup", (data) => {
    io.to(data.to).emit("iceCandidateGroup", { userId: socket.id, candidate: data.candidate });
  });

  // WebRTC signaling for one-to-one video call
  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", { userId: socket.id, offer: data.offer });
  });

  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", { userId: socket.id, answer: data.answer });
  });

  socket.on("iceCandidate", (data) => {
    io.to(data.to).emit("iceCandidate", { userId: socket.id, candidate: data.candidate });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log(`${activeUsers.get(socket.id)} disconnected`);
    activeUsers.delete(socket.id);
    io.emit("userList", Array.from(activeUsers.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

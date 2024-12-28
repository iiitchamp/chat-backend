const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");

// MongoDB connection
mongoose
  .connect("mongodb+srv://kraj:Champion1685@cluster0.o7g0j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Active users and chat history
const activeUsers = new Map();
const privateChats = new Map(); // { user1: { user2: [messages] }, ... }

// Socket.IO setup
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  activeUsers.set(socket.id, `Guest-${socket.id.slice(0, 5)}`);
  io.emit("userList", Array.from(activeUsers.values()));

  // Handle group chat messages
  socket.on("chatMessage", (data) => {
    const sender = activeUsers.get(socket.id) || "Anonymous";
    io.emit("chatMessage", { sender, message: data.message });
  });

  // Set username
  socket.on("setUsername", (username) => {
    activeUsers.set(socket.id, username);
    io.emit("userList", Array.from(activeUsers.values()));
  });

  // Handle private messaging
  socket.on("privateMessage", (data) => {
    const { targetUsername, message } = data;
    const sender = activeUsers.get(socket.id);
    const targetSocketId = [...activeUsers.entries()].find(
      ([, username]) => username === targetUsername
    )?.[0];

    if (targetSocketId) {
      // Store the message
      if (!privateChats.has(sender)) privateChats.set(sender, {});
      if (!privateChats.has(targetUsername))
        privateChats.set(targetUsername, {});

      const senderChats = privateChats.get(sender);
      const targetChats = privateChats.get(targetUsername);

      if (!senderChats[targetUsername]) senderChats[targetUsername] = [];
      if (!targetChats[sender]) targetChats[sender] = [];

      const chatMessage = { sender, message };
      senderChats[targetUsername].push(chatMessage);
      targetChats[sender].push(chatMessage);

      // Emit the private message
      io.to(targetSocketId).emit("privateMessage", chatMessage);
    } else {
      socket.emit("errorMessage", { error: "User not found" });
    }
  });

  // Fetch private chat history
  socket.on("fetchPrivateChat", ({ username, targetUsername }) => {
    const chatHistory =
      (privateChats.get(username) && privateChats.get(username)[targetUsername]) || [];
    socket.emit("privateChatHistory", { targetUsername, chatHistory });
  });

  // WebRTC signaling for video calls
  socket.on("callUser", ({ targetUsername, offer }) => {
    const targetSocketId = [...activeUsers.entries()].find(
      ([, username]) => username === targetUsername
    )?.[0];

    if (targetSocketId) {
      io.to(targetSocketId).emit("callUser", { from: socket.id, offer });
    } else {
      socket.emit("errorMessage", { error: "User not available for call" });
    }
  });

  socket.on("answerCall", ({ to, answer }) => {
    io.to(to).emit("callAnswered", { from: socket.id, answer });
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    io.to(to).emit("iceCandidate", { from: socket.id, candidate });
  });

  // Handle group calls
  socket.on("startGroupCall", () => {
    io.emit("groupCallStarted");
  });

  socket.on("endGroupCall", () => {
    io.emit("groupCallEnded");
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    activeUsers.delete(socket.id);
    io.emit("userList", Array.from(activeUsers.values()));
  });
});

// User Authentication Routes
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).send("Username and password are required");

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).send("User registered successfully");
  } catch (err) {
    res.status(400).send("Username already exists");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).send("Username and password are required");

  const user = await User.findOne({ username });
  if (!user) return res.status(404).send("User not found");

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).send("Invalid password");

  res.status(200).send("Login successful");
});

// Default route
app.get("/", (req, res) => {
  res.send("Welcome to the Chat and Video Call Server!");
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

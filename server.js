const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// MongoDB connection
mongoose.connect("mongodb+srv://kraj:Champion1685@cluster0.o7g0j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// Socket.IO setup
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Anonymous Group Chat
  socket.on("chatMessage", (data) => {
    io.emit("chatMessage", { sender: "Anonymous", message: data.message });
  });

  // User-specific messaging
  socket.on("privateMessage", (data) => {
    const { targetUserId, message } = data;
    io.to(targetUserId).emit("chatMessage", { sender: socket.id, message });
  });

  // WebRTC signaling
  socket.on("joinVideoCall", () => {
    socket.broadcast.emit("userJoined", socket.id);
  });

  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", { userId: socket.id, offer: data.offer });
  });

  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", { userId: socket.id, answer: data.answer });
  });

  socket.on("iceCandidate", (data) => {
    io.to(data.to).emit("iceCandidate", { userId: socket.id, candidate: data.candidate });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// User Authentication Routes
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Username and password are required");

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).send("User registered");
  } catch (err) {
    res.status(400).send("Username already exists");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Username and password are required");

  const user = await User.findOne({ username });
  if (!user) return res.status(404).send("User not found");

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).send("Invalid password");

  res.status(200).send("Login successful");
});

// Start server
const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on mongodb+srv://kraj:Champion1685@cluster0.o7g0j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0:${PORT}`));

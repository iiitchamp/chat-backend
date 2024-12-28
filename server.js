const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");

mongoose.connect("mongodb+srv://kraj:Champion1685@cluster0.o7g0j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected")).catch((err) => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const activeUsers = new Map();

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    activeUsers.set(socket.id, `Guest-${socket.id.slice(0, 5)}`);
    io.emit("userList", Array.from(activeUsers.values()));

    socket.on("chatMessage", (data) => {
        const sender = activeUsers.get(socket.id) || "Anonymous";
        io.emit("chatMessage", { sender, message: data.message });
    });

    socket.on("privateMessage", (data) => {
        const { targetUsername, message } = data;
        const targetSocketId = [...activeUsers.entries()].find(([ , username]) => username === targetUsername)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit("chatMessage", {
                sender: activeUsers.get(socket.id),
                message,
            });
        } else {
            socket.emit("errorMessage", { error: "User not found" });
        }
    });

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
        activeUsers.delete(socket.id);
        io.emit("userList", Array.from(activeUsers.values()));
    });
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Username and password are required");
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
    if (!username || !password) return res.status(400).send("Username and password are required");
    const user = await User.findOne({ username });
    if (!user) return res.status(404).send("User not found");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).send("Invalid password");
    res.status(200).send("Login successful");
});

app.get("/", (req, res) => {
    res.send("Welcome to the Chat and Video Call Server!");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

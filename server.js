const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = '904bfa5f239145e92d1b4f97dff28adc';

// MongoDB Connection
mongoose.connect('mongodb+srv://collab2rajesh:Champion%401685@cluster0.o7g0j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });

// MongoDB Schemas and Models
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
});
const GroupSchema = new mongoose.Schema({
    name: String,
    members: [String],
});
const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.json({ message: 'User registered successfully!' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// WebSocket for Real-Time Chat
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join global', () => {
        socket.join('global');
        io.to('global').emit('message', { user: 'Server', text: 'A user joined the global chat' });
    });

    socket.on('message', (data) => {
        io.to(data.room).emit('message', { user: data.user, text: data.text });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

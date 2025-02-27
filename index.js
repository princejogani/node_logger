import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { Server } from 'socket.io';
import { createServer } from 'http';

const app = express();
const PORT = 4000;
const LOG_FILE = 'logs.json';

// Create HTTP server and attach WebSocket
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors({
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "OPTIONS"], // Allow all methods
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Handle Preflight Requests
app.options('*', cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.static('temper-monkey-scripts'));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


// Ensure logs.json exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

// Handle incoming logs
app.post("/log", (req, res) => {
  try {
    const newLog = { timestamp: new Date().toISOString(), ...req.body };

    let logs = [];
    try {
      const fileData = fs.readFileSync(LOG_FILE, 'utf8');
      logs = fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      console.error("Error reading logs.json:", error);
      logs = [];
    }
    logs.unshift(newLog);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

    io.emit("newLog", newLog);

    console.log("Captured Network Log:", newLog);
    res.status(200).send("Received");
  } catch (error) {
    console.log(error);
  }
});

// WebSocket connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send all previous logs on connection
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    socket.emit("previousLogs", logs);
  } catch (error) {
    console.error("Error reading logs.json:", error);
  }

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

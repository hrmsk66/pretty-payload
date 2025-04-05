// server.js - Main server implementation for the request visualization tool
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

// Array to store request logs (limit to 100 most recent)
const MAX_LOGS = 100;
const requestLogs = [];

// Configure JSON parser with large size limit
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Logging middleware to capture only POST requests
app.use((req, res, next) => {
  // Skip logging for non-POST requests
  if (req.method !== "POST") {
    return next();
  }

  // Skip logging for static assets and API endpoints
  if (
    req.path === "/" ||
    req.path.startsWith("/styles") ||
    req.path.startsWith("/app.js") ||
    req.path === "/favicon.ico" ||
    req.path.startsWith("/api/")
  ) {
    return next();
  }

  // Capture request data
  const requestData = {
    id: Date.now().toString(),
    timestamp: new Date(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    bodySize: JSON.stringify(req.body).length,
    status: 200, // Default status
  };

  // Store logs
  requestLogs.push(requestData);

  // Trim logs if they exceed maximum count
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.splice(0, requestLogs.length - MAX_LOGS);
  }

  // Immediately respond with JSON instead of continuing to other handlers
  res.status(200).json({
    success: true,
    message: "POST request received and logged",
    path: req.path,
    timestamp: new Date(),
  });
});

// API to get all request logs
app.get("/api/logs", (req, res) => {
  // Sort logs with newest requests first
  const sortedLogs = [...requestLogs].reverse().map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    method: log.method,
    path: log.path,
    bodySize: log.bodySize,
    status: log.status,
  }));

  res.json(sortedLogs);
});

// API to clear all logs
app.delete("/api/logs", (req, res) => {
  // Clear the logs array
  requestLogs.length = 0;
  res.status(200).json({ success: true, message: "All logs cleared" });
});

// API to get a specific log by ID
app.get("/api/logs/:id", (req, res) => {
  const log = requestLogs.find((log) => log.id === req.params.id);
  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }
  res.json(log);
});

// Start the server
app.listen(port, () => {
  console.log(`Pretty Payloads server listening at http://localhost:${port}`);
});

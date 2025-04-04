// server.js
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

// Logging middleware to capture only POST requests except /view
app.use((req, res, next) => {
  // Skip logging for non-POST requests
  if (req.method !== "POST") {
    return next();
  }

  // Skip logging for the dashboard view and static assets
  if (
    req.path === "/view" ||
    req.path.startsWith("/styles") ||
    req.path.startsWith("/app.js") ||
    req.path === "/favicon.ico"
  ) {
    return next();
  }

  // Store original send method
  const originalSend = res.send;

  // Capture request data
  const requestData = {
    id: Date.now().toString(),
    timestamp: new Date(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    bodySize: JSON.stringify(req.body).length,
    status: null, // Will be set when the response is sent
  };

  // Override send method to capture response status
  res.send = function (body) {
    requestData.status = res.statusCode;

    // Save to logs
    requestLogs.push(requestData);

    // Trim logs if they exceed maximum count
    if (requestLogs.length > MAX_LOGS) {
      requestLogs.splice(0, requestLogs.length - MAX_LOGS);
    }

    // Call original send method
    return originalSend.apply(res, arguments);
  };

  next();
});

// /metrics endpoint - Keeping this for backward compatibility
app.post("/metrics", (req, res) => {
  // Just return success response since the middleware already logged the request
  res.status(200).json({ success: true, message: "Data received" });
});

// /view endpoint - Dashboard to view past requests
app.get("/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
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

// API to get a specific log by ID
app.get("/api/logs/:id", (req, res) => {
  const log = requestLogs.find((log) => log.id === req.params.id);
  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }
  res.json(log);
});

// Catch-all handler for any other POST requests - for testing
app.post("*", (req, res) => {
  res.status(200).json({
    message: "POST request received and logged",
    path: req.path,
    method: req.method,
    timestamp: new Date(),
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Pretty Payloads server listening at http://localhost:${port}`);
});

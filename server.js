// server.js - Main server implementation for the request visualization tool
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const zlib = require('zlib');
const util = require('util');

// Promisify zlib functions
const gunzip = util.promisify(zlib.gunzip);

// Array to store request logs (limit to 100 most recent)
const MAX_LOGS = 1000;
const requestLogs = [];

// Make sure we get the raw body for all requests
app.use((req, res, next) => {
  let data = [];

  req.on('data', (chunk) => {
    data.push(chunk);
  });

  req.on('end', async () => {
    // Convert the chunks to Buffer
    const buffer = Buffer.concat(data);
    req.rawBuffer = buffer;

    // Store the raw body as string for display
    req.rawBody = buffer.toString('utf8');

    // Check if content is gzipped
    const isGzipped = req.headers['content-encoding'] === 'gzip';
    req.isCompressed = isGzipped;

    let bodyContent = buffer;

    // Decompress if gzipped
    if (isGzipped) {
      try {
        bodyContent = await gunzip(buffer);
        // Store the decompressed content as string
        req.decompressedBody = bodyContent.toString('utf8');
      } catch (error) {
        console.error('Failed to decompress gzipped content:', error);
        req.decompressError = error.message;
      }
    }

    // If content-type is JSON, try to parse the body
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      try {
        // Use decompressed content if available, otherwise use the raw content
        const contentToProcess =
          isGzipped && req.decompressedBody ? req.decompressedBody : req.rawBody;
        req.body = JSON.parse(contentToProcess);
      } catch (error) {
        // If JSON parsing fails, keep the raw body as a string
        req.body = isGzipped && req.decompressedBody ? req.decompressedBody : req.rawBody;
        console.log('Invalid JSON payload received. Keeping as raw text.');
      }
    } else {
      // For non-JSON content types, keep the raw body
      req.body = isGzipped && req.decompressedBody ? req.decompressedBody : req.rawBody;
    }

    next();
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware to capture only POST requests
app.use((req, res, next) => {
  // Skip logging for non-POST requests
  if (req.method !== 'POST') {
    return next();
  }

  // Skip logging for static assets and API endpoints
  if (
    req.path === '/' ||
    req.path.startsWith('/styles') ||
    req.path.startsWith('/app.js') ||
    req.path === '/favicon.ico' ||
    req.path.startsWith('/pp-api/')
  ) {
    return next();
  }

  // Format headers into raw HTTP-like format
  const rawHeaders = Object.entries(req.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  // Use raw body for request display (with safety check)
  const bodyStr = req.rawBody || '';
  const bodySize = req.rawBuffer ? req.rawBuffer.length : Buffer.byteLength(bodyStr, 'utf8');

  // For raw request display, use the raw (compressed) content
  const rawRequest = `${req.method} ${req.path} HTTP/1.1\n${rawHeaders}\n\n${bodyStr}`;

  // Get client IP address
  const ip = req.headers['fastly-client-ip'] || req.connection.remoteAddress || req.ip || '';

  // Capture request data
  const requestData = {
    id: Date.now().toString(),
    timestamp: new Date(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    rawBody: bodyStr,
    bodySize: bodySize,
    rawRequest: rawRequest,
    isCompressed: req.isCompressed,
    decompressError: req.decompressError,
    originalSize:
      req.isCompressed && req.decompressedBody
        ? Buffer.byteLength(req.decompressedBody, 'utf8')
        : bodySize,
    ip: ip,
  };

  // Store logs
  requestLogs.push(requestData);

  // Trim logs if they exceed maximum count
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.splice(0, requestLogs.length - MAX_LOGS);
  }

  // Simplify response to just return path and size with a more natural phrasing
  res.status(200).send(`Request to ${req.path} received (${bodySize} bytes)`);
});

// API to get all request logs
app.get('/pp-api/logs', (req, res) => {
  // Sort logs with newest requests first
  const sortedLogs = [...requestLogs].reverse().map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    method: log.method,
    path: log.path,
    bodySize: log.bodySize,
    isCompressed: log.isCompressed,
    originalSize: log.originalSize,
    headers: log.headers,
    ip: log.ip,
  }));

  res.json(sortedLogs);
});

// API to clear all logs
app.delete('/pp-api/logs', (req, res) => {
  // Clear the logs array
  requestLogs.length = 0;
  res.status(200).json({ success: true, message: 'All logs cleared' });
});

// API to get a specific log by ID
app.get('/pp-api/logs/:id', (req, res) => {
  const log = requestLogs.find((log) => log.id === req.params.id);
  if (!log) {
    return res.status(404).json({ error: 'Log not found' });
  }
  res.json(log);
});

// Start the server
app.listen(port, () => {
  console.log(`Pretty Payloads server listening at http://localhost:${port}`);
});

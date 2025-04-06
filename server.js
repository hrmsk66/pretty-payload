// server.js - Main server implementation for the request visualization tool
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const zlib = require('zlib');
const util = require('util');
const WorkspaceManager = require('./lib/workspaceManager');

// Promisify zlib functions
const gunzip = util.promisify(zlib.gunzip);

// Initialize the workspace manager
const workspaceManager = new WorkspaceManager();

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

// API to create a new workspace and return its ID
app.post('/api/workspaces', (req, res) => {
  const workspaceId = workspaceManager.createWorkspace();
  res.json({ success: true, workspaceId });
});

// API to get all predefined workspaces
app.get('/api/workspaces/predefined', (req, res) => {
  res.json({ workspaces: workspaceManager.predefinedWorkspaces });
});

// For workspace health check and status
app.get('/api/status', (req, res) => {
  const stats = {
    activeWorkspacesCount: workspaceManager.getWorkspacesCount(),
    uptime: process.uptime(),
  };
  res.json(stats);
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API to get all request logs for a workspace
app.get('/api/:workspaceId/logs', (req, res) => {
  const { workspaceId } = req.params;
  const workspace = workspaceManager.getWorkspace(workspaceId);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  // Mark workspace as active
  workspaceManager.touchWorkspace(workspaceId);

  // Sort logs with newest requests first
  const sortedLogs = [...workspace.logs].reverse().map((log) => ({
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

// API to clear all logs for a workspace
app.delete('/api/:workspaceId/logs', (req, res) => {
  const { workspaceId } = req.params;
  const success = workspaceManager.clearWorkspaceLogs(workspaceId);

  if (!success) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  res.status(200).json({ success: true, message: 'All logs cleared' });
});

// API to get a specific log by ID for a workspace
app.get('/api/:workspaceId/logs/:logId', (req, res) => {
  const { workspaceId, logId } = req.params;
  const workspace = workspaceManager.getWorkspace(workspaceId);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  // Mark workspace as active
  workspaceManager.touchWorkspace(workspaceId);

  const log = workspace.logs.find((log) => log.id === logId);
  if (!log) {
    return res.status(404).json({ error: 'Log not found' });
  }

  res.json(log);
});

// Serve the dashboard for a specific workspace
app.get('/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;

  // Check if workspace exists
  if (!workspaceManager.getWorkspace(workspaceId)) {
    return res.status(404).send('Workspace not found');
  }

  // Mark workspace as active
  workspaceManager.touchWorkspace(workspaceId);

  // Serve the dashboard HTML - now using dashboard.html instead of index.html
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Logging middleware to capture workspace POST requests
app.post(['/:workspaceId', '/:workspaceId/*'], (req, res) => {
  const { workspaceId } = req.params;
  const workspace = workspaceManager.getWorkspace(workspaceId);

  // Check if workspace exists
  if (!workspace) {
    return res.status(404).send('Workspace not found');
  }

  // Mark workspace as active
  workspaceManager.touchWorkspace(workspaceId);

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

  // Store logs with the workspace manager
  workspaceManager.addRequestLog(workspaceId, requestData);

  // Respond with confirmation
  res.status(200).send(`Request to ${req.path} received (${bodySize} bytes)`);
});

// Start housekeeping task for workspace cleanup
workspaceManager.startHousekeeping();

// Start the server
app.listen(port, () => {
  console.log(`Pretty Payloads server listening at http://localhost:${port}`);
});

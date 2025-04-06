// server.js - Main server implementation for the request visualization tool
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const zlib = require('zlib');
const util = require('util');
const { TenantManager } = require('./lib/tenantManager');

// Promisify zlib functions
const gunzip = util.promisify(zlib.gunzip);

// Initialize the tenant manager
const tenantManager = new TenantManager();

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

// Root redirect to a new tenant - IMPORTANT: This must be defined BEFORE static file middleware
app.get('/', (req, res) => {
  const tenantId = tenantManager.createTenant();
  res.redirect(`/${tenantId}`);
});

// For tenant health check and status
app.get('/api/status', (req, res) => {
  const stats = {
    activeTenantsCount: tenantManager.getTenantsCount(),
    uptime: process.uptime(),
  };
  res.json(stats);
});

// Serve static files - Now placed AFTER the root redirect handler
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints for tenants
// Important: Fixed route order to prevent route conflicts

// API to get all request logs for a tenant
app.get('/api/:tenantId/logs', (req, res) => {
  const { tenantId } = req.params;
  const tenant = tenantManager.getTenant(tenantId);

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Mark tenant as active
  tenantManager.touchTenant(tenantId);

  // Sort logs with newest requests first
  const sortedLogs = [...tenant.logs].reverse().map((log) => ({
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

// API to clear all logs for a tenant
app.delete('/api/:tenantId/logs', (req, res) => {
  const { tenantId } = req.params;
  const success = tenantManager.clearTenantLogs(tenantId);

  if (!success) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  res.status(200).json({ success: true, message: 'All logs cleared' });
});

// API to get a specific log by ID for a tenant
app.get('/api/:tenantId/logs/:logId', (req, res) => {
  const { tenantId, logId } = req.params;
  const tenant = tenantManager.getTenant(tenantId);

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Mark tenant as active
  tenantManager.touchTenant(tenantId);

  const log = tenant.logs.find((log) => log.id === logId);
  if (!log) {
    return res.status(404).json({ error: 'Log not found' });
  }

  res.json(log);
});

// Serve the dashboard for a specific tenant
app.get('/:tenantId', (req, res) => {
  const { tenantId } = req.params;

  // Check if tenant exists
  if (!tenantManager.getTenant(tenantId)) {
    return res.status(404).send('Tenant not found');
  }

  // Mark tenant as active
  tenantManager.touchTenant(tenantId);

  // Serve the dashboard HTML
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Logging middleware to capture tenant POST requests
app.post('/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  const tenant = tenantManager.getTenant(tenantId);

  // Check if tenant exists
  if (!tenant) {
    return res.status(404).send('Tenant not found');
  }

  // Mark tenant as active
  tenantManager.touchTenant(tenantId);

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

  // Store logs with the tenant manager
  tenantManager.addRequestLog(tenantId, requestData);

  // Respond with confirmation
  res.status(200).send(`Request to ${req.path} received (${bodySize} bytes)`);
});

// Start housekeeping task for tenant cleanup
tenantManager.startHousekeeping();

// Start the server
app.listen(port, () => {
  console.log(`Pretty Payloads server listening at http://localhost:${port}`);
});

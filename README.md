# Pretty Payload

A visualization tool for inspecting and monitoring HTTP POST requests. View request headers and bodies with syntax highlighting in a dashboard.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pretty-payload.git
cd pretty-payload

# Install dependencies
npm install

# Start the server
npm start
```

## Basic Usage

1. **Creating a New Dashboard**:

   - Visit `http://localhost:3000/new` to be automatically redirected to a randomly generated path like `/colorful-intelligent-cat`
   - In this example, `colorful-intelligent-cat` becomes your `:tenantId`

2. **Sending and Monitoring Requests**:

   - All POST requests sent to paths starting with `/:tenantId` are recorded on your dashboard

3. **Automatic Cleanup**:

   - Any `:tenantId` not used for 7 days will be automatically deleted

## API Endpoints

- `POST /:tenantId/*` - Endpoint for receiving requests
- `GET /:tenantId/logs` - Get a list of all request logs
- `GET /:tenantId/logs/:id` - Get details for a specific request log
- `DELETE /:tenantId/logs` - Clear all request logs
- `GET /api/status` - Returns the number of active tenants and server uptime

## License

MIT

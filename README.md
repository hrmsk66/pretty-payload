# Pretty Payload

An API request visualizer for inspecting HTTP requests with syntax-highlighted headers and bodies.

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

1. **Creating a New Workspace**:

   - Visit the root path '/' to access the landing page
   - Click the "Create New Workspace" button
   - You'll be automatically redirected to a workspace with a randomly generated ID like `/colorful-intelligent-cat`

2. **Sending and Monitoring Requests**:

   - All POST requests sent to paths starting with your workspace ID (e.g., `/colorful-intelligent-cat`) are recorded on your dashboard

3. **Automatic Cleanup**:

   - Any workspace not used for 7 days will be automatically deleted

## API Endpoints

- `POST /:workspaceId/*` - Endpoint for receiving requests
- `GET /api/:workspaceId/logs` - Get a list of all request logs
- `GET /api/:workspaceId/logs/:id` - Get details for a specific request log
- `DELETE /api/:workspaceId/logs` - Clear all request logs
- `GET /api/status` - Returns the number of active workspaces and server uptime
- `POST /api/workspaces` - Create a new workspace

## License

MIT

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

Visit http://localhost:3000 to view the dashboard.

## Usage

Send POST requests to your server at any path.

Example request:

```bash
curl -X POST http://localhost:3000/any/path \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Testing Regular JSON Requests

You can send a test JSON payload using curl:

```bash
curl -X POST http://localhost:3000/any/test/path \
  -H "Content-Type: application/json" \
  -d @tests/test.json
```

### Testing Gzipped JSON Requests

To test the gzip decompression feature, you can use the pre-compressed file:

```bash
curl -X POST http://localhost:3000/any/test/path \
  -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" \
  --data-binary @tests/test.json.gz
```

## API Endpoints

The tool uses the following API endpoints:

- `POST /pp-api/*` - These paths are reserved for internal use
- `GET /pp-api/logs` - Get list of all request logs
- `GET /pp-api/logs/:id` - Get details for a specific request log
- `DELETE /pp-api/logs` - Clear all request logs

## License

MIT

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

## License

MIT

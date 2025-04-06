// public/app.js - Frontend client for the dashboard
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const logListElement = document.getElementById('log-list');
  const jsonViewerElement = document.getElementById('json-viewer');
  const headersViewerElement = document.getElementById('headers-viewer');
  const rawViewerElement = document.getElementById('raw-viewer');
  const binaryViewerElement = document.getElementById('binary-viewer');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const clearRequestsButton = document.getElementById('clear-requests');
  const pathFilterInput = document.getElementById('path-filter');
  const clearFilterButton = document.getElementById('clear-filter');
  const copyJsonButton = document.getElementById('copy-json');

  // Currently selected log ID
  let selectedLogId = null;
  // Store logs to prevent clearing
  let storedLogs = [];
  // Current filter value
  let currentFilter = '';
  // Store the current request data for copy functionality
  let currentRequestData = null;

  // Tab switching functionality
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      // Remove active class from all tab buttons
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      // Remove active class from all tab panes
      tabPanes.forEach((pane) => pane.classList.remove('active'));

      // Add active class to clicked tab and its corresponding pane
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-pane`).classList.add('active');
    });
  });

  // Add filter functionality
  pathFilterInput.addEventListener('input', (e) => {
    currentFilter = e.target.value.toLowerCase();
    renderLogList();
  });

  // Clear filter button
  clearFilterButton.addEventListener('click', () => {
    pathFilterInput.value = '';
    currentFilter = '';
    renderLogList();
  });

  // Fetch and display log list - split into fetching and rendering
  function fetchLogs() {
    fetch('/pp-api/logs')
      .then((response) => response.json())
      .then((logs) => {
        // Save logs to our stored array
        if (logs.length > 0) {
          storedLogs = logs;
        }

        renderLogList();
      })
      .catch((error) => {
        console.error('Error fetching logs:', error);
        logListElement.innerHTML = `
          <div class="empty-state">
            <p>Error occurred while fetching logs</p>
            <p>${error.message}</p>
          </div>
        `;
      });
  }

  // Render log list with current filter applied
  function renderLogList() {
    if (storedLogs.length === 0) {
      logListElement.innerHTML = `
        <div class="empty-state">
          <p>No requests yet</p>
          <p>Send any POST request to me</p>
        </div>
      `;
      return;
    }

    // Clear log list
    logListElement.innerHTML = '';

    // Filter logs based on current filter
    const filteredLogs = storedLogs.filter((log) => {
      if (!currentFilter) {
        return true;
      }

      // Search in path
      if (log.path.toLowerCase().includes(currentFilter)) {
        return true;
      }

      // Search in headers
      if (
        JSON.stringify(log.headers || {})
          .toLowerCase()
          .includes(currentFilter)
      ) {
        return true;
      }

      // Search in IP address
      if (log.ip && log.ip.toLowerCase().includes(currentFilter)) {
        return true;
      }

      return false;
    });

    if (filteredLogs.length === 0) {
      logListElement.innerHTML = `
        <div class="empty-state">
          <p>No matching requests</p>
          <p>Try a different filter</p>
        </div>
      `;
      return;
    }

    // Create list item for each log
    filteredLogs.forEach((log) => {
      const logItem = document.createElement('div');
      logItem.className = 'log-item';
      logItem.setAttribute('data-id', log.id);

      const timestamp = new Date(log.timestamp);
      const formattedTime = timestamp.toLocaleTimeString();

      // Compression badge
      const compressionBadge = log.isCompressed
        ? `<span class="compressed-badge">Compressed</span>`
        : '';

      // IP address badge
      const ipBadge = log.ip ? `<span class="ip-badge">IP: ${log.ip}</span>` : '';

      logItem.innerHTML = `
        <div>
          <span class="log-method ${log.method.toLowerCase()}">${log.method}</span>
          <span class="log-path">${log.path}</span>
        </div>
        <div class="log-details">
          <span class="size-badge">Size: ${formatBytes(log.bodySize)}</span>
          ${compressionBadge}
          ${ipBadge}
          <span class="time-badge">ReceivedAt: ${formattedTime}</span>
        </div>
      `;

      // Add click event
      logItem.addEventListener('click', () => {
        // Remove active class from all log items
        document.querySelectorAll('.log-item').forEach((item) => {
          item.classList.remove('active');
        });

        // Add active class to clicked item
        logItem.classList.add('active');

        // Fetch and display log details
        fetchLogDetails(log.id);
      });

      logListElement.appendChild(logItem);
    });

    // Select first log if it exists and none is selected
    if (filteredLogs.length > 0 && !selectedLogId) {
      const firstLogItem = logListElement.querySelector('.log-item');
      if (firstLogItem) {
        firstLogItem.classList.add('active');
        fetchLogDetails(filteredLogs[0].id);
      }
    } else if (selectedLogId) {
      // Keep previously selected log highlighted if it still exists
      const selectedItem = logListElement.querySelector(`[data-id="${selectedLogId}"]`);
      if (selectedItem) {
        selectedItem.classList.add('active');
      }
    }
  }

  // Fetch and display details for a specific log
  function fetchLogDetails(logId) {
    selectedLogId = logId;

    fetch(`/pp-api/logs/${logId}`)
      .then((response) => response.json())
      .then((log) => {
        // Store current request data for copy functionality
        currentRequestData = log;

        // Show the copy button when a log is selected
        copyJsonButton.classList.add('visible');

        // Add decompression notice if applicable
        let decompressionNote = '';
        if (log.isCompressed) {
          if (log.decompressError) {
            decompressionNote = `<div class="decompression-error">Failed to decompress: ${log.decompressError}</div>`;
          } else {
            decompressionNote = `<div class="decompression-notice">✓ Decompressed gzipped content - ${formatBytes(
              log.bodySize
            )} (${log.bodySize} bytes) → ${formatBytes(log.originalSize)} (${
              log.originalSize
            } bytes)</div>`;
          }
        }

        // Display body in JSON viewer with decompression notice if applicable
        jsonViewerElement.innerHTML = decompressionNote + formatJSON(log.body);

        // Display headers line by line
        headersViewerElement.innerHTML = formatHeaders(log.headers);

        // Display raw request
        if (log.rawRequest) {
          rawViewerElement.textContent = log.rawRequest;

          // Display binary representation
          binaryViewerElement.innerHTML = formatBinary(log.rawRequest);
        } else {
          // Fallback for logs that don't have rawRequest
          const rawHeaders = Object.entries(log.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

          // Use raw body if available, otherwise use stringified body without pretty-printing
          const bodyStr = log.rawBody || JSON.stringify(log.body);
          const rawRequest = `${log.method} ${log.path} HTTP/1.1\n${rawHeaders}\n\n${bodyStr}`;
          rawViewerElement.textContent = rawRequest;

          // Display binary representation
          binaryViewerElement.innerHTML = formatBinary(rawRequest);
        }
      })
      .catch((error) => {
        console.error('Error fetching log details:', error);
        jsonViewerElement.innerHTML = `Error: ${error.message}`;
        headersViewerElement.innerHTML = `Error: ${error.message}`;
        rawViewerElement.textContent = `Error: ${error.message}`;
        binaryViewerElement.innerHTML = `Error: ${error.message}`;
        currentRequestData = null;

        // Hide copy button on error
        copyJsonButton.classList.remove('visible');
      });
  }

  // Copy JSON button functionality
  copyJsonButton.addEventListener('click', () => {
    if (!currentRequestData) return;

    try {
      // Create a formatted version of the JSON
      const formattedJson = JSON.stringify(currentRequestData.body, null, 2);

      // Copy to clipboard without showing a message
      navigator.clipboard.writeText(formattedJson).catch((err) => {
        console.error('Failed to copy text: ', err);
      });
    } catch (error) {
      console.error('Error copying JSON: ', error);
    }
  });

  // Format headers to display one per line
  function formatHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) {
      return '<span class="null">No headers</span>';
    }

    let html = '';

    // Sort header names alphabetically for consistency
    const headerNames = Object.keys(headers).sort();

    headerNames.forEach((name) => {
      const value = headers[name];
      // Create a line for each header
      html += `<div class="header-line">
        <span class="header-key">${escapeHTML(name)}</span>
        <span class="header-value">${escapeHTML(String(value))}</span>
      </div>`;
    });

    return html;
  }

  // Format and colorize JSON function
  function formatJSON(obj) {
    // Handle empty objects
    if (!obj) {
      return '<span class="null">Empty object</span>';
    }

    // Handle string objects (non-JSON payloads)
    if (typeof obj === 'string') {
      // Try to parse it as JSON first
      try {
        const parsedObj = JSON.parse(obj);
        // If it parses successfully, format it as JSON
        return formatJSON(parsedObj);
      } catch (e) {
        // If it's not JSON, display as plain text with HTML escaping
        return `<span class="string">${escapeHTML(obj)}</span>`;
      }
    }

    try {
      // Create a pre-formatted version with proper indentation
      const jsonString = JSON.stringify(obj, null, 2);

      if (!jsonString) {
        return '<span class="null">Invalid object</span>';
      }

      // Create a safe version with HTML entities
      let safeHTML = '';

      // Process each character
      let inString = false;
      let currentKeyContent = '';
      let isKey = false;

      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        const nextChar = jsonString[i + 1] || '';

        // Handle string quotes
        if (char === '"') {
          if (!inString) {
            // Starting a string
            inString = true;
            // Check if this is likely a key (followed by a colon)
            let j = i + 1;
            while (j < jsonString.length && jsonString[j] !== '"' && jsonString[j] !== '\n') j++;

            // If we find a quote and then a colon, it's a key
            isKey =
              j < jsonString.length - 1 &&
              jsonString[j] === '"' &&
              jsonString
                .substring(j + 1)
                .trim()
                .startsWith(':');

            if (isKey) {
              safeHTML += '<span class="key">"';
              currentKeyContent = '';
            } else {
              safeHTML += '<span class="string">"';
            }
          } else {
            // Ending a string
            inString = false;
            if (isKey) {
              safeHTML += '"</span>';
              isKey = false;
            } else {
              safeHTML += '"</span>';
            }
          }
        }
        // Handle special HTML characters
        else if (char === '<') {
          safeHTML += '&lt;';
        } else if (char === '>') {
          safeHTML += '&gt;';
        } else if (char === '&') {
          safeHTML += '&amp;';
        }
        // Handle boolean values
        else if (
          !inString &&
          ((char === 't' && jsonString.substr(i, 4) === 'true') ||
            (char === 'f' && jsonString.substr(i, 5) === 'false'))
        ) {
          const word = char === 't' ? 'true' : 'false';
          safeHTML += `<span class="boolean">${word}</span>`;
          i += word.length - 1; // Skip the rest of the word
        }
        // Handle null
        else if (!inString && char === 'n' && jsonString.substr(i, 4) === 'null') {
          safeHTML += '<span class="null">null</span>';
          i += 3; // Skip the rest of the word
        }
        // Handle numbers
        else if (!inString && ((char >= '0' && char <= '9') || char === '-')) {
          let numStr = char;
          let j = i + 1;
          while (
            j < jsonString.length &&
            ((jsonString[j] >= '0' && jsonString[j] <= '9') ||
              jsonString[j] === '.' ||
              jsonString[j] === 'e' ||
              jsonString[j] === 'E' ||
              jsonString[j] === '+' ||
              jsonString[j] === '-')
          ) {
            numStr += jsonString[j];
            j++;
          }

          // Only handle as number if it's valid
          if (!isNaN(parseFloat(numStr))) {
            safeHTML += `<span class="number">${numStr}</span>`;
            i = j - 1; // Adjust index to skip processed characters
          } else {
            // Not a valid number, just add the current character
            safeHTML += char;
          }
        }
        // Regular character
        else {
          safeHTML += char;
          if (inString && isKey) {
            currentKeyContent += char;
          }
        }
      }

      return safeHTML;
    } catch (error) {
      console.error('Error formatting JSON:', error);
      // Display error message
      return `<span class="null">Error formatting: ${escapeHTML(String(error))}</span>`;
    }
  }

  // HTML escape function
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;') // Fix: removed the extra space between < and /
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Format byte size to human-readable format
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Format binary representation of data
  function formatBinary(data) {
    if (!data || data.length === 0) {
      return '<span class="null">No data</span>';
    }

    let html = '';
    const bytes = new TextEncoder().encode(data);
    const BYTES_PER_ROW = 16;

    // Process each row of bytes
    for (let offset = 0; offset < bytes.length; offset += BYTES_PER_ROW) {
      const rowBytes = bytes.slice(offset, offset + BYTES_PER_ROW);

      // Create row container
      html += '<div class="binary-row">';

      // Add offset
      html += `<div class="binary-offset">${offset.toString(16).padStart(8, '0')}</div>`;

      // Add hex representation
      html += '<div class="binary-hex">';
      for (let i = 0; i < BYTES_PER_ROW; i++) {
        if (i < rowBytes.length) {
          html += `<span>${rowBytes[i].toString(16).padStart(2, '0')}</span>`;
        } else {
          html += '<span>  </span>';
        }
      }
      html += '</div>';

      // Add ASCII representation
      html += '<div class="binary-ascii">';
      for (let i = 0; i < BYTES_PER_ROW; i++) {
        if (i < rowBytes.length) {
          const byte = rowBytes[i];
          // Display printable ASCII characters (32-126), replace others with a dot
          const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
          html += `<span>${escapeHTML(char)}</span>`;
        } else {
          html += '<span> </span>';
        }
      }
      html += '</div>';

      // Close row
      html += '</div>';
    }

    return html;
  }

  // Initial fetch
  fetchLogs();

  // Handle clear requests button click
  clearRequestsButton.addEventListener('click', () => {
    clearAllLogs();
  });

  // Function to clear all logs
  function clearAllLogs() {
    fetch('/pp-api/logs', {
      method: 'DELETE',
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Clear stored logs
          storedLogs = [];
          selectedLogId = null;
          currentRequestData = null;
          // Hide copy button when logs are cleared
          copyJsonButton.classList.remove('visible');

          // Clear filter
          pathFilterInput.value = '';
          currentFilter = '';

          // Clear UI
          logListElement.innerHTML = `
            <div class="empty-state">
              <p>No requests yet</p>
              <p>Send any POST request to me</p>
            </div>
          `;
          jsonViewerElement.innerHTML = '';
          headersViewerElement.innerHTML = '';
          rawViewerElement.textContent = '';
        }
      })
      .catch((error) => {
        console.error('Error clearing logs:', error);
        alert('Failed to clear logs: ' + error.message);
      });
  }

  // Initial state - hide copy button by default
  copyJsonButton.classList.remove('visible');

  // Auto-refresh every 5 seconds
  setInterval(fetchLogs, 5000);
});

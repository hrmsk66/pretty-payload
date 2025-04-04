// public/app.js
document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const logListElement = document.getElementById("log-list");
  const jsonViewerElement = document.getElementById("json-viewer");
  const headersViewerElement = document.getElementById("headers-viewer");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Currently selected log ID
  let selectedLogId = null;
  // Store logs to prevent clearing
  let storedLogs = [];

  // Tab switching functionality
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all tab buttons
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      // Remove active class from all tab panes
      tabPanes.forEach((pane) => pane.classList.remove("active"));

      // Add active class to clicked tab and its corresponding pane
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      document.getElementById(`${tabId}-pane`).classList.add("active");
    });
  });

  // Fetch and display log list
  function fetchLogs() {
    fetch("/api/logs")
      .then((response) => response.json())
      .then((logs) => {
        // Save logs to our stored array
        if (logs.length > 0) {
          storedLogs = logs;
        }

        if (storedLogs.length === 0) {
          logListElement.innerHTML = `
            <div class="empty-state">
              <p>No requests yet</p>
              <p>Send data to POST /metrics</p>
            </div>
          `;
          return;
        }

        // Clear log list
        logListElement.innerHTML = "";

        // Create list item for each log
        storedLogs.forEach((log) => {
          const logItem = document.createElement("div");
          logItem.className = "log-item";
          logItem.setAttribute("data-id", log.id);

          // Animation removed

          const timestamp = new Date(log.timestamp);
          const formattedTime = timestamp.toLocaleTimeString();

          logItem.innerHTML = `
            <div>
              <span class="log-method ${log.method.toLowerCase()}">${
            log.method
          }</span>
              <span class="log-path">${log.path}</span>
            </div>
            <div class="log-details">
              <span class="size-badge">Size: ${formatBytes(log.bodySize)}</span>
              <span class="status-badge">Status: ${log.status}</span>
              <span class="time-badge">ReceivedAt: ${formattedTime}</span>
            </div>
          `;

          // Add click event
          logItem.addEventListener("click", () => {
            // Remove active class from all log items
            document.querySelectorAll(".log-item").forEach((item) => {
              item.classList.remove("active");
            });

            // Add active class to clicked item
            logItem.classList.add("active");

            // Fetch and display log details
            fetchLogDetails(log.id);
          });

          logListElement.appendChild(logItem);
        });

        // Select first log if it exists and none is selected
        if (storedLogs.length > 0 && !selectedLogId) {
          const firstLogItem = logListElement.querySelector(".log-item");
          if (firstLogItem) {
            firstLogItem.classList.add("active");
            fetchLogDetails(storedLogs[0].id);
          }
        } else if (selectedLogId) {
          // Keep previously selected log highlighted if it still exists
          const selectedItem = logListElement.querySelector(
            `[data-id="${selectedLogId}"]`
          );
          if (selectedItem) {
            selectedItem.classList.add("active");
          }
        }

        // Animation removed
      })
      .catch((error) => {
        console.error("Error fetching logs:", error);
        logListElement.innerHTML = `
          <div class="empty-state">
            <p>Error occurred while fetching logs</p>
            <p>${error.message}</p>
          </div>
        `;
      });
  }

  // Fetch and display details for a specific log
  function fetchLogDetails(logId) {
    selectedLogId = logId;

    fetch(`/api/logs/${logId}`)
      .then((response) => response.json())
      .then((log) => {
        // Display body in JSON viewer
        jsonViewerElement.innerHTML = formatJSON(log.body);

        // Display headers in headers viewer
        headersViewerElement.innerHTML = formatJSON(log.headers);
      })
      .catch((error) => {
        console.error("Error fetching log details:", error);
        jsonViewerElement.innerHTML = `Error: ${error.message}`;
        headersViewerElement.innerHTML = `Error: ${error.message}`;
      });
  }

  // Function removed - no animation effects needed

  // Format and colorize JSON function
  function formatJSON(obj) {
    // Create a pre-formatted version with proper indentation
    const jsonString = JSON.stringify(obj, null, 2);

    // Create a safe version with HTML entities
    let safeHTML = "";

    // Manually handle each character to avoid regex issues
    let inString = false;
    let currentKeyContent = "";
    let isKey = false;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];
      const nextChar = jsonString[i + 1] || "";

      // Handle string quotes
      if (char === '"') {
        if (!inString) {
          // Starting a string
          inString = true;
          // Check if this is likely a key (followed by a colon)
          let j = i + 1;
          while (
            j < jsonString.length &&
            jsonString[j] !== '"' &&
            jsonString[j] !== "\n"
          )
            j++;

          // If we find a quote and then a colon, it's a key
          isKey =
            j < jsonString.length - 1 &&
            jsonString[j] === '"' &&
            jsonString
              .substring(j + 1)
              .trim()
              .startsWith(":");

          if (isKey) {
            safeHTML += '<span class="key">"';
            currentKeyContent = "";
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
      else if (char === "<") {
        safeHTML += "&lt;";
      } else if (char === ">") {
        safeHTML += "&gt;";
      } else if (char === "&") {
        safeHTML += "&amp;";
      }
      // Handle boolean values
      else if (
        !inString &&
        ((char === "t" && jsonString.substr(i, 4) === "true") ||
          (char === "f" && jsonString.substr(i, 5) === "false"))
      ) {
        const word = char === "t" ? "true" : "false";
        safeHTML += `<span class="boolean">${word}</span>`;
        i += word.length - 1; // Skip the rest of the word
      }
      // Handle null
      else if (
        !inString &&
        char === "n" &&
        jsonString.substr(i, 4) === "null"
      ) {
        safeHTML += '<span class="null">null</span>';
        i += 3; // Skip the rest of the word
      }
      // Handle numbers
      else if (!inString && ((char >= "0" && char <= "9") || char === "-")) {
        let numStr = char;
        let j = i + 1;
        while (
          j < jsonString.length &&
          ((jsonString[j] >= "0" && jsonString[j] <= "9") ||
            jsonString[j] === "." ||
            jsonString[j] === "e" ||
            jsonString[j] === "E" ||
            jsonString[j] === "+" ||
            jsonString[j] === "-")
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
  }

  // Format byte size to human-readable format
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  // Initial fetch
  fetchLogs();

  // Auto-refresh every 5 seconds
  setInterval(fetchLogs, 5000);
});

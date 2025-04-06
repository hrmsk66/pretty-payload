// lib/workspaceManager.js - Manages workspace isolation and lifecycle
const utils = require('./utils');

class WorkspaceManager {
  constructor() {
    this.workspaces = new Map();
    this.MAX_LOGS_PER_WORKSPACE = 100;
    // Workspace expiration time: 7 days (in milliseconds)
    this.WORKSPACE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
    // Housekeeping interval: 1 hour
    this.HOUSEKEEPING_INTERVAL_MS = 60 * 60 * 1000;
    // Pre-defined workspaces that won't be cleaned up during housekeeping
    this.predefinedWorkspaces = ['kake', 'goma', 'mzhou'];

    // Initialize pre-defined workspaces
    this.initPredefinedWorkspaces();
  }

  /**
   * Initialize pre-defined workspaces
   */
  initPredefinedWorkspaces() {
    this.predefinedWorkspaces.forEach((workspaceId) => {
      if (!this.workspaces.has(workspaceId)) {
        this.workspaces.set(workspaceId, {
          created: Date.now(),
          lastActive: Date.now(),
          logs: [],
          isPredefined: true,
        });
        console.log(`Initialized pre-defined workspace: ${workspaceId}`);
      }
    });
  }

  /**
   * Create a new workspace with a unique ID
   * @param {string} [workspaceId] - Optional workspace ID for pre-defined workspaces
   * @returns {string} The new workspace ID
   */
  createWorkspace(workspaceId) {
    // If workspace ID is provided, check if it's pre-defined
    if (workspaceId) {
      if (this.predefinedWorkspaces.includes(workspaceId)) {
        // If the workspace already exists, just return the ID
        if (this.workspaces.has(workspaceId)) {
          return workspaceId;
        }

        // Otherwise, create the pre-defined workspace
        this.workspaces.set(workspaceId, {
          created: Date.now(),
          lastActive: Date.now(),
          logs: [],
          isPredefined: true,
        });
        console.log(`Created pre-defined workspace: ${workspaceId}`);
        return workspaceId;
      }
    }

    // Generate a new random workspace ID
    const newWorkspaceId = utils.generateWorkspaceId();
    this.workspaces.set(newWorkspaceId, {
      created: Date.now(),
      lastActive: Date.now(),
      logs: [],
    });
    console.log(`Created new workspace: ${newWorkspaceId}`);
    return newWorkspaceId;
  }

  /**
   * Get a workspace by ID
   * @param {string} workspaceId - The workspace ID
   * @returns {Object|null} The workspace object or null if not found
   */
  getWorkspace(workspaceId) {
    return this.workspaces.get(workspaceId) || null;
  }

  /**
   * Update the lastActive timestamp for a workspace
   * @param {string} workspaceId - The workspace ID
   */
  touchWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActive = Date.now();
    }
  }

  /**
   * Add a request log to a workspace
   * @param {string} workspaceId - The workspace ID
   * @param {Object} requestData - The request log data
   * @returns {boolean} Success of the operation
   */
  addRequestLog(workspaceId, requestData) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }

    // Add log to workspace
    workspace.logs.push(requestData);

    // Trim logs if they exceed maximum count
    if (workspace.logs.length > this.MAX_LOGS_PER_WORKSPACE) {
      workspace.logs.splice(0, workspace.logs.length - this.MAX_LOGS_PER_WORKSPACE);
    }

    // Update last active timestamp
    workspace.lastActive = Date.now();
    return true;
  }

  /**
   * Clear all logs for a workspace
   * @param {string} workspaceId - The workspace ID
   * @returns {boolean} Success of the operation
   */
  clearWorkspaceLogs(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }

    workspace.logs = [];
    workspace.lastActive = Date.now();
    return true;
  }

  /**
   * Get the total number of active workspaces
   * @returns {number} The count of active workspaces
   */
  getWorkspacesCount() {
    return this.workspaces.size;
  }

  /**
   * Clean up inactive workspaces (older than 7 days)
   */
  cleanupInactiveWorkspaces() {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [workspaceId, workspace] of this.workspaces.entries()) {
      // Skip pre-defined workspaces during cleanup
      if (this.predefinedWorkspaces.includes(workspaceId) || workspace.isPredefined) {
        continue;
      }

      if (now - workspace.lastActive > this.WORKSPACE_EXPIRATION_MS) {
        this.workspaces.delete(workspaceId);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Cleaned up ${cleanupCount} inactive workspaces`);
    }
  }

  /**
   * Start the housekeeping task
   */
  startHousekeeping() {
    // First cleanup after 1 minute
    setTimeout(() => {
      this.cleanupInactiveWorkspaces();

      // Then schedule regular cleanups
      setInterval(() => {
        this.cleanupInactiveWorkspaces();
      }, this.HOUSEKEEPING_INTERVAL_MS);
    }, 60 * 1000);

    console.log('Workspace housekeeping scheduler started');
  }
}

module.exports = WorkspaceManager;

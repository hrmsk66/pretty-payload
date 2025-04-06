// lib/tenantManager.js - Manages tenant isolation and lifecycle
const { generateTenantId } = require('./utils');

class TenantManager {
  constructor() {
    this.tenants = new Map();
    this.MAX_LOGS_PER_TENANT = 100;
    // Tenant expiration time: 7 days (in milliseconds)
    this.TENANT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
    // Housekeeping interval: 6 hour
    this.HOUSEKEEPING_INTERVAL_MS = 6 * 60 * 60 * 1000;
  }

  /**
   * Create a new tenant with a unique ID
   * @returns {string} The new tenant ID
   */
  createTenant() {
    const tenantId = generateTenantId();
    this.tenants.set(tenantId, {
      created: Date.now(),
      lastActive: Date.now(),
      logs: [],
    });
    console.log(`Created new tenant: ${tenantId}`);
    return tenantId;
  }

  /**
   * Get a tenant by ID
   * @param {string} tenantId - The tenant ID
   * @returns {Object|null} The tenant object or null if not found
   */
  getTenant(tenantId) {
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Update the lastActive timestamp for a tenant
   * @param {string} tenantId - The tenant ID
   */
  touchTenant(tenantId) {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.lastActive = Date.now();
    }
  }

  /**
   * Add a request log to a tenant
   * @param {string} tenantId - The tenant ID
   * @param {Object} requestData - The request log data
   * @returns {boolean} Success of the operation
   */
  addRequestLog(tenantId, requestData) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    // Add log to tenant
    tenant.logs.push(requestData);

    // Trim logs if they exceed maximum count
    if (tenant.logs.length > this.MAX_LOGS_PER_TENANT) {
      tenant.logs.splice(0, tenant.logs.length - this.MAX_LOGS_PER_TENANT);
    }

    // Update last active timestamp
    tenant.lastActive = Date.now();
    return true;
  }

  /**
   * Clear all logs for a tenant
   * @param {string} tenantId - The tenant ID
   * @returns {boolean} Success of the operation
   */
  clearTenantLogs(tenantId) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    tenant.logs = [];
    tenant.lastActive = Date.now();
    return true;
  }

  /**
   * Get the total number of active tenants
   * @returns {number} The count of active tenants
   */
  getTenantsCount() {
    return this.tenants.size;
  }

  /**
   * Clean up inactive tenants (older than 7 days)
   */
  cleanupInactiveTenants() {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [tenantId, tenant] of this.tenants.entries()) {
      if (now - tenant.lastActive > this.TENANT_EXPIRATION_MS) {
        this.tenants.delete(tenantId);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Cleaned up ${cleanupCount} inactive tenants`);
    }
  }

  /**
   * Start the housekeeping task
   */
  startHousekeeping() {
    // First cleanup after 1 minute
    setTimeout(() => {
      this.cleanupInactiveTenants();

      // Then schedule regular cleanups
      setInterval(() => {
        this.cleanupInactiveTenants();
      }, this.HOUSEKEEPING_INTERVAL_MS);
    }, 60 * 1000);

    console.log('Tenant housekeeping scheduler started');
  }
}

module.exports = { TenantManager };

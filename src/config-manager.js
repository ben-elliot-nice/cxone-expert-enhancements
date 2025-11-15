/**
 * ConfigManager - Four-tier hierarchical configuration system
 *
 * Resolution order (highest to lowest priority):
 * 1. Embed config (locked, from script tag data-config)
 * 2. User properties (personal, synced via Properties API)
 * 3. Site properties (admin defaults, via Properties API)
 * 4. localStorage (cache + fallback)
 * 5. Hard-coded defaults (from schema)
 */

import { settingsSchema, getDefaults } from './config-schema.js';

export class ConfigManager {
  constructor() {
    this.config = {};
    this.embedConfig = {};
    this.siteProperties = {};
    this.userProperties = {};
    this.currentUser = null;

    // Multi-level cache
    this.cache = {
      siteProperties: null,
      userProperties: null,
      lastSiteSync: 0,
      lastUserSync: 0,
      syncInterval: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Detect current user from window.Deki object
   */
  detectUser() {
    if (!window.Deki) {
      console.warn('window.Deki not available, assuming anonymous');
      return {
        isLoggedIn: false,
        isAnonymous: true,
        username: null,
        systemName: null,
        permissions: [],
        isAdmin: false
      };
    }

    return {
      isLoggedIn: !window.Deki.UserIsAnonymous,
      isAnonymous: window.Deki.UserIsAnonymous,
      username: window.Deki.UserName,
      systemName: window.Deki.UserSystemName,
      permissions: window.Deki.UserPermissions || [],
      isAdmin: window.Deki.UserPermissions?.includes('ADMIN') || false
    };
  }
}

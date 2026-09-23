const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { initialSchema } = require('./schema');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

class Database {
  constructor() {
    this.data = initialSchema;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = { ...initialSchema, ...JSON.parse(raw) };
        logger.info('Database loaded successfully from file.');
      } else {
        this.save();
        logger.info('New database initialized and saved to file.');
      }
    } catch (err) {
      logger.error('Failed to initialize database, using in-memory fallback:', err);
      this.data = { ...initialSchema };
    }
  }

  reload() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = { ...initialSchema, ...JSON.parse(raw) };
      }
    } catch (err) {
      // ignore
    }
  }

  save() {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      logger.error('Failed to save database to disk:', err);
    }
  }

  // --- Users Collection ---
  getUser(telegramId) {
    let u = this.data.users[String(telegramId)];
    if (!u) {
      this.reload();
      u = this.data.users[String(telegramId)];
    }
    return u || null;
  }

  saveUser(userData) {
    const id = String(userData.telegramId);
    const existing = this.data.users[id] || {};
    this.data.users[id] = {
      ...existing,
      ...userData,
      updatedAt: new Date().toISOString()
    };
    if (!existing.createdAt) {
      this.data.users[id].createdAt = new Date().toISOString();
    }
    this.save();
    return this.data.users[id];
  }

  updateUserSettings(telegramId, settings) {
    const user = this.getUser(telegramId);
    if (!user) return null;
    user.settings = { ...(user.settings || {}), ...settings };
    return this.saveUser(user);
  }

  // --- Orders Collection ---
  createOrder(orderData) {
    const orderId = orderData.id || `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      id: orderId,
      status: 'PENDING_INTEGRATION', // Phase 1 Placeholder
      ...orderData,
      isMock: true,
      createdAt: new Date().toISOString()
    };
    this.data.orders[orderId] = newOrder;
    this.save();
    return newOrder;
  }

  getOrder(orderId) {
    let order = this.data.orders[orderId];
    if (!order) {
      this.reload();
      order = this.data.orders[orderId];
    }
    return order || null;
  }

  getUserOrders(telegramId) {
    const tId = String(telegramId);
    return Object.values(this.data.orders).filter(o => String(o.telegramId) === tId);
  }

  // --- API Keys Collection ---
  getUserApiKeys(telegramId) {
    const tId = String(telegramId);
    return Object.values(this.data.apiKeys).filter(k => String(k.telegramId) === tId);
  }

  saveApiKey(keyData) {
    const keyId = keyData.id || `key_${Date.now()}`;
    this.data.apiKeys[keyId] = {
      id: keyId,
      ...keyData,
      isMock: true,
      createdAt: new Date().toISOString()
    };
    this.save();
    return this.data.apiKeys[keyId];
  }

  // --- User Session / Wizard State ---
  getSession(telegramId) {
    let s = this.data.sessions[String(telegramId)];
    if (!s) {
      this.reload();
      s = this.data.sessions[String(telegramId)];
    }
    return s || null;
  }

  saveSession(telegramId, sessionData) {
    const id = String(telegramId);
    this.data.sessions[id] = {
      ...(this.data.sessions[id] || {}),
      ...sessionData,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.sessions[id];
  }

  clearSession(telegramId) {
    const id = String(telegramId);
    delete this.data.sessions[id];
    this.save();
  }

  // --- Master Admin System Helpers ---
  getAllUsers() {
    this.reload();
    return Object.values(this.data.users || {});
  }

  getAllApiKeys() {
    this.reload();
    return Object.values(this.data.apiKeys || {});
  }

  deleteApiKey(keyId) {
    this.reload();
    let deleted = false;
    for (const [id, k] of Object.entries(this.data.apiKeys || {})) {
      if (k.id === keyId || k.keyId === keyId || k.apiKey === keyId) {
        delete this.data.apiKeys[id];
        deleted = true;
      }
    }
    if (deleted) this.save();
    return deleted;
  }

  getAllOrders() {
    this.reload();
    return Object.values(this.data.orders || {});
  }

  getSetting(key, defaultVal = null) {
    this.reload();
    if (!this.data.systemSettings) this.data.systemSettings = {};
    return this.data.systemSettings[key] !== undefined ? this.data.systemSettings[key] : defaultVal;
  }

  setSetting(key, val) {
    this.reload();
    if (!this.data.systemSettings) this.data.systemSettings = {};
    this.data.systemSettings[key] = val;
    this.save();
    return val;
  }

  getDatabasePath() {
    return DB_FILE;
  }
}

module.exports = new Database();

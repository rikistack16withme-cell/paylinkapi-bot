const db = require('../database');
const config = require('../config');

class UserService {
  getUser(telegramId) {
    return db.getUser(telegramId);
  }

  isRegistered(telegramId) {
    const user = db.getUser(telegramId);
    return Boolean(user && user.status === 'ACTIVE');
  }

  /**
   * Automatically captures and updates user profile data whenever they interact with the bot
   */
  trackUser(from) {
    if (!from || !from.id) return null;
    const telegramId = String(from.id);
    const existing = db.getUser(telegramId);
    const username = from.username || existing?.username || '';
    const firstName = from.first_name || existing?.firstName || '';
    const lastName = from.last_name || existing?.lastName || '';

    const userData = {
      telegramId,
      username,
      firstName,
      lastName,
      status: existing?.status || 'ACTIVE',
      settings: existing?.settings || {
        language: config.i18n.defaultLanguage,
        notifications: true
      },
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastActive: new Date().toISOString(),
      ...(existing || {})
    };

    userData.username = username;
    userData.firstName = firstName;
    userData.lastName = lastName;
    userData.lastActive = new Date().toISOString();

    return db.saveUser(userData);
  }

  registerUser(from) {
    return this.trackUser(from);
  }

  deleteUser(telegramId) {
    return db.deleteUser(telegramId);
  }

  getUserLanguage(telegramId) {
    const user = db.getUser(telegramId);
    return user?.settings?.language || config.i18n.defaultLanguage;
  }

  setUserLanguage(telegramId, lang) {
    const user = db.getUser(telegramId);
    if (!user) {
      this.registerUser({ id: telegramId });
    }
    db.updateUserSettings(telegramId, { language: lang });
    return lang;
  }

  toggleLanguage(telegramId) {
    const user = db.getUser(telegramId);
    if (!user) {
      this.registerUser({ id: telegramId });
    }
    const current = this.getUserLanguage(telegramId);
    const next = current === 'en' ? 'km' : 'en';
    db.updateUserSettings(telegramId, { language: next });
    return next;
  }

  toggleNotifications(telegramId) {
    const user = db.getUser(telegramId);
    const current = user?.settings?.notifications ?? true;
    const next = !current;
    db.updateUserSettings(telegramId, { notifications: next });
    return next;
  }

  updateUser(telegramId, data) {
    const existing = db.getUser(telegramId);
    if (!existing) {
      this.registerUser({ id: telegramId });
    }
    return db.saveUser({
      telegramId,
      ...data
    });
  }

  // --- Master Admin User Management ---
  getAllUsers() {
    return db.getAllUsers();
  }

  banUser(telegramId) {
    return this.updateUser(telegramId, {
      status: 'BANNED',
      bannedAt: new Date().toISOString()
    });
  }

  unbanUser(telegramId) {
    return this.updateUser(telegramId, {
      status: 'ACTIVE',
      bannedAt: null
    });
  }

  isBanned(telegramId) {
    const user = this.getUser(telegramId);
    return Boolean(user && user.status === 'BANNED');
  }

  activateUser(telegramId, plan = 'VIP Lifetime Pro Pass', days = 365) {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return this.updateUser(telegramId, {
      status: 'ACTIVE',
      subscription: {
        status: 'ACTIVE',
        plan,
        activatedAt: new Date().toISOString(),
        expiresAt
      }
    });
  }

  deactivateUser(telegramId) {
    return this.updateUser(telegramId, {
      subscription: {
        status: 'INACTIVE',
        deactivatedAt: new Date().toISOString()
      }
    });
  }
}

module.exports = new UserService();

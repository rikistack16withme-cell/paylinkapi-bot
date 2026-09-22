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

  registerUser(from) {
    const telegramId = from.id;
    const existing = db.getUser(telegramId);
    if (existing) {
      return existing;
    }

    const newUser = {
      telegramId,
      username: from.username || '',
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      status: 'ACTIVE',
      settings: {
        language: config.i18n.defaultLanguage,
        notifications: true
      },
      createdAt: new Date().toISOString()
    };

    return db.saveUser(newUser);
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
}

module.exports = new UserService();

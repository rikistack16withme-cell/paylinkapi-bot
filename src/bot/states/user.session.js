const db = require('../../database');
const { UserState } = require('./state.machine');

class SessionManager {
  constructor() {
    this.memorySessions = new Map();
  }

  getSession(telegramId) {
    const id = String(telegramId);
    if (!this.memorySessions.has(id)) {
      const persisted = db.getSession(id) || {
        state: UserState.IDLE,
        data: {}
      };
      this.memorySessions.set(id, persisted);
    }
    return this.memorySessions.get(id);
  }

  setState(telegramId, state, data = {}) {
    const session = this.getSession(telegramId);
    session.state = state;
    session.data = { ...session.data, ...data };
    this.memorySessions.set(String(telegramId), session);
    db.saveSession(telegramId, session);
    return session;
  }

  updateData(telegramId, data = {}) {
    const session = this.getSession(telegramId);
    session.data = { ...session.data, ...data };
    this.memorySessions.set(String(telegramId), session);
    db.saveSession(telegramId, session);
    return session;
  }

  resetSession(telegramId) {
    const defaultSession = {
      state: UserState.DASHBOARD,
      data: {}
    };
    this.memorySessions.set(String(telegramId), defaultSession);
    db.saveSession(telegramId, defaultSession);
    return defaultSession;
  }
}

module.exports = new SessionManager();

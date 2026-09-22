const logger = require('../../utils/logger');
const userService = require('../../services/user.service');

const middleware = {
  /**
   * Logs incoming message or callback query
   */
  logAction: (actionType, from, payload) => {
    logger.info(`[${actionType}] User: ${from.id} (@${from.username || 'no_user'}) - Data: ${payload}`);
  },

  /**
   * Resolves language preference for the interacting user
   */
  getUserContext: (from) => {
    const isRegistered = userService.isRegistered(from.id);
    const lang = userService.getUserLanguage(from.id);
    return {
      user: from,
      isRegistered,
      lang
    };
  }
};

module.exports = middleware;

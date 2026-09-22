const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const sessionManager = require('../states/user.session');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');

async function renderDashboard(bot, chatId, messageId, from) {
  const lang = userService.getUserLanguage(from.id);
  const firstName = formatter.escapeHtml(from.first_name || (lang === 'km' ? 'អ្នកអភិវឌ្ឍន៍' : 'Developer'));

  sessionManager.resetSession(from.id);

  const text = `${formatter.telemetryCard(firstName, from.id, lang)}\n\n` +
    `${i18n.t('dash_subtitle', lang)}`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.dashboard(lang)
  });
}

module.exports = {
  renderDashboard
};

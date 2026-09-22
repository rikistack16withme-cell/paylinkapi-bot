const config = require('../../config');
const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const sessionManager = require('../states/user.session');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');

async function renderWelcome(bot, chatId, messageId, from) {
  const lang = userService.getUserLanguage(from.id) || config.i18n.defaultLanguage;
  const welcomeText = `${i18n.t('welcome_title', lang, { brand: formatter.escapeHtml(config.brand.name) })}\n\n` +
    `${i18n.t('welcome_tagline', lang)}\n\n` +
    `${i18n.t('welcome_telemetry', lang)}\n\n` +
    `${formatter.italic(i18n.t('welcome_features', lang))}`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, welcomeText, {
    parse_mode: 'HTML',
    ...inlineKeyboards.welcome(lang)
  });
}

async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const from = msg.from;

  sessionManager.resetSession(from.id);

  // If already registered, send straight to Dashboard
  if (userService.isRegistered(from.id)) {
    const lang = userService.getUserLanguage(from.id);
    const firstName = formatter.escapeHtml(from.first_name || (lang === 'km' ? 'អ្នកអភិវឌ្ឍន៍' : 'Developer'));
    const text = `${formatter.telemetryCard(firstName, from.id, lang)}\n\n` +
      `${i18n.t('dash_subtitle', lang)}`;

    return safeSender.sendMessage(bot, chatId, text, {
      parse_mode: 'HTML',
      ...inlineKeyboards.dashboard(lang)
    });
  }

  // Otherwise, show Welcome / Start Board
  return renderWelcome(bot, chatId, null, from);
}

module.exports = {
  handleStart,
  renderWelcome
};

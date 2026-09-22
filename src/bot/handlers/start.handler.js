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

  // Notify Admin Group (-5393647415) when any user starts the bot (excluding Master Admin)
  const adminChatId = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  const masterAdminId = String(config.masterAdminId || process.env.MASTER_ADMIN_ID || '7283817695');
  if (String(chatId) !== adminChatId && String(from.id) !== masterAdminId) {
    const { sendAdminAlert } = require('../../services/notification.service');
    const isReturning = userService.isRegistered(from.id);
    sendAdminAlert(
      `👋 <b>[USER ACTIVE • /START]</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `• <b>User:</b> ${formatter.escapeHtml(from.first_name || '')} ${formatter.escapeHtml(from.last_name || '')} (@${from.username || 'no_username'})\n` +
      `• <b>Telegram ID:</b> <code>${from.id}</code>\n` +
      `• <b>Account Status:</b> <code>${isReturning ? 'Returning Registered Merchant' : 'New Visitor'}</code>\n` +
      `• <b>Time:</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>`
    ).catch(() => {});
  }

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

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
  const isGroup = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';
  const masterAdminId = String(config.masterAdminId || process.env.MASTER_ADMIN_ID || '7283817695');
  const isMaster = String(from.id) === masterAdminId;

  // If Master Admin sends /start in group chat, open Admin Control Center directly
  if (isGroup && isMaster) {
    const adminHandler = require('./admin.handler');
    return await adminHandler.renderAdminDashboard(bot, chatId);
  }

  userService.trackUser(from);
  sessionManager.resetSession(from.id);

  // Notify Admin Group when any user starts the bot (excluding Master Admin)
  let adminChatId;
  try {
    const db = require('../../database');
    adminChatId = String(db.getSetting('admin_group_id') || config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  } catch (_) {
    adminChatId = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  }

  if (String(chatId) !== adminChatId && !isMaster) {
    const { sendAdminAlert } = require('../../services/notification.service');
    const isReturning = userService.isRegistered(from.id);
    const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Visitor';
    const userMention = `<a href="tg://user?id=${from.id}"><b>${formatter.escapeHtml(fullName)}</b></a>`;
    const usernameDisplay = from.username
      ? `<a href="https://t.me/${from.username}">@${from.username}</a>`
      : `<i>No @username</i>`;

    sendAdminAlert(
      `👋 <b>[USER ACTIVE • /START]</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `• <b>User:</b> ${userMention}\n` +
      `• <b>Username:</b> ${usernameDisplay}\n` +
      `• <b>Telegram ID:</b> <code>${from.id}</code>\n` +
      `• <b>Direct Links:</b> <a href="tg://user?id=${from.id}">👤 View Profile</a> | <a href="tg://openmessage?user_id=${from.id}">💬 Open Chat</a>\n` +
      `• <b>Account Status:</b> <code>${isReturning ? 'Returning Registered Merchant' : 'New Visitor'}</code>\n` +
      `• <b>Time:</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>`,
      {
        disable_web_page_preview: true,
        link_preview_options: { is_disabled: true }
      }
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

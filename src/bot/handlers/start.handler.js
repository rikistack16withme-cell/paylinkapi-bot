const path = require('path');
const fs = require('fs');
const config = require('../../config');
const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const sessionManager = require('../states/user.session');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');
const { tgEmoji } = require('../../config/emojis');
const { renderDashboard } = require('./dashboard.handler');
const db = require('../../database');

async function renderWelcome(bot, chatId, messageId, from) {
  const lang = userService.getUserLanguage(from.id) || config.i18n.defaultLanguage;
  let welcomeText = `${i18n.t('welcome_title', lang, { brand: formatter.escapeHtml(config.brand.name) })}\n\n` +
    `${i18n.t('welcome_tagline', lang)}\n\n` +
    `${i18n.t('welcome_telemetry', lang)}\n\n` +
    `${formatter.italic(i18n.t('welcome_features', lang))}`;

  if (!from.username) {
    welcomeText += `\n\n${tgEmoji('bulb')} <i>Tip: You don't have a Telegram @username set. Setting one in Telegram Settings helps merchants and support connect with you directly!</i>`;
  }

  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const cachedLogo = db.getSetting('bot_logo_file_id', null);
  const logoSource = cachedLogo || (fs.existsSync(logoPath) ? logoPath : null);

  if (logoSource) {
    try {
      const sent = await safeSender.replaceOrSendPhoto(bot, chatId, messageId, logoSource, welcomeText, {
        parse_mode: 'HTML',
        ...inlineKeyboards.welcome(lang)
      }, {
        filename: 'paylinkapi_logo.png',
        contentType: 'image/png'
      });

      if (sent?.photo && sent.photo.length > 0) {
        db.setSetting('bot_logo_file_id', sent.photo[sent.photo.length - 1].file_id);
      }
      return sent;
    } catch (_) {
      // Graceful fallback to text if photo send fails
    }
  }

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

    const profileLink = from.username
      ? `<a href="https://t.me/${from.username}">👤 Open @${from.username}</a>`
      : `<a href="tg://user?id=${from.id}">👤 View Profile (Mobile)</a>`;

    sendAdminAlert(
      `${tgEmoji('brand')} <b>[USER ACTIVE • /START]</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `• <b>User:</b> ${userMention}\n` +
      `• <b>Username:</b> ${usernameDisplay}\n` +
      `• <b>Telegram ID:</b> <code>${from.id}</code>\n` +
      `• <b>Direct Profile:</b> ${profileLink}\n` +
      `• <b>Account Status:</b> <code>${isReturning ? 'Returning Registered Merchant' : 'New Visitor'}</code>\n` +
      `• <b>Time:</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>\n\n` +
      `<i>${tgEmoji('bulb')} Tip: Click the forwarded message header below to open this user's profile directly on Telegram Desktop.</i>`,
      {
        disable_web_page_preview: true,
        link_preview_options: { is_disabled: true }
      }
    ).catch(() => {});

    // Forward the user's /start message directly to the admin group!
    // Telegram natively renders "Forwarded from <User>", making their profile 100% clickable on Telegram Desktop!
    if (!isGroup && msg.message_id) {
      bot.forwardMessage(adminChatId, chatId, msg.message_id).catch(() => {});
    }
  }

  // 1. Deliver the Video Tutorial right into the chat on /start so user can watch directly!
  try {
    const { handleTutorialVideo } = require('./tutorial_video.handler');
    await handleTutorialVideo(bot, chatId, null, from);
  } catch (vidErr) {
    // If video auto-send encounters transient issue, continue to dashboard
  }

  // 2. Deliver the Official Logo Photo Dashboard Console!
  if (userService.isRegistered(from.id)) {
    return await renderDashboard(bot, chatId, null, from);
  }

  // Otherwise, show Welcome / Start Board with Logo
  return await renderWelcome(bot, chatId, null, from);
}

module.exports = {
  handleStart,
  renderWelcome
};

const userService = require('../../services/user.service');
const i18n = require('../../services/i18n.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const sessionManager = require('../states/user.session');
const safeSender = require('../../utils/safe_sender');

async function handleRegister(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;

  // Register user into database
  const user = userService.registerUser(from);
  const lang = user.settings?.language || 'en';

  sessionManager.resetSession(from.id);

  // Notify Admin Group (-5393647415)
  const { sendAdminAlert } = require('../../services/notification.service');
  sendAdminAlert(
    `👤 <b>[NEW MERCHANT REGISTERED]</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>Name:</b> ${from.first_name || ''} ${from.last_name || ''}\n` +
    `• <b>Username:</b> @${from.username || 'none'}\n` +
    `• <b>Telegram ID:</b> <code>${from.id}</code>\n` +
    `• <b>Time:</b> <code>${new Date().toISOString()}</code>`
  ).catch(() => {});

  const text = `${i18n.t('reg_success_header', lang)}\n\n` +
    `${i18n.t('reg_success_body', lang)}`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.registrationSuccess(lang)
  });
}

module.exports = {
  handleRegister
};

const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const navigationKeyboards = require('../keyboards/navigation.keyboards');
const formatter = require('../../utils/formatter');
const { tgEmoji } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');

async function handleSettings(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;

  const user = userService.getUser(from.id) || {};
  const lang = user.settings?.language || 'en';
  const isKm = lang === 'km';
  const notifStatus = user.settings?.notifications
    ? `${tgEmoji('active')} <b>${isKm ? 'បើក' : 'ON'}</b>`
    : `${tgEmoji('alert')} <b>${isKm ? 'បិទ' : 'OFF'}</b>`;
  const username = from.username ? `@${formatter.escapeHtml(from.username)}` : formatter.escapeHtml(from.first_name || 'User');

  const text = `${formatter.header(isKm ? 'ការកំណត់ CONSOLE & PREFERENCES' : 'CONSOLE SETTINGS & PREFERENCES', isKm ? 'ការកំណត់បរិស្ថាន Developer' : 'Environment Configuration')}\n\n` +
    `${i18n.t('settings_lang', lang, { currentLang: i18n.getLangName(lang) })}\n` +
    `${i18n.t('settings_notifications', lang, { notifStatus })}\n` +
    `${i18n.t('settings_account', lang, { username, id: from.id })}\n\n` +
    `<i>${isKm ? 'ជ្រើសរើសជម្រើសខាងក្រោមដើម្បីធ្វើបច្ចុប្បន្នភាព:' : 'Select an option below to update your preferences:'}</i>`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.settings(lang)
  });
}

async function handleToggleLanguage(bot, query) {
  const from = query.from;
  const newLang = userService.toggleLanguage(from.id);
  // Re-render settings screen with updated language
  return handleSettings(bot, query);
}

async function handleToggleNotifications(bot, query) {
  const from = query.from;
  userService.toggleNotifications(from.id);
  // Re-render settings screen with updated notification status
  return handleSettings(bot, query);
}

async function handleAccountInfo(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const user = userService.getUser(from.id) || {};
  const lang = user.settings?.language || 'en';
  const isKm = lang === 'km';

  const text = `${formatter.header(isKm ? 'ព័ត៌មានគណនី DEVELOPER' : 'DEVELOPER ACCOUNT PROFILE', isKm ? 'ព័ត៌មានអ្នកប្រើប្រាស់ & បរិស្ថាន' : 'Operator Identity & Environment')}\n\n` +
    `${tgEmoji('tag')} <b>Telegram ID:</b> <code>${from.id}</code>\n` +
    `${tgEmoji('operator')} <b>${isKm ? 'ឈ្មោះគណនី (Username):' : 'Username:'}</b> @${formatter.escapeHtml(from.username || 'N/A')}\n` +
    `${tgEmoji('operator')} <b>${isKm ? 'ឈ្មោះអ្នកគ្រប់គ្រង:' : 'Operator:'}</b> ${formatter.escapeHtml(from.first_name || '')} ${formatter.escapeHtml(from.last_name || '')}\n` +
    `${tgEmoji('telemetry')} <b>${isKm ? 'ស្ថានភាពគណនី:' : 'Account Status:'}</b> ${tgEmoji('active')} <b>[ ${isKm ? 'សកម្ម' : 'ACTIVE'} ]</b>\n` +
    `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual-Rail'}</code>\n` +
    `${tgEmoji('brand')} <b>${isKm ? 'ភាសា:' : 'Language:'}</b> <code>${i18n.getLangName(lang)}</code>\n` +
    `${tgEmoji('bell')} <b>${isKm ? 'ការជូនដំណឹង:' : 'Telemetry Alerts:'}</b> <code>${user.settings?.notifications ? (isKm ? 'បានបើក' : 'Enabled') : (isKm ? 'បានបិទ' : 'Disabled')}</code>`;

  try {
    await safeSender.editMessageText(bot, text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: navigationKeyboards.backAndDashboard('nav_settings', lang)
      }
    });
  } catch (err) {
    await safeSender.sendMessage(bot, chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: navigationKeyboards.backAndDashboard('nav_settings', lang)
      }
    });
  }
}

module.exports = {
  handleSettings,
  handleToggleLanguage,
  handleToggleNotifications,
  handleAccountInfo
};

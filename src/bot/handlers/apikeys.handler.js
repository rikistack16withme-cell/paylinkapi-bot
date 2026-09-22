const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const apiKeyService = require('../../services/apikey.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const formatter = require('../../utils/formatter');
const { tgEmoji } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');

async function handleApiKeys(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  const userKeys = apiKeyService.getUserApiKeys(from.id);
  const isKm = lang === 'km';

  let text = `${formatter.header(isKm ? 'កូដសម្ងាត់ PRODUCTION API & SECRETS' : 'PRODUCTION API KEYS & SECRETS', isKm ? 'បរិស្ថាន Production Live' : 'Production Live Environment')}\n\n` +
    `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) DUAL-ACTIVE'}</code>\n\n`;

  if (!userKeys || userKeys.length === 0) {
    text += `${i18n.t('keys_empty', lang)}`;
  } else {
    userKeys.forEach((key, index) => {
      const provIcon = (key.provider || '').includes('Bakong') ? tgEmoji('bakong') : tgEmoji('aba');
      text += `${provIcon} <b>Key #${index + 1}: ${formatter.escapeHtml(key.merchantName || 'Merchant Store')}</b>\n` +
        `• ${isKm ? 'ប្រព័ន្ធ:' : 'Rail:'} <code>${formatter.escapeHtml(key.provider || 'Bakong & ABA')}</code>\n` +
        `• ${isKm ? 'ស្ថានភាព:' : 'Status:'} <b>[ ACTIVE ]</b> ${tgEmoji('active')}\n` +
        `• <b>API Key:</b>\n<code>${formatter.escapeHtml(key.apiKey)}</code>\n` +
        `• <b>Webhook Secret:</b>\n<code>${formatter.escapeHtml(key.secret || 'whsec_live_default')}</code>\n` +
        (key.bakongId ? `• <b>Bakong Account:</b> <code>${formatter.escapeHtml(key.bakongId)}</code>\n` : '') +
        (key.usdLink ? `• <b>ABA Link:</b> <code>Connected</code>\n` : '') +
        `• ${isKm ? 'កាលបរិច្ឆេទ:' : 'Created:'} <code>${(key.createdAt || '').slice(0, 10) || '2026-09-22'}</code>\n\n` +
        `${formatter.divider}\n\n`;
    });
    text += `<i>${isKm ? '💡 លោកអ្នកអាចចុច «តេស្ត API Key ដែលបានទិញ» ដើម្បីតេស្តជាក់ស្តែង ឬចុច «ទាញយក PDF» ដើម្បីមើលរបៀបតភ្ជាប់។' : '💡 You can click "Test Purchased API Key" to run live test payments or "Integration Guide (PDF)" to read documentation.'}</i>`;
  }

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.apiKeys(lang)
  });
}

module.exports = {
  handleApiKeys
};

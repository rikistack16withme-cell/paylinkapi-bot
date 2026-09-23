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
      const countdown = apiKeyService.getExpiryCountdown(key, lang);
      const planTitle = apiKeyService.getPlanTitle(key.plan, lang);
      const statusBadge = countdown.isExpired
        ? (isKm ? '🔴 [ ផុតសុពលភាព - EXPIRED ]' : '🔴 [ EXPIRED ]')
        : (isKm ? '🟢 [ សកម្ម - ACTIVE ]' : '🟢 [ ACTIVE ]');

      text += `${provIcon} <b>Key #${index + 1}: ${formatter.escapeHtml(key.merchantName || 'Merchant Store')}</b>\n` +
        `• ${isKm ? 'កញ្ចប់គម្រោង:' : 'Plan:'} <b>${formatter.escapeHtml(planTitle)}</b>\n` +
        `• ${isKm ? 'ប្រព័ន្ធ:' : 'Rail:'} <code>${formatter.escapeHtml(key.provider || 'Bakong & ABA')}</code>\n` +
        `• ${isKm ? 'ស្ថានភាព:' : 'Status:'} <b>${statusBadge}</b>\n` +
        `• ${isKm ? 'សុពលភាពនៅសល់:' : 'Remaining:'} <b>${formatter.escapeHtml(countdown.text)}</b>\n` +
        `• ${isKm ? 'ផុតកំណត់នៅថ្ងៃ:' : 'Expires At:'} <code>${(key.expiresAt || '').slice(0, 19).replace('T', ' ') || 'N/A'}</code>\n` +
        `• <b>API Key:</b>\n<code>${formatter.escapeHtml(key.apiKey)}</code>\n` +
        `• <b>Webhook Secret:</b>\n<code>${formatter.escapeHtml(key.secret || 'whsec_live_default')}</code>\n` +
        (key.bakongId ? `• <b>Bakong Account:</b> <code>${formatter.escapeHtml(key.bakongId)}</code>\n` : '') +
        (key.usdLink ? `• <b>ABA Link:</b> <code>Connected</code>\n` : '') +
        `• ${isKm ? 'កាលបរិច្ឆេទបង្កើត:' : 'Created:'} <code>${(key.createdAt || '').slice(0, 10) || '2026-09-22'}</code>\n`;

      if (countdown.isExpired) {
        text += `\n⚠️ <i>${isKm ? 'កូដសម្ងាត់នេះត្រូវបានផ្អាកដោយសារផុតកំណត់! សូមចុច «បន្តគម្រោង (Renew)» ដើម្បីដំណើរការឡើងវិញភ្លាមៗ។' : 'This API key has expired and API traffic is blocked! Click "Renew Subscription" to reactivate.'}</i>\n`;
      } else if (countdown.isExpiringSoon) {
        text += `\n⏳ <i>${isKm ? 'កូដសម្ងាត់នេះជិតផុតកំណត់ហើយ (នៅសល់ក្រោម ២៤ម៉ោង)! សូមចុច «បន្តគម្រោង (Renew)» ដើម្បីកុំឱ្យដាច់ការទូទាត់។' : 'This API key expires in less than 24 hours! Click "Renew Subscription" to prevent service interruption.'}</i>\n`;
      }

      text += `\n${formatter.divider}\n\n`;
    });
    text += `<i>${isKm ? '💡 លោកអ្នកអាចចុច «🔄 បន្តគម្រោង» ដើម្បីបន្តសុពលភាព ឬចុច «តេស្ត API Key» ដើម្បីតេស្តជាក់ស្តែង។' : '💡 You can click "🔄 Renew Subscription" to extend validity or "Test Purchased API Key" to test live.'}</i>`;
  }

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.apiKeys(lang)
  });
}

module.exports = {
  handleApiKeys
};

const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const apiKeyService = require('../../services/apikey.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const sessionManager = require('../states/user.session');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');
const { tgEmoji } = require('../../config/emojis');

async function renderDashboard(bot, chatId, messageId, from) {
  const lang = userService.getUserLanguage(from.id);
  const firstName = formatter.escapeHtml(from.first_name || (lang === 'km' ? 'អ្នកអភិវឌ្ឍន៍' : 'Developer'));
  const isKm = lang === 'km';

  sessionManager.resetSession(from.id);

  const userKeys = apiKeyService.getUserApiKeys(from.id);
  let subBanner = '';
  if (userKeys && userKeys.length > 0) {
    const key = userKeys[0];
    const countdown = apiKeyService.getExpiryCountdown(key, lang);
    const planTitle = apiKeyService.getPlanTitle(key.plan, lang);
    const badge = countdown.isExpired
      ? '🔴 [ EXPIRED ]'
      : (countdown.isExpiringSoon ? '🟡 [ EXPIRING SOON ]' : '🟢 [ ACTIVE ]');

    subBanner = `\n` +
      `📦 <b>${isKm ? 'គម្រោងសកម្ម:' : 'Active Plan:'}</b> <code>${formatter.escapeHtml(planTitle)}</code>  ${badge}\n` +
      `⏳ <b>${isKm ? 'សុពលភាពនៅសល់:' : 'Validity Remaining:'}</b> <b>${formatter.escapeHtml(countdown.text)}</b>\n` +
      (countdown.isExpired
        ? `⚠️ <i>${isKm ? 'គម្រោងបានផុតកំណត់! សូមចុច «កូដសម្ងាត់ (API Keys)» ដើម្បីបន្តគម្រោង។' : 'Subscription expired! Open "API Keys" to renew.'}</i>\n`
        : '') +
      `${formatter.divider}\n`;
  }

  const text = `${formatter.telemetryCard(firstName, from.id, lang)}\n` +
    subBanner +
    `\n${i18n.t('dash_subtitle', lang)}`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.dashboard(lang)
  });
}

module.exports = {
  renderDashboard
};

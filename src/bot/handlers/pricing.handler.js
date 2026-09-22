const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');

async function handlePricing(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  const isKm = lang === 'km';
  const text = `${formatter.header(isKm ? 'កញ្ចប់តម្លៃសេវាកម្ម DEVELOPER' : 'DEVELOPER SUBSCRIPTION TIERS', isKm ? 'ប្រព័ន្ធរូបិយប័ណ្ណពីរ (USD + KHR) ស្វ័យប្រវត្តិ' : 'Automated Dual Currency (USD + KHR) Infrastructure')}\n\n` +
    `${i18n.t('pricing_subtitle', lang)}\n\n` +
    `${i18n.t('pricing_plan1', lang)}\n\n` +
    `${formatter.divider}\n\n` +
    `${i18n.t('pricing_plan2', lang)}\n\n` +
    `${formatter.divider}\n\n` +
    `${i18n.t('pricing_plan3', lang)}\n\n` +
    `<i>${isKm ? 'គ្រប់កញ្ចប់ទាំងអស់រួមបញ្ចូលប្រព័ន្ធរូបិយប័ណ្ណពីរ (USD + KHR) ដោយស្វ័យប្រវត្តិ។' : 'All tiers include automatic dual-currency routing (USD + KHR). Phase 1 Preview.'}</i>`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.pricing(lang)
  });
}

module.exports = {
  handlePricing
};

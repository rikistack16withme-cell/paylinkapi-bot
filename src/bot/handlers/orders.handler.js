const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const orderService = require('../../services/order.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const formatter = require('../../utils/formatter');
const { tgEmoji } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');

async function handleOrders(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  const orders = orderService.getUserOrders(from.id);
  const isKm = lang === 'km';

  let text = `${formatter.header(isKm ? 'ប្រតិបត្តិការ & ការបញ្ជាទិញ' : 'INTEGRATION PIPELINES & ORDERS', isKm ? 'ការតាមដានទិន្នន័យផ្ទាល់' : 'Live Telemetry & Tracking')}\n\n` +
    `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) DUAL-ACTIVE'}</code>\n\n`;

  if (orders.length === 0) {
    text += `${i18n.t('orders_empty', lang)}\n\n` +
      `<i>${isKm ? 'ចុច "ភ្ជាប់ប្រព័ន្ធទូទាត់ Payment API" ដើម្បីចាប់ផ្តើម Pipeline ដំបូងរបស់អ្នក។' : 'Click "Get Payment API" to deploy your first Cambodian banking pipeline.'}</i>`;
  } else {
    for (const order of orders.slice(-5).reverse()) {
      const provIcon = order.provider.includes('Bakong') ? tgEmoji('bakong') : tgEmoji('aba');
      text += `<b>${formatter.escapeHtml(order.id)}</b>\n` +
        `${provIcon} <b>${formatter.escapeHtml(order.provider)}</b>\n` +
        `• ${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency:'} <code>${formatter.escapeHtml(order.currency || 'USD ($) + KHR (៛) Dual Mode')}</code>\n` +
        `• ${isKm ? 'ស្ថានភាព:' : 'Status:'} ${formatter.statusBadge(order.status)}\n` +
        `• ${isKm ? 'កាលបរិច្ឆេទ:' : 'Created:'} <code>${order.createdAt ? order.createdAt.slice(0, 10) : '2026-09-15'}</code>\n\n` +
        `${formatter.divider}\n\n`;
    }
    text += `<i>${isKm ? 'ការតាមដាន Pipeline កំពុងដំណើរការ។ ការទូទាត់ជាក់ស្តែងនឹង sync ក្នុង Phase 2.' : 'Pipeline tracking active. Live settlement will sync upon Phase 2 connection.'}</i>`;
  }

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.orders(orders.length > 0, lang)
  });
}

module.exports = {
  handleOrders
};

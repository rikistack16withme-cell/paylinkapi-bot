const dns = require('node:dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const { tgEmoji, makeButton } = require('../config/emojis');
const formatter = require('../utils/formatter');
const userService = require('./user.service');

// Standalone Telegram Bot client for sending outbound notifications (IPv4 forced to prevent AggregateError)
const notifier = new TelegramBot(config.bot.token, {
  polling: false,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4
    }
  }
});

/**
 * Sends real-time payment confirmation and newly issued production API credentials
 * directly to the user's Telegram chat with animated custom emojis.
 */
async function sendPaymentSuccessNotification(telegramId, data) {
  if (!telegramId) return;

  const lang = userService.getUserLanguage(telegramId) || 'km';
  const isKm = lang === 'km';

  const planName = data.plan === '1y' ? '1 Year Enterprise' : (data.plan === '1m' ? '1 Month Pro' : '1 Week Pass ($0.10)');
  const amountStr = data.amountFormatted || (data.amount ? `${data.amount} ${data.currency || 'USD'}` : '400 ៛ KHR / $0.10 USD');

  // Animated Telegram custom emojis
  const animStar = tgEmoji('brand');
  const animCheck = tgEmoji('verified');
  const animActive = tgEmoji('active');
  const animBolt = tgEmoji('telemetry');
  const animKey = tgEmoji('keys');
  const animShield = tgEmoji('security');
  const animServer = tgEmoji('terminal');
  const animBulb = tgEmoji('bulb');
  const animParty = tgEmoji('party');
  const animReceipt = tgEmoji('receipt');
  const animBank = tgEmoji('clearing');

  const text =
    `${animParty} <b>${isKm ? 'ការទូទាត់ជោគជ័យ • បញ្ចេញកូនសោ API KEY' : 'PAYMENT SUCCESS • API CREDENTIALS ISSUED'}</b> ${animStar}\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
    `${animBank} <b>${isKm ? 'ប្រព័ន្ធ:' : 'PLATFORM:'}</b> <code>PaylinkApi Global Gateway</code>\n` +
    `${animActive} <b>${isKm ? 'ស្ថានភាព:' : 'STATUS:'}</b> <b>${isKm ? 'បានទូទាត់ជោគជ័យ (PAID & VERIFIED)' : 'PAID & VERIFIED'}</b> ${animCheck}\n` +
    `${animReceipt} <b>${isKm ? 'កញ្ចប់ Subscription:' : 'SUBSCRIPTION PLAN:'}</b> <code>${planName}</code>\n` +
    `${animBolt} <b>${isKm ? 'ចំនួនទឹកប្រាក់:' : 'AMOUNT CLEARED:'}</b> <code>${amountStr}</code>\n` +
    `${animReceipt} <b>${isKm ? 'លេខប្រតិបត្តិការ (Tran ID):' : 'TRANSACTION ID:'}</b> <code>${data.tranId}</code>\n\n` +
    `<code>─────────────────────────────</code>\n` +
    `${animKey} <b>${isKm ? 'កូនសោសម្ងាត់ PRODUCTION API KEY:' : 'PRODUCTION API KEY:'}</b>\n` +
    `<code>${data.apiKey}</code>\n\n` +
    `${animShield} <b>${isKm ? 'WEBHOOK SECRET:' : 'WEBHOOK SECRET:'}</b>\n` +
    `<code>${data.secret}</code>\n` +
    `<code>─────────────────────────────</code>\n\n` +
    `${animServer} <b>PRODUCTION REST GATEWAY ENDPOINTS:</b>\n` +
    `• <b>ABA QR Generator:</b>\n  <code>POST ${process.env.RENDER_EXTERNAL_URL || 'https://paylinkapi-bot.onrender.com'}/api/aba/generate-qr</code>\n` +
    `• <b>Payment Status Check:</b>\n  <code>POST ${process.env.RENDER_EXTERNAL_URL || 'https://paylinkapi-bot.onrender.com'}/api/aba/check-payment</code>\n\n` +
    `<i>${animBulb} ${isKm ? 'ទិន្នន័យគណនីរបស់អ្នកត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។ លោកអ្នកអាចប្រើប្រាស់ API Key នេះក្នុងការភ្ជាប់ប្រព័ន្ធទូទាត់បានភ្លាមៗ!' : 'Your merchant data is saved and your live API key is ready for immediate integration!'}</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? '📊 ផ្ទាំងគ្រប់គ្រង Dashboard' : '📊 View Dashboard', 'nav_dashboard', 'operator', 'primary')
      ],
      [
        makeButton(isKm ? '🔑 មើលកូនសោ API Keys' : '🔑 View API Keys', 'nav_api_keys', 'keys', 'success'),
        makeButton(isKm ? '📚 ឯកសារបច្ចេកទេស Docs' : '📚 Developer Docs', 'nav_docs', 'docs', 'primary')
      ]
    ]
  };

  try {
    const res = await notifier.sendMessage(telegramId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      message_effect_id: '5046509860389126442'
    });
    console.log(`[Notification Service] ✓ Sent API Key directly to Telegram user ${telegramId} with animated emojis & celebration effect! Message ID: ${res.message_id}`);

    // Broadcast instant alert to Admin Group (-5393647415)
    sendAdminAlert(
      `💰 <b>[PAYMENT & KEY ISSUED ALERT]</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `👤 <b>Merchant ID:</b> <code>${telegramId}</code>\n` +
      `📦 <b>Subscription:</b> <code>${planName}</code>\n` +
      `💵 <b>Amount Cleared:</b> <code>${amountStr}</code>\n` +
      `🧾 <b>Tran ID:</b> <code>${data.tranId}</code>\n` +
      `🔑 <b>API Key:</b> <code>${data.apiKey}</code>\n` +
      `⏰ <b>Time:</b> <code>${new Date().toISOString()}</code>`
    ).catch(() => {});

    return res;
  } catch (err) {
    console.error(`[Notification Service] ❌ Failed to send Telegram message to ${telegramId}:`, err.message);
    throw err;
  }
}

/**
 * Sends real-time payment settlement alert directly to the merchant's Telegram chat
 * whenever a payment is received via API QR code.
 */
async function sendMerchantPaymentAlert(telegramId, data = {}) {
  // If no target telegramId is provided or is placeholder, default to primary merchant (8665505824)
  const targetId = (!telegramId || String(telegramId) === 'api_client') ? '8665505824' : String(telegramId);

  const lang = userService.getUserLanguage(targetId) || 'km';
  const isKm = lang === 'km';

  const amountStr = data.amountFormatted || (data.amount ? (data.currency === 'KHR' ? `${Number(data.amount).toLocaleString()} KHR` : `$${Number(data.amount).toFixed(2)} USD`) : '$1.00 USD');
  const bank = data.bank || 'National KHQR & ABA PayWay';
  const tranId = data.tranId || data.transactionId || 'N/A';
  const merchantName = data.merchantName || 'Merchant Store';

  const text =
    `💰 <b>${isKm ? 'ទទួលបានប្រាក់ទូទាត់ជោគជ័យ' : 'PAYMENT RECEIVED • SETTLED'}</b> ${tgEmoji('brand')}\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
    `• ${tgEmoji('clearing')} <b>${isKm ? 'ប្រព័ន្ធទូទាត់:' : 'Payment Rail:'}</b> <code>${bank}</code>\n` +
    `• ${tgEmoji('brand')} <b>${isKm ? 'ហាង Merchant:' : 'Store Name:'}</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` +
    `• ${tgEmoji('currency')} <b>${isKm ? 'ចំនួនទឹកប្រាក់:' : 'Amount Cleared:'}</b> <b>${amountStr}</b>\n` +
    `• ${tgEmoji('verified')} <b>${isKm ? 'ស្ថានភាព:' : 'Status:'}</b> <b>[ PAID &amp; SETTLED ]</b> ${tgEmoji('active')}\n` +
    `• ${tgEmoji('receipt')} <b>Transaction ID:</b> <code>${tranId}</code>\n` +
    `• ⏰ <b>${isKm ? 'កាលបរិច្ឆេទ:' : 'Timestamp:'}</b> <code>${new Date().toLocaleString('km-KH', { timeZone: 'Asia/Phnom_Penh' })} (GMT+7)</code>\n\n` +
    `${formatter.divider}\n` +
    `<i>${tgEmoji('bulb')} ${isKm ? 'ការទូទាត់នេះត្រូវបានផ្ទៀងផ្ទាត់ដោយស្វវត្តិតាមរយៈ PaylinkApi Gateway។' : 'This transaction was settled via your PaylinkApi payment gateway.'}</i>`;

  const keyboard = {
    inline_keyboard: [
      [makeButton(isKm ? '📊 ផ្ទាំងគ្រប់គ្រង Dashboard' : '📊 View Dashboard', 'nav_dashboard', 'operator', 'primary')],
      [makeButton(isKm ? '📦 មើលការកម្ម៉ង់ Orders' : '📦 View Orders', 'nav_orders', 'orders', 'primary')]
    ]
  };

  try {
    const res = await notifier.sendMessage(targetId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      message_effect_id: '5046509860389126442'
    });
    console.log(`[Merchant Alert] ✓ Sent payment alert to ${targetId}, messageId: ${res.message_id}`);
    return res;
  } catch (err) {
    console.warn(`[Merchant Alert] Effect send failed for ${targetId}, trying plain HTML:`, err.message);
    try {
      const res = await notifier.sendMessage(targetId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      console.log(`[Merchant Alert] ✓ Sent plain payment alert to ${targetId}, messageId: ${res.message_id}`);
      return res;
    } catch (fallbackErr) {
      console.error(`[Merchant Payment Alert Error]: Could not send alert to ${targetId}:`, fallbackErr.message);
    }
  }
}

/**
 * Dispatches real-time telemetry or event alert directly to the active Admin Group
 */
async function sendAdminAlert(text, options = {}) {
  let adminChatId;
  try {
    const db = require('../database');
    adminChatId = String(db.getSetting('admin_group_id') || config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  } catch (_) {
    adminChatId = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  }
  if (!adminChatId) return;

  try {
    return await notifier.sendMessage(adminChatId, text, {
      parse_mode: 'HTML',
      ...options
    });
  } catch (err) {
    console.warn(`[Admin Alert Failed]:`, err.message);
  }
}

module.exports = {
  sendPaymentSuccessNotification,
  sendMerchantPaymentAlert,
  sendAdminAlert
};

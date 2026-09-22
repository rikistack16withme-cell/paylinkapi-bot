const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const { tgEmoji, makeButton } = require('../config/emojis');
const formatter = require('../utils/formatter');
const userService = require('./user.service');

// Standalone Telegram Bot client for sending outbound notifications
const notifier = new TelegramBot(config.bot.token, { polling: false });

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
    `• <b>ABA QR Generator:</b>\n  <code>POST http://localhost:5000/api/aba/generate-qr</code>\n` +
    `• <b>Payment Status Check:</b>\n  <code>POST http://localhost:5000/api/aba/check-payment</code>\n\n` +
    `<i>${animBulb} ${isKm ? 'ទិន្នន័យគណនីរបស់អ្នកត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។ លោកអ្នកអាចប្រើប្រាស់ API Key នេះក្នុងការភ្ជាប់ប្រព័ន្ធទូទាត់បានភ្លាមៗ!' : 'Your merchant data is saved and your live API key is ready for immediate integration!'}</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? '📊 ផ្ទាំងគ្រប់គ្រង Dashboard' : '📊 View Dashboard', 'nav_dashboard', 'operator', 'primary')
      ],
      [
        makeButton(isKm ? '🔑 មើលកូនសោ API Keys' : '🔑 View API Keys', 'nav_apikeys', 'keys', 'success'),
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
 * Dispatches real-time telemetry or event alert directly to the Admin Group (-5393647415)
 */
async function sendAdminAlert(text, options = {}) {
  const adminChatId = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  if (!adminChatId) return;

  try {
    return await notifier.sendMessage(adminChatId, text, {
      parse_mode: 'HTML',
      ...options
    });
  } catch (err) {
    console.warn(`[Admin Alert to ${adminChatId} Failed]:`, err.message);
  }
}

module.exports = {
  sendPaymentSuccessNotification,
  sendAdminAlert
};

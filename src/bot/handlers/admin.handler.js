const config = require('../../config');
const db = require('../../database');
const apiKeyService = require('../../services/apikey.service');
const orderService = require('../../services/order.service');
const userService = require('../../services/user.service');
const safeSender = require('../../utils/safe_sender');
const { tgEmoji, makeButton } = require('../../config/emojis');

const MASTER_ADMIN_ID = String(config.masterAdminId || process.env.MASTER_ADMIN_ID || '7283817695');
const ADMIN_CHAT_ID = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');

/**
 * Strict Master Admin authorization: ONLY user 7283817695 can control the bot
 */
function isMasterAdmin(fromId) {
  return String(fromId) === MASTER_ADMIN_ID;
}

/**
 * Checks if the message or interaction originates from the designated admin chat/group or master admin
 */
function isAdminChat(chatId, fromId) {
  const cId = String(chatId);
  const fId = String(fromId);
  return cId === ADMIN_CHAT_ID || fId === MASTER_ADMIN_ID;
}

/**
 * Generates telemetry stats for the admin operations dashboard
 */
function getTelemetryStats() {
  const users = db.getAllUsers ? db.getAllUsers() : Object.values(db.get('users') || {});
  const orders = db.getAllOrders ? db.getAllOrders() : Object.values(db.get('orders') || {});
  const transactions = Object.values(db.get('payment_transactions') || {});
  const allKeys = Object.values(db.get('api_keys') || {});

  const totalUsers = users.length;
  const activeSubs = users.filter(u => u.subscription?.status === 'ACTIVE' || u.status === 'ACTIVE').length;
  const totalOrders = orders.length;
  const totalKeys = allKeys.length;

  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const mins = Math.floor((uptimeSec % 3600) / 60);
  const secs = uptimeSec % 60;
  const uptimeStr = `${hours}h ${mins}m ${secs}s`;

  const memoryMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

  return {
    totalUsers,
    activeSubs,
    totalOrders,
    totalKeys,
    totalTransactions: transactions.length,
    uptimeStr,
    memoryMb
  };
}

/**
 * Renders the Admin Operations Board
 */
async function renderAdminDashboard(bot, chatId, messageId = null) {
  const stats = getTelemetryStats();

  const text =
    `🛡️ <b>PAYLINKAPI ADMIN OPERATIONS HUB</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
    `📊 <b>LIVE TELEMETRY & SYSTEM HEALTH:</b>\n` +
    `• <b>Registered Merchants:</b> <code>${stats.totalUsers}</code>\n` +
    `• <b>Active Subscriptions:</b> <code>${stats.activeSubs}</code>\n` +
    `• <b>Total API Keys Issued:</b> <code>${stats.totalKeys}</code>\n` +
    `• <b>Total Orders:</b> <code>${stats.totalOrders}</code>\n` +
    `• <b>System Uptime:</b> <code>${stats.uptimeStr}</code>\n` +
    `• <b>RAM Footprint:</b> <code>${stats.memoryMb} MB</code>\n` +
    `• <b>Live Cloud Server:</b> <code>https://paylinkapi-bot.onrender.com</code>\n\n` +
    `<code>─────────────────────────────</code>\n` +
    `⚡ <i>This group receives real-time transaction receipts, merchant registrations, and API key releases.</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('👥 View Merchants', 'admin_view_users', 'users', 'primary'),
        makeButton('🔑 View API Keys', 'admin_view_keys', 'keys', 'primary')
      ],
      [
        makeButton('📦 View Recent Orders', 'admin_view_orders', 'orders', 'primary'),
        makeButton('🔄 Refresh Telemetry', 'admin_refresh_stats', 'refresh', 'success')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Lists registered merchants
 */
async function handleAdminUsersList(bot, chatId, messageId = null) {
  const users = Object.values(db.get('users') || {});
  const recent = users.slice(-10).reverse();

  let text = `👥 <b>REGISTERED MERCHANTS (Latest ${recent.length}):</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n`;

  if (recent.length === 0) {
    text += `<i>No registered users found yet.</i>`;
  } else {
    recent.forEach((u, i) => {
      text += `<b>${i + 1}. ${u.firstName || 'Merchant'}</b> (@${u.username || 'none'})\n` +
        `• <b>ID:</b> <code>${u.telegramId}</code>\n` +
        `• <b>Store:</b> <code>${u.merchantName || 'Default'}</code>\n` +
        `• <b>Status:</b> <code>${u.subscription?.status || u.status || 'NEW'}</code>\n\n`;
    });
  }

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Lists active API keys
 */
async function handleAdminKeysList(bot, chatId, messageId = null) {
  const allKeys = Object.values(db.get('api_keys') || {});
  const recent = allKeys.slice(-10).reverse();

  let text = `🔑 <b>ACTIVE PRODUCTION API KEYS (Latest ${recent.length}):</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n`;

  if (recent.length === 0) {
    text += `<i>No API keys created yet.</i>`;
  } else {
    recent.forEach((k, i) => {
      text += `<b>${i + 1}. Store: ${k.merchantName || 'Store'}</b>\n` +
        `• <b>Key ID:</b> <code>${k.id || k.keyId}</code>\n` +
        `• <b>Provider:</b> <code>${k.provider || 'Bakong / ABA'}</code>\n` +
        `• <b>Owner:</b> <code>${k.telegramId}</code>\n\n`;
    });
  }

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Lists recent orders
 */
async function handleAdminOrdersList(bot, chatId, messageId = null) {
  const orders = Object.values(db.get('orders') || {});
  const recent = orders.slice(-10).reverse();

  let text = `📦 <b>RECENT ORDERS (Latest ${recent.length}):</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n`;

  if (recent.length === 0) {
    text += `<i>No orders logged yet.</i>`;
  } else {
    recent.forEach((o, i) => {
      text += `<b>${i + 1}. Order ${o.id}</b>\n` +
        `• <b>Status:</b> <code>${o.status}</code>\n` +
        `• <b>Customer:</b> <code>${o.telegramId}</code>\n` +
        `• <b>Provider:</b> <code>${o.provider || o.details?.provider || 'Standard'}</code>\n\n`;
    });
  }

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Broadcasts an announcement to all registered users from the admin group
 */
async function handleAdminBroadcast(bot, msg, broadcastText) {
  const chatId = msg.chat.id;
  if (!broadcastText) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/broadcast Your message text here</code>`, { parse_mode: 'HTML' });
  }

  const users = Object.values(db.get('users') || {});
  let sent = 0;
  let failed = 0;

  const header = `📢 <b>OFFICIAL ANNOUNCEMENT • PAYLINKAPI</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n${broadcastText}`;

  for (const u of users) {
    if (u.telegramId && String(u.telegramId) !== ADMIN_CHAT_ID) {
      try {
        await bot.sendMessage(u.telegramId, header, { parse_mode: 'HTML' });
        sent++;
      } catch (_) {
        failed++;
      }
    }
  }

  return safeSender.sendMessage(bot, chatId, `✅ <b>Broadcast Completed!</b>\n• Sent successfully: <code>${sent}</code>\n• Failed/Blocked: <code>${failed}</code>`, { parse_mode: 'HTML' });
}

module.exports = {
  MASTER_ADMIN_ID,
  ADMIN_CHAT_ID,
  isMasterAdmin,
  isAdminChat,
  renderAdminDashboard,
  handleAdminUsersList,
  handleAdminKeysList,
  handleAdminOrdersList,
  handleAdminBroadcast
};

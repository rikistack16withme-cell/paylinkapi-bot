const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../database');
const apiKeyService = require('../../services/apikey.service');
const orderService = require('../../services/order.service');
const userService = require('../../services/user.service');
const { rateLimiter } = require('../../api/security');
const safeSender = require('../../utils/safe_sender');
const formatter = require('../../utils/formatter');
const { tgEmoji, makeButton } = require('../../config/emojis');
const sessionManager = require('../states/user.session');
const { UserState } = require('../states/state.machine');
const logger = require('../../utils/logger');

const {
  DEFAULT_MERCHANT_LINK_USD,
  DEFAULT_MERCHANT_LINK_KHR
} = require('../../controllers/abaPaywayController');

// Active Admin Key Wizard Drafts: chatId -> { targetId, rail, bakongId, usdLink, khrLink, merchantName, days }
const adminWizardDrafts = new Map();

const configuredMasters = String(process.env.MASTER_ADMIN_ID || config.masterAdminId || '7283817695')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const DEFAULT_ADMIN_IDS = ['7283817695', '866558524', '8665505824'];
const MASTER_ADMIN_IDS = Array.from(new Set([...configuredMasters, ...DEFAULT_ADMIN_IDS]));
const MASTER_ADMIN_ID = MASTER_ADMIN_IDS[0];
const ADMIN_CHAT_ID = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');

/**
 * Master Admin authorization: checks whether sender is an authorized master admin
 */
function isMasterAdmin(fromId) {
  if (!fromId) return false;
  return MASTER_ADMIN_IDS.includes(String(fromId));
}

/**
 * Dynamically binds or updates the active authorized admin group.
 * Whenever Master Admin operates in a group, it is automatically authorized.
 */
function bindAdminGroup(chatId, groupTitle = '') {
  if (!chatId) return;
  const idStr = String(chatId);
  try {
    const current = db.getSetting('admin_group_id');
    if (current !== idStr) {
      db.setSetting('admin_group_id', idStr);
      if (groupTitle) db.setSetting('admin_group_title', groupTitle);
      console.log(`[Admin Handler] Successfully bound active admin group to ${idStr} (${groupTitle || 'Admin Group'})`);
    }
  } catch (err) {
    console.error('[Admin Handler] Error saving admin group:', err.message);
  }
}

/**
 * Retrieves the currently active designated admin group ID
 */
function getAdminChatId() {
  try {
    return String(db.getSetting('admin_group_id') || config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  } catch (_) {
    return String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');
  }
}

/**
 * Checks if a group chat is authorized.
 * Dynamic database setting is checked first, followed by default configurations.
 */
function isAuthorizedGroup(chatId) {
  if (!chatId) return false;
  const idStr = String(chatId);
  try {
    const bound = String(db.getSetting('admin_group_id') || '');
    if (bound && idStr === bound) return true;
  } catch (_) {}
  return idStr === '-5393647415' || idStr === '-1005393647415' || idStr === ADMIN_CHAT_ID || idStr.includes('5393647415');
}

/**
 * Checks if the interaction originates from the authorized admin group or master admin
 */
function isAdminChat(chatId, fromId) {
  const cId = String(chatId);
  const fId = String(fromId);
  return isAuthorizedGroup(cId) || isMasterAdmin(fId);
}

/**
 * Generates live telemetry stats for the admin operations dashboard
 */
function getTelemetryStats() {
  const users = db.getAllUsers();
  const orders = db.getAllOrders();
  const allKeys = db.getAllApiKeys();
  const bannedIps = rateLimiter ? rateLimiter.getBannedIps() : [];
  const isMaint = db.getSetting('maintenance_mode', false);

  const totalUsers = users.length;
  const activeSubs = users.filter(u => u.subscription?.status === 'ACTIVE' || u.status === 'ACTIVE').length;
  const bannedUsers = users.filter(u => u.status === 'BANNED').length;
  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.status === 'PAID').length;
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
    bannedUsers,
    totalOrders,
    paidOrders,
    totalKeys,
    bannedIpsCount: bannedIps.length,
    isMaint,
    uptimeStr,
    memoryMb
  };
}

/**
 * Renders the Master Admin Operations Control Center
 */
async function renderAdminDashboard(bot, chatId, messageId = null) {
  const stats = getTelemetryStats();
  const maintStatus = stats.isMaint ? '🔴 [ MAINTENANCE ON ]' : '🟢 [ ONLINE ACTIVE ]';

  const text =
    `🛡️ <b>PAYLINKAPI MASTER CONTROL CENTER</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `👤 <b>Master Admin:</b> <code>${MASTER_ADMIN_ID}</code> (Total Access)\n` +
    `🌐 <b>Gateway:</b> <code>https://paylinkapi-bot.onrender.com</code>\n` +
    `🔧 <b>System Mode:</b> <b>${maintStatus}</b>\n` +
    `🛡️ <b>Anti-DDoS Firewall:</b> <code>${stats.bannedIpsCount} IPs Banned</code>\n\n` +
    `📊 <b>LIVE SYSTEM TELEMETRY:</b>\n` +
    `• <b>Registered Merchants:</b> <code>${stats.totalUsers}</code> (Active: <code>${stats.activeSubs}</code> | Banned: <code>${stats.bannedUsers}</code>)\n` +
    `• <b>Total API Keys Issued:</b> <code>${stats.totalKeys}</code>\n` +
    `• <b>Total Orders / Payments:</b> <code>${stats.totalOrders}</code> (Paid: <code>${stats.paidOrders}</code>)\n` +
    `• <b>System Uptime:</b> <code>${stats.uptimeStr}</code>\n` +
    `• <b>RAM Footprint:</b> <code>${stats.memoryMb} MB</code>\n\n` +
    `<code>─────────────────────────────</code>\n` +
    `⚡ <i>Use buttons below or send commands to control all users, keys, payments & settings.</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('🔑 Generate / Configure Key', 'admin_wiz_start_prompt', 'keys', 'success'),
        makeButton('👥 Merchants List', 'admin_view_users', 'users', 'primary')
      ],
      [
        makeButton('🔑 API Keys List', 'admin_view_keys', 'keys', 'primary'),
        makeButton('💳 Transactions', 'admin_view_orders', 'orders', 'primary')
      ],
      [
        makeButton('🛡️ DDoS Firewall', 'admin_view_firewall', 'security', 'primary'),
        makeButton(stats.isMaint ? '🟢 Disable Maintenance' : '🔴 Enable Maintenance', 'admin_toggle_maint', 'refresh', stats.isMaint ? 'success' : 'danger')
      ],
      [
        makeButton('💾 Export DB Backup', 'admin_export_backup', 'docs', 'primary'),
        makeButton('🔄 Refresh Telemetry', 'admin_refresh_stats', 'refresh', 'success')
      ],
      [
        makeButton('📢 Broadcast Help', 'admin_broadcast_help', 'announcement', 'primary'),
        makeButton('📖 Master Commands Cheat-Sheet', 'admin_view_commands', 'docs', 'secondary')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard
  });
}

/**
 * Lists registered merchants with quick admin action syntax
 */
async function handleAdminUsersList(bot, chatId, messageId = null) {
  const users = db.getAllUsers();
  const recent = users.slice(-20).reverse();

  let text = `👥 <b>MEMBERS & MERCHANTS LIST (Total: ${users.length}):</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n`;

  if (recent.length === 0) {
    text += `<i>No users found in database yet.</i>`;
  } else {
    recent.forEach((u, i) => {
      const isSub = u.subscription?.status === 'ACTIVE' || u.status === 'ACTIVE';
      const isBan = u.status === 'BANNED';
      const badge = isBan ? '🚫 BANNED' : (isSub ? '✅ ACTIVE' : '⏳ PENDING');

      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Telegram User';
      const userMention = `<a href="tg://user?id=${u.telegramId}">${formatter.escapeHtml(fullName)}</a>`;
      const usernameDisplay = u.username
        ? `<a href="https://t.me/${u.username}">@${u.username}</a>`
        : `<i>No @username</i>`;

      text += `<b>${i + 1}. ${userMention}</b>\n` +
        `• <b>Username:</b> ${usernameDisplay}\n` +
        `• <b>Telegram ID:</b> <code>${u.telegramId}</code>\n` +
        `• <b>Profile Link:</b> ${u.username ? `<a href="https://t.me/${u.username}">https://t.me/${u.username}</a>` : `<a href="tg://user?id=${u.telegramId}">👤 View Profile (Mobile)</a>`}\n` +
        (u.merchantName ? `• <b>Store:</b> <code>${formatter.escapeHtml(u.merchantName)}</code>\n` : '') +
        `• <b>Status:</b> <code>${badge}</code>\n` +
        `• <b>Direct DM:</b> <code>/dm ${u.telegramId} Hello</code>\n` +
        `• <b>Quick Control:</b> <code>/activate ${u.telegramId}</code> | <code>/ban ${u.telegramId}</code>\n\n`;
    });
  }

  // Interactive quick 1-tap user selector buttons
  const inspectButtons = recent.slice(0, 6).map(u => {
    const label = u.firstName || u.username || String(u.telegramId);
    return makeButton(`👤 ${label.substring(0, 14)}`, `admin_inspect_${u.telegramId}`, 'users', 'primary');
  });

  const keyboardRows = [];
  for (let i = 0; i < inspectButtons.length; i += 2) {
    keyboardRows.push(inspectButtons.slice(i, i + 2));
  }
  keyboardRows.push([makeButton('« Back to Master Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]);

  const keyboard = {
    inline_keyboard: keyboardRows
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard
  });
}

/**
 * Lists active API keys
 */
async function handleAdminKeysList(bot, chatId, messageId = null) {
  const allKeys = db.getAllApiKeys();
  const recent = allKeys.slice(-10).reverse();

  let text = `🔑 <b>ACTIVE PRODUCTION API KEYS (Latest ${recent.length} of ${allKeys.length}):</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n`;

  if (recent.length === 0) {
    text += `<i>No API keys created yet.</i>`;
  } else {
    recent.forEach((k, i) => {
      text += `<b>${i + 1}. Store: ${formatter.escapeHtml(k.merchantName || 'Store')}</b>\n` +
        `• <b>Key ID:</b> <code>${k.id || k.keyId}</code>\n` +
        `• <b>Owner Telegram ID:</b> <code>${k.telegramId}</code>\n` +
        `• <b>Key:</b> <code>${k.apiKey ? (k.apiKey.substring(0, 18) + '...') : 'N/A'}</code>\n` +
        `• <b>Rails:</b> <code>${k.provider || 'Bakong / ABA'}</code>\n` +
        `• <b>Revoke:</b> <code>/revokekey ${k.id || k.keyId}</code>\n\n`;
    });
  }

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to Master Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Lists recent payment orders & transactions with 1-click settlement syntax
 */
async function handleAdminOrdersList(bot, chatId, messageId = null) {
  const orders = db.getAllOrders();
  const recent = orders.slice(-10).reverse();

  let text = `💳 <b>RECENT TRANSACTIONS & ORDERS (Latest ${recent.length}):</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n`;

  if (recent.length === 0) {
    text += `<i>No orders logged yet.</i>`;
  } else {
    recent.forEach((o, i) => {
      const isPaid = o.status === 'PAID';
      const badge = isPaid ? '✅ PAID' : `⏳ ${o.status || 'PENDING'}`;

      text += `<b>${i + 1}. Tran ID: <code>${o.id}</code></b>\n` +
        `• <b>Customer ID:</b> <code>${o.telegramId}</code>\n` +
        `• <b>Amount:</b> <b>${o.amountFormatted || o.amount || '0'} ${o.currency || 'USD'}</b>\n` +
        `• <b>Bank Rail:</b> <code>${o.bank || o.provider || 'ABA/Bakong'}</code>\n` +
        `• <b>Status:</b> <code>${badge}</code>\n` +
        (!isPaid ? `• <b>Manual Settlement:</b> <code>/markpaid ${o.id}</code>\n\n` : '\n');
    });
  }

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to Master Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Displays DDoS Firewall & IP Rate Limiting status with flush button
 */
async function handleAdminFirewall(bot, chatId, messageId = null) {
  const banned = rateLimiter ? rateLimiter.getBannedIps() : [];

  let text = `🛡️ <b>ANTI-DDOS & IP FIREWALL CONTROL</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
    `• <b>Sliding-Window Limit:</b> <code>60 req/min per IP</code>\n` +
    `• <b>DDoS Burst Auto-Ban:</b> <code>120 req/min (3-min lockout)</code>\n` +
    `• <b>Payload Ceiling:</b> <code>100 KB max</code>\n` +
    `• <b>Currently Banned IPs:</b> <code>${banned.length}</code>\n\n`;

  if (banned.length === 0) {
    text += `<i>No IPs are currently banned. The gateway firewall is operating normally.</i>\n\n`;
  } else {
    text += `<b>BANNED ATTACKERS LIST:</b>\n`;
    banned.forEach((b, i) => {
      text += `<b>${i + 1}. IP:</b> <code>${b.ip}</code> (Remaining: <code>${b.remainingSec}s</code>) | <code>/unbanip ${b.ip}</code>\n`;
    });
    text += '\n';
  }

  const keyboard = {
    inline_keyboard: [
      [makeButton('🧹 Flush Firewall / Clear All Bans', 'admin_flush_firewall', 'refresh', 'danger')],
      [makeButton('« Back to Master Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Toggles maintenance mode
 */
async function handleAdminToggleMaintenance(bot, chatId, messageId = null, forceState = null) {
  const current = db.getSetting('maintenance_mode', false);
  const next = forceState !== null ? Boolean(forceState) : !current;
  db.setSetting('maintenance_mode', next);

  const statusText = next ? '🔴 MAINTENANCE MODE ACTIVATED' : '🟢 MAINTENANCE MODE DEACTIVATED';
  const alertText = next
    ? `⚠️ <b>Maintenance mode is now ON.</b>\nRegular users will see a maintenance screen. Master Admin retains full access.`
    : `✅ <b>Maintenance mode is now OFF.</b>\nAll users can use the bot and payment gateway normally.`;

  await safeSender.sendMessage(bot, chatId, `${statusText}\n\n${alertText}`, { parse_mode: 'HTML' });
  return await renderAdminDashboard(bot, chatId, messageId);
}

/**
 * Exports complete database JSON file to Master Admin
 */
async function handleAdminExportBackup(bot, chatId) {
  const dbPath = db.getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Database file not found on disk.`, { parse_mode: 'HTML' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFileName = `paylinkapi_db_backup_${timestamp}.json`;
  const tempBackupPath = path.join(__dirname, '../../../temp', backupFileName);

  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    fs.writeFileSync(tempBackupPath, raw, 'utf8');

    await bot.sendDocument(chatId, tempBackupPath, {
      caption: `💾 <b>DATABASE BACKUP EXPORT</b>\n\n` +
        `• <b>File:</b> <code>${backupFileName}</code>\n` +
        `• <b>Export Time:</b> <code>${new Date().toISOString()}</code>\n` +
        `• <b>Status:</b> <code>100% Complete Snapshot</code>`,
      parse_mode: 'HTML'
    });
  } catch (err) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Export failed: ${err.message}`, { parse_mode: 'HTML' });
  }
}

/**
 * Manually activates a user's subscription and issues their production credentials
 */
async function handleAdminManualActivate(bot, chatId, targetId, plan = 'VIP Pro License', days = 365) {
  if (!targetId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/activate &lt;telegramId&gt; [days] [planName]</code>`, { parse_mode: 'HTML' });
  }

  const user = userService.activateUser(targetId, plan, Number(days) || 365);
  const keys = apiKeyService.getOrCreateUserKeys(targetId);
  const activeKey = keys[0]?.apiKey || '';

  // Notify the user in their private chat
  try {
    await bot.sendMessage(
      targetId,
      `🎉 <b>CONGRATULATIONS! ACCOUNT ACTIVATED</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
      `Your account has been officially activated by Master Administrator!\n\n` +
      `• <b>License Plan:</b> <code>${plan}</code>\n` +
      `• <b>Duration:</b> <code>${days} Days</code>\n` +
      `• <b>Production API Key:</b>\n<code>${activeKey}</code>\n\n` +
      `<i>Tap /start or /connect to open your developer console!</i>`,
      { parse_mode: 'HTML' }
    );
  } catch (_) {}

  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>User ${targetId} Activated Successfully!</b>\n` +
    `• Plan: <code>${plan}</code>\n` +
    `• Days: <code>${days}</code>\n` +
    `• Key: <code>${activeKey}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Manually deactivates user subscription
 */
async function handleAdminManualDeactivate(bot, chatId, targetId) {
  if (!targetId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/deactivate &lt;telegramId&gt;</code>`, { parse_mode: 'HTML' });
  }
  userService.deactivateUser(targetId);
  return safeSender.sendMessage(bot, chatId, `✅ <b>User ${targetId} subscription has been deactivated.</b>`, { parse_mode: 'HTML' });
}

/**
 * Bans a user
 */
async function handleAdminBan(bot, chatId, targetId) {
  if (!targetId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/ban &lt;telegramId&gt;</code>`, { parse_mode: 'HTML' });
  }
  userService.banUser(targetId);
  return safeSender.sendMessage(bot, chatId, `🚫 <b>User ${targetId} has been BANNED from the system.</b>`, { parse_mode: 'HTML' });
}

/**
 * Unbans a user
 */
async function handleAdminUnban(bot, chatId, targetId) {
  if (!targetId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/unban &lt;telegramId&gt;</code>`, { parse_mode: 'HTML' });
  }
  userService.unbanUser(targetId);
  return safeSender.sendMessage(bot, chatId, `✅ <b>User ${targetId} has been UNBANNED.</b>`, { parse_mode: 'HTML' });
}

/**
 * Manually issues an API key for a merchant
 */
async function handleAdminAddKey(bot, chatId, targetId, merchantName = 'Merchant Store') {
  if (!targetId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/addkey &lt;telegramId&gt; [StoreName]</code>`, { parse_mode: 'HTML' });
  }

  const key = apiKeyService.generateManualKey(targetId, { merchantName });

  try {
    await bot.sendMessage(
      targetId,
      `🔑 <b>NEW PRODUCTION API KEY ISSUED</b>\n\n` +
      `Master Admin has manually provisioned a new live API key for your account:\n\n` +
      `• <b>Store Name:</b> <code>${merchantName}</code>\n` +
      `• <b>API Key:</b>\n<code>${key.apiKey}</code>\n` +
      `• <b>Webhook Secret:</b>\n<code>${key.secret}</code>\n\n` +
      `<i>Base URL: https://paylinkapi-bot.onrender.com</i>`,
      { parse_mode: 'HTML' }
    );
  } catch (_) {}

  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>API Key Issued for ${targetId}!</b>\n` +
    `• Store: <code>${merchantName}</code>\n` +
    `• Key ID: <code>${key.id}</code>\n` +
    `• Key: <code>${key.apiKey}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Revokes an API key
 */
async function handleAdminRevokeKey(bot, chatId, keyId) {
  if (!keyId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/revokekey &lt;keyId_or_apiKey&gt;</code>`, { parse_mode: 'HTML' });
  }

  const success = apiKeyService.revokeApiKey(keyId);
  if (success) {
    return safeSender.sendMessage(bot, chatId, `✅ <b>API Key <code>${keyId}</code> has been REVOKED and deleted.</b>`, { parse_mode: 'HTML' });
  }
  return safeSender.sendMessage(bot, chatId, `⚠️ Could not find API Key with identifier: <code>${keyId}</code>`, { parse_mode: 'HTML' });
}

/**
 * Manually expires an API key for live testing
 */
async function handleAdminExpireKey(bot, chatId, keyIdOrApiKey) {
  if (!keyIdOrApiKey) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/expire &lt;apiKey_or_keyId&gt;</code>`, { parse_mode: 'HTML' });
  }

  const keyData = apiKeyService.getKeyById(keyIdOrApiKey);
  if (!keyData) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Could not find API Key: <code>${formatter.escapeHtml(keyIdOrApiKey)}</code>`, { parse_mode: 'HTML' });
  }

  keyData.status = 'EXPIRED';
  keyData.expiresAt = new Date(Date.now() - 3600000).toISOString();
  keyData.expiryWarningSent = true;
  keyData.expiredNoticeSent = true;
  db.saveApiKey(keyData);

  return safeSender.sendMessage(
    bot,
    chatId,
    `🔴 <b>API Key Expired Successfully:</b>\n` +
    `• Key: <code>${keyData.apiKey}</code>\n` +
    `• Merchant: <code>${formatter.escapeHtml(keyData.merchantName || 'Store')}</code>\n` +
    `• Status: <b>EXPIRED</b>\n` +
    `• Expired At: <code>${keyData.expiresAt}</code>\n\n` +
    `<i>All payment requests using this key will now return HTTP 403 API_KEY_EXPIRED.</i>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Manually reactivates an API key
 */
async function handleAdminReactivateKey(bot, chatId, keyIdOrApiKey, days = 7) {
  if (!keyIdOrApiKey) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/reactivate &lt;apiKey_or_keyId&gt; [days]</code>`, { parse_mode: 'HTML' });
  }

  const keyData = apiKeyService.getKeyById(keyIdOrApiKey);
  if (!keyData) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Could not find API Key: <code>${formatter.escapeHtml(keyIdOrApiKey)}</code>`, { parse_mode: 'HTML' });
  }

  const durationDays = parseInt(days, 10) || keyData.durationDays || 7;
  keyData.status = 'ACTIVE';
  keyData.durationDays = durationDays;
  keyData.expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  keyData.expiryWarningSent = false;
  keyData.expiredNoticeSent = false;
  db.saveApiKey(keyData);

  return safeSender.sendMessage(
    bot,
    chatId,
    `🟢 <b>API Key Reactivated Successfully:</b>\n` +
    `• Key: <code>${keyData.apiKey}</code>\n` +
    `• Merchant: <code>${formatter.escapeHtml(keyData.merchantName || 'Store')}</code>\n` +
    `• Status: <b>ACTIVE</b>\n` +
    `• New Expiry: <code>${keyData.expiresAt}</code>\n` +
    `• Duration: <b>${durationDays} Days</b>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Manually marks a pending transaction as PAID and issues receipt + key to user
 */
async function handleAdminMarkPaid(bot, chatId, tranId) {
  if (!tranId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/markpaid &lt;tranId&gt;</code>`, { parse_mode: 'HTML' });
  }

  const tx = orderService.getPaymentTransaction(tranId);
  if (!tx) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Transaction ID <code>${tranId}</code> not found in database.`, { parse_mode: 'HTML' });
  }

  // Update status
  orderService.updatePaymentTransactionStatus(tranId, 'PAID', { manualOverride: true, admin: MASTER_ADMIN_ID });

  // Activate user
  if (tx.telegramId) {
    userService.activateUser(tx.telegramId, tx.plan || 'VIP Developer Pass', 365);
    const { issueUserCredentialsReceipt } = require('./wizard.handler');
    const userObj = userService.getUser(tx.telegramId) || { id: tx.telegramId };
    try {
      await issueUserCredentialsReceipt(bot, tx.telegramId, null, userObj, true);
    } catch (_) {}
  }

  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>TRANSACTION SETTLED MANUALLY</b>\n` +
    `• Tran ID: <code>${tranId}</code>\n` +
    `• Customer: <code>${tx.telegramId}</code>\n` +
    `• Amount: <b>${tx.amountFormatted || tx.amount} ${tx.currency}</b>\n` +
    `• Status: <code>PAID (Credentials Delivered)</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Looks up detailed profile of a user with interactive key & rail configuration controls
 */
async function handleAdminUserLookup(bot, chatId, queryStr, messageId = null) {
  if (!queryStr) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/user &lt;telegramId_or_username&gt;</code>`, { parse_mode: 'HTML' });
  }

  const users = db.getAllUsers();
  const clean = String(queryStr).replace('@', '').trim();
  const user = users.find(u => String(u.telegramId) === clean || (u.username && u.username.toLowerCase() === clean.toLowerCase()));

  if (!user) {
    return safeSender.sendMessage(bot, chatId, `⚠️ No user found matching: <code>${queryStr}</code>`, { parse_mode: 'HTML' });
  }

  const userKeys = db.getUserApiKeys(user.telegramId);
  const activeKey = userKeys && userKeys.length > 0 ? userKeys[0] : null;
  const countdown = activeKey ? apiKeyService.getExpiryCountdown(activeKey, 'en') : { text: 'No Key Generated' };

  const userProv = String(user.provider || activeKey?.provider || '').toLowerCase();
  const isBakongOnly = (userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user.bakongId || user.merchantId) && !user.usdLink && !user.khrLink);
  const isAbaOnly = (userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user.usdLink || user.khrLink) && !user.bakongId && !user.merchantId);

  let railBadge = '🟣 Dual Suite (Bakong + ABA)';
  if (isBakongOnly) railBadge = '🔴 NBC Bakong KHQR Only';
  else if (isAbaOnly) railBadge = '🔵 ABA PayWay Only';
  if (!user.provider && !activeKey?.provider) railBadge = '⏳ Not Configured Yet';

  const userOrders = db.getUserOrders(user.telegramId);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Telegram User';
  const userMention = `<a href="tg://user?id=${user.telegramId}">${formatter.escapeHtml(fullName)}</a>`;
  const usernameDisplay = user.username
    ? `<a href="https://t.me/${user.username}">@${user.username}</a>`
    : `<i>No @username set</i>`;

  const isBanned = user.status === 'BANNED';
  const isSub = user.subscription?.status === 'ACTIVE' || user.status === 'ACTIVE';
  const badge = isBanned ? '🚫 BANNED' : (isSub ? '✅ ACTIVE' : '⏳ PENDING');

  const profileDisplay = user.username
    ? `<a href="https://t.me/${user.username}">https://t.me/${user.username}</a>`
    : `<a href="tg://user?id=${user.telegramId}">👤 View Profile (Mobile)</a>`;

  const text =
    `👤 <b>USER PROFILE: ${userMention}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>Full Name:</b> ${formatter.escapeHtml(fullName)}\n` +
    `• <b>Username:</b> ${usernameDisplay}\n` +
    `• <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
    `• <b>Direct Profile:</b> ${profileDisplay}\n` +
    `• <b>Store Name:</b> <code>${formatter.escapeHtml(user.merchantName || 'Not Set')}</code>\n` +
    `• <b>Account Status:</b> <code>${badge}</code>\n` +
    `• <b>Payment Rail:</b> <b>${railBadge}</b>\n` +
    `• <b>Bakong ID:</b> <code>${user.bakongId || '⚠️ Not Set'}</code>\n` +
    `• <b>ABA USD Link:</b> <code>${user.usdLink || '⚠️ Not Set'}</code>\n` +
    `• <b>ABA KHR Link:</b> <code>${user.khrLink || '⚠️ Not Set'}</code>\n` +
    `• <b>Phone:</b> <code>${user.phone || 'N/A'}</code>\n\n` +
    `🔑 <b>ACTIVE PRODUCTION API KEY:</b>\n` +
    `• <b>Key:</b> <code>${activeKey?.apiKey || 'No Active Key'}</code>\n` +
    `• <b>Secret:</b> <code>${activeKey?.secret ? (activeKey.secret.substring(0, 16) + '...') : 'N/A'}</code>\n` +
    `• <b>Validity:</b> <b>${countdown.text}</b> (Expires: <code>${activeKey?.expiresAt ? activeKey.expiresAt.slice(0, 10) : 'N/A'}</code>)\n` +
    `• <b>Total Keys:</b> <code>${userKeys.length}</code> | <b>Orders:</b> <code>${userOrders.length}</code>\n\n` +
    `⚡ <b>Master Admin Commands:</b>\n` +
    `• <code>/genkey ${user.telegramId} [bakong|aba|bundle] [days]</code>\n` +
    `• <code>/setdays ${user.telegramId} 30</code> | <code>/setrail ${user.telegramId} bakong</code>\n` +
    `• <code>/setbakong ${user.telegramId} merchant@aclb</code>\n` +
    `• <code>/setaba ${user.telegramId} https://link.payway...</code>\n` +
    `• <code>/dm ${user.telegramId} Message</code> | <code>/deliverkey ${user.telegramId}</code>`;

  const keyboardRows = [];
  if (user.username) {
    keyboardRows.push([
      { text: `💬 Chat with @${user.username}`, url: `https://t.me/${user.username}` }
    ]);
  }
  keyboardRows.push([
    makeButton('🔑 Generate / Configure Key', `admin_wiz_key_${user.telegramId}`, 'keys', 'primary'),
    makeButton('⏳ Set Days / Validity', `admin_pick_days_${user.telegramId}`, 'telemetry', 'primary')
  ]);
  keyboardRows.push([
    makeButton('🔄 Switch Rail', `admin_pick_rail_${user.telegramId}`, 'refresh', 'secondary'),
    makeButton('🏦 Set Bank Details', `admin_edit_bank_${user.telegramId}`, 'clearing', 'secondary')
  ]);
  keyboardRows.push([
    makeButton('📤 Deliver Key to User', `admin_deliver_key_${user.telegramId}`, 'announcement', 'success'),
    makeButton('⚡ Quick 1-Year Pass', `admin_act_1y_${user.telegramId}`, 'success', 'primary')
  ]);
  keyboardRows.push([
    makeButton(isBanned ? '✅ Unban User' : '🚫 Ban User', `admin_toggle_ban_${user.telegramId}`, 'refresh', isBanned ? 'success' : 'danger'),
    makeButton('« Back to Members List', 'admin_view_users', 'arrow_left', 'secondary')
  ]);

  const keyboard = {
    inline_keyboard: keyboardRows
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard
  });
}

/**
 * Prompts admin to pick a user or start key generator wizard
 */
async function handleAdminKeyWizardStartPrompt(bot, chatId, messageId = null) {
  const users = db.getAllUsers();
  const recent = users.slice(-10).reverse();

  let text =
    `🔑 <b>ADMIN KEY GENERATOR & RAIL CONFIGURATION WIZARD</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
    `You can generate a standalone production API key on-demand (no user required) OR configure a key for any registered merchant!\n\n` +
    `• <b>Option 1 (Fast Standalone Key):</b> Tap <code>[ ⚡ Generate Key Without User ]</code> below.\n` +
    `• <b>Option 2 (Pick Registered Merchant):</b> Tap any merchant name below.\n` +
    `• <b>Option 3 (Slash Command):</b>\n` +
    `  <code>/genkey</code> <i>(Interactive wizard)</i>\n` +
    `  <code>/genkey standalone [rail] [days] [name]</code>\n` +
    `  <code>/genkey &lt;telegramId&gt; [rail] [days] [name]</code>\n\n` +
    `<i>Tap a button below to begin:</i>`;

  const keyboardRows = [
    [
      makeButton('⚡ Generate Key Without User (Instant Key) ❯', 'admin_wiz_key_standalone', 'crown', 'success')
    ]
  ];

  const pickButtons = recent.slice(0, 8).map(u => {
    const label = u.firstName || u.username || String(u.telegramId);
    return makeButton(`👤 ${label.substring(0, 13)}`, `admin_wiz_key_${u.telegramId}`, 'keys', 'primary');
  });

  for (let i = 0; i < pickButtons.length; i += 2) {
    keyboardRows.push(pickButtons.slice(i, i + 2));
  }
  keyboardRows.push([
    makeButton('👥 View Full Merchants List', 'admin_view_users', 'users', 'secondary'),
    makeButton('« Back to Control Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')
  ]);

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboardRows }
  });
}

/**
 * Step 1: Select payment rail for target user (or standalone)
 */
async function handleAdminKeyWizardStep1(bot, chatId, targetId, messageId = null) {
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});

  // Initialize draft for this admin's session
  adminWizardDrafts.set(String(chatId), {
    targetId,
    rail: user.providerKey || 'bundle',
    bakongId: user.bakongId || null,
    usdLink: user.usdLink || null,
    khrLink: user.khrLink || null,
    merchantName: user.merchantName || (isStandalone ? 'VIP Standalone Store' : null),
    days: 30
  });

  let text = '';
  if (isStandalone) {
    text =
      `⚡ <b>GENERATE STANDALONE API KEY (NO USER REQUIRED)</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `• <b>Mode:</b> <code>Direct / Unassigned Production Key</code>\n` +
      `• No Telegram merchant registration required.\n` +
      `• You can configure custom Bakong ID, ABA Links, and Store Name directly in the next step!\n\n` +
      `<i>Select what payment rail this key should support:</i>\n\n` +
      `• 🔴 <b>NBC Bakong Only:</b> National KHQR standard deposits.\n` +
      `• 🔵 <b>ABA PayWay Gateway Only:</b> ABA PayWay direct payment link.\n` +
      `• 🟣 <b>Dual Suite (Bakong + ABA):</b> Both Bakong KHQR & ABA PayWay active.\n\n` +
      `<i>Tap your choice below to input merchant bank credentials:</i>`;
  } else {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${targetId}`;
    text =
      `🔑 <b>STEP 1: SELECT PAYMENT RAIL FOR MERCHANT</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `👤 <b>Target Merchant:</b> <b>${formatter.escapeHtml(name)}</b>\n` +
      `🆔 <b>Telegram ID:</b> <code>${targetId}</code>\n\n` +
      `<i>Select what payment rail this merchant should use:</i>\n\n` +
      `• 🔴 <b>NBC Bakong Only:</b>\n` +
      `  National KHQR QR standard. Customer payments deposit into merchant's Bakong.\n\n` +
      `• 🔵 <b>ABA PayWay Gateway Only:</b>\n` +
      `  ABA PayWay direct gateway. Clears Bakong ID.\n\n` +
      `• 🟣 <b>Dual Suite (Bakong + ABA):</b>\n` +
      `  Universal clearing for both Bakong KHQR and ABA PayWay USD & KHR.\n\n` +
      `<i>Tap your choice below to input merchant bank credentials:</i>`;
  }

  const cancelCb = isStandalone ? 'admin_wiz_start_prompt' : `admin_inspect_${targetId}`;
  const keyboard = {
    inline_keyboard: [
      [
        makeButton('🔴 NBC Bakong Only ❯', `admin_wstep_rail_${targetId}_bakong`, 'clearing', 'primary')
      ],
      [
        makeButton('🔵 ABA PayWay Only ❯', `admin_wstep_rail_${targetId}_aba`, 'brand', 'primary')
      ],
      [
        makeButton('🟣 Dual Suite (Bakong + ABA) ❯', `admin_wstep_rail_${targetId}_bundle`, 'crown', 'success')
      ],
      [
        makeButton('« Cancel', cancelCb, 'arrow_left', 'secondary')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Step 2: Start direct interactive bank credentials input (like user register)
 */
async function handleAdminKeyWizardStartRailInput(bot, chatId, targetId, rail, messageId = null, fromId = null) {
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});

  let draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null);
  if (!draft || draft.targetId !== targetId) {
    draft = {
      targetId,
      rail,
      bakongId: user.bakongId || null,
      usdLink: user.usdLink || null,
      khrLink: user.khrLink || null,
      merchantName: user.merchantName || (isStandalone ? 'VIP Standalone Store' : null),
      days: 30
    };
  }
  draft.rail = rail;
  adminWizardDrafts.set(String(chatId), draft);
  if (fromId) adminWizardDrafts.set(String(fromId), draft);

  if (rail === 'aba') {
    return await handleAdminPromptInputAba(bot, chatId, targetId, 'USD', messageId, fromId);
  }
  return await handleAdminPromptInputBakong(bot, chatId, targetId, messageId, fromId);
}

/**
 * Fallback for old bank step callback: immediately routes to direct input
 */
async function handleAdminKeyWizardStepBank(bot, chatId, targetId, rail, messageId = null, fromId = null) {
  return await handleAdminKeyWizardStartRailInput(bot, chatId, targetId, rail, messageId, fromId);
}

/**
 * Prompts admin to type the Merchant's Bakong ID (conversational prompt matching user register)
 */
async function handleAdminPromptInputBakong(bot, chatId, targetId, messageId = null, fromId = null) {
  const draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null) || { targetId, rail: 'bakong' };
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  const defaultBakong = draft.bakongId || user.bakongId || 'soksitchey1@aclb';

  const sessionData = { targetId, rail: draft.rail, promptMessageId: messageId };
  sessionManager.setState(chatId, UserState.ADMIN_INPUT_BAKONG, sessionData);
  if (fromId) sessionManager.setState(fromId, UserState.ADMIN_INPUT_BAKONG, sessionData);

  const isBundle = draft.rail === 'bundle';
  const text =
    `${formatter.header(isBundle ? 'BAKONG + ABA • STEP 1/2' : 'BAKONG KHQR CONFIGURATION', 'NBC National Bank of Cambodia')}\n\n` +
    `🏦 <b>Target Rail:</b> 🔴 <b>NBC Bakong National KHQR</b>\n` +
    (isStandalone ? `⚡ <b>Mode:</b> <code>Standalone Key (Direct Production)</code>\n\n` : `👤 <b>Target:</b> <code>${formatter.escapeHtml(user.firstName || targetId)}</code>\n\n`) +
    `Please enter the merchant's authentic <b>Bakong Account ID</b> or phone number:\n` +
    `• <b>Examples:</b> <code>soksitchey1@aclb</code>, <code>0977416126</code>, <code>kaixite@abaa</code>\n\n` +
    `💡 <b>Tip:</b> You can enter both Bakong ID and Store Name in one message:\n` +
    `  <code>soksitchey1@aclb Kai Coffee Shop</code>\n\n` +
    `<i>👉 Type your Bakong account directly in this chat, or tap Skip below:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(`⚡ Skip / Use Standard Default (${defaultBakong}) ❯`, `admin_wstep_skip_bakong_${targetId}_${draft.rail}`, 'lightning', 'primary')
      ],
      [
        makeButton('« Back to Rail Selection', `admin_wiz_key_${targetId}`, 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', isStandalone ? 'admin_wiz_start_prompt' : `admin_inspect_${targetId}`, 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
  if (res?.message_id) {
    sessionData.promptMessageId = res.message_id;
    sessionManager.updateData(chatId, { promptMessageId: res.message_id });
    if (fromId) sessionManager.updateData(fromId, { promptMessageId: res.message_id });
  }
  return res;
}

/**
 * Prompts admin to type the Merchant's ABA PayWay Link
 */
async function handleAdminPromptInputAba(bot, chatId, targetId, currency = 'USD', messageId = null, fromId = null) {
  const draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null) || { targetId, rail: 'aba' };
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  const isKhr = currency === 'KHR';
  const defaultLink = isKhr
    ? (draft.khrLink || user.khrLink || DEFAULT_MERCHANT_LINK_KHR)
    : (draft.usdLink || user.usdLink || DEFAULT_MERCHANT_LINK_USD);

  const state = isKhr ? UserState.ADMIN_INPUT_ABA_KHR : UserState.ADMIN_INPUT_ABA_USD;
  const sessionData = { targetId, rail: draft.rail, currency, promptMessageId: messageId };
  sessionManager.setState(chatId, state, sessionData);
  if (fromId) sessionManager.setState(fromId, state, sessionData);

  const isBundle = draft.rail === 'bundle';
  const text =
    `${formatter.header(isBundle ? 'BAKONG + ABA • STEP 2/2' : 'ABA PAYWAY CONFIGURATION', `ABA PayWay Gateway (${currency})`)}\n\n` +
    `🏦 <b>Target Rail:</b> 🔵 <b>ABA PayWay ${currency}</b>\n` +
    (isStandalone ? `⚡ <b>Mode:</b> <code>Standalone Key (Direct Production)</code>\n\n` : `👤 <b>Target:</b> <code>${formatter.escapeHtml(user.firstName || targetId)}</code>\n\n`) +
    `Please enter the merchant's authentic <b>ABA PayWay ${currency} Link</b>:\n` +
    `• <b>Example:</b> <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>\n\n` +
    `<i>👉 Paste or type the payment link, or tap Skip below:</i>`;

  const backCb = isBundle
    ? `admin_wstep_reinput_bakong_${targetId}_${draft.rail}`
    : `admin_wiz_key_${targetId}`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('⚡ Skip / Use Standard Default Link ❯', `admin_wstep_skip_aba_${targetId}_${draft.rail}_${currency}`, 'lightning', 'primary')
      ],
      [
        makeButton(isBundle ? '« Back to Bakong ID' : '« Back to Rail Selection', backCb, 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', isStandalone ? 'admin_wiz_start_prompt' : `admin_inspect_${targetId}`, 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
  if (res?.message_id) {
    sessionData.promptMessageId = res.message_id;
    sessionManager.updateData(chatId, { promptMessageId: res.message_id });
    if (fromId) sessionManager.updateData(fromId, { promptMessageId: res.message_id });
  }
  return res;
}

/**
 * Prompts admin to type the Merchant Store Name
 */
async function handleAdminPromptInputStoreName(bot, chatId, targetId, messageId = null, fromId = null) {
  const draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null) || { targetId, rail: 'bundle' };
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  const defaultName = draft.merchantName || user.merchantName || (isStandalone ? 'VIP Standalone Store' : `${user.firstName || 'Merchant'}'s Store`);

  const sessionData = { targetId, rail: draft.rail, promptMessageId: messageId };
  sessionManager.setState(chatId, UserState.ADMIN_INPUT_STORE_NAME, sessionData);
  if (fromId) sessionManager.setState(fromId, UserState.ADMIN_INPUT_STORE_NAME, sessionData);

  const curBankInfo = draft.bakongId ? `• 🔴 <b>Bakong Account:</b> <code>${draft.bakongId}</code>\n` : '';

  const text =
    `${formatter.header('STORE / BRAND DISPLAY NAME', 'Merchant Identity Branding')}\n\n` +
    curBankInfo +
    `Please enter the custom <b>Store / Merchant Display Name</b> for this key:\n` +
    `• <b>Example:</b> <code>Kai Coffee Shop</code>, <code>Riki Electronic Store</code>\n\n` +
    `<i>👉 Type the store name, or tap Skip below to use default:</i>`;

  const backCb = draft.rail === 'aba'
    ? `admin_wstep_reinput_aba_${targetId}_${draft.rail}`
    : `admin_wstep_reinput_bakong_${targetId}_${draft.rail}`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(`⚡ Skip / Use Default (${defaultName}) ❯`, `admin_wstep_skip_name_${targetId}_${draft.rail}`, 'lightning', 'primary')
      ],
      [
        makeButton('« Back to Bank Setup', backCb, 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', isStandalone ? 'admin_wiz_start_prompt' : `admin_inspect_${targetId}`, 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
  if (res?.message_id) {
    sessionData.promptMessageId = res.message_id;
    sessionManager.updateData(chatId, { promptMessageId: res.message_id });
    if (fromId) sessionManager.updateData(fromId, { promptMessageId: res.message_id });
  }
  return res;
}

/**
 * Skip Bakong entry and use default
 */
async function handleAdminSkipBakong(bot, chatId, targetId, rail, messageId = null, fromId = null) {
  let draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null) || { targetId, rail };
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  draft.bakongId = draft.bakongId || user.bakongId || 'soksitchey1@aclb';

  adminWizardDrafts.set(String(chatId), draft);
  if (fromId) adminWizardDrafts.set(String(fromId), draft);
  sessionManager.resetSession(chatId);
  if (fromId) sessionManager.resetSession(fromId);

  if (rail === 'bundle') {
    return await handleAdminPromptInputAba(bot, chatId, targetId, 'USD', messageId, fromId);
  }
  return await handleAdminPromptInputStoreName(bot, chatId, targetId, messageId, fromId);
}

/**
 * Skip ABA link entry and use default
 */
async function handleAdminSkipAba(bot, chatId, targetId, rail, currency = 'USD', messageId = null, fromId = null) {
  let draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null) || { targetId, rail };
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  draft.usdLink = draft.usdLink || user.usdLink || DEFAULT_MERCHANT_LINK_USD;
  draft.khrLink = draft.khrLink || user.khrLink || DEFAULT_MERCHANT_LINK_KHR;

  adminWizardDrafts.set(String(chatId), draft);
  if (fromId) adminWizardDrafts.set(String(fromId), draft);
  sessionManager.resetSession(chatId);
  if (fromId) sessionManager.resetSession(fromId);

  return await handleAdminPromptInputStoreName(bot, chatId, targetId, messageId, fromId);
}

/**
 * Skip Store Name entry and use default
 */
async function handleAdminSkipStoreName(bot, chatId, targetId, rail, messageId = null, fromId = null) {
  let draft = adminWizardDrafts.get(String(chatId)) || (fromId ? adminWizardDrafts.get(String(fromId)) : null) || { targetId, rail };
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  draft.merchantName = draft.merchantName || user.merchantName || (isStandalone ? 'VIP Standalone Store' : `${user.firstName || 'Merchant'}'s Store`);

  adminWizardDrafts.set(String(chatId), draft);
  if (fromId) adminWizardDrafts.set(String(fromId), draft);
  sessionManager.resetSession(chatId);
  if (fromId) sessionManager.resetSession(fromId);

  return await handleAdminKeyWizardStep2(bot, chatId, targetId, rail, messageId);
}

/**
 * Handles text replies from Master Admin when in interactive admin wizard states
 */
async function handleAdminWizardTextInput(bot, msg) {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  const isMaster = isMasterAdmin(fromId);
  const isGroupAuth = isAuthorizedGroup(chatId);
  if (!isMaster && !isGroupAuth) return false;

  const text = (msg.text || '').trim();
  if (!text) return false;

  let session = sessionManager.getSession(chatId);
  if (!session?.state || !session.state.startsWith('ADMIN_INPUT_')) {
    session = sessionManager.getSession(fromId);
  }
  const state = session?.state;
  if (!state || !state.startsWith('ADMIN_INPUT_')) return false;

  const targetId = session.data?.targetId || 'standalone';
  const rail = session.data?.rail || 'bundle';
  const promptMessageId = session.data?.promptMessageId || null;
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');

  let draft = adminWizardDrafts.get(String(chatId)) || adminWizardDrafts.get(String(fromId));
  if (!draft) {
    draft = { targetId, rail, days: 30 };
  }
  draft.rail = rail;

  if (text === '/cancel' || text.toLowerCase() === 'cancel') {
    sessionManager.resetSession(chatId);
    sessionManager.resetSession(fromId);
    await safeSender.sendMessage(bot, chatId, '❌ <b>Wizard cancelled.</b>', { parse_mode: 'HTML' });
    return true;
  }

  // Delete typed message to keep group chat clean
  await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

  if (state === UserState.ADMIN_INPUT_BAKONG) {
    const parts = text.split(/\s+/);
    const bakongId = parts[0];
    const storeName = parts.slice(1).join(' ') || null;

    draft.bakongId = bakongId;
    if (storeName) draft.merchantName = storeName;

    if (!isStandalone) {
      const user = db.getUser(targetId) || { telegramId: targetId };
      user.bakongId = bakongId;
      user.merchantId = bakongId;
      if (storeName) user.merchantName = storeName;
      db.saveUser(user);
    }

    adminWizardDrafts.set(String(chatId), draft);
    adminWizardDrafts.set(String(fromId), draft);
    sessionManager.resetSession(chatId);
    sessionManager.resetSession(fromId);

    if (rail === 'bundle') {
      return await handleAdminPromptInputAba(bot, chatId, targetId, 'USD', promptMessageId, fromId);
    }

    if (storeName) {
      return await handleAdminKeyWizardStep2(bot, chatId, targetId, rail, promptMessageId);
    }

    return await handleAdminPromptInputStoreName(bot, chatId, targetId, promptMessageId, fromId);
  }

  if (state === UserState.ADMIN_INPUT_ABA_USD) {
    const parts = text.split(/\s+/);
    const link = parts[0];
    const storeName = parts.slice(1).join(' ') || null;

    draft.usdLink = link;
    if (storeName) draft.merchantName = storeName;

    if (!isStandalone) {
      const user = db.getUser(targetId) || { telegramId: targetId };
      user.usdLink = link;
      if (storeName) user.merchantName = storeName;
      db.saveUser(user);
    }

    adminWizardDrafts.set(String(chatId), draft);
    adminWizardDrafts.set(String(fromId), draft);
    sessionManager.resetSession(chatId);
    sessionManager.resetSession(fromId);

    if (storeName || draft.merchantName) {
      return await handleAdminKeyWizardStep2(bot, chatId, targetId, rail, promptMessageId);
    }

    return await handleAdminPromptInputStoreName(bot, chatId, targetId, promptMessageId, fromId);
  }

  if (state === UserState.ADMIN_INPUT_ABA_KHR) {
    const parts = text.split(/\s+/);
    const link = parts[0];

    draft.khrLink = link;
    if (!isStandalone) {
      const user = db.getUser(targetId) || { telegramId: targetId };
      user.khrLink = link;
      db.saveUser(user);
    }

    adminWizardDrafts.set(String(chatId), draft);
    adminWizardDrafts.set(String(fromId), draft);
    sessionManager.resetSession(chatId);
    sessionManager.resetSession(fromId);

    if (draft.merchantName) {
      return await handleAdminKeyWizardStep2(bot, chatId, targetId, rail, promptMessageId);
    }

    return await handleAdminPromptInputStoreName(bot, chatId, targetId, promptMessageId, fromId);
  }

  if (state === UserState.ADMIN_INPUT_STORE_NAME) {
    draft.merchantName = text;
    if (!isStandalone) {
      const user = db.getUser(targetId) || { telegramId: targetId };
      user.merchantName = text;
      db.saveUser(user);
    }

    adminWizardDrafts.set(String(chatId), draft);
    adminWizardDrafts.set(String(fromId), draft);
    sessionManager.resetSession(chatId);
    sessionManager.resetSession(fromId);

    return await handleAdminKeyWizardStep2(bot, chatId, targetId, rail, promptMessageId);
  }

  return false;
}

/**
 * Step 3: Select duration / validity in days
 */
async function handleAdminKeyWizardStep2(bot, chatId, targetId, rail, messageId = null) {
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? { firstName: 'Standalone Merchant' } : (db.getUser(targetId) || { telegramId: targetId, firstName: 'Merchant' });
  const draft = adminWizardDrafts.get(String(chatId)) || { targetId, rail };
  const name = isStandalone ? 'Standalone Key (No User Required)' : ([user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${targetId}`);

  let railName = 'Dual Suite (Bakong + ABA)';
  if (rail === 'bakong') railName = 'NBC Bakong National KHQR';
  if (rail === 'aba') railName = 'ABA PayWay Gateway';

  const curBakong = draft.bakongId || user.bakongId;
  const curStore = draft.merchantName || user.merchantName;

  const text =
    `⏳ <b>STEP 3: SET KEY VALIDITY DURATION (DAYS)</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    (isStandalone
      ? `• ⚡ <b>Mode:</b> <code>Standalone Key (No User Attached)</code>\n`
      : `• 👤 <b>Merchant:</b> <b>${formatter.escapeHtml(name)}</b> (<code>${targetId}</code>)\n`) +
    `• 🏦 <b>Chosen Rail:</b> <code>${railName}</code>\n` +
    (curBakong ? `• 🔴 <b>Bakong ID:</b> <code>${curBakong}</code>\n` : '') +
    (curStore ? `• 🏪 <b>Store Name:</b> <code>${formatter.escapeHtml(curStore)}</code>\n` : '') +
    `\n` +
    `<i>Choose how many days this API Key should remain active:</i>\n` +
    `<i>(You can extend or modify duration anytime with <code>/setdays</code>)</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('7 Days Trial ($0.50)', `admin_wstep_days_${targetId}_${rail}_7`, 'telemetry', 'primary'),
        makeButton('30 Days Standard ($2.50)', `admin_wstep_days_${targetId}_${rail}_30`, 'brand', 'primary')
      ],
      [
        makeButton('90 Days Quarter ($5.00)', `admin_wstep_days_${targetId}_${rail}_90`, 'telemetry', 'primary'),
        makeButton('180 Days Half-Year ($8.00)', `admin_wstep_days_${targetId}_${rail}_180`, 'brand', 'primary')
      ],
      [
        makeButton('365 Days Enterprise ($15.00)', `admin_wstep_days_${targetId}_${rail}_365`, 'crown', 'success'),
        makeButton('♾️ Permanent (9999 Days)', `admin_wstep_days_${targetId}_${rail}_9999`, 'verified', 'secondary')
      ],
      [
        makeButton('« Back to Bank Setup', `admin_wstep_reinput_${targetId}_${rail}`, 'arrow_left', 'secondary')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Step 4: Review and confirm key generation
 */
async function handleAdminKeyWizardStep3(bot, chatId, targetId, rail, days, messageId = null) {
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const user = isStandalone ? { firstName: 'Standalone Merchant' } : (db.getUser(targetId) || { telegramId: targetId, firstName: 'Merchant' });
  const draft = adminWizardDrafts.get(String(chatId)) || { targetId, rail };
  const name = isStandalone ? 'Standalone Key (No User Required)' : ([user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${targetId}`);

  let railName = 'Dual Suite (Bakong + ABA)';
  if (rail === 'bakong') railName = 'NBC Bakong National KHQR';
  if (rail === 'aba') railName = 'ABA PayWay Gateway';

  const durationDays = parseInt(days, 10) || 30;
  const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const curBakong = draft.bakongId || user.bakongId;
  const curUsd = draft.usdLink || user.usdLink;
  const curKhr = draft.khrLink || user.khrLink;
  const curStore = draft.merchantName || user.merchantName || (isStandalone ? 'VIP Standalone Store' : `${user.firstName || 'Merchant'}'s Store`);

  const bakongDisplay = rail === 'aba' ? '<i>N/A (ABA Only Rail)</i>' : (curBakong ? `<code>${curBakong}</code>` : '⚠️ <i>Default Standard</i>');
  const usdDisplay = rail === 'bakong' ? '<i>N/A (Bakong Only Rail)</i>' : (curUsd ? `<code>${curUsd.substring(0, 32)}...</code>` : '⚠️ <i>Default Standard</i>');
  const khrDisplay = rail === 'bakong' ? '<i>N/A (Bakong Only Rail)</i>' : (curKhr ? `<code>${curKhr.substring(0, 32)}...</code>` : '⚠️ <i>Default Standard</i>');

  const text =
    `📋 <b>STEP 4: REVIEW & CONFIRM KEY PROVISIONING</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    (isStandalone
      ? `• ⚡ <b>Mode:</b> <code>Standalone Key (No User Attached)</code>\n`
      : `• 👤 <b>Target Merchant:</b> <b>${formatter.escapeHtml(name)}</b> (ID: <code>${targetId}</code>)\n`) +
    `• 🏦 <b>Payment Rail:</b> <b>${railName}</b>\n` +
    `• ⏳ <b>Validity Duration:</b> <b>${durationDays} Days</b> (Expires: <code>${expiryDate}</code>)\n` +
    `• 🏪 <b>Store Name:</b> <code>${formatter.escapeHtml(curStore)}</code>\n` +
    (rail !== 'aba' ? `• 🔴 <b>Bakong Account:</b> ${bakongDisplay}\n` : '') +
    (rail !== 'bakong' ? `• 🔵 <b>ABA USD Link:</b> ${usdDisplay}\n• 🔵 <b>ABA KHR Link:</b> ${khrDisplay}\n` : '') +
    `\n` +
    `⚡ <b>When you tap confirm below:</b>\n` +
    `1. Live API Key & Webhook Secret will be generated with these exact merchant credentials.\n` +
    (isStandalone
      ? `2. Complete credentials receipt + Integration Guide PDF will be sent directly to you here in Telegram!\n3. You can copy the key and deliver it to anyone via WhatsApp, Telegram, or Web.`
      : `2. User subscription will be set to <code>[ ACTIVE ]</code> with auto-expiry.\n3. An official credentials card with documentation & PDF button will be delivered directly to the user's Telegram DM!`);

  const keyboardRows = [
    [
      makeButton(isStandalone ? '✅ Confirm & Generate Standalone Key ❯' : '✅ Confirm, Generate & Deliver Key ❯', `admin_wstep_confirm_${targetId}_${rail}_${days}`, 'keys', 'success')
    ],
    [
      makeButton('✏️ Edit Bank Setup', `admin_wstep_reinput_${targetId}_${rail}`, 'clearing', 'secondary'),
      makeButton('« Change Duration', `admin_wstep_todays_${targetId}_${rail}`, 'arrow_left', 'secondary')
    ],
    [
      makeButton('❌ Cancel', isStandalone ? 'admin_wiz_start_prompt' : `admin_inspect_${targetId}`, 'close', 'danger')
    ]
  ];

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboardRows }
  });
}

/**
 * Executes key creation, notifies user via DM, and reports back to Admin
 */
async function handleAdminKeyWizardExecute(bot, chatId, targetId, rail, days, messageId = null, customStoreName = null) {
  const isStandalone = targetId === 'standalone' || String(targetId).startsWith('standalone');
  const durationDays = parseInt(days, 10) || 365;
  const user = isStandalone ? {} : (db.getUser(targetId) || {});
  const draft = adminWizardDrafts.get(String(chatId)) || {};

  const bakongId = draft.bakongId || (!isStandalone ? user.bakongId : null);
  const usdLink = draft.usdLink || (!isStandalone ? user.usdLink : null);
  const khrLink = draft.khrLink || (!isStandalone ? user.khrLink : null);
  const storeName = customStoreName || draft.merchantName || user.merchantName || (isStandalone ? 'VIP Standalone Store' : null);

  const result = apiKeyService.configureAndIssueAdminKey(targetId, {
    rail,
    durationDays,
    bakongId,
    usdLink,
    khrLink,
    merchantName: storeName
  });

  const { key } = result;
  const targetUser = result.user || user;
  const name = isStandalone ? 'Standalone Merchant' : ([targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || `User ${targetId}`);

  let deliveryNote = '';
  if (!isStandalone) {
    try {
      const { issueUserCredentialsReceipt } = require('./wizard.handler');
      const userObj = {
        id: targetId,
        first_name: targetUser.firstName || 'Merchant',
        username: targetUser.username || ''
      };
      await issueUserCredentialsReceipt(bot, targetId, null, userObj, true);
      deliveryNote = '✅ Delivered to user\'s Telegram DM';
    } catch (err) {
      deliveryNote = `⚠️ DM delivery note: ${err.message}`;
    }
  } else {
    deliveryNote = '⚡ Standalone Key (Direct delivery to Admin)';
  }

  const text =
    `🎉 <b>${isStandalone ? 'STANDALONE PRODUCTION API KEY GENERATED!' : 'API KEY CONFIGURED & PROVISIONED!'}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    (isStandalone
      ? `• ⚡ <b>Type:</b> <code>Standalone Key (No User Attached)</code>\n`
      : `• 👤 <b>Merchant:</b> <b>${formatter.escapeHtml(name)}</b> (<code>${targetId}</code>)\n`) +
    `• 🏦 <b>Payment Rail:</b> <code>${key.provider}</code>\n` +
    `• ⏳ <b>Validity Duration:</b> <b>${durationDays} Days</b>\n` +
    `• 📅 <b>Expires At:</b> <code>${(key.expiresAt || '').slice(0, 10)}</code>\n` +
    `• 🏪 <b>Store Name:</b> <code>${formatter.escapeHtml(key.merchantName || 'Store')}</code>\n` +
    (key.bakongId ? `• 🔴 <b>Bakong ID:</b> <code>${key.bakongId}</code>\n` : '') +
    (key.usdLink ? `• 🔵 <b>ABA USD Link:</b> <code>${key.usdLink.substring(0, 32)}...</code>\n` : '') +
    (key.khrLink ? `• 🔵 <b>ABA KHR Link:</b> <code>${key.khrLink.substring(0, 32)}...</code>\n` : '') +
    `\n` +
    `🔑 <b>PRODUCTION API KEY (TAP TO COPY):</b>\n` +
    `<code>${key.apiKey}</code>\n\n` +
    `🛡️ <b>WEBHOOK SECRET:</b>\n` +
    `<code>${key.secret}</code>\n\n` +
    `📤 <b>Status:</b> ${deliveryNote}`;

  const keyboardRows = [
    [
      makeButton('🔑 Generate Another Key', 'admin_wiz_start_prompt', 'keys', 'primary')
    ]
  ];

  if (!isStandalone) {
    keyboardRows.push([
      makeButton('👤 View User Profile', `admin_inspect_${targetId}`, 'users', 'secondary'),
      makeButton('📤 Re-send Credentials', `admin_deliver_key_${targetId}`, 'announcement', 'secondary')
    ]);
  }
  keyboardRows.push([
    makeButton('« Back to Control Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')
  ]);

  const sentMsg = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboardRows }
  });

  // If standalone, also automatically send the Integration Guide PDF to the admin!
  if (isStandalone) {
    try {
      const pdfGenerator = require('../../services/pdf_generator.service');
      const pdfPath = await pdfGenerator.generateIntegrationPdf({
        telegramId: chatId,
        userName: key.merchantName || 'Standalone Merchant',
        baseUrl: process.env.RENDER_EXTERNAL_URL || 'https://paylinkapi-bot.onrender.com',
        user: {
          provider: key.provider,
          merchantName: key.merchantName,
          bakongId: key.bakongId,
          usdLink: key.usdLink,
          khrLink: key.khrLink
        },
        apiKeys: [key]
      });
      await bot.sendDocument(chatId, pdfPath, {
        caption: `📄 <b>STANDALONE INTEGRATION GUIDE (PDF)</b>\n\n` +
          `• <b>API Key:</b> <code>${key.apiKey}</code>\n` +
          `• <b>Store Name:</b> <code>${formatter.escapeHtml(key.merchantName || 'Store')}</code>\n` +
          `• <b>Rail:</b> <code>${key.provider}</code>\n` +
          (key.bakongId ? `• <b>Bakong ID:</b> <code>${key.bakongId}</code>\n` : '') +
          (key.usdLink ? `• <b>ABA Link:</b> <code>${key.usdLink.substring(0, 35)}...</code>\n` : '') +
          `• <b>Validity:</b> <code>${durationDays} Days</code>\n\n` +
          `<i>Attached is the complete Developer Guide with the new AI coding prompt, QR code installation command, and currency switching!</i>`,
        parse_mode: 'HTML'
      });
    } catch (pdfErr) {
      console.error('[Admin Standalone PDF Error]:', pdfErr.message);
    }
  }

  // Clear draft
  adminWizardDrafts.delete(String(chatId));

  return sentMsg;
}

/**
 * Quick days picker
 */
async function handleAdminPickDays(bot, chatId, targetId, messageId = null) {
  const user = db.getUser(targetId) || { telegramId: targetId };
  const keys = db.getUserApiKeys(targetId);
  const activeKey = keys && keys.length > 0 ? keys[0] : null;

  const text =
    `⏳ <b>SET VALIDITY DURATION (DAYS) FOR USER ${targetId}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `Current Plan: <code>${activeKey?.plan || 'None'}</code> (${activeKey?.durationDays || 'N/A'} Days)\n` +
    `Current Expiry: <code>${activeKey?.expiresAt ? activeKey.expiresAt.slice(0, 10) : 'N/A'}</code>\n\n` +
    `<i>Tap a button below to immediately set the key duration:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('7 Days ($0.50)', `admin_do_set_days_7_${targetId}`, 'telemetry', 'primary'),
        makeButton('14 Days (2 Weeks)', `admin_do_set_days_14_${targetId}`, 'telemetry', 'primary')
      ],
      [
        makeButton('30 Days ($2.50)', `admin_do_set_days_30_${targetId}`, 'brand', 'primary'),
        makeButton('60 Days (2 Months)', `admin_do_set_days_60_${targetId}`, 'brand', 'primary')
      ],
      [
        makeButton('90 Days ($5.00)', `admin_do_set_days_90_${targetId}`, 'brand', 'primary'),
        makeButton('180 Days ($8.00)', `admin_do_set_days_180_${targetId}`, 'brand', 'primary')
      ],
      [
        makeButton('365 Days 1-Year ($15.00)', `admin_do_set_days_365_${targetId}`, 'crown', 'success'),
        makeButton('♾️ Permanent (9999 Days)', `admin_do_set_days_9999_${targetId}`, 'verified', 'secondary')
      ],
      [
        makeButton('« Back to User Profile', `admin_inspect_${targetId}`, 'arrow_left', 'secondary')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Handles setting days from quick picker
 */
async function handleAdminDoSetDays(bot, chatId, targetId, days, messageId = null) {
  const result = apiKeyService.setKeyDuration(targetId, days);
  await bot.sendMessage(chatId, `✅ <b>Set key validity to ${days} days for user <code>${targetId}</code>! New Expiry: ${result.expiresAt.slice(0, 10)}</b>`, { parse_mode: 'HTML' });
  return await handleAdminUserLookup(bot, chatId, targetId, messageId);
}

/**
 * Quick rail switcher
 */
async function handleAdminPickRail(bot, chatId, targetId, messageId = null) {
  const user = db.getUser(targetId) || { telegramId: targetId };

  const text =
    `🔄 <b>SWITCH PAYMENT RAIL FOR USER ${targetId}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `Current Rail: <code>${user.provider || 'Not Configured'}</code>\n\n` +
    `<i>Tap a rail below to immediately switch this user and their active key:</i>\n\n` +
    `• <b>Bakong Only:</b> Only NBC Bakong KHQR. Clears ABA links.\n` +
    `• <b>ABA Only:</b> Only ABA PayWay Gateway. Clears Bakong ID.\n` +
    `• <b>Dual Suite:</b> Both Bakong KHQR & ABA PayWay dual clearing.`;

  const keyboard = {
    inline_keyboard: [
      [makeButton('🔴 Switch to Bakong Only', `admin_do_set_rail_bakong_${targetId}`, 'clearing', 'primary')],
      [makeButton('🔵 Switch to ABA Only', `admin_do_set_rail_aba_${targetId}`, 'brand', 'primary')],
      [makeButton('🟣 Switch to Dual Suite (Bakong + ABA)', `admin_do_set_rail_bundle_${targetId}`, 'crown', 'success')],
      [makeButton('« Back to User Profile', `admin_inspect_${targetId}`, 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Handles setting rail from quick picker
 */
async function handleAdminDoSetRail(bot, chatId, targetId, rail, messageId = null) {
  const result = apiKeyService.setMerchantRail(targetId, rail);
  await bot.sendMessage(chatId, `✅ <b>Switched user <code>${targetId}</code> to ${result.key.provider}!</b>`, { parse_mode: 'HTML' });
  return await handleAdminUserLookup(bot, chatId, targetId, messageId);
}

/**
 * Displays bank details setup commands for admin
 */
async function handleAdminEditBankPrompt(bot, chatId, targetId, messageId = null) {
  const user = db.getUser(targetId) || { telegramId: targetId };

  const text =
    `🏦 <b>SET BANK DETAILS FOR MERCHANT ${targetId}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>Current Store:</b> <code>${formatter.escapeHtml(user.merchantName || 'Not Set')}</code>\n` +
    `• <b>Bakong ID:</b> <code>${user.bakongId || 'Not Set'}</code>\n` +
    `• <b>ABA USD Link:</b> <code>${user.usdLink || 'Not Set'}</code>\n` +
    `• <b>ABA KHR Link:</b> <code>${user.khrLink || 'Not Set'}</code>\n` +
    `• <b>Phone:</b> <code>${user.phone || 'Not Set'}</code>\n\n` +
    `<b>Send any of these commands to set credentials:</b>\n\n` +
    `• <b>Set Bakong ID & Store Name:</b>\n` +
    `<code>/setbakong ${targetId} yourname@aclb StoreName</code>\n\n` +
    `• <b>Set ABA PayWay Links:</b>\n` +
    `<code>/setaba ${targetId} https://link.payway.com.kh/ABAPAYusd https://link.payway.com.kh/ABAPAYkhr</code>\n\n` +
    `• <b>Set Store Display Name:</b>\n` +
    `<code>/setstore ${targetId} My New Store</code>\n\n` +
    `• <b>Set Phone Number:</b>\n` +
    `<code>/setphone ${targetId} 012345678</code>`;

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to User Profile', `admin_inspect_${targetId}`, 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Re-delivers credentials receipt to user DM
 */
async function handleAdminDeliverKeyToUser(bot, chatId, targetId) {
  const user = db.getUser(targetId);
  if (!user) {
    return safeSender.sendMessage(bot, chatId, `⚠️ User <code>${targetId}</code> not found in database.`, { parse_mode: 'HTML' });
  }

  try {
    const { issueUserCredentialsReceipt } = require('./wizard.handler');
    const userObj = {
      id: targetId,
      first_name: user.firstName || 'Merchant',
      username: user.username || ''
    };
    await issueUserCredentialsReceipt(bot, targetId, null, userObj, true);
    return safeSender.sendMessage(bot, chatId, `✅ <b>Credentials receipt delivered to user <code>${targetId}</code> in private chat!</b>`, { parse_mode: 'HTML' });
  } catch (err) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Failed to deliver credentials to <code>${targetId}</code>:</b> ${err.message}`, { parse_mode: 'HTML' });
  }
}

/**
 * Command: /genkey <telegramId|standalone> [rail: bakong|aba|bundle] [days] [bakongId/abaLink/storeName]
 */
async function handleAdminGenKeyCommand(bot, chatId, args) {
  const parts = String(args || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return await handleAdminKeyWizardStartPrompt(bot, chatId);
  }

  const firstArg = parts[0].toLowerCase();
  if (['standalone', 'quick', 'new', 'bakong', 'aba', 'bundle'].includes(firstArg)) {
    if (parts.length === 1 && ['standalone', 'quick', 'new'].includes(firstArg)) {
      return await handleAdminKeyWizardStep1(bot, chatId, 'standalone');
    }

    let rail = 'bundle';
    let days = 365;
    let storeName = null;
    let bakongId = null;
    let usdLink = null;

    let remaining = [];
    if (['bakong', 'aba', 'bundle'].includes(firstArg)) {
      rail = firstArg;
      days = parseInt(parts[1], 10) || 365;
      remaining = parts.slice(2);
    } else {
      rail = ['bakong', 'aba', 'bundle'].includes((parts[1] || '').toLowerCase()) ? parts[1].toLowerCase() : 'bundle';
      days = parseInt(parts[2], 10) || 365;
      remaining = parts.slice(3);
    }

    for (const token of remaining) {
      if (token.includes('@') || /^\+?855\d+|^0\d{8,9}$/.test(token)) {
        bakongId = token;
      } else if (token.includes('payway.com.kh') || token.startsWith('http')) {
        usdLink = token;
      } else {
        storeName = storeName ? `${storeName} ${token}` : token;
      }
    }

    adminWizardDrafts.set(String(chatId), {
      targetId: 'standalone',
      rail,
      bakongId,
      usdLink,
      khrLink: null,
      merchantName: storeName,
      days
    });

    return await handleAdminKeyWizardExecute(bot, chatId, 'standalone', rail, days, null, storeName);
  }

  const targetId = parts[0].replace('@', '');
  if (parts.length === 1) {
    // If only targetId is given, open step 1 interactive wizard
    return await handleAdminKeyWizardStep1(bot, chatId, targetId);
  }

  const railArg = parts[1];
  const daysArg = parts[2];
  const normRail = ['bakong', 'aba', 'bundle'].includes((railArg || '').toLowerCase())
    ? railArg.toLowerCase()
    : 'bundle';
  const durationDays = parseInt(daysArg, 10) || 365;

  let bakongId = null;
  let usdLink = null;
  let storeName = null;

  const remaining = parts.slice(3);
  for (const token of remaining) {
    if (token.includes('@') || /^\+?855\d+|^0\d{8,9}$/.test(token)) {
      bakongId = token;
    } else if (token.includes('payway.com.kh') || token.startsWith('http')) {
      usdLink = token;
    } else {
      storeName = storeName ? `${storeName} ${token}` : token;
    }
  }

  adminWizardDrafts.set(String(chatId), {
    targetId,
    rail: normRail,
    bakongId,
    usdLink,
    khrLink: null,
    merchantName: storeName,
    days: durationDays
  });

  return await handleAdminKeyWizardExecute(bot, chatId, targetId, normRail, durationDays, null, storeName);
}

/**
 * Command: /setrail <telegramId> <bakong|aba|bundle>
 */
async function handleAdminSetRailCommand(bot, chatId, targetId, rail) {
  if (!targetId || !rail) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/setrail &lt;telegramId&gt; &lt;bakong|aba|bundle&gt;</code>`, { parse_mode: 'HTML' });
  }
  const normRail = String(rail).toLowerCase().trim();
  if (!['bakong', 'aba', 'bundle'].includes(normRail)) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Invalid rail: <code>${rail}</code>. Must be <code>bakong</code>, <code>aba</code>, or <code>bundle</code>.`, { parse_mode: 'HTML' });
  }
  const res = apiKeyService.setMerchantRail(targetId, normRail);
  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>Payment rail for user <code>${targetId}</code> switched to:</b> <code>${res.key.provider}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Command: /setdays <telegramId> <days>
 */
async function handleAdminSetDaysCommand(bot, chatId, targetId, days) {
  if (!targetId || !days) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/setdays &lt;telegramId&gt; &lt;numberOfDays&gt;</code> (e.g. <code>/setdays 123456789 30</code>)`, { parse_mode: 'HTML' });
  }
  const duration = parseInt(days, 10);
  if (!duration || duration <= 0) {
    return safeSender.sendMessage(bot, chatId, `⚠️ Invalid number of days: <code>${days}</code>`, { parse_mode: 'HTML' });
  }
  const res = apiKeyService.setKeyDuration(targetId, duration);
  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>Key duration for user <code>${targetId}</code> set to ${duration} days!</b>\n• New Expiry: <code>${res.expiresAt.slice(0, 10)}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Command: /setbakong <telegramId> <bakongAccountId> [storeName]
 */
async function handleAdminSetBakongCommand(bot, chatId, targetId, bakongId, storeName = null) {
  if (!targetId || !bakongId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/setbakong &lt;telegramId&gt; &lt;bakongAccountId&gt; [StoreName]</code>\nExample: <code>/setbakong 8665505824 merchant@aclb "My Store"</code>`, { parse_mode: 'HTML' });
  }
  const res = apiKeyService.setMerchantBankCredentials(targetId, {
    bakongId: String(bakongId).trim(),
    merchantName: storeName ? String(storeName).trim() : null
  });
  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>Bakong Account updated for user <code>${targetId}</code>:</b>\n• Bakong ID: <code>${res.user.bakongId}</code>\n` +
    (res.user.merchantName ? `• Store: <code>${formatter.escapeHtml(res.user.merchantName)}</code>` : ''),
    { parse_mode: 'HTML' }
  );
}

/**
 * Command: /setaba <telegramId> <usdLink> [khrLink]
 */
async function handleAdminSetAbaCommand(bot, chatId, targetId, usdLink, khrLink = null) {
  if (!targetId || !usdLink) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/setaba &lt;telegramId&gt; &lt;usdLink&gt; [khrLink]</code>\nExample: <code>/setaba 8665505824 https://link.payway.com.kh/ABAPAYusd https://link.payway.com.kh/ABAPAYkhr</code>`, { parse_mode: 'HTML' });
  }
  const res = apiKeyService.setMerchantBankCredentials(targetId, {
    usdLink: String(usdLink).trim(),
    khrLink: khrLink ? String(khrLink).trim() : null
  });
  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>ABA PayWay Links updated for user <code>${targetId}</code>:</b>\n• USD Link: <code>${res.user.usdLink}</code>\n• KHR Link: <code>${res.user.khrLink || 'None'}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Command: /setstore <telegramId> <storeName>
 */
async function handleAdminSetStoreCommand(bot, chatId, targetId, storeName) {
  if (!targetId || !storeName) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/setstore &lt;telegramId&gt; &lt;storeName&gt;</code>`, { parse_mode: 'HTML' });
  }
  const res = apiKeyService.setMerchantBankCredentials(targetId, {
    merchantName: String(storeName).trim()
  });
  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>Store Name updated for user <code>${targetId}</code>:</b> <code>${formatter.escapeHtml(res.user.merchantName)}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Sends a direct message from the bot to a specific user
 */
async function handleAdminDm(bot, chatId, targetId, dmText) {
  if (!targetId || !dmText) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/dm &lt;telegramId&gt; &lt;your message&gt;</code>`, { parse_mode: 'HTML' });
  }

  const cleanId = String(targetId).replace('@', '').trim();
  const allUsers = db.getAllUsers();
  const targetUser = allUsers.find(u => String(u.telegramId) === cleanId || (u.username && u.username.toLowerCase() === cleanId.toLowerCase()));
  const resolvedId = targetUser ? String(targetUser.telegramId) : cleanId;

  try {
    await bot.sendMessage(
      resolvedId,
      `📩 <b>MESSAGE FROM SYSTEM ADMINISTRATOR:</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n${dmText}\n\n<i>💬 Reply to support: @kaixite</i>`,
      { parse_mode: 'HTML' }
    );
    return safeSender.sendMessage(bot, chatId, `✅ <b>Message delivered successfully to user <code>${resolvedId}</code>.</b>`, { parse_mode: 'HTML' });
  } catch (err) {
    const isChatNotFound = err.message && err.message.includes('chat not found');
    const isBlocked = err.message && err.message.includes('blocked');

    // Suggest closest match if ID was not found in DB
    let suggestion = '';
    if (!targetUser) {
      const closeMatches = allUsers.filter(u => {
        const uid = String(u.telegramId);
        return uid.startsWith(cleanId.substring(0, 4)) || (cleanId.length >= 6 && uid.includes(cleanId.substring(0, 5)));
      });
      if (closeMatches.length > 0) {
        suggestion = `\n\n🔍 <b>Did you mean:</b> <code>/dm ${closeMatches[0].telegramId} ${dmText}</code> (${formatter.escapeHtml([closeMatches[0].firstName, closeMatches[0].lastName].filter(Boolean).join(' '))})`;
      }
    }

    let contactTips = '';
    if (targetUser && targetUser.username) {
      contactTips = `\n\n👉 <b>Direct Profile:</b> <a href="https://t.me/${targetUser.username}">https://t.me/${targetUser.username}</a>`;
    } else {
      contactTips = `\n\n👉 <b>Mobile Direct Profile:</b> <a href="tg://user?id=${resolvedId}">👤 Open Profile (Tap on Phone)</a>\n<i>(💡 Note for Telegram Desktop: Click the user's forwarded message in this group to open their profile directly)</i>`;
    }

    const causeText = isChatNotFound
      ? `User <code>${resolvedId}</code> has not started a private chat with the bot yet. Telegram strictly requires users to press START in private chat before a bot can message them.`
      : (isBlocked ? `User <code>${resolvedId}</code> has blocked or paused the bot.` : err.message);

    return safeSender.sendMessage(
      bot,
      chatId,
      `⚠️ <b>Failed to send DM to <code>${resolvedId}</code>:</b>\n• <i>${causeText}</i>${suggestion}${contactTips}`,
      { parse_mode: 'HTML', disable_web_page_preview: true, link_preview_options: { is_disabled: true } }
    );
  }
}

/**
 * Converts any Telegram Chat ID / User ID into direct clickable profile links
 */
async function handleAdminProfileLink(bot, chatId, targetId) {
  if (!targetId) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/link &lt;telegramId&gt;</code> (or <code>/pf &lt;telegramId&gt;</code>)`, { parse_mode: 'HTML' });
  }

  const cleanId = String(targetId).replace('@', '').trim();
  const allUsers = db.getAllUsers();
  const user = allUsers.find(u => String(u.telegramId) === cleanId || (u.username && u.username.toLowerCase() === cleanId.toLowerCase()));
  const actualId = user ? String(user.telegramId) : cleanId;
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : `User ${actualId}`;

  let linkSection = '';
  const inlineButtons = [];

  if (user && user.username) {
    linkSection =
      `• <b>Public Username:</b> <a href="https://t.me/${user.username}">@${user.username}</a>\n` +
      `• <b>Universal Profile Link:</b> <a href="https://t.me/${user.username}">https://t.me/${user.username}</a>\n\n` +
      `<i>Works 100% on Telegram Desktop, Mobile, and Web!</i>`;
    inlineButtons.push([{ text: `💬 Open @${user.username} Profile`, url: `https://t.me/${user.username}` }]);
  } else {
    linkSection =
      `• <b>Username:</b> <i>No @username set by user</i>\n` +
      `• <b>Mobile App Link:</b> <a href="tg://user?id=${actualId}">👤 Open Profile (Tap on Phone)</a>\n\n` +
      `💡 <b>How to view on Telegram Desktop:</b>\n` +
      `Because this user has no public @username, Telegram Desktop cannot resolve numeric ID deep links for strangers.\n` +
      `👉 <b>Solution:</b> Click on their name in any message forwarded from them (such as their /start alert above), or open on Telegram Mobile!`;
  }

  const text =
    `🔗 <b>TELEGRAM PROFILE DIRECT LINKS:</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>Target User:</b> <a href="tg://user?id=${actualId}"><b>${formatter.escapeHtml(name)}</b></a>\n` +
    `• <b>Telegram ID:</b> <code>${actualId}</code>\n` +
    linkSection;

  const reply_markup = inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined;

  return await safeSender.sendMessage(bot, chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
    reply_markup
  });
}

/**
 * Unbans IP from rate limiter
 */
async function handleAdminUnbanIp(bot, chatId, ip) {
  if (!ip) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/unbanip &lt;ip_address&gt;</code>`, { parse_mode: 'HTML' });
  }
  if (rateLimiter) {
    rateLimiter.unbanIp(ip.trim());
  }
  return safeSender.sendMessage(bot, chatId, `✅ <b>IP <code>${ip}</code> unbanned from firewall.</b>`, { parse_mode: 'HTML' });
}

/**
 * Broadcasts an announcement to all registered users from the admin group
 */
async function handleAdminBroadcast(bot, msg, broadcastText) {
  const chatId = msg.chat.id;
  if (!broadcastText) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/broadcast Your message text here</code>`, { parse_mode: 'HTML' });
  }

  const users = db.getAllUsers();
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

  return safeSender.sendMessage(
    bot,
    chatId,
    `✅ <b>Broadcast Completed!</b>\n• Sent successfully: <code>${sent}</code>\n• Failed/Blocked: <code>${failed}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Renders Master Admin Commands Cheat Sheet
 */
async function renderAdminCommandsList(bot, chatId, messageId = null) {
  const text =
    `📖 <b>MASTER ADMIN COMMANDS CHEAT-SHEET</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
    `👑 <b>GENERAL OPERATIONS:</b>\n` +
    `• <code>/admin</code> - Open Control Center Dashboard\n` +
    `• <code>/stats</code> - Quick live telemetry & metrics\n` +
    `• <code>/maint [on|off]</code> - Toggle Maintenance Mode\n` +
    `• <code>/backup</code> - Download full database JSON backup\n\n` +
    `👥 <b>MERCHANT MANAGEMENT:</b>\n` +
    `• <code>/users</code> - List recent merchants\n` +
    `• <code>/user &lt;id|username&gt;</code> - Inspect detailed profile\n` +
    `• <code>/activate &lt;id&gt; [days]</code> - Manually activate subscription\n` +
    `• <code>/deactivate &lt;id&gt;</code> - Deactivate subscription\n` +
    `• <code>/ban &lt;id&gt;</code> | <code>/unban &lt;id&gt;</code> - Ban / Unban user\n` +
    `• <code>/dm &lt;id&gt; &lt;text&gt;</code> - Send direct message to user\n` +
    `• <code>/link &lt;id&gt;</code> - Convert Chat ID to direct profile links\n\n` +
    `🔑 <b>API KEYS & TRANSACTIONS:</b>\n` +
    `• <code>/keys</code> - List active API keys\n` +
    `• <code>/addkey &lt;id&gt; [StoreName]</code> - Provision production key\n` +
    `• <code>/revokekey &lt;keyId&gt;</code> - Revoke & delete API key\n` +
    `• <code>/orders</code> - List payment transactions\n` +
    `• <code>/markpaid &lt;tranId&gt;</code> - Manually settle payment\n\n` +
    `🛡️ <b>SECURITY & ANNOUNCEMENTS:</b>\n` +
    `• <code>/unbanip &lt;ip&gt;</code> - Unban IP from firewall\n` +
    `• <code>/broadcast &lt;text&gt;</code> - Send message to all users\n` +
    `• <code>/adminhelp</code> - Show this cheat-sheet\n\n` +
    `🔑 <b>ADMIN KEY CONFIGURATION & RAILS:</b>\n` +
    `• <code>/genkey &lt;id&gt; [rail] [days] [store]</code> - Generate/configure key & rail\n` +
    `• <code>/setrail &lt;id&gt; &lt;bakong|aba|bundle&gt;</code> - Switch merchant payment rail\n` +
    `• <code>/setdays &lt;id&gt; &lt;days&gt;</code> - Set key validity duration in days\n` +
    `• <code>/setbakong &lt;id&gt; &lt;bakongId&gt; [store]</code> - Set merchant Bakong Account ID\n` +
    `• <code>/setaba &lt;id&gt; &lt;usdLink&gt; [khrLink]</code> - Set merchant ABA PayWay links\n` +
    `• <code>/setstore &lt;id&gt; &lt;storeName&gt;</code> - Set merchant store display name\n` +
    `• <code>/deliverkey &lt;id&gt;</code> - Re-deliver credentials receipt to user DM`;

  const keyboard = {
    inline_keyboard: [
      [makeButton('« Back to Master Admin Hub', 'admin_refresh_stats', 'arrow_left', 'secondary')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

module.exports = {
  MASTER_ADMIN_ID,
  ADMIN_CHAT_ID,
  isMasterAdmin,
  bindAdminGroup,
  getAdminChatId,
  isAuthorizedGroup,
  isAdminChat,
  getTelemetryStats,
  renderAdminDashboard,
  handleAdminUsersList,
  handleAdminKeysList,
  handleAdminOrdersList,
  handleAdminFirewall,
  handleAdminToggleMaintenance,
  handleAdminExportBackup,
  handleAdminManualActivate,
  handleAdminManualDeactivate,
  handleAdminBan,
  handleAdminUnban,
  handleAdminAddKey,
  handleAdminRevokeKey,
  handleAdminExpireKey,
  handleAdminReactivateKey,
  handleAdminMarkPaid,
  handleAdminUserLookup,
  handleAdminProfileLink,
  handleAdminDm,
  handleAdminUnbanIp,
  handleAdminBroadcast,
  renderAdminCommandsList,
  // New Admin Key Generation & Configuration Wizard
  handleAdminKeyWizardStartPrompt,
  handleAdminKeyWizardStep1,
  handleAdminKeyWizardStartRailInput,
  handleAdminKeyWizardStepBank,
  handleAdminPromptInputBakong,
  handleAdminPromptInputAba,
  handleAdminPromptInputStoreName,
  handleAdminSkipBakong,
  handleAdminSkipAba,
  handleAdminSkipStoreName,
  handleAdminWizardTextInput,
  handleAdminKeyWizardStep2,
  handleAdminKeyWizardStep3,
  handleAdminKeyWizardExecute,
  handleAdminPickDays,
  handleAdminDoSetDays,
  handleAdminPickRail,
  handleAdminDoSetRail,
  handleAdminEditBankPrompt,
  handleAdminDeliverKeyToUser,
  handleAdminGenKeyCommand,
  handleAdminSetRailCommand,
  handleAdminSetDaysCommand,
  handleAdminSetBakongCommand,
  handleAdminSetAbaCommand,
  handleAdminSetStoreCommand
};

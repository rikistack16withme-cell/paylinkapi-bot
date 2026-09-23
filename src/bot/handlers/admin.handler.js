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

const MASTER_ADMIN_ID = String(config.masterAdminId || process.env.MASTER_ADMIN_ID || '7283817695');
const ADMIN_CHAT_ID = String(config.adminChatId || process.env.ADMIN_CHAT_ID || '-5393647415');

/**
 * Strict Master Admin authorization: ONLY user 7283817695 can control the bot
 */
function isMasterAdmin(fromId) {
  return String(fromId) === MASTER_ADMIN_ID;
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
  return isAuthorizedGroup(cId) || fId === MASTER_ADMIN_ID;
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
        makeButton('👥 Merchants List', 'admin_view_users', 'users', 'primary'),
        makeButton('🔑 API Keys List', 'admin_view_keys', 'keys', 'primary')
      ],
      [
        makeButton('💳 Transactions', 'admin_view_orders', 'orders', 'primary'),
        makeButton('🛡️ DDoS Firewall', 'admin_view_firewall', 'security', 'primary')
      ],
      [
        makeButton(stats.isMaint ? '🟢 Disable Maintenance' : '🔴 Enable Maintenance', 'admin_toggle_maint', 'refresh', stats.isMaint ? 'success' : 'danger'),
        makeButton('💾 Export DB Backup', 'admin_export_backup', 'docs', 'primary')
      ],
      [
        makeButton('📢 Broadcast Help', 'admin_broadcast_help', 'announcement', 'primary'),
        makeButton('🔄 Refresh Telemetry', 'admin_refresh_stats', 'refresh', 'success')
      ],
      [
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
        `• <b>Profile Link:</b> <a href="tg://user?id=${u.telegramId}">👤 View Profile</a>\n` +
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
 * Looks up detailed profile of a user
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
  const userOrders = db.getUserOrders(user.telegramId);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Telegram User';
  const userMention = `<a href="tg://user?id=${user.telegramId}">${formatter.escapeHtml(fullName)}</a>`;
  const usernameDisplay = user.username
    ? `<a href="https://t.me/${user.username}">@${user.username}</a>`
    : `<i>No @username set</i>`;

  const isBanned = user.status === 'BANNED';
  const isSub = user.subscription?.status === 'ACTIVE' || user.status === 'ACTIVE';
  const badge = isBanned ? '🚫 BANNED' : (isSub ? '✅ ACTIVE' : '⏳ PENDING');

  const text =
    `👤 <b>USER PROFILE: ${userMention}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>Full Name:</b> ${formatter.escapeHtml(fullName)}\n` +
    `• <b>Username:</b> ${usernameDisplay}\n` +
    `• <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
    `• <b>Direct Profile:</b> <a href="tg://user?id=${user.telegramId}">👤 View Profile</a>\n` +
    `• <b>Store Name:</b> <code>${formatter.escapeHtml(user.merchantName || 'Not Set')}</code>\n` +
    `• <b>Account Status:</b> <code>${badge}</code>\n` +
    `• <b>Subscription:</b> <code>${user.subscription?.status || 'INACTIVE'}</code> (Plan: <code>${user.subscription?.plan || 'None'}</code>)\n` +
    `• <b>Registered Date:</b> <code>${user.createdAt || 'N/A'}</code>\n` +
    `• <b>API Keys Count:</b> <code>${userKeys.length}</code>\n` +
    `• <b>Orders Count:</b> <code>${userOrders.length}</code>\n\n` +
    `<b>Commands Quick-Tap:</b>\n` +
    `• <code>/dm ${user.telegramId} Hello</code>\n` +
    `• <code>/activate ${user.telegramId} 365</code>\n` +
    `• <code>/addkey ${user.telegramId} StoreName</code>\n` +
    `• <code>/${isBanned ? 'unban' : 'ban'} ${user.telegramId}</code>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('⚡ Activate 1 Year', `admin_act_1y_${user.telegramId}`, 'success', 'primary'),
        makeButton('🔑 Issue API Key', `admin_gen_key_${user.telegramId}`, 'keys', 'primary')
      ],
      [
        makeButton(isBanned ? '✅ Unban User' : '🚫 Ban User', `admin_toggle_ban_${user.telegramId}`, 'refresh', isBanned ? 'success' : 'danger')
      ],
      [
        makeButton('« Back to Members List', 'admin_view_users', 'arrow_left', 'secondary')
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
 * Sends a direct message from the bot to a specific user
 */
async function handleAdminDm(bot, chatId, targetId, dmText) {
  if (!targetId || !dmText) {
    return safeSender.sendMessage(bot, chatId, `⚠️ <b>Usage:</b> <code>/dm &lt;telegramId&gt; &lt;your message&gt;</code>`, { parse_mode: 'HTML' });
  }

  try {
    await bot.sendMessage(
      targetId,
      `📩 <b>MESSAGE FROM SYSTEM ADMINISTRATOR:</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n${dmText}\n\n<i>💬 Reply to support: @kaixite</i>`,
      { parse_mode: 'HTML' }
    );
    return safeSender.sendMessage(bot, chatId, `✅ <b>Message delivered successfully to user ${targetId}.</b>`, { parse_mode: 'HTML' });
  } catch (err) {
    const isChatNotFound = err.message && err.message.includes('chat not found');
    const tip = isChatNotFound
      ? `\n\n💡 <i>User has not started private chat with the bot yet.</i>\n` +
        `👉 <b>Direct Profile Links to Contact User:</b>\n` +
        `• 1️⃣ <a href="tg://user?id=${targetId}">👤 Open Profile (Telegram App)</a>\n` +
        `• 2️⃣ <a href="tg://openmessage?user_id=${targetId}">💬 Open Direct Chat (Telegram App)</a>`
      : '';
    return safeSender.sendMessage(
      bot,
      chatId,
      `⚠️ <b>Failed to send DM to <code>${targetId}</code>:</b> ${err.message}${tip}`,
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
  const user = db.getUser(cleanId);
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : `User ${cleanId}`;
  const usernamePart = user && user.username ? `\n• <b>Public Username:</b> <a href="https://t.me/${user.username}">@${user.username}</a>` : '';

  const text =
    `🔗 <b>TELEGRAM PROFILE DIRECT LINKS:</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>Target User:</b> <a href="tg://user?id=${cleanId}"><b>${formatter.escapeHtml(name)}</b></a>\n` +
    `• <b>Telegram ID:</b> <code>${cleanId}</code>` +
    usernamePart + `\n\n` +
    `👇 <b>CLICK BELOW TO OPEN PROFILE:</b>\n` +
    `1️⃣ <a href="tg://user?id=${cleanId}">👤 <b>Open User Profile (Telegram App)</b></a>\n` +
    `2️⃣ <a href="tg://openmessage?user_id=${cleanId}">💬 <b>Open Direct Chat (Telegram App)</b></a>\n\n` +
    `<i>Tap the blue links above on your mobile phone or desktop to view this user's profile directly.</i>`;

  return await safeSender.sendMessage(bot, chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true }
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
    `• <code>/adminhelp</code> - Show this cheat-sheet`;

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
  handleAdminMarkPaid,
  handleAdminUserLookup,
  handleAdminProfileLink,
  handleAdminDm,
  handleAdminUnbanIp,
  handleAdminBroadcast,
  renderAdminCommandsList
};

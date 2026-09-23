const TelegramBot = require('node-telegram-bot-api');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const middleware = require('./src/bot/middleware');

// Handlers
const { handleStart, renderWelcome } = require('./src/bot/handlers/start.handler');
const { handleRegister } = require('./src/bot/handlers/registration.handler');
const { renderDashboard } = require('./src/bot/handlers/dashboard.handler');
const { handleGetPaymentApi, handleSelectProvider } = require('./src/bot/handlers/provider.handler');
const {
  startProviderWizard,
  handleWizardSandboxQuickFill,
  handleWizardTextInput,
  handleConfirmSubmit,
  handleCancelWizard,
  handleToggleLanguageWizard,
  handleSelectRegistrationPlan,
  handleExecuteSubPayment,
  handleBackToPlans,
  stopSubscriptionAutoChecker,
  handleConfirmRegistrationPayment,
  handleInstantActivate
} = require('./src/bot/handlers/wizard.handler');
const { handlePricing } = require('./src/bot/handlers/pricing.handler');
const { handleOrders } = require('./src/bot/handlers/orders.handler');
const { handleApiKeys } = require('./src/bot/handlers/apikeys.handler');
const { handleDocumentationHub, handleDocSubPage, handleDownloadPdf } = require('./src/bot/handlers/documentation.handler');
const { handleSupport, handleHelpCenter } = require('./src/bot/handlers/support.handler');
const { handleConnectionViewer, renderConnectionViewer } = require('./src/bot/handlers/connection_viewer.handler');
const {
  handleSettings,
  handleToggleLanguage,
  handleToggleNotifications,
  handleAccountInfo
} = require('./src/bot/handlers/settings.handler');
const {
  handleStartLivePayTest,
  handleCustomAmountPrompt,
  handleCustomAmountInput,
  handleExecuteLivePay,
  handleCheckLivePay,
  stopTestAutoChecker
} = require('./src/bot/handlers/live_payment.handler');
const sessionManager = require('./src/bot/states/user.session');
const { UserState } = require('./src/bot/states/state.machine');
const userService = require('./src/services/user.service');
const formatter = require('./src/utils/formatter');
const safeSender = require('./src/utils/safe_sender');
const { startApiServer } = require('./src/api/server');
const tunnelService = require('./src/services/tunnel.service');
const adminHandler = require('./src/bot/handlers/admin.handler');
const db = require('./src/database');

if (!config.bot.token) {
  logger.error('TELEGRAM_BOT_TOKEN is missing in .env! Please configure it before starting.');
  process.exit(1);
}

// Start REST API Server (ABA & Bakong Payment Gateway)
const apiPort = process.env.PORT || process.env.API_PORT || 5000;
let apiServer = null;
try {
  apiServer = startApiServer(apiPort);
  tunnelService.startTunnel(apiPort);
} catch (err) {
  logger.warn('Could not bind API server:', err.message);
}

// Start Bakong Bypass Microservice (Port 3000)
const { fork } = require('node:child_process');
const path = require('node:path');
let bakongBypassProcess = null;
try {
  const bypassScript = path.join(__dirname, 'Bakong Bypass', 'server.js');
  bakongBypassProcess = fork(bypassScript, [], {
    env: { ...process.env, PORT: process.env.BAKONG_BYPASS_PORT || '3000' },
    stdio: 'ignore'
  });
  logger.info('✓ Bakong Bypass microservice started on http://localhost:3000');
} catch (err) {
  logger.warn('Could not spawn Bakong Bypass:', err.message);
}

process.on('exit', () => {
  if (bakongBypassProcess) {
    try { bakongBypassProcess.kill(); } catch (e) {}
  }
});

logger.info(`Starting ${config.brand.name} Telegram Bot (Phase 2 Connected)...`);
const bot = new TelegramBot(config.bot.token, { polling: true });

// Error handling for Telegram Polling
bot.on('polling_error', (error) => {
  logger.error('Telegram Polling Error:', error.message);
});

// Configure bot command list
bot.setMyCommands([
  { command: 'start', description: 'Open Payment API Portal & Dashboard' },
  { command: 'portal', description: '🌐 Drop Payment API Registration Portal URL' },
  { command: 'connect', description: '📖 How to connect API key (របៀបតភ្ជាប់ API)' },
  { command: 'khmer', description: '🇰🇭 ប្តូរជាភាសាខ្មែរ (Switch to Khmer)' },
  { command: 'english', description: '🇬🇧 Switch to English' },
  { command: 'lang', description: '🌐 Toggle language (ប្តូរភាសា)' },
  { command: 'getemoji', description: 'Inspect custom emoji IDs sent from Telegram Premium' }
]).catch((err) => {
  logger.warn('Could not register bot commands with Telegram:', err.message);
});

// 1. Text Messages & Commands
bot.on('message', async (msg) => {
  try {
    if (!msg.from) return;
    userService.trackUser(msg.from);
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id;
    const chatType = msg.chat?.type;
    const isGroup = chatType === 'group' || chatType === 'supergroup' || chatType === 'channel';

    // Normalize command if sent in group with @bot mention (e.g. /admin@PaylinkApi_bot -> /admin)
    const cmdText = text.replace(/^(\/\w+)@\w+/, '$1');

    // Admin & Master Authorization Check (Strictly locked to Master Admin 7283817695)
    const isMaster = adminHandler.isMasterAdmin(msg.from.id);

    // If Master Admin operates in ANY group chat, automatically bind & authorize this group!
    if (isGroup && isMaster) {
      adminHandler.bindAdminGroup(chatId, msg.chat?.title);
    }

    // Strict Group Lockdown:
    // If it is a group and NOT authorized (and sender is not master admin):
    if (isGroup && !isMaster && !adminHandler.isAuthorizedGroup(chatId)) {
      logger.warn(`[UNAUTHORIZED GROUP] Non-admin user ${msg.from.id} attempted to trigger bot in group ${chatId}. Silently leaving group.`);
      try {
        await bot.leaveChat(chatId);
      } catch (_) {}
      return;
    }

    // If bot was added to a group as a new chat member:
    if (msg.new_chat_members && msg.new_chat_members.some(u => u.is_bot)) {
      if (isMaster) {
        adminHandler.bindAdminGroup(chatId, msg.chat?.title);
        return await bot.sendMessage(
          chatId,
          `🛡️ <b>PayLinkAPI Master Admin Gateway Connected</b>\n\n` +
          `Master Administrator (<code>7283817695</code>) recognized.\n` +
          `Type <code>/admin</code> to open the Master Control Dashboard.`,
          { parse_mode: 'HTML' }
        );
      } else if (!adminHandler.isAuthorizedGroup(chatId)) {
        try {
          await bot.leaveChat(chatId);
        } catch (_) {}
        return;
      }
    }

    // Custom Emoji Inspector: detect if user sent any Telegram Premium custom emoji
    if (msg.entities && msg.entities.some(e => e.type === 'custom_emoji')) {
      const customEmojiEntities = msg.entities.filter(e => e.type === 'custom_emoji');
      let response = `✨ <b>Telegram Custom Emoji Inspector</b>\n\n`;
      customEmojiEntities.forEach((entity, idx) => {
        const emojiChar = msg.text.substring(entity.offset, entity.offset + entity.length);
        response += `<b>Emoji #${idx + 1}:</b>\n` +
          `• Character: ${emojiChar}\n` +
          `• <b>Emoji ID:</b> <code>${entity.custom_emoji_id}</code>\n` +
          `• <b>HTML Tag:</b> <code>&lt;tg-emoji emoji-id="${entity.custom_emoji_id}"&gt;${emojiChar}&lt;/tg-emoji&gt;</code>\n\n`;
      });
      response += `<i>You can paste this Emoji ID directly into <code>src/config/emojis.js</code>!</i>`;

      return await bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    }

    // /getemoji info command
    if (cmdText.startsWith('/getemoji')) {
      return await bot.sendMessage(
        chatId,
        `💎 <b>Telegram Premium Custom Emoji Guide:</b>\n\n` +
        `Send me any custom animated emoji from your Telegram Premium sticker/emoji pack!\n` +
        `I will instantly extract its <code>custom_emoji_id</code> and HTML tag so you can use it in your bot boards.`,
        { parse_mode: 'HTML' }
      );
    }

    // 1. Suspension check for banned users
    if (userService.isBanned(msg.from.id) && !isMaster) {
      return await bot.sendMessage(
        chatId,
        `🚫 <b>YOUR ACCOUNT HAS BEEN SUSPENDED.</b>\n` +
        `Access to PaylinkApi has been restricted by system administrator.\n\n` +
        `💬 Contact support: @kaixite`,
        { parse_mode: 'HTML' }
      );
    }

    // 2. Global Maintenance Mode check
    const isMaintenance = db.getSetting('maintenance_mode', false);
    if (isMaintenance && !isMaster) {
      return await bot.sendMessage(
        chatId,
        `🔧 <b>SYSTEM UNDER MAINTENANCE • ប្រព័ន្ធកំពុងថែទាំ</b>\n\n` +
        `Our engineers are currently upgrading the PaylinkApi infrastructure.\n` +
        `The service will be back online shortly.\n\n` +
        `💬 Urgent support: @kaixite`,
        { parse_mode: 'HTML' }
      );
    }

    if (cmdText.startsWith('/admin') || cmdText.startsWith('/stats') || cmdText.startsWith('/status')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) {
        return await bot.sendMessage(
          chatId,
          `⛔ <b>ACCESS DENIED • កំហុសសិទ្ធិអនុញ្ញាត</b>\n\n` +
          `Only Master Admin (ID: <code>7283817695</code>) is authorized to control this system.\n` +
          `មានតែម្ចាស់ Admin ម្នាក់គត់ (ID: <code>7283817695</code>) ដែលមានសិទ្ធិបញ្ជាប្រព័ន្ធនេះ។`,
          { parse_mode: 'HTML' }
        );
      }
      return await adminHandler.renderAdminDashboard(bot, chatId);
    }

    if (cmdText.startsWith('/adminhelp') || cmdText.startsWith('/help_admin')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      return await adminHandler.renderAdminCommandsList(bot, chatId);
    }

    if (cmdText.startsWith('/activate')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const parts = cmdText.split(/\s+/).slice(1);
      const targetId = parts[0];
      const days = parts[1] || 365;
      const plan = parts.slice(2).join(' ') || 'VIP Pro License';
      return await adminHandler.handleAdminManualActivate(bot, chatId, targetId, plan, days);
    }

    if (cmdText.startsWith('/deactivate')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const targetId = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminManualDeactivate(bot, chatId, targetId);
    }

    if (cmdText.startsWith('/ban')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const targetId = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminBan(bot, chatId, targetId);
    }

    if (cmdText.startsWith('/unbanip')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const ip = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminUnbanIp(bot, chatId, ip);
    }

    if (cmdText.startsWith('/unban')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const targetId = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminUnban(bot, chatId, targetId);
    }

    if (cmdText.startsWith('/addkey')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const parts = cmdText.split(/\s+/).slice(1);
      const targetId = parts[0];
      const storeName = parts.slice(1).join(' ') || 'Merchant Store';
      return await adminHandler.handleAdminAddKey(bot, chatId, targetId, storeName);
    }

    if (cmdText.startsWith('/revokekey')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const keyId = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminRevokeKey(bot, chatId, keyId);
    }

    if (cmdText.startsWith('/markpaid')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const tranId = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminMarkPaid(bot, chatId, tranId);
    }

    if (cmdText.startsWith('/user')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const queryStr = cmdText.split(/\s+/)[1];
      return await adminHandler.handleAdminUserLookup(bot, chatId, queryStr);
    }

    if (cmdText.startsWith('/dm')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const parts = cmdText.split(/\s+/).slice(1);
      const targetId = parts[0];
      const dmMsg = parts.slice(1).join(' ');
      return await adminHandler.handleAdminDm(bot, chatId, targetId, dmMsg);
    }

    if (cmdText.startsWith('/maint') || cmdText.startsWith('/maintenance')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      const arg = (cmdText.split(/\s+/)[1] || '').toLowerCase();
      let force = null;
      if (arg === 'on' || arg === '1' || arg === 'enable') force = true;
      if (arg === 'off' || arg === '0' || arg === 'disable') force = false;
      return await adminHandler.handleAdminToggleMaintenance(bot, chatId, null, force);
    }

    if (cmdText.startsWith('/backup') || cmdText.startsWith('/export')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) return;
      return await adminHandler.handleAdminExportBackup(bot, chatId);
    }

    if (cmdText.startsWith('/broadcast')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) {
        return await bot.sendMessage(chatId, `⛔ <b>ACCESS DENIED:</b> Only Master Admin (ID: <code>7283817695</code>) can broadcast announcements.`, { parse_mode: 'HTML' });
      }
      const broadcastMsg = cmdText.replace(/^\/broadcast(@\w+)?\s*/, '').trim();
      return await adminHandler.handleAdminBroadcast(bot, msg, broadcastMsg);
    }

    if (cmdText.startsWith('/users')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) {
        return await bot.sendMessage(chatId, `⛔ <b>ACCESS DENIED:</b> Only Master Admin (ID: <code>7283817695</code>) can view user records.`, { parse_mode: 'HTML' });
      }
      return await adminHandler.handleAdminUsersList(bot, chatId);
    }

    if (cmdText.startsWith('/keys')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) {
        return await bot.sendMessage(chatId, `⛔ <b>ACCESS DENIED:</b> Only Master Admin (ID: <code>7283817695</code>) can view API keys.`, { parse_mode: 'HTML' });
      }
      return await adminHandler.handleAdminKeysList(bot, chatId);
    }

    if (cmdText.startsWith('/orders')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      if (!isMaster) {
        return await bot.sendMessage(chatId, `⛔ <b>ACCESS DENIED:</b> Only Master Admin (ID: <code>7283817695</code>) can view order logs.`, { parse_mode: 'HTML' });
      }
      return await adminHandler.handleAdminOrdersList(bot, chatId);
    }

    // Direct Khmer translation command
    if (cmdText.startsWith('/khmer') || cmdText.startsWith('/km')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      userService.setUserLanguage(msg.from.id, 'km');
      const confirmText = `${formatter.header('ភាសាខ្មែរត្រូវបានជ្រើសរើស')}\n\n` +
        `✅ ភាសាត្រូវបានប្តូរទៅជា <b>ភាសាខ្មែរ (Khmer)</b> ដោយជោគជ័យ។\n` +
        `ព័ត៌មាននិងផ្ទាំងបញ្ជាត្រូវបានបកប្រែជាភាសាខ្មែរ។`;
      await safeSender.sendMessage(bot, chatId, confirmText, { parse_mode: 'HTML' });
      return await renderDashboard(bot, chatId, null, msg.from);
    }

    // Direct English translation command
    if (cmdText.startsWith('/english') || cmdText.startsWith('/en')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      userService.setUserLanguage(msg.from.id, 'en');
      const confirmText = `${formatter.header('LANGUAGE SET TO ENGLISH')}\n\n` +
        `✅ Language has been successfully switched to <b>English</b>.\n` +
        `Dashboard and wizard prompts are now in English.`;
      await safeSender.sendMessage(bot, chatId, confirmText, { parse_mode: 'HTML' });
      return await renderDashboard(bot, chatId, null, msg.from);
    }

    // Quick Language toggle command
    if (cmdText.startsWith('/lang') || cmdText.startsWith('/language') || cmdText.startsWith('/translate')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      const nextLang = userService.toggleLanguage(msg.from.id);
      const isKm = nextLang === 'km';
      const confirmText = `${formatter.header(isKm ? 'ភាសាខ្មែរត្រូវបានជ្រើសរើស' : 'LANGUAGE UPDATED')}\n\n` +
        `✅ ${isKm ? 'ភាសាត្រូវបានប្តូរទៅជា <b>ភាសាខ្មែរ</b>។' : 'Language switched to <b>English</b>.'}`;
      await safeSender.sendMessage(bot, chatId, confirmText, { parse_mode: 'HTML' });
      return await renderDashboard(bot, chatId, null, msg.from);
    }

    // /connect or /guide command (How to connect integration key)
    if (cmdText.startsWith('/connect') || cmdText.startsWith('/integration') || cmdText.startsWith('/guide')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      const lang = userService.getUserLanguage(msg.from.id);
      const { text: connText, reply_markup } = renderConnectionViewer(lang, 'nodejs', msg.from.id);
      return await safeSender.sendMessage(bot, chatId, connText, {
        parse_mode: 'HTML',
        reply_markup
      });
    }

    // /portal, /register, /web command (Directly drops the payment API portal URL)
    if (cmdText.startsWith('/portal') || cmdText.startsWith('/register') || cmdText.startsWith('/web') || cmdText.startsWith('/getapi')) {
      middleware.logAction('COMMAND', msg.from, cmdText);
      return await handleGetPaymentApi(bot, { message: msg, from: msg.from });
    }

    // /start command
    if (cmdText.startsWith('/start')) {
      middleware.logAction('COMMAND', msg.from, '/start');
      return await handleStart(bot, msg);
    }

    // Interactive custom test amount input
    const userSession = sessionManager.getSession(msg.from.id);
    if (userSession && userSession.state === UserState.TEST_PAY_CUSTOM_AMOUNT) {
      middleware.logAction('TEST_INPUT', msg.from, text);
      return await handleCustomAmountInput(bot, msg);
    }

    // Interactive Wizard text inputs (Merchant ID, Phone Number, Links)
    const handledByWizard = await handleWizardTextInput(bot, msg);
    if (handledByWizard) {
      middleware.logAction('WIZARD_INPUT', msg.from, text);
      return;
    }

    // Default response for unhandled text messages
    logger.debug(`Unhandled user message from ${msg.from.id}: ${text}`);
  } catch (err) {
    logger.error('Error handling message:', err);
  }
});

// 2. Callback Queries (Inline Keyboard Buttons)
bot.on('callback_query', async (query) => {
  try {
    const data = query.data;
    const from = query.from;
    if (from) userService.trackUser(from);
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;

    middleware.logAction('CALLBACK_QUERY', from, data);

    // Always acknowledge callback query to dismiss loader in Telegram client
    await bot.answerCallbackQuery(query.id).catch(() => {});

    // Live Payment Status Verification: chk_pay_<tranId> or chk_aba_<tranId>
    if (data && (data.startsWith('chk_pay_') || data.startsWith('chk_aba_'))) {
      const tranId = data.replace('chk_pay_', '').replace('chk_aba_', '');
      return await handleCheckLivePay(bot, query, tranId);
    }

    // Subscription Payment Method Execution: sub_pay_bakong_<plan>_<currency> or sub_pay_aba_<plan>_<currency>
    if (data && (data.startsWith('sub_pay_bakong_') || data.startsWith('sub_pay_aba_'))) {
      const parts = data.split('_'); // ['sub', 'pay', 'bakong'/'aba', '1w'/'1m'/'1y', 'usd'/'khr']
      const bank = parts[2].toUpperCase();
      const planKey = parts[3] || '1w';
      const currency = (parts[4] || 'USD').toUpperCase();
      return await handleExecuteSubPayment(bot, query, planKey, bank, currency);
    }
    if (data === 'sub_back_plans') {
      return await handleBackToPlans(bot, query);
    }

    // Live Test Payment Custom & Bank Callbacks
    if (data && data.startsWith('test_pay_')) {
      if (data === 'test_pay_custom_prompt') {
        return await handleCustomAmountPrompt(bot, query);
      }
      const parts = data.split('_'); // ['test', 'pay', 'bakong'/'aba', 'usd'/'khr', '<amount>']
      const bank = (parts[2] || 'ABA').toUpperCase();
      const curr = (parts[3] || 'USD').toUpperCase();
      const amt = parseFloat(parts[4]) || (curr === 'KHR' ? 4000 : 1.00);
      return await handleExecuteLivePay(bot, query, curr, amt, bank);
    }

    // Direct Instant Confirmation on Subscription Payment Photo (Fallback)
    if (data && data.startsWith('reg_confirm_pay_')) {
      const tranId = data.replace('reg_confirm_pay_', '');
      return await handleConfirmRegistrationPayment(bot, query, tranId);
    }

    // Dynamic Key Selection for Live Testing
    if (data && data.startsWith('test_select_key_')) {
      const keyId = data.replace('test_select_key_', '');
      return await handleStartLivePayTest(bot, query, keyId);
    }
    if (data === 'test_switch_key') {
      return await handleStartLivePayTest(bot, query, 'SHOW_SELECTOR');
    }
    if (data === 'doc_download_pdf') {
      return await handleDownloadPdf(bot, query);
    }

    // Strict Group Lockdown for Callbacks
    const cbChat = query.message?.chat;
    const isCbGroup = cbChat && (cbChat.type === 'group' || cbChat.type === 'supergroup' || cbChat.type === 'channel');
    const isMasterCb = adminHandler.isMasterAdmin(from.id);

    // If Master Admin interacts in a group, automatically bind and authorize this group
    if (isCbGroup && isMasterCb) {
      adminHandler.bindAdminGroup(cbChat.id, cbChat.title);
    }

    if (isCbGroup && !isMasterCb && !adminHandler.isAuthorizedGroup(cbChat.id)) {
      return await bot.answerCallbackQuery(query.id, {
        text: '⛔ Access restricted to system administrator.',
        show_alert: true
      });
    }

    // Admin & Security checks for Callbacks
    if (userService.isBanned(from.id) && !isMasterCb) {
      return await bot.answerCallbackQuery(query.id, {
        text: '🚫 Your account has been suspended by system administrator.',
        show_alert: true
      });
    }

    const isMaintenanceCb = db.getSetting('maintenance_mode', false);
    if (isMaintenanceCb && !isMasterCb && !(data && data.startsWith('admin_'))) {
      return await bot.answerCallbackQuery(query.id, {
        text: '🔧 System is currently undergoing maintenance. Please try again later.',
        show_alert: true
      });
    }

    // Admin Operations Callbacks (Strictly locked to Master Admin 7283817695)
    if (data && data.startsWith('admin_')) {
      if (!isMasterCb) {
        return await bot.answerCallbackQuery(query.id, {
          text: '⛔ Access Denied: Only Master Admin (ID: 7283817695) can control this bot.',
          show_alert: true
        });
      }
      if (data === 'admin_refresh_stats') {
        return await adminHandler.renderAdminDashboard(bot, chatId, messageId);
      }
      if (data === 'admin_view_users') {
        return await adminHandler.handleAdminUsersList(bot, chatId, messageId);
      }
      if (data === 'admin_view_keys') {
        return await adminHandler.handleAdminKeysList(bot, chatId, messageId);
      }
      if (data === 'admin_view_orders') {
        return await adminHandler.handleAdminOrdersList(bot, chatId, messageId);
      }
      if (data === 'admin_view_firewall') {
        return await adminHandler.handleAdminFirewall(bot, chatId, messageId);
      }
      if (data === 'admin_flush_firewall') {
        const { rateLimiter } = require('./src/api/security');
        if (rateLimiter) rateLimiter.flush();
        await bot.answerCallbackQuery(query.id, { text: '🧹 Firewall Cache Cleared!', show_alert: true });
        return await adminHandler.handleAdminFirewall(bot, chatId, messageId);
      }
      if (data === 'admin_toggle_maint') {
        return await adminHandler.handleAdminToggleMaintenance(bot, chatId, messageId);
      }
      if (data === 'admin_export_backup') {
        await bot.answerCallbackQuery(query.id, { text: '⏳ Generating Database Backup...' });
        return await adminHandler.handleAdminExportBackup(bot, chatId);
      }
      if (data === 'admin_broadcast_help') {
        return await bot.sendMessage(
          chatId,
          `📢 <b>BROADCAST & DIRECT MESSAGE GUIDE:</b>\n\n` +
          `• <b>Global Broadcast:</b>\n<code>/broadcast Your message text here</code>\n\n` +
          `• <b>Direct Message User:</b>\n<code>/dm &lt;telegramId&gt; Your message here</code>`,
          { parse_mode: 'HTML' }
        );
      }
      if (data === 'admin_view_commands') {
        return await adminHandler.renderAdminCommandsList(bot, chatId, messageId);
      }
    }

    // Route callback queries
    switch (data) {
      // Registration Subscription Plan Selection
      case 'reg_plan_1w':
        return await handleSelectRegistrationPlan(bot, query, '1w');
      case 'reg_plan_1m':
        return await handleSelectRegistrationPlan(bot, query, '1m');
      case 'reg_plan_1y':
        return await handleSelectRegistrationPlan(bot, query, '1y');
      case 'reg_instant_activate':
        return await handleInstantActivate(bot, query);
      // Live Test Payment
      case 'start_live_pay_test':
        return await handleStartLivePayTest(bot, query);
      case 'live_pay_1w':
        return await handleExecuteLivePay(bot, query, 'USD', 0.10, 'ABA');
      case 'live_pay_usd':
        return await handleExecuteLivePay(bot, query, 'USD', 1.00, 'ABA');
      case 'live_pay_khr':
        return await handleExecuteLivePay(bot, query, 'KHR', 4000, 'ABA');

      // Registration
      case 'start_register':
        return await handleRegister(bot, query);

      // Navigation: Dashboard
      case 'nav_dashboard':
        stopSubscriptionAutoChecker(chatId);
        stopTestAutoChecker(chatId);
        return await renderDashboard(bot, chatId, messageId, from);

      // Navigation: Get Payment API / Provider selection
      case 'nav_get_api':
        return await handleGetPaymentApi(bot, query);

      // Provider Selections
      case 'prov_bakong':
        return await handleSelectProvider(bot, query, 'bakong');
      case 'prov_aba':
        return await handleSelectProvider(bot, query, 'aba');
      case 'prov_bundle':
        return await handleSelectProvider(bot, query, 'bundle');

      // Wizard Sandbox Instant Quick-Setup
      case 'wizard_sandbox_bakong':
        return await handleWizardSandboxQuickFill(bot, query, 'bakong');
      case 'wizard_sandbox_aba':
        return await handleWizardSandboxQuickFill(bot, query, 'aba');
      case 'wizard_sandbox_bundle':
        return await handleWizardSandboxQuickFill(bot, query, 'bundle');

      // Wizard Confirmation / Cancellation
      case 'confirm_order_submit':
        return await handleConfirmSubmit(bot, query);
      case 'nav_cancel':
        return await handleCancelWizard(bot, query);

      // Navigation: Pricing
      case 'nav_pricing':
        return await handlePricing(bot, query);

      // Navigation: Orders
      case 'nav_orders':
        return await handleOrders(bot, query);

      // Navigation: API Keys
      case 'nav_api_keys':
        return await handleApiKeys(bot, query);

      // How to Connect API Key / Integration Guide Viewer
      case 'nav_how_to_connect':
        return await handleConnectionViewer(bot, query, 'nodejs');
      case 'conn_code_nodejs':
        return await handleConnectionViewer(bot, query, 'nodejs');
      case 'conn_code_python':
        return await handleConnectionViewer(bot, query, 'python');
      case 'conn_code_php':
        return await handleConnectionViewer(bot, query, 'php');
      case 'conn_code_curl':
        return await handleConnectionViewer(bot, query, 'curl');

      // Navigation: Documentation Hub
      case 'nav_docs':
        return await handleDocumentationHub(bot, query);

      // Documentation Sub-pages
      case 'doc_quickstart':
      case 'doc_auth':
      case 'doc_create_payment':
      case 'doc_status':
      case 'doc_webhooks':
      case 'doc_errors':
      case 'doc_examples':
        return await handleDocSubPage(bot, query, data.replace('doc_', ''));

      // Navigation: Support
      case 'nav_support':
        return await handleSupport(bot, query);
      case 'support_help_center':
        return await handleHelpCenter(bot, query);

      // Navigation: Settings
      case 'nav_settings':
        return await handleSettings(bot, query);
      case 'settings_toggle_lang':
        return await handleToggleLanguage(bot, query);
      case 'settings_toggle_notif':
        return await handleToggleNotifications(bot, query);
      case 'settings_account_info':
        return await handleAccountInfo(bot, query);

      // Fast Translation & Language Switching
      case 'toggle_lang_welcome':
        userService.toggleLanguage(from.id);
        return await renderWelcome(bot, chatId, messageId, from);
      case 'toggle_lang_dash':
        userService.toggleLanguage(from.id);
        return await renderDashboard(bot, chatId, messageId, from);
      case 'toggle_lang_provider':
        userService.toggleLanguage(from.id);
        return await handleGetPaymentApi(bot, query);
      case 'toggle_lang_wizard':
        return await handleToggleLanguageWizard(bot, query);

      default:
        logger.warn(`Unknown callback_data received: ${data}`);
    }
  } catch (err) {
    logger.error('Error handling callback_query:', err);
  }
});

// Verification check on boot
bot.getMe().then((botInfo) => {
  logger.info(`✓ Bot successfully connected to Telegram API: @${botInfo.username} (ID: ${botInfo.id})`);
}).catch((err) => {
  logger.error('Failed to verify bot token with Telegram API:', err.message);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Stopping Telegram Bot polling and API Server...');
  if (apiServer) apiServer.close();
  bot.stopPolling().then(() => {
    logger.info('Bot stopped cleanly.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  if (apiServer) apiServer.close();
  bot.stopPolling().then(() => {
    process.exit(0);
  });
});

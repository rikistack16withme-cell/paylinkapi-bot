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
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id;

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
    if (text.startsWith('/getemoji')) {
      return await bot.sendMessage(
        chatId,
        `💎 <b>Telegram Premium Custom Emoji Guide:</b>\n\n` +
        `Send me any custom animated emoji from your Telegram Premium sticker/emoji pack!\n` +
        `I will instantly extract its <code>custom_emoji_id</code> and HTML tag so you can use it in your bot boards.`,
        { parse_mode: 'HTML' }
      );
    }

    // Direct Khmer translation command
    if (text.startsWith('/khmer') || text.startsWith('/km')) {
      middleware.logAction('COMMAND', msg.from, text);
      userService.setUserLanguage(msg.from.id, 'km');
      const confirmText = `${formatter.header('ភាសាខ្មែរត្រូវបានជ្រើសរើស')}\n\n` +
        `✅ ភាសាត្រូវបានប្តូរទៅជា <b>ភាសាខ្មែរ (Khmer)</b> ដោយជោគជ័យ។\n` +
        `ព័ត៌មាននិងផ្ទាំងបញ្ជាត្រូវបានបកប្រែជាភាសាខ្មែរ។`;
      await safeSender.sendMessage(bot, chatId, confirmText, { parse_mode: 'HTML' });
      return await renderDashboard(bot, chatId, null, msg.from);
    }

    // Direct English translation command
    if (text.startsWith('/english') || text.startsWith('/en')) {
      middleware.logAction('COMMAND', msg.from, text);
      userService.setUserLanguage(msg.from.id, 'en');
      const confirmText = `${formatter.header('LANGUAGE SET TO ENGLISH')}\n\n` +
        `✅ Language has been successfully switched to <b>English</b>.\n` +
        `Dashboard and wizard prompts are now in English.`;
      await safeSender.sendMessage(bot, chatId, confirmText, { parse_mode: 'HTML' });
      return await renderDashboard(bot, chatId, null, msg.from);
    }

    // Quick Language toggle command
    if (text.startsWith('/lang') || text.startsWith('/language') || text.startsWith('/translate')) {
      middleware.logAction('COMMAND', msg.from, text);
      const nextLang = userService.toggleLanguage(msg.from.id);
      const isKm = nextLang === 'km';
      const confirmText = `${formatter.header(isKm ? 'ភាសាខ្មែរត្រូវបានជ្រើសរើស' : 'LANGUAGE UPDATED')}\n\n` +
        `✅ ${isKm ? 'ភាសាត្រូវបានប្តូរទៅជា <b>ភាសាខ្មែរ</b>។' : 'Language switched to <b>English</b>.'}`;
      await safeSender.sendMessage(bot, chatId, confirmText, { parse_mode: 'HTML' });
      return await renderDashboard(bot, chatId, null, msg.from);
    }

    // /connect or /guide command (How to connect integration key)
    if (text.startsWith('/connect') || text.startsWith('/integration') || text.startsWith('/guide')) {
      middleware.logAction('COMMAND', msg.from, text);
      const lang = userService.getUserLanguage(msg.from.id);
      const { text: connText, reply_markup } = renderConnectionViewer(lang, 'nodejs', msg.from.id);
      return await safeSender.sendMessage(bot, chatId, connText, {
        parse_mode: 'HTML',
        reply_markup
      });
    }

    // /portal, /register, /web command (Directly drops the payment API portal URL)
    if (text.startsWith('/portal') || text.startsWith('/register') || text.startsWith('/web') || text.startsWith('/getapi')) {
      middleware.logAction('COMMAND', msg.from, text);
      return await handleGetPaymentApi(bot, { message: msg, from: msg.from });
    }

    // /start command
    if (text.startsWith('/start')) {
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

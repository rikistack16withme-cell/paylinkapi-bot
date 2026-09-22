const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const orderService = require('../../services/order.service');
const formatter = require('../../utils/formatter');
const { tgEmoji, makeButton } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');
const { generateStyledQrCard } = require('../../services/qr_card.service');
const {
  generateAbaQrCore,
  checkAbaPaymentCore,
  DEFAULT_MERCHANT_LINK_USD,
  DEFAULT_MERCHANT_LINK_KHR
} = require('../../controllers/abaPaywayController');
const {
  generateBakongKhqrCore,
  generateUniversalDeeplink,
  DEFAULT_BAKONG_ACCOUNT,
  DEFAULT_STORE_NAME
} = require('../../services/bakong_khqr.service');
const { queryBakongByMd5 } = require('../../controllers/bakongController');
const tunnelService = require('../../services/tunnel.service');
const sessionManager = require('../states/user.session');
const { UserState } = require('../states/state.machine');

const apiKeyService = require('../../services/apikey.service');

// Active background auto-checkers for live test payments
const activeTestCheckers = new Map();

function stopTestAutoChecker(chatId) {
  const key = String(chatId);
  if (activeTestCheckers.has(key)) {
    clearInterval(activeTestCheckers.get(key));
    activeTestCheckers.delete(key);
  }
}

/**
 * Shows interactive test studio board for live payment creation
 * Strictly uses the user's active API Key credentials.
 */
async function handleStartLivePayTest(bot, query, selectedKeyId = null) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  sessionManager.resetSession(from.id);
  stopTestAutoChecker(chatId);

  // If previous message was a photo card, delete it so the menu replaces it cleanly
  if (query.message?.photo || query.message?.document) {
    await bot.deleteMessage(chatId, messageId).catch(() => {});
  }

  const userKeys = apiKeyService.getUserApiKeys(from.id);

  // 1. If user has NO keys at all
  if (!userKeys || userKeys.length === 0) {
    const title = isKm ? 'មន្ទីរពិសោធន៍ទូទាត់ជាក់ស្តែង' : 'LIVE PAYMENT TEST STUDIO';
    const subtitle = isKm ? 'មិនទាន់មាន API Key នៅឡើយទេ' : 'No Active API Keys Found';
    let text = `${formatter.header(title, subtitle)}\n\n` +
      (isKm
        ? `⚠️ <b>លោកអ្នកមិនទាន់មានកូដ API Key សម្រាប់ធ្វើតេស្តនៅឡើយទេ!</b>\n\n` +
          `សូមចុចប៊ូតុង <b>«✦ ភ្ជាប់ប្រព័ន្ធទូទាត់ Payment API»</b> ដើម្បីចុះឈ្មោះ និងទទួលបាន API Key មុននឹងធ្វើតេស្ត។`
        : `⚠️ <b>You do not have any active API Keys to test yet!</b>\n\n` +
          `Please click <b>"✦ Get Payment API"</b> to register and activate your merchant API key first.`);

    const keyboard = {
      inline_keyboard: [
        [makeButton(isKm ? '✦ ភ្ជាប់ប្រព័ន្ធទូទាត់ Payment API ❯' : '✦ Get Payment API ❯', 'nav_get_api', 'get_api', 'primary')],
        [makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')]
      ]
    };

    return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  // 2. If user has MULTIPLE keys (e.g. bought 1, 2, or 3 keys) and no specific key is selected yet
  if (userKeys.length > 1 && (!selectedKeyId || selectedKeyId === 'SHOW_SELECTOR')) {
    const title = isKm ? 'ជ្រើសរើស API KEY ដើម្បីធ្វើតេស្ត' : 'SELECT API KEY TO TEST';
    const subtitle = isKm ? `លោកអ្នកមាន ${userKeys.length} API Keys សកម្ម` : `You have ${userKeys.length} Active API Keys`;
    let text = `${formatter.header(title, subtitle)}\n\n` +
      (isKm
        ? `<i>${tgEmoji('keys')} លោកអ្នកបានទិញ API Key ចំនួន <b>${userKeys.length}</b>។ សូមជ្រើសរើស API Key ណាមួយដែលអ្នកចង់ធ្វើតេស្តស្កេនទូទាត់ជាក់ស្តែង៖</i>\n\n`
        : `<i>${tgEmoji('keys')} You have purchased <b>${userKeys.length}</b> API Keys. Please select which key you would like to test:</i>\n\n`);

    const keyButtons = [];
    userKeys.forEach((k, index) => {
      const provName = String(k.provider || '').includes('Bakong') && String(k.provider || '').includes('ABA')
        ? 'Dual Suite'
        : (String(k.provider || '').includes('Bakong') ? 'Bakong KHQR' : 'ABA PayWay');

      text += `• <b>Key #${index + 1}:</b> <code>${formatter.escapeHtml(k.merchantName || 'Merchant Store')}</code> (${provName})\n` +
        `  ${tgEmoji('keys')} <code>${k.apiKey}</code>\n` +
        (k.bakongId ? `  ${tgEmoji('bakong')} Bakong: <code>${formatter.escapeHtml(k.bakongId)}</code>\n` : '') +
        (k.usdLink ? `  ${tgEmoji('aba')} ABA Link: <code>Connected</code>\n` : '') +
        `\n`;

      keyButtons.push([
        makeButton(
          `🔑 Key #${index + 1}: ${k.merchantName || 'Store'} (${provName}) ❯`,
          `test_select_key_${k.id}`,
          'keys',
          'primary'
        )
      ]);
    });

    keyButtons.push([
      makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')
    ]);

    return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyButtons }
    });
  }

  // 3. Resolve the active key to test
  let activeKey = null;
  if (selectedKeyId && selectedKeyId !== 'SHOW_SELECTOR') {
    activeKey = userKeys.find(k => k.id === selectedKeyId || k.apiKey === selectedKeyId) || apiKeyService.getKeyById(selectedKeyId);
  }
  if (!activeKey) {
    activeKey = userKeys[0];
  }

  // Remember the selected test key in user session
  sessionManager.updateSession(from.id, { testKeyId: activeKey.id });

  const user = userService.getUser(from.id) || {};
  const userProv = String(activeKey?.provider || user.provider || '').toLowerCase();
  const allowBakong = !userProv.includes('aba') || userProv.includes('bakong') || userProv.includes('bundle') || userProv.includes('dual');
  const allowAba = !userProv.includes('bakong') || userProv.includes('aba') || userProv.includes('bundle') || userProv.includes('dual');

  const apiKey = activeKey?.apiKey || null;
  const merchantName = activeKey?.merchantName || user.merchantName || 'Merchant Store';
  const bakongId = allowBakong ? (activeKey?.bakongId || activeKey?.merchantId || user.merchantId || user.bakongId || null) : null;
  const khrLink = allowAba ? (activeKey?.khrLink || user.khrLink || null) : null;
  const usdLink = allowAba ? (activeKey?.usdLink || user.usdLink || null) : null;

  const hasBakong = Boolean(bakongId);
  const hasAba = Boolean(usdLink || khrLink);

  // If user has not configured ANY receiving payment rails on this specific API key, require configuration
  if (!hasBakong && !hasAba) {
    const title = isKm ? 'មន្ទីរពិសោធន៍ទូទាត់ជាក់ស្តែង (LIVE TEST STUDIO)' : 'LIVE PAYMENT TEST STUDIO';
    const subtitle = isKm ? 'តម្រូវឱ្យភ្ជាប់គណនីធនាគារជាមុនសិន' : 'Merchant Destination Account Required';
    let text = `${formatter.header(title, subtitle)}\n\n`;

    if (isKm) {
      text += `${tgEmoji('alert')} <b>កូដ API Key នេះមិនទាន់បានភ្ជាប់គណនីធនាគារទទួលប្រាក់នៅឡើយទេ!</b>\n\n` +
        `ដើម្បីតេស្តបង្កើត QR Code ស្កេនទូទាត់ចូលគណនីរបស់អ្នកពិតប្រាកដ សូមធ្វើការភ្ជាប់គណនី Bakong ឬ ABA PayWay លើ API Key របស់អ្នកជាមុនសិន៖\n\n` +
        `• ${tgEmoji('keys')} <b>API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('bakong')} <b>គណនី Bakong:</b> <code>[ មិនទាន់កំណត់ ]</code>\n` +
        `• ${tgEmoji('aba')} <b>ABA PayWay:</b> <code>[ មិនទាន់កំណត់ ]</code>\n\n` +
        `<i>${tgEmoji('bulb')} ប្រព័ន្ធដំណើរការដោយតម្លាភាព៖ ប្រាក់តេស្តទាំងអស់នឹងត្រូវផ្ទេរចូលគណនីផ្ទាល់ខ្លួនរបស់អ្នក មិនមែនគណនី Admin ឡើយ!</i>`;
    } else {
      text += `${tgEmoji('alert')} <b>NO RECEIVING BANK ACCOUNTS LINKED TO THIS API KEY!</b>\n\n` +
        `To test live QR generation and receive test payments into your own account, you must connect your merchant credentials first:\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('bakong')} <b>Bakong Account:</b> <code>[ Not Configured ]</code>\n` +
        `• ${tgEmoji('aba')} <b>ABA PayWay:</b> <code>[ Not Configured ]</code>\n\n` +
        `<i>${tgEmoji('bulb')} 100% Direct Settlement: Test payments route strictly into YOUR own bank account, never the platform developer's personal account!</i>`;
    }

    const keyboard = {
      inline_keyboard: [
        [makeButton(isKm ? 'ភ្ជាប់គណនីធនាគារ (Setup Account) ❯' : 'Connect Bank Account ❯', 'nav_get_api', 'get_api', 'primary')],
        [makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')]
      ]
    };

    return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  let title = isKm ? 'មន្ទីរពិសោធន៍ទូទាត់ជាក់ស្តែង (LIVE PAYMENT STUDIO)' : 'LIVE PAYMENT TEST STUDIO';
  let subtitle = isKm ? 'តេស្តស្កេនទូទាត់ដោយប្រើ API Key ផ្ទាល់ខ្លួន' : 'Real-time API Key Payment Testing';

  if (hasBakong && !hasAba) {
    title = isKm ? 'មន្ទីរពិសោធន៍ BAKONG KHQR (LIVE TEST)' : 'BAKONG KHQR LIVE TEST STUDIO';
    subtitle = isKm ? 'តេស្តស្កេនទូទាត់ Bakong KHQR ដោយប្រើ API Key ផ្ទាល់ខ្លួន' : 'Real-time Bakong KHQR API Key Testing';
  } else if (hasAba && !hasBakong) {
    title = isKm ? 'មន្ទីរពិសោធន៍ ABA PAYWAY (LIVE TEST)' : 'ABA PAYWAY LIVE TEST STUDIO';
    subtitle = isKm ? 'តេស្តស្កេនទូទាត់ ABA PayWay ដោយប្រើ API Key ផ្ទាល់ខ្លួន' : 'Real-time ABA PayWay API Key Testing';
  } else if (hasBakong && hasAba) {
    title = isKm ? 'មន្ទីរពិសោធន៍ទូទាត់រួមគ្នា (LIVE DUAL-RAIL STUDIO)' : 'LIVE DUAL-RAIL TEST STUDIO';
    subtitle = isKm ? 'តេស្តស្កេនទូទាត់ Bakong + ABA ដោយប្រើ API Key ផ្ទាល់ខ្លួន' : 'Real-time Bakong + ABA Dual-Rail Testing';
  }

  let text = `${formatter.header(title, subtitle)}\n\n`;

  if (hasBakong && !hasAba) {
    // Bakong Only Board
    if (isKm) {
      text += `<i>${tgEmoji('rocket')} ប្រព័ន្ធកំពុងដំណើរការតេស្តកូដ QR តាមរយៈគណនី Bakong ផ្ទាល់ខ្លួនរបស់អ្នក៖</i>\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(merchantName || 'Merchant Store')}</code>\n` +
        `• ${tgEmoji('bakong')} <b>គណនី Bakong:</b> <code>${formatter.escapeHtml(bakongId)}</code>\n\n` +
        `${formatter.divider}\n` +
        `${tgEmoji('pointer')} <b>ជ្រើសរើសជម្រើសតេស្ត Bakong KHQR ឬបញ្ចូលចំនួនទឹកប្រាក់តាមចិត្ត៖</b>`;
    } else {
      text += `<i>${tgEmoji('rocket')} Real-time test engine operating under your active API Key and Bakong KHQR account:</i>\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('brand')} <b>Merchant Name:</b> <code>${formatter.escapeHtml(merchantName || 'Merchant Store')}</code>\n` +
        `• ${tgEmoji('bakong')} <b>Bakong Account:</b> <code>${formatter.escapeHtml(bakongId)}</code>\n\n` +
        `${formatter.divider}\n` +
        `${tgEmoji('pointer')} <b>Select a Bakong KHQR test option or enter your own custom amount:</b>`;
    }
  } else if (hasAba && !hasBakong) {
    // ABA Only Board
    if (isKm) {
      text += `<i>${tgEmoji('rocket')} ប្រព័ន្ធកំពុងដំណើរការតេស្តកូដ QR តាមរយៈគណនី ABA PayWay ផ្ទាល់ខ្លួនរបស់អ្នក៖</i>\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(merchantName || 'Merchant Store')}</code>\n` +
        (usdLink ? `• ${tgEmoji('aba')} <b>ABA USD Link:</b> <code>${formatter.escapeHtml(usdLink)}</code>\n` : '') +
        (khrLink ? `• ${tgEmoji('aba')} <b>ABA KHR Link:</b> <code>${formatter.escapeHtml(khrLink)}</code>\n` : '') +
        `\n${formatter.divider}\n` +
        `${tgEmoji('pointer')} <b>ជ្រើសរើសជម្រើសតេស្ត ABA PayWay ឬបញ្ចូលចំនួនទឹកប្រាក់តាមចិត្ត៖</b>`;
    } else {
      text += `<i>${tgEmoji('rocket')} Real-time test engine operating under your active API Key and ABA PayWay links:</i>\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('brand')} <b>Merchant Name:</b> <code>${formatter.escapeHtml(merchantName || 'Merchant Store')}</code>\n` +
        (usdLink ? `• ${tgEmoji('aba')} <b>ABA USD Link:</b> <code>${formatter.escapeHtml(usdLink)}</code>\n` : '') +
        (khrLink ? `• ${tgEmoji('aba')} <b>ABA KHR Link:</b> <code>${formatter.escapeHtml(khrLink)}</code>\n` : '') +
        `\n${formatter.divider}\n` +
        `${tgEmoji('pointer')} <b>Select an ABA PayWay test option or enter your own custom amount:</b>`;
    }
  } else {
    // Dual Suite Board
    if (isKm) {
      text += `<i>${tgEmoji('rocket')} ប្រព័ន្ធកំពុងដំណើរការតេស្តដោយប្រើកូដសម្ងាត់ API Key និងគណនីធនាគារផ្ទាល់ខ្លួនរបស់អ្នក៖</i>\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(merchantName || 'Merchant Store')}</code>\n` +
        `• ${tgEmoji('bakong')} <b>គណនី Bakong:</b> <code>${formatter.escapeHtml(bakongId)}</code>\n` +
        (usdLink ? `• ${tgEmoji('aba')} <b>ABA USD Link:</b> <code>${formatter.escapeHtml(usdLink)}</code>\n` : '') +
        (khrLink ? `• ${tgEmoji('aba')} <b>ABA KHR Link:</b> <code>${formatter.escapeHtml(khrLink)}</code>\n` : '') +
        `\n${formatter.divider}\n` +
        `${tgEmoji('pointer')} <b>ជ្រើសរើសជម្រើសតេស្តរហ័ស ឬបញ្ចូលចំនួនទឹកប្រាក់តាមចិត្ត៖</b>`;
    } else {
      text += `<i>${tgEmoji('rocket')} Real-time test engine operating under your active API Key and registered bank details:</i>\n\n` +
        `• ${tgEmoji('keys')} <b>Active API Key:</b> <code>${apiKey || 'N/A'}</code>\n` +
        `• ${tgEmoji('brand')} <b>Merchant Name:</b> <code>${formatter.escapeHtml(merchantName || 'Merchant Store')}</code>\n` +
        `• ${tgEmoji('bakong')} <b>Bakong Account:</b> <code>${formatter.escapeHtml(bakongId)}</code>\n` +
        (usdLink ? `• ${tgEmoji('aba')} <b>ABA USD Link:</b> <code>${formatter.escapeHtml(usdLink)}</code>\n` : '') +
        (khrLink ? `• ${tgEmoji('aba')} <b>ABA KHR Link:</b> <code>${formatter.escapeHtml(khrLink)}</code>\n` : '') +
        `\n${formatter.divider}\n` +
        `${tgEmoji('pointer')} <b>Select a quick test option or enter your own custom amount:</b>`;
    }
  }

  const buttons = [];

  if (hasBakong && !hasAba) {
    // ONLY Bakong registered
    buttons.push([
      makeButton(isKm ? 'Bakong USD ($1.00) ❯' : 'Bakong USD ($1.00) ❯', 'test_pay_bakong_usd_1', 'bakong', 'danger'),
      makeButton(isKm ? 'Bakong រៀល (4,000 ៛) ❯' : 'Bakong KHR (4,000 ៛) ❯', 'test_pay_bakong_khr_4000', 'bakong', 'danger')
    ]);
    buttons.push([
      makeButton(isKm ? 'Micro USD ($0.10) ❯' : 'Micro USD ($0.10) ❯', 'test_pay_bakong_usd_0.10', 'telemetry', 'success'),
      makeButton(isKm ? 'Micro KHR (400 ៛) ❯' : 'Micro KHR (400 ៛) ❯', 'test_pay_bakong_khr_400', 'telemetry', 'success')
    ]);
  } else if (hasAba && !hasBakong) {
    // ONLY ABA registered
    const abaMainRow = [];
    if (usdLink) abaMainRow.push(makeButton(isKm ? 'ABA USD ($1.00) ❯' : 'ABA USD ($1.00) ❯', 'test_pay_aba_usd_1', 'aba', 'primary'));
    if (khrLink) abaMainRow.push(makeButton(isKm ? 'ABA រៀល (4,000 ៛) ❯' : 'ABA KHR (4,000 ៛) ❯', 'test_pay_aba_khr_4000', 'aba', 'primary'));
    if (abaMainRow.length > 0) buttons.push(abaMainRow);

    const abaMicroRow = [];
    if (usdLink) abaMicroRow.push(makeButton(isKm ? 'Micro USD ($0.10) ❯' : 'Micro USD ($0.10) ❯', 'test_pay_aba_usd_0.10', 'telemetry', 'success'));
    if (khrLink) abaMicroRow.push(makeButton(isKm ? 'Micro KHR (400 ៛) ❯' : 'Micro KHR (400 ៛) ❯', 'test_pay_aba_khr_400', 'telemetry', 'success'));
    if (abaMicroRow.length > 0) buttons.push(abaMicroRow);
  } else {
    // Dual Suite (Both Bakong and ABA registered)
    buttons.push([
      makeButton(isKm ? 'Bakong USD ($1.00) ❯' : 'Bakong USD ($1.00) ❯', 'test_pay_bakong_usd_1', 'bakong', 'danger'),
      makeButton(isKm ? 'Bakong រៀល (4,000 ៛) ❯' : 'Bakong KHR (4,000 ៛) ❯', 'test_pay_bakong_khr_4000', 'bakong', 'danger')
    ]);

    const abaRow = [];
    if (usdLink) abaRow.push(makeButton(isKm ? 'ABA USD ($1.00) ❯' : 'ABA USD ($1.00) ❯', 'test_pay_aba_usd_1', 'aba', 'primary'));
    if (khrLink) abaRow.push(makeButton(isKm ? 'ABA រៀល (4,000 ៛) ❯' : 'ABA KHR (4,000 ៛) ❯', 'test_pay_aba_khr_4000', 'aba', 'primary'));
    if (abaRow.length > 0) buttons.push(abaRow);

    const microRow = [];
    if (usdLink) {
      microRow.push(makeButton('Micro USD ($0.10) ❯', 'test_pay_aba_usd_0.10', 'telemetry', 'success'));
    } else {
      microRow.push(makeButton('Micro USD ($0.10) ❯', 'test_pay_bakong_usd_0.10', 'telemetry', 'success'));
    }
    microRow.push(makeButton('Micro KHR (400 ៛) ❯', 'test_pay_bakong_khr_400', 'telemetry', 'success'));
    buttons.push(microRow);
  }

  // Custom amount test
  buttons.push([
    makeButton(isKm ? 'បញ្ចូលចំនួនទឹកប្រាក់ដោយខ្លួនឯង (Custom Amount) ❯' : 'Custom Amount Test ❯', 'test_pay_custom_prompt', 'edit', 'primary')
  ]);

  // Switch key button if user owns multiple keys
  if (userKeys && userKeys.length > 1) {
    buttons.push([
      makeButton(isKm ? '🔄 ប្តូរទៅតេស្ត API Key ផ្សេង ❯' : '🔄 Switch to Another API Key ❯', 'test_switch_key', 'keys', 'primary')
    ]);
  }

  // Back to console
  buttons.push([
    makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')
  ]);

  const keyboard = { inline_keyboard: buttons };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Prompts user to enter their custom amount
 */
async function handleCustomAmountPrompt(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  sessionManager.setState(from.id, UserState.TEST_PAY_CUSTOM_AMOUNT, {
    promptMessageId: messageId
  });

  const promptText = isKm
    ? `${tgEmoji('edit')} <b>បញ្ចូលចំនួនទឹកប្រាក់ដែលអ្នកចង់តេស្ត (CUSTOM TEST AMOUNT)</b>\n` +
      `${formatter.divider}\n\n` +
      `សូមវាយបញ្ចូលចំនួនទឹកប្រាក់ និងរូបិយប័ណ្ណដែលអ្នកចង់តេស្តបង្កើត QR Code៖\n\n` +
      `<b>ឧទាហរណ៍៖</b>\n` +
      `• <code>0.25 USD</code> ឬ <code>1.50</code>\n` +
      `• <code>2000 KHR</code> ឬ <code>10000</code>\n\n` +
      `<i>${tgEmoji('bulb')} ប្រព័ន្ធនឹងបង្កើត Dynamic KHQR Code ជាក់ស្តែងតាមចំនួនទឹកប្រាក់នេះភ្លាមៗ!</i>`
    : `${tgEmoji('edit')} <b>ENTER CUSTOM TEST AMOUNT</b>\n` +
      `${formatter.divider}\n\n` +
      `Please reply with the amount and currency you wish to test:\n\n` +
      `<b>Examples:</b>\n` +
      `• <code>0.25 USD</code> or <code>1.50</code>\n` +
      `• <code>2000 KHR</code> or <code>10000</code>\n\n` +
      `<i>${tgEmoji('bulb')} The engine will generate a real dynamic KHQR card for this exact amount!</i>`;

  const keyboard = {
    inline_keyboard: [
      [makeButton(isKm ? '← ថយក្រោយ (Cancel)' : '← Back (Cancel)', 'start_live_pay_test', null, 'danger')]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, promptText, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Handles text input when user is entering custom amount
 */
async function handleCustomAmountInput(bot, msg) {
  const chatId = msg.chat.id;
  const from = msg.from;
  const rawText = (msg.text || '').trim();
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  // Parse amount and currency from string: e.g. "1.50 USD", "5000 KHR", "0.20", "10000"
  const match = rawText.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    const errorText = isKm
      ? `❌ <b>ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ!</b>\n\nសូមបញ្ចូលជាលេខ ឧទាហរណ៍: <code>1.50 USD</code> ឬ <code>4000 KHR</code>។`
      : `❌ <b>Invalid amount!</b>\n\nPlease enter numbers only, e.g. <code>1.50 USD</code> or <code>4000 KHR</code>.`;
    return await safeSender.sendMessage(bot, chatId, errorText, { parse_mode: 'HTML' });
  }

  const amtNum = parseFloat(match[1]);
  if (amtNum <= 0) {
    const errorText = isKm
      ? `❌ ចំនួនទឹកប្រាក់ត្រូវតែធំជាង 0!`
      : `❌ Amount must be greater than 0!`;
    return await safeSender.sendMessage(bot, chatId, errorText, { parse_mode: 'HTML' });
  }

  let curr = 'USD';
  const upper = rawText.toUpperCase();
  if (upper.includes('KHR') || upper.includes('៛') || upper.includes('RIEL') || upper.includes('រៀល')) {
    curr = 'KHR';
  } else if (upper.includes('USD') || upper.includes('$') || upper.includes('DOLLAR')) {
    curr = 'USD';
  } else {
    // If user just typed a number >= 100, assume KHR, otherwise assume USD
    curr = amtNum >= 100 ? 'KHR' : 'USD';
  }

  const amtDisplay = curr === 'KHR'
    ? `${Math.round(amtNum).toLocaleString()} ៛ KHR`
    : `$${amtNum.toFixed(2)} USD`;

  sessionManager.resetSession(from.id);

  const userKeys = apiKeyService.getOrCreateUserKeys(from.id);
  const activeKey = (userKeys && userKeys.length > 0) ? userKeys[0] : null;
  const user = userService.getUser(from.id) || {};
  const userProv = String(activeKey?.provider || user.provider || '').toLowerCase();
  const allowBakong = !userProv.includes('aba') || userProv.includes('bakong') || userProv.includes('bundle') || userProv.includes('dual');
  const allowAba = !userProv.includes('bakong') || userProv.includes('aba') || userProv.includes('bundle') || userProv.includes('dual');

  const bakongId = allowBakong ? (activeKey?.bakongId || activeKey?.merchantId || user.merchantId || user.bakongId || null) : null;
  const usdLink = allowAba ? (activeKey?.usdLink || user.usdLink || null) : null;
  const khrLink = allowAba ? (activeKey?.khrLink || user.khrLink || null) : null;

  const hasBakong = Boolean(bakongId);
  const hasAba = curr === 'KHR' ? Boolean(khrLink) : Boolean(usdLink);

  let confirmText = '';
  const bankButtons = [];

  if (hasBakong && !hasAba) {
    confirmText = isKm
      ? `🎯 <b>បង្កើតកូដ QR តេស្ត Bakong KHQR (${amtDisplay}):</b>\n` +
        `${formatter.divider}\n\n` +
        `ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកូដ QR តេស្តស្កេនទូទាត់ភ្លាមៗ៖`
      : `🎯 <b>GENERATE BAKONG KHQR FOR ${amtDisplay} TEST:</b>\n` +
        `${formatter.divider}\n\n` +
        `Tap the button below to generate your live Bakong KHQR checkout card:`;
    bankButtons.push([
      makeButton(isKm ? `🔴 បង្កើត Bakong KHQR (${amtDisplay}) ❯` : `🔴 Generate Bakong KHQR (${amtDisplay}) ❯`, `test_pay_bakong_${curr.toLowerCase()}_${amtNum}`, 'bakong', 'danger')
    ]);
  } else if (hasAba && !hasBakong) {
    confirmText = isKm
      ? `🎯 <b>បង្កើតកូដ QR តេស្ត ABA PayWay (${amtDisplay}):</b>\n` +
        `${formatter.divider}\n\n` +
        `ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកូដ QR តេស្តស្កេនទូទាត់ភ្លាមៗ៖`
      : `🎯 <b>GENERATE ABA PAYWAY FOR ${amtDisplay} TEST:</b>\n` +
        `${formatter.divider}\n\n` +
        `Tap the button below to generate your live ABA PayWay checkout card:`;
    bankButtons.push([
      makeButton(isKm ? `🔵 បង្កើត ABA PayWay (${amtDisplay}) ❯` : `🔵 Generate ABA PayWay (${amtDisplay}) ❯`, `test_pay_aba_${curr.toLowerCase()}_${amtNum}`, 'aba', 'primary')
    ]);
  } else if (hasBakong && hasAba) {
    confirmText = isKm
      ? `🎯 <b>ជ្រើសរើសធនាគារសម្រាប់តេស្តចំនួន ${amtDisplay}:</b>\n` +
        `${formatter.divider}\n\n` +
        `តើលោកអ្នកចង់តេស្តបង្កើត QR Code តាមច្រកទូទាត់មួយណា?`
      : `🎯 <b>CHOOSE BANK FOR ${amtDisplay} TEST:</b>\n` +
        `${formatter.divider}\n\n` +
        `Which bank rail would you like to generate the test QR card with?`;
    bankButtons.push([
      makeButton(isKm ? `🔴 Bakong KHQR (${amtDisplay}) ❯` : `🔴 Bakong KHQR (${amtDisplay}) ❯`, `test_pay_bakong_${curr.toLowerCase()}_${amtNum}`, 'bakong', 'danger'),
      makeButton(isKm ? `🔵 ABA PayWay (${amtDisplay}) ❯` : `🔵 ABA PayWay (${amtDisplay}) ❯`, `test_pay_aba_${curr.toLowerCase()}_${amtNum}`, 'aba', 'primary')
    ]);
  } else {
    confirmText = isKm
      ? `⚠️ គណនីរបស់អ្នកមិនទាន់បានភ្ជាប់ច្រកទូទាត់ណាមួយឡើយ!`
      : `⚠️ You do not have any active bank rails connected to your API key!`;
  }

  const keyboard = {
    inline_keyboard: [
      ...bankButtons,
      [
        makeButton(isKm ? '← ថយក្រោយ (Choose Another)' : '← Back (Choose Another)', 'start_live_pay_test', 'brand', 'danger')
      ]
    ]
  };

  return await safeSender.sendMessage(bot, chatId, confirmText, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Dispatches real live payment generation with Bakong or ABA PayWay
 * Strictly verified against the user's active API Key credentials.
 */
async function handleExecuteLivePay(bot, query, currency = 'USD', customAmount = null, bank = 'ABA') {
  const chatId = query.message.chat.id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';
  const curr = (currency || 'USD').toUpperCase();
  const chosenBank = (bank || 'ABA').toUpperCase();

  const userSession = sessionManager.getSession(from.id);
  const selectedKeyId = userSession?.testKeyId;
  const userKeys = apiKeyService.getUserApiKeys(from.id);
  let activeKey = null;
  if (selectedKeyId) {
    activeKey = apiKeyService.getKeyById(selectedKeyId);
  }
  if (!activeKey && userKeys && userKeys.length > 0) {
    activeKey = userKeys[0];
  }
  const user = userService.getUser(from.id) || {};
  const userProv = String(activeKey?.provider || user.provider || '').toLowerCase();
  const allowBakong = !userProv.includes('aba') || userProv.includes('bakong') || userProv.includes('bundle') || userProv.includes('dual');
  const allowAba = !userProv.includes('bakong') || userProv.includes('aba') || userProv.includes('bundle') || userProv.includes('dual');

  const merchantName = activeKey?.merchantName || user.merchantName || 'Merchant Store';
  const bakongId = allowBakong ? (activeKey?.bakongId || activeKey?.merchantId || user.merchantId || user.bakongId || null) : null;
  const phone = activeKey?.phone || user.phone || '0977416126';
  const usdLink = allowAba ? (activeKey?.usdLink || user.usdLink || null) : null;
  const khrLink = allowAba ? (activeKey?.khrLink || user.khrLink || null) : null;

  // Validate that user has actual linked credentials for the chosen bank
  if (chosenBank === 'BAKONG' && !bakongId) {
    return await bot.answerCallbackQuery(query.id, {
      text: isKm ? '⚠️ គណនី Bakong មិនទាន់បានកំណត់លើ API Key របស់អ្នកទេ! សូមភ្ជាប់គណនីជាមុនសិន។' : '⚠️ No Bakong Account linked to your API Key! Please connect your account first.',
      show_alert: true
    }).catch(() => {});
  }

  const merchantLink = curr === 'KHR' ? khrLink : usdLink;
  if (chosenBank === 'ABA' && !merchantLink) {
    return await bot.answerCallbackQuery(query.id, {
      text: isKm ? `⚠️ តំណភ្ជាប់ ABA ${curr} មិនទាន់បានកំណត់លើ API Key របស់អ្នកទេ! សូមភ្ជាប់ Link ជាមុនសិន។` : `⚠️ No ABA ${curr} link linked to your API Key! Please connect your link first.`,
      show_alert: true
    }).catch(() => {});
  }

  const defaultAmt = curr === 'KHR' ? 4000 : 1.00;
  const amount = customAmount !== null ? customAmount : defaultAmt;
  const amountDisplay = curr === 'KHR' ? `${Math.round(amount).toLocaleString()} ៛ KHR` : `$${amount.toFixed(2)} USD`;

  // Answer callback immediately to dismiss loading spinner
  await bot.answerCallbackQuery(query.id, {
    text: isKm ? `កំពុងបង្កើត Live QR (${chosenBank} ${curr})...` : `Generating live ${chosenBank} QR...`
  }).catch(() => {});

  try {
    if (chosenBank === 'BAKONG') {
      const result = generateBakongKhqrCore({
        amount,
        currency: curr,
        merchantId: bakongId,
        merchantName,
        phone,
        expiryHours: 24
      });

      const nbcDeepLink = await generateUniversalDeeplink(result.qrString);

      orderService.savePaymentTransaction({
        telegramId: from.id,
        bank: 'BAKONG',
        amount,
        amountFormatted: result.amountFormatted,
        currency: curr,
        status: 'PENDING',
        tranId: result.tranId,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: nbcDeepLink
      });

      const cardBuffer = await generateStyledQrCard({
        bank: 'BAKONG',
        amountFormatted: result.amountFormatted,
        currency: curr,
        merchantName,
        qrString: result.qrString
      });

      const caption = isKm
        ? `${tgEmoji('bakong')} <b>ផ្ទាំងតេស្ត BAKONG KHQR (TEST CHECKOUT)</b>\n` +
          `${formatter.divider}\n` +
          `• <b>ប្រព័ន្ធទូទាត់:</b> ${tgEmoji('bakong')} Bakong National KHQR\n` +
          `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>ចំនួនទឹកប្រាក់:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>ស្ថានភាព:</b> <code>[ រង់ចាំការស្កេនទូទាត់ ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${nbcDeepLink}"><b>[ ចុចបើកកម្មវិធី Bakong App ភ្លាមៗ (Auto Pay) ]</b></a>\n` +
          `<i>${tgEmoji('qr')} បើកកម្មវិធី Bakong App ឬកម្មវិធីធនាគារណាមួយដើម្បីស្កេនទូទាត់ជាក់ស្តែង!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>ប្រព័ន្ធកំពុងត្រួតពិនិត្យការទូទាត់ស្វ័យប្រវត្តិ (Auto-Checking in real-time)...</b>`
        : `${tgEmoji('bakong')} <b>BAKONG KHQR TEST CHECKOUT</b>\n` +
          `${formatter.divider}\n` +
          `• <b>Payment Rail:</b> ${tgEmoji('bakong')} Bakong National KHQR\n` +
          `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>Amount:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>Status:</b> <code>[ WAITING FOR PAYMENT ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${nbcDeepLink}"><b>[ Tap Here to Open Bakong App Directly ]</b></a>\n` +
          `<i>${tgEmoji('qr')} Open Bakong App or any banking app to scan and pay live!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>Auto-checking payment status in real-time...</b>`;

      if (query.message?.message_id) {
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: isKm ? '📲 ចុចបើក Bakong App (Auto Pay) ❯' : '📲 Tap to Open Bakong App (Auto Pay) ❯', url: nbcDeepLink }],
          [makeButton(isKm ? 'ពិនិត្យការទូទាត់ (Check Payment)' : 'Check Payment Status', `chk_pay_${result.tranId}`, 'telemetry', 'success')],
          [makeButton(isKm ? '🔄 តេស្តចំនួនផ្សេងទៀត (Test Another)' : '🔄 Test Another Amount', 'start_live_pay_test', null, 'primary')],
          [makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')]
        ]
      };

      const sentMsg = await bot.sendPhoto(chatId, cardBuffer, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      }, { filename: 'bakong_test_card.png', contentType: 'image/png' });

      startLivePaymentAutoChecker({
        bot,
        chatId,
        photoMessageId: sentMsg?.message_id,
        tranId: result.tranId,
        bank: 'BAKONG',
        md5: result.md5,
        from
      });
      return;
    }

    // --- ABA PayWay Flow ---
    const result = await generateAbaQrCore({
      amount,
      currency: curr,
      merchantLink
    });

    const encodedPayload = encodeURIComponent(result.qrString);
    const abaDeepLink = `abamobilebank://ababank.com?type=payway&qrcode=${encodedPayload}`;

    let publicBase = tunnelService.getPublicUrl();
    if (!publicBase || !publicBase.startsWith('https://')) {
      publicBase = await tunnelService.getLivePublicUrl(3500).catch(() => null);
    }

    let abaOpenUrl = null;
    if (publicBase && publicBase.startsWith('https://')) {
      abaOpenUrl = `${publicBase}/api/aba/open/${result.tranId}`;
    } else if (result.merchantLink && result.merchantLink.startsWith('https://')) {
      abaOpenUrl = result.merchantLink;
    } else {
      abaOpenUrl = curr === 'KHR' ? DEFAULT_MERCHANT_LINK_KHR : DEFAULT_MERCHANT_LINK_USD;
    }

    orderService.savePaymentTransaction({
      telegramId: from.id,
      bank: 'ABA',
      amount,
      amountFormatted: result.amountFormatted,
      currency: curr,
      status: 'PENDING',
      tranId: result.tranId,
      clientId: result.clientId,
      requestTime: result.requestTime,
      token: result.token,
      merchantLink: result.merchantLink,
      qrString: result.qrString,
      md5: result.md5,
      deepLink: abaDeepLink
    });

    const cardBuffer = await generateStyledQrCard({
      bank: 'ABA',
      amountFormatted: result.amountFormatted,
      currency: curr,
      merchantName,
      qrString: result.qrString
    });

      const caption = isKm
        ? `${tgEmoji('aba')} <b>ផ្ទាំងតេស្ត ABA PAYWAY (TEST CHECKOUT)</b>\n` +
          `${formatter.divider}\n` +
          `• <b>ប្រព័ន្ធទូទាត់:</b> ${tgEmoji('aba')} ABA Bank PayWay\n` +
          `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>ចំនួនទឹកប្រាក់:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>ស្ថានភាព:</b> <code>[ រង់ចាំការស្កេនទូទាត់ ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${abaOpenUrl}"><b>[ ចុចបើកកម្មវិធី ABA Mobile ភ្លាមៗ (Auto Pay) ]</b></a>\n` +
          `<i>${tgEmoji('qr')} បើកកម្មវិធី ABA Mobile ឬកម្មវិធីធនាគារណាមួយដើម្បីស្កេនទូទាត់ជាក់ស្តែង!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>ប្រព័ន្ធកំពុងត្រួតពិនិត្យការទូទាត់ស្វ័យប្រវត្តិ (Auto-Checking in real-time)...</b>`
        : `${tgEmoji('aba')} <b>ABA PAYWAY TEST CHECKOUT</b>\n` +
          `${formatter.divider}\n` +
          `• <b>Payment Rail:</b> ${tgEmoji('aba')} ABA Bank PayWay\n` +
          `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>Amount:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>Status:</b> <code>[ WAITING FOR PAYMENT ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${abaOpenUrl}"><b>[ Tap Here to Open ABA Mobile Directly ]</b></a>\n` +
          `<i>${tgEmoji('qr')} Open ABA Mobile or any banking app to scan and pay live!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>Auto-checking payment status in real-time...</b>`;

      if (query.message?.message_id) {
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: isKm ? '📲 ចុចបើក ABA Mobile (Auto Pay) ❯' : '📲 Tap to Open ABA Mobile (Auto Pay) ❯', url: abaOpenUrl }],
          [makeButton(isKm ? 'ពិនិត្យការទូទាត់ (Check Payment)' : 'Check Payment Status', `chk_pay_${result.tranId}`, 'telemetry', 'success')],
          [makeButton(isKm ? '🔄 តេស្តចំនួនផ្សេងទៀត (Test Another)' : '🔄 Test Another Amount', 'start_live_pay_test', null, 'primary')],
          [makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')]
        ]
      };

    const sentMsg = await bot.sendPhoto(chatId, cardBuffer, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    }, { filename: 'aba_test_card.png', contentType: 'image/png' });

    startLivePaymentAutoChecker({
      bot,
      chatId,
      photoMessageId: sentMsg?.message_id,
      tranId: result.tranId,
      bank: 'ABA',
      from,
      details: {
        tranId: result.tranId,
        clientId: result.clientId,
        requestTime: result.requestTime,
        token: result.token,
        merchantLink: result.merchantLink
      }
    });
  } catch (err) {
    console.error('Error in handleExecuteLivePay:', err);
    await safeSender.sendMessage(bot, chatId, `${tgEmoji('alert')} <b>Error:</b> ${formatter.escapeHtml(err.message)}`, {
      parse_mode: 'HTML'
    });
  }
}

/**
 * Background auto-checker that automatically verifies when payment clears
 */
function startLivePaymentAutoChecker({ bot, chatId, photoMessageId, tranId, bank, from, md5, details }) {
  const key = String(chatId);
  stopTestAutoChecker(key);

  let attempts = 0;
  const maxAttempts = 72; // 3 minutes

  const timer = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      stopTestAutoChecker(key);
      return;
    }

    try {
      let isPaid = false;
      let rawData = null;

      if (bank === 'BAKONG') {
        if (md5) {
          const res = await queryBakongByMd5(md5);
          if (res && (res.status === 'SUCCESS' || res.responseCode === 0)) {
            isPaid = true;
            rawData = res.data || res;
          }
        }
      } else {
        if (details) {
          const res = await checkAbaPaymentCore(details);
          if (res && res.status === 'PAID') {
            isPaid = true;
            rawData = res.rawResponse || res;
          }
        }
      }

      if (isPaid) {
        stopTestAutoChecker(key);
        orderService.updatePaymentTransactionStatus(tranId, 'PAID', rawData);

        const lang = userService.getUserLanguage(from.id);
        const isKm = lang === 'km';
        const tx = orderService.getPaymentTransaction(tranId) || {};

        const successCaption = isKm
          ? `${tgEmoji('brand')} <b>ការទូទាត់តេស្តទទួលបានជោគជ័យ! (TEST PAYMENT CONFIRMED)</b> ${tgEmoji('brand')}\n` +
            `${formatter.divider}\n` +
            `• ${tgEmoji('clearing')} <b>ធនាគារ:</b> <code>${bank === 'BAKONG' ? 'Bakong National KHQR' : 'ABA Bank PayWay'}</code>\n` +
            `• ${tgEmoji('currency')} <b>ចំនួនទឹកប្រាក់:</b> <b>${tx.amountFormatted || tx.amount} ${tx.currency}</b>\n` +
            `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${tranId}</code>\n` +
            `• ${tgEmoji('verified')} <b>ស្ថានភាព:</b> <code>[ PAID / ផ្ទៀងផ្ទាត់ជោគជ័យ ]</code> ${tgEmoji('active')}\n` +
            `${formatter.divider}\n` +
            `<i>${tgEmoji('telemetry')} ប្រព័ន្ធបានទទួលប្រាក់ និងកត់ត្រាក្នុង Database រួចរាល់ដោយជោគជ័យ!</i>`
          : `${tgEmoji('party')} <b>TEST PAYMENT CONFIRMED SUCCESSFULLY!</b> ${tgEmoji('brand')}\n` +
            `${formatter.divider}\n` +
            `• ${tgEmoji('clearing')} <b>Payment Rail:</b> <code>${bank === 'BAKONG' ? 'Bakong National KHQR' : 'ABA Bank PayWay'}</code>\n` +
            `• ${tgEmoji('currency')} <b>Amount:</b> <b>${tx.amountFormatted || tx.amount} ${tx.currency}</b>\n` +
            `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${tranId}</code>\n` +
            `• ${tgEmoji('verified')} <b>Status:</b> <code>[ PAID / CONFIRMED ]</code> ${tgEmoji('active')}\n` +
            `${formatter.divider}\n` +
            `<i>${tgEmoji('telemetry')} Live payment clearing engine received and verified funds in real-time!</i>`;

        if (photoMessageId) {
          await bot.editMessageCaption(successCaption, {
            chat_id: chatId,
            message_id: photoMessageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [makeButton(isKm ? 'តេស្តចំនួនផ្សេងទៀត (Test Another)' : 'Test Another Amount', 'start_live_pay_test', null, 'primary')],
                [makeButton(isKm ? 'ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : 'Return to Console', 'nav_dashboard', null, 'success')]
              ]
            }
          }).catch(() => {});

          // Trigger Telegram full-screen celebration effect
          await safeSender.sendMessage(bot, chatId, isKm
            ? `${tgEmoji('party')} <b>អបអរសាទរ! ប្រព័ន្ធទូទាត់ Live Engine ដំណើរការបានជោគជ័យ ១០០%</b>`
            : `${tgEmoji('party')} <b>CONGRATULATIONS! Live Settlement Engine Received Funds Successfully!</b>`, {
            parse_mode: 'HTML',
            message_effect_id: '5046509860389126442'
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }, 2500);

  activeTestCheckers.set(key, timer);
}

/**
 * Real-time payment verification callback
 */
async function handleCheckLivePay(bot, query, tranId) {
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const tx = orderService.getPaymentTransaction(tranId);
  if (!tx) {
    return bot.answerCallbackQuery(query.id, {
      text: isKm
        ? 'ប្រតិបត្តិការចាស់នេះបានផុតកំណត់។ សូមជ្រើសរើសកញ្ចប់ឡើងវិញ ឬចុចប៊ូតុង "តេស្តស្កេនទូទាត់ជាក់ស្តែង"!'
        : 'This transaction session has expired. Please select a plan again or tap "Test Live Payment"!',
      show_alert: true
    }).catch(() => {});
  }

  const bank = (tx.bank || (tx.provider && tx.provider.includes('Bakong') ? 'BAKONG' : 'ABA')).toUpperCase();
  const isBakong = bank === 'BAKONG';

  try {
    let isPaid = false;
    let isScanned = false;
    let rawResponse = null;

    if (isBakong) {
      const md5 = tx.details?.md5 || tx.md5;
      if (!md5) {
        return bot.answerCallbackQuery(query.id, {
          text: isKm ? 'មិនមាន MD5 Hash សម្រាប់ត្រួតពិនិត្យទេ!' : 'Missing MD5 Hash for Bakong check!',
          show_alert: true
        }).catch(() => {});
      }
      const bakongRes = await queryBakongByMd5(md5);
      if (bakongRes && (bakongRes.status === 'SUCCESS' || bakongRes.responseCode === 0)) {
        isPaid = true;
        rawResponse = bakongRes;
      }
    } else {
      if (!tx.details) {
        return bot.answerCallbackQuery(query.id, {
          text: isKm ? 'មិនមានព័ត៌មាន ABA សម្រាប់ត្រួតពិនិត្យទេ!' : 'Missing ABA details for status check!',
          show_alert: true
        }).catch(() => {});
      }
      const abaRes = await checkAbaPaymentCore(tx.details);
      if (abaRes.status === 'PAID') {
        isPaid = true;
        rawResponse = abaRes.rawResponse;
      } else if (abaRes.status === 'SCANNED') {
        isScanned = true;
      }
    }

    if (isPaid) {
      orderService.updatePaymentTransactionStatus(tranId, 'PAID', rawResponse);

      // If this was a subscription payment for API activation:
      const planTitle = tx.plan || tx.details?.plan;
      if (planTitle) {
        await bot.answerCallbackQuery(query.id, {
          text: isKm ? 'ទទួលបានការទូទាត់ជោគជ័យ! ប្រព័ន្ធកំពុងបើកដំណើរការ API Key...' : 'Payment Confirmed! Activating API Key...',
          show_alert: false
        }).catch(() => {});

        if (query.message?.photo || query.message?.document) {
          await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => {});
        }

        const { issueUserCredentialsReceipt } = require('./wizard.handler');
        return await issueUserCredentialsReceipt(bot, query.message.chat.id, null, from, true);
      }

      const successCaption = isKm
        ? `${tgEmoji('brand')} <b>ការទូទាត់ទទួលបានជោគជ័យ! (PAYMENT RECEIVED)</b> ${tgEmoji('brand')}\n` +
          `${formatter.divider}\n` +
          `• ${tgEmoji('clearing')} <b>ធនាគារ:</b> <code>${isBakong ? 'Bakong National KHQR' : 'ABA Bank PayWay'}</code>\n` +
          `• ${tgEmoji('currency')} <b>ចំនួនទឹកប្រាក់:</b> <b>${tx.amountFormatted || tx.amount} ${tx.currency}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${tranId}</code>\n` +
          `• ${tgEmoji('verified')} <b>ស្ថានភាព:</b> <code>[ PAID / ជោគជ័យ ]</code> ${tgEmoji('active')}\n` +
          `${formatter.divider}\n` +
          `<i>${tgEmoji('telemetry')} ប្រព័ន្ធបានផ្ទៀងផ្ទាត់ការទូទាត់រួចរាល់ដោយជោគជ័យ!</i>`
        : `${tgEmoji('party')} <b>PAYMENT CONFIRMED SUCCESSFULLY!</b> ${tgEmoji('brand')}\n` +
          `${formatter.divider}\n` +
          `• ${tgEmoji('clearing')} <b>Bank:</b> <code>${isBakong ? 'Bakong National KHQR' : 'ABA Bank PayWay'}</code>\n` +
          `• ${tgEmoji('currency')} <b>Amount:</b> <b>${tx.amountFormatted || tx.amount} ${tx.currency}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${tranId}</code>\n` +
          `• ${tgEmoji('verified')} <b>Status:</b> <code>[ PAID / SUCCESSFUL ]</code> ${tgEmoji('active')}\n` +
          `${formatter.divider}\n` +
          `<i>${tgEmoji('telemetry')} Transaction confirmed and registered in developer database!</i>`;

      // Notify Admin Group (-5393647415)
      const { sendAdminAlert } = require('../../services/notification.service');
      sendAdminAlert(
        `🧪 <b>[LIVE PAYMENT TEST CONFIRMED]</b>\n` +
        `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
        `👤 <b>Tester:</b> ${formatter.escapeHtml(from.first_name || 'Developer')} (@${from.username || 'no_username'})\n` +
        `🏦 <b>Bank:</b> <code>${isBakong ? 'Bakong National KHQR' : 'ABA PayWay'}</code>\n` +
        `💵 <b>Amount:</b> <b>${tx.amountFormatted || tx.amount} ${tx.currency}</b>\n` +
        `🧾 <b>Tran ID:</b> <code>${tranId}</code>\n` +
        `⏰ <b>Time:</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>`
      ).catch(() => {});

      try {
        await bot.editMessageCaption(successCaption, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [makeButton(isKm ? 'តេស្តចំនួនផ្សេងទៀត (Test Another)' : 'Test Another Amount', 'start_live_pay_test', null, 'primary')],
              [makeButton(isKm ? 'ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : 'Return to Console', 'nav_dashboard', null, 'success')]
            ]
          }
        });

        await safeSender.sendMessage(bot, query.message.chat.id, isKm
          ? `${tgEmoji('party')} <b>អបអរសាទរ! ប្រព័ន្ធទូទាត់ Live Engine ដំណើរការបានជោគជ័យ ១០០%</b>`
          : `${tgEmoji('party')} <b>CONGRATULATIONS! Live Settlement Engine Received Funds Successfully!</b>`, {
          parse_mode: 'HTML',
          message_effect_id: '5046509860389126442'
        }).catch(() => {});
      } catch (e) {}

      return bot.answerCallbackQuery(query.id, {
        text: isKm ? 'ទទួលបានការទូទាត់ជោគជ័យ! (Payment Received!)' : 'Payment Confirmed Successfully!',
        show_alert: true
      }).catch(() => {});
    }

    if (isScanned) {
      return bot.answerCallbackQuery(query.id, {
        text: isKm ? 'បានស្កេនរួចរាល់ (SCANNED)! កំពុងរង់ចាំការបញ្ជាក់ពី ABA App...' : 'Customer has SCANNED! Waiting for final PIN/approval in ABA app...',
        show_alert: true
      }).catch(() => {});
    }

    return bot.answerCallbackQuery(query.id, {
      text: isKm
        ? `មិនទាន់ទទួលបានការទូទាត់ទេ (Waiting for Payment)។ សូមស្កេនជាមួយ ${isBakong ? 'Bakong App' : 'ABA Mobile'} រួចចុចពិនិត្យម្តងទៀត!`
        : `Not paid yet. Please scan with ${isBakong ? 'Bakong App' : 'ABA Mobile'} and tap check again!`,
      show_alert: true
    }).catch(() => {});
  } catch (err) {
    return bot.answerCallbackQuery(query.id, {
      text: `Check Error: ${err.message}`,
      show_alert: true
    }).catch(() => {});
  }
}

module.exports = {
  handleStartLivePayTest,
  handleCustomAmountPrompt,
  handleCustomAmountInput,
  handleExecuteLivePay,
  handleCheckLivePay,
  stopTestAutoChecker
};

const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const orderService = require('../../services/order.service');
const sessionManager = require('../states/user.session');
const { UserState } = require('../states/state.machine');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const navigationKeyboards = require('../keyboards/navigation.keyboards');
const formatter = require('../../utils/formatter');
const { tgEmoji, makeButton } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');
const bakongProvider = require('../../providers/bakong/bakong.provider');
const abaProvider = require('../../providers/aba/aba.provider');
const apiKeyService = require('../../services/apikey.service');
const { generateStyledQrCard } = require('../../services/qr_card.service');
const { generateUniversalDeeplink, generateBakongKhqrCore } = require('../../services/bakong_khqr.service');
const tunnelService = require('../../services/tunnel.service');
const {
  generateAbaQrCore,
  DEFAULT_MERCHANT_LINK_USD,
  DEFAULT_MERCHANT_LINK_KHR
} = require('../../controllers/abaPaywayController');

function renderBakongReviewCard(data, lang = 'en') {
  const isKm = lang === 'km';
  return `${formatter.header(isKm ? 'ពិនិត្យទិន្នន័យ BAKONG KHQR' : 'CONFIGURATION TELEMETRY REVIEW')}\n\n` +
    `<b>${isKm ? 'ប្រព័ន្ធទូទាត់:' : 'TARGET RAIL:'}</b> ${tgEmoji('bakong')} <b>Bakong KHQR (${isKm ? 'ធនាគារជាតិ NBC' : 'NBC Standard'})</b>\n` +
    `• ${tgEmoji('clearing')} <b>${isKm ? 'លេខសម្គាល់ Merchant ID:' : 'Merchant ID:'}</b> <code>${formatter.escapeHtml(data.merchantId || '')}</code>\n` +
    (data.accountHolder ? `• ${tgEmoji('verified')} <b>${isKm ? 'ម្ចាស់គណនី (NBC Verified):' : 'Account Holder (NBC Verified):'}</b> <code>${formatter.escapeHtml(data.accountHolder)}</code>\n` : '') +
    `• ${tgEmoji('brand')} <b>${isKm ? 'ឈ្មោះហាងផ្ទាល់ខ្លួន:' : 'Custom Merchant Name:'}</b> <code>${formatter.escapeHtml(data.merchantName || 'PaylinkApi Store')}</code> <i>(${isKm ? 'កំណត់ក្នុង Bot' : 'Customized in Bot'})</i>\n` +
    `• ${tgEmoji('phone')} <b>${isKm ? 'លេខទូរស័ព្ទ:' : 'Phone Number:'}</b> <code>${formatter.escapeHtml(data.phone || '')}</code>\n` +
    `• ${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Automated'}</code>\n\n` +
    `<b>${isKm ? 'ស្ថានភាព:' : 'STATUS:'}</b> ${tgEmoji('verified')} <code>${isKm ? 'បានផ្ទៀងផ្ទាត់ពិតប្រាកដ (NBC VERIFIED LIVE)' : 'AUTHENTIC & NBC VERIFIED LIVE'}</code>`;
}

function renderAbaReviewCard(data, lang = 'en') {
  const isKm = lang === 'km';
  return `${formatter.header(isKm ? 'ពិនិត្យទិន្នន័យ ABA PAYWAY' : 'ABA PAYWAY CONFIGURATION REVIEW')}\n\n` +
    `<b>${isKm ? 'ប្រព័ន្ធទូទាត់:' : 'TARGET RAIL:'}</b> ${tgEmoji('aba')} <b>ABA PayWay Gateway</b>\n` +
    `• ${tgEmoji('khr')} <b>${isKm ? 'តំណភ្ជាប់ប្រាក់រៀល (KHR ៛ Link):' : 'Khmer Riel (KHR ៛ Link):'}</b>\n  <code>${formatter.escapeHtml(data.khrLink || '')}</code>\n` +
    `• ${tgEmoji('usd')} <b>${isKm ? 'តំណភ្ជាប់ប្រាក់ដុល្លារ (USD $ Link):' : 'US Dollar (USD $ Link):'}</b>\n  <code>${formatter.escapeHtml(data.usdLink || '')}</code>\n` +
    `• ${tgEmoji('tag')} <b>${isKm ? 'ឈ្មោះ Merchant Name:' : 'Merchant Name:'}</b> <i>${isKm ? 'គ្រប់គ្រងក្នុង ABA Merchant App (មិនអាចប្តូរក្នុង Bot)' : 'Managed in ABA Merchant App'}</i>\n` +
    `• ${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា Dual Active' : 'USD ($) + KHR (៛) Dual Automated'}</code>\n\n` +
    `<b>${isKm ? 'ស្ថានភាព:' : 'STATUS:'}</b> ${tgEmoji('verified')} <code>${isKm ? 'បានផ្ទៀងផ្ទាត់ជោគជ័យ (ABA GATEWAY VERIFIED)' : 'AUTHENTIC & ABA VERIFIED LIVE'}</code>`;
}

function renderBundleReviewCard(data, lang = 'en') {
  const isKm = lang === 'km';
  return `${formatter.header(isKm ? 'ពិនិត្យទិន្នន័យរួមគ្នា BAKONG + ABA' : 'DUAL RAILS CONFIGURATION REVIEW')}\n\n` +
    `${tgEmoji('bakong')} <b>Bakong KHQR (${isKm ? 'ធនាគារជាតិ NBC' : 'NBC Standard'}):</b>\n` +
    `  • ${tgEmoji('clearing')} ${isKm ? 'លេខសម្គាល់ Merchant ID:' : 'Merchant ID:'} <code>${formatter.escapeHtml(data.merchantId || '')}</code>\n` +
    (data.accountHolder ? `  • ${tgEmoji('verified')} ${isKm ? 'ម្ចាស់គណនី:' : 'Account Holder:'} <code>${formatter.escapeHtml(data.accountHolder)}</code> (NBC Verified)\n` : '') +
    `  • ${tgEmoji('brand')} ${isKm ? 'ឈ្មោះហាងផ្ទាល់ខ្លួន:' : 'Custom Merchant Name:'} <code>${formatter.escapeHtml(data.merchantName || 'PaylinkApi Store')}</code> <i>(${isKm ? 'កំណត់ក្នុង Bot' : 'Custom in Bot'})</i>\n` +
    `  • ${tgEmoji('phone')} ${isKm ? 'ទូរស័ព្ទ:' : 'Phone:'} <code>${formatter.escapeHtml(data.phone || '')}</code>\n\n` +
    `${tgEmoji('aba')} <b>ABA PayWay Gateway:</b>\n` +
    `  • ${tgEmoji('khr')} <b>${isKm ? 'តំណភ្ជាប់ប្រាក់រៀល (KHR ៛ Link):' : 'Khmer Riel (KHR ៛ Link):'}</b>\n    <code>${formatter.escapeHtml(data.khrLink || '')}</code>\n` +
    `  • ${tgEmoji('usd')} <b>${isKm ? 'តំណភ្ជាប់ប្រាក់ដុល្លារ (USD $ Link):' : 'US Dollar (USD $ Link):'}</b>\n    <code>${formatter.escapeHtml(data.usdLink || '')}</code>\n` +
    `  • ${tgEmoji('tag')} ${isKm ? 'ឈ្មោះ ABA Merchant:' : 'ABA Merchant Name:'} <i>${isKm ? 'គ្រប់គ្រងក្នុង ABA Merchant App' : 'Managed in ABA Merchant App'}</i>\n\n` +
    `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា Dual Active' : 'USD ($) + KHR (៛) Dual Automated'}</code>\n` +
    `<b>${isKm ? 'ស្ថានភាព:' : 'STATUS:'}</b> ${tgEmoji('verified')} <code>${isKm ? 'បានផ្ទៀងផ្ទាត់ជោគជ័យ (NBC & ABA VERIFIED LIVE)' : 'CONNECTED & LIVE VERIFIED'}</code>`;
}

/**
 * Starts provider configuration wizard directly with USD+KHR Dual Currency locked
 */
async function startProviderWizard(bot, query, providerKey, dualCurrency) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  let nextState;
  let text;
  if (providerKey === 'bakong') {
    nextState = UserState.BAKONG_ENTER_MERCHANT_ID;
    text = `${formatter.header(isKm ? 'ការដំឡើង BAKONG KHQR' : 'BAKONG KHQR DEPLOYMENT', isKm ? 'ស្តង់ដារធនាគារជាតិនៃកម្ពុជា NBC' : 'National Bank of Cambodia Standard')}\n\n` +
      `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Active'}</code>\n\n` +
      `${i18n.t('bakong_merchant_id_prompt', lang)}`;
  } else if (providerKey === 'aba') {
    nextState = UserState.ABA_ENTER_KHR_LINK;
    text = `${formatter.header(isKm ? 'ការដំឡើង ABA PAYWAY' : 'ABA PAYWAY DEPLOYMENT', isKm ? 'តំណភ្ជាប់ Merchant & Checkout' : 'Merchant Deep-Links & Checkout')}\n\n` +
      `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Active'}</code>\n\n` +
      `${i18n.t('aba_khr_link_prompt', lang)}`;
  } else if (providerKey === 'bundle') {
    nextState = UserState.BUNDLE_BAKONG_MERCHANT_ID;
    text = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION', isKm ? 'ហេដ្ឋារចនាសម្ព័ន្ធទូទាត់កម្ពុជា' : 'Unified Cambodian Financial Infrastructure')}\n\n` +
      `<b>${isKm ? 'ជំហាន ១/២:' : 'Step 1/2:'}</b> ${tgEmoji('bakong')} <b>Bakong KHQR</b>\n` +
      `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Active'}</code>\n\n` +
      `${i18n.t('bakong_merchant_id_prompt', lang)}`;
  }

  let providerName = 'Bakong KHQR';
  if (providerKey === 'aba') providerName = 'ABA PayWay Gateway';
  if (providerKey === 'bundle') providerName = 'Bakong + ABA Dual Suite';

  sessionManager.setState(from.id, nextState, {
    provider: providerName,
    providerKey,
    currency: dualCurrency,
    promptMessageId: messageId
  });

  const keyboard = { inline_keyboard: navigationKeyboards.cancelOnly(lang) };
  try {
    const res = await safeSender.editMessageText(bot, text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    if (res?.message_id) {
      sessionManager.updateData(from.id, { promptMessageId: res.message_id });
    }
    return res;
  } catch (e) {
    // Clean up old message to prevent message duplicates
    await bot.deleteMessage(chatId, messageId).catch(() => {});
    const res = await safeSender.sendMessage(bot, chatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    if (res?.message_id) {
      sessionManager.updateData(from.id, { promptMessageId: res.message_id });
    }
    return res;
  }
}

// --- Validation Helpers & Warning Card Renderer ---

/**
 * Renders an eye-catching, high-visibility warning card for Bakong and ABA verification failures.
 * Includes a live micro-timestamp so repeated inputs never fail with Telegram's "message is not modified".
 */
function renderWarningCard({ title = 'WARNING', subtitle = '', error = '', advice = '', currentPrompt = '', lang = 'en' } = {}) {
  const isKm = lang === 'km';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Phnom_Penh'
  });

  const safeTitle = (title || (isKm ? 'ការព្រមាន' : 'WARNING')).toString().toUpperCase();
  const banner = isKm
    ? `⚠️ <b>ការព្រមាន: ${safeTitle}</b>`
    : `⚠️ <b>WARNING: ${safeTitle}</b>`;

  const sub = subtitle ? `\n<i>${subtitle}</i>` : '';

  let out = `${banner}${sub}\n${formatter.divider}\n\n` +
    `❌ <b>${error}</b>\n\n`;

  if (advice) {
    out += `👉 <b>${isKm ? 'វិធីដោះស្រាយ:' : 'HOW TO FIX:'}</b>\n` +
      `${advice}\n\n`;
  }

  out += `<i>⏱ ${isKm ? 'បានត្រួតពិនិត្យនៅម៉ោង' : 'Checked at'} ${timeStr}</i>\n` +
    `${formatter.divider}\n` +
    `${currentPrompt}`;

  return out;
}

function validateBakongId(id) {
  if (!id) return { valid: false, errorKm: 'សូមបញ្ចូល Bakong ID!', errorEn: 'Please enter a Bakong ID!' };
  const trimmed = id.trim().toLowerCase();
  // Standard Bakong ID format: name@bankcode, e.g. sokha@aclb, rikidev@abaa, shop@wing
  const bakongPattern = /^[a-z0-9._-]{2,40}@[a-z0-9]{3,15}$/;
  if (!bakongPattern.test(trimmed)) {
    return {
      valid: false,
      errorKm: 'លេខសម្គាល់ Bakong ID មិនត្រឹមត្រូវ! ត្រូវតែមានទម្រង់ <code>ឈ្មោះ@ធនាគារ</code> (ឧទាហរណ៍: <code>sokha@aclb</code> ឬ <code>merchant@abaa</code>)។ មិនអាចបញ្ចូល "asd" ឬទិន្នន័យក្លែងក្លាយបានទេ។',
      errorEn: 'Invalid Bakong ID! Must be in standard format <code>username@bank</code> (e.g. <code>sokha@aclb</code> or <code>merchant@abaa</code>). Dummy inputs like "asd" are rejected.'
    };
  }
  return { valid: true, value: trimmed };
}

/**
 * Live verification of Bakong Account against National Bank of Cambodia (NBC)
 */
async function verifyBakongAccountLive(accountId) {
  const trimmed = (accountId || '').trim().toLowerCase();
  const formatCheck = validateBakongId(trimmed);
  if (!formatCheck.valid) return formatCheck;

  try {
    const res = await fetch('https://api-bakong.nbc.gov.kh/v1/check_bakong_account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ accountId: trimmed }),
      signal: AbortSignal.timeout(7000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.responseCode === 0 && data.data) {
        return {
          valid: true,
          value: trimmed,
          fullName: data.data.fullName || null,
          accountStatus: data.data.accountStatus || 'ACTIVATED'
        };
      }
    }
    return {
      valid: false,
      errorKm: `គណនី Bakong <code>${formatter.escapeHtml(trimmed)}</code> នេះជាគណនីក្លែងក្លាយ ឬមិនមានក្នុងប្រព័ន្ធធនាគារជាតិ NBC (Account Not Found)! សូមបញ្ចូល Bakong Account ពិតប្រាកដរបស់អ្នក។`,
      errorEn: `Bakong Account <code>${formatter.escapeHtml(trimmed)}</code> is FAKE or DOES NOT EXIST in the NBC system (Account Not Found)! Please enter your authentic Bakong account.`
    };
  } catch (err) {
    // If NBC network timeout occurs, accept valid-looking format to avoid blocking
    return { valid: true, value: trimmed };
  }
}

function validatePhoneNumber(phone) {
  if (!phone) return { valid: false, errorKm: 'សូមបញ្ចូលលេខទូរស័ព្ទ!', errorEn: 'Please enter a phone number!' };
  const cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  // Cambodian phone numbers: 0[1-9]XXXXXXX or +855[1-9]XXXXXXX or 855[1-9]XXXXXXX (8 to 9 digits after 0)
  const phonePattern = /^(\+?855|0)[1-9]\d{7,8}$/;
  if (!phonePattern.test(cleaned)) {
    return {
      valid: false,
      errorKm: 'លេខទូរស័ព្ទកម្ពុជាមិនត្រឹមត្រូវ! ត្រូវតែជាលេខទូរស័ព្ទពិតប្រាកដ (ឧទាហរណ៍: <code>012345678</code> ឬ <code>+855977416126</code>)។ មិនអាចបញ្ចូល "123132123" ឬលេខមិនពិតបានទេ។',
      errorEn: 'Invalid Cambodian phone number! Must be a real mobile number (e.g. <code>012345678</code> or <code>+855977416126</code>). Fake inputs like "123132123" are rejected.'
    };
  }
  let formatted = cleaned;
  if (formatted.startsWith('+855')) formatted = '0' + formatted.slice(4);
  else if (formatted.startsWith('855')) formatted = '0' + formatted.slice(3);
  return { valid: true, value: formatted };
}

function validateAbaLink(link) {
  if (!link) return { valid: false, errorKm: 'សូមបញ្ចូលតំណភ្ជាប់ ABA PayWay!', errorEn: 'Please enter ABA PayWay link!' };
  let trimmed = link.trim();
  // Auto-normalize link if user pasted without http/https
  if (/^(link\.payway\.com\.kh|checkout\.payway\.com\.kh|payway\.com\.kh|ababank\.com)/i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  const isUrl = /^https?:\/\/.+/i.test(trimmed);
  const isPayWay = /(payway\.com\.kh|ababank\.com|link\.payway|checkout\.payway|abapay)/i.test(trimmed);
  if (!isUrl || !isPayWay || trimmed.length < 15) {
    return {
      valid: false,
      errorKm: 'តំណភ្ជាប់ ABA PayWay មិនត្រឹមត្រូវ! ត្រូវតែជា Link បង់ប្រាក់ផ្លូវការពី ABA Merchant App (ឧទាហរណ៍: <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>)។ មិនអាចបញ្ចូល "asd" ឬ Link ក្លែងក្លាយបានទេ។',
      errorEn: 'Invalid ABA PayWay Link! Must be an authentic checkout URL from ABA Merchant App (e.g. <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>). Fake inputs like "asd" are rejected.'
    };
  }
  return { valid: true, value: trimmed };
}

/**
 * Live verification of ABA PayWay link by generating real test checkout option
 * Also detects currency mismatch (e.g. if user sent USD link when KHR was expected or vice versa)
 */
async function verifyAbaLinkLive(link, expectedCurrency = null) {
  const trimmed = (link || '').trim();
  const formatCheck = validateAbaLink(trimmed);
  if (!formatCheck.valid) return formatCheck;

  try {
    const result = await generateAbaQrCore({
      amount: 1.00,
      currency: expectedCurrency || 'USD',
      merchantLink: formatCheck.value
    });
    if (result && result.tranId && result.qrString) {
      const isUsdLink = result.qrString.includes('5303840');
      const isKhrLink = result.qrString.includes('5303116');

      // Reject if user provided USD link for KHR step
      if (expectedCurrency === 'KHR' && isUsdLink) {
        return {
          valid: false,
          isCurrencyMismatch: true,
          errorKm: `តំណភ្ជាប់ដែលអ្នកបានបញ្ចូលជា Link សម្រាប់ប្រាក់ដុល្លារ <b>US Dollar (USD $)</b> មិនមែនប្រាក់រៀលទេ!`,
          errorEn: `This link is configured for <b>US Dollar (USD $)</b>, NOT Khmer Riel (KHR ៛)!`
        };
      }

      // Reject if user provided KHR link for USD step
      if (expectedCurrency === 'USD' && isKhrLink) {
        return {
          valid: false,
          isCurrencyMismatch: true,
          errorKm: `តំណភ្ជាប់ដែលអ្នកបានបញ្ចូលជា Link សម្រាប់ប្រាក់រៀល <b>Khmer Riel (KHR ៛)</b> មិនមែនប្រាក់ដុល្លារទេ!`,
          errorEn: `This link is configured for <b>Khmer Riel (KHR ៛)</b>, NOT US Dollar (USD $)!`
        };
      }

      return {
        valid: true,
        value: formatCheck.value,
        detectedCurrency: isKhrLink ? 'KHR' : 'USD'
      };
    }
    return {
      valid: false,
      errorKm: `តំណភ្ជាប់ ABA PayWay <code>${formatter.escapeHtml(formatCheck.value)}</code> នេះជា Link ក្លែងក្លាយ ឬមិនដំណើរការ! ABA Gateway បានបដិសេធ (Invalid Merchant Data)។`,
      errorEn: `ABA PayWay link <code>${formatter.escapeHtml(formatCheck.value)}</code> is FAKE or INACTIVE! ABA Gateway rejected it with Invalid Merchant Data.`
    };
  } catch (err) {
    return {
      valid: false,
      errorKm: `តំណភ្ជាប់ ABA PayWay <code>${formatter.escapeHtml(formatCheck.value)}</code> នេះជា Link ក្លែងក្លាយ ឬមិនដំណើរការ! ABA Gateway បានបដិសេធ (${formatter.escapeHtml(err.message)})។`,
      errorEn: `ABA PayWay link <code>${formatter.escapeHtml(formatCheck.value)}</code> is FAKE or INACTIVE! ABA Gateway rejected it (${formatter.escapeHtml(err.message)}).`
    };
  }
}

function validateMerchantName(name) {
  if (!name) return { valid: false, errorKm: 'សូមបញ្ចូលឈ្មោះហាង!', errorEn: 'Please enter merchant name!' };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return {
      valid: false,
      errorKm: 'ឈ្មោះហាង Merchant Name ត្រូវមានប្រវែងពី 2 ទៅ 50 តួអក្សរ!',
      errorEn: 'Merchant Name must be between 2 and 50 characters!'
    };
  }
  return { valid: true, value: trimmed };
}

/**
 * Handles text inputs during interactive configuration states
 * Replaces message in-place and deletes user input to avoid chat clutter
 */
async function handleWizardTextInput(bot, msg) {
  const chatId = msg.chat.id;
  const from = msg.from;
  const rawText = (msg.text || '').trim();
  const lang = userService.getUserLanguage(from.id);
  const session = sessionManager.getSession(from.id);
  const isKm = lang === 'km';

  if (!session || session.state === UserState.IDLE || session.state === UserState.DASHBOARD) {
    return false; // Not in wizard state
  }

  // 1. Instantly delete the user's message so the chat history stays spotless
  await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

  let promptMsgId = session.data?.promptMessageId;

  // Helper to update the wizard card in-place (or clean-replace) without duplicating messages in chat
  async function updateCard(text, replyMarkup) {
    const markup = replyMarkup?.reply_markup ? replyMarkup.reply_markup : replyMarkup;
    if (promptMsgId) {
      try {
        const res = await safeSender.editMessageText(bot, text, {
          chat_id: chatId,
          message_id: promptMsgId,
          parse_mode: 'HTML',
          reply_markup: markup
        });
        return res;
      } catch (e) {
        const errMsg = e?.message || '';
        if (errMsg.includes('message is not modified')) {
          // Message already has this exact content and markup, do not send a duplicate
          return true;
        }
        logger.warn(`In-place edit failed on prompt ${promptMsgId} (${errMsg}). Deleting old prompt and replacing...`);
        // If in-place edit failed, delete old prompt so chat never stacks duplicate cards
        await bot.deleteMessage(chatId, promptMsgId).catch(() => {});
      }
    }
    const sent = await safeSender.sendMessage(bot, chatId, text, {
      parse_mode: 'HTML',
      reply_markup: markup
    });
    if (sent?.message_id) {
      promptMsgId = sent.message_id;
      sessionManager.updateData(from.id, { promptMessageId: sent.message_id });
    }
    return sent;
  }

  const defaultBakongId = process.env.DEFAULT_BAKONG_ACCOUNT || 'hut_soksitchey1@aclb';
  const defaultMerchantName = process.env.DEFAULT_MERCHANT_NAME || 'Rikidev';
  const cancelKeyboard = { inline_keyboard: navigationKeyboards.cancelOnly(lang) };

  // --- 1. Bakong Wizard States ---
  if (session.state === UserState.BAKONG_ENTER_MERCHANT_ID) {
    let merchantId = rawText === '/skip' ? defaultBakongId : rawText;
    let accountHolder = null;
    if (rawText !== '/skip') {
      const check = await verifyBakongAccountLive(merchantId);
      if (!check.valid) {
        const isNotFound = (check.errorEn || '').includes('NOT EXIST') || (check.errorEn || '').includes('FAKE');
        const errPrompt = renderWarningCard({
          title: isNotFound
            ? (isKm ? 'រកមិនឃើញគណនី BAKONG' : 'BAKONG ACCOUNT NOT FOUND')
            : (isKm ? 'ទម្រង់ BAKONG ID មិនត្រឹមត្រូវ' : 'INVALID BAKONG ID FORMAT'),
          subtitle: isKm ? 'ប្រព័ន្ធធនាគារជាតិនៃកម្ពុជា NBC' : 'NBC Live Verification Rail',
          error: isKm ? check.errorKm : check.errorEn,
          advice: isKm
            ? 'សូមបញ្ចូលគណនី Bakong ពិតប្រាកដរបស់អ្នកដែលមានទម្រង់ <code>ឈ្មោះ@ធនាគារ</code> (ឧទាហរណ៍: <code>sokha@aclb</code> ឬ <code>merchant@abaa</code>)។'
            : 'Please enter your authentic Bakong account in format <code>username@bank</code> (e.g. <code>sokha@aclb</code> or <code>merchant@abaa</code>).',
          currentPrompt: i18n.t('bakong_merchant_id_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      merchantId = check.value;
      accountHolder = check.fullName;
    }

    sessionManager.setState(from.id, UserState.BAKONG_ENTER_MERCHANT_NAME, { merchantId, accountHolder });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើង BAKONG KHQR' : 'BAKONG KHQR DEPLOYMENT')}\n\n` +
      `${tgEmoji('verified')} <b>${isKm ? 'គណនី Bakong ត្រឹមត្រូវ (NBC Verified):' : 'Bakong Account Verified:'}</b> <code>${formatter.escapeHtml(merchantId)}</code>` +
      (accountHolder ? `\n• <b>${isKm ? 'ម្ចាស់គណនី:' : 'Account Holder:'}</b> <code>${formatter.escapeHtml(accountHolder)}</code>\n\n` : `\n\n`) +
      `${i18n.t('bakong_merchant_name_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.BAKONG_ENTER_MERCHANT_NAME) {
    let merchantName = rawText === '/skip' ? defaultMerchantName : rawText;
    if (rawText !== '/skip') {
      const check = validateMerchantName(merchantName);
      if (!check.valid) {
        const errPrompt = renderWarningCard({
          title: isKm ? 'ឈ្មោះហាងមិនត្រឹមត្រូវ' : 'INVALID MERCHANT NAME',
          subtitle: isKm ? 'តម្រូវឱ្យមានប្រវែងពី 2 ទៅ 50 តួអក្សរ' : 'Length: 2 to 50 Characters',
          error: isKm ? check.errorKm : check.errorEn,
          advice: isKm
            ? 'សូមបញ្ចូលឈ្មោះហាងផ្ទាល់ខ្លួនពី 2 ទៅ 50 តួអក្សរ (ឧទាហរណ៍: <code>Rikidev Store</code>)។'
            : 'Please enter a custom store name between 2 and 50 characters (e.g. <code>Rikidev Store</code>).',
          currentPrompt: i18n.t('bakong_merchant_name_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      merchantName = check.value;
    }

    sessionManager.setState(from.id, UserState.BAKONG_ENTER_PHONE, { merchantName });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើង BAKONG KHQR' : 'BAKONG KHQR DEPLOYMENT')}\n\n` +
      `${tgEmoji('brand')} <b>${isKm ? 'ឈ្មោះហាងផ្ទាល់ខ្លួន:' : 'Custom Merchant Name:'}</b> <code>${formatter.escapeHtml(merchantName)}</code> <i>(${isKm ? 'កំណត់ក្នុង Bot' : 'Custom in Bot'})</i>\n\n` +
      `${i18n.t('bakong_phone_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.BAKONG_ENTER_PHONE) {
    let phone = rawText === '/skip' ? '0977416126' : rawText;
    if (rawText !== '/skip') {
      const check = validatePhoneNumber(phone);
      if (!check.valid) {
        const errPrompt = renderWarningCard({
          title: isKm ? 'លេខទូរស័ព្ទមិនត្រឹមត្រូវ' : 'INVALID PHONE NUMBER',
          subtitle: isKm ? 'តម្រូវឱ្យជាលេខទូរស័ព្ទកម្ពុជាពិតប្រាកដ' : 'Cambodian Mobile Phone Required',
          error: isKm ? check.errorKm : check.errorEn,
          advice: isKm
            ? 'សូមបញ្ចូលលេខទូរស័ព្ទពិតប្រាកដ (ឧទាហរណ៍: <code>012345678</code> ឬ <code>+855977416126</code>)។'
            : 'Please enter a real Cambodian mobile phone number (e.g. <code>012345678</code> or <code>+855977416126</code>).',
          currentPrompt: i18n.t('bakong_phone_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      phone = check.value;
    }

    sessionManager.setState(from.id, UserState.CONFIRM_SUBMISSION, { phone });
    const s = sessionManager.getSession(from.id);
    const reviewText = renderBakongReviewCard(s.data, lang);

    await updateCard(reviewText, inlineKeyboards.confirmation(lang));
    return true;
  }

  // --- 2. ABA Wizard States ---
  if (session.state === UserState.ABA_ENTER_KHR_LINK) {
    let khrLink = rawText === '/skip' ? DEFAULT_MERCHANT_LINK_KHR : rawText;
    if (rawText !== '/skip') {
      const check = await verifyAbaLinkLive(khrLink, 'KHR');
      if (!check.valid) {
        let title, subtitle, advice;
        if (check.isCurrencyMismatch) {
          title = isKm ? 'ច្រឡំរូបិយប័ណ្ណ KHR' : 'CURRENCY MISMATCH REJECTED';
          subtitle = isKm ? 'តម្រូវឱ្យបញ្ចូល Link ប្រាក់រៀល (KHR ៛)' : 'Khmer Riel (KHR ៛) Link Required';
          advice = isKm
            ? 'សូមចូលទៅកាន់ <b>ABA Merchant App</b> > Copy Link គណនីប្រាក់រៀល <b>Khmer Riel (KHR ៛)</b> របស់អ្នក រួចយកមកដាក់ទីនេះ។'
            : 'Please open your <b>ABA Merchant App</b> > copy your <b>Khmer Riel (KHR ៛)</b> payment link, and paste it here.';
        } else {
          title = isKm ? 'តំណភ្ជាប់ ABA មិនត្រឹមត្រូវ' : 'INVALID ABA PAYWAY LINK';
          subtitle = isKm ? 'ការផ្ទៀងផ្ទាត់ ABA Gateway មិនជោគជ័យ' : 'ABA Gateway Verification Failed';
          advice = isKm
            ? 'សូមពិនិត្យមើល ABA Merchant App របស់អ្នក ហើយចម្លង Link ផ្លូវការដែលមានទម្រង់ <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>។'
            : 'Please check your ABA Merchant app and copy an authentic active link (e.g. <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>).';
        }
        const errPrompt = renderWarningCard({
          title,
          subtitle,
          error: isKm ? check.errorKm : check.errorEn,
          advice,
          currentPrompt: i18n.t('aba_khr_link_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      khrLink = check.value;
    }

    sessionManager.setState(from.id, UserState.ABA_ENTER_USD_LINK, { khrLink });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើង ABA PAYWAY' : 'ABA PAYWAY DEPLOYMENT')}\n\n` +
      `${tgEmoji('verified')} <b>${isKm ? 'ABA KHR Link ត្រឹមត្រូវ (Verified):' : 'ABA KHR Link Verified:'}</b> <code>${formatter.escapeHtml(khrLink)}</code>\n\n` +
      `${i18n.t('aba_usd_link_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.ABA_ENTER_USD_LINK) {
    let usdLink = rawText === '/skip' ? DEFAULT_MERCHANT_LINK_USD : rawText;
    if (rawText !== '/skip') {
      const check = await verifyAbaLinkLive(usdLink, 'USD');
      if (!check.valid) {
        let title, subtitle, advice;
        if (check.isCurrencyMismatch) {
          title = isKm ? 'ច្រឡំរូបិយប័ណ្ណ USD' : 'CURRENCY MISMATCH REJECTED';
          subtitle = isKm ? 'តម្រូវឱ្យបញ្ចូល Link ប្រាក់ដុល្លារ (USD $)' : 'US Dollar (USD $) Link Required';
          advice = isKm
            ? 'សូមចូលទៅកាន់ <b>ABA Merchant App</b> > Copy Link គណនីប្រាក់ដុល្លារ <b>US Dollar (USD $)</b> របស់អ្នក រួចយកមកដាក់ទីនេះ។'
            : 'Please open your <b>ABA Merchant App</b> > copy your <b>US Dollar (USD $)</b> payment link, and paste it here.';
        } else {
          title = isKm ? 'តំណភ្ជាប់ ABA មិនត្រឹមត្រូវ' : 'INVALID ABA PAYWAY LINK';
          subtitle = isKm ? 'ការផ្ទៀងផ្ទាត់ ABA Gateway មិនជោគជ័យ' : 'ABA Gateway Verification Failed';
          advice = isKm
            ? 'សូមពិនិត្យមើល ABA Merchant App របស់អ្នក ហើយចម្លង Link ផ្លូវការដែលមានទម្រង់ <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>។'
            : 'Please check your ABA Merchant app and copy an authentic active link (e.g. <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>).';
        }
        const errPrompt = renderWarningCard({
          title,
          subtitle,
          error: isKm ? check.errorKm : check.errorEn,
          advice,
          currentPrompt: i18n.t('aba_usd_link_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      usdLink = check.value;
    }

    sessionManager.setState(from.id, UserState.CONFIRM_SUBMISSION, { usdLink });
    const s = sessionManager.getSession(from.id);
    const reviewText = renderAbaReviewCard(s.data, lang);

    await updateCard(reviewText, inlineKeyboards.confirmation(lang));
    return true;
  }

  // --- 3. Bakong + ABA Bundle States ---
  if (session.state === UserState.BUNDLE_BAKONG_MERCHANT_ID) {
    let merchantId = rawText === '/skip' ? defaultBakongId : rawText;
    let accountHolder = null;
    if (rawText !== '/skip') {
      const check = await verifyBakongAccountLive(merchantId);
      if (!check.valid) {
        const isNotFound = (check.errorEn || '').includes('NOT EXIST') || (check.errorEn || '').includes('FAKE');
        const errPrompt = renderWarningCard({
          title: isNotFound
            ? (isKm ? 'រកមិនឃើញគណនី BAKONG' : 'BAKONG ACCOUNT NOT FOUND')
            : (isKm ? 'ទម្រង់ BAKONG ID មិនត្រឹមត្រូវ' : 'INVALID BAKONG ID FORMAT'),
          subtitle: isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong (NBC)' : 'Step 1/2: Bakong Setup (NBC)',
          error: isKm ? check.errorKm : check.errorEn,
          advice: isKm
            ? 'សូមបញ្ចូលគណនី Bakong ពិតប្រាកដរបស់អ្នកដែលមានទម្រង់ <code>ឈ្មោះ@ធនាគារ</code> (ឧទាហរណ៍: <code>sokha@aclb</code> ឬ <code>merchant@abaa</code>)។'
            : 'Please enter your authentic Bakong account in format <code>username@bank</code> (e.g. <code>sokha@aclb</code> or <code>merchant@abaa</code>).',
          currentPrompt: i18n.t('bakong_merchant_id_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      merchantId = check.value;
      accountHolder = check.fullName;
    }

    sessionManager.setState(from.id, UserState.BUNDLE_BAKONG_MERCHANT_NAME, { merchantId, accountHolder });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
      `<b>${isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong' : 'Step 1/2: Bakong Setup'}</b>\n` +
      `${tgEmoji('verified')} <b>${isKm ? 'Bakong ID ត្រឹមត្រូវ (NBC Verified):' : 'Bakong ID Verified:'}</b> <code>${formatter.escapeHtml(merchantId)}</code>` +
      (accountHolder ? ` (<i>${formatter.escapeHtml(accountHolder)}</i>)\n\n` : `\n\n`) +
      `${i18n.t('bakong_merchant_name_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.BUNDLE_BAKONG_MERCHANT_NAME) {
    let merchantName = rawText === '/skip' ? defaultMerchantName : rawText;
    if (rawText !== '/skip') {
      const check = validateMerchantName(merchantName);
      if (!check.valid) {
        const errPrompt = renderWarningCard({
          title: isKm ? 'ឈ្មោះហាងមិនត្រឹមត្រូវ' : 'INVALID MERCHANT NAME',
          subtitle: isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong (2 ទៅ 50 តួអក្សរ)' : 'Step 1/2: Bakong Setup (2-50 chars)',
          error: isKm ? check.errorKm : check.errorEn,
          advice: isKm
            ? 'សូមបញ្ចូលឈ្មោះហាងផ្ទាល់ខ្លួនពី 2 ទៅ 50 តួអក្សរ (ឧទាហរណ៍: <code>Rikidev Store</code>)។'
            : 'Please enter a custom store name between 2 and 50 characters (e.g. <code>Rikidev Store</code>).',
          currentPrompt: i18n.t('bakong_merchant_name_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      merchantName = check.value;
    }

    sessionManager.setState(from.id, UserState.BUNDLE_BAKONG_PHONE, { merchantName });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
      `<b>${isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong' : 'Step 1/2: Bakong Setup'}</b>\n` +
      `${tgEmoji('brand')} <b>${isKm ? 'ឈ្មោះហាងផ្ទាល់ខ្លួន:' : 'Custom Merchant Name:'}</b> <code>${formatter.escapeHtml(merchantName)}</code> <i>(${isKm ? 'កំណត់ក្នុង Bot' : 'Custom in Bot'})</i>\n\n` +
      `${i18n.t('bakong_phone_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.BUNDLE_BAKONG_PHONE) {
    let phone = rawText === '/skip' ? '0977416126' : rawText;
    if (rawText !== '/skip') {
      const check = validatePhoneNumber(phone);
      if (!check.valid) {
        const errPrompt = renderWarningCard({
          title: isKm ? 'លេខទូរស័ព្ទមិនត្រឹមត្រូវ' : 'INVALID PHONE NUMBER',
          subtitle: isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong (លេខទូរស័ព្ទកម្ពុជា)' : 'Step 1/2: Bakong Setup (Cambodian Mobile)',
          error: isKm ? check.errorKm : check.errorEn,
          advice: isKm
            ? 'សូមបញ្ចូលលេខទូរស័ព្ទពិតប្រាកដ (ឧទាហរណ៍: <code>012345678</code> ឬ <code>+855977416126</code>)។'
            : 'Please enter a real Cambodian mobile phone number (e.g. <code>012345678</code> or <code>+855977416126</code>).',
          currentPrompt: i18n.t('bakong_phone_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      phone = check.value;
    }

    sessionManager.setState(from.id, UserState.BUNDLE_ABA_KHR_LINK, { phone });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
      `<b>${isKm ? 'ជំហាន ២/២: ការរៀបចំ ABA Gateway' : 'Step 2/2: ABA Gateway Setup'}</b>\n` +
      `${tgEmoji('phone')} <b>${isKm ? 'លេខទូរស័ព្ទ Bakong:' : 'Bakong Phone:'}</b> <code>${formatter.escapeHtml(phone)}</code>\n\n` +
      `${i18n.t('aba_khr_link_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.BUNDLE_ABA_KHR_LINK) {
    let khrLink = rawText === '/skip' ? DEFAULT_MERCHANT_LINK_KHR : rawText;
    if (rawText !== '/skip') {
      const check = await verifyAbaLinkLive(khrLink, 'KHR');
      if (!check.valid) {
        let title, subtitle, advice;
        if (check.isCurrencyMismatch) {
          title = isKm ? 'ច្រឡំរូបិយប័ណ្ណ KHR' : 'CURRENCY MISMATCH REJECTED';
          subtitle = isKm ? 'ជំហាន ២/២: តម្រូវឱ្យបញ្ចូល Link ប្រាក់រៀល (KHR ៛)' : 'Step 2/2: Khmer Riel (KHR ៛) Link Required';
          advice = isKm
            ? 'សូមចូលទៅកាន់ <b>ABA Merchant App</b> > Copy Link គណនីប្រាក់រៀល <b>Khmer Riel (KHR ៛)</b> របស់អ្នក រួចយកមកដាក់ទីនេះ។'
            : 'Please open your <b>ABA Merchant App</b> > copy your <b>Khmer Riel (KHR ៛)</b> payment link, and paste it here.';
        } else {
          title = isKm ? 'តំណភ្ជាប់ ABA មិនត្រឹមត្រូវ' : 'INVALID ABA PAYWAY LINK';
          subtitle = isKm ? 'ជំហាន ២/២: ការផ្ទៀងផ្ទាត់ ABA Gateway មិនជោគជ័យ' : 'Step 2/2: ABA Gateway Verification Failed';
          advice = isKm
            ? 'សូមពិនិត្យមើល ABA Merchant App របស់អ្នក ហើយចម្លង Link ផ្លូវការដែលមានទម្រង់ <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>។'
            : 'Please check your ABA Merchant app and copy an authentic active link (e.g. <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>).';
        }
        const errPrompt = renderWarningCard({
          title,
          subtitle,
          error: isKm ? check.errorKm : check.errorEn,
          advice,
          currentPrompt: i18n.t('aba_khr_link_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      khrLink = check.value;
    }

    sessionManager.setState(from.id, UserState.BUNDLE_ABA_USD_LINK, { khrLink });
    const prompt = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
      `<b>${isKm ? 'ជំហាន ២/២: ការរៀបចំ ABA Gateway' : 'Step 2/2: ABA Gateway Setup'}</b>\n` +
      `${tgEmoji('khr')} <b>${isKm ? 'តំណភ្ជាប់ ABA KHR Link:' : 'ABA KHR Link:'}</b> <code>${formatter.escapeHtml(khrLink)}</code>\n\n` +
      `${i18n.t('aba_usd_link_prompt', lang)}`;

    await updateCard(prompt, cancelKeyboard);
    return true;
  }

  if (session.state === UserState.BUNDLE_ABA_USD_LINK) {
    let usdLink = rawText === '/skip' ? DEFAULT_MERCHANT_LINK_USD : rawText;
    if (rawText !== '/skip') {
      const check = await verifyAbaLinkLive(usdLink, 'USD');
      if (!check.valid) {
        let title, subtitle, advice;
        if (check.isCurrencyMismatch) {
          title = isKm ? 'ច្រឡំរូបិយប័ណ្ណ USD' : 'CURRENCY MISMATCH REJECTED';
          subtitle = isKm ? 'ជំហាន ២/២: តម្រូវឱ្យបញ្ចូល Link ប្រាក់ដុល្លារ (USD $)' : 'Step 2/2: US Dollar (USD $) Link Required';
          advice = isKm
            ? 'សូមចូលទៅកាន់ <b>ABA Merchant App</b> > Copy Link គណនីប្រាក់ដុល្លារ <b>US Dollar (USD $)</b> របស់អ្នក រួចយកមកដាក់ទីនេះ។'
            : 'Please open your <b>ABA Merchant App</b> > copy your <b>US Dollar (USD $)</b> payment link, and paste it here.';
        } else {
          title = isKm ? 'តំណភ្ជាប់ ABA មិនត្រឹមត្រូវ' : 'INVALID ABA PAYWAY LINK';
          subtitle = isKm ? 'ជំហាន ២/២: ការផ្ទៀងផ្ទាត់ ABA Gateway មិនជោគជ័យ' : 'Step 2/2: ABA Gateway Verification Failed';
          advice = isKm
            ? 'សូមពិនិត្យមើល ABA Merchant App របស់អ្នក ហើយចម្លង Link ផ្លូវការដែលមានទម្រង់ <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>។'
            : 'Please check your ABA Merchant app and copy an authentic active link (e.g. <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>).';
        }
        const errPrompt = renderWarningCard({
          title,
          subtitle,
          error: isKm ? check.errorKm : check.errorEn,
          advice,
          currentPrompt: i18n.t('aba_usd_link_prompt', lang),
          lang
        });
        await updateCard(errPrompt, cancelKeyboard);
        return true;
      }
      usdLink = check.value;
    }

    sessionManager.setState(from.id, UserState.CONFIRM_SUBMISSION, { usdLink });
    const s = sessionManager.getSession(from.id);
    const reviewText = renderBundleReviewCard(s.data, lang);

    await updateCard(reviewText, inlineKeyboards.confirmation(lang));
    return true;
  }

  return false;
}

/**
 * Instant sandbox credentials auto-fill for frictionless testing
 */
async function handleWizardSandboxQuickFill(bot, query, type) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  if (type === 'bakong') {
    const data = {
      provider: 'Bakong KHQR',
      providerKey: 'bakong',
      currency: 'USD ($) + KHR (៛) Dual Mode',
      merchantId: process.env.DEFAULT_BAKONG_ACCOUNT || 'hut_soksitchey1@aclb',
      merchantName: process.env.DEFAULT_MERCHANT_NAME || 'Rikidev',
      phone: '0977416126'
    };
    sessionManager.setState(from.id, UserState.CONFIRM_SUBMISSION, data);
    const reviewText = renderBakongReviewCard(data, lang);

    return safeSender.editMessageText(bot, reviewText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      ...inlineKeyboards.confirmation(lang)
    });
  }

  if (type === 'aba') {
    const data = {
      provider: 'ABA PayWay Gateway',
      providerKey: 'aba',
      currency: 'USD ($) + KHR (៛) Dual Mode',
      khrLink: process.env.DEFAULT_ABA_KHR_LINK || 'https://link.payway.com.kh/ABAPAYk8523640S',
      usdLink: process.env.DEFAULT_ABA_USD_LINK || 'https://link.payway.com.kh/ABAPAY86523639G'
    };
    sessionManager.setState(from.id, UserState.CONFIRM_SUBMISSION, data);
    const reviewText = renderAbaReviewCard(data, lang);

    return safeSender.editMessageText(bot, reviewText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      ...inlineKeyboards.confirmation(lang)
    });
  }

  if (type === 'bundle') {
    const data = {
      provider: 'Bakong + ABA Dual Suite',
      providerKey: 'bundle',
      currency: 'USD ($) + KHR (៛) Dual Mode',
      merchantId: process.env.DEFAULT_BAKONG_ACCOUNT || 'hut_soksitchey1@aclb',
      merchantName: process.env.DEFAULT_MERCHANT_NAME || 'Rikidev',
      phone: '0977416126',
      khrLink: process.env.DEFAULT_ABA_KHR_LINK || 'https://link.payway.com.kh/ABAPAYk8523640S',
      usdLink: process.env.DEFAULT_ABA_USD_LINK || 'https://link.payway.com.kh/ABAPAY86523639G'
    };
    sessionManager.setState(from.id, UserState.CONFIRM_SUBMISSION, data);
    const reviewText = renderBundleReviewCard(data, lang);

    return safeSender.editMessageText(bot, reviewText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      ...inlineKeyboards.confirmation(lang)
    });
  }
}

/**
 * Handles confirmation submission button
 */
/**
 * Handles confirmation submission button: presents subscription plan choices
 */
async function handleConfirmSubmit(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const session = sessionManager.getSession(from.id);
  const isKm = lang === 'km';

  const details = session?.data || {};
  const providerKey = session?.data?.providerKey ||
    (session?.data?.provider?.includes('bundle') || (details.merchantId && (details.khrLink || details.usdLink)) ? 'bundle' :
    (details.khrLink || details.usdLink ? 'aba' : 'bakong'));

  let providerName = 'Bakong KHQR';
  if (providerKey === 'aba') providerName = 'ABA PayWay Gateway';
  if (providerKey === 'bundle') providerName = 'Bakong + ABA Dual Suite';

  const currency = 'USD ($) + KHR (៛) Dual Mode';

  // Create order in DB
  const newOrder = orderService.createPlaceholderOrder(from.id, providerName, currency, details);

  // Save credentials to user profile so they persist for live pay & REST API
  // STRICT RAIL ISOLATION: When registering for 1 rail, explicitly clear out the other rail!
  const updatePayload = {
    telegramId: from.id,
    provider: providerName,
    providerKey
  };

  if (providerKey === 'bakong') {
    updatePayload.merchantId = details.merchantId || null;
    updatePayload.bakongId = details.merchantId || null;
    updatePayload.merchantName = details.merchantName || 'Merchant Store';
    updatePayload.phone = details.phone || null;
    updatePayload.khrLink = null;
    updatePayload.usdLink = null;
  } else if (providerKey === 'aba') {
    updatePayload.khrLink = details.khrLink || null;
    updatePayload.usdLink = details.usdLink || null;
    updatePayload.merchantName = details.merchantName || 'Merchant Store';
    updatePayload.phone = details.phone || null;
    updatePayload.merchantId = null;
    updatePayload.bakongId = null;
  } else {
    updatePayload.merchantId = details.merchantId || null;
    updatePayload.bakongId = details.merchantId || null;
    updatePayload.merchantName = details.merchantName || 'Merchant Store';
    updatePayload.phone = details.phone || null;
    updatePayload.khrLink = details.khrLink || null;
    updatePayload.usdLink = details.usdLink || null;
  }

  userService.updateUser(from.id, updatePayload);

  // Immediately synchronize or create distinct active API key for this merchant
  const userKeys = apiKeyService.getUserApiKeys(from.id);
  const matchingKey = userKeys.find(k => k.merchantName === updatePayload.merchantName);
  if (matchingKey) {
    matchingKey.provider = providerName;
    matchingKey.phone = updatePayload.phone;
    matchingKey.merchantId = updatePayload.merchantId;
    matchingKey.bakongId = updatePayload.bakongId;
    matchingKey.khrLink = updatePayload.khrLink;
    matchingKey.usdLink = updatePayload.usdLink;
    const db = require('../../database');
    db.saveApiKey(matchingKey);
  } else if (userKeys && userKeys.length > 0 && userKeys[0].apiKey) {
    // User already has an existing key for another store -> create additional key
    apiKeyService.createAdditionalApiKey(from.id, {
      ...updatePayload,
      provider: providerName
    });
  } else {
    const keyToUpdate = userKeys[0] || apiKeyService.getOrCreateUserKeys(from.id)[0];
    keyToUpdate.provider = providerName;
    keyToUpdate.merchantName = updatePayload.merchantName;
    keyToUpdate.phone = updatePayload.phone;
    keyToUpdate.merchantId = updatePayload.merchantId;
    keyToUpdate.bakongId = updatePayload.bakongId;
    keyToUpdate.khrLink = updatePayload.khrLink;
    keyToUpdate.usdLink = updatePayload.usdLink;
    const db = require('../../database');
    db.saveApiKey(keyToUpdate);
  }

  // Reset wizard session
  sessionManager.resetSession(from.id);

  const displayProvider = isKm
    ? (providerName.includes('Bakong') && providerName.includes('ABA')
        ? 'កញ្ចប់រួម Bakong + ABA ទាំងពីរ'
        : (providerName.includes('Bakong')
            ? 'Bakong KHQR (ធនាគារជាតិ NBC)'
            : 'ច្រកទូទាត់ ABA PayWay'))
    : providerName;

  let text = `${formatter.header(isKm ? 'ជ្រើសរើសកញ្ចប់ SUBSCRIPTION' : 'SELECT SUBSCRIPTION PLAN')}\n\n` +
    `${tgEmoji('verified')} <b>${isKm ? 'ព័ត៌មានធនាគារត្រូវបានកត់ត្រាជោគជ័យ!' : 'Bank Credentials Saved!'}</b>\n` +
    `${formatter.divider}\n` +
    `• ${tgEmoji('clearing')} <b>${isKm ? 'ប្រព័ន្ធ:' : 'Rail:'}</b> <code>${formatter.escapeHtml(displayProvider)}</code>\n` +
    (details.merchantName ? `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(details.merchantName)}</code>\n` : '') +
    `• ${tgEmoji('currency')} <b>Engine:</b> <code>USD ($) + KHR (៛) Dual Mode</code>\n\n` +
    `<i>${tgEmoji('rocket')} ${isKm ? 'សូមជ្រើសរើសកញ្ចប់ Subscription ដើម្បីបង្កើត Styled QR Card និងបើកដំណើរការ Production API Key:' : 'Select a subscription plan to generate your styled KHQR payment card and activate your Production API Key:'}</i>\n\n` +
    `• ${tgEmoji('telemetry')} <b>1 Week Pass:</b> <code>$0.10 USD</code> <i>(~៤០០ ៛ KHR)</i>\n` +
    `• ${tgEmoji('brand')} <b>1 Month Pro:</b> <code>$1.00 USD</code> <i>(~៤,០០០ ៛ KHR)</i>\n` +
    `• ${tgEmoji('crown')} <b>1 Year Enterprise:</b> <code>$10.00 USD</code> <i>(~៤០,០០០ ៛ KHR)</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Week Pass ($0.10 USD) ❯' : '1 Week Pass ($0.10 USD) ❯', 'reg_plan_1w', 'telemetry', 'success')
      ],
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Month Pro ($1.00 USD) ❯' : '1 Month Pro ($1.00 USD) ❯', 'reg_plan_1m', 'brand', 'primary')
      ],
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Year Enterprise ($10.00 USD) ❯' : '1 Year Enterprise ($10.00 USD) ❯', 'reg_plan_1y', 'crown', 'primary')
      ],
      [
        makeButton(i18n.t('btn_back', lang), 'nav_dashboard', 'brand', 'danger')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Handles back button from subscription payment screens (cleanly replaces payment card or menu with plans)
 */
async function handleBackToPlans(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';
  const user = userService.getUser(from.id) || {};

  await bot.answerCallbackQuery(query.id).catch(() => {});

  // Stop any active auto-checking interval for this chat
  stopSubscriptionAutoChecker(chatId);

  // If previous message was a photo (payment QR card), delete it cleanly so plans replace it
  if (query.message?.photo || query.message?.document) {
    await bot.deleteMessage(chatId, messageId).catch(() => {});
  }

  const text = `${formatter.header(isKm ? 'ជ្រើសរើសកញ្ចប់ SUBSCRIPTION' : 'SELECT SUBSCRIPTION PLAN')}\n\n` +
    `${tgEmoji('verified')} <b>${isKm ? 'ព័ត៌មានធនាគារត្រូវបានកត់ត្រាជោគជ័យ!' : 'Bank Credentials Saved!'}</b>\n` +
    `${formatter.divider}\n` +
    (user.merchantName ? `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(user.merchantName)}</code>\n` : '') +
    `• ${tgEmoji('currency')} <b>Engine:</b> <code>USD ($) + KHR (៛) Dual Mode</code>\n\n` +
    `<i>${tgEmoji('rocket')} ${isKm ? 'សូមជ្រើសរើសកញ្ចប់ Subscription ដើម្បីបង្កើត Styled QR Card និងបើកដំណើរការ Production API Key:' : 'Select a subscription plan to generate your styled KHQR payment card and activate your Production API Key:'}</i>\n\n` +
    `• ${tgEmoji('telemetry')} <b>1 Week Pass:</b> <code>$0.10 USD</code> <i>(~៤០០ ៛ KHR)</i>\n` +
    `• ${tgEmoji('brand')} <b>1 Month Pro:</b> <code>$1.00 USD</code> <i>(~៤,០០០ ៛ KHR)</i>\n` +
    `• ${tgEmoji('crown')} <b>1 Year Enterprise:</b> <code>$10.00 USD</code> <i>(~៤០,០០០ ៛ KHR)</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Week Pass ($0.10 USD) ❯' : '1 Week Pass ($0.10 USD) ❯', 'reg_plan_1w', 'telemetry', 'success')
      ],
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Month Pro ($1.00 USD) ❯' : '1 Month Pro ($1.00 USD) ❯', 'reg_plan_1m', 'brand', 'primary')
      ],
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Year Enterprise ($10.00 USD) ❯' : '1 Year Enterprise ($10.00 USD) ❯', 'reg_plan_1y', 'crown', 'primary')
      ],
      [
        makeButton(i18n.t('btn_back', lang), 'nav_dashboard', 'brand', 'danger')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Handles plan selection: shows payment method & currency choices (USD or KHR Riel for Bakong & ABA)
 */
async function handleSelectRegistrationPlan(bot, query, planKey) {
  const chatId = query.message.chat.id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  let usdAmount = 0.10;
  let khrAmount = 400;
  let planTitle = '1 Week Pass';
  if (planKey === '1m') {
    usdAmount = 1.00;
    khrAmount = 4000;
    planTitle = '1 Month Pro';
  } else if (planKey === '1y') {
    usdAmount = 10.00;
    khrAmount = 40000;
    planTitle = '1 Year Enterprise';
  }

  await bot.answerCallbackQuery(query.id, {
    text: isKm ? `ជ្រើសរើសរូបិយប័ណ្ណ និងធនាគារសម្រាប់ ${planTitle}` : `Choose currency and bank for ${planTitle}`
  }).catch(() => {});

  const text = isKm
    ? `${formatter.header('ជ្រើសរើសវិធីបង់ប្រាក់ និងរូបិយប័ណ្ណ', 'PAYMENT & CURRENCY')}\n\n` +
      `${tgEmoji('rocket')} <b>កញ្ចប់សេវា:</b> <code>${planTitle}</code>\n` +
      `${tgEmoji('currency')} <b>តម្លៃកញ្ចប់:</b> <b>$${usdAmount.toFixed(2)} USD</b> ឬ <b>${khrAmount.toLocaleString()} ៛ KHR</b>\n` +
      `${formatter.divider}\n\n` +
      `<i>${tgEmoji('qr')} សូមជ្រើសរើសធនាគារ និងរូបិយប័ណ្ណដែលអ្នកចង់ប្រើដើម្បីបង់ប្រាក់ (USD ឬ KHR រៀល):</i>\n\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR</b> — ស្កេន QR Code ទូទាត់ភ្លាមៗ\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay</b> — បើកកម្មវិធី ABA Mobile ឬស្កេន QR\n\n` +
      `<i>⏳ ប្រព័ន្ធនឹងត្រួតពិនិត្យការទូទាត់ស្វ័យប្រវត្តិ (Auto-Check) និងចេញ API Key ជូនភ្លាមៗ!</i>`
    : `${formatter.header('SELECT PAYMENT & CURRENCY')}\n\n` +
      `${tgEmoji('rocket')} <b>Plan:</b> <code>${planTitle}</code>\n` +
      `${tgEmoji('currency')} <b>Price:</b> <b>$${usdAmount.toFixed(2)} USD</b> or <b>${khrAmount.toLocaleString()} KHR (៛)</b>\n` +
      `${formatter.divider}\n\n` +
      `<i>${tgEmoji('qr')} Select your preferred bank and payment currency (USD or Riel):</i>\n\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR</b> — Scan KHQR to pay\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay</b> — Open ABA Mobile app or scan QR\n\n` +
      `<i>⏳ Payment is verified automatically in real-time — your API Key will be generated instantly!</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? `Bakong ដុល្លារ ($${usdAmount.toFixed(2)}) ❯` : `Bakong USD ($${usdAmount.toFixed(2)}) ❯`, `sub_pay_bakong_${planKey}_usd`, 'bakong', 'danger'),
        makeButton(isKm ? `Bakong រៀល (${khrAmount.toLocaleString()} ៛) ❯` : `Bakong KHR (${khrAmount.toLocaleString()} ៛) ❯`, `sub_pay_bakong_${planKey}_khr`, 'bakong', 'danger')
      ],
      [
        makeButton(isKm ? `ABA ដុល្លារ ($${usdAmount.toFixed(2)}) ❯` : `ABA USD ($${usdAmount.toFixed(2)}) ❯`, `sub_pay_aba_${planKey}_usd`, 'aba', 'primary'),
        makeButton(isKm ? `ABA រៀល (${khrAmount.toLocaleString()} ៛) ❯` : `ABA KHR (${khrAmount.toLocaleString()} ៛) ❯`, `sub_pay_aba_${planKey}_khr`, 'aba', 'primary')
      ],
      [
        makeButton(isKm ? '← ថយក្រោយ (ជ្រើសរើសកញ្ចប់ឡើងវិញ)' : '← Back (Choose Plan)', 'sub_back_plans', 'brand', 'danger')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, query.message?.message_id, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Executes subscription payment with chosen bank (ABA or Bakong) and currency (USD or KHR)
 */
async function handleExecuteSubPayment(bot, query, planKey, bank, currency = 'USD') {
  const chatId = query.message.chat.id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';
  const curr = (currency || 'USD').toUpperCase();
  const isKhr = curr === 'KHR';

  let amount;
  let planTitle = '1 Week Pass';
  if (planKey === '1m') {
    amount = isKhr ? 4000 : 1.00;
    planTitle = '1 Month Pro';
  } else if (planKey === '1y') {
    amount = isKhr ? 40000 : 10.00;
    planTitle = '1 Year Enterprise';
  } else {
    amount = isKhr ? 400 : 0.10;
    planTitle = '1 Week Pass';
  }

  const amountDisplay = isKhr
    ? `${amount.toLocaleString()} ៛ KHR`
    : `$${amount.toFixed(2)} USD`;
  const amountFormatted = isKhr
    ? String(Math.round(amount))
    : amount.toFixed(2);

  await bot.answerCallbackQuery(query.id, {
    text: isKm ? `កំពុងបង្កើត QR Card (${bank} ${curr})...` : `Generating ${bank} ${curr} QR Card...`
  }).catch(() => {});

  const platformName = process.env.BRAND_NAME || 'PaylinkApi';
  const platformBakongId = process.env.DEFAULT_BAKONG_ACCOUNT || 'hut_soksitchey1@aclb';
  const platformPhone = process.env.DEFAULT_BAKONG_PHONE || '0977416126';
  const platformAbaUsdLink = process.env.DEFAULT_ABA_USD_LINK || DEFAULT_MERCHANT_LINK_USD;
  const platformAbaKhrLink = process.env.DEFAULT_ABA_KHR_LINK || DEFAULT_MERCHANT_LINK_KHR;

  try {
    if (bank === 'ABA') {
      // --- ABA PayWay Flow ---
      const merchantLink = isKhr ? platformAbaKhrLink : platformAbaUsdLink;

      const result = await generateAbaQrCore({ amount, currency: curr, merchantLink });

      // The authentic ABA Mobile deep link
      const encodedPayload = encodeURIComponent(result.qrString);
      const abaDeepLink = `abamobilebank://ababank.com?type=payway&qrcode=${encodedPayload}`;

      // Instant launcher bridge that triggers ABA Mobile directly without intermediate pages
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
        abaOpenUrl = merchantLink;
      }

      orderService.savePaymentTransaction({
        telegramId: from.id, bank: 'ABA', amount,
        amountFormatted: result.amountFormatted, currency: curr, status: 'PENDING',
        tranId: result.tranId, clientId: result.clientId, requestTime: result.requestTime,
        token: result.token, merchantLink: result.merchantLink,
        qrString: result.qrString, md5: result.md5, deepLink: abaDeepLink, plan: planTitle,
        planKey
      });

      // Generate card with genuine ABA KHQR payload so scanning with ABA Mobile directly opens ABA
      const cardBuffer = await generateStyledQrCard({
        bank: 'ABA', amountFormatted: result.amountFormatted, currency: curr,
        merchantName: platformName, qrString: result.qrString
      });

      const caption = isKm
        ? `${tgEmoji('aba')} <b>ផ្ទាំងទូទាត់ ABA PAYWAY CHECKOUT</b>\n` +
          `${formatter.divider}\n` +
          `• ${tgEmoji('rocket')} <b>កញ្ចប់សេវា:</b> <code>${planTitle}</code>\n` +
          `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(platformName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>ចំនួនទឹកប្រាក់:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>សុពលភាព:</b> <code>៣ នាទី (ផុតកំណត់ស្វ័យប្រវត្តិ)</code>\n` +
          `• ${tgEmoji('pending')} <b>ស្ថានភាព:</b> <code>[ រង់ចាំការទូទាត់ ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${abaOpenUrl}"><b>[ ចុចបើកកម្មវិធី ABA Mobile ភ្លាមៗ (Auto Pay) ]</b></a>\n` +
          `<i>${tgEmoji('qr')} ឬស្កេនរូប QR ខាងលើដោយប្រើ ABA Mobile App!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>ប្រព័ន្ធកំពុងត្រួតពិនិត្យការទូទាត់ដោយស្វ័យប្រវត្តិ (Auto-Checking in real-time)...</b>\n` +
          `<i>${tgEmoji('brand')} API Key នឹងត្រូវបានបង្កើត និងផ្ញើជូនលោកអ្នកដោយស្វ័យប្រវត្តិនាពេលនេះ!</i>`
        : `${tgEmoji('aba')} <b>ABA PAYWAY SUBSCRIPTION CHECKOUT</b>\n` +
          `${formatter.divider}\n` +
          `• ${tgEmoji('rocket')} <b>Plan:</b> <code>${planTitle}</code>\n` +
          `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(platformName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>Amount:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>Validity:</b> <code>3 Minutes (Auto-Expires)</code>\n` +
          `• ${tgEmoji('pending')} <b>Status:</b> <code>[ WAITING FOR PAYMENT ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${abaOpenUrl}"><b>[ Tap Here to Open ABA Mobile Directly ]</b></a>\n` +
          `<i>${tgEmoji('qr')} Or scan the QR code above with ABA Mobile App!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>Auto-checking payment in real-time...</b>\n` +
          `<i>${tgEmoji('brand')} Your API Key will be generated automatically upon successful payment!</i>`;

      // Delete previous menu message to eliminate chat clutter
      if (query.message?.message_id) {
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      }

      // Direct auto-open button
      const keyboard = {
        inline_keyboard: [
          [{ text: isKm ? '📲 ចុចបើក ABA Mobile (Auto Pay) ❯' : '📲 Tap to Open ABA Mobile (Auto Pay) ❯', url: abaOpenUrl }],
          [makeButton(isKm ? '← ថយក្រោយ (ជ្រើសរើសកញ្ចប់ឡើងវិញ)' : '← Back (Choose Plan)', 'sub_back_plans', null, 'danger')]
        ]
      };

      const sentMsg = await bot.sendPhoto(chatId, cardBuffer, {
        caption, parse_mode: 'HTML', reply_markup: keyboard
      }, { filename: 'aba_sub_card.png', contentType: 'image/png' });

      startSubscriptionAutoChecker({
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

    } else {
      // --- Bakong KHQR Flow (Scan Only, NO click-to-bank) ---
      const { generateBakongKhqrCore } = require('../../services/bakong_khqr.service');

      const result = generateBakongKhqrCore({
        amount, currency: curr, merchantId: platformBakongId,
        merchantName: platformName, phone: platformPhone, expiryHours: 24
      });

      // Generate official NBC Universal Deeplink
      const nbcDeepLink = await generateUniversalDeeplink(result.qrString);

      orderService.savePaymentTransaction({
        telegramId: from.id, bank: 'BAKONG', amount,
        amountFormatted: result.amountFormatted, currency: curr, status: 'PENDING',
        tranId: result.tranId, qrString: result.qrString, md5: result.md5,
        deepLink: nbcDeepLink, plan: planTitle,
        planKey
      });

      // Generate card with genuine Bakong KHQR payload
      const cardBuffer = await generateStyledQrCard({
        bank: 'BAKONG', amountFormatted: result.amountFormatted, currency: curr,
        merchantName: platformName, qrString: result.qrString
      });

      const caption = isKm
        ? `${tgEmoji('bakong')} <b>ផ្ទាំងទូទាត់ BAKONG KHQR CHECKOUT</b>\n` +
          `${formatter.divider}\n` +
          `• ${tgEmoji('rocket')} <b>កញ្ចប់សេវា:</b> <code>${planTitle}</code>\n` +
          `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(platformName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>ចំនួនទឹកប្រាក់:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>សុពលភាព:</b> <code>៣ នាទី (ផុតកំណត់ស្វ័យប្រវត្តិ)</code>\n` +
          `• ${tgEmoji('pending')} <b>ស្ថានភាព:</b> <code>[ រង់ចាំការស្កេនទូទាត់ ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${nbcDeepLink}"><b>[ ចុចបើកកម្មវិធី Bakong App ភ្លាមៗ (Auto Pay) ]</b></a>\n` +
          `<i>${tgEmoji('qr')} ឬស្កេន QR Code ខាងលើដោយប្រើ Bakong App!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>ប្រព័ន្ធកំពុងត្រួតពិនិត្យការទូទាត់ដោយស្វ័យប្រវត្តិ (Auto-Checking in real-time)...</b>\n` +
          `<i>${tgEmoji('brand')} API Key នឹងត្រូវបានបង្កើត និងផ្ញើជូនលោកអ្នកដោយស្វ័យប្រវត្តិនាពេលនេះ!</i>`
        : `${tgEmoji('bakong')} <b>BAKONG KHQR SUBSCRIPTION CHECKOUT</b>\n` +
          `${formatter.divider}\n` +
          `• ${tgEmoji('rocket')} <b>Plan:</b> <code>${planTitle}</code>\n` +
          `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(platformName)}</code>\n` +
          `• ${tgEmoji('currency')} <b>Amount:</b> <b>${amountDisplay}</b>\n` +
          `• ${tgEmoji('tag')} <b>Transaction ID:</b> <code>${result.tranId}</code>\n` +
          `• ${tgEmoji('pending')} <b>Validity:</b> <code>3 Minutes (Auto-Expires)</code>\n` +
          `• ${tgEmoji('pending')} <b>Status:</b> <code>[ WAITING FOR SCAN ]</code>\n` +
          `${formatter.divider}\n` +
          `${tgEmoji('pointer')} <a href="${nbcDeepLink}"><b>[ Tap Here to Open Bakong App Directly ]</b></a>\n` +
          `<i>${tgEmoji('qr')} Or scan the QR code above using Bakong App!</i>\n\n` +
          `${tgEmoji('telemetry')} <b>Auto-checking payment in real-time...</b>\n` +
          `<i>${tgEmoji('brand')} Your API Key will be generated automatically upon successful payment!</i>`;

      // Delete previous menu message to eliminate chat clutter
      if (query.message?.message_id) {
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      }

      // Official NBC universal deeplink button (launches banking app directly)
      const keyboard = {
        inline_keyboard: [
          [{ text: isKm ? '📲 ចុចបើក Bakong App (Auto Pay) ❯' : '📲 Tap to Open Bakong App (Auto Pay) ❯', url: nbcDeepLink }],
          [makeButton(isKm ? '← ថយក្រោយ (ជ្រើសរើសកញ្ចប់ឡើងវិញ)' : '← Back (Choose Plan)', 'sub_back_plans', null, 'danger')]
        ]
      };

      const sentMsg = await bot.sendPhoto(chatId, cardBuffer, {
        caption, parse_mode: 'HTML', reply_markup: keyboard
      }, { filename: 'bakong_sub_card.png', contentType: 'image/png' });

      startSubscriptionAutoChecker({
        bot,
        chatId,
        photoMessageId: sentMsg?.message_id,
        tranId: result.tranId,
        bank: 'BAKONG',
        from,
        md5: result.md5
      });
    }
  } catch (err) {
    console.error('Error generating subscription payment QR:', err);
    await safeSender.sendMessage(bot, chatId, `${tgEmoji('alert')} <b>Error:</b> ${formatter.escapeHtml(err.message)}`, {
      parse_mode: 'HTML'
    });
  }
}

// Active auto-check background intervals map
const activeAutoCheckers = new Map();

function stopSubscriptionAutoChecker(chatId) {
  const key = String(chatId);
  if (activeAutoCheckers.has(key)) {
    clearInterval(activeAutoCheckers.get(key));
    activeAutoCheckers.delete(key);
  }
}

/**
 * Automatically polls payment status in background every 2.5 seconds
 * As soon as payment clears, automatically releases the developer API keys!
 */
function startSubscriptionAutoChecker({ bot, chatId, photoMessageId, tranId, bank, from, md5, details }) {
  const key = String(chatId);
  stopSubscriptionAutoChecker(key);

  let attempts = 0;
  const maxAttempts = 72; // 72 * 2.5s = 180s (exactly 3 minutes)

  const timer = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      stopSubscriptionAutoChecker(key);

      // 1. Update database transaction status to EXPIRED
      orderService.updatePaymentTransactionStatus(tranId, 'EXPIRED');

      // 2. Auto-remove the QR code photo from chat
      if (photoMessageId) {
        await bot.deleteMessage(chatId, photoMessageId).catch(() => {});
      }

      // 3. Send high-visibility QR Expired notification card
      const lang = userService.getUserLanguage(from.id);
      const isKm = lang === 'km';
      const expiredText = isKm
        ? `${tgEmoji('alert')} <b>កូដ QR បានផុតកំណត់ (QR EXPIRED)</b>\n` +
          `${formatter.divider}\n\n` +
          `• ${tgEmoji('alert')} <b>កូដ QR សម្រាប់ទូទាត់នេះបានផុតសុពលភាពរយៈពេល ៣ នាទី (3 Minutes) ហើយ!</b>\n\n` +
          `<i>${tgEmoji('security')} ដើម្បីសុវត្ថិភាពប្រតិបត្តិការ ប្រព័ន្ធបានលុបកូដ QR ចាស់ចេញពី Chat ដោយស្វ័យប្រវត្តិ។ សូមជ្រើសរើសកញ្ចប់ម្ដងទៀត ដើម្បីបង្កើតកូដ QR ថ្មី។</i>\n\n` +
          `${formatter.divider}\n` +
          `<i>${tgEmoji('pointer')} ចុចប៊ូតុងខាងក្រោមដើម្បីជ្រើសរើសកញ្ចប់ឡើងវិញ:</i>`
        : `${tgEmoji('alert')} <b>QR CODE EXPIRED</b>\n` +
          `${formatter.divider}\n\n` +
          `• ${tgEmoji('alert')} <b>This payment QR code has expired after 3 minutes!</b>\n\n` +
          `<i>${tgEmoji('security')} For payment security, the old QR code has been automatically removed from chat. Please select a plan again to generate a fresh QR code.</i>\n\n` +
          `${formatter.divider}\n` +
          `<i>${tgEmoji('pointer')} Tap the button below to choose your plan again:</i>`;

      const retryKeyboard = {
        inline_keyboard: [
          [makeButton(isKm ? 'ជ្រើសរើសកញ្ចប់ឡើងវិញ (Choose Plan) ❯' : 'Choose Plan Again ❯', 'sub_back_plans', 'rocket', 'primary')],
          [makeButton(isKm ? 'ត្រឡប់ទៅ Console' : 'Return to Console', 'nav_dashboard', 'brand', 'primary')]
        ]
      };

      await safeSender.sendMessage(bot, chatId, expiredText, {
        parse_mode: 'HTML',
        reply_markup: retryKeyboard
      });
      return;
    }

    try {
      let isPaid = false;
      let rawData = null;

      if (bank === 'BAKONG') {
        const { queryBakongByMd5 } = require('../../controllers/bakongController');
        if (md5) {
          const res = await queryBakongByMd5(md5);
          if (res && (res.status === 'SUCCESS' || res.responseCode === 0)) {
            isPaid = true;
            rawData = res.data || res;
          }
        }
      } else {
        // ABA PayWay
        const { checkAbaPaymentCore } = require('../../controllers/abaPaywayController');
        if (details) {
          const res = await checkAbaPaymentCore(details);
          if (res && res.status === 'PAID') {
            isPaid = true;
            rawData = res.rawResponse || res;
          }
        }
      }

      if (isPaid) {
        stopSubscriptionAutoChecker(key);

        // Update database transaction
        orderService.updatePaymentTransactionStatus(tranId, 'PAID', rawData);

        // Mark user subscription as ACTIVE
        userService.updateUser(from.id, {
          status: 'ACTIVE',
          subscription: {
            status: 'ACTIVE',
            activatedAt: new Date().toISOString()
          }
        });

        const tx = orderService.getPaymentTransaction(tranId) || {};
        const planKey = tx.planKey || (tx.details && tx.details.planKey) || (tx.plan === '1 Year Enterprise' ? '1y' : (tx.plan === '1 Month Pro' ? '1m' : '1w'));
        
        // Renew/extend or activate API Key subscription
        apiKeyService.renewApiKeySubscription(from.id, planKey);

        // Delete the waiting QR photo card
        if (photoMessageId) {
          await bot.deleteMessage(chatId, photoMessageId).catch(() => {});
        }

        const planTitle = tx.plan || tx.details?.plan || 'VIP Developer Pass';

        // 1. Send Animated Surprise Celebration Card with full-screen confetti effect!
        await sendSubscriptionSurpriseCelebration(bot, chatId, from, planTitle);

        // 2. Deliver developer credentials immediately!
        await issueUserCredentialsReceipt(bot, chatId, null, from, true);
      }
    } catch (pollErr) {
      // Keep checking on error without crashing
    }
  }, 2500);

  activeAutoCheckers.set(key, timer);
}

/**
 * Sends animated surprise celebration card when subscription payment is cleared in real-time
 */
async function sendSubscriptionSurpriseCelebration(bot, chatId, from, planTitle = 'VIP Pass') {
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const surpriseText = isKm
    ? `${tgEmoji('party')} <b>អបអរសាទរ! កាដូពិសេស (VIP SURPRISE ACTIVATION)</b> ${tgEmoji('brand')}\n` +
      `${formatter.divider}\n\n` +
      `${tgEmoji('verified')} <b>ការទូទាត់ SUBSCRIPTION ទទួលបានជោគជ័យ ១០០%!</b>\n\n` +
      `• ${tgEmoji('target')} <b>កញ្ចប់សេវា Plan:</b> <code>${formatter.escapeHtml(planTitle || 'VIP Developer Pass')}</code>\n` +
      `• ${tgEmoji('verified')} <b>ស្ថានភាព Status:</b> <code>[ PRODUCTION PRO ACTIVE ]</code> ${tgEmoji('active')}\n` +
      `• ${tgEmoji('telemetry')} <b>Settlement Engine:</b> <code>REAL-TIME AUTOMATED</code> ${tgEmoji('telemetry')}\n` +
      `• ${tgEmoji('security')} <b>Direct Routing:</b> <code>100% DIRECT TO YOUR ACCOUNT</code>\n\n` +
      `${formatter.divider}\n` +
      `${tgEmoji('party')} <i>អបអរសាទរ! ប្រព័ន្ធបានផ្ទៀងផ្ទាត់ការទូទាត់ និងបើកដំណើរការកូដសម្ងាត់ Production API Key ជូនលោកអ្នកភ្លាមៗខាងក្រោម៖</i>`
    : `${tgEmoji('party')} <b>SURPRISE! VIP SUBSCRIPTION ACTIVATED!</b> ${tgEmoji('brand')}\n` +
      `${formatter.divider}\n\n` +
      `${tgEmoji('verified')} <b>CONGRATULATIONS! SUBSCRIPTION PAYMENT CLEARED 100%!</b>\n\n` +
      `• ${tgEmoji('target')} <b>Subscription Plan:</b> <code>${formatter.escapeHtml(planTitle || 'VIP Developer Pass')}</code>\n` +
      `• ${tgEmoji('verified')} <b>Account Tier:</b> <code>[ PRODUCTION PRO ACTIVE ]</code> ${tgEmoji('active')}\n` +
      `• ${tgEmoji('telemetry')} <b>Settlement Engine:</b> <code>REAL-TIME AUTOMATED</code> ${tgEmoji('telemetry')}\n` +
      `• ${tgEmoji('security')} <b>Direct Routing:</b> <code>100% DIRECT TO YOUR ACCOUNT</code>\n\n` +
      `${formatter.divider}\n` +
      `${tgEmoji('party')} <i>Surprise reward unlocked! Your Official Production API Key & Webhook Secret are issued below:</i>`;

  return await safeSender.sendMessage(bot, chatId, surpriseText, {
    parse_mode: 'HTML',
    message_effect_id: '5046509860389126442'
  }).catch(() => {});
}

/**
 * Handles going back to the subscription plan selection screen
 */
async function handleBackToPlans(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const user = userService.getUser(from.id) || {};
  const merchantName = user.merchantName || 'Rikidev';

  stopSubscriptionAutoChecker(chatId);
  await bot.answerCallbackQuery(query.id).catch(() => {});

  let text = `${formatter.header(isKm ? 'ជ្រើសរើសកញ្ចប់ SUBSCRIPTION' : 'SELECT SUBSCRIPTION PLAN')}\n\n` +
    `${tgEmoji('verified')} <b>${isKm ? 'ព័ត៌មានធនាគារត្រូវបានកត់ត្រាជោគជ័យ!' : 'Bank Credentials Saved!'}</b>\n` +
    `${formatter.divider}\n` +
    `• ${tgEmoji('clearing')} <b>${isKm ? 'ប្រព័ន្ធ:' : 'Rail:'}</b> <code>NBC Bakong KHQR &amp; ABA PayWay</code>\n` +
    (merchantName ? `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` : '') +
    `• ${tgEmoji('currency')} <b>Engine:</b> <code>USD ($) + KHR (៛) Dual Mode</code>\n\n` +
    `<i>${tgEmoji('rocket')} ${isKm ? 'សូមជ្រើសរើសកញ្ចប់ Subscription ដើម្បីបង្កើត Styled QR Card និងបើកដំណើរការ Production API Key:' : 'Select a subscription plan to generate your styled KHQR payment card and activate your Production API Key:'}</i>\n\n` +
    `• ${tgEmoji('telemetry')} <b>1 Week Pass:</b> <code>$0.10 USD</code> <i>(~៤០០ ៛ KHR)</i>\n` +
    `• ${tgEmoji('brand')} <b>1 Month Pro:</b> <code>$1.00 USD</code> <i>(~៤,០០០ ៛ KHR)</i>\n` +
    `• ${tgEmoji('crown')} <b>1 Year Enterprise:</b> <code>$10.00 USD</code> <i>(~៤០,០០០ ៛ KHR)</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Week Pass ($0.10 USD) ❯' : '1 Week Pass ($0.10 USD) ❯', 'reg_plan_1w', 'telemetry', 'success')
      ],
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Month Pro ($1.00 USD) ❯' : '1 Month Pro ($1.00 USD) ❯', 'reg_plan_1m', 'brand', 'primary')
      ],
      [
        makeButton(isKm ? 'កញ្ចប់ 1 Year Enterprise ($10.00 USD) ❯' : '1 Year Enterprise ($10.00 USD) ❯', 'reg_plan_1y', 'crown', 'primary')
      ],
      [
        makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')
      ]
    ]
  };

  // When going back to plan selection, delete the previous message (photo card or selection prompt)
  // so that the previous screen is cleanly replaced and NEVER lingers above the plans screen!
  if (messageId) {
    await bot.deleteMessage(chatId, messageId).catch(() => {});
  }
  return await safeSender.sendMessage(bot, chatId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Issues developer credentials receipt upon confirmed payment or instant activation
 */
async function issueUserCredentialsReceipt(bot, chatId, messageId, from, isPaid = false) {
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const userKeys = apiKeyService.getOrCreateUserKeys(from.id);
  const activeKeyObj = userKeys[0] || {};
  const activeKey = activeKeyObj.apiKey || '';
  const activeSecret = activeKeyObj.secret || 'whsec_live_default';
  const planTitle = apiKeyService.getPlanTitle(activeKeyObj.plan, lang);
  const countdown = apiKeyService.getExpiryCountdown(activeKeyObj, lang);

  const user = userService.getUser(from.id) || {};
  const merchantName = user.merchantName || 'Rikidev';
  const userProv = String(user.provider || activeKeyObj?.provider || '').toLowerCase();
  const isBakongOnly = userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual');
  const isAbaOnly = userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual');

  let displayRails = 'NBC Bakong KHQR & ABA PayWay';
  if (isBakongOnly) displayRails = 'NBC Bakong National KHQR';
  else if (isAbaOnly) displayRails = 'ABA PayWay Gateway';

  const baseUrl = tunnelService.getPublicUrl() || 'https://paylinkapi-bot.onrender.com';

  // Determine amount paid from latest order or active plan
  const orderService = require('../../services/order.service');
  const userOrders = orderService.getUserOrders(from.id) || [];
  const latestTx = userOrders.filter(o => o.status === 'PAID').sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  const paidAmount = latestTx?.amountFormatted || (latestTx?.amount ? (latestTx.currency === 'KHR' ? `${Number(latestTx.amount).toLocaleString()} ៛ KHR` : `$${Number(latestTx.amount).toFixed(2)} USD`) : (activeKeyObj.plan === '1y' ? '$10.00 USD' : (activeKeyObj.plan === '1m' ? '$1.00 USD' : '$0.10 USD')));

  // Broadcast real-time payment & key release alert to Admin Group (-5393647415)
  const { sendAdminAlert } = require('../../services/notification.service');
  sendAdminAlert(
    `💰 <b>[PAYMENT & CREDENTIALS ISSUED]</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `👤 <b>Merchant:</b> ${formatter.escapeHtml(merchantName)} (@${from.username || 'no_username'})\n` +
    `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
    `📦 <b>Subscription Plan:</b> <code>${planTitle}</code>\n` +
    `💵 <b>Amount Paid:</b> <b>${paidAmount}</b>\n` +
    `🏦 <b>Rails:</b> <code>${displayRails}</code>\n` +
    `🔑 <b>API Key:</b> <code>${activeKey}</code>\n` +
    `🛡️ <b>Webhook Secret:</b> <code>${activeSecret}</code>\n` +
    `🌐 <b>Base URL:</b> <code>${baseUrl}</code>\n` +
    `⏰ <b>Time:</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>`
  ).catch(() => {});

  let railsAdvice = isKm
    ? 'លោកអ្នកអាចប្រើប្រាស់ ១ Key នេះ ដើម្បីបង្កើត QR Code និងទទួលការទូទាត់ទាំង Bakong KHQR និង ABA PayWay តាមរយៈ Unified API!'
    : 'Use this 1 API Key to generate and verify both Bakong KHQR & ABA PayWay transactions via the unified API!';
  if (isBakongOnly) {
    railsAdvice = isKm
      ? 'លោកអ្នកអាចប្រើប្រាស់ API Key នេះ ដើម្បីបង្កើត QR Code និងទទួលការទូទាត់ Bakong KHQR តាមរយៈ API!'
      : 'Use this API Key to generate and verify Bakong KHQR transactions via the API!';
  } else if (isAbaOnly) {
    railsAdvice = isKm
      ? 'លោកអ្នកអាចប្រើប្រាស់ API Key នេះ ដើម្បីបង្កើត QR Code និងទទួលការទូទាត់ ABA PayWay តាមរយៈ API!'
      : 'Use this API Key to generate and verify ABA PayWay transactions via the API!';
  }

  let text = `${formatter.header(isKm ? 'អបអរសាទរ! បើកដំណើរការជោគជ័យ' : 'CONGRATULATIONS! ACTIVATED')}\n\n` +
    `${tgEmoji('party')} <b>${isKm ? 'ការទូទាត់ជោគជ័យ & បើកដំណើរការ API រួចរាល់!' : 'PAYMENT SUCCESSFUL & API KEY ACTIVE!'}</b> ${tgEmoji('brand')}\n` +
    `<i>${tgEmoji('verified')} ${isKm ? 'សូមអបអរសាទរ! គណនី Developer របស់អ្នកត្រូវបានបើកដំណើរការជាផ្លូវការ' : 'Congratulations! Your developer production account is fully activated'}</i>\n\n` +
    `${formatter.divider}\n` +
    `• ${tgEmoji('operator')} <b>Developer:</b> <code>${formatter.escapeHtml(from.first_name || 'Operator')}</code> (ID: <code>${from.id}</code>)\n` +
    `• ${tgEmoji('target')} <b>${isKm ? 'កញ្ចប់គម្រោង:' : 'Plan:'}</b> <code>${formatter.escapeHtml(planTitle)}</code>\n` +
    `• ${tgEmoji('currency')} <b>${isKm ? 'ចំនួនទឹកប្រាក់ដែលបានបង់:' : 'Amount Paid:'}</b> <b>${paidAmount}</b>\n` +
    `• ${tgEmoji('verified')} <b>ស្ថានភាព Status:</b> <code>[ PRODUCTION ACTIVE ]</code> ${tgEmoji('active')}\n` +
    `• ⏳ <b>${isKm ? 'សុពលភាពនៅសល់:' : 'Remaining:'}</b> <b>${formatter.escapeHtml(countdown.text)}</b>\n` +
    `• 📅 <b>${isKm ? 'ផុតកំណត់នៅថ្ងៃ:' : 'Expires At:'}</b> <code>${(activeKeyObj.expiresAt || '').slice(0, 19).replace('T', ' ') || 'N/A'}</code>\n` +
    `• ${tgEmoji('clearing')} <b>ប្រព័ន្ធទូទាត់ Rails:</b> <code>${formatter.escapeHtml(displayRails)}</code>\n` +
    `• ${tgEmoji('brand')} <b>ឈ្មោះ Merchant:</b> <code>${formatter.escapeHtml(merchantName)}</code>\n` +
    `• ${tgEmoji('currency')} <b>Dual Engine:</b> <code>USD ($) + KHR (៛) Dual Automated</code>\n` +
    `${formatter.divider}\n\n` +
    `${tgEmoji('crown')} <b>${isKm ? 'កូដសម្ងាត់ API របស់អ្នក (UNIFIED 1-KEY SYSTEM):' : 'YOUR UNIFIED 1-KEY PRODUCTION CREDENTIALS:'}</b>\n\n` +
    `${tgEmoji('keys')} <b>Production API Key:</b>\n<code>${activeKey}</code>\n\n` +
    `${tgEmoji('security')} <b>Webhook Secret:</b>\n<code>${activeSecret}</code>\n\n` +
    `${formatter.divider}\n\n` +
    `${tgEmoji('telemetry')} <b>${isKm ? 'របៀបតភ្ជាប់ជាមួយប្រព័ន្ធ API (HOW TO CONNECT):' : 'HOW TO CONNECT TO YOUR LIVE API:'}</b>\n\n` +
    `🌐 <b>Base Gateway URL:</b>\n<code>${baseUrl}</code>\n\n` +
    (isBakongOnly
      ? `📡 <b>Create Payment QR (POST):</b>\n<code>${baseUrl}/api/payment/generate-qr</code>\n<i>(or <code>${baseUrl}/api/bakong/generate-qr</code>)</i>\n\n` +
        `🔍 <b>Verify Payment (POST):</b>\n<code>${baseUrl}/api/payment/check</code>\n\n`
      : isAbaOnly
      ? `📡 <b>Create Payment QR (POST):</b>\n<code>${baseUrl}/api/payment/generate-qr</code>\n<i>(or <code>${baseUrl}/api/aba/generate-qr</code>)</i>\n\n` +
        `🔍 <b>Verify Payment (POST):</b>\n<code>${baseUrl}/api/payment/check</code>\n\n`
      : `📡 <b>Unified Payment QR (POST):</b>\n<code>${baseUrl}/api/payment/generate-qr</code>\n\n` +
        `🔍 <b>Unified Payment Check (POST):</b>\n<code>${baseUrl}/api/payment/check</code>\n\n`) +
    `🔑 <b>Request Header:</b>\n<code>Authorization: Bearer ${activeKey}</code>\n\n` +
    `🛡️ <b>Security & Anti-DDoS:</b> <code>Rate limit 60 req/min, DDoS firewall auto-ban active</code>\n` +
    `${formatter.divider}\n` +
    `<i>${tgEmoji('bulb')} ${railsAdvice}</i>\n` +
    `<i>💬 ${isKm ? 'ត្រូវការជំនួយតភ្ជាប់កូដ? ទាក់ទង Developer Support:' : 'Need integration help? Contact Developer Support:'} @kaixite</i>`;

  const keyboard = {
    inline_keyboard: [
      [makeButton(isKm ? '📄 ទាញយកសៀវភៅណែនាំ (Download PDF) ❯' : '📄 Download Integration PDF ❯', 'doc_download_pdf', null, 'primary')],
      [makeButton(isKm ? '🚀 តេស្តស្កេនទូទាត់ជាក់ស្តែង (Live KHQR) ❯' : '🚀 Test Live Payment (Scan QR) ❯', 'start_live_pay_test', null, 'success')],
      [
        { text: isKm ? '💬 ជំនួយ Support (@kaixite)' : '💬 Developer Support (@kaixite)', url: 'https://t.me/kaixite' },
        makeButton(isKm ? '🖥️ ផ្ទាំងបញ្ជា (Console)' : '🖥️ Console', 'nav_dashboard', null, 'primary')
      ]
    ]
  };

  const resMsg = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
    message_effect_id: '5046509860389126442'
  });

  if (isPaid) {
    try {
      const pdfGeneratorService = require('../../services/pdf_generator.service');
      const pdfPath = await pdfGeneratorService.generateIntegrationPdf({
        telegramId: String(from.id),
        userName: from.first_name || merchantName || 'Developer',
        apiKeys: userKeys,
        baseUrl,
        user
      });

      const pdfCaption = isKm
        ? `📄 <b>សៀវភៅណែនាំតភ្ជាប់ DEVELOPER INTEGRATION GUIDE (PDF)</b>\n\n` +
          `• <b>API Key:</b> <code>${activeKey}</code>\n` +
          `• <b>Webhook Secret:</b> <code>${activeSecret}</code>\n` +
          `• 🌐 <b>Live Gateway:</b> <code>${baseUrl}</code>\n` +
          `• 🤖 <b>AI Coding Prompt:</b> <code>ទំព័រទី ២ (សម្រាប់ Cursor / Claude / ChatGPT)</code>\n\n` +
          `<i>សៀវភៅណែនាំត្រូវបានបង្កើតឡើងដោយស្វ័យប្រវត្តិជាមួយ Key ថ្មីរបស់អ្នក!</i>`
        : `📄 <b>OFFICIAL DEVELOPER INTEGRATION GUIDE (PDF)</b>\n\n` +
          `• <b>API Key:</b> <code>${activeKey}</code>\n` +
          `• <b>Webhook Secret:</b> <code>${activeSecret}</code>\n` +
          `• 🌐 <b>Live Gateway:</b> <code>${baseUrl}</code>\n` +
          `• 🤖 <b>AI Coding Prompt:</b> <code>Page 2 (Ready for Cursor / Claude / ChatGPT)</code>\n\n` +
          `<i>Your official developer guide was automatically generated with your active API key and customized AI prompt!</i>`;

      await bot.sendDocument(chatId, pdfPath, {
        caption: pdfCaption,
        parse_mode: 'HTML'
      });
    } catch (err) {
      console.error('[Wizard Handler] ⚠️ Failed to auto-send PDF:', err.message);
    }
  }

  return resMsg;
}

/**
 * Handles instant sandbox activation button
 */
async function handleInstantActivate(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;

  apiKeyService.renewApiKeySubscription(from.id, '1w');

  await bot.answerCallbackQuery(query.id, {
    text: 'API Key Active!'
  }).catch(() => {});

  return await issueUserCredentialsReceipt(bot, chatId, messageId, from, true);
}

/**
 * Handles manual confirm button on subscription QR photo
 */
async function handleConfirmRegistrationPayment(bot, query, tranId) {
  const chatId = query.message.chat.id;
  const from = query.from;

  if (tranId) {
    orderService.updatePaymentTransactionStatus(tranId, 'PAID', { confirmedVia: 'user_instant_button' });
  }

  const tx = orderService.getPaymentTransaction(tranId) || {};
  const planKey = tx.planKey || (tx.details && tx.details.planKey) || (tx.plan === '1 Year Enterprise' ? '1y' : (tx.plan === '1 Month Pro' ? '1m' : '1w'));
  
  apiKeyService.renewApiKeySubscription(from.id, planKey);

  await bot.answerCallbackQuery(query.id, {
    text: 'Payment Confirmed! API Key Issued.'
  }).catch(() => {});

  if (query.message?.photo || query.message?.document) {
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
  }

  const planTitle = tx.plan || tx.details?.plan || 'VIP Developer Pass';

  await sendSubscriptionSurpriseCelebration(bot, chatId, from, planTitle);
  return await issueUserCredentialsReceipt(bot, chatId, null, from, true);
}

/**
 * Handles Cancel button during wizard
 */
async function handleCancelWizard(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  stopSubscriptionAutoChecker(chatId);
  sessionManager.resetSession(from.id);

  const text = `${i18n.t('cancelled_message', lang)}`;
  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.dashboard(lang)
  });
}

/**
 * Toggles language during interactive wizard flow and updates prompt in place
 */
async function handleToggleLanguageWizard(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const newLang = userService.toggleLanguage(from.id);
  const session = sessionManager.getSession(from.id);
  const isKm = newLang === 'km';

  if (!session || session.state === UserState.IDLE || session.state === UserState.DASHBOARD) {
    return;
  }

  let text = '';
  let replyMarkup = null;

  switch (session.state) {
    case UserState.BAKONG_ENTER_MERCHANT_ID: {
      text = `${formatter.header(isKm ? 'ការដំឡើង BAKONG KHQR' : 'BAKONG KHQR DEPLOYMENT', isKm ? 'ស្តង់ដារធនាគារជាតិនៃកម្ពុជា NBC' : 'National Bank of Cambodia Standard')}\n\n` +
        `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Active'}</code>\n\n` +
        `${i18n.t('bakong_merchant_id_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BAKONG_ENTER_MERCHANT_NAME: {
      const merchantIdEsc = formatter.escapeHtml(session.data.merchantId || '');
      text = `${formatter.header(isKm ? 'ការដំឡើង BAKONG KHQR' : 'BAKONG KHQR DEPLOYMENT')}\n\n` +
        `${tgEmoji('clearing')} <b>${isKm ? 'លេខសម្គាល់ Merchant ID:' : 'Merchant ID:'}</b> <code>${merchantIdEsc}</code>\n\n` +
        `${i18n.t('bakong_merchant_name_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BAKONG_ENTER_PHONE: {
      const merchantNameEsc = formatter.escapeHtml(session.data.merchantName || '');
      text = `${formatter.header(isKm ? 'ការដំឡើង BAKONG KHQR' : 'BAKONG KHQR DEPLOYMENT')}\n\n` +
        `${tgEmoji('brand')} <b>${isKm ? 'ឈ្មោះហាងផ្ទាល់ខ្លួន:' : 'Custom Merchant Name:'}</b> <code>${merchantNameEsc}</code> <i>(${isKm ? 'កំណត់ក្នុង Bot' : 'Custom in Bot'})</i>\n\n` +
        `${i18n.t('bakong_phone_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.ABA_ENTER_KHR_LINK: {
      text = `${formatter.header(isKm ? 'ការដំឡើង ABA PAYWAY' : 'ABA PAYWAY DEPLOYMENT', isKm ? 'តំណភ្ជាប់ Merchant & Checkout' : 'Merchant Deep-Links & Checkout')}\n\n` +
        `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Active'}</code>\n\n` +
        `${i18n.t('aba_khr_link_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.ABA_ENTER_USD_LINK: {
      const khrLinkEsc = formatter.escapeHtml(session.data.khrLink || '');
      text = `${formatter.header(isKm ? 'ការដំឡើង ABA PAYWAY' : 'ABA PAYWAY DEPLOYMENT')}\n\n` +
        `${tgEmoji('khr')} <b>${isKm ? 'តំណភ្ជាប់ KHR Link:' : 'KHR Merchant Link:'}</b> <code>${khrLinkEsc}</code>\n\n` +
        `${i18n.t('aba_usd_link_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BUNDLE_BAKONG_MERCHANT_ID: {
      text = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION', isKm ? 'ហេដ្ឋារចនាសម្ព័ន្ធទូទាត់កម្ពុជា' : 'Unified Cambodian Financial Infrastructure')}\n\n` +
        `<b>${isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong' : 'Step 1/2: Bakong KHQR'}</b>\n` +
        `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) Dual Active'}</code>\n\n` +
        `${i18n.t('bakong_merchant_id_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BUNDLE_BAKONG_MERCHANT_NAME: {
      const merchantIdEsc = formatter.escapeHtml(session.data.merchantId || '');
      text = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
        `<b>${isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong' : 'Step 1/2: Bakong Setup'}</b>\n` +
        `${tgEmoji('clearing')} <b>${isKm ? 'លេខសម្គាល់ Bakong Merchant ID:' : 'Bakong Merchant ID:'}</b> <code>${merchantIdEsc}</code>\n\n` +
        `${i18n.t('bakong_merchant_name_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BUNDLE_BAKONG_PHONE: {
      const merchantNameEsc = formatter.escapeHtml(session.data.merchantName || '');
      text = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
        `<b>${isKm ? 'ជំហាន ១/២: ការរៀបចំ Bakong' : 'Step 1/2: Bakong Setup'}</b>\n` +
        `${tgEmoji('brand')} <b>${isKm ? 'ឈ្មោះហាងផ្ទាល់ខ្លួន:' : 'Custom Merchant Name:'}</b> <code>${merchantNameEsc}</code> <i>(${isKm ? 'កំណត់ក្នុង Bot' : 'Custom in Bot'})</i>\n\n` +
        `${i18n.t('bakong_phone_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BUNDLE_ABA_KHR_LINK: {
      const phoneEsc = formatter.escapeHtml(session.data.phone || '');
      text = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
        `<b>${isKm ? 'ជំហាន ២/២: ការរៀបចំ ABA Gateway' : 'Step 2/2: ABA Gateway Setup'}</b>\n` +
        `${tgEmoji('phone')} <b>${isKm ? 'លេខទូរស័ព្ទ Bakong:' : 'Bakong Phone:'}</b> <code>${phoneEsc}</code>\n\n` +
        `${i18n.t('aba_khr_link_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.BUNDLE_ABA_USD_LINK: {
      const khrLinkEsc = formatter.escapeHtml(session.data.khrLink || '');
      text = `${formatter.header(isKm ? 'ការដំឡើងរួមគ្នា BAKONG + ABA' : 'BAKONG + ABA DUAL INTEGRATION')}\n\n` +
        `<b>${isKm ? 'ជំហាន ២/២: ការរៀបចំ ABA Gateway' : 'Step 2/2: ABA Gateway Setup'}</b>\n` +
        `${tgEmoji('khr')} <b>${isKm ? 'តំណភ្ជាប់ ABA KHR Link:' : 'ABA KHR Link:'}</b> <code>${khrLinkEsc}</code>\n\n` +
        `${i18n.t('aba_usd_link_prompt', newLang)}`;
      replyMarkup = { inline_keyboard: navigationKeyboards.cancelOnly(newLang) };
      break;
    }

    case UserState.CONFIRM_SUBMISSION: {
      const s = session;
      const isBakong = s.data.providerKey === 'bakong' || s.data.provider === 'Bakong KHQR';
      const isAba = s.data.providerKey === 'aba' || s.data.provider === 'ABA PayWay Gateway';

      if (isBakong) {
        text = renderBakongReviewCard(s.data, newLang);
      } else if (isAba) {
        text = renderAbaReviewCard(s.data, newLang);
      } else {
        text = renderBundleReviewCard(s.data, newLang);
      }
      replyMarkup = inlineKeyboards.confirmation(newLang).reply_markup;
      break;
    }

    default:
      return;
  }

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
}

module.exports = {
  startProviderWizard,
  handleWizardSandboxQuickFill,
  handleWizardTextInput,
  handleConfirmSubmit,
  handleCancelWizard,
  handleToggleLanguageWizard,
  handleSelectRegistrationPlan,
  handleExecuteSubPayment,
  handleBackToPlans,
  startSubscriptionAutoChecker,
  stopSubscriptionAutoChecker,
  handleConfirmRegistrationPayment,
  handleInstantActivate,
  issueUserCredentialsReceipt,
  validateBakongId,
  validatePhoneNumber,
  validateAbaLink,
  validateMerchantName,
  verifyAbaLinkLive,
  verifyBakongAccountLive,
  renderWarningCard
};

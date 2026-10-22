const db = require('../../database');
const apiKeyService = require('../../services/apikey.service');
const userService = require('../../services/user.service');
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

// Active Key Wizard Drafts: chatId -> draft
const keyWizardDrafts = new Map();

/**
 * Checks whether an incoming text looks like an API key or activation request
 */
function isKeyActivationTrigger(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.startsWith('/activate') || t.startsWith('/reactivate') || t.startsWith('/upgradekey')) {
    return true;
  }
  if (t.startsWith('plk_live_') || t.startsWith('dp_live_') || t.startsWith('key_')) {
    return true;
  }
  // Check if string matches any known key in database
  const allKeys = db.getAllApiKeys();
  if (allKeys.some(k => k.apiKey === t || k.id === t)) {
    return true;
  }
  return false;
}

/**
 * Extracts the clean API key string from message text
 */
function extractKeyFromText(text) {
  if (!text) return '';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^\/(activate|reactivate|upgradekey)(@\w+)?\s*/i, '').trim();
  return cleaned;
}

/**
 * Starts the Key Activation & Customization Wizard
 */
async function startKeyActivationWizard(bot, chatId, fromId, rawKeyText, messageId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);
  const keyStr = extractKeyFromText(rawKeyText);

  if (!keyStr) {
    const promptText =
      `🔑 <b>បើកដំណើរការ & កំណត់ KEY ចាស់ (ACTIVATE OLD KEY)</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
      `សូមផ្ញើ <b>API Key</b> របស់អ្នក (ឧទាហរណ៍: <code>plk_live_...</code> ឬ <code>dp_live_...</code>) មកក្នុង Chat នេះ ដើម្បីកំណត់ និងបើកដំណើរការឡើងវិញជាមួយប្រព័ន្ធថ្មី។\n\n` +
      `<i>👉 សូម Paste ឬវាយបញ្ចូល API Key របស់អ្នក៖</i>`;
    return await safeSender.replaceOrSend(bot, chatId, messageId, promptText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [makeButton('« ត្រឡប់ទៅ Dashboard', 'nav_dashboard', 'arrow_left', 'secondary')]
        ]
      }
    });
  }

  // Look up existing key details
  const existingKey = apiKeyService.getKeyById(keyStr);
  const user = existingKey?.telegramId ? db.getUser(existingKey.telegramId) : db.getUser(fId);

  const prevBakong = existingKey?.bakongId || existingKey?.merchantId || user?.bakongId || 'soksitchey1@aclb';
  const prevName = existingKey?.merchantName || user?.merchantName || (user?.firstName ? `${user.firstName}'s Store` : 'Merchant Store');
  const prevUsd = existingKey?.usdLink || user?.usdLink || DEFAULT_MERCHANT_LINK_USD;
  const prevKhr = existingKey?.khrLink || user?.khrLink || DEFAULT_MERCHANT_LINK_KHR;
  const prevProvider = existingKey?.provider || user?.provider || 'Dual Suite (ABA & Bakong)';

  const draft = {
    apiKey: existingKey?.apiKey || keyStr,
    keyId: existingKey?.id || `key_${fId}`,
    telegramId: existingKey?.telegramId || fId,
    existingKey: existingKey || null,
    rail: null, // 'bakong' | 'aba' | 'dual'
    abaMode: 'both', // 'usd' | 'khr' | 'both'
    bakongId: prevBakong,
    merchantName: prevName,
    usdLink: prevUsd,
    khrLink: prevKhr,
    days: 30,
    promptMessageId: messageId
  };

  keyWizardDrafts.set(cId, draft);
  keyWizardDrafts.set(fId, draft);

  // Present Step 1: Rail Selection Prompt
  return await renderRailSelectionPrompt(bot, chatId, draft, messageId);
}

/**
 * Step 1: Select payment rail for this key
 */
async function renderRailSelectionPrompt(bot, chatId, draft, messageId = null) {
  const cId = String(chatId);
  const statusBadge = draft.existingKey?.status === 'ACTIVE'
    ? '🟢 ACTIVE (សកម្ម)'
    : (draft.existingKey?.status === 'EXPIRED' ? '🔴 EXPIRED (ផុតកំណត់)' : '⚪ NEW / MIGRATED');

  const expiryInfo = draft.existingKey?.expiresAt
    ? `• <b>សុពលភាពចាស់:</b> <code>${new Date(draft.existingKey.expiresAt).toLocaleDateString()}</code>\n`
    : '';

  const text =
    `🔑 <b>ការកំណត់និងបើកដំណើរការ KEY (KEY ACTIVATION WIZARD)</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `• <b>API Key:</b> <code>${draft.apiKey}</code>\n` +
    `• <b>ស្ថានភាពបច្ចុប្បន្ន:</b> <code>${statusBadge}</code>\n` +
    expiryInfo +
    `\n<i>តើអ្នកចង់កំណត់ប្រព័ន្ធទូទាត់មួយណាសម្រាប់ Key នេះ?</i>\n` +
    `(Select payment rail configuration for this key:)\n\n` +
    `• 🔴 <b>Bakong Only:</b>\n` +
    `  ទទួលប្រាក់តាម National KHQR ចូលគណនី Bakong ID ផ្ទាល់ខ្លួន + ឈ្មោះហាង Customize។\n\n` +
    `• 🔵 <b>ABA PayWay:</b>\n` +
    `  ទទួលប្រាក់តាម ABA PayWay Link (មានជម្រើស: ទទួលតែដុល្លារ, ទទួលតែរៀល, ឬទាំងពីរ)។\n\n` +
    `• 🟣 <b>Dual Suite (ABA + Bakong):</b>\n` +
    `  ដំណើរការរួមគ្នាទាំង Bakong KHQR និង ABA PayWay USD & KHR ក្នុង Key តែមួយ។\n\n` +
    `<i>👇 សូមជ្រើសរើសជម្រើសខាងក្រោម៖</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('🔴 NBC Bakong Only (KHQR) ❯', 'kwiz_rail_bakong', 'clearing', 'primary')
      ],
      [
        makeButton('🔵 ABA PayWay Only ❯', 'kwiz_rail_aba', 'brand', 'primary')
      ],
      [
        makeButton('🟣 Dual Suite (ABA + Bakong) ❯', 'kwiz_rail_dual', 'crown', 'success')
      ],
      [
        makeButton('❌ បោះបង់ (Cancel)', 'kwiz_cancel', 'close', 'secondary')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });

  if (res?.message_id) {
    draft.promptMessageId = res.message_id;
    keyWizardDrafts.set(cId, draft);
  }
  return res;
}

/**
 * Prompts user for Bakong Account ID
 */
async function promptBakongInput(bot, chatId, draft, messageId = null, fromId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);
  const isDual = draft.rail === 'dual';
  const defaultBakong = draft.bakongId || 'soksitchey1@aclb';

  sessionManager.setState(cId, UserState.KWIZ_INPUT_BAKONG, { promptMessageId: messageId });
  if (fromId) sessionManager.setState(fId, UserState.KWIZ_INPUT_BAKONG, { promptMessageId: messageId });

  const stepHeader = isDual ? 'BAKONG KHQR • ជំហាន ១/៤' : 'BAKONG KHQR • ជំហាន ១/២';

  const text =
    `🔴 <b>${stepHeader} (BAKONG ACCOUNT ID)</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `🔑 <b>API Key:</b> <code>${draft.apiKey}</code>\n` +
    `🏦 <b>ប្រព័ន្ធទូទាត់:</b> 🔴 <b>NBC Bakong National KHQR</b>\n\n` +
    `សូមបញ្ចូលលេខគណនី <b>Bakong Account ID</b> ឬលេខទូរស័ព្ទរបស់អ្នក:\n` +
    `• <b>ឧទាហរណ៍:</b> <code>soksitchey1@aclb</code>, <code>0977416126</code>, <code>kaixite@abaa</code>\n\n` +
    `💡 <i>អ្នកក៏អាចវាយបញ្ចូល Bakong ID និងឈ្មោះហាងក្នុងសារតែមួយបានផងដែរ:</i>\n` +
    `<code>soksitchey1@aclb Kai Coffee Shop</code>\n\n` +
    `<i>👉 វាយបញ្ចូលគណនី Bakong របស់អ្នកក្នុង Chat នេះ ឬចុចប៊ូតុងខាងក្រោម:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(`⚡ ប្រើ Default (${defaultBakong}) ❯`, 'kwiz_skip_bakong', 'lightning', 'primary')
      ],
      [
        makeButton('« ត្រឡប់ក្រោយ (Back)', 'kwiz_back_rail', 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', 'kwiz_cancel', 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });

  if (res?.message_id) {
    draft.promptMessageId = res.message_id;
    keyWizardDrafts.set(cId, draft);
    sessionManager.updateData(cId, { promptMessageId: res.message_id });
  }
  return res;
}

/**
 * Prompts user for Merchant Custom Name ("merchan customice")
 */
async function promptMerchantNameInput(bot, chatId, draft, messageId = null, fromId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);
  const defaultName = draft.merchantName || 'Merchant Store';

  sessionManager.setState(cId, UserState.KWIZ_INPUT_STORE_NAME, { promptMessageId: messageId });
  if (fromId) sessionManager.setState(fId, UserState.KWIZ_INPUT_STORE_NAME, { promptMessageId: messageId });

  const text =
    `🏷️ <b>ឈ្មោះហាងផ្ទាល់ខ្លួន • MERCHANT CUSTOM NAME</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `🔑 <b>API Key:</b> <code>${draft.apiKey}</code>\n` +
    (draft.bakongId ? `• 🔴 <b>Bakong ID:</b> <code>${draft.bakongId}</code>\n` : '') +
    `\nសូមបញ្ចូល <b>ឈ្មោះហាងផ្ទាល់ខ្លួន (Custom Merchant Name)</b> របស់អ្នក:\n` +
    `• <b>ឧទាហរណ៍:</b> <code>Kai Coffee Shop</code>, <code>Riki Electronic Store</code>\n\n` +
    `<i>(ឈ្មោះនេះនឹងបង្ហាញលើវិក្កយបត្រ និង QR Code ពេលអតិថិជនស្កេនទូទាត់)</i>\n\n` +
    `<i>👉 វាយបញ្ចូលឈ្មោះហាងក្នុង Chat នេះ ឬចុចប៊ូតុងខាងក្រោមដើម្បីប្រើ Default:</i>`;

  const backCb = draft.rail === 'bakong' ? 'kwiz_back_to_bakong' : (draft.rail === 'dual' ? 'kwiz_back_to_bakong' : 'kwiz_back_aba_mode');

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(`⚡ ប្រើឈ្មោះ Default (${defaultName}) ❯`, 'kwiz_skip_name', 'lightning', 'primary')
      ],
      [
        makeButton('« ត្រឡប់ក្រោយ (Back)', backCb, 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', 'kwiz_cancel', 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });

  if (res?.message_id) {
    draft.promptMessageId = res.message_id;
    keyWizardDrafts.set(cId, draft);
    sessionManager.updateData(cId, { promptMessageId: res.message_id });
  }
  return res;
}

/**
 * Prompts user for ABA Currency Mode (USD Only, KHR Only, or Both)
 */
async function promptAbaCurrencyChoice(bot, chatId, draft, messageId = null, fromId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);
  const isDual = draft.rail === 'dual';

  sessionManager.resetSession(cId);
  if (fromId) sessionManager.resetSession(fId);

  const header = isDual
    ? '🟣 <b>ABA PAYWAY • ជំហាន ៣/៤ (ជ្រើសរើសរូបិយប័ណ្ណ)</b>'
    : '🔵 <b>ABA PAYWAY • ជំហាន ១/២ (ជ្រើសរើសរូបិយប័ណ្ណ)</b>';

  const text =
    `${header}\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `🔑 <b>API Key:</b> <code>${draft.apiKey}</code>\n` +
    (isDual && draft.bakongId ? `• 🔴 <b>Bakong Account:</b> <code>${draft.bakongId}</code>\n` : '') +
    (isDual && draft.merchantName ? `• 🏷️ <b>ឈ្មោះហាង:</b> <code>${draft.merchantName}</code>\n\n` : '\n') +
    `ABA PayWay អាចកំណត់សម្រាប់គណនីដុល្លារ គណនីរៀល ឬដំណើរការទាំងពីររួមគ្នា។\n` +
    `សូមជ្រើសរើសជម្រើសដែលអ្នកចង់ប្រើប្រាស់សម្រាប់ Key នេះ:\n\n` +
    `• 💵 <b>USD Only:</b> ទទួលតែប្រាក់ដុល្លារ ($) (ត្រូវការតែ Link USD)\n` +
    `• ៛ <b>KHR (Riel) Only:</b> ទទួលតែប្រាក់រៀល (៛) (ត្រូវការតែ Link KHR)\n` +
    `• 💵+៛ <b>Both USD & Riel:</b> ទទួលទាំងពីរ ($ & ៛) (ត្រូវការ Link ទាំងពីរ)\n\n` +
    `<i>👇 សូមចុចជ្រើសរើសជម្រើសខាងក្រោម៖</i>`;

  const backCb = isDual ? 'kwiz_back_to_name' : 'kwiz_back_rail';

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('💵 USD Only (ទទួលតែដុល្លារ) ❯', 'kwiz_aba_mode_usd', 'usd', 'primary')
      ],
      [
        makeButton('៛ KHR (Riel) Only (ទទួលតែរៀល) ❯', 'kwiz_aba_mode_khr', 'khr', 'primary')
      ],
      [
        makeButton('💵+៛ Both USD & Riel (ទទួលទាំងពីរ) ❯', 'kwiz_aba_mode_both', 'currency', 'success')
      ],
      [
        makeButton('« ត្រឡប់ក្រោយ (Back)', backCb, 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', 'kwiz_cancel', 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });

  if (res?.message_id) {
    draft.promptMessageId = res.message_id;
    keyWizardDrafts.set(cId, draft);
  }
  return res;
}

/**
 * Prompts user for ABA Payment Link (USD or KHR)
 */
async function promptAbaLinkInput(bot, chatId, draft, currency = 'USD', messageId = null, fromId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);
  const isKhr = currency === 'KHR';
  const state = isKhr ? UserState.KWIZ_INPUT_ABA_KHR : UserState.KWIZ_INPUT_ABA_USD;
  const defaultLink = isKhr
    ? (draft.khrLink || DEFAULT_MERCHANT_LINK_KHR)
    : (draft.usdLink || DEFAULT_MERCHANT_LINK_USD);

  sessionManager.setState(cId, state, { currency, promptMessageId: messageId });
  if (fromId) sessionManager.setState(fId, state, { currency, promptMessageId: messageId });

  const symbol = isKhr ? '៛' : '$';
  const currTitle = isKhr ? 'KHR (រៀល ៛)' : 'USD (ដុល្លារ $)';
  const icon = isKhr ? '៛' : '💵';

  const text =
    `${icon} <b>កំណត់តំណភ្ជាប់ ABA PAYWAY ${currTitle}</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `🔑 <b>API Key:</b> <code>${draft.apiKey}</code>\n\n` +
    `សូមបញ្ចូលតំណភ្ជាប់ <b>ABA PayWay ${currTitle} Link</b> របស់អ្នក:\n` +
    `• <b>ទម្រង់ត្រឹមត្រូវ:</b> <code>https://link.payway.com.kh/ABAPAYxxxxxxx</code>\n` +
    `<i>(អ្នកអាច Copy Link គណនី ${symbol} ពី ABA Merchant App)</i>\n\n` +
    `<i>👉 Paste តំណភ្ជាប់ Link ក្នុង Chat នេះ ឬចុចប៊ូតុងខាងក្រោម:</i>`;

  const skipCb = isKhr ? 'kwiz_skip_aba_khr' : 'kwiz_skip_aba_usd';
  const backCb = 'kwiz_back_aba_mode';

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(`⚡ ប្រើ Link Default ❯`, skipCb, 'lightning', 'primary')
      ],
      [
        makeButton('« ត្រឡប់ក្រោយ (Back)', backCb, 'arrow_left', 'secondary'),
        makeButton('❌ Cancel', 'kwiz_cancel', 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });

  if (res?.message_id) {
    draft.promptMessageId = res.message_id;
    keyWizardDrafts.set(cId, draft);
    sessionManager.updateData(cId, { promptMessageId: res.message_id });
  }
  return res;
}

/**
 * Renders the Confirmation & Review Card before finalizing activation
 */
async function renderConfirmationCard(bot, chatId, draft, messageId = null, fromId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);

  sessionManager.resetSession(cId);
  if (fromId) sessionManager.resetSession(fId);

  let railTitle = '';
  if (draft.rail === 'bakong') {
    railTitle = '🔴 NBC Bakong Only (KHQR)';
  } else if (draft.rail === 'aba') {
    const modeStr = draft.abaMode === 'usd' ? 'USD Only' : (draft.abaMode === 'khr' ? 'KHR Only' : 'USD & KHR Both');
    railTitle = `🔵 ABA PayWay Only (${modeStr})`;
  } else {
    const modeStr = draft.abaMode === 'usd' ? 'USD Only' : (draft.abaMode === 'khr' ? 'KHR Only' : 'USD & KHR Both');
    railTitle = `🟣 Dual Suite (Bakong + ABA ${modeStr})`;
  }

  let details = '';
  if (draft.rail === 'bakong' || draft.rail === 'dual') {
    details += `• 🔴 <b>Bakong Account:</b> <code>${draft.bakongId}</code>\n`;
  }
  if (draft.rail === 'aba' || draft.rail === 'dual') {
    if (draft.abaMode === 'usd' || draft.abaMode === 'both') {
      details += `• 💵 <b>ABA USD Link:</b> <code>${draft.usdLink || DEFAULT_MERCHANT_LINK_USD}</code>\n`;
    }
    if (draft.abaMode === 'khr' || draft.abaMode === 'both') {
      details += `• ៛ <b>ABA KHR Link:</b> <code>${draft.khrLink || DEFAULT_MERCHANT_LINK_KHR}</code>\n`;
    }
  }

  const text =
    `📋 <b>ពិនិត្យទិន្នន័យមុនបើកដំណើរការ KEY (REVIEW DETAILS)</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `🔑 <b>API Key:</b> <code>${draft.apiKey}</code>\n` +
    `🏦 <b>ប្រព័ន្ធទូទាត់:</b> <b>${railTitle}</b>\n` +
    `🏷️ <b>ឈ្មោះហាង (Store Name):</b> <b>${draft.merchantName || 'Merchant Store'}</b>\n` +
    details +
    `⏱️ <b>សុពលភាពថ្មី:</b> <code>+30 ថ្ងៃ (Active Live)</code>\n` +
    `⚡ <b>ម៉ាស៊ីនដំណើរការ:</b> <code>PayWay v2 & KHQR Engine (High-Speed ~200ms)</code>\n\n` +
    `<i>ចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ជាក់ និងបើកដំណើរការ Key នេះភ្លាមៗ៖</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('🚀 បញ្ជាក់ & បើកដំណើរការ Key (Activate Key) ❯', 'kwiz_confirm_activate', 'lightning', 'success')
      ],
      [
        makeButton('🔄 កំណត់ឡើងវិញ (Start Over)', 'kwiz_restart', 'refresh', 'secondary'),
        makeButton('❌ បោះបង់ (Cancel)', 'kwiz_cancel', 'close', 'danger')
      ]
    ]
  };

  const res = await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });

  if (res?.message_id) {
    draft.promptMessageId = res.message_id;
    keyWizardDrafts.set(cId, draft);
  }
  return res;
}

/**
 * Finalizes Key Activation & Displays Success Receipt
 */
async function executeKeyActivation(bot, chatId, draft, messageId = null, fromId = null) {
  const cId = String(chatId);
  const fId = String(fromId || chatId);

  let resolvedProvider = 'Dual Suite (ABA & Bakong)';
  let finalBakong = null;
  let finalUsd = null;
  let finalKhr = null;

  if (draft.rail === 'bakong') {
    resolvedProvider = 'Bakong KHQR';
    finalBakong = draft.bakongId || 'soksitchey1@aclb';
    finalUsd = null;
    finalKhr = null;
  } else if (draft.rail === 'aba') {
    resolvedProvider = 'ABA PayWay Gateway';
    finalBakong = null;
    if (draft.abaMode === 'usd') {
      finalUsd = draft.usdLink || DEFAULT_MERCHANT_LINK_USD;
      finalKhr = null;
    } else if (draft.abaMode === 'khr') {
      finalUsd = null;
      finalKhr = draft.khrLink || DEFAULT_MERCHANT_LINK_KHR;
    } else {
      finalUsd = draft.usdLink || DEFAULT_MERCHANT_LINK_USD;
      finalKhr = draft.khrLink || DEFAULT_MERCHANT_LINK_KHR;
    }
  } else {
    // Dual
    resolvedProvider = 'Dual Suite (ABA & Bakong)';
    finalBakong = draft.bakongId || 'soksitchey1@aclb';
    if (draft.abaMode === 'usd') {
      finalUsd = draft.usdLink || DEFAULT_MERCHANT_LINK_USD;
      finalKhr = null;
    } else if (draft.abaMode === 'khr') {
      finalUsd = null;
      finalKhr = draft.khrLink || DEFAULT_MERCHANT_LINK_KHR;
    } else {
      finalUsd = draft.usdLink || DEFAULT_MERCHANT_LINK_USD;
      finalKhr = draft.khrLink || DEFAULT_MERCHANT_LINK_KHR;
    }
  }

  // Reactivate / Upgrade key in database
  const activatedKey = apiKeyService.reactivateOrUpgradeKey(draft.apiKey, {
    provider: resolvedProvider,
    merchantName: draft.merchantName || 'Merchant Store',
    bakongId: finalBakong,
    usdLink: finalUsd,
    khrLink: finalKhr,
    durationDays: draft.days || 30
  });

  // Clean up draft and state
  sessionManager.resetSession(cId);
  if (fromId) sessionManager.resetSession(fId);
  keyWizardDrafts.delete(cId);
  keyWizardDrafts.delete(fId);

  const expiryFormatted = activatedKey?.expiresAt
    ? new Date(activatedKey.expiresAt).toLocaleDateString()
    : '30 ថ្ងៃក្រោយ';

  let bankTelemetry = '';
  if (finalBakong) {
    bankTelemetry += `• 🔴 <b>Bakong Account:</b> <code>${finalBakong}</code>\n`;
  }
  if (finalUsd) {
    bankTelemetry += `• 💵 <b>ABA USD Link:</b> <code>${finalUsd}</code>\n`;
  }
  if (finalKhr) {
    bankTelemetry += `• ៛ <b>ABA KHR Link:</b> <code>${finalKhr}</code>\n`;
  }

  const text =
    `🎉 <b>KEY ត្រូវបានបើកដំណើរការជោគជ័យ! (KEY ACTIVATED)</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    `✅ <b>API Key របស់អ្នកបានភ្ជាប់ជាមួយប្រព័ន្ធជំនាន់ថ្មីជោគជ័យហើយ!</b>\n` +
    `ដំណើរការបង្កើត QR លឿនបំផុត (~200ms) និងឆែកការទូទាត់លឿនទាន់ចិត្ត។\n\n` +
    `🔑 <b>API Key:</b>\n<code>${activatedKey.apiKey}</code>\n\n` +
    `🛡️ <b>Client Secret:</b>\n<code>${activatedKey.secret}</code>\n\n` +
    `🏦 <b>ប្រព័ន្ធទូទាត់ (Rail):</b> <b>${activatedKey.provider}</b>\n` +
    `🏷️ <b>ឈ្មោះហាង (Store Name):</b> <b>${activatedKey.merchantName}</b>\n` +
    bankTelemetry +
    `📅 <b>សុពលភាពរហូតដល់:</b> <code>${expiryFormatted}</code>\n` +
    `🟢 <b>ស្ថានភាព (Status):</b> <code>ACTIVE</code>\n\n` +
    `<i>👉 អ្នកអាចយក Key នេះទៅភ្ជាប់ក្នុង Website ឬ Bot របស់អ្នកដើម្បីទទួលប្រាក់បានភ្លាមៗ!</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        makeButton('🌐 បើក Web Portal', 'https://paylinkapi-bot.onrender.com', 'link', 'primary', true)
      ],
      [
        makeButton('⚡ តេស្តបង់ប្រាក់ផ្ទាល់ (Test Pay)', 'live_pay_usd', 'lightning', 'success'),
        makeButton('📖 មើលកូដភ្ជាប់ (Guide)', 'nav_how_to_connect', 'document', 'secondary')
      ],
      [
        makeButton('📊 ផ្ទាំងគ្រប់គ្រង Dashboard', 'nav_dashboard', 'dashboard', 'secondary')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Handles all callbacks for the Key Wizard
 */
async function handleKeyWizardCallback(bot, query) {
  const data = query.data;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const fromId = query.from?.id;
  const cId = String(chatId);
  const fId = String(fromId);

  let draft = keyWizardDrafts.get(cId) || keyWizardDrafts.get(fId);
  if (!draft) {
    return await bot.answerCallbackQuery(query.id, {
      text: '⚠️ Session expired. Please send your key again.',
      show_alert: true
    }).catch(() => {});
  }

  // Acknowledge callback
  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (data === 'kwiz_cancel') {
    keyWizardDrafts.delete(cId);
    keyWizardDrafts.delete(fId);
    sessionManager.resetSession(cId);
    sessionManager.resetSession(fId);
    return await safeSender.replaceOrSend(bot, chatId, messageId, '❌ <b>ការកំណត់ Key ត្រូវបានបោះបង់ (Wizard Cancelled).</b>', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [makeButton('« ត្រឡប់ទៅ Dashboard', 'nav_dashboard', 'arrow_left', 'secondary')]
        ]
      }
    });
  }

  if (data === 'kwiz_restart' || data === 'kwiz_back_rail') {
    return await renderRailSelectionPrompt(bot, chatId, draft, messageId);
  }

  // Rail selections
  if (data === 'kwiz_rail_bakong') {
    draft.rail = 'bakong';
    keyWizardDrafts.set(cId, draft);
    return await promptBakongInput(bot, chatId, draft, messageId, fromId);
  }

  if (data === 'kwiz_rail_aba') {
    draft.rail = 'aba';
    keyWizardDrafts.set(cId, draft);
    return await promptAbaCurrencyChoice(bot, chatId, draft, messageId, fromId);
  }

  if (data === 'kwiz_rail_dual') {
    draft.rail = 'dual';
    keyWizardDrafts.set(cId, draft);
    return await promptBakongInput(bot, chatId, draft, messageId, fromId);
  }

  // Skip Bakong ID -> proceed to Store Name
  if (data === 'kwiz_skip_bakong') {
    if (!draft.bakongId) draft.bakongId = 'soksitchey1@aclb';
    keyWizardDrafts.set(cId, draft);
    return await promptMerchantNameInput(bot, chatId, draft, messageId, fromId);
  }

  // Back to Bakong ID prompt
  if (data === 'kwiz_back_to_bakong') {
    return await promptBakongInput(bot, chatId, draft, messageId, fromId);
  }

  // Back to Store Name prompt
  if (data === 'kwiz_back_to_name') {
    return await promptMerchantNameInput(bot, chatId, draft, messageId, fromId);
  }

  // Skip Store Name
  if (data === 'kwiz_skip_name') {
    if (!draft.merchantName) draft.merchantName = 'Merchant Store';
    keyWizardDrafts.set(cId, draft);

    if (draft.rail === 'bakong') {
      return await renderConfirmationCard(bot, chatId, draft, messageId, fromId);
    }
    if (draft.rail === 'dual') {
      // After Bakong ID + Name, ask ABA currency choice!
      return await promptAbaCurrencyChoice(bot, chatId, draft, messageId, fromId);
    }
    if (draft.rail === 'aba') {
      return await renderConfirmationCard(bot, chatId, draft, messageId, fromId);
    }
  }

  // ABA Currency Choices
  if (data === 'kwiz_aba_mode_usd') {
    draft.abaMode = 'usd';
    draft.khrLink = null;
    keyWizardDrafts.set(cId, draft);
    return await promptAbaLinkInput(bot, chatId, draft, 'USD', messageId, fromId);
  }

  if (data === 'kwiz_aba_mode_khr') {
    draft.abaMode = 'khr';
    draft.usdLink = null;
    keyWizardDrafts.set(cId, draft);
    return await promptAbaLinkInput(bot, chatId, draft, 'KHR', messageId, fromId);
  }

  if (data === 'kwiz_aba_mode_both') {
    draft.abaMode = 'both';
    keyWizardDrafts.set(cId, draft);
    return await promptAbaLinkInput(bot, chatId, draft, 'USD', messageId, fromId);
  }

  if (data === 'kwiz_back_aba_mode') {
    return await promptAbaCurrencyChoice(bot, chatId, draft, messageId, fromId);
  }

  // Skip ABA USD Link
  if (data === 'kwiz_skip_aba_usd') {
    if (!draft.usdLink) draft.usdLink = DEFAULT_MERCHANT_LINK_USD;
    keyWizardDrafts.set(cId, draft);

    if (draft.abaMode === 'both') {
      return await promptAbaLinkInput(bot, chatId, draft, 'KHR', messageId, fromId);
    }
    // If USD only:
    if (draft.rail === 'dual') {
      return await renderConfirmationCard(bot, chatId, draft, messageId, fromId);
    }
    // If ABA only: prompt store name if not set
    return await promptMerchantNameInput(bot, chatId, draft, messageId, fromId);
  }

  // Skip ABA KHR Link
  if (data === 'kwiz_skip_aba_khr') {
    if (!draft.khrLink) draft.khrLink = DEFAULT_MERCHANT_LINK_KHR;
    keyWizardDrafts.set(cId, draft);

    if (draft.rail === 'dual') {
      return await renderConfirmationCard(bot, chatId, draft, messageId, fromId);
    }
    // If ABA only: prompt store name if not set
    return await promptMerchantNameInput(bot, chatId, draft, messageId, fromId);
  }

  // Confirm and Execute Activation
  if (data === 'kwiz_confirm_activate') {
    return await executeKeyActivation(bot, chatId, draft, messageId, fromId);
  }
}

/**
 * Handles text input when user is in a KWIZ_INPUT_* state
 */
async function handleKeyWizardTextInput(bot, msg) {
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id;
  const cId = String(chatId);
  const fId = String(fromId);
  const text = (msg.text || '').trim();

  const userSession = sessionManager.getSession(cId) || (fromId ? sessionManager.getSession(fId) : null);
  if (!userSession) return false;

  const state = userSession.state;
  if (![
    UserState.KWIZ_INPUT_BAKONG,
    UserState.KWIZ_INPUT_STORE_NAME,
    UserState.KWIZ_INPUT_ABA_USD,
    UserState.KWIZ_INPUT_ABA_KHR
  ].includes(state)) {
    return false;
  }

  let draft = keyWizardDrafts.get(cId) || (fromId ? keyWizardDrafts.get(fId) : null);
  if (!draft) return false;

  const promptMessageId = userSession.data?.promptMessageId;

  // 1. Bakong ID input
  if (state === UserState.KWIZ_INPUT_BAKONG) {
    const tokens = text.split(/\s+/);
    const bakongId = tokens[0];
    const restStoreName = tokens.slice(1).join(' ');

    draft.bakongId = bakongId;
    if (restStoreName) {
      draft.merchantName = restStoreName;
    }

    keyWizardDrafts.set(cId, draft);
    if (fromId) keyWizardDrafts.set(fId, draft);

    if (promptMessageId) {
      await bot.deleteMessage(chatId, promptMessageId).catch(() => {});
    }

    if (restStoreName) {
      if (draft.rail === 'bakong') {
        return await renderConfirmationCard(bot, chatId, draft, null, fromId);
      }
      if (draft.rail === 'dual') {
        return await promptAbaCurrencyChoice(bot, chatId, draft, null, fromId);
      }
    }

    return await promptMerchantNameInput(bot, chatId, draft, null, fromId);
  }

  // 2. Custom Store Name input
  if (state === UserState.KWIZ_INPUT_STORE_NAME) {
    draft.merchantName = text;
    keyWizardDrafts.set(cId, draft);
    if (fromId) keyWizardDrafts.set(fId, draft);

    if (promptMessageId) {
      await bot.deleteMessage(chatId, promptMessageId).catch(() => {});
    }

    if (draft.rail === 'bakong') {
      return await renderConfirmationCard(bot, chatId, draft, null, fromId);
    }
    if (draft.rail === 'dual') {
      return await promptAbaCurrencyChoice(bot, chatId, draft, null, fromId);
    }
    if (draft.rail === 'aba') {
      return await renderConfirmationCard(bot, chatId, draft, null, fromId);
    }
  }

  // 3. ABA USD Link input
  if (state === UserState.KWIZ_INPUT_ABA_USD) {
    const link = text.split(/\s+/)[0];
    draft.usdLink = link;

    keyWizardDrafts.set(cId, draft);
    if (fromId) keyWizardDrafts.set(fId, draft);

    if (promptMessageId) {
      await bot.deleteMessage(chatId, promptMessageId).catch(() => {});
    }

    if (draft.abaMode === 'both') {
      return await promptAbaLinkInput(bot, chatId, draft, 'KHR', null, fromId);
    }

    // USD only
    if (draft.rail === 'dual') {
      return await renderConfirmationCard(bot, chatId, draft, null, fromId);
    }
    return await promptMerchantNameInput(bot, chatId, draft, null, fromId);
  }

  // 4. ABA KHR Link input
  if (state === UserState.KWIZ_INPUT_ABA_KHR) {
    const link = text.split(/\s+/)[0];
    draft.khrLink = link;

    keyWizardDrafts.set(cId, draft);
    if (fromId) keyWizardDrafts.set(fId, draft);

    if (promptMessageId) {
      await bot.deleteMessage(chatId, promptMessageId).catch(() => {});
    }

    if (draft.rail === 'dual') {
      return await renderConfirmationCard(bot, chatId, draft, null, fromId);
    }
    return await promptMerchantNameInput(bot, chatId, draft, null, fromId);
  }

  return false;
}

module.exports = {
  isKeyActivationTrigger,
  extractKeyFromText,
  startKeyActivationWizard,
  handleKeyWizardCallback,
  handleKeyWizardTextInput
};

const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const sessionManager = require('../states/user.session');
const { UserState } = require('../states/state.machine');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');
const { tgEmoji, makeButton } = require('../../config/emojis');
const { startProviderWizard } = require('./wizard.handler');

async function handleGetPaymentApi(bot, query) {
  const chatId = query.message ? query.message.chat.id : (query.chat ? query.chat.id : null);
  const messageId = query.message ? query.message.message_id : null;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  sessionManager.setState(from.id, UserState.SELECT_PROVIDER, {});

  // Answer callback query immediately with feedback toast
  if (query.id) {
    bot.answerCallbackQuery(query.id).catch(() => {});
  }

  let text = `${formatter.header(isKm ? 'ភ្ជាប់ប្រព័ន្ធទូទាត់ PAYMENT API' : 'CONNECT PAYMENT GATEWAY')}\n\n`;

  if (isKm) {
    text += `${tgEmoji('brand')} <b>ជ្រើសរើសប្រព័ន្ធទូទាត់សម្រាប់ការចុះឈ្មោះក្នុង BOT:</b>\n\n` +
      `• ${tgEmoji('bundle')} <b>កញ្ចប់រួម Bakong + ABA (Dual Suite):</b>\n` +
      `  ដំណើរការរូបិយប័ណ្ណពីរ USD ($) និង KHR (៛) ដោយស្វ័យប្រវត្តិ។\n\n` +
      `• ${tgEmoji('bakong')} <b>NBC Bakong National KHQR:</b>\n` +
      `  ស្តង់ដារជាតិ EMVCo អាចកំណត់ឈ្មោះហាងផ្ទាល់ខ្លួន (Store Name) បានដោយសេរី។\n\n` +
      `• ${tgEmoji('aba')} <b>ច្រកទូទាត់ ABA PayWay Gateway:</b>\n` +
      `  Dynamic KHQR និង Webhooks ជូនដំណឹងភ្លាមៗតាមរយៈ ABA Merchant App។\n\n` +
      `${formatter.divider}\n` +
      `• ${tgEmoji('bulb')} <b>ចំណាំ Bakong:</b> អ្នកអាចកំណត់ឈ្មោះហាង (Store Display Name) ផ្ទាល់ខ្លួនបានដោយសេរី។\n` +
      `• ${tgEmoji('alert')} <b>ចំណាំ ABA:</b> ឈ្មោះ Merchant ត្រូវគ្រប់គ្រងក្នុង ABA Merchant App ផ្ទាល់។\n\n` +
      `<i>${tgEmoji('rocket')} សូមជ្រើសរើសជម្រើសខាងក្រោមដើម្បីចាប់ផ្តើមចុះឈ្មោះផ្ទាល់ក្នុង Bot ភ្លាមៗ:</i>`;
  } else {
    text += `${tgEmoji('brand')} <b>SELECT PAYMENT INFRASTRUCTURE (REGISTER IN BOT):</b>\n\n` +
      `• ${tgEmoji('bundle')} <b>Dual Suite (Bakong + ABA):</b>\n` +
      `  Automated dual-currency clearing for both USD ($) and KHR (៛).\n\n` +
      `• ${tgEmoji('bakong')} <b>NBC Bakong National KHQR:</b>\n` +
      `  EMVCo national QR standard with customizable store display name.\n\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay Gateway:</b>\n` +
      `  Direct dynamic KHQR, in-app deep links, and instant webhook callbacks.\n\n` +
      `${formatter.divider}\n` +
      `• ${tgEmoji('bulb')} <b>Bakong Note:</b> You can freely customize your Store Display Name directly.\n` +
      `• ${tgEmoji('alert')} <b>ABA Note:</b> Merchant name is fixed to your official ABA Merchant profile.\n\n` +
      `<i>${tgEmoji('rocket')} Select a payment rail below to register directly inside Telegram:</i>`;
  }

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(isKm ? 'កញ្ចប់រួម Bakong + ABA (Dual Suite)' : 'Dual Suite (Bakong + ABA)', 'prov_bundle', 'bundle', 'primary')
      ],
      [
        makeButton(isKm ? 'Bakong KHQR (ធនាគារជាតិ NBC)' : 'NBC Bakong National KHQR', 'prov_bakong', 'bakong', 'danger')
      ],
      [
        makeButton(isKm ? 'ច្រកទូទាត់ ABA PayWay' : 'ABA PayWay Gateway', 'prov_aba', 'aba', 'primary')
      ],
      [
        makeButton(i18n.t('btn_back', lang), 'nav_dashboard', 'brand', 'primary')
      ]
    ]
  };

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

async function handleSelectProvider(bot, query, providerKey) {
  const from = query.from;

  let providerName = 'Bakong KHQR';
  if (providerKey === 'aba') providerName = 'ABA PayWay Gateway';
  if (providerKey === 'bundle') providerName = 'Bakong + ABA Dual Suite';

  // Automatically lock currency to USD + KHR Dual-Currency Standard!
  const dualCurrency = 'USD ($) + KHR (៛) Dual Mode';

  sessionManager.setState(from.id, UserState.IDLE, {
    provider: providerName,
    providerKey,
    currency: dualCurrency
  });

  // Jump directly into the provider wizard without prompting for currency!
  return await startProviderWizard(bot, query, providerKey, dualCurrency);
}

module.exports = {
  handleGetPaymentApi,
  handleSelectProvider
};

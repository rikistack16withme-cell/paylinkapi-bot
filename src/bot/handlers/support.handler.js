const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const navigationKeyboards = require('../keyboards/navigation.keyboards');
const formatter = require('../../utils/formatter');
const { tgEmoji } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');

async function handleSupport(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const text = `${formatter.header(isKm ? 'ផ្នែកជំនួយបច្ចេកទេស & សុវត្ថិភាព' : 'ENGINEERING SUPPORT & SECURITY', isKm ? 'ក្រុមប្រឹក្សាផ្ទាល់សម្រាប់ Developers' : 'Direct Developer Advisory')}\n\n` +
    `👤 <b>${isKm ? 'អ្នកប្រឹក្សាបច្ចេកទេសផ្ទាល់:' : 'Direct Support Specialist:'}</b> @kaixite\n` +
    `🔗 <b>${isKm ? 'Telegram ផ្ទាល់:' : 'Direct Chat:'}</b> https://t.me/kaixite\n\n` +
    `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) DUAL-ACTIVE'}</code>\n\n` +
    `${i18n.t('support_body', lang)}`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.support(lang)
  });
}

async function handleHelpCenter(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const text = isKm
    ? `${formatter.header('មជ្ឈមណ្ឌលជំនួយ & FAQs')}\n\n` +
      `<b>សំណួរ: តើខ្ញុំអាចតេស្តប្រព័ន្ធទូទាត់ក្នុង Phase 1 យ៉ាងដូចម្តេច?</b>\n` +
      `ចម្លើយ: Phase 1 គឺជាប្រព័ន្ធ UI/UX Skeleton។ Live Sandbox Checkout នឹងបើកដំណើរការក្នុង Phase 2។\n\n` +
      `<b>សំណួរ: តើខ្ញុំអាចភ្ជាប់ Bakong KHQR ដោយផ្ទាល់បានទេ?</b>\n` +
      `ចម្លើយ: បាន! ប្រព័ន្ធរបស់យើងគាំទ្រការបង្កើត NBC Bakong KHQR dynamic និង static ដោយផ្ទាល់។\n\n` +
      `<b>សំណួរ: តើមានការគាំទ្រ ABA PayWay ដែរឬទេ?</b>\n` +
      `ចម្លើយ: មាន, យើងគាំទ្រ PayWay Card Checkout និង Deep-Link Payments ពេញលេញ។\n\n` +
      `<i>ទាក់ទងក្រុមបច្ចេកទេសសម្រាប់ការពិគ្រោះយោបល់បន្ថែម។</i>`
    : `${formatter.header('Help Center & FAQs')}\n\n` +
      `<b>Q: How do I test payments in Phase 1?</b>\n` +
      `A: Phase 1 is a UI/UX skeleton. Live sandbox checkout endpoints will be unlocked in Phase 2.\n\n` +
      `<b>Q: Can I integrate Bakong KHQR directly?</b>\n` +
      `A: Yes! Our unified API supports direct NBC Bakong KHQR dynamic and static QR generation.\n\n` +
      `<b>Q: Is ABA PayWay supported?</b>\n` +
      `A: Yes, PayWay card checkout and deep-link payments are supported.\n\n` +
      `<i>Contact developer support for bespoke architectural reviews.</i>`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: navigationKeyboards.backAndDashboard('nav_support', lang)
    }
  });
}

module.exports = {
  handleSupport,
  handleHelpCenter
};

const path = require('path');
const fs = require('fs');
const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const apiKeyService = require('../../services/apikey.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const sessionManager = require('../states/user.session');
const formatter = require('../../utils/formatter');
const safeSender = require('../../utils/safe_sender');
const { tgEmoji } = require('../../config/emojis');
const db = require('../../database');

async function renderDashboard(bot, chatId, messageId, from) {
  const lang = userService.getUserLanguage(from.id);
  const firstName = formatter.escapeHtml(from.first_name || (lang === 'km' ? 'អ្នកអភិវឌ្ឍន៍' : 'Developer'));
  const isKm = lang === 'km';

  sessionManager.resetSession(from.id);

  const userKeys = apiKeyService.getUserApiKeys(from.id);
  let subBanner = '';
  if (userKeys && userKeys.length > 0) {
    const key = userKeys[0];
    const countdown = apiKeyService.getExpiryCountdown(key, lang);
    const planTitle = apiKeyService.getPlanTitle(key.plan, lang, key);
    const badge = countdown.isExpired
      ? `${tgEmoji('alert')} <b>[ EXPIRED ]</b>`
      : (countdown.isExpiringSoon ? `${tgEmoji('pending')} <b>[ EXPIRING SOON ]</b>` : `${tgEmoji('active')} <b>[ ACTIVE ]</b>`);

    subBanner = `\n` +
      `${tgEmoji('orders')} <b>${isKm ? 'គម្រោងសកម្ម:' : 'Active Plan:'}</b> <code>${formatter.escapeHtml(planTitle)}</code>  ${badge}\n` +
      `${tgEmoji('pending')} <b>${isKm ? 'សុពលភាពនៅសល់:' : 'Validity Remaining:'}</b> <b>${formatter.escapeHtml(countdown.text)}</b>\n` +
      (countdown.isExpired
        ? `<i>${tgEmoji('alert')} ${isKm ? 'គម្រោងបានផុតកំណត់! សូមចុច «កូដសម្ងាត់ (API Keys)» ដើម្បីបន្តគម្រោង។' : 'Subscription expired! Open "API Keys" to renew.'}</i>\n`
        : '') +
      `${formatter.divider}\n`;
  }

  let text = `${formatter.telemetryCard(firstName, from.id, lang)}\n` +
    subBanner +
    `\n${i18n.t('dash_subtitle', lang)}`;

  if (!from.username) {
    text += `\n\n${tgEmoji('bulb')} <i>Tip: Set a Telegram @username in settings so administrators and customers can contact you directly!</i>`;
  }

  const DEFAULT_TUTORIAL_VIDEO_FILE_ID = 'BAACAgUAAxkDAAIDymrCKtEM3ofNvGi8irMmnWsaPFLTAALQIwACA7EQVglJ85y6pMwBPQQ';
  const cachedVideoId = db.getSetting('tutorial_video_file_id', DEFAULT_TUTORIAL_VIDEO_FILE_ID);
  const mp4Path = path.join(process.cwd(), 'videoteach', 'tutorial.mp4');
  const movPath = path.join(process.cwd(), 'videoteach', 'IMG_5873.MOV');
  const videoFile = fs.existsSync(mp4Path) ? mp4Path : (fs.existsSync(movPath) ? movPath : null);
  const videoSource = cachedVideoId || videoFile;

  if (videoSource) {
    try {
      const sent = await safeSender.replaceOrSendVideo(bot, chatId, messageId, videoSource, text, {
        parse_mode: 'HTML',
        ...inlineKeyboards.dashboard(lang)
      }, {
        filename: 'paylinkapi_tutorial.mp4',
        contentType: 'video/mp4'
      });

      if (sent?.video?.file_id) {
        db.setSetting('tutorial_video_file_id', sent.video.file_id);
      }
      return sent;
    } catch (_) {
      // Graceful fallback to text message if video send encounters issue
    }
  }

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.dashboard(lang)
  });
}

module.exports = {
  renderDashboard
};

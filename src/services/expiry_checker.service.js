const db = require('../database');
const userService = require('./user.service');
const safeSender = require('../utils/safe_sender');
const formatter = require('../utils/formatter');
const { tgEmoji, makeButton } = require('../config/emojis');
const logger = require('../utils/logger');

class ExpiryCheckerService {
  constructor() {
    this.intervalTimer = null;
    this.bot = null;
    this.checkIntervalMs = 15 * 60 * 1000; // Check every 15 minutes
    this.isRunning = false;
  }

  /**
   * Starts the background scheduler
   */
  start(botInstance) {
    if (this.isRunning) return;
    this.bot = botInstance;
    this.isRunning = true;

    logger.info('✓ Background API Key Subscription Expiry Checker started (15-min cycle)');

    // Run initial scan after 5 seconds on startup
    setTimeout(() => {
      this.checkAllKeys().catch(err => {
        logger.error('Error during initial expiry check:', err.message);
      });
    }, 5000);

    // Recurring cycle
    this.intervalTimer = setInterval(() => {
      this.checkAllKeys().catch(err => {
        logger.error('Error in scheduled expiry check:', err.message);
      });
    }, this.checkIntervalMs);
  }

  /**
   * Stops the background scheduler
   */
  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    logger.info('Background API Key Expiry Checker stopped.');
  }

  /**
   * Scans all keys for 1-day advance warnings and auto-expirations
   */
  async checkAllKeys() {
    db.reload();
    const allKeys = db.getAllApiKeys();
    if (!allKeys || allKeys.length === 0) return;

    const now = Date.now();

    for (const key of allKeys) {
      if (!key.expiresAt || !key.telegramId) continue;

      const expiryTime = new Date(key.expiresAt).getTime();
      const diffMs = expiryTime - now;

      // 1. Auto-Expiration & Revocation Check (Time expired)
      if (diffMs <= 0) {
        if (key.status !== 'EXPIRED') {
          key.status = 'EXPIRED';
          logger.warn(`[EXPIRY REVOKED] API Key ${key.id} (Owner: ${key.telegramId}) has EXPIRED. Marked INACTIVE.`);

          // Send deactivation notification to user
          if (!key.expiredNoticeSent && this.bot) {
            await this.sendExpiredNotice(key).catch(err => {
              logger.warn(`Could not dispatch expired notice to ${key.telegramId}:`, err.message);
            });
            key.expiredNoticeSent = true;
          }

          db.saveApiKey(key);
        }
        continue;
      }

      // 2. 1-Day Advance Warning Check (Less than 24 hours remaining)
      if (diffMs <= 24 * 60 * 60 * 1000 && key.status === 'ACTIVE') {
        if (!key.expiryWarningSent) {
          logger.info(`[EXPIRY WARNING] Key ${key.id} expires in < 24 hours. Dispatching alert to ${key.telegramId}...`);

          if (this.bot) {
            await this.sendOneDayWarning(key, diffMs).catch(err => {
              logger.warn(`Could not dispatch 1-day warning to ${key.telegramId}:`, err.message);
            });
          }

          key.expiryWarningSent = true;
          db.saveApiKey(key);
        }
      }
    }
  }

  /**
   * Sends 1-Day Advance Expiry Warning Announcement to User
   */
  async sendOneDayWarning(key, diffMs) {
    const telegramId = key.telegramId;
    const lang = userService.getUserLanguage(telegramId) || 'km';
    const isKm = lang === 'km';

    const remainingHours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));

    const title = isKm
      ? 'ប្រកាសអាសន្ន: កូដ API KEY ជិតផុតកំណត់'
      : 'ALERT: API KEY EXPIRING IN 24 HOURS';

    const warningText = isKm
      ? `${tgEmoji('alert')} <b>${title}</b>\n` +
        `${formatter.divider}\n\n` +
        `• ${tgEmoji('keys')} <b>កូដ API Key:</b> <code>${key.apiKey}</code>\n` +
        `• ${tgEmoji('brand')} <b>ហាង Merchant:</b> <code>${formatter.escapeHtml(key.merchantName || 'Merchant Store')}</code>\n` +
        `• ⏳ <b>រយៈពេលដែលនៅសល់:</b> <b>ប្រហែល ${remainingHours} ម៉ោងទៀត</b>\n` +
        `• 📅 <b>កាលបរិច្ឆេទផុតកំណត់:</b> <code>${new Date(key.expiresAt).toLocaleString('km-KH', { timeZone: 'Asia/Phnom_Penh' })} (GMT+7)</code>\n\n` +
        `${formatter.divider}\n` +
        `⚠️ <b>ចំណាំសំខាន់ (IMPORTANT NOTICE):</b>\n` +
        `នៅពេលដល់ម៉ោងផុតកំណត់ រាល់ការទូទាត់ និងការបង្កើត QR Code តាមរយៈ API Key នេះនឹងត្រូវផ្អាកដំណើរការជាបណ្តោះអាសន្ន (Suspended)។\n\n` +
        `<i>${tgEmoji('rocket')} ដើម្បីកុំឱ្យដាច់ចរន្តទូទាត់លើ Website ឬ App របស់អ្នក សូមចុចប៊ូតុងខាងក្រោមដើម្បីបន្តគម្រោងឡើងវិញ:</i>`
      : `${tgEmoji('alert')} <b>${title}</b>\n` +
        `${formatter.divider}\n\n` +
        `• ${tgEmoji('keys')} <b>API Key:</b> <code>${key.apiKey}</code>\n` +
        `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(key.merchantName || 'Merchant Store')}</code>\n` +
        `• ⏳ <b>Time Remaining:</b> <b>Approximately ${remainingHours} Hours</b>\n` +
        `• 📅 <b>Exact Expiry:</b> <code>${new Date(key.expiresAt).toUTCString()}</code>\n\n` +
        `${formatter.divider}\n` +
        `⚠️ <b>IMPORTANT NOTICE:</b>\n` +
        `Upon expiration, all QR code generations and payment check verifications will be suspended automatically.\n\n` +
        `<i>${tgEmoji('rocket')} To maintain uninterrupted payment services for your customers, please renew your plan now:</i>`;

    const keyboard = {
      inline_keyboard: [
        [makeButton(isKm ? '🔄 បន្តសុពលភាពឥឡូវនេះ (Renew Plan) ❯' : '🔄 Renew Subscription Now ❯', 'sub_back_plans', 'rocket', 'success')],
        [makeButton(isKm ? '📊 ផ្ទាំងគ្រប់គ្រង Dashboard' : '📊 View Dashboard', 'nav_dashboard', 'operator', 'primary')]
      ]
    };

    return await safeSender.sendMessage(this.bot, telegramId, warningText, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  /**
   * Sends Expiration Deactivation Notice to User
   */
  async sendExpiredNotice(key) {
    const telegramId = key.telegramId;
    const lang = userService.getUserLanguage(telegramId) || 'km';
    const isKm = lang === 'km';

    const title = isKm
      ? 'កូដ API KEY បានផុតកំណត់ (SUBSCRIPTION EXPIRED)'
      : 'SUBSCRIPTION EXPIRED • API DEACTIVATED';

    const expiredText = isKm
      ? `🔴 <b>${title}</b>\n` +
        `${formatter.divider}\n\n` +
        `• ${tgEmoji('keys')} <b>កូដ API Key:</b> <code>${key.apiKey}</code>\n` +
        `• ${tgEmoji('brand')} <b>ហាង Merchant:</b> <code>${formatter.escapeHtml(key.merchantName || 'Merchant Store')}</code>\n` +
        `• 🔴 <b>ស្ថានភាព Status:</b> <b>[ EXPIRED / REVOKED ]</b>\n` +
        `• 📅 <b>ផុតកំណត់កាលពី:</b> <code>${new Date(key.expiresAt).toLocaleString('km-KH', { timeZone: 'Asia/Phnom_Penh' })} (GMT+7)</code>\n\n` +
        `${formatter.divider}\n` +
        `🛑 <b>ប្រព័ន្ធបានបិទដំណើរការស្វ័យប្រវត្តិ:</b>\n` +
        `រាល់សំណើបង្កើត QR Code និងការត្រួតពិនិត្យការទូទាត់តាមរយៈ API Key នេះនឹងត្រូវបដិសេធ (HTTP 403 API_KEY_EXPIRED)។\n\n` +
        `<i>${tgEmoji('pointer')} សូមចុចប៊ូតុងខាងក្រោមដើម្បីជ្រើសរើសកញ្ចប់ និងបើកដំណើរការឡើងវិញភ្លាមៗ:</i>`
      : `🔴 <b>${title}</b>\n` +
        `${formatter.divider}\n\n` +
        `• ${tgEmoji('keys')} <b>API Key:</b> <code>${key.apiKey}</code>\n` +
        `• ${tgEmoji('brand')} <b>Merchant:</b> <code>${formatter.escapeHtml(key.merchantName || 'Merchant Store')}</code>\n` +
        `• 🔴 <b>Status:</b> <b>[ EXPIRED / REVOKED ]</b>\n` +
        `• 📅 <b>Expired At:</b> <code>${new Date(key.expiresAt).toUTCString()}</code>\n\n` +
        `${formatter.divider}\n` +
        `🛑 <b>API ACCESS SUSPENDED:</b>\n` +
        `All incoming payment requests using this key will now be rejected with HTTP 403 API_KEY_EXPIRED.\n\n` +
        `<i>${tgEmoji('pointer')} Tap below to select a subscription plan and reactivate your payment gateway instantly:</i>`;

    const keyboard = {
      inline_keyboard: [
        [makeButton(isKm ? '🚀 បើកដំណើរការឡើងវិញ (Reactivate Plan) ❯' : '🚀 Reactivate Subscription ❯', 'sub_back_plans', 'rocket', 'success')],
        [makeButton(isKm ? '📊 ផ្ទាំងគ្រប់គ្រង Dashboard' : '📊 View Dashboard', 'nav_dashboard', 'operator', 'primary')]
      ]
    };

    return await safeSender.sendMessage(this.bot, telegramId, expiredText, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
}

module.exports = new ExpiryCheckerService();

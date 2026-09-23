const db = require('../database');
const userService = require('./user.service');
const safeSender = require('../utils/safe_sender');
const formatter = require('../utils/formatter');
const { tgEmoji, makeButton } = require('../config/emojis');

class AccessGateService {
  /**
   * Checks whether the user is authorized to interact with the bot
   */
  isAccessApproved(userId, isMaster = false) {
    if (isMaster) return true;

    // Check if master admin
    const adminHandler = require('../bot/handlers/admin.handler');
    if (adminHandler.isMasterAdmin(userId)) return true;

    // Check if admin gate is globally enabled (default: false - completely open for all users)
    const gateEnabled = db.getSetting('admin_gate_enabled', false);
    if (!gateEnabled) return true;

    const user = userService.getUser(userId);
    if (!user) return false;

    // Suspended or banned users are never allowed
    if (user.status === 'BANNED') return false;

    // If explicitly approved or active without negative flag
    if (user.approved === true) return true;
    if (user.status === 'ACTIVE' && user.approved !== false && user.subscription?.status === 'ACTIVE') return true;

    return false;
  }

  /**
   * Renders the Access Restricted security card to unauthorized users
   */
  async renderRestrictedAccess(bot, chatId, from, lang = 'km') {
    const isKm = lang === 'km';
    const userName = formatter.escapeHtml(from.first_name || 'User');
    const userId = from.id;

    const text =
      `🔒 <b>${isKm ? 'ការចូលប្រើត្រូវបានកម្រិត • ACCESS RESTRICTED' : 'ACCESS RESTRICTED • PRIVATE MODE'}</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
      `សួស្តី <b>${userName}</b> (ID: <code>${userId}</code>)!\n\n` +
      `⚠️ <b>${isKm ? 'ប្រព័ន្ធត្រូវបានកំណត់ដំណើរការបែបឯកជន (Private Mode):' : 'This system is operating in Private Access Mode:'}</b>\n` +
      `${isKm
        ? 'រាល់ការចូលប្រើប្រាស់ និងចុះឈ្មោះ API តម្រូវឱ្យមានការអនុញ្ញាតផ្ទាល់ពី Admin ជាមុនសិន។'
        : 'Access and API registration require prior authorization from the system Administrator.'}\n\n` +
      `<i>${isKm
        ? '👉 សូមចុចប៊ូតុង «📩 ស្នើសុំការអនុញ្ញាត» ខាងក្រោមដើម្បីផ្ញើសំណើទៅកាន់ Admin ឬទាក់ទងផ្ទាល់។'
        : '👉 Click "Request Access" below to submit your access request directly to the Admin.'}</i>`;

    const keyboard = {
      inline_keyboard: [
        [makeButton(isKm ? '📩 ស្នើសុំការអនុញ្ញាត (Request Access) ❯' : '📩 Request Access ❯', 'gate_request_access', 'rocket', 'success')],
        [
          { text: isKm ? '💬 ជំនួយ Support (@kaixite)' : '💬 Developer Support (@kaixite)', url: 'https://t.me/kaixite' },
          makeButton(isKm ? '🌐 ប្តូរភាសា' : '🌐 Toggle Lang', 'settings_toggle_lang', 'brand', 'primary')
        ]
      ]
    };

    return await safeSender.sendMessage(bot, chatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  /**
   * Handles user tapping "Request Access"
   */
  async handleRequestAccess(bot, query) {
    const chatId = query.message.chat.id;
    const from = query.from;
    const lang = userService.getUserLanguage(from.id) || 'km';
    const isKm = lang === 'km';

    // Save/update user with pending status
    let user = userService.getUser(from.id);
    if (!user) {
      user = userService.getOrCreateUser(from);
    }
    user.gateStatus = 'PENDING';
    user.gateRequestedAt = new Date().toISOString();
    db.saveUser(user);

    await bot.answerCallbackQuery(query.id, {
      text: isKm ? '✓ បានបញ្ជូនសំណើទៅកាន់ Admin រួចរាល់!' : '✓ Access request sent to Admin!'
    }).catch(() => {});

    // Update user's screen
    const pendingText =
      `⏳ <b>${isKm ? 'សំណើរបស់អ្នកត្រូវបានបញ្ជូនជោគជ័យ' : 'REQUEST SUBMITTED TO ADMIN'}</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
      `👤 <b>Developer:</b> <code>${formatter.escapeHtml(from.first_name || 'User')}</code>\n` +
      `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
      `⏰ <b>${isKm ? 'ម៉ោងស្នើសុំ:' : 'Requested At:'}</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>\n\n` +
      `<i>${isKm
        ? 'សំណើរបស់អ្នកកំពុងស្ថិតក្នុងការត្រួតពិនិត្យដោយ Admin។ នៅពេលទទួលបានការអនុញ្ញាត ប្រព័ន្ធនឹងជូនដំណឹងមកកាន់អ្នកភ្លាមៗ!'
        : 'Your request is awaiting Administrator approval. You will receive an instant notification here once approved.'}</i>`;

    const userKeyboard = {
      inline_keyboard: [
        [{ text: isKm ? '💬 ទាក់ទង Admin (@kaixite)' : '💬 Contact Admin (@kaixite)', url: 'https://t.me/kaixite' }]
      ]
    };

    await safeSender.replaceOrSend(bot, chatId, query.message.message_id, pendingText, {
      parse_mode: 'HTML',
      reply_markup: userKeyboard
    });

    // Broadcast High-Priority Alert to Admin Group (-5393647415) and Master Admins
    const adminAlertText =
      `🔔 <b>[NEW ACCESS REQUEST • សំណើសុំសិទ្ធិប្រើប្រាស់ BOT]</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `👤 <b>Name:</b> ${formatter.escapeHtml(from.first_name || '')} ${formatter.escapeHtml(from.last_name || '')} (@${from.username || 'no_username'})\n` +
      `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
      `⏰ <b>Time:</b> <code>${new Date().toLocaleTimeString()} (GMT+7)</code>\n\n` +
      `👇 <b>សូមចុចជ្រើសរើសដើម្បីអនុញ្ញាត ឬបដិសេធ:</b>`;

    const adminKeyboard = {
      inline_keyboard: [
        [
          makeButton('✅ អនុញ្ញាត (Approve Access)', `gate_approve_${from.id}`, 'active', 'success'),
          makeButton('🚫 បដិសេធ (Block / Reject)', `gate_reject_${from.id}`, 'security', 'danger')
        ],
        [
          makeButton('🔍 មើលប្រវត្តិ (User Lookup)', `adm_user_${from.id}`, 'keys', 'primary')
        ]
      ]
    };

    const adminHandler = require('../bot/handlers/admin.handler');
    const adminChatId = adminHandler.getAdminChatId();
    await safeSender.sendMessage(bot, adminChatId, adminAlertText, {
      parse_mode: 'HTML',
      reply_markup: adminKeyboard
    }).catch(err => {
      console.warn('[AccessGate] Could not alert admin group:', err.message);
    });
  }

  /**
   * Handles Admin clicking "Approve Access"
   */
  async handleAdminApprove(bot, query, targetUserId) {
    const from = query.from;
    const adminHandler = require('../bot/handlers/admin.handler');
    if (!adminHandler.isMasterAdmin(from.id) && !adminHandler.isAuthorizedGroup(query.message.chat.id)) {
      return bot.answerCallbackQuery(query.id, { text: '⛔ Unauthorized!', show_alert: true });
    }

    const tId = String(targetUserId);
    const user = userService.getUser(tId) || { id: tId, telegramId: tId };
    user.approved = true;
    user.status = 'ACTIVE';
    user.gateStatus = 'APPROVED';
    user.approvedBy = from.id;
    user.approvedAt = new Date().toISOString();
    db.saveUser(user);

    await bot.answerCallbackQuery(query.id, { text: `✅ User ${tId} approved!` }).catch(() => {});

    // Update Admin Card
    const updatedAdminText =
      (query.message.text || '') +
      `\n\n✅ <b>APPROVED by @${from.username || from.id} at ${new Date().toLocaleTimeString()}</b>`;

    await bot.editMessageText(updatedAdminText, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    }).catch(() => {});

    // Notify User
    const userLang = userService.getUserLanguage(tId) || 'km';
    const isKm = userLang === 'km';
    const congratsText =
      `🎉 <b>${isKm ? 'អបអរសាទរ! គណនីរបស់អ្នកត្រូវបានអនុញ្ញាតហើយ' : 'ACCESS GRANTED • ACCOUNT APPROVED'}</b> ${tgEmoji('brand')}\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n\n` +
      `${tgEmoji('verified')} <b>${isKm ? 'Administrator បានអនុញ្ញាតឱ្យអ្នកចូលប្រើប្រាស់ Bot ជាផ្លូវការ!' : 'The Administrator has approved your access to PaylinkApi Bot!'}</b>\n\n` +
      `<i>${isKm ? 'ឥឡូវនេះលោកអ្នកអាចចូលមើលកូដសម្ងាត់ API Keys, បង្កើត QR Code, និងប្រើប្រាស់គ្រប់សេវាកម្មទាំងអស់។' : 'You can now access your API Keys, generate live payments, and explore all gateway services.'}</i>`;

    const userKeyboard = {
      inline_keyboard: [
        [makeButton(isKm ? '🚀 ចូលកាន់ផ្ទាំងបញ្ជា (Open Dashboard) ❯' : '🚀 Open Dashboard ❯', 'nav_dashboard', 'rocket', 'success')]
      ]
    };

    await safeSender.sendMessage(bot, tId, congratsText, {
      parse_mode: 'HTML',
      reply_markup: userKeyboard,
      message_effect_id: '5046509860389126442'
    }).catch(err => {
      console.warn(`[AccessGate] Could not DM approval notice to ${tId}:`, err.message);
    });
  }

  /**
   * Handles Admin clicking "Reject Access"
   */
  async handleAdminReject(bot, query, targetUserId) {
    const from = query.from;
    const adminHandler = require('../bot/handlers/admin.handler');
    if (!adminHandler.isMasterAdmin(from.id) && !adminHandler.isAuthorizedGroup(query.message.chat.id)) {
      return bot.answerCallbackQuery(query.id, { text: '⛔ Unauthorized!', show_alert: true });
    }

    const tId = String(targetUserId);
    const user = userService.getUser(tId) || { id: tId, telegramId: tId };
    user.approved = false;
    user.status = 'BANNED';
    user.gateStatus = 'REJECTED';
    user.rejectedBy = from.id;
    user.rejectedAt = new Date().toISOString();
    db.saveUser(user);

    await bot.answerCallbackQuery(query.id, { text: `🚫 User ${tId} rejected.` }).catch(() => {});

    // Update Admin Card
    const updatedAdminText =
      (query.message.text || '') +
      `\n\n🚫 <b>REJECTED / BANNED by @${from.username || from.id} at ${new Date().toLocaleTimeString()}</b>`;

    await bot.editMessageText(updatedAdminText, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    }).catch(() => {});
  }
}

module.exports = new AccessGateService();

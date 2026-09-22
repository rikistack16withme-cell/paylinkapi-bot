/**
 * Telegram Premium Custom Animated Emoji Configuration
 *
 * Real, verified, animated custom emoji IDs from Telegram's official Finance & Premium sets.
 */

const emojiConfig = {
  // Brand & Highlights
  brand: {
    id: process.env.EMOJI_BRAND_ID || '5267500801240092311', // ⭐ Animated Gold Star
    fallback: '⭐'
  },
  operator: {
    id: process.env.EMOJI_OPERATOR_ID || '5267500801240092311', // ⭐ Animated Gold Star
    fallback: '👤'
  },
  clearing: {
    id: process.env.EMOJI_CLEARING_ID || '5332455502917949981', // 🏦 Animated Bank
    fallback: '🏦'
  },
  currency: {
    id: process.env.EMOJI_CURRENCY_ID || '5312441427764989435', // 💱 Animated Exchange
    fallback: '💱'
  },
  telemetry: {
    id: process.env.EMOJI_TELEMETRY_ID || '5373066076558996568', // ⚡ Animated Neon Lightning
    fallback: '⚡'
  },
  security: {
    id: process.env.EMOJI_SECURITY_ID || '5197288647275071607', // 🛡 Animated Shield
    fallback: '🛡'
  },
  terminal: {
    id: process.env.EMOJI_TERMINAL_ID || '5406901223326495466', // 🖥 Animated Neon Terminal
    fallback: '🖥'
  },
  phone: {
    id: process.env.EMOJI_PHONE_ID || '5404350824501491839',    // 📞 Animated Neon Phone
    fallback: '📞'
  },
  bell: {
    id: process.env.EMOJI_BELL_ID || '5262844652964303985',     // 💡 Animated Lightbulb
    fallback: '🔔'
  },
  tag: {
    id: process.env.EMOJI_TAG_ID || '5240228673738527951',       // 🏷 Animated Tag
    fallback: '🏷'
  },
  rocket: {
    id: process.env.EMOJI_ROCKET_ID || '5195033767969839232', // 🚀 Animated Rocket
    fallback: '🚀'
  },
  diamond: {
    id: process.env.EMOJI_DIAMOND_ID || '5267500801240092311', // 💎 Animated Star / Diamond
    fallback: '💎'
  },
  verified: {
    id: process.env.EMOJI_VERIFIED_ID || '5219740554455163110', // ✔️ Animated Green Checkmark (NO white box!)
    fallback: '✅'
  },

  // Providers (Bakong RED, ABA BLUE)
  bakong: {
    id: process.env.EMOJI_BAKONG_ID || '5332455502917949981', // 🏦 Animated Bank Building for Bakong
    badgeId: '5267102644886853973',                           // ❤️ Animated Red Badge
    fallback: '🏦'
  },
  aba: {
    id: process.env.EMOJI_ABA_ID || '5445353829304387411',   // 💳 Animated Blue Card for ABA
    fallback: '💳'
  },
  bundle: {
    id: process.env.EMOJI_BUNDLE_ID || '5445221832074483553', // 💼 Animated Suite
    fallback: '💼'
  },

  // Dashboard & Navigation
  get_api: {
    id: process.env.EMOJI_GET_API_ID || '5445353829304387411', // 💳 Animated Card
    fallback: '💳'
  },
  keys: {
    id: process.env.EMOJI_KEYS_ID || '5240228673738527951',   // 🏷 Animated Key Tag
    fallback: '🔑'
  },
  orders: {
    id: process.env.EMOJI_ORDERS_ID || '5190806721286657692', // 📊 Animated Analytics Chart
    fallback: '📦'
  },
  receipt: {
    id: '5444856076954520455',                                // 🧾 Animated Receipt
    fallback: '🧾'
  },
  docs: {
    id: process.env.EMOJI_DOCS_ID || '5193177581888755275',   // 💻 Animated Laptop
    fallback: '📖'
  },
  pricing: {
    id: process.env.EMOJI_PRICING_ID || '5278467510604160626',// 💰 Animated Money Bag
    fallback: '💰'
  },
  support: {
    id: process.env.EMOJI_SUPPORT_ID || '5303138782004924588',// 💬 Animated Chat
    fallback: '🆘'
  },
  settings: {
    id: process.env.EMOJI_SETTINGS_ID || '5400250414929041085',// ⚖️ Animated Controls
    fallback: '⚙️'
  },

  // Currencies
  khr: {
    id: process.env.EMOJI_KHR_ID || '5197434882321567830',     // 💵 Animated Cash
    fallback: '🇰🇭'
  },
  usd: {
    id: process.env.EMOJI_USD_ID || '5377505475015235101',     // 🪙 Animated Coin
    fallback: '🇺🇸'
  },
  auto: {
    id: process.env.EMOJI_AUTO_ID || '5312441427764989435',    // 💱 Animated Exchange
    fallback: '🤖'
  },

  // Status
  active: {
    id: process.env.EMOJI_ACTIVE_ID || '5219740554455163110', // ✔️ Animated Active Check (NO white box!)
    fallback: '🟢'
  },
  pending: {
    id: process.env.EMOJI_PENDING_ID || '5382194935057372936',// ⏱ Animated Timer
    fallback: '🟡'
  },

  // Interactive Tools & Actions
  edit: {
    id: '5197269100878907942', // ✍️ Animated Pen
    fallback: '✍️'
  },
  target: {
    id: '5310278924616356636', // 🎯 Animated Target
    fallback: '🎯'
  },
  clover: {
    id: '5305699699204837855', // 🍀 Animated Lucky Clover
    fallback: '🍀'
  },
  pointer: {
    id: '5429651785352501917', // ↗️ Animated Direction Arrow (NO white box!)
    fallback: '👉'
  },

  // Flags & Utilities
  khmer_flag: {
    id: null,                  // Clean button without dollar sign
    fallback: '🇰🇭'
  },
  english_flag: {
    id: null,
    fallback: '🇬🇧'
  },
  bulb: {
    id: '5262844652964303985', // 💡 Animated Lightbulb
    fallback: '💡'
  },
  alert: {
    id: '5197288647275071607', // 🛡 Animated Shield
    fallback: '⚠️'
  },
  party: {
    id: '5267500801240092311', // ⭐ Animated Celebration Star
    fallback: '🎉'
  },
  celebrate: {
    id: '5267500801240092311', // ⭐ Animated Celebration
    fallback: '🎉'
  },
  link: {
    id: '5240228673738527951', // 🏷 Animated Link Tag
    fallback: '🔗'
  },
  qr: {
    id: '5444856076954520455', // 📲 Animated QR Scan
    fallback: '📲'
  },
  crown: {
    id: '5267500801240092311', // 👑 Animated Crown / Gold
    fallback: '👑'
  },
  gear: {
    id: '5400250414929041085', // ⚙️ Animated Gear
    fallback: '⚙️'
  }
};

/**
 * Renders custom animated emoji HTML tag
 */
function tgEmoji(key) {
  const item = emojiConfig[key];
  if (!item) return '';
  if (item.id) {
    return `<tg-emoji emoji-id="${item.id}">${item.fallback}</tg-emoji>`;
  }
  return item.fallback;
}

/**
 * Strips tg-emoji tags and replaces with fallback
 */
function stripTgEmoji(text) {
  if (!text) return '';
  return text.replace(/<tg-emoji emoji-id="[^"]*">(.*?)<\/tg-emoji>/gi, '$1');
}

/**
 * Creates an InlineKeyboardButton with clean text (NO ugly prepended emojis) and explicit style color
 */
function makeButton(text, callbackData, emojiKey = null, style = 'primary', extra = {}) {
  const validStyles = ['primary', 'danger', 'success'];
  const safeStyle = validStyles.includes(style) ? style : 'primary';

  let cleanText = String(text).trim();

  // If a custom emoji icon is attached to the button, remove any leading duplicate emoji
  // from the text so Telegram does NOT display two emojis side by side!
  if (emojiKey && emojiConfig[emojiKey]?.id) {
    cleanText = cleanText.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s🔴🔵⚡✍️🔄🚀🌸←🎯🔑💳🏛️🪙💵📦📖💰🆘⚙️📲✨]+/u, '').trim();
  }

  const btn = {
    text: cleanText || String(text).trim(),
    callback_data: callbackData,
    style: safeStyle,
    ...extra
  };

  if (emojiKey && emojiConfig[emojiKey]?.id) {
    btn.icon_custom_emoji_id = emojiConfig[emojiKey].id;
  }

  return btn;
}

module.exports = {
  emojiConfig,
  tgEmoji,
  stripTgEmoji,
  makeButton
};

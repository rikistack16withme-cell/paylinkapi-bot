const logger = require('./logger');
const { stripTgEmoji } = require('../config/emojis');

function isCustomEmojiError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('ENTITY_TEXT_INVALID') ||
    msg.includes('Invalid custom emoji identifier') ||
    msg.includes("can't parse entities") ||
    msg.includes('BUTTON_DATA_INVALID') ||
    msg.includes('BUTTON_TYPE_INVALID') ||
    msg.includes('BUTTON_USER_PRIVILEGE_INVALID') ||
    msg.includes('can\'t parse reply keyboard markup') ||
    msg.includes('reply_markup') ||
    msg.includes('custom emoji')
  );
}

function normalizeReplyMarkup(options) {
  if (!options || !options.reply_markup) return options;
  let rm = options.reply_markup;
  while (rm && rm.reply_markup) {
    rm = rm.reply_markup;
  }
  return { ...options, reply_markup: rm };
}

function cleanOptions(options) {
  const normalized = normalizeReplyMarkup(options);
  const fallbackOptions = { ...normalized };
  if (fallbackOptions.reply_markup?.inline_keyboard) {
    fallbackOptions.reply_markup = {
      inline_keyboard: fallbackOptions.reply_markup.inline_keyboard.map(row =>
        row.map(btn => {
          const { icon_custom_emoji_id, style, ...rest } = btn;
          return rest;
        })
      )
    };
  }
  return fallbackOptions;
}

const safeSender = {
  sendMessage: async (bot, chatId, text, options = {}) => {
    const norm = normalizeReplyMarkup(options);
    try {
      return await bot.sendMessage(chatId, text, norm);
    } catch (err) {
      if (isCustomEmojiError(err)) {
        logger.warn(`Custom emoji or button format error (${err.message}), falling back to clean text & buttons...`);
        const cleanText = stripTgEmoji(text);
        return await bot.sendMessage(chatId, cleanText, cleanOptions(options));
      }
      throw err;
    }
  },

  editMessageText: async (bot, text, options = {}) => {
    const norm = normalizeReplyMarkup(options);
    try {
      return await bot.editMessageText(text, norm);
    } catch (err) {
      if (isCustomEmojiError(err)) {
        logger.warn(`Custom emoji or button format error on edit (${err.message}), falling back to clean text & buttons...`);
        const cleanText = stripTgEmoji(text);
        return await bot.editMessageText(cleanText, cleanOptions(options));
      }
      throw err;
    }
  },

  replaceOrSend: async (bot, chatId, messageId, text, options = {}) => {
    if (messageId) {
      try {
        return await safeSender.editMessageText(bot, text, {
          chat_id: chatId,
          message_id: messageId,
          ...options
        });
      } catch (err) {
        if (err.message && err.message.includes('message is not modified')) {
          // Message already has identical content and markup; ignore safely
          return;
        }
        // If editing fails (e.g. previous message was a photo or cannot be edited),
        // delete the old message so the chat NEVER stacks multiple step messages!
        await bot.deleteMessage(chatId, messageId).catch(() => {});
      }
    }
    return await safeSender.sendMessage(bot, chatId, text, options);
  }
};

module.exports = safeSender;

const path = require('path');
const fs = require('fs');
const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const safeSender = require('../../utils/safe_sender');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const logger = require('../../utils/logger');
const db = require('../../database');

/**
 * Sends the step-by-step video tutorial teaching how to use PaylinkApi Bot
 */
async function handleTutorialVideo(bot, chatId, messageId, from, query = null) {
  const lang = userService.getUserLanguage(from.id);
  const caption = i18n.t('video_tutorial_caption', lang);
  const keyboard = inlineKeyboards.videoTutorial(lang);

  if (query) {
    await bot.answerCallbackQuery(query.id, { text: lang === 'km' ? 'កំពុងផ្ញើវីដេអូបង្រៀន...' : 'Loading video tutorial...' }).catch(() => {});
  }

  await bot.sendChatAction(chatId, 'upload_video').catch(() => {});

  const DEFAULT_TUTORIAL_VIDEO_FILE_ID = 'BAACAgUAAxkDAAIDymrCKtEM3ofNvGi8irMmnWsaPFLTAALQIwACA7EQVglJ85y6pMwBPQQ';
  const cachedFileId = db.getSetting('tutorial_video_file_id', DEFAULT_TUTORIAL_VIDEO_FILE_ID);

  // If we already have a cached Telegram file_id, sending is instantaneous (~100ms)
  if (cachedFileId) {
    try {
      return await safeSender.sendVideo(bot, chatId, cachedFileId, {
        caption,
        parse_mode: 'HTML',
        ...keyboard
      });
    } catch (err) {
      logger.warn(`Failed to send cached tutorial video file_id (${err.message}), retrying from local disk...`);
      db.setSetting('tutorial_video_file_id', null);
    }
  }

  // Otherwise, upload from local videoteach directory
  const mp4Path = path.join(process.cwd(), 'videoteach', 'tutorial.mp4');
  const movPath = path.join(process.cwd(), 'videoteach', 'IMG_5873.MOV');
  const videoFile = fs.existsSync(mp4Path) ? mp4Path : (fs.existsSync(movPath) ? movPath : null);

  if (!videoFile) {
    logger.error('No tutorial video file found in videoteach directory!');
    return await safeSender.sendMessage(bot, chatId, caption, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }

  try {
    const sentMsg = await safeSender.sendVideo(bot, chatId, videoFile, {
      caption,
      parse_mode: 'HTML',
      ...keyboard
    }, {
      filename: 'paylinkapi_tutorial.mp4',
      contentType: 'video/mp4'
    });

    if (sentMsg && sentMsg.video && sentMsg.video.file_id) {
      db.setSetting('tutorial_video_file_id', sentMsg.video.file_id);
      logger.info(`✓ Successfully cached Telegram tutorial video file_id: ${sentMsg.video.file_id}`);
    }

    return sentMsg;
  } catch (err) {
    logger.error('Error uploading tutorial video:', err.message);
    // Fallback: send rich guide text if upload encounters network issue
    return await safeSender.sendMessage(bot, chatId, caption, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }
}

/**
 * Fast language toggle for Video Tutorial view
 */
async function handleToggleLanguageVideo(bot, query) {
  const from = query.from;
  const chatId = query.message?.chat?.id || from.id;
  const messageId = query.message?.message_id;

  const nextLang = userService.toggleLanguage(from.id);
  const caption = i18n.t('video_tutorial_caption', nextLang);
  const keyboard = inlineKeyboards.videoTutorial(nextLang);

  await bot.answerCallbackQuery(query.id, {
    text: nextLang === 'km' ? '✓ ប្តូរជាភាសាខ្មែរ' : '✓ Switched to English'
  }).catch(() => {});

  if (messageId) {
    try {
      return await safeSender.editMessageCaption(bot, caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        ...keyboard
      });
    } catch (_) {
      // If edit caption fails, fall back to handleTutorialVideo
    }
  }

  return await handleTutorialVideo(bot, chatId, messageId, from, query);
}

module.exports = {
  handleTutorialVideo,
  handleToggleLanguageVideo
};

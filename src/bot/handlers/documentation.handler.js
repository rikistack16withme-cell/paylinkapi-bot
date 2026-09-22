const fs = require('fs');
const path = require('path');
const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const inlineKeyboards = require('../keyboards/inline.keyboards');
const formatter = require('../../utils/formatter');
const { tgEmoji } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');

const DOCS_DIR = path.join(__dirname, '..', '..', 'documents');

const docFiles = {
  quickstart: 'quickstart.md',
  auth: 'authentication.md',
  create_payment: 'create_payment.md',
  status: 'payment_status.md',
  webhooks: 'webhooks.md',
  errors: 'error_codes.md',
  examples: 'code_examples.md'
};

function formatDocMarkdownToHtml(markdown) {
  if (!markdown) return '';
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Protect code blocks first
  const codeBlocks = [];
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return `###CODE_BLOCK_${idx}###`;
  });

  // Protect inline code: `...` -> <code>...</code>
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${code}</code>`);
    return `###INLINE_CODE_${idx}###`;
  });

  // Headings: # Title -> <b>TITLE</b>
  html = html.replace(/^#+ (.+)$/gm, '<b>$1</b>');

  // Bold: **text** -> <b>text</b>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Italic: *text* or _text_ bounded by whitespace/boundaries
  html = html.replace(/(^|\s)\*([^*]+)\*(\s|$)/g, '$1<i>$2</i>$3');
  html = html.replace(/(^|\s)_([^_]+)_(\s|$)/g, '$1<i>$2</i>$3');

  // Blockquotes: &gt; text -> <blockquote>text</blockquote>
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Restore inline codes
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`###INLINE_CODE_${idx}###`, code);
  });

  // Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`###CODE_BLOCK_${idx}###`, block);
  });

  return html;
}

async function handleDocumentationHub(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  const isKm = lang === 'km';
  const text = `${formatter.header(isKm ? 'ឯកសារបច្ចេកទេស DEVELOPER' : 'DEVELOPER SPECS & DOCUMENTATION', isKm ? 'ស្តង់ដារ NBC Bakong & ABA PayWay' : 'NBC Bakong & ABA PayWay Standards')}\n\n` +
    `${tgEmoji('currency')} <b>${isKm ? 'រូបិយប័ណ្ណ:' : 'Currency Engine:'}</b> <code>${isKm ? 'USD ($) + KHR (៛) ដំណើរការរួមគ្នា' : 'USD ($) + KHR (៛) DUAL-ACTIVE'}</code>\n\n` +
    `${i18n.t('docs_subtitle', lang)}\n\n` +
    `<i>${isKm ? 'ឯកសារបច្ចេកទេសផ្លូវការនឹងធ្វើសមកាលកម្មក្នុង Phase 2.' : 'Official provider technical specs will be synced in Phase 2.'}</i>`;

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    ...inlineKeyboards.documentationHub(lang)
  });
}

async function handleDocSubPage(bot, query, topic) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  const filename = docFiles[topic];
  let rawContent = 'Documentation placeholder under preparation.';

  if (filename) {
    const fullPath = path.join(DOCS_DIR, filename);
    if (fs.existsSync(fullPath)) {
      rawContent = fs.readFileSync(fullPath, 'utf8');
    }
  }

  const htmlContent = formatDocMarkdownToHtml(rawContent);

  return await safeSender.replaceOrSend(bot, chatId, messageId, htmlContent, {
    parse_mode: 'HTML',
    ...inlineKeyboards.docSubBack(lang)
  });
}

/**
 * Dynamically generates and sends personalized PDF Integration Guide
 */
async function handleDownloadPdf(bot, query) {
  const chatId = query.message?.chat?.id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);
  const isKm = lang === 'km';

  const pdfGeneratorService = require('../../services/pdf_generator.service');
  const apiKeyService = require('../../services/apikey.service');
  const tunnelService = require('../../services/tunnel.service');
  const { makeButton } = require('../../config/emojis');

  await bot.answerCallbackQuery(query.id, {
    text: isKm ? '⏳ កំពុងបង្កើតឯកសារ PDF ណែនាំតភ្ជាប់...' : '⏳ Generating your Integration PDF Guide...'
  }).catch(() => {});

  try {
    await bot.sendChatAction(chatId, 'upload_document').catch(() => {});

    const apiKeys = apiKeyService.getUserApiKeys(from.id);
    const baseUrl = tunnelService.getPublicUrl() || 'http://localhost:5000';

    const pdfPath = await pdfGeneratorService.generateIntegrationPdf({
      telegramId: String(from.id),
      userName: from.first_name || 'Developer',
      apiKeys,
      baseUrl
    });

    // Delete previous message so the PDF cleanly replaces it instead of stacking
    if (query.message?.message_id) {
      await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
    }

    const caption = isKm
      ? `📄 <b>សៀវភៅណែនាំតភ្ជាប់ DEVELOPER INTEGRATION GUIDE (PDF)</b>\n\n` +
        `• <b>Developer:</b> <code>${formatter.escapeHtml(from.first_name || 'Developer')}</code> (ID: <code>${from.id}</code>)\n` +
        `• <b>API Keys:</b> <code>${apiKeys.length} សកម្ម</code>\n` +
        `• <b>ប្រព័ន្ធទូទាត់:</b> <code>NBC Bakong KHQR & ABA PayWay</code>\n` +
        `• 🤖 <b>AI Vibe Coding:</b> <code>Master Prompt លើទំព័រទី ២ (សម្រាប់ Cursor/Claude/ChatGPT)</code>\n` +
        `• <b>ភាសាកូដ:</b> <code>Node.js, Python, PHP, cURL</code>\n\n` +
        `<i>ឯកសារនេះមានភ្ជាប់ជាមួយ Production API Key, Webhook Secret និង AI Prompt សម្រាប់យកទៅឱ្យ AI សរសេរកូដប្រព័ន្ធទូទាត់ដោយស្វ័យប្រវត្តិ!</i>`
      : `📄 <b>OFFICIAL DEVELOPER INTEGRATION GUIDE (PDF)</b>\n\n` +
        `• <b>Developer:</b> <code>${formatter.escapeHtml(from.first_name || 'Developer')}</code> (ID: <code>${from.id}</code>)\n` +
        `• <b>API Keys:</b> <code>${apiKeys.length} Active</code>\n` +
        `• <b>Payment Rails:</b> <code>NBC Bakong KHQR & ABA PayWay</code>\n` +
        `• 🤖 <b>AI Vibe Coding:</b> <code>Master Prompt included on Page 2 (for Cursor/Claude/ChatGPT)</code>\n` +
        `• <b>Code Samples:</b> <code>Node.js, Python, PHP, cURL</code>\n\n` +
        `<i>Personalized with your active API Key, Webhook Secret, code snippets, and a ready-to-copy AI Master Prompt for instant Vibe Coding!</i>`;

    const keyboard = {
      inline_keyboard: [
        [makeButton(isKm ? '⚡ តេស្តស្កេនទូទាត់ (Test Live Pay) ❯' : '⚡ Test Purchased API Key ❯', 'start_live_pay_test', 'rocket', 'success')],
        [makeButton(isKm ? '← ត្រឡប់ទៅផ្ទាំងបញ្ជា (Console)' : '← Back to Console', 'nav_dashboard', null, 'danger')]
      ]
    };

    return await bot.sendDocument(chatId, pdfPath, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  } catch (err) {
    console.error('Failed to generate or send PDF guide:', err);
    return await bot.sendMessage(
      chatId,
      isKm
        ? `⚠️ មានបញ្ហាក្នុងការបង្កើតឯកសារ PDF។ សូមសាកល្បងម្តងទៀតនៅពេលបន្តិចទៀត។`
        : `⚠️ Could not generate PDF guide at this moment. Please try again.`,
      { parse_mode: 'HTML' }
    );
  }
}

module.exports = {
  handleDocumentationHub,
  handleDocSubPage,
  handleDownloadPdf
};

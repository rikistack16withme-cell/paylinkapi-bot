const { tgEmoji } = require('../config/emojis');

/**
 * High-Aura Fintech Developer Formatter for Telegram Bot Messages
 * Minimalist, futuristic, and developer-focused.
 */
const formatter = {
  divider: '<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>',

  bold: (text) => `<b>${text}</b>`,
  italic: (text) => `<i>${text}</i>`,
  code: (text) => `<code>${text}</code>`,
  codeBlock: (code, lang = '') => `<pre><code class="language-${lang}">${code}</code></pre>`,

  statusBadge: (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return `${tgEmoji('active')} <b>[ ACTIVE ]</b>`;
      case 'PENDING':
      case 'PENDING_INTEGRATION':
        return `${tgEmoji('pending')} <b>[ PENDING DEPLOYMENT ]</b>`;
      case 'DISABLED':
        return `${tgEmoji('alert')} <b>[ DISABLED ]</b>`;
      case 'MOCK':
      case 'SANDBOX':
        return `${tgEmoji('telemetry')} <b>[ SANDBOX STAGING ]</b>`;
      default:
        return `<b>[ ${status || 'ONLINE'} ]</b>`;
    }
  },

  header: (title, subtitle = '') => {
    // Strip existing HTML tags before uppercasing to prevent invalid tags like <B> or <TG-EMOJI>
    const cleanTitle = String(title).replace(/<[^>]+>/g, '').trim();
    let out = `${tgEmoji('brand')} <b>${cleanTitle.toUpperCase()}</b>`;
    if (subtitle) {
      out += `\n<i>${subtitle}</i>`;
    }
    out += `\n${formatter.divider}`;
    return out;
  },

  telemetryCard: (operatorName, userId, lang = 'en') => {
    if (lang === 'km') {
      return `${tgEmoji('brand')} <b>ផ្ទាំងបញ្ជាទូទាត់ PAYLINKAPI</b> <code>[កម្រិតវិជ្ជាជីវៈ]</code>\n` +
        `${formatter.divider}\n` +
        `${tgEmoji('operator')} <b>អ្នកប្រើប្រាស់:</b> <code>${formatter.escapeHtml(operatorName)}</code>  |  <b>ID:</b> <code>${userId}</code>\n` +
        `${tgEmoji('clearing')} <b>ប្រព័ន្ធទូទាត់:</b> <code>NBC Bakong KHQR &amp; ABA PayWay</code>\n` +
        `${tgEmoji('currency')} <b>រូបិយប័ណ្ណ:</b> <code>USD ($) + KHR (៛) ដំណើរការរួមគ្នា</code>\n` +
        `${tgEmoji('telemetry')} <b>ល្បឿនប្រព័ន្ធ:</b> <code>~180ms Latency • ដំណើរការ 99.99%</code>\n` +
        `${tgEmoji('security')} <b>សុវត្ថិភាព:</b> <code>HMAC-SHA256 • TLS 1.3 សកម្ម</code>\n` +
        `${formatter.divider}`;
    }
    return `${tgEmoji('brand')} <b>PAYLINKAPI GLOBAL TERMINAL</b> <code>[PRO CONSOLE]</code>\n` +
      `${formatter.divider}\n` +
      `${tgEmoji('operator')} <b>OPERATOR:</b> <code>${formatter.escapeHtml(operatorName)}</code>  |  <b>ID:</b> <code>${userId}</code>\n` +
      `${tgEmoji('clearing')} <b>CLEARING:</b> <code>NBC Bakong KHQR &amp; ABA PayWay</code>\n` +
      `${tgEmoji('currency')} <b>CURRENCY:</b> <code>USD ($) + KHR (៛) DUAL-ACTIVE</code>\n` +
      `${tgEmoji('telemetry')} <b>TELEMETRY:</b> <code>~180ms Latency • 99.99% Uptime</code>\n` +
      `${tgEmoji('security')} <b>SECURITY:</b> <code>HMAC-SHA256 • TLS 1.3 Active</code>\n` +
      `${formatter.divider}`;
  },

  escapeHtml: (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};

module.exports = formatter;

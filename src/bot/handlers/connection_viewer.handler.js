const i18n = require('../../services/i18n.service');
const userService = require('../../services/user.service');
const apiKeyService = require('../../services/apikey.service');
const formatter = require('../../utils/formatter');
const { tgEmoji, makeButton } = require('../../config/emojis');
const safeSender = require('../../utils/safe_sender');

function getCodeSnippets(apiKey = 'bk_sandbox_test_mock_98472398472') {
  return {
    curl: {
      langLabel: 'cURL (Terminal / Bash)',
      code: `curl -X POST http://localhost:5000/api/aba/generate-qr \\\n` +
        `  -H "Authorization: Bearer ${apiKey}" \\\n` +
        `  -H "Content-Type: application/json" \\\n` +
        `  -d '{\n` +
        `    "amount": 1.00,\n` +
        `    "currency": "USD"\n` +
        `  }'`
    },
    nodejs: {
      langLabel: 'Node.js (JavaScript / Axios)',
      code: `const axios = require('axios');\n\n` +
        `const API_KEY = '${apiKey}';\n\n` +
        `async function createPayment() {\n` +
        `  const res = await axios.post('http://localhost:5000/api/aba/generate-qr', {\n` +
        `    amount: 1.00,\n` +
        `    currency: 'USD' // or 'KHR' for 4000 Riel\n` +
        `  }, {\n` +
        `    headers: {\n` +
        `      'Authorization': \`Bearer \${API_KEY}\`,\n` +
        `      'Content-Type': 'application/json'\n` +
        `    }\n` +
        `  });\n\n` +
        `  console.log('KHQR String:', res.data.qrString);\n` +
        `  console.log('Transaction ID:', res.data.tranId);\n` +
        `}\ncreatePayment();`
    },
    python: {
      langLabel: 'Python (Requests)',
      code: `import requests\n\n` +
        `API_KEY = "${apiKey}"\n` +
        `headers = {\n` +
        `    "Authorization": f"Bearer {API_KEY}",\n` +
        `    "Content-Type": "application/json"\n` +
        `}\n\n` +
        `payload = {\n` +
        `    "amount": 1.00,\n` +
        `    "currency": "USD"  # or "KHR"\n` +
        `}\n\n` +
        `res = requests.post("http://localhost:5000/api/aba/generate-qr", json=payload, headers=headers)\n` +
        `print("Payment Response:", res.json())`
    },
    php: {
      langLabel: 'PHP (cURL)',
      code: `<?php\n` +
        `$apiKey = "${apiKey}";\n\n` +
        `$payload = json_encode([\n` +
        `    "amount" => 1.00,\n` +
        `    "currency" => "USD"\n` +
        `]);\n\n` +
        `$ch = curl_init("http://localhost:5000/api/aba/generate-qr");\n` +
        `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n` +
        `    "Authorization: Bearer " . $apiKey,\n` +
        `    "Content-Type: application/json"\n` +
        `]);\n` +
        `curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);\n` +
        `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n` +
        `$response = curl_exec($ch);\n` +
        `curl_close($ch);\n\n` +
        `echo $response;\n` +
        `?>`
    }
  };
}

function renderConnectionViewer(lang = 'en', selectedCodeLang = 'nodejs', userId = null) {
  const isKm = lang === 'km';
  let apiKey = 'bk_sandbox_test_mock_98472398472';
  let secret = 'whsec_test_live998';

  if (userId) {
    const keys = apiKeyService.getOrCreateUserKeys(userId);
    if (keys && keys.length > 0) {
      apiKey = keys[0].apiKey;
      secret = keys[0].secret;
    }
  }

  const snippets = getCodeSnippets(apiKey);
  const snippet = snippets[selectedCodeLang] || snippets.nodejs;

  const title = isKm ? 'របៀបតភ្ជាប់ INTEGRATION KEY' : 'INTEGRATION KEY CONNECTION GUIDE';
  const subtitle = isKm ? 'មគ្គុទ្ទេសក៍តភ្ជាប់ API សម្រាប់ប្រព័ន្ធទូទាត់' : 'Step-by-Step API Gateway Connection Protocol';

  let text = `${formatter.header(title, subtitle)}\n\n`;

  if (isKm) {
    text += `${tgEmoji('keys')} <b>ព័ត៌មានកូដសម្ងាត់សម្រាប់ការតភ្ជាប់ (API Credentials):</b>\n` +
      `• <b>Base Endpoint:</b> <code>http://localhost:5000/api</code>\n` +
      `• <b>API Key របស់អ្នក:</b> <code>${apiKey}</code>\n` +
      `• <b>HMAC Secret:</b> <code>${secret}</code>\n` +
      `• ${tgEmoji('currency')} <b>រូបិយប័ណ្ណ:</b> <code>USD ($) + KHR (៛) ដំណើរការរួមគ្នា</code>\n\n` +
      `${formatter.divider}\n\n` +
      `<b>${tgEmoji('tag')} ជំហានទី ១: បញ្ចូល HTTP Header</b>\n` +
      `គ្រប់ Request ទាំងអស់ត្រូវតែមាន Header ផ្ទៀងផ្ទាត់សិទ្ធិ:\n` +
      `<pre><code>Authorization: Bearer ${apiKey}\nContent-Type: application/json</code></pre>\n\n` +
      `<b>${tgEmoji('tag')} ជំហានទី ២: ផ្ញើ Request បង្កើតការទូទាត់ (Payment API)</b>\n` +
      `ជ្រើសរើសភាសាកូដខាងក្រោមដើម្បីមើលឧទាហរណ៍ជាក់ស្តែង:\n` +
      `${tgEmoji('terminal')} <b>កូដគំរូ (${snippet.langLabel}):</b>\n` +
      `<pre><code class="language-${selectedCodeLang}">${formatter.escapeHtml(snippet.code)}</code></pre>\n\n` +
      `<b>${tgEmoji('tag')} ជំហានទី ៣: ពិនិត្យស្ថានភាពការទូទាត់ (Payment Status)</b>\n` +
      `ហៅទៅកាន់ <code>POST /api/aba/check-payment</code> ជាមួយ <code>{"tranId": "&lt;TRAN_ID&gt;"}</code> ដើម្បីផ្ទៀងផ្ទាត់!\n\n` +
      `<i>${tgEmoji('bulb')} ចុចប៊ូតុងភាសាកូដខាងក្រោម (Node.js, Python, PHP, cURL) ដើម្បីប្តូរកូដគំរូ!</i>`;
  } else {
    text += `${tgEmoji('keys')} <b>YOUR INTEGRATION CREDENTIALS:</b>\n` +
      `• <b>Base Endpoint:</b> <code>http://localhost:5000/api</code>\n` +
      `• <b>Your Live API Key:</b> <code>${apiKey}</code>\n` +
      `• <b>HMAC Secret:</b> <code>${secret}</code>\n` +
      `• ${tgEmoji('currency')} <b>Currency Engine:</b> <code>USD ($) + KHR (៛) Dual-Rail Active</code>\n\n` +
      `${formatter.divider}\n\n` +
      `<b>${tgEmoji('tag')} STEP 1: Set HTTP Authorization Header</b>\n` +
      `All API endpoints require Bearer token authentication:\n` +
      `<pre><code>Authorization: Bearer ${apiKey}\nContent-Type: application/json</code></pre>\n\n` +
      `<b>${tgEmoji('tag')} STEP 2: Dispatch Payment Creation Request</b>\n` +
      `Select a programming language below to view production-ready snippets:\n` +
      `${tgEmoji('terminal')} <b>Sample Code (${snippet.langLabel}):</b>\n` +
      `<pre><code class="language-${selectedCodeLang}">${formatter.escapeHtml(snippet.code)}</code></pre>\n\n` +
      `<b>${tgEmoji('tag')} STEP 3: Verify Payment Status</b>\n` +
      `Call <code>POST /api/aba/check-payment</code> with <code>{"tranId": "&lt;TRAN_ID&gt;"}</code> to verify transaction real-time!\n\n` +
      `<i>${tgEmoji('bulb')} Select any code language below (Node.js, Python, PHP, cURL) to toggle snippets!</i>`;
  }

  const keyboard = {
    inline_keyboard: [
      [
        makeButton(selectedCodeLang === 'nodejs' ? 'Node.js ✓' : 'Node.js', 'conn_code_nodejs', 'docs', selectedCodeLang === 'nodejs' ? 'success' : 'primary'),
        makeButton(selectedCodeLang === 'python' ? 'Python ✓' : 'Python', 'conn_code_python', 'docs', selectedCodeLang === 'python' ? 'success' : 'primary'),
        makeButton(selectedCodeLang === 'php' ? 'PHP ✓' : 'PHP', 'conn_code_php', 'docs', selectedCodeLang === 'php' ? 'success' : 'primary'),
        makeButton(selectedCodeLang === 'curl' ? 'cURL ✓' : 'cURL', 'conn_code_curl', 'telemetry', selectedCodeLang === 'curl' ? 'success' : 'primary')
      ],
      [
        makeButton(i18n.t('btn_test_live_payment', lang), 'start_live_pay_test', 'rocket', 'success')
      ],
      [
        makeButton(i18n.t('btn_my_api_keys', lang), 'nav_api_keys', 'keys', 'primary'),
        makeButton(i18n.t('btn_dashboard', lang), 'nav_dashboard', 'brand', 'primary')
      ]
    ]
  };

  return { text, reply_markup: keyboard };
}

async function handleConnectionViewer(bot, query, selectedCodeLang = 'nodejs') {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const from = query.from;
  const lang = userService.getUserLanguage(from.id);

  const { text, reply_markup } = renderConnectionViewer(lang, selectedCodeLang, from.id);

  return await safeSender.replaceOrSend(bot, chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup
  });
}

module.exports = {
  handleConnectionViewer,
  renderConnectionViewer
};

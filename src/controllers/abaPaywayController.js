const crypto = require('node:crypto');

const DEFAULT_MERCHANT_LINK_USD = process.env.DEFAULT_ABA_USD_LINK || 'https://link.payway.com.kh/ABAPAY86523639G';
const DEFAULT_MERCHANT_LINK_KHR = process.env.DEFAULT_ABA_KHR_LINK || 'https://link.payway.com.kh/ABAPAYk8523640S';
const ABA_BASE_URL = 'https://pwapp.ababank.com/api';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function generateRequestTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const mins = pad(d.getUTCMinutes());
  const secs = pad(d.getUTCSeconds());
  return `${year}${month}${day}${hours}${mins}${secs}`;
}

function generateDeviceId(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function computeHash(data) {
  const sortedKeys = Object.keys(data).sort();
  const sortedObj = {};
  for (const k of sortedKeys) {
    sortedObj[k] = data[k];
  }
  const sortedJson = JSON.stringify(sortedObj);
  return crypto.createHash('sha512').update(sortedJson, 'utf8').digest('hex');
}

function computeStatusHash(clientId, deviceId, requestTime) {
  const raw = `${clientId}${deviceId}${requestTime}`;
  return crypto.createHash('sha512').update(raw, 'utf8').digest('hex');
}

async function extractAbaData(merchantLink) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const headers = { 'User-Agent': getRandomUserAgent() };
      const resp = await fetch(merchantLink, { headers, signal: AbortSignal.timeout(18000) });
      if (!resp.ok) {
        throw new Error(`Failed to fetch ABA merchant link (HTTP ${resp.status})`);
      }
      const html = await resp.text();

  const patterns = [
    /aba_data\s*=\s*["']([^"']+)["']/,
    /"aba_data"\s*:\s*"([^"]+)"/,
    /'aba_data'\s*:\s*'([^']+)'/,
    /data-aba-data=["']([^"']+)["']/
  ];

  for (const p of patterns) {
    const match = html.match(p);
    if (match) {
      return match[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
  }

      const fallback = merchantLink.match(/ABAPAY[A-Za-z0-9]+/);
      if (fallback) {
        return fallback[0];
      }
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastErr || new Error(`Could not extract aba_data from ${merchantLink}`);
}

async function callAbaApiWithRetry(url, payload, headers, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
      });
      const data = await resp.json();
      if (typeof data === 'object' && data !== null) {
        return data;
      }
      lastError = new Error(`Unexpected non-object response from ABA Gateway`);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
  }
  throw lastError || new Error(`ABA Gateway request to ${url} failed`);
}

/**
 * Core function to generate real ABA PayWay QR Code
 */
async function generateAbaQrCore({
  amount = 1.00,
  currency = 'USD',
  merchantLink: customLink
} = {}) {
  const curr = (currency || 'USD').toUpperCase();
  const merchantLink = (customLink && customLink.trim()) || (curr === 'KHR' ? DEFAULT_MERCHANT_LINK_KHR : DEFAULT_MERCHANT_LINK_USD);
  const merchantId = merchantLink.replace(/\/+$/, '').split('/').pop();

  const amtNum = parseFloat(amount) || 1.00;
  const amtStr = curr === 'KHR' ? String(Math.round(amtNum)) : amtNum.toFixed(2);

  // Step 1: Scrape aba_data
  const abaData = await extractAbaData(merchantLink);
  const requestTime = generateRequestTime();

  // Step 2: Build Step 1 Request Body
  const reqBody = {
    additional_fields: JSON.stringify({ amount: amtStr }),
    request_time: requestTime,
    aba_data: abaData
  };
  reqBody.hash = computeHash(reqBody);

  const parsedUrl = new URL(merchantLink);
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;

  const headers = {
    'Host': 'pwapp.ababank.com',
    'Language': 'en',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': origin,
    'Referer': merchantLink,
    'User-Agent': getRandomUserAgent()
  };

  const listUrl = `${ABA_BASE_URL}/pw-app/v1/payment/gateway/list-payment-options`;

  // Step 3: API Call 1 - Get Option Hash
  const step1Res = await callAbaApiWithRetry(listUrl, reqBody, headers);
  const statusHash = step1Res.status;
  if (!statusHash) {
    throw new Error(`ABA Gateway Step 1 failed: ${JSON.stringify(step1Res)}`);
  }

  if (typeof statusHash === 'object') {
    const code = statusHash.code;
    const msg = statusHash.message;
    if (code && code !== '00') {
      throw new Error(`ABA Gateway Step 1 error: code=${code}, message=${msg}`);
    }
    throw new Error(`Unexpected response format in Step 1`);
  }

  reqBody.hash = statusHash;

  // Step 4: API Call 2 - Get QR String, Token, and Transaction ID
  const step2Res = await callAbaApiWithRetry(listUrl, reqBody, headers);
  let tranId = null;
  if (step2Res.status && typeof step2Res.status === 'object') {
    const code = step2Res.status.code;
    const msg = step2Res.status.message;
    if (code && code !== '00') {
      throw new Error(`ABA Gateway Step 2 error: code=${code}, message=${msg}`);
    }
    tranId = String(step2Res.status.tran_id || '');
  }

  const qrString = step2Res.qr_string;
  const clientId = step2Res.client_id;
  const token = step2Res.token;

  if (!qrString || !tranId) {
    throw new Error(`ABA Gateway failed to return QR string or tran_id: ${JSON.stringify(step2Res)}`);
  }

  const md5Hash = crypto.createHash('md5').update(qrString).digest('hex');
  const encodedPayload = encodeURIComponent(qrString);
  const deepLink = `abamobilebank://ababank.com?type=payway&qrcode=${encodedPayload}`;
  const androidIntent = `intent://ababank.com?type=payway&qrcode=${encodedPayload}#Intent;scheme=abamobilebank;package=com.ababank.mobile;end`;

  return {
    success: true,
    bank: 'ABA',
    merchantId,
    merchantLink,
    amount: amtNum,
    amountFormatted: amtStr,
    currency: curr,
    qrString,
    md5: md5Hash,
    tranId,
    clientId,
    token,
    requestTime,
    deepLink,
    androidIntent
  };
}

/**
 * Core function to check real ABA PayWay payment status
 */
async function checkAbaPaymentCore({
  tranId,
  clientId,
  requestTime,
  token,
  merchantLink = DEFAULT_MERCHANT_LINK_USD
} = {}) {
  if (!tranId || !clientId || !requestTime || !token) {
    return {
      success: false,
      paid: false,
      status: 'ERROR',
      error: 'Missing required credentials (tranId, clientId, requestTime, token)'
    };
  }

  const deviceId = generateDeviceId(10);
  const hashVal = computeStatusHash(clientId, deviceId, requestTime);

  const payload = {
    tran_id: String(tranId),
    device_id: deviceId,
    request_time: String(requestTime),
    client_id: String(clientId),
    hash: hashVal
  };

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': getRandomUserAgent(),
    'Origin': 'https://link.payway.com.kh',
    'Referer': merchantLink,
    'language': 'en',
    'token': String(token)
  };

  const url = `${ABA_BASE_URL}/pw-app/v1/payment-link/check-payment-status`;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  if (!resp.ok) {
    return {
      success: false,
      paid: false,
      status: 'ERROR',
      error: `HTTP ${resp.status}`
    };
  }

  const data = await resp.json();
  const action = String(data?.data?.action || '').toLowerCase();

  if (['approved', 'success', 'paid'].includes(action)) {
    return {
      success: true,
      paid: true,
      status: 'PAID',
      rawAction: action,
      tranId,
      bank: 'ABA',
      rawResponse: data
    };
  } else if (action === 'scanned') {
    return {
      success: true,
      paid: false,
      status: 'SCANNED',
      rawAction: action,
      tranId,
      bank: 'ABA',
      rawResponse: data
    };
  } else if (action === 'pending') {
    return {
      success: true,
      paid: false,
      status: 'PENDING',
      rawAction: action,
      tranId,
      bank: 'ABA',
      rawResponse: data
    };
  } else if (['request_qr', 'unpaid'].includes(action)) {
    return {
      success: true,
      paid: false,
      status: 'UNPAID',
      rawAction: action,
      tranId,
      bank: 'ABA',
      rawResponse: data
    };
  } else {
    return {
      success: true,
      paid: false,
      status: 'UNKNOWN',
      rawAction: action,
      tranId,
      rawResponse: data
    };
  }
}

/**
 * Express Controller: Generate Real ABA PayWay QR Code
 * POST /api/aba/generate-qr
 */
async function generateAbaQr(req, res) {
  try {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        bank: 'ABA',
        error: 'Unauthorized: Valid API Key is required. Include Authorization: Bearer <key> or x-api-key header.'
      });
    }

    const payload = req.body || {};
    const curr = String(payload.currency || 'USD').toUpperCase();
    const merchantLink = payload.merchantLink || (curr === 'KHR' ? req.auth.khrLink : req.auth.usdLink) || (curr === 'KHR' ? DEFAULT_MERCHANT_LINK_KHR : DEFAULT_MERCHANT_LINK_USD);

    const result = await generateAbaQrCore({
      ...payload,
      currency: curr,
      merchantLink
    });

    // Save transaction to database for real-time status tracking
    try {
      const orderService = require('../services/order.service');
      const targetTelegramId = req.auth?.telegramId || payload.telegramId || '8665505824';
      orderService.savePaymentTransaction({
        telegramId: targetTelegramId,
        bank: 'ABA',
        amount: payload.amount || 1.00,
        amountFormatted: result.amountFormatted,
        currency: curr,
        status: 'PENDING',
        tranId: result.tranId,
        clientId: result.clientId,
        requestTime: result.requestTime,
        token: result.token,
        merchantLink: result.merchantLink,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: result.deepLink,
        merchantName: req.auth?.merchantName || 'Merchant Store'
      });
    } catch (saveErr) {
      console.warn('Could not auto-save API transaction:', saveErr.message);
    }

    return res.json({
      ...result,
      transactionId: result.tranId
    });
  } catch (error) {
    console.error('[ABA QR Generation Error]:', error);
    return res.status(500).json({
      success: false,
      bank: 'ABA',
      error: error.message || 'Failed to generate ABA QR Code'
    });
  }
}

/**
 * Express Controller: Check Real ABA PayWay Payment Status
 * POST /api/aba/check-payment
 */
async function checkAbaPayment(req, res) {
  try {
    let payload = req.body || {};
    const orderService = require('../services/order.service');
    const userService = require('../services/user.service');
    const apiKeyService = require('../services/apikey.service');
    const { sendMerchantPaymentAlert, sendAdminAlert, sendPaymentSuccessNotification } = require('../services/notification.service');

    const tranId = payload.tranId || payload.transactionId || payload.tran_id || payload.orderId || req.query?.tranId || req.query?.transactionId;
    payload.tranId = tranId;

    let tx = null;
    if (tranId) {
      tx = orderService.getPaymentTransaction(tranId);
      if (tx && tx.details) {
        payload = { ...tx.details, ...payload, tranId };
      }
    }

    // Determine target Telegram ID to notify (defaulting to primary merchant 8665505824)
    const targetTelegramId = (tx && tx.telegramId && String(tx.telegramId) !== 'api_client')
      ? tx.telegramId
      : (req.auth?.telegramId || payload.telegramId || '8665505824');

    // Support Developer Test / Simulation Mode:
    // If payload contains simulatePaid, test, or mock, simulate instant payment settlement
    const isTestSimulated = Boolean(
      payload.simulatePaid === true ||
      payload.test === true ||
      payload.mock === true ||
      req.query?.simulate === 'true' ||
      req.query?.test === 'true'
    );

    let result;
    if (isTestSimulated) {
      result = {
        success: true,
        paid: true,
        status: 'PAID',
        tranId: tranId || `TEST-${Date.now()}`,
        simulated: true
      };
    } else {
      result = await checkAbaPaymentCore(payload);
    }

    // If payment confirmed by ABA Gateway or test simulation
    if (result && (result.paid === true || result.status === 'PAID')) {
      const activeTranId = tranId || result.tranId;
      const wasAlreadyPaid = tx && tx.status === 'PAID';

      // 1. Mark transaction as PAID in database
      if (activeTranId) {
        orderService.updatePaymentTransactionStatus(activeTranId, 'PAID', result.rawResponse || result);
      }

      // 2. Dispatch settlement notification directly to merchant Telegram chat
      if (!wasAlreadyPaid || isTestSimulated) {
        try {
          if (tx && tx.plan && (String(tx.plan).includes('Pass') || String(tx.plan).includes('Pro') || String(tx.plan).includes('Enterprise') || tx.planKey)) {
            const userKeys = apiKeyService.getOrCreateUserKeys(targetTelegramId);
            const activeKey = userKeys[0]?.apiKey || `plk_live_${targetTelegramId}_active`;
            const activeSecret = userKeys[0]?.secret || `whsec_${targetTelegramId}_active`;
            await sendPaymentSuccessNotification(targetTelegramId, {
              apiKey: activeKey,
              secret: activeSecret,
              plan: tx.plan,
              tranId: activeTranId,
              amount: tx.amount || 0.10,
              amountFormatted: tx.amountFormatted || '400',
              currency: tx.currency || 'USD'
            });
          } else {
            await sendMerchantPaymentAlert(targetTelegramId, {
              bank: 'ABA PayWay Gateway',
              tranId: activeTranId,
              amount: tx?.amount || payload.amount || 1.00,
              amountFormatted: tx?.amountFormatted || (tx?.amount ? (tx.currency === 'KHR' ? `${Number(tx.amount).toLocaleString()} KHR` : `$${Number(tx.amount).toFixed(2)} USD`) : '$1.00 USD'),
              currency: tx?.currency || payload.currency || 'USD',
              merchantName: tx?.merchantName || req.auth?.merchantName || 'Merchant Store'
            });
          }

          sendAdminAlert(
            `💰 <b>[ABA PAYMENT SETTLED]</b>\n` +
            `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
            `👤 <b>Merchant Telegram:</b> <code>${targetTelegramId}</code>\n` +
            `🏦 <b>Rail:</b> ABA PayWay\n` +
            `🧾 <b>Tran ID:</b> <code>${activeTranId}</code>\n` +
            `💵 <b>Amount:</b> ${tx?.amountFormatted || '$1.00 USD'}\n` +
            `⏰ <b>Time:</b> <code>${new Date().toISOString()}</code>`
          ).catch(() => {});
        } catch (notifErr) {
          console.error('[Notification Error]:', notifErr.message);
        }
      }

      return res.json({
        success: true,
        paid: true,
        status: 'PAID',
        tranId: activeTranId,
        transactionId: activeTranId,
        amount: tx?.amount || payload.amount || 1.00,
        currency: tx?.currency || payload.currency || 'USD',
        notifiedTelegramId: targetTelegramId,
        rawResponse: result.rawResponse || null
      });
    }

    if (result.status === 'ERROR' && result.error?.includes('Missing') && !tx) {
      return res.status(400).json({
        success: false,
        status: 'ERROR',
        error: `Transaction ${tranId || 'unknown'} not found or credentials missing. Provide tranId or generate QR first.`
      });
    }

    return res.json({
      success: true,
      paid: false,
      status: result.status || 'PENDING',
      tranId: tranId || payload.tranId,
      transactionId: tranId || payload.tranId
    });
  } catch (error) {
    console.warn('[ABA Check Payment Error]:', error.message);
    return res.json({
      success: false,
      paid: false,
      status: 'ERROR',
      error: error.message
    });
  }
}

module.exports = {
  generateAbaQr,
  checkAbaPayment,
  generateAbaQrCore,
  checkAbaPaymentCore,
  DEFAULT_MERCHANT_LINK_USD,
  DEFAULT_MERCHANT_LINK_KHR
};

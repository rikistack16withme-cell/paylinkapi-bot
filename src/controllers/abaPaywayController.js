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

function sha512(str) {
  return crypto.createHash('sha512').update(String(str), 'utf8').digest('hex');
}

function hmacSha512(str, key) {
  return crypto.createHmac('sha512', String(key)).update(String(str), 'utf8').digest('hex');
}

function computeStatusHash(clientId, deviceId, requestTime) {
  const raw = `${clientId}${deviceId}${requestTime}`;
  return sha512(raw);
}

async function extractAbaData(merchantLink) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      };
      const resp = await fetch(merchantLink, { headers, signal: AbortSignal.timeout(18000) });
      if (!resp.ok) {
        throw new Error(`Failed to fetch ABA merchant link (HTTP ${resp.status})`);
      }
      const html = await resp.text();

      let abaData = null;
      let requestTime = null;

      // Primary extraction: Extract Nuxt payload from window.__NUXT__
      const nuxtMatch = html.match(/<script(?![^>]*src)[^>]*>(window\.__NUXT__[\s\S]*?)<\/script>/);
      if (nuxtMatch) {
        try {
          const vm = require('node:vm');
          const sandbox = { window: {} };
          vm.createContext(sandbox);
          vm.runInContext(nuxtMatch[1], sandbox);
          const nuxt = sandbox.window.__NUXT__;
          abaData = nuxt?.data?.[0]?.data?.aba_data || nuxt?.state?.checkout?.paymentLinkData?.aba_data;
          requestTime = nuxt?.state?.request_time;
        } catch (e) {}
      }

      // Regex fallback for aba_data
      if (!abaData) {
        const patterns = [
          /aba_data\s*=\s*["']([^"']+)["']/,
          /"aba_data"\s*:\s*"([^"]+)"/,
          /'aba_data'\s*:\s*'([^']+)'/,
          /data-aba-data=["']([^"']+)["']/
        ];
        for (const p of patterns) {
          const match = html.match(p);
          if (match) {
            abaData = match[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
            break;
          }
        }
      }

      // Regex fallback for request_time
      if (!requestTime) {
        const reqTimeMatch = html.match(/"request_time"\s*:\s*"([^"]+)"/);
        requestTime = reqTimeMatch ? reqTimeMatch[1] : generateRequestTime();
      }

      if (abaData) {
        return { abaData, requestTime, html };
      }

      const fallback = merchantLink.match(/ABAPAY[A-Za-z0-9]+/);
      if (fallback) {
        return { abaData: fallback[0], requestTime: requestTime || generateRequestTime(), html };
      }
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
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
      const data = await resp.json().catch(() => null);
      if (typeof data === 'object' && data !== null) {
        return data;
      }
      lastError = new Error(`Unexpected non-object response from ABA Gateway (HTTP ${resp.status})`);
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
 * Core function to generate real ABA PayWay KHQR Code (PayWay v2 Protocol)
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

  // Step 1: Scrape aba_data and initial request_time from merchant checkout link
  const { abaData, requestTime } = await extractAbaData(merchantLink);

  const additionalFields = JSON.stringify({ amount: amtStr });
  const hash1 = sha512(requestTime + abaData + additionalFields);

  const reqBody1 = {
    additional_fields: additionalFields,
    request_time: requestTime,
    aba_data: abaData,
    hash: hash1
  };

  const parsedUrl = new URL(merchantLink);
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;

  const headers1 = {
    'Host': 'link.payway.com.kh',
    'Language': 'en',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': origin,
    'Referer': merchantLink,
    'User-Agent': getRandomUserAgent()
  };

  const listUrl = 'https://link.payway.com.kh/api/pw-app/v1/payment/gateway/list-payment-options';
  const step1Res = await callAbaApiWithRetry(listUrl, reqBody1, headers1);

  if (!step1Res || !step1Res.token || !step1Res.aba_data) {
    const errCode = step1Res?.status?.code || 'ERR';
    const errMsg = step1Res?.status?.message || JSON.stringify(step1Res);
    throw new Error(`ABA Gateway Step 1 failed (${errCode}: ${errMsg})`);
  }

  const token = step1Res.token;
  const newAbaData = step1Res.aba_data;

  // Step 2: Request real dynamic KHQR Code from /abapay-khqr/request-qr
  const qrEndpoint = 'https://link.payway.com.kh/api/pw-app/v1/payment/gateway/abapay-khqr/request-qr';
  const hash2 = hmacSha512(requestTime + newAbaData, token);

  const reqBody2 = {
    request_time: requestTime,
    aba_data: newAbaData,
    hash: hash2
  };

  const headers2 = {
    'Host': 'link.payway.com.kh',
    'Language': 'en',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'token': token,
    'Origin': origin,
    'Referer': merchantLink,
    'User-Agent': getRandomUserAgent()
  };

  const step2Res = await callAbaApiWithRetry(qrEndpoint, reqBody2, headers2);

  const qrString = step2Res.qr_string;
  const clientId = step2Res.client_id || step1Res.client_id;
  const tranId = String(step2Res.status?.tran_id || step1Res.status?.tran_id || `DPL-${Date.now()}`);

  if (!qrString) {
    const errCode = step2Res?.status?.code || 'ERR';
    const errMsg = step2Res?.status?.message || JSON.stringify(step2Res);
    throw new Error(`ABA Gateway failed to return QR string (${errCode}: ${errMsg})`);
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
  if (!clientId || !requestTime || !token) {
    return {
      success: false,
      paid: false,
      status: 'ERROR',
      error: 'Missing required credentials (clientId, requestTime, token)'
    };
  }

  const deviceId = generateDeviceId(10);
  const hashVal = sha512(String(clientId) + deviceId + String(requestTime));

  const payload = {
    client_id: String(clientId),
    device_id: deviceId,
    request_time: String(requestTime),
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

  const url = 'https://link.payway.com.kh/api/pw-app/v1/payment-link/check-payment-status';
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  const data = await resp.json().catch(() => null);

  // ABA has a 300-500ms database write latency right after QR code generation.
  // Code 35 ("Transaction not found") indicates the transaction has not propagated yet, so it is PENDING.
  if (data?.status?.code === '35') {
    return {
      success: true,
      paid: false,
      status: 'PENDING',
      rawAction: 'request_qr',
      tranId,
      bank: 'ABA',
      rawResponse: data
    };
  }

  if (!resp.ok) {
    return {
      success: false,
      paid: false,
      status: 'ERROR',
      error: `HTTP ${resp.status}`,
      rawResponse: data
    };
  }

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
  } else if (['request_qr', 'pending', 'unpaid', 'rqpay'].includes(action)) {
    return {
      success: true,
      paid: false,
      status: 'PENDING',
      rawAction: action,
      tranId,
      bank: 'ABA',
      rawResponse: data
    };
  } else {
    return {
      success: true,
      paid: false,
      status: 'PENDING',
      rawAction: action,
      tranId,
      bank: 'ABA',
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

    // Intelligent Rail Fallback: If merchant registered for Bakong KHQR and has no custom ABA links configured,
    // seamlessly generate official Bakong KHQR so customer payments go to the merchant's registered Bakong account!
    const hasCustomAbaLink = Boolean(payload.merchantLink || req.auth.khrLink || req.auth.usdLink);
    const hasBakongAccount = Boolean(req.auth.bakongId || req.auth.merchantId || payload.merchantId);

    if (!hasCustomAbaLink && hasBakongAccount) {
      const { generateBakongKhqrCore } = require('../services/bakong_khqr.service');
      const amount = parseFloat(payload.amount) || 1.00;
      const merchantId = payload.merchantId || req.auth.bakongId || req.auth.merchantId;
      const merchantName = payload.merchantName || req.auth.merchantName || 'Merchant Store';
      const phone = payload.phone || req.auth.phone || null;

      const bakongResult = generateBakongKhqrCore({
        amount,
        currency: curr,
        merchantId,
        merchantName,
        phone,
        tranId: payload.orderId || payload.tranId
      });

      const orderService = require('../services/order.service');
      const targetTelegramId = req.auth?.telegramId || payload.telegramId || null;
      orderService.savePaymentTransaction({
        telegramId: targetTelegramId,
        bank: 'BAKONG',
        amount: bakongResult.amount,
        amountFormatted: bakongResult.amountFormatted,
        currency: curr,
        status: 'PENDING',
        tranId: bakongResult.tranId,
        qrString: bakongResult.qrString,
        md5: bakongResult.md5,
        deepLink: bakongResult.deepLink,
        merchantName
      });

      return res.json({
        ...bakongResult,
        transactionId: bakongResult.tranId,
        deeplink: bakongResult.deepLink,
        railNotice: 'Auto-routed to registered Bakong KHQR destination (No custom ABA merchant link configured)'
      });
    }

    const merchantLink = payload.merchantLink || (curr === 'KHR' ? (req.auth?.khrLink || DEFAULT_MERCHANT_LINK_KHR) : (req.auth?.usdLink || DEFAULT_MERCHANT_LINK_USD));
    if (!merchantLink) {
      return res.status(400).json({
        success: false,
        bank: 'ABA',
        error: `No ABA PayWay ${curr} checkout link configured. Please configure your ABA link or provide merchantLink in request body.`
      });
    }

    const result = await generateAbaQrCore({
      ...payload,
      currency: curr,
      merchantLink
    });

    // Save transaction to database for real-time status tracking
    try {
      const orderService = require('../services/order.service');
      const targetTelegramId = req.auth?.telegramId || payload.telegramId || null;
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
      transactionId: result.tranId,
      deeplink: result.deepLink
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
      if (tx) {
        payload = { ...tx, ...(tx.details || {}), ...payload, tranId };
      }
    }

    // Determine target Telegram ID to notify
    const targetTelegramId = (tx && tx.telegramId && String(tx.telegramId) !== 'api_client')
      ? tx.telegramId
      : (req.auth?.telegramId || payload.telegramId || null);

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
          if (tx && (tx.plan || tx.planKey || (tx.details && tx.details.planKey))) {
            const planKey = tx.planKey || (tx.details && tx.details.planKey) || (String(tx.plan).includes('Year') || String(tx.plan).includes('Enterprise') ? '1y' : (String(tx.plan).includes('Month') || String(tx.plan).includes('Pro') ? '1m' : '1w'));
            apiKeyService.renewApiKeySubscription(targetTelegramId, planKey);
            const userKeys = apiKeyService.getOrCreateUserKeys(targetTelegramId);
            const activeKey = userKeys[0]?.apiKey || `plk_live_${targetTelegramId}_active`;
            const activeSecret = userKeys[0]?.secret || `whsec_${targetTelegramId}_active`;
            await sendPaymentSuccessNotification(targetTelegramId, {
              apiKey: activeKey,
              secret: activeSecret,
              plan: tx.plan || planKey,
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

      const userKeys = apiKeyService.getOrCreateUserKeys(targetTelegramId);
      const activeKey = userKeys[0]?.apiKey || `plk_live_${targetTelegramId}_active`;
      const activeSecret = userKeys[0]?.secret || `whsec_${targetTelegramId}_active`;
      const user = userService.getUser(targetTelegramId) || {};

      return res.json({
        success: true,
        paid: true,
        status: 'PAID',
        tranId: activeTranId,
        transactionId: activeTranId,
        apiKey: activeKey,
        secret: activeSecret,
        registeredRail: tx?.registeredRail || user.provider || userKeys[0]?.provider || 'NBC Bakong National KHQR',
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

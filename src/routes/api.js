const express = require('express');
const { generateAbaQr, checkAbaPayment, generateAbaQrCore, checkAbaPaymentCore, DEFAULT_MERCHANT_LINK_USD, DEFAULT_MERCHANT_LINK_KHR } = require('../controllers/abaPaywayController');
const { checkBakongStatus, queryBakongByMd5 } = require('../controllers/bakongController');
const { generateBakongKhqrCore, generateUniversalDeeplink, DEFAULT_BAKONG_ACCOUNT, DEFAULT_STORE_NAME } = require('../services/bakong_khqr.service');
const apiKeyService = require('../services/apikey.service');
const orderService = require('../services/order.service');
const userService = require('../services/user.service');
const db = require('../database');
const QRCode = require('qrcode');

const router = express.Router();

/**
 * API Key Authentication & User Context Middleware
 */
function authenticateApiKey(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  let apiKey = '';

  if (authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7).trim();
  } else if (authHeader) {
    apiKey = authHeader.trim();
  }

  if (!apiKey && req.headers['x-api-key']) {
    apiKey = String(req.headers['x-api-key']).trim();
  }

  if (!apiKey && (req.query.api_key || req.query.apiKey)) {
    apiKey = String(req.query.api_key || req.query.apiKey).trim();
  }

  if (!apiKey && req.body && (req.body.apiKey || req.body.api_key)) {
    apiKey = String(req.body.apiKey || req.body.api_key).trim();
  }

  if (apiKey) {
    const authResult = apiKeyService.validateApiKey(apiKey);
    if (!authResult.valid) {
      if (authResult.expired) {
        return res.status(403).json({
          success: false,
          error: 'API_KEY_EXPIRED',
          message: 'Your API Key subscription has expired. All payment services (QR generation, payment checking) are suspended. Please renew your subscription via PaylinkApi Telegram Bot to reactivate.',
          expiredAt: authResult.expiresAt,
          renewBotUrl: 'https://t.me/PayLinkAPI_bot'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid API Key. Please verify your active key from PaylinkApi Telegram Bot.'
      });
    }

    req.auth = authResult;

    if (req.body && !req.body.merchantLink) {
      const curr = String(req.body.currency || 'USD').toUpperCase();
      req.body.merchantLink = (curr === 'KHR') ? authResult.khrLink : authResult.usdLink;
    }
  }

  next();
}

// 0. Health Check Endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    system: 'PaylinkApi Payment Gateway API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 0.0 Telegram Bot Webhook Gateway (Active in Cloud Deployments)
let telegramBotInstance = null;
function setTelegramBot(bot) {
  telegramBotInstance = bot;
}

router.post('/telegram/webhook', (req, res) => {
  if (telegramBotInstance && req.body) {
    try {
      if (req.body.callback_query) {
        console.log(`[WEBHOOK] Button Clicked: "${req.body.callback_query.data}" from user ${req.body.callback_query.from?.id}`);
      } else if (req.body.message) {
        console.log(`[WEBHOOK] Message Received: "${req.body.message.text || '[media]'}" from user ${req.body.message.from?.id}`);
      }
      telegramBotInstance.processUpdate(req.body);
    } catch (err) {
      console.error('[TELEGRAM WEBHOOK ERROR]', err.message);
    }
  }
  return res.sendStatus(200);
});

router.get('/telegram/webhook', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'Telegram Webhook Gateway',
    active: Boolean(telegramBotInstance)
  });
});

// 0.1 Verify API Key Endpoint
router.get('/keys/verify', authenticateApiKey, (req, res) => {
  if (!req.auth) {
    return res.status(401).json({
      success: false,
      error: 'Please provide an API Key via Authorization: Bearer <key> or x-api-key header.'
    });
  }

  const countdown = apiKeyService.getExpiryCountdown(req.auth.keyData, req.query.lang || 'km');

  return res.json({
    success: true,
    message: 'API Key is active and authorized for live payment dispatch.',
    status: req.auth.keyData?.status || 'ACTIVE',
    isExpired: countdown.isExpired,
    tier: req.auth.tier,
    provider: req.auth.provider,
    telegramId: req.auth.telegramId,
    bakongId: req.auth.bakongId,
    merchantName: req.auth.merchantName,
    phone: req.auth.phone,
    khrLink: req.auth.khrLink,
    usdLink: req.auth.usdLink,
    plan: req.auth.plan,
    planTitle: req.auth.planTitle,
    expiresAt: req.auth.expiresAt,
    remaining: {
      totalSeconds: countdown.totalSeconds === Infinity ? null : countdown.totalSeconds,
      days: countdown.days,
      hours: countdown.hours,
      minutes: countdown.minutes,
      formatted: countdown.text
    }
  });
});

// 0.2 Dedicated API Key Expiry & Countdown Status Endpoint
router.get(['/keys/status', '/keys/expiry'], (req, res) => {
  let apiKey = req.query.api_key || req.query.apiKey;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7).trim();
  } else if (!apiKey && authHeader) {
    apiKey = authHeader.trim();
  }
  if (!apiKey && req.headers['x-api-key']) {
    apiKey = String(req.headers['x-api-key']).trim();
  }

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_API_KEY',
      message: 'Please provide an API Key via query param (?api_key=...), Authorization: Bearer <key>, or x-api-key header.'
    });
  }

  const keyData = apiKeyService.getKeyById(apiKey);
  if (!keyData) {
    return res.status(404).json({
      success: false,
      error: 'KEY_NOT_FOUND',
      message: 'The requested API Key does not exist in the database.'
    });
  }

  const lang = req.headers['language'] || req.query.lang || 'km';
  const countdown = apiKeyService.getExpiryCountdown(keyData, lang);

  return res.json({
    success: true,
    apiKey: keyData.apiKey,
    merchantName: keyData.merchantName,
    provider: keyData.provider,
    status: keyData.status,
    isExpired: countdown.isExpired,
    isExpiringSoon: countdown.isExpiringSoon,
    plan: keyData.plan || '1w',
    createdAt: keyData.createdAt,
    expiresAt: keyData.expiresAt,
    remaining: {
      totalSeconds: countdown.totalSeconds === Infinity ? null : countdown.totalSeconds,
      days: countdown.days,
      hours: countdown.hours,
      minutes: countdown.minutes,
      formatted: countdown.text
    },
    renewUrl: 'https://t.me/PayLinkAPI_bot'
  });
});

// 0.3 Admin Key Expiration Tool (for instant testing of expiry behavior)
router.all('/admin/expire-key', (req, res) => {
  let apiKey = req.query.api_key || req.query.apiKey || req.body?.apiKey || req.body?.api_key;
  if (!apiKey && req.headers['authorization']) {
    const auth = req.headers['authorization'];
    if (auth.startsWith('Bearer ')) apiKey = auth.slice(7).trim();
  }
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'MISSING_API_KEY', message: 'Provide apiKey in query or body.' });
  }

  const keyData = apiKeyService.getKeyById(apiKey);
  if (!keyData) {
    return res.status(404).json({ success: false, error: 'KEY_NOT_FOUND', message: 'Key does not exist.' });
  }

  keyData.status = 'EXPIRED';
  keyData.expiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour in the past
  keyData.expiryWarningSent = true;
  keyData.expiredNoticeSent = true;
  db.saveApiKey(keyData);

  return res.json({
    success: true,
    message: `API Key ${keyData.apiKey} is now marked EXPIRED. All payment requests using this key will return HTTP 403 API_KEY_EXPIRED.`,
    key: {
      id: keyData.id,
      apiKey: keyData.apiKey,
      merchantName: keyData.merchantName,
      status: keyData.status,
      expiresAt: keyData.expiresAt
    }
  });
});

// 0.4 Admin Key Reactivation Tool
router.all('/admin/reactivate-key', (req, res) => {
  let apiKey = req.query.api_key || req.query.apiKey || req.body?.apiKey || req.body?.api_key;
  if (!apiKey && req.headers['authorization']) {
    const auth = req.headers['authorization'];
    if (auth.startsWith('Bearer ')) apiKey = auth.slice(7).trim();
  }
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'MISSING_API_KEY', message: 'Provide apiKey in query or body.' });
  }

  const keyData = apiKeyService.getKeyById(apiKey);
  if (!keyData) {
    return res.status(404).json({ success: false, error: 'KEY_NOT_FOUND', message: 'Key does not exist.' });
  }

  const durationDays = keyData.durationDays || 7;
  keyData.status = 'ACTIVE';
  keyData.expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  keyData.expiryWarningSent = false;
  keyData.expiredNoticeSent = false;
  db.saveApiKey(keyData);

  return res.json({
    success: true,
    message: `API Key ${keyData.apiKey} has been reactivated.`,
    key: {
      id: keyData.id,
      apiKey: keyData.apiKey,
      status: keyData.status,
      expiresAt: keyData.expiresAt
    }
  });
});

// 0.2 Real-time Payment Status Endpoint (for web checkout & polling)
router.get('/payment/status/:tranId', async (req, res) => {
  try {
    const tranId = req.params.tranId;
    const tx = orderService.getPaymentTransaction(tranId);
    if (!tx) {
      return res.json({ success: false, paid: false, status: 'NOT_FOUND' });
    }
    if (tx.status === 'PAID') {
      return res.json({ success: true, paid: true, status: 'PAID' });
    }
    if (tx.status === 'EXPIRED') {
      return res.json({ success: true, paid: false, status: 'EXPIRED' });
    }

    // Check if 3 minutes have passed since creation
    const createdAt = new Date(tx.createdAt || Date.now()).getTime();
    if (Date.now() - createdAt > 180 * 1000) {
      orderService.updatePaymentTransactionStatus(tranId, 'EXPIRED');
      return res.json({ success: true, paid: false, status: 'EXPIRED' });
    }

    // Attempt live verification
    if (tx.bank === 'ABA' && tx.details) {
      const r = await checkAbaPaymentCore(tx.details).catch(() => null);
      if (r && r.status === 'PAID') {
        orderService.updatePaymentTransactionStatus(tranId, 'PAID', r.rawResponse || r);
        const user = userService.getUser(tx.telegramId);
        if (user) {
          userService.updateUser(tx.telegramId, {
            status: 'ACTIVE',
            subscription: { status: 'ACTIVE', activatedAt: new Date().toISOString() }
          });
        }
        return res.json({ success: true, paid: true, status: 'PAID' });
      }
    } else if (tx.bank === 'BAKONG' && (tx.details?.md5 || tx.md5)) {
      const md5 = tx.details?.md5 || tx.md5;
      const r = await queryBakongByMd5(md5).catch(() => null);
      if (r && (r.status === 'SUCCESS' || r.responseCode === 0)) {
        orderService.updatePaymentTransactionStatus(tranId, 'PAID', r.data || r);
        const user = userService.getUser(tx.telegramId);
        if (user) {
          userService.updateUser(tx.telegramId, {
            status: 'ACTIVE',
            subscription: { status: 'ACTIVE', activatedAt: new Date().toISOString() }
          });
        }
        return res.json({ success: true, paid: true, status: 'PAID' });
      }
    }

    return res.json({ success: true, paid: false, status: tx.status || 'PENDING' });
  } catch (err) {
    return res.json({ success: false, paid: false, error: err.message });
  }
});

// 0.3 Direct ABA Mobile App Auto-Launcher Bridge
// Instantly redirects 302 directly to ABA Mobile app (abamobilebank:// & android intent)
// ZERO intermediate web pages, ZERO buttons to click, ZERO Bakong links
router.get('/aba/open/:tranId', async (req, res) => {
  try {
    const tranId = req.params.tranId;
    const tx = orderService.getPaymentTransaction(tranId);
    if (!tx) {
      return res.status(404).send('Transaction expired or not found');
    }

    const qrString = tx.details?.qrString || tx.qrString;
    if (!qrString) {
      return res.status(400).send('Invalid transaction QR string');
    }

    const encodedPayload = encodeURIComponent(qrString);
    const abaDeepLink = `abamobilebank://ababank.com?type=payway&qrcode=${encodedPayload}`;
    const androidIntent = `intent://ababank.com?type=payway&qrcode=${encodedPayload}#Intent;scheme=abamobilebank;package=com.ababank.mobile;end`;

    // 1. Direct 302 to ABA Mobile scheme for clients reading Location header
    res.setHeader('Location', abaDeepLink);

    // 2. Zero-delay auto-executing script to directly launch ABA Mobile
    return res.status(302).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=${abaDeepLink}">
  <title>Opening ABA Mobile...</title>
  <script>
    (function() {
      var isAndroid = /Android/i.test(navigator.userAgent);
      var target = isAndroid ? "${androidIntent}" : "${abaDeepLink}";
      window.location.replace(target);
      setTimeout(function() {
        window.location.href = "${abaDeepLink}";
      }, 50);
    })();
  </script>
</head>
<body style="margin:0;padding:0;background:#003B6D;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:white;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
  <div style="padding:24px;max-width:380px;">
    <div style="font-size:48px;margin-bottom:16px;">📲</div>
    <h2 style="margin:0 0 10px 0;font-size:22px;font-weight:700;">Opening ABA Mobile...</h2>
    <p style="opacity:0.85;margin:0 0 24px 0;font-size:14px;line-height:1.5;">Launching your ABA Mobile application to complete the payment.</p>
    <a href="${abaDeepLink}" style="display:block;padding:14px 20px;background:#00bcd4;color:#003B6D;font-weight:700;text-decoration:none;border-radius:12px;font-size:16px;box-shadow:0 4px 14px rgba(0,188,212,0.4);">Open ABA Mobile App</a>
  </div>
</body>
</html>`);
  } catch (err) {
    return res.status(500).send('Failed to launch ABA Mobile');
  }
});

// 0.4 Direct Bakong App Universal Deeplink Bridge
router.get(['/bakong/open/:tranId', '/payment/open/:tranId', '/qr/open/:tranId'], async (req, res) => {
  try {
    const tranId = req.params.tranId;
    const tx = orderService.getPaymentTransaction(tranId);
    if (!tx) {
      return res.redirect('https://bakong-deeplink.nbc.gov.kh');
    }
    const qrString = tx.details?.qrString || tx.qrString;
    const nbcDeepLink = await generateUniversalDeeplink(qrString);
    return res.redirect(302, nbcDeepLink);
  } catch (err) {
    return res.redirect('https://bakong-deeplink.nbc.gov.kh');
  }
});

// 1. Unified 1-Key Payment Gateway Endpoints
// Creates a payment QR code directly into the merchant's registered bank account using 1 API key
router.post(['/payment/generate-qr', '/qr/generate', '/payment/create'], authenticateApiKey, async (req, res) => {
  try {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid API Key is required. Please include Authorization: Bearer <key> or x-api-key header.'
      });
    }

    const payload = req.body || {};
    const amount = parseFloat(payload.amount) || 1.00;
    const currency = String(payload.currency || 'USD').toUpperCase();

    // Determine target rail: Explicitly requested OR auto-detected from user's registered setup
    let bank = String(payload.bank || '').toUpperCase();
    if (!bank) {
      const userProv = String(req.auth?.provider || '').toLowerCase();
      const hasCustomAba = Boolean(payload.merchantLink || req.auth?.khrLink || req.auth?.usdLink);
      const hasBakong = Boolean(payload.merchantId || req.auth?.bakongId || req.auth?.merchantId);

      if (hasBakong && !hasCustomAba) {
        bank = 'BAKONG';
      } else if (hasCustomAba && !hasBakong) {
        bank = 'ABA';
      } else if (userProv.includes('bakong') && !userProv.includes('aba')) {
        bank = 'BAKONG';
      } else if (userProv.includes('aba') && !userProv.includes('bakong')) {
        bank = 'ABA';
      } else {
        // Dual Rail: default to BAKONG if Bakong configured, as Bakong KHQR is Cambodia's national standard
        bank = hasBakong ? 'BAKONG' : 'ABA';
      }
    }

    if (bank === 'BAKONG') {
      const merchantId = payload.merchantId || req.auth?.bakongId || req.auth?.merchantId;
      if (!merchantId) {
        return res.status(400).json({
          success: false,
          bank: 'BAKONG',
          error: 'No Bakong Account ID configured for this API Key. Please configure your Bakong ID or provide merchantId in request body.'
        });
      }

      const merchantName = payload.merchantName || req.auth?.merchantName || 'Merchant Store';
      const phone = payload.phone || req.auth?.phone || '0977416126';

      const result = generateBakongKhqrCore({
        amount,
        currency,
        merchantId,
        merchantName,
        phone,
        tranId: payload.orderId || payload.tranId,
        expiryHours: payload.expiryHours || 24
      });

      orderService.savePaymentTransaction({
        telegramId: req.auth?.telegramId || '8665505824',
        bank: 'BAKONG',
        amount: result.amount,
        amountFormatted: result.amountFormatted,
        currency: result.currency,
        status: 'PENDING',
        tranId: result.tranId,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: result.deepLink,
        merchantName: result.merchantName
      });

      return res.json({
        success: true,
        bank: 'BAKONG',
        tranId: result.tranId,
        transactionId: result.tranId,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: result.deepLink,
        deeplink: result.deepLink,
        amount: result.amount,
        amountFormatted: result.amountFormatted,
        currency: result.currency,
        merchantName: result.merchantName,
        status: 'PENDING'
      });
    } else {
      // ABA PayWay Flow
      const merchantLink = currency === 'KHR'
        ? (payload.merchantLink || req.auth?.khrLink || DEFAULT_MERCHANT_LINK_KHR)
        : (payload.merchantLink || req.auth?.usdLink || DEFAULT_MERCHANT_LINK_USD);

      const result = await generateAbaQrCore({
        amount,
        currency,
        merchantLink
      });

      orderService.savePaymentTransaction({
        telegramId: req.auth?.telegramId || '8665505824',
        bank: 'ABA',
        amount: result.amount || amount,
        amountFormatted: result.amountFormatted,
        currency,
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

      return res.json({
        success: true,
        bank: 'ABA',
        tranId: result.tranId,
        transactionId: result.tranId,
        clientId: result.clientId,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: result.deepLink,
        amount: result.amount || amount,
        amountFormatted: result.amountFormatted,
        currency,
        merchantName: result.merchantName || req.auth?.merchantName || 'Merchant Store',
        status: 'PENDING'
      });
    }
  } catch (err) {
    console.error('[Unified QR Generation Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate payment QR'
    });
  }
});

// Dedicated Bakong KHQR Generation with API Key
router.post('/bakong/generate-qr', authenticateApiKey, async (req, res) => {
  try {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        bank: 'BAKONG',
        error: 'Unauthorized: Valid API Key is required. Please include Authorization: Bearer <key> or x-api-key header.'
      });
    }

    const payload = req.body || {};
    const amount = parseFloat(payload.amount) || 0.10;
    const currency = String(payload.currency || 'USD').toUpperCase();
    const merchantId = payload.merchantId || req.auth?.bakongId || req.auth?.merchantId;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        bank: 'BAKONG',
        error: 'No Bakong Account ID configured for this API Key. Please configure your Bakong ID or provide merchantId in request body.'
      });
    }

    const merchantName = payload.merchantName || req.auth?.merchantName || 'Merchant Store';
    const phone = payload.phone || req.auth?.phone || '0977416126';

    const result = generateBakongKhqrCore({
      amount,
      currency,
      merchantId,
      merchantName,
      phone,
      tranId: payload.orderId || payload.tranId,
      expiryHours: payload.expiryHours || 24
    });

    orderService.savePaymentTransaction({
      telegramId: req.auth?.telegramId || 'api_client',
      bank: 'BAKONG',
      amount: result.amount,
      amountFormatted: result.amountFormatted,
      currency: result.currency,
      status: 'PENDING',
      tranId: result.tranId,
      qrString: result.qrString,
      md5: result.md5,
      deepLink: result.deepLink
    });

    return res.json(result);
  } catch (err) {
    console.error('[Bakong QR Error]:', err);
    return res.status(500).json({
      success: false,
      bank: 'BAKONG',
      error: err.message || 'Failed to generate Bakong KHQR'
    });
  }
});

// Unified Real-Time Payment Status Checking (Supports both Bakong MD5 & ABA TranID)
router.all(['/payment/check', '/payment/check/:tranId'], authenticateApiKey, async (req, res) => {
  try {
    const tranId = req.params?.tranId || req.body?.tranId || req.body?.transactionId || req.body?.tran_id || req.query?.tranId || req.query?.transactionId;
    const md5 = req.body?.md5 || req.query?.md5;

    const isTestSimulated = Boolean(
      req.body?.simulatePaid === true ||
      req.body?.test === true ||
      req.body?.mock === true ||
      req.query?.simulate === 'true' ||
      req.query?.test === 'true'
    );

    if (!tranId && !md5 && !isTestSimulated) {
      return res.status(400).json({ success: false, error: 'Missing tranId, transactionId, or md5 in request' });
    }

    const tx = tranId ? orderService.getPaymentTransaction(tranId) : null;
    const bank = (tx?.bank || (md5 && !tx?.details?.clientId ? 'BAKONG' : 'ABA')).toUpperCase();
    const targetTelegramId = (tx?.telegramId && String(tx.telegramId) !== 'api_client')
      ? tx.telegramId
      : (req.auth?.telegramId || '8665505824');

    if (bank === 'BAKONG') {
      const searchMd5 = md5 || tx?.details?.md5 || tx?.md5;
      if (!searchMd5 && !isTestSimulated) {
        return res.json({ success: true, paid: false, status: 'PENDING' });
      }

      let isPaid = isTestSimulated;
      let rawData = null;

      if (!isTestSimulated && searchMd5) {
        const bakongRes = await queryBakongByMd5(searchMd5);
        if (bakongRes && (bakongRes.status === 'SUCCESS' || bakongRes.responseCode === 0)) {
          isPaid = true;
          rawData = bakongRes.data || bakongRes;
        }
      }

      if (isPaid) {
        const wasAlreadyPaid = tx && tx.status === 'PAID';
        if (tranId) {
          orderService.updatePaymentTransactionStatus(tranId, 'PAID', rawData || { simulated: true });
        }
        if (!wasAlreadyPaid || isTestSimulated) {
          try {
            const { sendMerchantPaymentAlert } = require('../services/notification.service');
            await sendMerchantPaymentAlert(targetTelegramId, {
              bank: 'Bakong National KHQR',
              tranId: tranId || searchMd5 || `BK-${Date.now()}`,
              amount: tx?.amount || req.body?.amount || 1.00,
              amountFormatted: tx?.amountFormatted || (req.body?.amount ? (tx?.currency === 'KHR' ? `${Number(req.body.amount).toLocaleString()} KHR` : `$${Number(req.body.amount).toFixed(2)} USD`) : '$1.00 USD'),
              currency: tx?.currency || req.body?.currency || 'USD',
              merchantName: tx?.merchantName || req.auth?.merchantName || 'Merchant Store'
            });
          } catch (_) {}
        }
        return res.json({
          success: true,
          paid: true,
          status: 'PAID',
          bank: 'BAKONG',
          tranId: tranId || searchMd5,
          transactionId: tranId || searchMd5,
          amount: tx?.amount || req.body?.amount || 1.00,
          currency: tx?.currency || req.body?.currency || 'USD',
          notifiedTelegramId: targetTelegramId,
          rawResponse: rawData
        });
      }

      return res.json({
        success: true,
        paid: false,
        status: 'PENDING',
        bank: 'BAKONG',
        tranId: tranId || searchMd5,
        transactionId: tranId || searchMd5
      });
    } else {
      // ABA PayWay Flow
      if (isTestSimulated) {
        const activeTranId = tranId || `TEST-${Date.now()}`;
        if (tx) {
          orderService.updatePaymentTransactionStatus(activeTranId, 'PAID', { simulated: true });
        }
        const { sendMerchantPaymentAlert } = require('../services/notification.service');
        await sendMerchantPaymentAlert(targetTelegramId, {
          bank: 'ABA PayWay Gateway',
          tranId: activeTranId,
          amount: tx?.amount || req.body?.amount || 1.00,
          amountFormatted: tx?.amountFormatted || '$1.00 USD',
          currency: tx?.currency || req.body?.currency || 'USD',
          merchantName: tx?.merchantName || req.auth?.merchantName || 'Merchant Store'
        });
        return res.json({
          success: true,
          paid: true,
          status: 'PAID',
          bank: 'ABA',
          tranId: activeTranId,
          transactionId: activeTranId,
          notifiedTelegramId: targetTelegramId,
          simulated: true
        });
      }

      if (!tx || !tx.details) {
        return checkAbaPayment(req, res);
      }

      const abaRes = await checkAbaPaymentCore(tx.details);
      if (abaRes && abaRes.status === 'PAID') {
        const wasAlreadyPaid = tx && tx.status === 'PAID';
        if (tranId) {
          orderService.updatePaymentTransactionStatus(tranId, 'PAID', abaRes.rawResponse);
        }
        if (!wasAlreadyPaid) {
          try {
            const { sendMerchantPaymentAlert } = require('../services/notification.service');
            await sendMerchantPaymentAlert(targetTelegramId, {
              bank: 'ABA PayWay Gateway',
              tranId,
              amount: tx.amount,
              amountFormatted: tx.amountFormatted,
              currency: tx.currency || 'USD',
              merchantName: tx.merchantName || req.auth?.merchantName || 'Merchant Store'
            });
          } catch (_) {}
        }
        return res.json({
          success: true,
          paid: true,
          status: 'PAID',
          bank: 'ABA',
          tranId,
          transactionId: tranId,
          amount: tx.amount,
          currency: tx.currency || 'USD',
          notifiedTelegramId: targetTelegramId,
          rawResponse: abaRes.rawResponse
        });
      }

      return res.json({
        success: true,
        paid: false,
        status: abaRes.status || 'PENDING',
        bank: 'ABA',
        tranId,
        transactionId: tranId
      });
    }
  } catch (err) {
    console.error('[Unified Payment Check Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to check payment status'
    });
  }
});

// Dedicated Merchant Instant Test Alert Endpoint
// Allows developers/merchants to test their Telegram payment alerts directly from their apps!
router.post(['/payment/test-alert', '/aba/test-alert'], authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body || {};
    const targetTelegramId = req.auth?.telegramId || payload.telegramId || '8665505824';
    const amount = payload.amount || 1.00;
    const currency = (payload.currency || 'USD').toUpperCase();
    const bank = payload.bank || 'ABA PayWay Gateway';
    const tranId = payload.tranId || payload.transactionId || `TEST-${Date.now()}`;
    const merchantName = payload.merchantName || req.auth?.merchantName || 'Merchant Store';

    const { sendMerchantPaymentAlert, sendAdminAlert } = require('../services/notification.service');
    const result = await sendMerchantPaymentAlert(targetTelegramId, {
      bank,
      tranId,
      amount,
      amountFormatted: currency === 'KHR' ? `${Number(amount).toLocaleString()} KHR` : `$${Number(amount).toFixed(2)} USD`,
      currency,
      merchantName
    });

    sendAdminAlert(
      `🧪 <b>[TEST PAYMENT ALERT TRIGGERED]</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `👤 <b>Merchant:</b> <code>${targetTelegramId}</code>\n` +
      `🏦 <b>Rail:</b> ${bank}\n` +
      `💵 <b>Amount:</b> ${amount} ${currency}\n` +
      `🧾 <b>Tran ID:</b> <code>${tranId}</code>`
    ).catch(() => {});

    return res.json({
      success: true,
      status: 'PAID',
      message: 'Instant test payment settlement alert sent to merchant Telegram chat successfully!',
      sentToTelegramId: targetTelegramId,
      tranId,
      transactionId: tranId,
      messageId: result?.message_id || null
    });
  } catch (err) {
    console.error('Error in /payment/test-alert:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Individual Bank Specific Endpoints (Backward Compatible)
router.post('/aba/generate-qr', authenticateApiKey, generateAbaQr);
router.post('/aba/check-payment', authenticateApiKey, checkAbaPayment);
router.get('/bakong/check/:md5', authenticateApiKey, checkBakongStatus);

// 3. Web Portal Registration & Instant Dual-Rail (Bakong & ABA, USD & KHR) Checkout
router.post('/web/register-and-subscribe', async (req, res) => {
  try {
    const {
      telegramId = '7283817695',
      amount = null,
      currency = 'USD',
      plan = '1w',
      rail = null,
      paymentRail = null,
      merchantData = {},
      payMethod = 'bakong' // 'bakong' or 'aba'
    } = req.body;

    const tId = String(telegramId || '7283817695');
    const curr = String(currency || 'USD').toUpperCase();
    const isKhr = curr === 'KHR';

    // Calculate plan amount based on currency
    let amt = (amount !== null && amount !== undefined) ? parseFloat(amount) : null;
    if (!amt || isNaN(amt) || (isKhr && amt < 100) || (!isKhr && amt >= 100)) {
      if (isKhr) {
        amt = plan === '1w' ? 400 : plan === '1m' ? 4000 : 40000;
      } else {
        amt = plan === '1w' ? 0.10 : plan === '1m' ? 1.00 : 10.00;
      }
    }

    // Determine explicitly requested merchant registration rail
    const regRail = String(rail || paymentRail || (merchantData.merchantId && !merchantData.usdLink ? 'bakong' : (merchantData.usdLink && !merchantData.merchantId ? 'aba' : 'bundle'))).toLowerCase();

    let providerName = 'Bakong KHQR';
    if (regRail === 'aba') providerName = 'ABA PayWay Gateway';
    if (regRail === 'bundle') providerName = 'Bakong + ABA Dual Suite';

    const user = userService.getUser(tId) || {};
    const storeName = merchantData.merchantName || user.merchantName || DEFAULT_STORE_NAME || 'Rikidev';

    const updateData = {
      provider: providerName,
      providerKey: regRail,
      merchantName: storeName,
      phone: merchantData.phone || user.phone || '0977416126'
    };

    if (regRail === 'bakong') {
      updateData.merchantId = merchantData.merchantId || user.merchantId || null;
      updateData.bakongId = merchantData.merchantId || user.bakongId || null;
      updateData.khrLink = null;
      updateData.usdLink = null;
    } else if (regRail === 'aba') {
      updateData.khrLink = merchantData.khrLink || user.khrLink || null;
      updateData.usdLink = merchantData.usdLink || user.usdLink || null;
      updateData.merchantId = null;
      updateData.bakongId = null;
    } else {
      updateData.merchantId = merchantData.merchantId || user.merchantId || null;
      updateData.bakongId = merchantData.merchantId || user.bakongId || null;
      updateData.khrLink = merchantData.khrLink || user.khrLink || null;
      updateData.usdLink = merchantData.usdLink || user.usdLink || null;
    }

    userService.updateUser(tId, updateData);

    // Get and synchronize active user API keys to match registered rail
    const userKeys = apiKeyService.getOrCreateUserKeys(tId);
    if (userKeys && userKeys.length > 0) {
      const k = userKeys[0];
      k.provider = providerName;
      k.merchantName = updateData.merchantName;
      k.phone = updateData.phone;
      k.bakongId = updateData.bakongId;
      k.merchantId = updateData.merchantId;
      k.khrLink = updateData.khrLink;
      k.usdLink = updateData.usdLink;
      db.saveApiKey(k);
    }

    const activeKey = userKeys[0]?.apiKey || `plk_live_${tId}_active`;
    const secret = userKeys[0]?.secret || `whsec_${tId}_active`;

    const method = String(payMethod || 'bakong').toLowerCase();

    const platformName = process.env.BRAND_NAME || 'PaylinkApi';
    const platformBakongId = process.env.DEFAULT_BAKONG_ACCOUNT || 'hut_soksitchey1@aclb';
    const platformPhone = process.env.DEFAULT_BAKONG_PHONE || '0977416126';
    const platformAbaUsdLink = process.env.DEFAULT_ABA_USD_LINK || DEFAULT_MERCHANT_LINK_USD;
    const platformAbaKhrLink = process.env.DEFAULT_ABA_KHR_LINK || DEFAULT_MERCHANT_LINK_KHR;

    if (method === 'bakong') {
      // ----------------------------------------------------
      // OPTION 1: BAKONG KHQR (Red Card) with Tag 99 Timestamp
      // ----------------------------------------------------
      const result = generateBakongKhqrCore({
        amount: amt,
        currency: curr,
        merchantId: platformBakongId,
        merchantName: platformName,
        phone: platformPhone,
        expiryMinutes: 1440 // 24 hours validity (prevents expired error)
      });

      orderService.savePaymentTransaction({
        telegramId: tId,
        bank: 'BAKONG',
        amount: amt,
        amountFormatted: result.amountFormatted,
        currency: curr,
        status: 'PENDING',
        plan,
        registeredRail: providerName,
        tranId: result.tranId,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: result.deepLink
      });

      return res.json({
        success: true,
        bank: 'BAKONG',
        registeredRail: providerName,
        paymentMethod: 'BAKONG',
        tranId: result.tranId,
        transactionId: result.tranId,
        qrString: result.qrString,
        md5: result.md5,
        amount: amt,
        amountFormatted: result.amountFormatted,
        currency: curr,
        merchantName: platformName,
        deepLink: result.deepLink,
        deeplink: result.deepLink,
        apiKey: activeKey,
        secret: secret,
        plan: plan
      });

    } else {
      // ----------------------------------------------------
      // OPTION 2: ABA PAYWAY (Blue Card) with Real Merchant Name
      // ----------------------------------------------------
      let billCurr = curr;
      // ABA PayWay USD minimum is $1.00. For $0.10 test plans in USD, route to 400 KHR seamlessly
      if (amt < 1.00 && billCurr === 'USD') {
        billCurr = 'KHR';
        amt = Math.max(100, Math.round(amt * 4000));
      }

      const merchantLink = billCurr === 'KHR'
        ? platformAbaKhrLink
        : platformAbaUsdLink;

      const result = await generateAbaQrCore({
        amount: amt,
        currency: billCurr,
        merchantLink
      });

      orderService.savePaymentTransaction({
        telegramId: tId,
        bank: 'ABA',
        amount: amt,
        amountFormatted: result.amountFormatted,
        currency: billCurr,
        status: 'PENDING',
        plan,
        registeredRail: providerName,
        tranId: result.tranId,
        clientId: result.clientId,
        requestTime: result.requestTime,
        token: result.token,
        merchantLink: result.merchantLink,
        qrString: result.qrString,
        md5: result.md5,
        deepLink: result.deepLink
      });

      return res.json({
        success: true,
        bank: 'ABA',
        registeredRail: providerName,
        paymentMethod: 'ABA',
        tranId: result.tranId,
        transactionId: result.tranId,
        clientId: result.clientId,
        qrString: result.qrString,
        md5: result.md5,
        amount: amt,
        amountFormatted: result.amountFormatted,
        currency: billCurr,
        merchantName: platformName,
        merchantLink: result.merchantLink,
        deepLink: result.deepLink,
        deeplink: result.deepLink,
        apiKey: activeKey,
        secret: secret,
        plan: plan
      });
    }

  } catch (err) {
    console.error('Error in /api/web/register-and-subscribe:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to process subscription and generate KHQR'
    });
  }
});

// 4. Unified Payment Status Polling (Auto-routes to Bakong or ABA)
router.post('/web/check-payment', async (req, res) => {
  try {
    const { tranId, md5 } = req.body || {};
    if (!tranId && !md5) {
      return res.status(400).json({ success: false, error: 'Missing tranId or md5' });
    }

    const tx = tranId ? orderService.getPaymentTransaction(tranId) : null;
    const isBakong = (tx && (tx.provider === 'Bakong KHQR' || tx.bank === 'BAKONG')) || (!tx && md5);

    if (isBakong) {
      const searchMd5 = md5 || tx?.details?.md5;
      if (!searchMd5) {
        return res.json({ success: true, paid: false, status: 'PENDING' });
      }

      const bakongRes = await queryBakongByMd5(searchMd5);
      if (bakongRes && bakongRes.status === 'SUCCESS') {
        const telegramId = tx?.telegramId || '7283817695';
        const userKeys = apiKeyService.getOrCreateUserKeys(telegramId);
        const activeKey = userKeys[0]?.apiKey || `plk_live_${telegramId}_active`;
        const activeSecret = userKeys[0]?.secret || `whsec_${telegramId}_active`;

        userService.updateUser(telegramId, {
          status: 'ACTIVE',
          subscription: {
            plan: tx?.plan || '1w',
            amount: tx?.amount || 0.10,
            currency: tx?.currency || 'USD',
            status: 'ACTIVE',
            activatedAt: new Date().toISOString()
          }
        });

        if (tranId) {
          orderService.updatePaymentTransactionStatus(tranId, 'PAID', bakongRes.data);
        }

        try {
          const { sendPaymentSuccessNotification } = require('../services/notification.service');
          await sendPaymentSuccessNotification(telegramId, {
            apiKey: activeKey,
            secret: activeSecret,
            plan: tx?.plan || '1w',
            tranId: tranId || searchMd5,
            amount: tx?.amount || 0.10,
            amountFormatted: tx?.amountFormatted || '0.10',
            currency: tx?.currency || 'USD'
          });
        } catch (notifErr) {
          console.error('[Bakong Notif Error]:', notifErr.message);
        }

        return res.json({
          success: true,
          paid: true,
          status: 'PAID',
          apiKey: activeKey,
          secret: activeSecret
        });
      }

      return res.json({
        success: true,
        paid: false,
        status: 'PENDING'
      });

    } else {
      // ABA PayWay route
      return checkAbaPayment(req, res);
    }

  } catch (err) {
    console.error('Error in /api/web/check-payment:', err);
    return res.json({ success: false, paid: false, status: 'ERROR', error: err.message });
  }
});

router.setTelegramBot = setTelegramBot;
module.exports = router;

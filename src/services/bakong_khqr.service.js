const { BakongKHQR, IndividualInfo, khqrData } = require('bakong-khqr');
const crypto = require('node:crypto');

const khqrInstance = new BakongKHQR();
const DEFAULT_BAKONG_ACCOUNT = process.env.DEFAULT_BAKONG_ACCOUNT || 'hut_soksitchey1@aclb';
const DEFAULT_STORE_NAME = process.env.DEFAULT_MERCHANT_NAME || 'Rikidev';

/**
 * Resolves the acquiring member bank name from the Bakong account domain.
 * This is CRITICAL: NBC requires Tag 29 Subtag 02 (Acquiring Bank) so that
 * other banking apps (ABA Mobile, Wing, Canadia, TrueMoney, etc.) know how
 * to route and settle the interbank transaction via the NBC clearing system.
 * Without this subtag, other bank apps fail and display 'cannot pay'.
 */
function getAcquiringBankName(accountId) {
  const acc = String(accountId || '').toLowerCase().trim();
  if (acc.endsWith('@aclb')) return 'ACLEDA Bank';
  if (acc.endsWith('@abaa')) return 'ABA Bank';
  if (acc.endsWith('@wing')) return 'Wing Bank';
  if (acc.endsWith('@trmc')) return 'TrueMoney';
  if (acc.endsWith('@cani')) return 'Canadia Bank';
  if (acc.endsWith('@sath')) return 'Sathapana Bank';
  if (acc.endsWith('@ftbb')) return 'FTB Bank';
  if (acc.endsWith('@jtrb')) return 'J Trust Royal Bank';
  if (acc.endsWith('@ppcb')) return 'Phnom Penh Commercial Bank';
  return 'ACLEDA Bank';
}

/**
 * Generates an official, NBC-certified Bakong KHQR string.
 * Uses the official 'bakong-khqr' SDK from the National Bank of Cambodia.
 */
function generateBakongKhqrCore({
  amount = 0.10,
  currency = 'USD',
  merchantId = DEFAULT_BAKONG_ACCOUNT,
  merchantName = DEFAULT_STORE_NAME,
  phone = '0977416126',
  tranId = null,
  expiryHours = 24
} = {}) {
  const curr = String(currency || 'USD').toUpperCase();
  const amtNum = parseFloat(amount) || (curr === 'KHR' ? 400 : 0.10);
  const accountId = (merchantId && merchantId.trim()) || DEFAULT_BAKONG_ACCOUNT;
  const storeName = ((merchantName && merchantName.trim()) || DEFAULT_STORE_NAME).slice(0, 25);
  const transactionId = tranId || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const acquiringBank = getAcquiringBankName(accountId);

  // 24-hour expiration timestamp (NBC dynamic KHQR standard)
  const expirationTimestamp = Date.now() + (expiryHours * 60 * 60 * 1000);

  // Clean individual KHQR parameters compliant with NBC / EMVCo Tag 29 standard
  // Note: Tag 29 is Individual Account and only accepts subtag 00 (bakongAccountId).
  // Subtag 02 (acquiringBank) is only valid for Tag 30 (Merchant).
  // Omitting acquiringBank ensures ABA Mobile, Acleda, Wing, etc. parse the QR cleanly without 'cannot pay' errors.
  const indInfo = new IndividualInfo(
    accountId,
    storeName,
    'Phnom Penh',
    {
      currency: curr === 'KHR' ? khqrData.currency.khr : khqrData.currency.usd,
      amount: amtNum,
      billNumber: String(transactionId),
      mobileNumber: phone ? String(phone).replace(/[^0-9+]/g, '') : undefined,
      storeLabel: storeName,
      terminalLabel: 'POS-01',
      expirationTimestamp
    }
  );

  const result = khqrInstance.generateIndividual(indInfo);

  if (result && result.status && result.status.code === 0 && result.data && result.data.qr) {
    const qrString = result.data.qr;
    const md5Hash = result.data.md5 || crypto.createHash('md5').update(qrString).digest('hex');
    const deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;

    return {
      success: true,
      bank: 'BAKONG',
      merchantId: accountId,
      merchantName: storeName,
      amount: amtNum,
      amountFormatted: curr === 'KHR' ? String(Math.round(amtNum)) : amtNum.toFixed(2),
      currency: curr,
      tranId: transactionId,
      qrString,
      md5: md5Hash,
      deepLink
    };
  }

  throw new Error(result?.status?.message || 'Failed to generate official Bakong KHQR');
}

/**
 * Compatible helper for direct string generation
 */
function generateKhqrString(params = {}) {
  const core = generateBakongKhqrCore({
    amount: params.amount,
    currency: params.currency,
    merchantId: params.bakongAccount || params.accountId,
    merchantName: params.merchantName,
    phone: params.mobileNumber,
    tranId: params.billNumber
  });

  return {
    qrString: core.qrString,
    md5: core.md5,
    amount: core.amountFormatted,
    currency: core.currency,
    bakongAccount: core.merchantId,
    merchantName: core.merchantName
  };
}

/**
 * Generates official National Bank of Cambodia universal deeplink
 * for ANY KHQR string (Bakong or ABA PayWay).
 * This official NBC deeplink opens directly into the customer's banking app.
 * When encoded into the QR image, phone cameras immediately recognize it
 * and display a direct prompt to open the banking app!
 */
async function generateUniversalDeeplink(qrString) {
  if (!qrString) return 'https://bakong.nbc.gov.kh';
  try {
    const res = await BakongKHQR.generateDeepLink(
      'https://api-bakong.nbc.gov.kh/v1/generate_deeplink_by_qr',
      qrString
    );
    if (res && res.data && res.data.shortLink) {
      return res.data.shortLink;
    }
  } catch (err) {
    // Fallback to official universal deeplink format
  }
  return `https://bakong.nbc.gov.kh/deeplink?qr=${encodeURIComponent(qrString)}`;
}

module.exports = {
  BakongKHQR,
  IndividualInfo,
  khqrData,
  generateBakongKhqrCore,
  generateKhqrString,
  getAcquiringBankName,
  generateUniversalDeeplink,
  DEFAULT_BAKONG_ACCOUNT,
  DEFAULT_STORE_NAME
};

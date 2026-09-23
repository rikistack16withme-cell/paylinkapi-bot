const crypto = require('node:crypto');
const db = require('../database');

const PLAN_DURATIONS = {
  '1w': 7,
  '1m': 30,
  '1y': 365
};

const PLAN_TITLES = {
  '1w': '1 Week Pass ($0.10)',
  '1m': '1 Month Pro ($1.00)',
  '1y': '1 Year Enterprise ($10.00)'
};

const PLAN_INFO = {
  '1w': { days: 7, nameKm: 'កញ្ចប់សាកល្បង ១ សប្តាហ៍ ($0.10)', nameEn: '1 Week Pass ($0.10)' },
  '1m': { days: 30, nameKm: 'កញ្ចប់អាជីវកម្ម ១ ខែ ($1.00)', nameEn: '1 Month Pro ($1.00)' },
  '1y': { days: 365, nameKm: 'កញ្ចប់សហគ្រាស ១ ឆ្នាំ ($10.00)', nameEn: '1 Year Enterprise ($10.00)' }
};

function getDurationDays(planKey = '1w') {
  return PLAN_DURATIONS[planKey] || 7;
}

function calculateExpiryDate(startDate = new Date(), durationDays = 7) {
  const start = new Date(startDate);
  const expiry = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return expiry.toISOString();
}

class ApiKeyService {
  get PLAN_DURATIONS() {
    return PLAN_DURATIONS;
  }

  getPlanTitle(planKey, lang = 'km') {
    const info = PLAN_INFO[planKey] || PLAN_INFO['1w'];
    return lang === 'km' ? info.nameKm : info.nameEn;
  }
  /**
   * Retrieves or generates real working API keys for a user with expiration tracking
   */
  getOrCreateUserKeys(telegramId) {
    const tId = String(telegramId);
    const user = db.getUser(tId);
    const existing = db.getUserApiKeys(telegramId);

    if (existing && existing.length > 0) {
      let changed = false;

      // Migrate existing keys that lack expiresAt
      if (!existing[0].expiresAt) {
        const days = existing[0].plan === '1y' ? 365 : (existing[0].plan === '1w' ? 7 : 30);
        existing[0].plan = existing[0].plan || '1m';
        existing[0].durationDays = days;
        existing[0].expiresAt = calculateExpiryDate(existing[0].createdAt || new Date(), days);
        existing[0].expiryWarningSent = false;
        existing[0].expiredNoticeSent = false;
        changed = true;
      }

      if (user) {
        const userProv = String(user.provider || '').toLowerCase();
        const isBakongOnly = userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual');
        const isAbaOnly = userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual');

        if (isBakongOnly) {
          if (existing[0].khrLink !== null) { existing[0].khrLink = null; changed = true; }
          if (existing[0].usdLink !== null) { existing[0].usdLink = null; changed = true; }
        } else if (isAbaOnly) {
          if (existing[0].bakongId !== null) { existing[0].bakongId = null; changed = true; }
          if (existing[0].merchantId !== null) { existing[0].merchantId = null; changed = true; }
        } else {
          if (existing[0].khrLink !== (user.khrLink || null)) { existing[0].khrLink = user.khrLink || null; changed = true; }
          if (existing[0].usdLink !== (user.usdLink || null)) { existing[0].usdLink = user.usdLink || null; changed = true; }
        }

        if (user.merchantName && existing[0].merchantName !== user.merchantName) { existing[0].merchantName = user.merchantName; changed = true; }
        if (!isAbaOnly && (user.merchantId || user.bakongId)) {
          const mId = user.merchantId || user.bakongId || null;
          if (existing[0].merchantId !== mId) { existing[0].merchantId = mId; changed = true; }
          if (existing[0].bakongId !== mId) { existing[0].bakongId = mId; changed = true; }
        }
        if (user.phone && existing[0].phone !== user.phone) { existing[0].phone = user.phone; changed = true; }
        if (user.provider && existing[0].provider !== user.provider) { existing[0].provider = user.provider; changed = true; }
      }
      if (changed) {
        db.saveApiKey(existing[0]);
      }
      return existing;
    }

    // Create live working key tied directly to the user's registered bank details
    const planKey = user?.plan || '1w';
    const durationDays = getDurationDays(planKey);
    const now = new Date();

    const liveKey = {
      id: `key_${tId}`,
      telegramId: tId,
      provider: user?.provider || 'NBC Bakong National KHQR',
      tier: 'Production Live Rail',
      apiKey: `plk_live_${tId}_${crypto.randomBytes(4).toString('hex')}`,
      secret: `whsec_${crypto.randomBytes(8).toString('hex')}`,
      status: 'ACTIVE',
      isMock: false,
      bakongId: user?.bakongId || user?.merchantId || null,
      merchantId: user?.merchantId || user?.bakongId || null,
      phone: user?.phone || null,
      khrLink: user?.khrLink || null,
      usdLink: user?.usdLink || null,
      merchantName: user?.merchantName || (user?.firstName ? `${user.firstName}'s Store` : 'Merchant Store'),
      plan: planKey,
      durationDays,
      createdAt: now.toISOString(),
      expiresAt: calculateExpiryDate(now, durationDays),
      expiryWarningSent: false,
      expiredNoticeSent: false
    };

    const saved = db.saveApiKey(liveKey);
    return [saved];
  }

  /**
   * Retrieves all registered API keys for a user
   */
  getUserApiKeys(telegramId) {
    const tId = String(telegramId);
    let keys = db.getUserApiKeys(tId);
    if (!keys || keys.length === 0) {
      keys = this.getOrCreateUserKeys(tId);
    }
    return keys;
  }

  /**
   * Retrieves a specific API key by its unique ID
   */
  getKeyById(keyId) {
    if (!keyId) return null;
    let allKeys = Object.values(db.data.apiKeys || {});
    let found = allKeys.find(k => k.id === keyId || k.apiKey === keyId);
    if (!found) {
      db.reload();
      allKeys = Object.values(db.data.apiKeys || {});
      found = allKeys.find(k => k.id === keyId || k.apiKey === keyId);
    }
    return found || null;
  }

  /**
   * Creates an additional unique API key for an order / store
   */
  createAdditionalApiKey(telegramId, details = {}) {
    const tId = String(telegramId);
    const user = db.getUser(tId);
    const keyIndex = db.getUserApiKeys(tId).length + 1;
    const planKey = details.plan || '1w';
    const durationDays = getDurationDays(planKey);
    const now = new Date();

    const newKey = {
      id: `key_${tId}_${Date.now()}`,
      telegramId: tId,
      provider: details.provider || user?.provider || 'NBC Bakong National KHQR & ABA PayWay',
      tier: details.tier || 'Production Live Rail',
      apiKey: `dp_live_${tId}_${crypto.randomBytes(4).toString('hex')}`,
      secret: `whsec_${crypto.randomBytes(8).toString('hex')}`,
      status: 'ACTIVE',
      isMock: false,
      bakongId: details.bakongId || details.merchantId || user?.bakongId || user?.merchantId || null,
      merchantId: details.merchantId || details.bakongId || user?.merchantId || user?.bakongId || null,
      phone: details.phone || user?.phone || null,
      khrLink: details.khrLink || user?.khrLink || null,
      usdLink: details.usdLink || user?.usdLink || null,
      merchantName: details.merchantName || user?.merchantName || (user?.firstName ? `${user.firstName}'s Store #${keyIndex}` : `Store #${keyIndex}`),
      plan: planKey,
      durationDays,
      createdAt: now.toISOString(),
      expiresAt: calculateExpiryDate(now, durationDays),
      expiryWarningSent: false,
      expiredNoticeSent: false
    };

    const saved = db.saveApiKey(newKey);
    return saved;
  }

  /**
   * Renews or extends an existing user's subscription
   */
  renewApiKeySubscription(telegramId, planKey = '1w') {
    const tId = String(telegramId);
    const keys = this.getUserApiKeys(tId);
    if (!keys || keys.length === 0) return null;

    const key = keys[0];
    const durationDays = getDurationDays(planKey);
    const now = Date.now();

    // If key is currently active and not expired, extend from existing expiresAt
    let baseDate = new Date();
    if (key.status === 'ACTIVE' && key.expiresAt && new Date(key.expiresAt).getTime() > now) {
      baseDate = new Date(key.expiresAt);
    }

    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    key.plan = planKey;
    key.durationDays = durationDays;
    key.expiresAt = newExpiry.toISOString();
    key.status = 'ACTIVE';
    key.expiryWarningSent = false;
    key.expiredNoticeSent = false;
    key.renewedAt = new Date().toISOString();

    db.saveApiKey(key);
    return key;
  }

  /**
   * Computes countdown details (remaining days, hours, minutes, expired status)
   */
  getExpiryCountdown(key, lang = 'km') {
    if (!key || !key.expiresAt) {
      return {
        isExpired: false,
        isExpiringSoon: false,
        totalSeconds: Infinity,
        days: 999,
        hours: 0,
        minutes: 0,
        text: lang === 'km' ? 'សុពលភាពអចិន្ត្រៃយ៍' : 'Permanent Active'
      };
    }

    const now = Date.now();
    const expiryTime = new Date(key.expiresAt).getTime();
    const diffMs = expiryTime - now;

    if (diffMs <= 0 || key.status === 'EXPIRED') {
      return {
        isExpired: true,
        isExpiringSoon: false,
        totalSeconds: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        text: lang === 'km' ? '🔴 ផុតកំណត់ហើយ (Expired)' : '🔴 Expired (Deactivated)'
      };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const isExpiringSoon = diffMs <= 24 * 60 * 60 * 1000; // <= 24 hours

    let formatted = '';
    if (lang === 'km') {
      if (days > 0) {
        formatted = `${days} ថ្ងៃ ${hours} ម៉ោង`;
      } else if (hours > 0) {
        formatted = `${hours} ម៉ោង ${minutes} នាទី`;
      } else {
        formatted = `${minutes} នាទី`;
      }
    } else {
      if (days > 0) {
        formatted = `${days}d ${hours}h`;
      } else if (hours > 0) {
        formatted = `${hours}h ${minutes}m`;
      } else {
        formatted = `${minutes}m`;
      }
    }

    return {
      isExpired: false,
      isExpiringSoon,
      totalSeconds,
      days,
      hours,
      minutes,
      text: formatted
    };
  }

  /**
   * Returns API keys for UI display in bot
   */
  getMockKeysForUser(telegramId) {
    return this.getUserApiKeys(telegramId);
  }

  /**
   * Validates an API key for REST API authentication
   * Strictly enforces auto-expiration and revokes expired keys
   */
  validateApiKey(apiKey) {
    if (!apiKey) return { valid: false };

    // Built-in sandbox testing keys (only for admin sandbox testing)
    if (
      apiKey === 'bk_sandbox_test_mock_98472398472' ||
      apiKey === 'aba_sandbox_test_mock_11893726419' ||
      apiKey === 'dp_test_sandbox_master_key'
    ) {
      return {
        valid: true,
        tier: 'Sandbox Staging',
        isSandbox: true,
        bakongId: 'hut_soksitchey1@aclb',
        merchantId: 'hut_soksitchey1@aclb',
        phone: '0977416126',
        khrLink: 'https://link.payway.com.kh/ABAPAYk8523640S',
        usdLink: 'https://link.payway.com.kh/ABAPAY86523639G',
        merchantName: 'PaylinkApi Sandbox Store',
        provider: 'NBC Bakong KHQR & ABA PayWay Dual Rail'
      };
    }

    // Lookup in database
    let allKeys = Object.values(db.data.apiKeys || {});
    let match = allKeys.find(k => k.apiKey === apiKey);
    if (!match) {
      db.reload();
      allKeys = Object.values(db.data.apiKeys || {});
      match = allKeys.find(k => k.apiKey === apiKey);
    }
    if (match) {
      // 1. Strict Expiry Verification:
      const now = Date.now();
      const isExpired = match.status === 'EXPIRED' || (match.expiresAt && new Date(match.expiresAt).getTime() <= now);

      if (isExpired) {
        if (match.status !== 'EXPIRED') {
          match.status = 'EXPIRED';
          db.saveApiKey(match);
        }
        return {
          valid: false,
          expired: true,
          expiresAt: match.expiresAt,
          apiKey: match.apiKey,
          error: 'API_KEY_EXPIRED: Your API Key subscription has expired. Please renew your subscription via Telegram Bot.'
        };
      }

      const user = db.getUser(match.telegramId) || {};
      const userProv = String(user.provider || match.provider || '').toLowerCase();
      const isBakongOnly = userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual');
      const isAbaOnly = userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual');

      const resolvedBakong = !isAbaOnly ? (user.bakongId || user.merchantId || match.bakongId || match.merchantId || null) : null;
      const resolvedKhr = !isBakongOnly ? (user.khrLink || match.khrLink || null) : null;
      const resolvedUsd = !isBakongOnly ? (user.usdLink || match.usdLink || null) : null;
      const resolvedName = user.merchantName || match.merchantName || (user.firstName ? `${user.firstName}'s Store` : 'Merchant Store');
      const resolvedPhone = user.phone || match.phone || '0977416126';

      return {
        valid: true,
        keyData: match,
        apiKey: match.apiKey,
        secret: match.secret,
        tier: match.tier,
        telegramId: match.telegramId,
        provider: user.provider || match.provider || (isBakongOnly ? 'NBC Bakong National KHQR' : (isAbaOnly ? 'ABA PayWay Gateway' : 'NBC Bakong KHQR & ABA PayWay Dual Rail')),
        bakongId: resolvedBakong,
        merchantId: resolvedBakong,
        phone: resolvedPhone,
        khrLink: resolvedKhr,
        usdLink: resolvedUsd,
        merchantName: resolvedName,
        expiresAt: match.expiresAt,
        plan: match.plan || '1w',
        planTitle: PLAN_TITLES[match.plan] || 'Subscription Plan'
      };
    }

    return { valid: false };
  }

  // --- Master Admin API Key Management ---
  getAllApiKeys() {
    return db.getAllApiKeys();
  }

  revokeApiKey(keyIdOrKey) {
    return db.deleteApiKey(keyIdOrKey);
  }

  generateManualKey(telegramId, { merchantName = 'Admin Store', provider = 'NBC Bakong KHQR & ABA PayWay Dual Rail', durationDays = 365, plan = '1y' } = {}) {
    const tId = String(telegramId);
    const now = new Date();
    const keyData = {
      id: `key_${tId}_${Date.now()}`,
      telegramId: tId,
      provider,
      tier: 'Master Admin VIP Rail',
      apiKey: `plk_live_${tId}_${crypto.randomBytes(4).toString('hex')}`,
      secret: `whsec_${crypto.randomBytes(8).toString('hex')}`,
      status: 'ACTIVE',
      isMock: false,
      merchantName,
      plan,
      durationDays,
      createdAt: now.toISOString(),
      expiresAt: calculateExpiryDate(now, durationDays),
      expiryWarningSent: false,
      expiredNoticeSent: false
    };
    return db.saveApiKey(keyData);
  }
}

module.exports = new ApiKeyService();

const crypto = require('node:crypto');
const db = require('../database');

const PLAN_DURATIONS = {
  '1w': 7,
  '1m': 30,
  '1y': 365
};

const PLAN_TITLES = {
  '1w': '1 Week Pass ($0.50)',
  '1m': '1 Month Pro ($2.50)',
  '1y': '1 Year Enterprise ($15.00)'
};

const PLAN_INFO = {
  '1w': { days: 7, nameKm: 'កញ្ចប់សាកល្បង ១ សប្តាហ៍ ($0.50)', nameEn: '1 Week Pass ($0.50)' },
  '1m': { days: 30, nameKm: 'កញ្ចប់អាជីវកម្ម ១ ខែ ($2.50)', nameEn: '1 Month Pro ($2.50)' },
  '1y': { days: 365, nameKm: 'កញ្ចប់សហគ្រាស ១ ឆ្នាំ ($15.00)', nameEn: '1 Year Enterprise ($15.00)' }
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
        const isBakongOnly = (userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user.bakongId || user.merchantId) && !user.usdLink && !user.khrLink);
        const isAbaOnly = (userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user.usdLink || user.khrLink) && !user.bakongId && !user.merchantId);

        if (isBakongOnly) {
          if (existing[0].khrLink !== null) { existing[0].khrLink = null; changed = true; }
          if (existing[0].usdLink !== null) { existing[0].usdLink = null; changed = true; }
          if (existing[0].provider !== 'Bakong KHQR') { existing[0].provider = 'Bakong KHQR'; changed = true; }
        } else if (isAbaOnly) {
          if (existing[0].bakongId !== null) { existing[0].bakongId = null; changed = true; }
          if (existing[0].merchantId !== null) { existing[0].merchantId = null; changed = true; }
          if (existing[0].provider !== 'ABA PayWay Gateway') { existing[0].provider = 'ABA PayWay Gateway'; changed = true; }
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

    const userProv = String(user?.provider || '').toLowerCase();
    const isBakongOnly = (userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user?.bakongId || user?.merchantId) && !user?.usdLink && !user?.khrLink);
    const isAbaOnly = (userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user?.usdLink || user?.khrLink) && !user?.bakongId && !user?.merchantId);

    const resolvedProvider = isBakongOnly
      ? 'Bakong KHQR'
      : (isAbaOnly ? 'ABA PayWay Gateway' : (user?.provider || 'Dual Suite (ABA & Bakong)'));

    const liveKey = {
      id: `key_${tId}`,
      telegramId: tId,
      provider: resolvedProvider,
      tier: 'Production Live Rail',
      apiKey: `plk_live_${tId}_${crypto.randomBytes(4).toString('hex')}`,
      secret: `whsec_${crypto.randomBytes(8).toString('hex')}`,
      status: 'ACTIVE',
      isMock: false,
      bakongId: isAbaOnly ? null : (user?.bakongId || user?.merchantId || null),
      merchantId: isAbaOnly ? null : (user?.merchantId || user?.bakongId || null),
      phone: user?.phone || null,
      khrLink: isBakongOnly ? null : (user?.khrLink || null),
      usdLink: isBakongOnly ? null : (user?.usdLink || null),
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
        bakongId: 'sandbox_merchant@bakong',
        merchantId: 'sandbox_merchant@bakong',
        phone: null,
        khrLink: 'https://link.payway.com.kh/ABAPAYsandboxkhr',
        usdLink: 'https://link.payway.com.kh/ABAPAYsandboxusd',
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
      const isBakongOnly = (userProv.includes('bakong') && !userProv.includes('aba') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user.bakongId || match.bakongId) && !user.usdLink && !match.usdLink && !user.khrLink && !match.khrLink);
      const isAbaOnly = (userProv.includes('aba') && !userProv.includes('bakong') && !userProv.includes('bundle') && !userProv.includes('dual')) || ((user.usdLink || match.usdLink || user.khrLink || match.khrLink) && !user.bakongId && !match.bakongId);

      const resolvedBakong = !isAbaOnly ? (user.bakongId || user.merchantId || match.bakongId || match.merchantId || null) : null;
      const resolvedKhr = !isBakongOnly ? (user.khrLink || match.khrLink || null) : null;
      const resolvedUsd = !isBakongOnly ? (user.usdLink || match.usdLink || null) : null;
      const resolvedName = user.merchantName || match.merchantName || (user.firstName ? `${user.firstName}'s Store` : 'Merchant Store');
      const resolvedPhone = user.phone || match.phone || null;

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
    return this.configureAndIssueAdminKey(telegramId, {
      merchantName,
      provider,
      durationDays,
      plan
    }).key;
  }

  /**
   * Master Admin: Configures rail, credentials, days, and issues/updates production key
   */
  configureAndIssueAdminKey(telegramId, {
    rail = 'bundle', // 'bakong', 'aba', 'bundle'
    durationDays = 365,
    plan = null,
    merchantName = null,
    bakongId = null,
    usdLink = null,
    khrLink = null,
    phone = null,
    tier = 'Master Admin VIP Rail'
  } = {}) {
    const isStandalone = !telegramId || String(telegramId).toLowerCase().startsWith('standalone');
    const tId = isStandalone ? `standalone_${Date.now()}` : String(telegramId);
    let user = db.getUser(tId) || {
      telegramId: tId,
      username: '',
      firstName: isStandalone ? (merchantName || 'Standalone Merchant') : 'Merchant',
      lastName: '',
      createdAt: new Date().toISOString(),
      isStandalone
    };

    const normRail = String(rail || 'bundle').toLowerCase().trim();
    const days = parseInt(durationDays, 10) || 365;
    const planKey = plan || (days >= 365 ? '1y' : (days >= 30 ? '1m' : '1w'));

    let providerTitle = 'Dual Suite (Bakong + ABA)';
    let providerKey = 'bundle';

    if (normRail.includes('bakong') && !normRail.includes('aba') && !normRail.includes('bundle') && !normRail.includes('dual')) {
      providerTitle = 'Bakong KHQR';
      providerKey = 'bakong';
      user.provider = providerTitle;
      user.providerKey = providerKey;
      if (bakongId) {
        user.bakongId = String(bakongId).trim();
        user.merchantId = user.bakongId;
      }
      user.usdLink = null;
      user.khrLink = null;
    } else if (normRail.includes('aba') && !normRail.includes('bakong') && !normRail.includes('bundle') && !normRail.includes('dual')) {
      providerTitle = 'ABA PayWay Gateway';
      providerKey = 'aba';
      user.provider = providerTitle;
      user.providerKey = providerKey;
      if (usdLink) user.usdLink = String(usdLink).trim();
      if (khrLink) user.khrLink = String(khrLink).trim();
      user.bakongId = null;
      user.merchantId = null;
    } else {
      providerTitle = 'Dual Suite (Bakong + ABA)';
      providerKey = 'bundle';
      user.provider = providerTitle;
      user.providerKey = providerKey;
      if (bakongId) {
        user.bakongId = String(bakongId).trim();
        user.merchantId = user.bakongId;
      }
      if (usdLink) user.usdLink = String(usdLink).trim();
      if (khrLink) user.khrLink = String(khrLink).trim();
    }

    if (merchantName) user.merchantName = String(merchantName).trim();
    if (phone) user.phone = String(phone).trim();

    user.status = 'ACTIVE';
    user.approved = true;
    user.subscription = {
      status: 'ACTIVE',
      plan: planKey,
      durationDays: days,
      activatedAt: new Date().toISOString(),
      expiresAt: calculateExpiryDate(new Date(), days),
      activatedBy: 'MASTER_ADMIN'
    };

    if (!isStandalone) {
      db.saveUser(user);
    }

    // Synchronize or create key
    const existingKeys = db.getUserApiKeys(tId);
    let targetKey = existingKeys && existingKeys.length > 0 ? existingKeys[0] : null;
    const now = new Date();
    const expiryDate = calculateExpiryDate(now, days);
    let isNew = false;

    const apiKeyString = isStandalone
      ? `plk_live_std_${crypto.randomBytes(6).toString('hex')}`
      : `plk_live_${tId}_${crypto.randomBytes(4).toString('hex')}`;

    if (targetKey) {
      targetKey.provider = providerTitle;
      targetKey.tier = isStandalone ? 'Master Admin Standalone Key' : tier;
      targetKey.merchantName = user.merchantName || targetKey.merchantName || merchantName || 'Merchant Store';
      targetKey.bakongId = user.bakongId;
      targetKey.merchantId = user.merchantId;
      targetKey.usdLink = user.usdLink;
      targetKey.khrLink = user.khrLink;
      targetKey.phone = user.phone;
      targetKey.plan = planKey;
      targetKey.durationDays = days;
      targetKey.status = 'ACTIVE';
      targetKey.expiresAt = expiryDate;
      targetKey.expiryWarningSent = false;
      targetKey.expiredNoticeSent = false;
      targetKey.updatedAt = now.toISOString();
      db.saveApiKey(targetKey);
    } else {
      isNew = true;
      targetKey = {
        id: `key_${tId}`,
        telegramId: tId,
        provider: providerTitle,
        tier: isStandalone ? 'Master Admin Standalone Key' : tier,
        apiKey: apiKeyString,
        secret: `whsec_${crypto.randomBytes(8).toString('hex')}`,
        status: 'ACTIVE',
        isMock: false,
        isStandalone,
        merchantName: user.merchantName || merchantName || (isStandalone ? 'Standalone VIP Merchant' : 'Merchant Store'),
        bakongId: user.bakongId,
        merchantId: user.merchantId,
        usdLink: user.usdLink,
        khrLink: user.khrLink,
        phone: user.phone,
        plan: planKey,
        durationDays: days,
        createdAt: now.toISOString(),
        expiresAt: expiryDate,
        expiryWarningSent: false,
        expiredNoticeSent: false
      };
      db.saveApiKey(targetKey);
    }

    return { user, key: targetKey, isNew, rail: providerKey, isStandalone };
  }

  /**
   * Master Admin: Set key validity in days and update expiry
   */
  setKeyDuration(telegramId, days = 30) {
    const tId = String(telegramId);
    const durationDays = parseInt(days, 10) || 30;
    const planKey = durationDays >= 365 ? '1y' : (durationDays >= 30 ? '1m' : '1w');
    const now = new Date();
    const expiryDate = calculateExpiryDate(now, durationDays);

    let user = db.getUser(tId);
    if (user) {
      user.status = 'ACTIVE';
      user.subscription = {
        ...(user.subscription || {}),
        status: 'ACTIVE',
        plan: planKey,
        durationDays,
        expiresAt: expiryDate
      };
      db.saveUser(user);
    }

    const keys = db.getUserApiKeys(tId);
    let key = keys && keys.length > 0 ? keys[0] : null;
    if (key) {
      key.status = 'ACTIVE';
      key.plan = planKey;
      key.durationDays = durationDays;
      key.expiresAt = expiryDate;
      key.expiryWarningSent = false;
      key.expiredNoticeSent = false;
      db.saveApiKey(key);
    } else {
      const res = this.configureAndIssueAdminKey(tId, { durationDays });
      key = res.key;
      user = res.user;
    }

    return { user, key, durationDays, expiresAt: expiryDate };
  }

  /**
   * Master Admin: Switch user's payment rail (bakong, aba, bundle)
   */
  setMerchantRail(telegramId, rail = 'bundle') {
    return this.configureAndIssueAdminKey(telegramId, { rail });
  }

  /**
   * Master Admin: Set custom bank credentials for merchant
   */
  setMerchantBankCredentials(telegramId, { bakongId = null, usdLink = null, khrLink = null, merchantName = null, phone = null } = {}) {
    const tId = String(telegramId);
    let user = db.getUser(tId);
    if (!user) {
      user = { telegramId: tId, firstName: 'Merchant', createdAt: new Date().toISOString() };
    }

    if (bakongId !== null && bakongId !== undefined) {
      user.bakongId = bakongId ? String(bakongId).trim() : null;
      user.merchantId = user.bakongId;
    }
    if (usdLink !== null && usdLink !== undefined) {
      user.usdLink = usdLink ? String(usdLink).trim() : null;
    }
    if (khrLink !== null && khrLink !== undefined) {
      user.khrLink = khrLink ? String(khrLink).trim() : null;
    }
    if (merchantName) {
      user.merchantName = String(merchantName).trim();
    }
    if (phone !== null && phone !== undefined) {
      user.phone = phone ? String(phone).trim() : null;
    }

    db.saveUser(user);

    // Also update existing active key
    const keys = db.getUserApiKeys(tId);
    let key = keys && keys.length > 0 ? keys[0] : null;
    if (key) {
      if (bakongId !== null && bakongId !== undefined) {
        key.bakongId = user.bakongId;
        key.merchantId = user.merchantId;
      }
      if (usdLink !== null && usdLink !== undefined) {
        key.usdLink = user.usdLink;
      }
      if (khrLink !== null && khrLink !== undefined) {
        key.khrLink = user.khrLink;
      }
      if (merchantName) {
        key.merchantName = user.merchantName;
      }
      if (phone !== null && phone !== undefined) {
        key.phone = user.phone;
      }
      db.saveApiKey(key);
    }

    return { user, key };
  }
}

module.exports = new ApiKeyService();

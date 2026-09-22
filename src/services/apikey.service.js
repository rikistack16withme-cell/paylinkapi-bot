const crypto = require('node:crypto');
const db = require('../database');

class ApiKeyService {
  /**
   * Retrieves or generates real working API keys for a user
   */
  getOrCreateUserKeys(telegramId) {
    const tId = String(telegramId);
    const user = db.getUser(tId);
    const existing = db.getUserApiKeys(telegramId);

    if (existing && existing.length > 0) {
      let changed = false;
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
      createdAt: new Date().toISOString()
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
      plan: details.plan || '1m',
      createdAt: new Date().toISOString()
    };

    const saved = db.saveApiKey(newKey);
    return saved;
  }

  /**
   * Returns API keys for UI display in bot
   */
  getMockKeysForUser(telegramId) {
    return this.getUserApiKeys(telegramId);
  }

  /**
   * Validates an API key for REST API authentication
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
        merchantName: resolvedName
      };
    }

    return { valid: false };
  }
}

module.exports = new ApiKeyService();

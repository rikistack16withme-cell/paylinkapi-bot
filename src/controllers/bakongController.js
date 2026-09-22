const BAKONG_BYPASS_URL = process.env.BAKONG_BYPASS_URL || 'http://localhost:3000';
const SITE = 'https://api-bakong.nbc.gov.kh/';

function unflattenNuxtPayload(rawArray) {
  if (!Array.isArray(rawArray) || rawArray.length === 0) return null;

  const cache = new Map();

  function resolve(idx) {
    if (typeof idx !== 'number' || idx < 0 || idx >= rawArray.length) {
      return idx;
    }
    if (cache.has(idx)) {
      return cache.get(idx);
    }

    const item = rawArray[idx];
    if (item === null || typeof item !== 'object') {
      return item;
    }

    if (Array.isArray(item)) {
      if (item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'number') {
        const type = item[0];
        if (['ShallowReactive', 'Reactive', 'Ref', 'Set'].includes(type)) {
          return resolve(item[1]);
        }
      }
      const resolvedArray = [];
      cache.set(idx, resolvedArray);
      for (const el of item) {
        resolvedArray.push(typeof el === 'number' ? resolve(el) : el);
      }
      return resolvedArray;
    }

    const resolvedObj = {};
    cache.set(idx, resolvedObj);
    for (const [key, valIdx] of Object.entries(item)) {
      resolvedObj[key] = typeof valIdx === 'number' ? resolve(valIdx) : valIdx;
    }
    return resolvedObj;
  }

  return resolve(1);
}

async function queryBakongByMd5(md5) {
  if (!md5) {
    return {
      status: 'ERROR',
      responseCode: 1,
      errorCode: 1,
      message: 'Missing MD5 hash',
      data: null
    };
  }

  // 1. First attempt: Query Bakong Bypass high-speed engine
  try {
    const bypassRes = await fetch(`${BAKONG_BYPASS_URL}/api/bakong/unofficial/md5=${md5}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3500)
    });
    if (bypassRes.ok) {
      const bypassData = await bypassRes.json();
      if (bypassData && (bypassData.status === 'SUCCESS' || bypassData.status === 'PENDING')) {
        return bypassData;
      }
    }
  } catch (bypassErr) {
    // Fall back to direct NBC SSR query below
  }

  // 2. Direct Fallback: Query NBC Bakong Gateway via SSR
  const cookieVal = encodeURIComponent(
    JSON.stringify({
      type: 'MD5',
      value: md5,
      amount: '',
      ccy: 'USD'
    })
  );

  const response = await fetch(SITE, {
    method: 'GET',
    headers: {
      'Cookie': `tx_search=${cookieVal}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache'
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    return {
      status: 'PENDING',
      responseCode: 1,
      errorCode: 18,
      message: `NBC gateway HTTP status ${response.status}`,
      data: null
    };
  }

  const html = await response.text();
  const match = html.match(/<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    return {
      status: 'PENDING',
      responseCode: 1,
      errorCode: 18,
      message: 'Unable to parse NBC response payload',
      data: null
    };
  }

  const rawArray = JSON.parse(match[1]);
  const parsed = unflattenNuxtPayload(rawArray);
  const txLookup = parsed?.data?.['tx-lookup'];

  if (txLookup?.txResult) {
    return {
      status: 'SUCCESS',
      responseCode: 0,
      errorCode: 0,
      responseMessage: 'Transaction confirmed successfully',
      data: txLookup.txResult
    };
  }

  if (txLookup?.txError?.errorCode === 1) {
    return {
      status: 'PENDING',
      responseCode: 1,
      errorCode: 1,
      responseMessage: 'Transaction not found (waiting for payment)',
      data: null
    };
  }

  return {
    status: 'PENDING',
    responseCode: 1,
    errorCode: txLookup?.txError?.errorCode || 18,
    responseMessage: 'Waiting for transaction confirmation',
    data: null
  };
}

/**
 * Express Controller: Check Bakong payment by MD5
 * GET /api/bakong/check/:md5
 */
async function checkBakongStatus(req, res) {
  const md5 = req.params?.md5 || req.query?.md5;
  try {
    const result = await queryBakongByMd5(md5);
    return res.json(result);
  } catch (err) {
    console.warn('[Bakong Status Check Error]:', err.message);
    return res.json({
      status: 'PENDING',
      responseCode: 1,
      errorCode: 18,
      message: err.message,
      data: null
    });
  }
}

module.exports = {
  queryBakongByMd5,
  checkBakongStatus
};

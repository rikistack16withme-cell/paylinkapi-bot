import http from "node:http";

const PORT = process.env.PORT || 3000;
const SITE = "https://api-bakong.nbc.gov.kh/";

/**
 * Unflattens Nuxt 3 devalue payload format
 */
function unflattenNuxtPayload(rawArray) {
  if (!Array.isArray(rawArray) || rawArray.length === 0) return null;

  const cache = new Map();

  function resolve(idx) {
    if (typeof idx !== "number" || idx < 0 || idx >= rawArray.length) {
      return idx;
    }
    if (cache.has(idx)) {
      return cache.get(idx);
    }

    const item = rawArray[idx];
    if (item === null || typeof item !== "object") {
      return item;
    }

    if (Array.isArray(item)) {
      if (item.length === 2 && typeof item[0] === "string" && typeof item[1] === "number") {
        const type = item[0];
        if (["ShallowReactive", "Reactive", "Ref", "Set"].includes(type)) {
          return resolve(item[1]);
        }
      }
      const resolvedArray = [];
      cache.set(idx, resolvedArray);
      for (const el of item) {
        resolvedArray.push(typeof el === "number" ? resolve(el) : el);
      }
      return resolvedArray;
    }

    const resolvedObj = {};
    cache.set(idx, resolvedObj);
    for (const [key, valIdx] of Object.entries(item)) {
      resolvedObj[key] = typeof valIdx === "number" ? resolve(valIdx) : valIdx;
    }
    return resolvedObj;
  }

  return resolve(1);
}

/**
 * Queries NBC Bakong Open API v2.0.3 using direct SSR verification
 */
async function queryBakongByMd5(md5) {
  const cookieVal = encodeURIComponent(
    JSON.stringify({
      type: "MD5",
      value: md5,
      amount: "",
      ccy: "USD",
    })
  );

  const response = await fetch(SITE, {
    method: "GET",
    headers: {
      "Cookie": `tx_search=${cookieVal}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return {
      status: "PENDING",
      responseCode: 1,
      errorCode: 18,
      message: `NBC gateway HTTP status ${response.status}`,
      data: null,
    };
  }

  const html = await response.text();
  const match = html.match(/<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    return {
      status: "PENDING",
      responseCode: 1,
      errorCode: 18,
      message: "Unable to parse NBC response payload",
      data: null,
    };
  }

  const rawArray = JSON.parse(match[1]);
  const parsed = unflattenNuxtPayload(rawArray);
  const txLookup = parsed?.data?.["tx-lookup"];

  if (txLookup?.txResult) {
    return {
      status: "SUCCESS",
      responseCode: 0,
      errorCode: 0,
      responseMessage: "Transaction confirmed successfully",
      data: txLookup.txResult,
    };
  }

  if (txLookup?.txError?.errorCode === 1) {
    return {
      status: "PENDING",
      responseCode: 1,
      errorCode: 1,
      responseMessage: "Transaction not found (waiting for payment)",
      data: null,
    };
  }

  return {
    status: "PENDING",
    responseCode: 1,
    errorCode: txLookup?.txError?.errorCode || 18,
    responseMessage: "Waiting for transaction confirmation",
    data: null,
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (url === "/" || url === "/health") {
    return sendJson(res, 200, {
      service: "bakong-md5-api",
      status: "ready",
      engine: "direct-ssr-v2",
      usage: "GET /api/bakong/unofficial/md5=<32-char-md5>",
    });
  }

  const m = url.match(/^\/api\/bakong\/unofficial\/md5=([0-9a-fA-F]{32})(?:\?.*)?$/);
  if (!m) {
    return sendJson(res, 404, { error: "Not found", expected: "/api/bakong/unofficial/md5=<md5>" });
  }

  const md5 = m[1];
  try {
    const result = await queryBakongByMd5(md5);
    sendJson(res, 200, result);
  } catch (err) {
    console.warn("⚠️ [Bakong Bypass Check Notice]:", err.message);
    sendJson(res, 200, {
      status: "PENDING",
      responseCode: 1,
      errorCode: 18,
      message: err.message,
      data: null,
    });
  }
});

server.listen(PORT, () => {
  console.log(`✅ [Bakong Bypass Ready] High-speed direct SSR engine listening on http://localhost:${PORT}`);
});

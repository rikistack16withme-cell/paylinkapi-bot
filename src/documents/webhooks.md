# 📡 Webhooks & Callbacks

Receive instantaneous server-to-server notifications as soon as payments settle on the National Bank of Cambodia Bakong system or ABA PayWay network.

## Webhook Signature Verification
Every webhook includes an `X-Signature` header computed via HMAC-SHA256 of the raw request payload using your API Secret Key.

```json
{
  "event": "payment.settled",
  "data": {
    "orderId": "INV-2026-001",
    "amount": 25.00,
    "currency": "USD",
    "txHash": "0x4b7f9..."
  }
}
```

> ℹ️ *Phase 1 Notice: Webhook delivery engine will be integrated with Phase 2 package.*

# 💳 Create Payment Specification

Initiate dynamic KHQR QR codes or ABA PayWay checkout sessions.

## Unified Payload Structure
```json
{
  "amount": 25.00,
  "currency": "USD",
  "orderId": "INV-2026-001",
  "provider": "bakong",
  "merchantName": "My Store KH",
  "callbackUrl": "https://api.yourdomain.com/webhooks/payment"
}
```

## Merchant Naming Architecture Rules
- **Bakong KHQR (`bakong`)**: Merchants **can custom-set** their display name dynamically in the bot or API payload (`merchantName`). This name appears in banking apps when customers scan the KHQR code.
- **ABA PayWay (`aba`)**: Merchant name **cannot** be customized in the bot or API payload. Merchants must configure their desired business name directly inside the **ABA Merchant App**, create their account there, and paste their checkout link.

## Response Preview
```json
{
  "status": "success",
  "qrString": "00020101021229...",
  "md5": "a8f5c3...",
  "merchantName": "My Store KH",
  "expiresAt": "2026-09-15T01:30:00Z"
}
```

> ℹ️ *Phase 1 Notice: Payment creation endpoint will be hooked up to real provider SDKs in Phase 2.*

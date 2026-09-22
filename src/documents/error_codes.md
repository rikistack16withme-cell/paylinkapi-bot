# ❌ Standard Error Codes

PaylinkApi uses standard HTTP response codes alongside granular error identifiers:

| Code | Type | Description |
| :--- | :--- | :--- |
| `400` | `INVALID_REQUEST` | Missing or malformed parameters |
| `401` | `UNAUTHORIZED` | Invalid or expired API token |
| `402` | `PAYMENT_EXPIRED` | KHQR or PayWay session expired before payment |
| `404` | `TX_NOT_FOUND` | Specified transaction identifier does not exist |
| `502` | `BANK_UNAVAILABLE`| National bank or acquiring gateway temporary timeout |
| `503` | `PHASE1_STUB` | Provider integration is in preparation stage |

> ℹ️ *Phase 1 Notice: Live error mapping will be finalized upon connecting Phase 2 provider files.*

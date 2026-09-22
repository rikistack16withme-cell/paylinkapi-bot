# 💻 Code Examples

### Node.js Example
```javascript
const axios = require('axios');

async function createPayment() {
  const res = await axios.post('https://api.paylinkapi.kh/v1/payments', {
    amount: 10.00,
    currency: 'USD',
    provider: 'bakong'
  }, {
    headers: { Authorization: 'Bearer YOUR_API_KEY' }
  });
  console.log('QR Code:', res.data.qrString);
}
```

### Python Example
```python
import requests

response = requests.post(
    "https://api.paylinkapi.kh/v1/payments",
    json={"amount": 10.00, "currency": "USD", "provider": "aba"},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
print("Checkout URL:", response.json().get("checkoutUrl"))
```

> ℹ️ *Phase 1 Notice: Live endpoint URLs are currently placeholders awaiting Phase 2 files.*

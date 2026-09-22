# PaylinkApi — FAST • SECURE • EASY (Payment API Telegram Bot Board)

A minimal, modern, and developer-focused Telegram Bot interface for Cambodian Payment API Gateway infrastructure (**Bakong KHQR** & **ABA PayWay**).

> ⚠️ **PHASE 1 STATUS:**  
> Phase 1 provides the complete UX/UI board, state machine, atomic database, localization, and provider integration placeholders.  
> **NO REAL PAYMENT LOGIC, BAKONG/ABA LIVE API CALLS, OR TRANSACTION VERIFICATION ARE ACTIVE IN THIS PHASE.**

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Verify `.env` has your bot token:
```env
TELEGRAM_BOT_TOKEN=8630737102:AAFF2-I9vaJBR3gvQkfhBmwvFg4WC0X2C3E
BRAND_NAME="PaylinkApi"
```

### 3. Run Self-Verification Test
```bash
npm run test:bot
```

### 4. Start the Telegram Bot
```bash
npm start
# or development with auto-reload:
npm run dev
```

---

## 🏛️ Project Architecture

```
d:/telegrambot_apibank/
├── src/
│   ├── bot/
│   │   ├── handlers/          # Start, Registration, Dashboard, Providers, Pricing, Orders, Keys, Docs, Support, Settings
│   │   ├── keyboards/         # Reusable inline & navigation keyboards
│   │   ├── states/            # State machine & session manager
│   │   └── middleware/        # Action logging, locale, user context
│   ├── providers/
│   │   ├── base.provider.js   # BasePaymentProvider abstract interface
│   │   ├── bakong/            # BakongProvider stub (PROVIDER_NOT_CONNECTED)
│   │   └── aba/               # ABAProvider stub (PROVIDER_NOT_CONNECTED)
│   ├── services/
│   │   ├── user.service.js    # User profiles & preferences
│   │   ├── order.service.js   # Order tracking (Phase 1 placeholder orders)
│   │   ├── apikey.service.js  # Sandbox / mock keys
│   │   └── i18n.service.js    # English (en) & Khmer (km) translations
│   ├── database/
│   │   ├── index.js           # Atomic JSON store (zero external native dependencies)
│   │   └── schema.js          # Schema definitions
│   ├── integrations/
│   │   └── README.md          # Guide for Phase 2 drop-in package
│   ├── documents/             # Markdown docs for Developer Documentation board
│   ├── config/
│   │   └── index.js           # Centralized configuration
│   └── utils/
│       ├── formatter.js       # Visual styling & markdown formatting
│       ├── logger.js          # Structured logger
│       └── verify_bot.js      # Phase 1 verification suite
├── data/                      # File persistence store (store.json)
├── .env                       # Environment variables
├── index.js                   # Application bootstrap & lifecycle manager
└── package.json
```

---

## 📱 Supported Boards & User Flows

1. **Start / Welcome (`/start`)**:
   - Checks if user is registered. If already registered, seamlessly goes to **Dashboard**.
   - If new user, presents the Welcome Board with `[ 🚀 Get Started ]`, `[ 💰 Pricing ]`, `[ 📖 Documentation ]`, `[ 🆘 Support ]`.
2. **Registration Flow**:
   - Captures Telegram user details and sets active status.
   - Shows `✓ Account created` -> `[ Continue → ]` to Dashboard.
3. **Main Dashboard**:
   - Modern grid layout with `💳 Get Payment API`, `🔑 My API Keys`, `📦 My Orders`, `📖 Documentation`, `💰 Pricing`, `🆘 Support`, `⚙️ Settings`.
   - In-place screen transitions (`editMessageText`).
4. **Get Payment API Board**:
   - `🟢 Bakong`, `🔵 ABA Gateway`, `🟣 Bakong + ABA`.
5. **Currency Board**:
   - `🇰🇭 KHR`, `🇺🇸 USD`, `🤖 Auto — KHR + USD`.
6. **Provider Setup Wizards**:
   - **Bakong**: Merchant ID -> Phone Number -> Currency review -> Confirmation -> `✓ Information received`.
   - **ABA**: KHR Merchant Link -> USD Merchant Link -> Review -> Confirmation.
   - **Dual Bundle**: Step-by-step setup for both Bakong & ABA.
7. **Pricing Board**:
   - Plans comparison (Bakong Premium, ABA Premium, Dual Ultimate) with placeholders.
8. **Orders Board**:
   - Displays submitted placeholder orders with status badges (`🟡 Pending`).
9. **API Keys Board**:
   - Clearly labeled Sandbox / Mock test credentials.
10. **Documentation Board**:
    - Full interactive guides for Quick Start, Authentication, Create Payment, Payment Status, Webhooks, Error Codes, and Code Examples.
11. **Support Board**:
    - Direct support link & FAQ Help Center.
12. **Settings Board**:
    - Language switcher: Instant toggle between **English** (`en`) and **Khmer** (`km`).
    - Notifications toggle & Account Profile inspector.
13. **Navigation System**:
    - `← Back`, `🏠 Dashboard`, and `❌ Cancel` available throughout the flow.

---

## 📦 Ready for Phase 2 Integration
When you provide the payment/provider file package:
- Real Bakong API logic connects to `src/providers/bakong/bakong.provider.js`
- Real ABA PayWay logic connects to `src/providers/aba/aba.provider.js`
- Live endpoints, webhooks, and key generation will be activated without altering the UI or bot navigation.

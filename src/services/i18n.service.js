/**
 * Internationalization & Localization Service
 * High-Aura Developer Console Edition (USD + KHR Dual-Currency Standard)
 */
const { tgEmoji } = require('../config/emojis');

const translations = {
  en: {
    // Start / Welcome
    welcome_title: `${tgEmoji('brand')} <b>PAYLINKAPI GLOBAL PLATFORM</b>\n<i>Unified Cambodian Payment Infrastructure</i>`,
    welcome_tagline: 'High-performance banking gateway connecting developers to National Bank of Cambodia rails.',
    welcome_telemetry:
      `<b>GATEWAY TELEMETRY:</b>\n` +
      `• ${tgEmoji('clearing')} <b>Network:</b> <code>National Bank of Cambodia (NBC)</code>\n` +
      `• ${tgEmoji('currency')} <b>Currency Engine:</b> <code>USD ($) + KHR (៛) Dual Automated</code>\n` +
      `• ${tgEmoji('telemetry')} <b>Latency:</b> <code>~180ms Real-Time Settlement</code>\n` +
      `• ${tgEmoji('security')} <b>Encryption:</b> <code>AES-256-GCM + HMAC SHA-256</code>\n\n` +
      `<b>SUPPORTED RAILS:</b>\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR:</b> <code>RED STANDARD</code> (NBC) — Unlimited verification! Enter only 1 Merchant ID + phone number; custom merchant store name fully supported in bot.\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay:</b> <code>BLUE GATEWAY</code> — Instant settlement! Enter USD & KHR links from your ABA Merchant App. <i>(Note: Store name must be set inside ABA Merchant App beforehand)</i>\n\n` +
      `🎁 <b>1-WEEK FREE TRIAL:</b> <i>You can subscribe for a 1-Week Free Trial ($0.00) after completing your merchant registration!</i>\n\n` +
      `${tgEmoji('video')} <i>Tap <b>[ 🎬 Video Tutorial ]</b> below for a complete walkthrough!</i>\n\n` +
      `${tgEmoji('khmer_flag')} <i>(មិនចេះភាសាអង់គ្លេស? ចុចប៊ូតុង [ បកប្រែជាភាសាខ្មែរ ] ខាងក្រោម ឬវាយ /khmer)</i>`,
    welcome_features: 'Zero-Latency • Cryptographic Security • Dual Currency Automated',
    btn_get_started: 'Get Started ❯',
    btn_video_tutorial: '🎬 Video Tutorial: How to Use ❯',
    video_tutorial_title: `${tgEmoji('video')} <b>PAYLINKAPI VIDEO TUTORIAL & SETUP GUIDE</b>`,
    video_tutorial_caption:
      `${tgEmoji('video')} <b>PAYLINKAPI VIDEO TUTORIAL & SETUP GUIDE</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `${tgEmoji('rocket')} <b>HOW TO CONNECT & USE THIS BOT:</b>\n\n` +
      `• ${tgEmoji('verified')} <b>Unlimited Payment Verification:</b> High-speed (~180ms) automated verification for both <b>NBC Bakong KHQR</b> and <b>ABA PayWay</b> with instant webhook alerts.\n\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR Setup:</b>\n` +
      `  1. Enter your <b>Bakong Merchant ID / Account</b> (only 1 needed) and <b>Phone Number</b>.\n` +
      `  2. Set your <b>Custom Store / Merchant Name</b> (displays on customer KHQR scan).\n\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay Setup:</b>\n` +
      `  1. Open your <b>ABA Merchant App</b> on your smartphone.\n` +
      `  2. Configure your Store Name directly inside the ABA app.\n` +
      `  3. Copy your <b>USD ($)</b> and <b>KHR (៛ Riel)</b> payment links and paste them here.\n` +
      `  ${tgEmoji('alert')} <i>Note: ABA store name cannot be customized in bot.</i>\n\n` +
      `${tgEmoji('bulb')} <i>Tap the buttons below to test live payments or deploy your API keys!</i>`,
    btn_pricing: 'Pricing & Plans',
    btn_documentation: 'Developer Specs',
    btn_support: 'Engineering Support',

    // Registration
    reg_title: `${tgEmoji('brand')} <b>DEVELOPER REGISTRATION</b>`,
    reg_prompt: 'Activate your developer console credentials below.',
    reg_success_header: `${tgEmoji('verified')} <b>CREDENTIALS ACTIVE</b>`,
    reg_success_body: 'Developer environment created. Currency engine set to <b>USD ($) + KHR (៛) Dual Mode</b>.',
    btn_continue: 'Enter Console ❯',

    // Dashboard
    dash_title: `${tgEmoji('brand')} <b>PAYMENT API CONSOLE</b>`,
    dash_welcome: 'Operator: <b>{name}</b>',
    dash_subtitle:
      `${tgEmoji('terminal')} <b>SYSTEM STATUS:</b> <code>ACTIVE • DUAL RAIL (USD+KHR)</code>\n` +
      `${tgEmoji('rocket')} <b>PLATFORM CAPABILITIES & SETUP:</b>\n` +
      `• ${tgEmoji('verified')} <b>Unlimited Payment Check:</b> Instant verification (~180ms) for both <b>Bakong KHQR</b> & <b>ABA PayWay</b> (USD+KHR).\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR:</b> Send only 1 Merchant ID & phone number (Custom store name supported directly in bot).\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay:</b> Send USD & KHR links (Store name must be set inside ABA Merchant App beforehand).\n` +
      `• ${tgEmoji('video')} <i>Watch video tutorial above or tap [ 🎬 Video Tutorial ] below!</i>`,
    btn_get_payment_api: '✦ Get Payment API ❯',
    btn_test_live_payment: '⚡ Test Purchased API Key ❯',
    btn_how_to_connect: 'How to Connect API Key (Guide) ❯',
    btn_my_api_keys: 'API Credentials',
    btn_my_orders: 'Integrations & Orders',
    btn_doc_pdf: 'Integration Guide (PDF) ❯',
    btn_settings: 'Console Settings',

    // Get Payment API
    choose_provider:
      `<b>SELECT TARGET PAYMENT RAILS:</b>\n\n` +
      `<i>Dual-Currency Engine is active by default. All integrations automatically process both USD ($) and KHR (៛) simultaneously.</i>\n\n` +
      `${tgEmoji('tag')} <b>MERCHANT NAME ARCHITECTURE:</b>\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR:</b> You <b>can customize</b> your Merchant Name directly inside this bot.\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay:</b> Merchant Name <b>cannot</b> be customized in bot. You must set your store name inside the <b>ABA Merchant App</b>, create your account, and copy your payment link here.\n\n` +
      `${tgEmoji('khmer_flag')} <i>(មិនចេះភាសាអង់គ្លេស? ចុចប៊ូតុង [ បកប្រែជាភាសាខ្មែរ ] ខាងក្រោម ឬវាយ /khmer)</i>`,
    provider_bakong: 'Bakong KHQR',
    provider_aba: 'ABA PayWay Gateway',
    provider_bundle: 'Bakong + ABA Dual Suite',

    // Bakong Board
    bakong_title: `<b>◈ BAKONG KHQR DEPLOYMENT</b>`,
    bakong_prompt_header: `Currency Engine: <code>USD ($) + KHR (៛) Dual Automated</code>\n\n`,
    bakong_merchant_id_prompt: `Please enter your ${tgEmoji('clearing')} <b>Merchant ID / Account</b>:\n<i>(e.g., hut_soksitchey1@aclb or click Instant Setup below)</i>\n\n${tgEmoji('bulb')} <b>Bakong Note:</b> You can customize your store name in the next step!`,
    bakong_merchant_name_prompt: `Please enter your custom ${tgEmoji('brand')} <b>Merchant Display Name</b>:\n<i>(e.g., Rikidev or /skip for default)</i>\n\n${tgEmoji('bulb')} <b>Bakong Feature:</b> This custom name will display directly on the customer's KHQR scan!`,
    bakong_phone_prompt: `Please enter your registered ${tgEmoji('phone')} <b>Phone Number</b>:\n<i>(e.g., +85512345678)</i>`,
    bakong_review_title: `<b>◈ BAKONG CONFIGURATION REVIEW</b>`,

    // ABA Board
    aba_title: `<b>◈ ABA PAYWAY GATEWAY DEPLOYMENT</b>`,
    aba_prompt_header: `Currency Engine: <code>USD ($) + KHR (៛) Dual Automated</code>\n\n`,
    aba_khr_link_prompt: `Please enter your ${tgEmoji('khr')} <b>KHR (Riel ៛) Merchant Link</b>:\n<i>(e.g., https://link.payway.com.kh/ABAPAYk8523640S)</i>\n\n${tgEmoji('khr')} <b>RIEL (KHR ៛) MERCHANT NOTE:</b>\nThis link processes all payments in <b>Khmer Riel (KHR ៛)</b> via ABA PayWay.\n• In the ABA Merchant App, copy your payment link for your <b>KHR account</b> and paste it here.\n• Or click <b>Instant Sandbox Setup</b> below to test with active demo links!`,
    aba_usd_link_prompt: `Please enter your ${tgEmoji('usd')} <b>USD (Dollar $) Merchant Link</b>:\n<i>(e.g., https://link.payway.com.kh/ABAPAY86523639G)</i>\n\n${tgEmoji('usd')} <b>DOLLAR (USD $) MERCHANT NOTE:</b>\nThis link processes all payments in <b>US Dollars (USD $)</b> via ABA PayWay.\n• In the ABA Merchant App, copy your payment link for your <b>USD account</b> and paste it here.\n• Both links work in harmony under our Dual-Currency clearing engine!`,
    aba_review_title: `<b>◈ ABA GATEWAY REVIEW</b>`,
    btn_test_live_payment: 'Test Live Payment QR ❯',

    // Bundle Board
    bundle_title: `<b>◈ DUAL RAILS: BAKONG + ABA SUITE</b>`,
    bundle_prompt_header: `Currency Engine: <code>USD ($) + KHR (៛) Dual Automated</code>\n\n`,
    bundle_step1: `Step 1/2: ${tgEmoji('bakong')} Bakong KHQR Setup`,
    bundle_step2: `Step 2/2: ${tgEmoji('aba')} ABA PayWay Gateway Setup`,

    // Confirmation & Placeholders
    info_received_header: `${tgEmoji('verified')} <b>CONFIGURATION DEPLOYED</b>`,
    info_received_body: 'Your dual-currency integration request is now registered in the queue.',
    status_pending_integration: `Status: ${tgEmoji('pending')} <b>PENDING PHASE 2 HOOK</b>`,

    // Pricing
    pricing_title: `<b>◈ DEVELOPER SUBSCRIPTION TIERS</b>`,
    pricing_subtitle: 'Select an infrastructure tier for your production workloads:',
    pricing_plan1: `${tgEmoji('party')} <b>1 Week Free Trial (1w) — 100% Free</b>\n• Every account receives 1-week free trial upon registration\n• Full live access: Bakong KHQR &amp; ABA PayWay\n• Tier: <code>Free Trial (7 Days)</code>\n• Price: <b>$0.00 FREE</b>`,
    pricing_plan2: `${tgEmoji('rocket')} <b>Single Rail Plans (Bakong only OR ABA only)</b>\n• <b>1 Week:</b> $0.50 USD <i>(≈ 2,000 ៛ KHR)</i>\n• <b>1 Month:</b> $2.50 USD <i>(≈ 10,000 ៛ KHR)</i>\n• <b>1 Year:</b> $15.00 USD <i>(≈ 60,000 ៛ KHR)</i>\n• Unlimited instant checks &amp; webhook callbacks`,
    pricing_plan3: `${tgEmoji('verified')} <b>ABA + Bakong Dual Suite Plans (Combined)</b>\n• <b>1 Week:</b> $1.50 USD <i>(≈ 6,000 ៛ KHR)</i>\n• <b>1 Month:</b> $3.50 USD <i>(≈ 14,000 ៛ KHR)</i>\n• <b>1 Year:</b> $25.00 USD <i>(≈ 100,000 ៛ KHR)</i>\n• Dual USD ($) + KHR (៛) automated clearance &amp; 99.99% SLA`,

    // Orders
    orders_title: `<b>◈ INTEGRATION PIPELINES &amp; ORDERS</b>`,
    orders_empty: 'No integration orders active yet.',
    orders_footer: '<i>Pipeline tracking active. Live settlement will sync in Phase 2.</i>',

    // API Keys
    keys_title: `<b>◈ API CREDENTIALS &amp; SECRETS</b>`,
    keys_empty: "No API credentials provisioned yet.",
    keys_mock_header: '<b>SANDBOX STAGING ENVIRONMENT (Phase 1)</b>\n<i>Production tokens will be issued upon Phase 2 connection.</i>',

    // Documentation
    docs_title: `<b>◈ DEVELOPER DOCUMENTATION &amp; SPECS</b>`,
    docs_subtitle: 'Unified API specifications for NBC Bakong &amp; ABA PayWay:',
    btn_doc_quickstart: 'Quick Start',
    btn_doc_auth: 'Authentication',
    btn_doc_create_payment: 'Create Payment',
    btn_doc_status: 'Payment Status',
    btn_doc_webhooks: 'Webhooks',
    btn_doc_errors: 'Error Codes',
    btn_doc_examples: 'Code Examples',

    // Support
    support_title: `<b>◈ ENGINEERING SUPPORT &amp; SECURITY</b>`,
    support_body: 'Our lead engineering architect @kaixite is standing by for direct 1-on-1 assistance with your API integration.',
    btn_contact_support: '💬 Chat with @kaixite ❯',
    btn_help_center: 'Architecture FAQs',

    // Settings
    settings_title: `<b>◈ CONSOLE SETTINGS &amp; LOCALE</b>`,
    settings_lang: `${tgEmoji('brand')} <b>Language:</b> {currentLang}`,
    settings_notifications: `${tgEmoji('bell')} <b>Telemetry Alerts:</b> {notifStatus}`,
    settings_account: `${tgEmoji('operator')} <b>Operator:</b> {username} (ID: <code>{id}</code>)\n${tgEmoji('currency')} <b>Currency Engine:</b> <code>USD ($) + KHR (៛) Dual-Rail</code>`,
    btn_toggle_lang: 'Switch Language',
    btn_toggle_notif: 'Toggle Alerts',
    btn_account_info: 'Operator Profile',

    // Common Nav
    btn_back: '← Back',
    btn_dashboard: 'Console ❯',
    btn_cancel: 'Cancel',
    btn_confirm: 'Confirm & Deploy ❯',
    btn_view_orders: 'View Orders ❯',
    cancelled_message: 'Operation terminated. Returned to console.'
  },

  km: {
    // Start / Welcome
    welcome_title: `${tgEmoji('brand')} <b>PAYLINKAPI GLOBAL PLATFORM</b>\n<i>ហេដ្ឋារចនាសម្ព័ន្ធទូទាត់សម្រាប់ Developers</i>`,
    welcome_tagline: 'ប្រព័ន្ធទូទាត់ល្បឿនលឿនតភ្ជាប់ផ្ទាល់ទៅកាន់ធនាគារជាតិនៃកម្ពុជា (NBC)។',
    welcome_telemetry:
      `<b>GATEWAY TELEMETRY:</b>\n` +
      `• ${tgEmoji('clearing')} <b>Network:</b> <code>ធនាគារជាតិនៃកម្ពុជា (NBC)</code>\n` +
      `• ${tgEmoji('currency')} <b>Currency Engine:</b> <code>USD ($) + KHR (៛) ស្វ័យប្រវត្តិកញ្ចប់ពីរ</code>\n` +
      `• ${tgEmoji('telemetry')} <b>Latency:</b> <code>~180ms Real-Time Push</code>\n` +
      `• ${tgEmoji('security')} <b>Encryption:</b> <code>AES-256-GCM + HMAC SHA-256</code>\n\n` +
      `<b>SUPPORTED RAILS:</b>\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR:</b> <code>RED STANDARD</code> (NBC) — ផ្ទៀងផ្ទាត់មិនកំណត់! ត្រូវការតែ Merchant ID តែមួយ + លេខទូរស័ព្ទ; អាចកំណត់ឈ្មោះហាងផ្ទាល់ខ្លួនក្នុង Bot នេះភ្លាមៗ។\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay:</b> <code>BLUE GATEWAY</code> — ដំណើរការរហ័ស! ត្រូវការ Link USD & KHR ពី ABA Merchant App។ <i>(ចំណាំ: ឈ្មោះហាងត្រូវកំណត់ក្នុង ABA App ជាមុន)</i>\n\n` +
      `🎁 <b>សាកល្បងឥតគិតថ្លៃ (1-WEEK FREE TRIAL):</b> <i>លោកអ្នកអាចទទួលបានគម្រោងសាកល្បងឥតគិតថ្លៃ ១ សប្តាហ៍ ($0.00 Free Trial) បន្ទាប់ពីចុះឈ្មោះព័ត៌មាន Merchant រួចរាល់!</i>\n\n` +
      `${tgEmoji('video')} <i>ចុចប៊ូតុង <b>[ 🎬 វីដេអូបង្រៀន ]</b> ខាងក្រោម ដើម្បីទស្សនាការណែនាំលម្អិត!</i>\n\n` +
      `${tgEmoji('english_flag')} <i>(ចុច [ Switch to English ] ខាងក្រោម ឬវាយ /english ដើម្បីប្តូរភាសា)</i>`,
    welcome_features: 'សុវត្ថិភាពកម្រិតខ្ពស់ • ល្បឿនលឿនបំផុត • គាំទ្រ USD + KHR ដោយស្វ័យប្រវត្តិ',
    btn_get_started: 'ចាប់ផ្តើម ❯',
    btn_video_tutorial: '🎬 វីដេអូបង្រៀនរបៀបប្រើប្រាស់ ❯',
    video_tutorial_title: `${tgEmoji('video')} <b>វីដេអូបង្រៀនរបៀបប្រើប្រាស់ PAYLINKAPI</b>`,
    video_tutorial_caption:
      `${tgEmoji('video')} <b>វីដេអូបង្រៀនរបៀបប្រើប្រាស់ PAYLINKAPI BOT</b>\n` +
      `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
      `${tgEmoji('rocket')} <b>របៀបតភ្ជាប់ និងប្រើប្រាស់ Bot នេះ:</b>\n\n` +
      `• ${tgEmoji('verified')} <b>ផ្ទៀងផ្ទាត់ការទូទាត់មិនកំណត់ (Unlimited Check):</b> ពិនិត្យការទូទាត់ស្វ័យប្រវត្តិភ្លាមៗទាំង <b>NBC Bakong KHQR</b> និង <b>ABA PayWay</b> ជាមួយ Webhook ជូនដំណឹងលឿន (~180ms)។\n\n` +
      `• ${tgEmoji('bakong')} <b>ការតភ្ជាប់ Bakong KHQR:</b>\n` +
      `  ១. បញ្ចូល <b>Merchant ID / គណនី Bakong</b> (ត្រូវការតែមួយប៉ុណ្ណោះ) និង <b>លេខទូរស័ព្ទ</b>។\n` +
      `  ២. កំណត់ <b>ឈ្មោះហាងផ្ទាល់ខ្លួន (Custom Name)</b> ក្នុង Bot នេះបានភ្លាមៗ (បង្ហាញលើ KHQR ពេលអតិថិជនស្កេន)។\n\n` +
      `• ${tgEmoji('aba')} <b>ការតភ្ជាប់ ABA PayWay:</b>\n` +
      `  ១. បើកកម្មវិធី <b>ABA Merchant App</b> លើទូរស័ព្ទរបស់អ្នក។\n` +
      `  ២. កំណត់ឈ្មោះហាងរបស់អ្នកនៅក្នុង ABA Merchant App ផ្ទាល់។\n` +
      `  ៣. Copy Link គណនី <b>USD ($)</b> និង <b>KHR (៛ រៀល)</b> មកដាក់ទីនេះ។\n` +
      `  ${tgEmoji('alert')} <i>ចំណាំ: ឈ្មោះហាង ABA មិនអាចកែប្រែក្នុង Bot នេះបានទេ។</i>\n\n` +
      `${tgEmoji('bulb')} <i>ចុចប៊ូតុងខាងក្រោមដើម្បីតេស្តការទូទាត់ជាក់ស្តែង ឬភ្ជាប់ API Keys របស់អ្នក!</i>`,
    btn_pricing: 'តម្លៃសេវាកម្ម',
    btn_documentation: 'ឯកសារបច្ចេកទេស',
    btn_support: 'ផ្នែកជំនួយ',

    // Registration
    reg_title: `${tgEmoji('brand')} <b>ចុះឈ្មោះគណនី DEVELOPER</b>`,
    reg_prompt: 'បើកដំណើរការ Developer Console របស់អ្នកខាងក្រោម។',
    reg_success_header: `${tgEmoji('verified')} <b>គណនីត្រូវបានបើកដំណើរការ</b>`,
    reg_success_body: 'ប្រព័ន្ធត្រូវបានកំណត់រូបិយប័ណ្ណពីរស្វ័យប្រវត្តិ <b>USD ($) + KHR (៛) Dual Mode</b>។',
    btn_continue: 'ចូលទៅកាន់ Console ❯',

    // Dashboard
    dash_title: `${tgEmoji('brand')} <b>ផ្ទាំងគ្រប់គ្រងប្រព័ន្ធទូទាត់ API</b>`,
    dash_welcome: 'អ្នកគ្រប់គ្រង: <b>{name}</b>',
    dash_subtitle:
      `${tgEmoji('terminal')} <b>ស្ថានភាពប្រព័ន្ធ:</b> <code>ដំណើរការ • រូបិយប័ណ្ណពីរ (USD+KHR)</code>\n` +
      `${tgEmoji('rocket')} <b>អំពី Bot និងការណែនាំដំឡើង:</b>\n` +
      `• ${tgEmoji('verified')} <b>ផ្ទៀងផ្ទាត់មិនកំណត់:</b> ពិនិត្យការទូទាត់ស្វ័យប្រវត្តិ (~180ms) ទាំង <b>Bakong KHQR</b> និង <b>ABA PayWay</b> (USD+KHR)។\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR:</b> ផ្ញើតែ Merchant ID តែមួយ និងលេខទូរស័ព្ទ (អាចកំណត់ឈ្មោះហាងផ្ទាល់ខ្លួនក្នុង Bot នេះភ្លាមៗ)។\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay:</b> ផ្ញើ Link USD & KHR (ឈ្មោះហាងត្រូវកំណត់ក្នុង ABA App ជាមុន)។\n` +
      `• ${tgEmoji('video')} <i>សូមទស្សនាវីដេអូបង្រៀនខាងលើ ឬចុចប៊ូតុង [ 🎬 វីដេអូបង្រៀន ] ខាងក្រោម!</i>`,
    btn_get_payment_api: '✦ ភ្ជាប់ប្រព័ន្ធទូទាត់ Payment API ❯',
    btn_test_live_payment: '⚡ តេស្ត API Key ដែលបានទិញ ❯',
    btn_how_to_connect: 'របៀបតភ្ជាប់ API Key (How to Connect) ❯',
    btn_my_api_keys: 'កូដសម្ងាត់ API (Keys)',
    btn_my_orders: 'ប្រវត្តិបញ្ជាទិញ & Orders',
    btn_doc_pdf: 'ឯកសារណែនាំតភ្ជាប់ (ទាញយក PDF) ❯',
    btn_documentation: 'ឯកសារបច្ចេកទេស',
    btn_pricing: 'តម្លៃសេវាកម្ម',
    btn_support: 'ផ្នែកជំនួយបច្ចេកទេស',
    btn_settings: 'ការកំណត់ប្រព័ន្ធ',

    // Get Payment API
    choose_provider:
      `<b>ជ្រើសរើសប្រព័ន្ធទូទាត់សម្រាប់ការតភ្ជាប់:</b>\n\n` +
      `<i>Currency Engine ដំណើរការរូបិយប័ណ្ណពីរ USD ($) + KHR (៛) ដោយស្វ័យប្រវត្តិ។</i>\n\n` +
      `${tgEmoji('tag')} <b>ចំណាំអំពីការកំណត់ឈ្មោះ MERCHANT:</b>\n` +
      `• ${tgEmoji('bakong')} <b>Bakong KHQR:</b> អ្នក<b>អាចកំណត់ឈ្មោះហាងផ្ទាល់ខ្លួន (Custom Name)</b> ក្នុង Bot នេះផ្ទាល់។\n` +
      `• ${tgEmoji('aba')} <b>ABA PayWay:</b> <b>មិនអាចកំណត់ឈ្មោះក្នុង Bot បានទេ</b>។ អ្នកត្រូវបង្កើតគណនី និងកំណត់ឈ្មោះដែលអ្នកចង់បានក្នុង <b>ABA Merchant App</b> រួច Copy Link យកមកដាក់ទីនេះ។\n\n` +
      `${tgEmoji('english_flag')} <i>(ចុច [ English ] ខាងក្រោម ឬវាយ /english ដើម្បីប្តូរជាភាសាអង់គ្លេស)</i>`,
    provider_bakong: 'Bakong KHQR (ធនាគារជាតិ NBC)',
    provider_aba: 'ច្រកទូទាត់ ABA PayWay',
    provider_bundle: 'កញ្ចប់រួម Bakong + ABA ទាំងពីរ',

    // Bakong Board
    bakong_title: `<b>◈ ការដំឡើង BAKONG KHQR</b>`,
    bakong_prompt_header: `Currency Engine: <code>USD ($) + KHR (៛) ស្វ័យប្រវត្តិ</code>\n\n`,
    bakong_merchant_id_prompt: `សូមបញ្ចូល ${tgEmoji('clearing')} <b>Merchant ID / គណនី</b> របស់អ្នក:\n<i>(ឧទាហរណ៍: hut_soksitchey1@aclb ឬ Instant Setup ខាងក្រោម)</i>\n\n${tgEmoji('bulb')} <b>Bakong Note:</b> អ្នកអាចកំណត់ឈ្មោះហាងផ្ទាល់ខ្លួននៅជំហានបន្ទាប់!`,
    bakong_merchant_name_prompt: `សូមបញ្ចូល ${tgEmoji('brand')} <b>ឈ្មោះ Merchant / ហាងផ្ទាល់ខ្លួន</b> របស់អ្នក:\n<i>(ឧទាហរណ៍: Rikidev ឬ /skip)</i>\n\n${tgEmoji('bulb')} <b>Bakong Feature:</b> ឈ្មោះនេះនឹងបង្ហាញលើផ្ទាំង KHQR ពេលអតិថិជនស្កេនទូទាត់!`,
    bakong_phone_prompt: `សូមបញ្ចូល ${tgEmoji('phone')} <b>លេខទូរស័ព្ទ</b> ដែលបានចុះឈ្មោះ:\n<i>(ឧទាហរណ៍: +85512345678)</i>`,
    bakong_review_title: `<b>◈ ពិនិត្យទិន្នន័យ BAKONG</b>`,

    // ABA Board
    aba_title: `<b>◈ ការដំឡើង ABA PAYWAY GATEWAY</b>`,
    aba_prompt_header: `Currency Engine: <code>USD ($) + KHR (៛) ស្វ័យប្រវត្តិ</code>\n\n`,
    aba_khr_link_prompt: `សូមបញ្ចូល ${tgEmoji('khr')} <b>ABA Merchant Link សម្រាប់ប្រាក់រៀល (KHR ៛)</b>:\n<i>(ឧទាហរណ៍: https://link.payway.com.kh/ABAPAYk8523640S)</i>\n\n${tgEmoji('khr')} <b>ចំណាំសម្រាប់ប្រាក់រៀល (KHR ៛):</b>\nLink នេះប្រើសម្រាប់បង្កើត QR Code និងទូទាត់ជា<b>ប្រាក់រៀលខ្មែរ (KHR ៛)</b> តាម ABA PayWay។\n• បើក <b>ABA Merchant App</b> Copy Link គណនីប្រាក់រៀលរបស់អ្នក យកមកដាក់ទីនេះ។\n• ឬចុច <b>"ដំឡើងគណនី Sandbox ភ្លាមៗ"</b> ខាងក្រោម ដើម្បីប្រើ Link គំរូជាក់ស្តែងភ្លាមៗ!`,
    aba_usd_link_prompt: `សូមបញ្ចូល ${tgEmoji('usd')} <b>ABA Merchant Link សម្រាប់ប្រាក់ដុល្លារ (USD $)</b>:\n<i>(ឧទាហរណ៍: https://link.payway.com.kh/ABAPAY86523639G)</i>\n\n${tgEmoji('usd')} <b>ចំណាំសម្រាប់ប្រាក់ដុល្លារ (USD $):</b>\nLink នេះប្រើសម្រាប់បង្កើត QR Code និងទូទាត់ជា<b>ប្រាក់ដុល្លារ (USD $)</b> តាម ABA PayWay។\n• បើក <b>ABA Merchant App</b> Copy Link គណនីប្រាក់ដុល្លាររបស់អ្នក យកមកដាក់ទីនេះ។\n• ប្រព័ន្ធនឹងដំណើរការរូបិយប័ណ្ណទាំងពីរ (USD + KHR) ដោយស្វ័យប្រវត្តិ!`,
    aba_review_title: `<b>◈ ពិនិត្យទិន្នន័យ ABA GATEWAY</b>`,
    btn_test_live_payment: 'តេស្តស្កេនទូទាត់ជាក់ស្តែង (Live Payment QR) ❯',

    // Bundle Board
    bundle_title: `<b>◈ ការដំឡើងរួមគ្នា BAKONG + ABA DUAL</b>`,
    bundle_prompt_header: `Currency Engine: <code>USD ($) + KHR (៛) ស្វ័យប្រវត្តិ</code>\n\n`,
    bundle_step1: `ជំហាន ១/២: ${tgEmoji('bakong')} ការរៀបចំ Bakong KHQR`,
    bundle_step2: `ជំហាន ២/២: ${tgEmoji('aba')} ការរៀបចំ ABA PayWay Gateway`,

    // Confirmation & Placeholders
    info_received_header: `${tgEmoji('verified')} <b>ព័ត៌មានត្រូវបានទទួលរួចរាល់</b>`,
    info_received_body: 'សំណើតភ្ជាប់ប្រព័ន្ធរូបិយប័ណ្ណពីរ USD+KHR ត្រូវបានបញ្ជូនទៅកាន់ Queue។',
    status_pending_integration: `ស្ថានភាព: ${tgEmoji('pending')} <b>PENDING PHASE 2 HOOK</b>`,

    // Pricing
    pricing_title: `<b>◈ កញ្ចប់តម្លៃ DEVELOPER TIERS</b>`,
    pricing_subtitle: 'ជម្រើស Infrastructure សម្រាប់អាជីវកម្មរបស់អ្នក:',
    pricing_plan1: `${tgEmoji('party')} <b>សាកល្បងឥតគិតថ្លៃ ១ សប្តាហ៍ (Free Trial) — ១០០% Free</b>\n• គ្រប់គណនីថ្មីទាំងអស់ទទួលបានសាកល្បងឥតគិតថ្លៃ ៧ ថ្ងៃ\n• ដំណើរការពេញលេញ: Bakong KHQR &amp; ABA PayWay\n• កម្រិត: <code>Free Trial (7 Days)</code>\n• តម្លៃ: <b>$0.00 ឥតគិតថ្លៃ</b>`,
    pricing_plan2: `${tgEmoji('rocket')} <b>កញ្ចប់ទោល Single Rail (Bakong សុទ្ធ ឬ ABA សុទ្ធ)</b>\n• <b>១ សប្តាហ៍ (1 Week):</b> $0.50 USD <i>(~២,០០០ រៀល)</i>\n• <b>១ ខែ (1 Month):</b> $2.50 USD <i>(~១០,០០០ រៀល)</i>\n• <b>១ ឆ្នាំ (1 Year):</b> $15.00 USD <i>(~៦០,០០០ រៀល)</i>\n• ពិនិត្យការទូទាត់ភ្លាមៗ &amp; Webhook ជូនដំណឹងល្បឿនលឿន`,
    pricing_plan3: `${tgEmoji('verified')} <b>កញ្ចប់រួម ABA + Bakong Dual Suite (ទាំងពីររួមគ្នា)</b>\n• <b>១ សប្តាហ៍ (1 Week):</b> $1.50 USD <i>(~៦,០០០ រៀល)</i>\n• <b>១ ខែ (1 Month):</b> $3.50 USD <i>(~១៤,០០០ រៀល)</i>\n• <b>១ ឆ្នាំ (1 Year):</b> $25.00 USD <i>(~១០០,០០០ រៀល)</i>\n• រូបិយប័ណ្ណពីរស្វ័យប្រវត្តិ USD ($) + KHR (៛) &amp; ជំនួយបច្ចេកទេស 24/7`,

    // Orders
    orders_title: `<b>◈ ប្រតិបត្តិការ &amp; ការបញ្ជាទិញ</b>`,
    orders_empty: 'មិនទាន់មានប្រតិបត្តិការដំណើរការនៅឡើយទេ។',
    orders_footer: '<i>ទិន្នន័យនេះជាសំណើតភ្ជាប់ក្នុង Phase 1.</i>',

    // API Keys
    keys_title: `<b>◈ កូដសម្ងាត់ API &amp; TOKENS</b>`,
    keys_empty: 'មិនទាន់មានកូដសម្ងាត់ត្រូវបានបង្កើតនៅឡើយទេ។',
    keys_mock_header: '<b>បរិស្ថានសាកល្បង SANDBOX (Phase 1)</b>\n<i>កូដសម្ងាត់ផ្លូវការ Production នឹងដំណើរការក្នុង Phase 2.</i>',

    // Documentation
    docs_title: `<b>◈ ឯកសារបច្ចេកទេស &amp; SPECS</b>`,
    docs_subtitle: 'មគ្គុទ្ទេសក៍បច្ចេកទេសសម្រាប់ NBC Bakong &amp; ABA PayWay:',
    btn_doc_quickstart: 'ការចាប់ផ្តើម (Quick Start)',
    btn_doc_auth: 'ការផ្ទៀងផ្ទាត់សិទ្ធិ (Auth)',
    btn_doc_create_payment: 'ការបង្កើតការទូទាត់ (Payment)',
    btn_doc_status: 'ស្ថានភាពទូទាត់ (Status)',
    btn_doc_webhooks: 'ប្រព័ន្ធ Webhooks',
    btn_doc_errors: 'កូដកំហុស (Error Codes)',
    btn_doc_examples: 'ឧទាហរណ៍កូដ (Code Examples)',

    // Support
    support_title: `<b>◈ ផ្នែកជំនួយបច្ចេកទេស &amp; SUPPORT</b>`,
    support_body: 'អ្នកជំនាញបច្ចេកទេសផ្ទាល់ @kaixite ត្រៀមខ្លួនជួយសម្របសម្រួល និងដោះស្រាយបញ្ហាការតភ្ជាប់ API ជូនអ្នកជានិច្ច។',
    btn_contact_support: '💬 ជជែកផ្ទាល់ជាមួយ @kaixite ❯',
    btn_help_center: 'សំណួរញឹកញាប់ FAQs',

    // Settings
    settings_title: `<b>◈ ការកំណត់ CONSOLE &amp; LOCALE</b>`,
    settings_lang: `${tgEmoji('brand')} <b>ភាសា:</b> {currentLang}`,
    settings_notifications: `${tgEmoji('bell')} <b>ការជូនដំណឹង:</b> {notifStatus}`,
    settings_account: `${tgEmoji('operator')} <b>Operator:</b> {username} (ID: <code>{id}</code>)\n${tgEmoji('currency')} <b>Currency Engine:</b> <code>USD ($) + KHR (៛) Dual-Rail</code>`,
    btn_toggle_lang: 'ប្តូរភាសា',
    btn_toggle_notif: 'បើក/បិទ ការជូនដំណឹង',
    btn_account_info: 'ព័ត៌មានគណនី',

    // Common Nav
    btn_back: '← ថយក្រោយ',
    btn_dashboard: 'ផ្ទាំងបញ្ជា ❯',
    btn_cancel: 'បោះបង់',
    btn_confirm: 'បញ្ជាក់ និង Deploy ❯',
    btn_view_orders: 'មើលការបញ្ជាទិញ ❯',
    cancelled_message: 'ប្រតិបត្តិការត្រូវបានបោះបង់។ ត្រឡប់ទៅផ្ទាំងបញ្ជាវិញ។'
  }
};

class I18nService {
  t(key, lang = 'en', params = {}) {
    const targetLang = translations[lang] ? lang : 'en';
    let text = translations[targetLang][key] || translations['en'][key] || key;

    for (const [paramKey, val] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), val);
    }
    return text;
  }

  getLangName(lang) {
    return lang === 'km' ? 'ភាសាខ្មែរ (Khmer)' : 'English (US)';
  }
}

module.exports = new I18nService();

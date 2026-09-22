# 🌐 100% FREE HOSTING GUIDE FOR PAYLINKAPI

This guide walks you through hosting **PaylinkApi** (Telegram Bot `@PayLinkAPI_bot`, Express REST API, Next.js Web Portal, and Bakong microservice) **100% FREE with ZERO COST**.

---

## 🏆 Summary of Free Hosting Methods

| Method | Where It Runs | Cost | Uptime | Setup Difficulty |
| :--- | :--- | :--- | :--- | :--- |
| **Method 1: Render.com + UptimeRobot** *(Recommended)* | In the Cloud (Render) | **$0 / month** | **24/7 Always Online** (with free ping) | Easy (5 minutes) |
| **Method 2: Koyeb.com** | In the Cloud (Koyeb) | **$0 / month** | **24/7 Always Online** (Never sleeps) | Easy (3 minutes) |
| **Method 3: Self-Host on your PC** | On your Windows Laptop / PC | **$0 / month** | Online while PC is on | 1-Click (`.bat` file) |

---

## 🚀 Method 1: Render.com (100% Free Cloud 24/7)

Render gives you free cloud hosting for Web Services. With the **UptimeRobot free ping trick**, it stays online **24/7 without going to sleep**!

### Step 1: Push your code to GitHub
1. Create a free account at [github.com](https://github.com).
2. Create a new repository (e.g. `paylinkapi-bot`).
3. Push your project files to this GitHub repository.

### Step 2: Create Free Web Service on Render
1. Go to [render.com](https://render.com) and sign up for free using your GitHub account.
2. Click **New +** at the top right and select **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your `paylinkapi-bot` repository.
4. Fill in the deployment details:
   - **Name:** `paylinkapi` (or any name you like)
   - **Region:** `Singapore` (Fastest for Cambodia / Asia)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Select **Free** ($0/month)

### Step 3: Add Environment Variables
Scroll down to **Environment Variables** and add the following:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `BRAND_NAME` | `PaylinkApi` |
| `BRAND_TAGLINE` | `FAST • SECURE • EASY` |
| `DEFAULT_LANGUAGE` | `km` |
| `TELEGRAM_BOT_TOKEN` | `8630737102:AAFF2-I9vaJBR3gvQkfhBmwvFg4WC0X2C3E` |
| `DEFAULT_BAKONG_ACCOUNT` | `hut_soksitchey1@aclb` |
| `DEFAULT_MERCHANT_NAME` | `Rikidev` |
| `DEFAULT_ABA_USD_LINK` | `https://link.payway.com.kh/ABAPAY86523639G` |
| `DEFAULT_ABA_KHR_LINK` | `https://link.payway.com.kh/ABAPAYk8523640S` |

Click **Create Web Service**. Render will now automatically install dependencies, build the Next.js portal, and start the Telegram bot!

### Step 4: Keep it Awake 24/7 for FREE (The Magic Trick)
> Render's free tier goes to sleep if no HTTP traffic arrives for 15 minutes.  
> You can keep it **awake 24/7 forever for $0** using a free uptime monitor:

1. Sign up for free at [uptimerobot.com](https://uptimerobot.com) (or [cron-job.org](https://cron-job.org)).
2. Click **Add New Monitor**.
3. **Monitor Type:** `HTTP(s)`
4. **Friendly Name:** `PaylinkApi Ping`
5. **URL (or IP):** `https://paylinkapi.onrender.com/api/health` *(replace with your actual Render URL)*
6. **Monitoring Interval:** `5 minutes`
7. Click **Create Monitor**.

🎉 **Done!** UptimeRobot will ping `/api/health` every 5 minutes. Your Render server will **NEVER sleep** and will run 24/7 for free!

---

## ⚡ Method 2: Koyeb.com (100% Free Always-On)

Koyeb offers a **Free Nano instance** with 512MB RAM that **never goes to sleep**:

1. Go to [koyeb.com](https://koyeb.com) and register with GitHub.
2. Click **Create App** and select **GitHub**.
3. Select your repository.
4. Under **Environment variables**, paste your `.env` values (same as in Method 1).
5. Koyeb automatically reads the included `Procfile` (`web: npm start`).
6. Click **Deploy**.
7. In ~2 minutes, your bot and REST API will be live on `https://<your-app>.koyeb.app` 24/7!

---

## 💻 Method 3: Run Free on Your Own PC (Instant 1-Click)

If you don't want to create GitHub or cloud accounts right now, you can host it from your current Windows PC immediately:

1. Double-click the file [start-free-hosting-windows.bat](file:///d:/telegrambot_apibank/start-free-hosting-windows.bat) in your project root.
2. It automatically launches:
   - Express REST API & Next.js on `http://localhost:5000`
   - Bakong Bypass microservice on `http://localhost:3000`
   - Telegram Bot polling `@PayLinkAPI_bot`
   - High-speed public HTTPS tunnel
3. As long as this window is open, your bot and API are live on the internet!

---

## 🛡️ Verification Checklist After Deployment

Once deployed, verify that everything works:
1. Open Telegram and send `/start` to [@PayLinkAPI_bot](https://t.me/PayLinkAPI_bot).
2. Click **💳 Get Payment API** to verify the public web portal URL opens.
3. Click **⚡ Test Purchased API Key** to verify test transactions.
4. Click **📄 Integration Guide (PDF)** to receive your 4-page PDF.
5. In your browser, open `https://<your-app-domain>/api/health` — it should return:
   ```json
   {
     "status": "ok",
     "system": "PaylinkApi Payment Gateway API",
     "uptime": 120
   }
   ```

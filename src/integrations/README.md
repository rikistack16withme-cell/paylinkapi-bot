# Phase 2 Integration Drop-In Location

This directory (`src/integrations/`) is prepared to receive the future file/folder package provided by Kai Zen for **PHASE 2 — REAL PAYMENT + BAKONG + ABA INTEGRATION**.

---

## 📋 Integration Checklist for Phase 2 Package:

When the folder package arrives:
1. **Inspect Folder Structure**:
   - Check file names, directory tree, export structures.
2. **Determine Framework & Runtime**:
   - Identify whether code is Node.js (CommonJS / ESM), Python, or external scripts.
3. **Audit Dependencies**:
   - Check any needed npm/pip dependencies and install them with exact versions.
4. **Map to Provider Stubs**:
   - Bakong files connect to `src/providers/bakong/bakong.provider.js`.
   - ABA Gateway files connect to `src/providers/aba/aba.provider.js`.
5. **Configure Credentials**:
   - Update `.env` with required production/sandbox merchant secrets, private keys, or API tokens.
6. **Activate Bot Handlers**:
   - Transition bot from placeholder responses (`PROVIDER_NOT_CONNECTED`) to live provider execution calls.

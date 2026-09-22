# 🔐 Authentication Specification

All API requests to the PaylinkApi unified gateway require Bearer token authentication in the HTTP header:

```http
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

## Security Best Practices
- Never commit secret API keys to client-side code or public Git repositories.
- Restrict webhook callback endpoints using HMAC SHA-256 signatures.
- Use sandbox keys during development and staging.

> ℹ️ *Phase 1 Notice: Production key generation is disabled in Phase 1 and will be connected in Phase 2.*

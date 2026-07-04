# Security Policy

## Reporting a Vulnerability

We take the security of TASKIT and its infrastructure seriously. If you discover a security vulnerability, please follow the steps below.

**Do not open a public GitHub issue.** Instead, send a detailed report to our security team.

### Contact

- Email: security at piranusa dot id
- PGP Key: Available on request

### What to Include

- Type of vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (optional)

### Response Timeline

- Acknowledgement within 48 hours
- Status update every 72 hours until resolution
- Fix deployment within 14 days for critical issues

---

## Scope

The following are considered in scope:

- TASKIT API server and worker
- Frontend application
- Authentication and session management
- Data storage and access controls
- Third party integrations (Deepgram, GLM, Supabase)

## Out of Scope

- Third party services listed above when used independently
- Physical security of infrastructure
- Social engineering attacks

---

## Best Practices for Deployment

1. Keep all API keys and secrets in environment variables
2. Enable ALLOW_PUBLIC_SIGNUP only for trusted networks
3. Use Supabase transaction pooler port 6543
4. Set strong DEFAULT_ADMIN_PASSWORD (min 8 chars)
5. Configure CORS with exact origins
6. Enable rate limiting on login endpoints (default 10 attempts per 15 minutes)

---

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | Yes |

---

## Disclosure Policy

We follow responsible disclosure:

1. Reporter submits vulnerability
2. We confirm and assess
3. We develop and test fix
4. We deploy fix
5. We publicly disclose after 30 days or by mutual agreement

---

Copyright 2026 Contrivention. Built by Piranusa AI.

# Security Policy

## Supported Versions

| Version | Supported          | Notes                            |
| ------- | ------------------ | -------------------------------- |
| 1.0.x   | ✅ Yes             | Current stable release           |
| 0.9.x   | ⚠️ Critical fixes only | Previous stable              |
| < 0.9   | ❌ No              | End of life, please upgrade      |

## Reporting a Vulnerability

If you discover a security vulnerability in Sagittarius, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please use GitHub's private vulnerability reporting:

1. Go to the [Security tab](../../security) of this repository
2. Click "Report a vulnerability"
3. Provide a detailed description of the issue

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment** -- Within 48 hours
- **Initial assessment** -- Within 7 days
- **Fix and disclosure** -- Coordinated with reporter

## Scope

The following are in scope:

- Cross-site scripting (XSS) via email content rendering
- Credential or session token leakage
- JMAP request/response manipulation
- Authentication bypass
- Insecure data handling in local storage or session storage

## Security Measures in Place

Sagittarius implements the following protections:

- **HTML sanitization** -- All email HTML is processed through DOMPurify before rendering
- **Remote image blocking** -- External images and CSS backgrounds are blocked by default
- **Credential redaction** -- Authentication credentials are never logged
- **Content Security Policy** -- Inline script execution is restricted in rendered email content
- **Input validation** -- JMAP responses are validated before processing
- **XSS Prevention in Composer** -- Link URLs are validated to prevent `javascript:` and other dangerous protocols (VULN-001)
- **Safe CID Image Resolution** -- Inline image references are resolved using DOM parsing instead of regex to prevent XSS (VULN-002)
- **Rate Limiting** -- Authentication attempts are rate-limited with account lockout after 5 failed attempts (VULN-003, VULN-008)
- **CSRF Protection** -- All JMAP requests include CSRF tokens to prevent cross-site request forgery (VULN-006)
- **Timing Attack Prevention** -- Authentication failures include artificial delays to prevent username enumeration (VULN-009)
- **Security Headers** -- All endpoints including EventSource receive security headers (VULN-007)

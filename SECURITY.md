# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Sagittarius, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please send a detailed report to the repository owner via GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](https://github.com/SwordfishTrumpet/sagittarius/security) of this repository
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

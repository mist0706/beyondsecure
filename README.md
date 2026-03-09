# BeyondSecure.se

Cyber Security Consulting & CISO as a Service

---

## Overview

This is the website for BeyondSecure.se, a cybersecurity consulting company offering:
- **CISO as a Service (vCISO)** - Part-time chief information security officer
- **Security Audits & Assessments** - Comprehensive security reviews
- **GRC Services** - Governance, Risk, and Compliance
- **Incident Response** - Security breach handling
- **Security Architecture** - Design and implementation

## Tech Stack

- Static site generator (to be decided)
- Docker containerized
- Hosted on current server

## Development

```bash
# Build
docker build -t beyondsecure .

# Run locally
docker run -p 8080:80 beyondsecure

# Deploy
docker compose up -d
```

## Structure

```
/
├── index.html          # Homepage
├── services/
│   ├── ciso-as-a-service.html
│   ├── security-audits.html
│   ├── grc.html
│   └── incident-response.html
├── about.html          # About David V. Larsson
├── contact.html        # Contact form
└── assets/
    ├── css/
    ├── js/
    └── images/
```
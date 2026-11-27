# PRIVACORE

**Privacy. Control. Clarity.**

Open-source privacy toolkit with 107 browser-based tools for privacy inspection, network diagnostics, Web Crypto encryption, security awareness, and local data protection. Built with semantic HTML, CSS, Vanilla JavaScript, and Vercel Serverless Functions.

## Architecture & Guarantees

- **Zero heavy frameworks**: Pure HTML5, CSS3, and modular Vanilla ES Modules (`public/js/`).
- **Execution classifications**: Every tool displays whether it is `LOCAL`, `LIMITED`, `API`, or `EDUCATIONAL`.
- **Client-first security**: Password Lab, AES-256-GCM Text Encryptor, Hashing, EXIF Metadata Inspector/Stripper, QR Generator, Diff, and Data formatters execute strictly in browser memory.
- **Hardened serverless routes (`api/`)**: DNS Explorer (`/api/dns`), IP Explorer (`/api/ip`), Security Headers (`/api/headers`), and HTTP Status Probe (`/api/status`) enforce input validation, sliding-window rate limits, and SSRF protections (blocking private, loopback, link-local, and metadata IP ranges as well as automatic redirects).
- **Zero tracking**: No analytics scripts, no tracking pixels, and no database logging of user inputs or visitor IPs.

## Project Structure

```text
├── api/
│   ├── _lib/security.js       # SSRF guard, IP/domain validators, rate limiter
│   ├── dns.js                 # Public DoH lookup (A, AAAA, MX, TXT, NS, CNAME, SOA, CAA)
│   ├── headers.js             # Authorized HTTP security header inspector
│   ├── ip.js                  # Public IP & ASN metadata lookup
│   └── status.js              # Public service reachability & HEAD status probe
├── public/
│   ├── css/styles.css         # Dark charcoal + violet design system & light theme
│   ├── js/
│   │   ├── data/tools-catalog.js
│   │   ├── lib/               # Pure JS QR encoder, EXIF/PNG parser, YAML, Diff
│   │   ├── tools/             # Modular tool workbenches across 7 categories
│   │   ├── app.js             # Router, dashboard, search, favorites, settings
│   │   ├── icons.js           # Inline SVG icon system
│   │   └── state.js           # localStorage state & export/wipe manager
│   ├── favicon.svg
│   └── index.html
├── scripts/validate.js        # Syntax & tool registry integrity validator
├── server.js                  # Local / Node.js server (port 3000)
├── package.json
└── vercel.json                # Security headers, CSP, and Vercel rewrites
```

## Local Setup

Requires Node.js 20+ (tested on Node.js 22):

```bash
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Vercel Deployment

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/).
3. Vercel automatically detects `vercel.json`, serves `public/`, and deploys `api/*.js` as Serverless Functions.
4. No environment variables or database services are required for core operation.

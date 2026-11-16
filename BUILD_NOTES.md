# Build and verification notes

## Changes in this revision

- Added a public, responsive landing page inspired by the supplied DeepSeek reference. The landing page is shown before authentication.
- The landing page's **Chat with AI** action opens the existing login/register screen. The prompt entered on the landing page is carried into the chat composer after successful login.
- Added a return-to-home action on the login/register screen. Signing out returns to the public landing page.
- MongoDB configuration now loads `server/.env` by an absolute path derived from the backend source file, rather than depending on the terminal's current working directory.
- MongoDB connection setup validates common SRV/non-SRV URI format mistakes, uses bounded connection timeouts and IPv4 DNS resolution, and prints actionable diagnostics for authentication, DNS, network, TLS, and malformed-URI failures without printing the URI.
- Updated `.env.example` and README with local, Atlas SRV, and Atlas Standard/non-SRV examples and troubleshooting steps.
- The uploaded `server/.env` was intentionally excluded from the replacement archive. Create your own local `server/.env` from `server/.env.example`.

## Verification performed

- `node --check` passed for the modified backend configuration, database connection, and server entry files.
- Babel JSX parsing passed for `client/src/App.jsx` and `client/src/main.jsx`.
- `node --test server/test/*.test.js` passed: 5 tests.

## Verification not completed in this environment

- A fresh Vite production build was not completed. The uploaded archive contained Windows-specific `node_modules` executables, which cannot run in this Linux build environment. A fresh dependency installation timed out here. On your Windows machine, run `npm ci` and then `npm run build`.
- A live connection to your MongoDB Atlas cluster was not attempted from this revision. Atlas connectivity depends on your current IP allowlist, database user credentials, DNS/network access, and cluster state. The app now reports more specific diagnostics when you start it locally.
- Live AI provider, Tavily, Playwright, Docker, OCR, and external deployment integrations still require your own valid credentials and services.

## Remaining product limitations

- File retrieval is keyword-based, not embedding/vector semantic search.
- Long-term memories are user-managed; automatic memory extraction is not included.
- No recurring task scheduler, push notifications, email/calendar integration, or persistent logged-in browser profile.
- OCR handles image uploads only; scanned PDF and embedded Office-image OCR are not included.
- Legacy `.xls`, `.doc`, and `.ppt` formats are unsupported.
- Public deployment still needs HTTPS, backups, monitoring, malware scanning, and a security review.

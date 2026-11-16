# Personal AI Agent – Local Testing Checklist

Use this checklist after extracting the final ZIP. Do not enable optional execution features until the basic app works.

## 1. Basic setup

- [ ] Install Node.js 20+.
- [ ] Install/start MongoDB.
- [ ] Run `npm install` from the project root.
- [ ] Copy `server/.env.example` to `server/.env`.
- [ ] Set a unique JWT secret (32+ random characters).
- [ ] Add an AI provider API key, base URL and model that supports tool calling.
- [ ] Run `npm run dev`.
- [ ] Open `http://localhost:5173`.
- [ ] Register, sign out, and sign back in.
- [ ] Check `http://localhost:5000/health` reports `ok: true`.

## 2. Existing application

- [ ] Create a chat and send a normal prompt.
- [ ] Confirm streamed tokens appear.
- [ ] Refresh the browser and reopen the conversation.
- [ ] Create a second user and verify the first user's conversations/files/tasks/memories are not visible to the second user.
- [ ] Upload a PDF, DOCX, PPTX, XLSX, CSV, TXT, ODT, ZIP and a source-code file. Legacy `.xls` is unsupported.
- [ ] Attach a supported image to a chat and test with a vision-capable model.
- [ ] Create, edit and delete a memory.
- [ ] Create, update and delete a task.

## 3. Agent tools

Configure `TAVILY_API_KEY` before web-search tests.

- [ ] Ask the Agent to research a current topic and check source links.
- [ ] Ask it to read a public webpage and summarize it.
- [ ] Ask it to calculate `(12 + 8) * 2` (expected result: 40).
- [ ] Ask it to search a phrase contained in an uploaded document.
- [ ] Explicitly ask it to create a task and confirm the task appears in Tasks.
- [ ] Open Agent activity and verify tool steps are recorded.

## 4. Browser approval (optional)

- [ ] Run `npx playwright install chromium` after installing packages.
- [ ] Ask the Agent to open a harmless public webpage.
- [ ] Confirm it creates a pending approval without opening the page first.
- [ ] Review the exact URL and requested steps in the approval panel.
- [ ] Reject one request and confirm it is not executed.
- [ ] Approve another harmless request and confirm title/text is returned.
- [ ] Confirm localhost/private network URLs are blocked.

## 5. Code execution (optional; Docker required)

- [ ] Install Docker Engine.
- [ ] Pull `python:3.12-slim` and `node:22-slim` images.
- [ ] Set `ENABLE_DOCKER_CODE=true` in `server/.env` and restart.
- [ ] Ask the Agent to run a harmless Python print statement.
- [ ] Review and approve the exact code before execution.
- [ ] Confirm stdout and exit code are returned.
- [ ] Repeat with JavaScript.
- [ ] Confirm code execution has no network access and a time/resource limit.

## 6. OCR (optional)

- [ ] Set `ENABLE_OCR=true` and `OCR_LANGUAGES=eng+ben`.
- [ ] Upload an image with clear English text and inspect extracted text.
- [ ] Upload an image with clear Bangla text and inspect extracted text.
- [ ] Remember that scanned PDF OCR and embedded Office-image OCR are not included in this build.

## 7. Production/security checks

- [ ] Confirm the frontend does not contain API keys.
- [ ] Confirm `.env` is not committed or shared.
- [ ] Confirm production startup fails with a weak/missing JWT secret.
- [ ] Confirm user A cannot access user B's record IDs.
- [ ] Confirm browser and code tools require explicit approval.
- [ ] Keep Docker execution disabled unless you understand and control the Docker host.

## 8. Deployment smoke checks

- [ ] Run `npm ci`, `npm run build`, and `npm test` from the project root.
- [ ] Confirm `server/.env` has production values and is not committed or included in a shared ZIP.
- [ ] Build and start with `docker compose up --build -d`.
- [ ] Confirm `http://localhost:5000/health` returns HTTP 200 and `dbConnected: true`.
- [ ] Confirm `http://localhost:5000` serves the app and browser API requests use the same host.
- [ ] Restart the container and confirm uploaded files remain available through the named volume.
- [ ] From the deployment host, confirm its outbound IP is allowed by Atlas Network Access.
- [ ] Configure HTTPS and a trusted proxy before exposing the service publicly; set `TRUST_PROXY=1` only behind one trusted proxy.

## Troubleshooting information to share

If something fails, send the exact terminal error, browser console error, the test step number, and a sanitized copy of the relevant `.env` keys (never send actual API keys, passwords or JWT secrets).

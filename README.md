# Student Executive Assistant — GitHub Pages demo

A responsive, frontend-only student productivity demo. It includes local task management, an OpenAI-powered assistant, study-resource generation, and browser-side usage guardrails.

## Features

- Responsive dashboard for desktop and mobile.
- Add, complete, filter, sort, and delete tasks; tasks stay in this browser using `localStorage`.
- OpenAI assistant for planning, project breakdowns, explanations, and email drafts.
- Study tools: study guide, practice quiz, notes summary, and exam-prep plan.
- Demo limits: 10 attempted AI requests per browser per day, 3 per minute, 4,000 characters per prompt, and 500 maximum output tokens.
- Demo API key can be configured in `app.js` for a controlled local demo, or entered through **API & settings** at runtime.
- Original assistant plugin package is preserved in `original-plugin/`.

## Run locally

From this folder, run a static server if available:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload/push the contents of this folder to the repository root, with `index.html` at the root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/(root)`, then save.
5. For the direct-code demo, open `app.js` in VS Code and replace `PASTE_YOUR_OPENAI_API_KEY_HERE` in the `DEMO_API_KEY` constant with your key. Save and test locally before pushing. Alternatively, enter a key through **API & settings** at runtime.

## OpenAI setup

- Create/manage keys: <https://platform.openai.com/api-keys>
- API usage and billing: <https://platform.openai.com/usage>
- API key safety guidance: <https://platform.openai.com/docs/guides/production-best-practices/api-keys>
- This demo uses `POST https://api.openai.com/v1/chat/completions` with `gpt-4.1-mini` by default. Choose another listed model only if it is available to your API project.
- ChatGPT subscriptions do not include OpenAI API credits; API usage is billed separately and may require billing setup.

## Critical security warning

**SECURITY WARNING: You asked for a hardcoded-key demo. A key placed in `app.js` will be visible to anyone who can access the deployed website source, even if the GitHub repository is private. GitHub Pages publishes the frontend files to browsers. Only use a dedicated, low-risk demo key that you are prepared to revoke. Set the tightest available provider project limits, monitor usage, and revoke the key after the demo. Provider-side budgets may be alerts rather than guaranteed hard stops. For any public or shared deployment, remove the hardcoded key and use a serverless proxy instead.**

For safer shared use, put the key in a small serverless proxy and enforce quota on the server. GitHub Pages itself cannot hide API keys or enforce a shared quota.

## Usage guardrail limitations

- Daily and per-minute counts are stored in `localStorage`. They can be bypassed by clearing browser data, changing browsers/devices, or modifying client code. They are not a secure project-wide quota.
- The app reserves a request before sending, so failed attempts count toward the local limit.
- `max_completion_tokens: 500` limits output length, not the total cost of all requests. Provider limits remain authoritative.

## Data and integration boundaries

- Tasks are saved only in the current browser; they are not synced to another device.
- Gmail, Google Calendar, Google Drive, Contacts, and the college portal are not connected by this static website. The preserved package in `original-plugin/` contains configuration/instructions for a compatible host, not live integrations in this website.
- Avoid sending passwords, confidential college data, or sensitive personal information in prompts.

## Repository hygiene

The ZIP contains only a placeholder, not a real API key. If you replace it with a real key and commit/push the file, treat the key as exposed and revoke it after the demo.


## Configure the demo API key in VS Code

Open `app.js` and find `const DEMO_API_KEY = 'PASTE_YOUR_OPENAI_API_KEY_HERE';`. For a local-only demo, replace the placeholder with your dedicated OpenAI API key. The key is not shown in the webpage settings panel, but it is still embedded in frontend JavaScript and can be extracted by anyone who can load the deployed website. A private GitHub repository does not make published GitHub Pages source private. Do not use a key with sensitive access; monitor usage and revoke it after the demo. For a public or shared deployment, use a serverless proxy instead of embedding the key.

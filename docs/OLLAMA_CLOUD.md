# Ollama Cloud in TAK-TAK (every client workspace)

Ollama Cloud runs open models (gpt-oss, Kimi, GLM, DeepSeek, Gemma and others) on Ollama's servers. In the dashboard it is one more TAK-TAK engine, beside Groq, Claude, ChatGPT and the others.

## What it does
- **Every client workspace** can use it in TAK-TAK **Chat** and **Write** as soon as the key is saved. A client can pick "Ollama Cloud" by name, or leave TAK-TAK on "Auto".
- **Auto:** Ollama comes after Claude, ChatGPT, Gemini, Mistral and Groq, and before DeepSeek and Grok. It answers only when the engines before it are not connected.
- **Trial:** new accounts get 50 trial credits on an economy engine. Ollama is the second choice after Groq.
- **Credits:** each run debits the workspace's credits. A failed run is refunded. Answers are saved in the client's AI Studio, as for every engine.
- **Security:** the key stays on the server (stored encrypted, or read from the environment) and is never sent to a browser.

## Turning it on (owner, about 2 minutes)
1. Create a key at https://ollama.com/settings/keys. Cloud usage needs Ollama credits or a paid plan (https://ollama.com/pricing).
2. Paste it in **Admin › AI provider keys › Ollama Cloud**, then press **Test**. The test only reads the balance (`GET https://ollama.com/api/balance`) and generates nothing. Instead of steps 2 and 3, you can set `OLLAMA_API_KEY` in Coolify and redeploy.
3. TAK-TAK sees the new engine within one minute.

## Options (environment, all optional)
- `TAKBOT_MODEL_OLLAMA`: the model name from https://ollama.com/search?c=cloud. The default is `gpt-oss:120b`.
- `TAKBOT_TRIAL_ENGINE=ollama`: forces the trial onto Ollama even when Groq is connected.

## How it works
- **Relay:** OpenAI-compatible `POST https://ollama.com/v1/chat/completions` with `Authorization: Bearer <key>` (docs.ollama.com/api/openai-compatibility, checked 2026-11-04).
- **Code:** `src/lib/takbot/catalog.ts`, `src/lib/ai-providers/catalog.ts`, `src/lib/growth/ai-engine.ts`, `src/lib/takbot/trial.ts`.
- **Tests:** `npm run qa:takbot`, `npm run qa:growth-suite`, `npm run qa:ai-provider-keys`.

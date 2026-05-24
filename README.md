```txt
npm install
npm run dev
```

Set `AI_GATEWAY_ID` in `wrangler.toml` or your Pages/Workers environment to the Cloudflare AI Gateway you want inference to run through. This repository is currently configured to use `speechtopics`.

Set the AI Gateway token as a secret before running or deploying:

```txt
wrangler secret put CF_AIG_TOKEN
```

Inference now uses the OpenAI-compatible client and derives the gateway base URL programmatically from `env.AI.gateway(AI_GATEWAY_ID).getUrl("openai")`, so you do not need to hardcode the account or gateway URL in code.

```txt
npm run deploy
```

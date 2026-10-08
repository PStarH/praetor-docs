# Providers

> This page is synchronized from the canonical English documentation. 한국어 navigation is available; commands and product limits are identical in every locale.

Praetor supports **25 providers**. Set at least one API key and Praetor
detects which provider you configured.

The registry is the single source of truth: `registerProvider()` calls in
`packages/core/src/runtime/providers/providerRegistry.ts` determine the
auto-detection order, the environment variable map, the default base URLs, the
default models, the display names, and the API type. Adding a provider is one
`registerProvider()` call.

## Auto-detection order

Order matters. **Local providers are listed first**, so auto-detection prefers
them when configured; cloud providers follow, with OpenAI last as the most
reliable fallback.

## The 25 providers

| # | `--provider` value | Display name | Env variable | Default model |
| --- | --- | --- | --- | --- |
| 1 | `ollama` | Ollama (Local) | `OLLAMA_API_KEY` | `llama3.2` |
| 2 | `vllm` | vLLM (Local) | `VLLM_API_KEY` | `meta-llama/Llama-3.2-3B-Instruct` |
| 3 | `deepinfra` | DeepInfra | `DEEPINFRA_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| 4 | `anyscale` | Anyscale | `ANYSCALE_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct` |
| 5 | `replicate` | Replicate | `REPLICATE_API_TOKEN` | `meta/meta-llama-3.3-70b-instruct` |
| 6 | `cohere` | Cohere | `CO_API_KEY` | `command-a-plus-05-2026` |
| 7 | `mistral` | Mistral AI | `MISTRAL_API_KEY` | `mistral-large-latest` |
| 8 | `groq` | Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| 9 | `together` | Together AI | `TOGETHER_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| 10 | `perplexity` | Perplexity | `PERPLEXITY_API_KEY` | `sonar-pro` |
| 11 | `fireworks` | Fireworks AI | `FIREWORKS_API_KEY` | `accounts/fireworks/models/llama-v3p3-70b-instruct` |
| 12 | `xiaomi` | Xiaomi MiMo | `XIAOMI_API_KEY` | `mimo-v2-flash` |
| 13 | `mimo` | MiMo | `MIMO_API_KEY` | `mimo-v2.5` |
| 14 | `deepseek` | DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` |
| 15 | `glm` | GLM (Zhipu AI) | `ZHIPU_API_KEY` | `glm-4.7` |
| 16 | `xai` | xAI (Grok) | `XAI_API_KEY` | `grok-2-latest` |
| 17 | `bedrock` | AWS Bedrock | `AWS_ACCESS_KEY_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| 18 | `agnes` | Agnes AI | `AGNES_API_KEY` | `agnes-2.5-flash` |
| 19 | `stepfun` | StepFun | `STEPFUN_API_KEY` | `step-3.7-flash` |
| 20 | `minimax` | MiniMax | `MINIMAX_API_KEY` | `MiniMax-M3` |
| 21 | `openrouter` | OpenRouter | `OPENROUTER_API_KEY` | `openai/gpt-4o-mini` |
| 22 | `anthropic` | Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| 23 | `google` | Google Gemini | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| 24 | `azure` | Azure OpenAI | `AZURE_OPENAI_API_KEY` | `gpt-4o` |
| 25 | `openai` | OpenAI | `OPENAI_API_KEY` | `gpt-4o` |

### Environment variables that are not obvious

Several providers use a variable you would not guess from the name:

- **Cohere** uses `CO_API_KEY` (with `COHERE_API_KEY` accepted as a fallback).
- **GLM / Zhipu** uses `ZHIPU_API_KEY`, not `GLM_API_KEY`.
- **Replicate** uses `REPLICATE_API_TOKEN` (with `REPLICATE_API_KEY` accepted as
  a fallback).
- **AWS Bedrock** is selected by `AWS_ACCESS_KEY_ID` presence and also needs
  `AWS_SECRET_ACCESS_KEY` and `AWS_REGION`.

## Overrides

Each provider accepts the same three override shapes:

| Pattern | Example |
| --- | --- |
| Base URL | `<PROVIDER>_BASE_URL` — e.g. `OPENAI_BASE_URL`, `AZURE_OPENAI_BASE_URL` |
| Model | `<PROVIDER>_MODEL` — e.g. `OPENAI_MODEL`, `AZURE_OPENAI_MODEL` |
| Host (local runtimes) | `OLLAMA_HOST`, `VLLM_BASE_URL` |

Azure OpenAI additionally uses `AZURE_OPENAI_API_VERSION`.

## Failover

Providers form a configurable auto-failover chain. `praetor init` scans for
configured keys, tests connectivity, measures latency, and writes the resulting
chain to `.commander.json`. Per-provider circuit breakers track error rates and
open after consecutive failures, moving traffic to the next provider in the
chain.

## Model tiers

`PRAETOR_MIN_SENSITIVE_MODEL_TIER` sets a floor for the model tier used on
sensitive steps. Tiers are `eco`, `standard`, `power`, and `consensus`; the
default is `standard`. A step that needs a higher tier will not be routed to a
lower one.

## Credential handling

Provider keys are resolved **vault-first, then environment**. The encrypted
secrets vault (`PRAETOR_MASTER_KEY`) uses AES-256-GCM with HKDF-SHA-256
derivation. See [Security and privacy](/security#secret-handling).
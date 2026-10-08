# 模型提供商

Praetor 深度支持 **25 家大模型供应商**。只需在环境中配置至少一个供应商的 API Key，系统即可智能识别并自动加载。

系统以代码注册表为唯一法定基准：位于 `packages/core/src/runtime/providers/providerRegistry.ts` 中的 `registerProvider()` 清单明确规定了自动探测优先级、环境变量映射表、默认 Base URL、默认模型名称与 API 协议类型。接入全新供应商仅需一次标准的 `registerProvider()` 调用。

## 智能自动探测优先级

探测顺序具有明确的系统级考量：**本地私有化模型优先列出**，当配置了本地环境时系统优先将负载路由至本地；公有云大模型紧随其后；OpenAI 作为业界基准和可靠回退项位于末尾。

## 25 家支持的大模型供应商全览

| 序号 | `--provider` 参数值 | 供应商显示名称 | 环境变量标识 | 默认推荐模型 |
| --- | --- | --- | --- | --- |
| 1 | `ollama` | Ollama (本地部署) | `OLLAMA_API_KEY` | `llama3.2` |
| 2 | `vllm` | vLLM (高性能推理) | `VLLM_API_KEY` | `meta-llama/Llama-3.2-3B-Instruct` |
| 3 | `deepinfra` | DeepInfra | `DEEPINFRA_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| 4 | `anyscale` | Anyscale | `ANYSCALE_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct` |
| 5 | `replicate` | Replicate | `REPLICATE_API_TOKEN` | `meta/meta-llama-3.3-70b-instruct` |
| 6 | `cohere` | Cohere | `CO_API_KEY` | `command-a-plus-05-2026` |
| 7 | `mistral` | Mistral AI | `MISTRAL_API_KEY` | `mistral-large-latest` |
| 8 | `groq` | Groq (极速推理) | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| 9 | `together` | Together AI | `TOGETHER_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| 10 | `perplexity` | Perplexity | `PERPLEXITY_API_KEY` | `sonar-pro` |
| 11 | `fireworks` | Fireworks AI | `FIREWORKS_API_KEY` | `accounts/fireworks/models/llama-v3p3-70b-instruct` |
| 12 | `xiaomi` | 小米 MiMo | `XIAOMI_API_KEY` | `mimo-v2-flash` |
| 13 | `mimo` | MiMo | `MIMO_API_KEY` | `mimo-v2.5` |
| 14 | `deepseek` | DeepSeek (深度求索) | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` |
| 15 | `glm` | 智谱清言 (GLM) | `ZHIPU_API_KEY` | `glm-4.7` |
| 16 | `xai` | xAI (Grok) | `XAI_API_KEY` | `grok-2-latest` |
| 17 | `bedrock` | AWS Bedrock | `AWS_ACCESS_KEY_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| 18 | `agnes` | Agnes AI | `AGNES_API_KEY` | `agnes-2.5-flash` |
| 19 | `stepfun` | 阶跃星辰 (StepFun) | `STEPFUN_API_KEY` | `step-3.7-flash` |
| 20 | `minimax` | MiniMax (名之梦) | `MINIMAX_API_KEY` | `MiniMax-M3` |
| 21 | `openrouter` | OpenRouter | `OPENROUTER_API_KEY` | `openai/gpt-4o-mini` |
| 22 | `anthropic` | Anthropic (Claude) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| 23 | `google` | Google Gemini | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| 24 | `azure` | Azure OpenAI | `AZURE_OPENAI_API_KEY` | `gpt-4o` |
| 25 | `openai` | OpenAI | `OPENAI_API_KEY` | `gpt-4o` |

### 特殊命名的环境变量注意点

部分供应商所使用的环境变量不完全遵循常规拼写规则：

- **Cohere** 采用 `CO_API_KEY`（同时兼容回退查找 `COHERE_API_KEY`）。
- **智谱 GLM** 采用 `ZHIPU_API_KEY`，而非 `GLM_API_KEY`。
- **Replicate** 采用 `REPLICATE_API_TOKEN`（同时兼容回退查找 `REPLICATE_API_KEY`）。
- **AWS Bedrock** 通过检测 `AWS_ACCESS_KEY_ID` 触发，同时需要提供 `AWS_SECRET_ACCESS_KEY` 与 `AWS_REGION`。

## 参数重载规则 (Overrides)

每个供应商均支持以下统一格式的环境变量重载：

| 重载目标 | 环境变量命名模式 | 具体示例 |
| --- | --- | --- |
| 接口 Base URL | `<PROVIDER>_BASE_URL` | `OPENAI_BASE_URL`, `AZURE_OPENAI_BASE_URL` |
| 模型名称 | `<PROVIDER>_MODEL` | `OPENAI_MODEL`, `AZURE_OPENAI_MODEL` |
| 本地实例 Host | `OLLAMA_HOST`, `VLLM_BASE_URL` | 本地自建推理服务地址 |

针对 Azure OpenAI，系统额外支持通过 `AZURE_OPENAI_API_VERSION` 指定特定的 API 版本。

## 故障转移链 (Failover)

系统支持构建动态容灾故障转移链。执行 `praetor init` 时，脚手架会自动扫描本地已配置的 API 密钥、测试网络连通性、压测往返延迟，并将最优的容灾链保存至 `.commander.json` 中。每个供应商均具备独立的熔断器组件，实时监测错误率并在连续失败时触发熔断，自动将流量平滑引流至链条中的下一家健康供应商。

## 模型能力分级 (Model Tiers)

通过环境变量 `PRAETOR_MIN_SENSITIVE_MODEL_TIER` 可以为高敏感度或关键代码变更步骤设定最低模型基线。系统划分了四个能力梯队：`eco`（轻量经济型）、`standard`（标准生产型）、`power`（高推理算力型）与 `consensus`（共识裁判型）；系统默认等级为 `standard`。标记为需要高等级模型的步骤绝不会被降级分发给低梯队模型。

## 凭据安全存储机制

系统对于模型密钥的加载遵循 **“加密密钥库优先，环境变量回退”** 的原则。内置的 `EncryptedSecretsVault` 采用 AES-256-GCM 与 HKDF-SHA-256 派生算法对密钥进行静态加密存储，由 `PRAETOR_MASTER_KEY` 统一保护。详见 [安全体系与隐私保护](/zh/security#敏感凭据防护)。
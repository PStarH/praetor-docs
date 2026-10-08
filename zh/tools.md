# 工具体系

Praetor 面向大语言模型开放了 **18 个内置核心工具**，并允许通过标准协议接入任何兼容 MCP 的外部工具。元工具 (Meta-tools) 属于按需启用能力，不计入上述 18 个基础工具中。

所有工具均在 `packages/core/src/tools/index.ts` 中的 `createAllTools()` 统一注册。其中有 10 个工具采用了 STRAP 规范整合的**资源型工具 (Resource Tools)** 架构——即通过统一领域工具搭配 `action` 动作参数的方式暴露，而非拆分为几十个零散的微型 CRUD 工具。这种设计是经过深思熟虑的：过多的工具碎片会显著降低大语言模型的工具决策准确率。

## 18 个内置核心工具一览

| 工具标识 | 归属类别 | 核心功能与职责说明 |
| --- | --- | --- |
| `file` | 文件系统 | 文件读写、行级编辑、关键词搜索、目录遍历与 glob 通配匹配。通过 `action` 指定操作 |
| `memory` | 记忆持久化 | 键值结构持久化记忆：存储、检索召回与键清单列举 |
| `web` | 网络检索 | 执行网络搜索引擎查询或从指定公开 URL 抓取解析内容 |
| `browser` | 网页浏览 | 驱动无头浏览器执行网页自动化交互、渲染检索与内容抓取 |
| `code` | 代码工程 | 跨文件代码符号语义搜索、重构优化与局部代码修复 |
| `checkpoint` | 工作流状态 | 保存、回滚、列举与折叠对话历史检查点 |
| `handoff` | 协作交接 | 将当前任务状态安全交接委派给其他智能体，或查询交接流转状态 |
| `exec` | 脚本执行 | 在隔离环境中执行 Python、Shell 或 JavaScript 脚本 |
| `media` | 多模态处理 | 视觉图像理解分析、屏幕截图捕获与 PDF 文档文字提取 |
| `system` | 系统控制 | 主动请求人工交互输入，或按需动态检索指定工具的 JSON Schema 定义 |
| `git` | 版本控制 | 执行标准 Git 操作：status、log、diff、branch、blame、add、commit、push、pull。严禁使用 Shell 管道符，必须使用原生参数控制输出（如 `-n 20` 代替 `| head -20`） |
| `verify` | 自动化质检 | 自动化运行代码 Linter、类型检查器及测试框架；返回结构化通过率与错误计数 |
| `apply_patch` | 代码补丁 | 将标准 Unified Diff 补丁原子应用至目标文件，应用前预先校验哈希 |
| `file_hash_edit` | 文件哈希编辑 | 基于文件内容哈希锚定的高可靠编辑（具备抗并发漂移能力，优先于普通编辑） |
| `lsp` | 语言服务器 | 挂载并查询语言服务器协议 (LSP) 诊断信息与代码符号定义 |
| `verify_answer` | 格式校验 | 校验模型产出的最终结论是否符合业务预设的强格式要求 |
| `skill_view` | 技能库查阅 | 从可用技能注册表中按名称查阅指定技能的完整 Prompt 与工程指南 |
| `search_conversations` | 记忆检索 | 基于 SQLite FTS5 对历史全量对话执行全文搜索，按语义相关性排序 |

## 信任分级体系 (Trust Tiers)

系统中的每个工具都被赋予了明确的信任分级：`trusted`（受信任）或 `untrusted`（不受信）。所有可能摄入外部不可信数据的工具，默认一律归类为 **untrusted**：

- **不受信工具 (Untrusted):** `web`, `browser`, `media`, `skill_view`, `search_conversations`，以及所有带有 `mcp_` 前缀或分类属于 MCP 范畴的外部工具。
- **受信任工具 (Trusted):** `file`, `memory`, `code`, `checkpoint`, `handoff`, `system`, `git`, `apply_patch`, `verify_answer`, `exec`, `verify`, `agent`, `meta` 以及细分文件操作。

分级判定优先级为：工具显式声明的 `trustTier` 属性 > `mcp_` 名称前缀或 MCP 分类 > 预设系统默认映射表 > **默认以 Fail-closed 原则收敛至 untrusted（不受信）**。

## 面向外部 MCP 的工具暴露防护

当 Praetor 将自身能力作为 MCP 服务向外部调用方暴露时，系统默认对危险工具集合进行安全过滤阻断；除非调用方显式声明配置 `allowDangerousTools` 选项：

被严格过滤的危险工具包括：`exec`、`git`、`apply_patch`、`file`、`file_hash_edit`、`system`、`verify`、`code` 以及 `refine_code`。

详见 [MCP 协议与工具过滤机制](/zh/mcp#工具安全过滤机制)。

## 元工具机制 (Meta-tools)

元工具在默认情况下**不予注册**。可通过在配置中传入 `createAllTools({ enableMetaTools: true })` 显式开启；元工具将其他工具封装为子工具调用。具有 Shell 等价权能的高危工具被强制排除在子工具映射表之外，确保攻击者无法利用元工具嵌套来绕过执行权限策略。

## 外部扩展工具

所有兼容 MCP 规范的外部第三方工具接入后，均被统一冠以 `mcp_` 前缀，并始终强制按**不受信任 (untrusted)** 工具对待。配置方式详见 [MCP 协议指南](/zh/mcp)。
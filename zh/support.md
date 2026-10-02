# 技术支持与系统边界 (Support & Limits)

## 技术支持与沟通渠道 (Support)

- **日常使用、功能建议与缺陷反馈**：欢迎通过 [GitHub Issues](https://github.com/PStarH/Commander/issues) 提交工单，提出改进建议或提供包含可复现步骤的 Bug 报告。
- **安全漏洞私密报告**：若发现潜在的越权漏洞、沙箱逃逸或凭据泄露风险，请务必遵循仓库中的 `SECURITY.md` 规范，通过 [GitHub Security Advisories（安全通报专区）](https://github.com/PStarH/Commander/security/advisories/new) 提交私密通报，严禁在公开 Issue 列表中披露漏洞细节。

## 当前系统边界与成熟度声明 (Current Limits)

- **产品默认主推路径**：本地命令行工具 (Local CLI) 是当前官方主推、经过全面测试与工程加固的生产交互形态。
- **企业网关成熟度状态**：挂载于 `/v1` 路径下的企业级 Action Gateway 目前处于 **Alpha 预览阶段**，尚未在高度严苛的公网大规模多租户生产场景中证明其成熟度，需配合企业自建隔离边界使用。
- **大模型固有限制**：大模型生成的内容以及自动化质量校验均存在误判或偶发失败概率；在执行可能产生重大不可逆影响的外部生产变更时，必须引入人工审批核准机制。
- **基准测试数据性质**：官方文档中列出的基准测试数据与 CI 自动化基线仅代表受控实验环境下的测试指标，不构成针对商业用户的法定 SLA 履约承诺或独立合规认证背书。

## 企业级就绪性自检清单 (Enterprise Readiness)

对于正在推进企业级安全选型、合规尽职调查（Due Diligence）或试点评估的架构师与合规专家，建议查阅 Commander 官方代码仓库根目录下的 [ENTERPRISE_READINESS.md](https://github.com/PStarH/Commander/blob/master/ENTERPRISE_READINESS.md)。

该文档针对 SOC 2 控制矩阵、多租户物理/逻辑隔离原语、系统可用性 SLO 工程基线以及企业数据治理生命周期进行了条目化拆解，清晰透明地标注了每一项能力的真实落地状态（✅ 核心代码已接通、🟡 文档已声明但存在架构边界、❌ 尚待后续演进接入），并附带精确到具体源码行级别的验证索引与证据指针。
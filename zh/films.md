---
title: 影片 — 使命、原理与实证
description: 用三支短片了解 Praetor 的企业信任使命、经过分项验证的执行机制，以及真实 GitHub API 故障恢复实验。
layout: doc
pageClass: film-page
sidebar: false
aside: false
---

<script setup>
import { withBase } from 'vitepress'
</script>

# 使命、原理与实证

我们的使命是让 Agent 值得企业托付。Praetor 仍处于 **Alpha**：三支影片分别呈现长期目标、分项验证的技术机制，以及一次有记录的真实 API 实验。

<FilmGallery />

## 分项验证记录 {#verification}

技术短片由源代码版本 [`1799a15c`](https://github.com/PStarH/Praetor/commit/1799a15c961a48097a4c87ffdda17cd6131ebb6a) 的 **81 项选定测试**支持。这是已记录的分项结果，不代表全仓测试通过或生产验证完成。授权和租约测试使用内存仓库；结果查询测试包含模拟 HTTP 与受控仓库。签名证据为合成样本，用于验证完整性校验，不代表一次真实外部操作。

- <a :href="withBase('/films/evidence/verification.json')">运行命令、源代码版本与结果</a>
- 原始测试输出：<a :href="withBase('/films/evidence/authority.tap')">授权（4 项）</a>、<a :href="withBase('/films/evidence/fencing.tap')">租约隔离（12 项）</a>、<a :href="withBase('/films/evidence/outcomes.tap')">未知结果（28 项）</a>、<a :href="withBase('/films/evidence/evidence.tap')">证据（37 项）</a>
- <a :href="withBase('/films/evidence/proof.json')">请求摘要、签名样本与被拒绝的篡改证据</a>

## 从边界明确的评估开始

阅读[快速入门](./getting-started)，或检查 [GitHub 试点边界](https://github.com/PStarH/Praetor/blob/master/docs/pilot/github/README.md)。评估生产工作负载前，请先了解[当前能力与限制](https://github.com/PStarH/Praetor/blob/master/ENTERPRISE_READINESS.md)。

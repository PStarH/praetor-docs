---
title: Films — mission, engineering, evidence
description: Three short films about Praetor’s enterprise trust mission, verified execution mechanisms, and a real GitHub API recovery experiment.
layout: doc
pageClass: film-page
sidebar: false
aside: false
---

<script setup>
import { withBase } from 'vitepress'
</script>

# Mission. Mechanisms. Evidence.

Our mission is to make agents worthy of enterprise trust. Praetor is **alpha**: these films distinguish the goal, component-level engineering, and one recorded API experiment.

<FilmGallery />

## Component verification {#verification}

The technical film is supported by **81 selected component checks** at source revision [`1799a15c`](https://github.com/PStarH/Praetor/commit/1799a15c961a48097a4c87ffdda17cd6131ebb6a). These are recorded results, not a full-suite pass or production validation. The authority and fencing checks use in-memory repositories; outcome checks include mocked HTTP and controlled repositories. The signed bundle is synthetic: it demonstrates integrity checks, not an external action.

- <a :href="withBase('/films/evidence/verification.json')">Commands, source revision and results</a>
- Raw test output: <a :href="withBase('/films/evidence/authority.tap')">authority (4)</a>, <a :href="withBase('/films/evidence/fencing.tap')">fencing (12)</a>, <a :href="withBase('/films/evidence/outcomes.tap')">outcomes (28)</a>, <a :href="withBase('/films/evidence/evidence.tap')">evidence (37)</a>
- <a :href="withBase('/films/evidence/proof.json')">Request digests, signed fixture and rejected forgery</a>

## Start with a bounded evaluation

[Read the quick start](./getting-started) or inspect the [GitHub pilot boundary](https://github.com/PStarH/Praetor/blob/master/docs/pilot/github/README.md). Review the [current readiness and limits](https://github.com/PStarH/Praetor/blob/master/ENTERPRISE_READINESS.md) before evaluating production workloads.

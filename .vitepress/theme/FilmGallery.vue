<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps<{ compact?: boolean }>()
const { lang, localeIndex } = useData()
const chinese = computed(() => lang.value.startsWith('zh'))
const failed = ref<Record<string, boolean>>({})
const films = computed(() => [
  {
    id: 'brand', time: '0:29', category: chinese.value ? '长期使命' : 'The mission',
    title: chinese.value ? '让 Agent 值得企业托付' : 'Make agents worthy of enterprise trust.',
    description: chinese.value ? '企业敢把重要工作交给 Agent 吗？这是我们立志长期解决的问题。' : 'Can enterprises trust agents with important work? This is the long-term problem we are working to solve.',
    scope: chinese.value ? '品牌愿景 · Alpha，目标尚未实现' : 'Brand vision · Alpha; a mission still being built',
    transcript: chinese.value ? 'Agent 已经能够行动。企业敢把工作交给它们吗？信任，要在每一次行动中建立。我们的使命：让 Agent 值得企业托付。这是一项长期使命。' : 'Agents can act. Can enterprises trust them? Trust has to be earned. Action by action. Our mission: make agents worthy of enterprise trust. A long-term mission. Built action by action.',
    evidence: 'https://github.com/PStarH/Praetor/blob/master/ENTERPRISE_READINESS.md',
    evidenceLabel: chinese.value ? '查看当前能力与限制' : 'Current readiness and limits',
  },
  {
    id: 'explainer', time: '1:58', category: chinese.value ? '技术原理' : 'The engineering',
    title: chinese.value ? '把信任落实为执行约束' : 'The engineering of trust.',
    description: chinese.value ? '精确请求授权、过期执行者隔离、未知结果处理，以及被篡改证据的签名校验。' : 'Exact request authority, stale-worker fencing, uncertain outcomes, and signature checks that reject altered evidence.',
    scope: chinese.value ? '机制示意 · 分项测试，含内存仓库与模拟 HTTP' : 'Mechanism illustrations · Component tests, including in-memory repositories and mocked HTTP',
    transcript: chinese.value ? '批准绑定具体请求，参数改变后原批准不再匹配。同一幂等键搭配不同参数会触发冲突。旧租约失效后，过期执行者不能提交结果。超时不能说明远端是否执行；系统保留 UNKNOWN，通过只读查询确定结果，仍未知则重新安排查询。篡改证据即使重算哈希，原签名仍会验证失败。签名证明记录完整性与签署来源，不能单独证明远端事实。这些是分项验证，不代表已经生产就绪。' : 'Approval binds to an exact request; changing an argument changes its digest. Reusing an idempotency key with different arguments produces a conflict. Expired leases reject stale commits. A timeout cannot establish a remote outcome: preserve UNKNOWN, query read-only, and reschedule when it remains uncertain. Rehashing altered evidence can satisfy structural checks, but verification against the trusted signing key fails. A signature establishes integrity and signing origin, not remote truth. These are component-level checks, not production-readiness evidence.',
    evidence: `${galleryPath.value}#verification`,
    evidenceLabel: chinese.value ? '查看分项验证证据' : 'Component verification evidence',
  },
  {
    id: 'case-study', time: '0:38', category: chinese.value ? '真实 API 实验' : 'The live API experiment',
    title: chinese.value ? '响应丢失，已有 PR 如何被找回' : 'The reply is lost. The PR is found.',
    description: chinese.value ? '真实 GitHub API、Gateway 和 PostgreSQL：注入响应丢失并重启 worker，查询找回已创建的 PR。' : 'Real GitHub API, Gateway and PostgreSQL: inject a lost reply, restart the worker, and recover the existing pull request.',
    scope: chinese.value ? 'CI 记录的动画重现 · 故障注入，无 LLM 参与，非生产事故' : 'Animated reconstruction of a CI run · Injected faults, no LLM, not a production incident',
    transcript: chinese.value ? '提议创建 PR；提议者不能批准自己的请求。独立身份批准具体请求后，worker 执行。GitHub 已创建 PR，但测试代理丢弃响应，worker 被杀死。系统保留 COMPLETION_UNKNOWN。重启后，通过动作标记只读查询找到唯一匹配的 PR，恢复为 COMPLETED。该次场景只调用了一次创建。零个或多个匹配会保持未知。实验使用沙盒仓库与注入故障，没有 LLM 参与；不构成普遍的 exactly-once 保证。' : 'An action is proposed. The proposing agent cannot approve itself. A separate identity approves the exact request. GitHub creates the PR; the test proxy drops the reply and the worker is killed. COMPLETION_UNKNOWN is persisted. After restart, a read-only lookup finds one matching PR by action marker and resumes to COMPLETED, with one create call in the shown scenario. Zero or multiple matches remain unknown. This uses a sandbox repository and injected faults, with no LLM in the loop. It does not establish a universal exactly-once guarantee.',
    evidence: 'https://github.com/PStarH/Praetor/actions/runs/36653246066',
    evidenceLabel: chinese.value ? '查看原始 CI 记录' : 'Original CI run',
  },
])
const galleryPath = computed(() => withBase(localeIndex.value === 'root' ? '/films.html' : `/${localeIndex.value}/films.html`))
const asset = (id: string, suffix: string) => withBase(`/films/${id}.${suffix}`)
function pauseOthers(event: Event) {
  const current = event.currentTarget
  document.querySelectorAll<HTMLVideoElement>('.film-gallery video').forEach(video => {
    if (video !== current) video.pause()
  })
}
</script>

<template>
  <section class="film-gallery" :class="{ compact: props.compact }" :aria-label="chinese ? 'Praetor 影片' : 'Praetor films'">
    <div v-if="props.compact" class="film-section-heading">
      <p>{{ chinese ? '使命 · 原理 · 实证' : 'Mission. Mechanisms. Evidence.' }}</p>
      <a :href="galleryPath">{{ chinese ? '观看全部影片 →' : 'Explore all three films →' }}</a>
    </div>
    <div class="film-grid">
      <article v-for="(film, index) in films" :id="props.compact ? undefined : film.id" :key="film.id" class="film" :class="{ featured: index === 0 }">
        <a v-if="props.compact && index > 0" class="film-poster-link" :href="`${galleryPath}#${film.id}`" :aria-label="`${chinese ? '观看' : 'Watch'}: ${film.title}`">
          <img :src="asset(film.id, 'jpg')" :alt="film.title" width="1280" height="720" loading="lazy" />
          <span class="film-play" aria-hidden="true">▶ {{ film.time }}</span>
        </a>
        <div v-else class="film-player">
          <video controls playsinline preload="none" :poster="asset(film.id, 'jpg')" :aria-label="film.title" :aria-describedby="`${film.id}-scope`" @play="pauseOthers" @error="failed[film.id] = true">
            <source :src="asset(film.id, 'mp4')" type="video/mp4" @error="failed[film.id] = true" />
            <track kind="captions" :src="asset(film.id, 'vtt')" srclang="en" label="English · on-screen text" />
            <a :href="asset(film.id, 'mp4')">{{ chinese ? '下载视频' : 'Download the film' }}</a>
          </video>
          <p v-if="failed[film.id]" class="film-error" role="status">{{ chinese ? '视频暂时无法播放。' : 'The film could not be loaded.' }} <a :href="asset(film.id, 'mp4')" download>{{ chinese ? '下载 MP4' : 'Download MP4' }}</a></p>
        </div>
        <div class="film-copy">
          <p class="film-eyebrow">{{ film.category }} <span>{{ film.time }}</span></p>
          <h3>{{ film.title }}</h3>
          <p class="film-description">{{ film.description }}</p>
          <p :id="`${film.id}-scope`" class="film-scope">{{ film.scope }}</p>
          <template v-if="!props.compact">
            <div class="film-actions">
              <a :href="film.evidence">{{ film.evidenceLabel }} ↗</a>
              <a :href="asset(film.id, 'mp4')" download>{{ chinese ? '下载 MP4' : 'Download MP4' }} ↓</a>
            </div>
            <details class="film-transcript">
              <summary>{{ chinese ? '阅读文字版' : 'Read the transcript' }}</summary>
              <p>{{ film.transcript }}</p>
            </details>
          </template>
        </div>
      </article>
    </div>
    <p class="film-language">{{ chinese ? '影片为英文画面文字与器乐配乐，无口播；播放器提供英文字幕，文字版附中文摘要。' : 'English on-screen text with an instrumental score, no voiceover. English captions and text transcripts are available.' }}</p>
  </section>
</template>

<style scoped>
.film-gallery { margin: 32px 0 48px; }
.film-section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; margin-bottom: 18px; }
.film-section-heading p { margin: 0; font-weight: 600; font-size: 16px; }
.film-section-heading a { font-size: 14px; }
.film-grid { display: grid; gap: 48px; }
.film { min-width: 0; scroll-margin-top: 110px; border-bottom: 1px solid var(--vp-c-divider); padding-bottom: 32px; }
.film-player { width: 100%; }
video { display: block; width: 100%; aspect-ratio: 16 / 9; background: #111b25; }
.film-poster-link { display: block; position: relative; overflow: hidden; }
.film-poster-link img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; }
.film-play { position: absolute; bottom: 12px; right: 12px; padding: 5px 12px; background: #111b25; color: #fff; font: 12px/24px var(--vp-font-family-mono); }
.film-copy { padding-top: 20px; }
.film-copy .film-eyebrow { display: flex; justify-content: space-between; gap: 12px; margin: 0 0 10px; font: 12px/1.6 var(--vp-font-family-mono); color: var(--vp-c-text-2); }
.film-copy h3 { margin: 0 0 12px; font-size: 26px; line-height: 1.25; letter-spacing: -.025em; }
.film-copy .film-description { margin: 0 0 12px; line-height: 1.7; }
.film-copy .film-scope { margin: 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.65; }
.film-actions { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 16px; }
.film-actions a { display: inline-flex; align-items: center; min-height: 48px; font-size: 14px; text-decoration: underline; text-underline-offset: 4px; }
.film-transcript { margin-top: 12px; font-size: 14px; }
.film-transcript summary { display: flex; align-items: center; min-height: 48px; cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
.film-transcript p { color: var(--vp-c-text-2); line-height: 1.8; }
.film-language { margin: 24px 0 0; font-size: 13px; color: var(--vp-c-text-2); }
.film-error { padding: 12px; border: 1px solid var(--vp-c-divider); }
.compact .film-copy h3 { font-size: 21px; }
.compact .film-description { font-size: 14px; }
.compact .film-grid { gap: 32px 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.compact .featured { grid-column: 1 / -1; }
.compact .film { padding-bottom: 24px; }
a:focus-visible, summary:focus-visible, video:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; border-radius: 0; }
@media (min-width: 960px) {
  .film-gallery:not(.compact) .film { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); align-items: start; gap: 36px; }
  .film-gallery:not(.compact) .film-copy { padding-top: 0; }
}
@media (max-width: 520px) {
  .compact .film-grid { grid-template-columns: 1fr; }
  .film-copy h3 { font-size: 23px; }
}
</style>

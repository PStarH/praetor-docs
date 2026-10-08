import { defineConfig, type DefaultTheme } from 'vitepress'

function prefix(locale: string, path: string) {
  return locale === 'en' ? path : `/${locale}${path}`
}

function theme(locale: string): DefaultTheme.Config {
  const link = (path: string) => prefix(locale, path)
  return {
    nav: [
      { text: 'Overview', link: link('/') },
      { text: 'Quick start', link: link('/getting-started') },
      { text: 'CLI', link: link('/cli') },
      { text: 'API', link: link('/api') },
      { text: 'MCP', link: link('/mcp') },
      { text: 'Security', link: link('/security') },
    ],
    sidebar: [
      {
        text: 'Get started',
        items: [
          { text: 'Overview', link: link('/') },
          { text: 'Quick start', link: link('/getting-started') },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI reference', link: link('/cli') },
          { text: 'HTTP API', link: link('/api') },
          { text: 'Configuration', link: link('/configuration') },
          { text: 'Tools', link: link('/tools') },
          { text: 'Providers', link: link('/providers') },
          { text: 'MCP', link: link('/mcp') },
          { text: 'Web console', link: link('/web-console') },
          { text: 'Packages and SDKs', link: link('/packages') },
          { text: 'SDK and API overview', link: link('/sdk') },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Architecture', link: link('/architecture') },
          { text: 'Workflows and automation', link: link('/workflows') },
        ],
      },
      {
        text: 'Run it',
        items: [
          { text: 'Deployment', link: link('/deployment') },
          { text: 'Operations and rollback', link: link('/operations') },
          { text: 'Troubleshooting', link: link('/troubleshooting') },
        ],
      },
      {
        text: 'Trust',
        items: [
          { text: 'Security and privacy', link: link('/security') },
          { text: 'Benchmarks', link: link('/benchmarks') },
          { text: 'Support and limits', link: link('/support') },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/PStarH/Praetor' }],
    editLink: {
      pattern: 'https://github.com/PStarH/praetor-docs/edit/master/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'MIT licensed.',
      copyright: 'Copyright 2026 Praetor Contributors',
    },
  }
}

function themeZh(): DefaultTheme.Config {
  const link = (path: string) => prefix('zh', path)
  return {
    nav: [
      { text: '概览', link: link('/') },
      { text: '快速入门', link: link('/getting-started') },
      { text: '命令行 (CLI)', link: link('/cli') },
      { text: 'HTTP API', link: link('/api') },
      { text: 'MCP 协议', link: link('/mcp') },
      { text: '安全合规', link: link('/security') },
    ],
    sidebar: [
      {
        text: '开始使用',
        items: [
          { text: '产品全貌概览', link: link('/') },
          { text: '快速入门指南', link: link('/getting-started') },
        ],
      },
      {
        text: '参考手册',
        items: [
          { text: 'CLI 命令行参考', link: link('/cli') },
          { text: 'HTTP API 接口', link: link('/api') },
          { text: '环境变量与配置', link: link('/configuration') },
          { text: '内置工具与权能分级', link: link('/tools') },
          { text: '模型供应商与容灾', link: link('/providers') },
          { text: 'MCP 协议支持', link: link('/mcp') },
          { text: 'Web 可视化控制台', link: link('/web-console') },
          { text: '模块包生态与架构', link: link('/packages') },
          { text: 'Python / TS SDK', link: link('/sdk') },
        ],
      },
      {
        text: '核心架构',
        items: [
          { text: '架构设计与 V2 控制面', link: link('/architecture') },
          { text: '工作流编排与拓扑', link: link('/workflows') },
        ],
      },
      {
        text: '部署运维',
        items: [
          { text: '生产部署方案', link: link('/deployment') },
          { text: '运维操作与事务回滚', link: link('/operations') },
          { text: '故障排查与诊断指南', link: link('/troubleshooting') },
        ],
      },
      {
        text: '信任与安全',
        items: [
          { text: '安全体系与隐私保护', link: link('/security') },
          { text: '性能基准与开销评测', link: link('/benchmarks') },
          { text: '支持策略与诚实边界', link: link('/support') },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/PStarH/Praetor' }],
    editLink: {
      pattern: 'https://github.com/PStarH/praetor-docs/edit/master/:path',
      text: '在 GitHub 上编辑此页',
    },
    lastUpdated: {
      text: '最后更新于',
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
    footer: {
      message: '采用 MIT 许可证开源。',
      copyright: '版权所有 © 2026 Praetor 贡献者',
    },
  }
}

export default defineConfig({
  title: 'Praetor',
  description: 'Approval and recovery for Coding and DevOps agents, starting with GitHub pull requests.',
  base: process.env.DOCS_BASE ?? '/praetor-docs/',
  cleanUrls: false,
  lastUpdated: true,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  sitemap: { hostname: 'https://pstarh.github.io/praetor-docs/' },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/praetor-docs/favicon.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Praetor Documentation' }],
    ['meta', { property: 'og:title', content: 'Praetor — Autonomous Agent Control Plane & Recovery Runtime' }],
    ['meta', { property: 'og:description', content: 'Approval, preflight idempotency, Ed25519 capability tokens, and sub-5s crash recovery for Coding and DevOps agents.' }],
    ['meta', { property: 'og:image', content: 'https://pstarh.github.io/praetor-docs/commander-preflight-protocol.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Praetor — Control Plane & Resilience Runtime for AI Agents' }],
    ['meta', { name: 'twitter:description', content: 'Stop AI agents from wrecking production: preflight idempotency, capability tokens, and crash recovery.' }],
    ['meta', { name: 'twitter:image', content: 'https://pstarh.github.io/praetor-docs/commander-preflight-protocol.png' }],
  ],
  themeConfig: theme('en'),
  locales: {
    root: { label: 'English', lang: 'en-US', themeConfig: theme('en') },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: themeZh(),
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      themeConfig: theme('ja'),
    },
    ko: {
      label: '한국어',
      lang: 'ko-KR',
      link: '/ko/',
      themeConfig: theme('ko'),
    },
    es: {
      label: 'Español',
      lang: 'es-ES',
      link: '/es/',
      themeConfig: theme('es'),
    },
    fr: {
      label: 'Français',
      lang: 'fr-FR',
      link: '/fr/',
      themeConfig: theme('fr'),
    },
  },
})

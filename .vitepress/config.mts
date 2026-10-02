import { defineConfig, type DefaultTheme } from 'vitepress'

const locales = ['zh', 'ja', 'ko', 'es', 'fr'] as const

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
    socialLinks: [{ icon: 'github', link: 'https://github.com/PStarH/Commander' }],
    editLink: {
      pattern: 'https://github.com/PStarH/commander-docs/edit/master/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'MIT licensed.',
      copyright: 'Copyright 2026 Commander Contributors',
    },
  }
}

export default defineConfig({
  title: 'Commander',
  description: 'Approval and recovery for Coding and DevOps agents, starting with GitHub pull requests.',
  base: '/commander-docs/',
  cleanUrls: false,
  lastUpdated: true,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  sitemap: { hostname: 'https://pstarh.github.io/commander-docs/' },
  themeConfig: theme('en'),
  locales: {
    root: { label: 'English', lang: 'en-US', themeConfig: theme('en') },
    ...Object.fromEntries(locales.map((locale) => [locale, {
      label: locale.toUpperCase(),
      lang: locale,
      link: `/${locale}/`,
      themeConfig: theme(locale),
    }])),
  },
})

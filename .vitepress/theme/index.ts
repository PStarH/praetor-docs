import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './style.css'
import FilmGallery from './FilmGallery.vue'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('FilmGallery', FilmGallery)
  },
} satisfies Theme

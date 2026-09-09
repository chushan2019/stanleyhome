// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages 项目站点：URL 为 https://chushan2019.github.io/stanleyhome/
// 本地 dev 时 Astro 会自动处理 base 前缀。
export default defineConfig({
  site: 'https://chushan2019.github.io',
  base: '/stanleyhome/',
  trailingSlash: 'never',
  output: 'static',
  integrations: [sitemap()],
});

---
filename: harness-motion-breakdown
title: 视频：12 分钟拆解一个优秀网站的全部动效
type: video
year: 2026
duration: '12:40'
cover: /covers/cover-video.svg
external: https://www.bilibili.com/
summary: 对着浏览器的 DevTools，把一个深色玻璃风格网站的动效逐条拆出来：入场、旋转描边、滚动显现、箭头划过——然后全部用 CSS 复现一遍。
featured: false
order: 0
---

## 内容概要

这个视频是我做个人网站时的副产品：既然已经把目标网站的 CSS 逐条分析了一遍，不如录下来。

四段拆解：

1. **入场动效**：`opacity + translateY + filter:blur` 三件套，以及为什么「去模糊」比「淡入」更抓眼球；
2. **旋转描边**：`@property` 注册角度 + conic-gradient + mask 挖空，整个技巧只需要 15 行 CSS；
3. **滚动显现**：一个 30 行的 IntersectionObserver 脚本，配合负 rootMargin 让元素「露头再出现」；
4. **箭头划过**：hover 时的 micro-interaction，keyframes 只有三个 stop。

## 说明

视频里复现的所有代码都放在本站的开源仓库里，可以直接拿去用。

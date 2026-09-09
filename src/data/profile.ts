/**
 * 个人信息 —— 想换简历内容，只改这个文件即可。
 */
export const profile = {
  name: 'Stanley',
  nick: '初山',
  tagline: '把读过的书、做过的东西、听过的声音，放在一起。',
  intro:
    '你好，我是 Stanley，网名初山。这里是我的个人网站：作品集收录我的图文、音频与视频创作，读书笔记记录我读过的书，博客写下 Longer-form 的思考，关于我一页是可直接传阅的简历。',
  email: 'hello@chushan.dev', // TODO: 换成你的真实邮箱
  socials: [
    { label: 'GitHub', href: 'https://github.com/chushan2019' },
    { label: '邮箱', href: 'mailto:hello@chushan.dev' },
  ],
  /** 经历时间线（简历主体）——示例数据，替换成你的真实经历 */
  timeline: [
    {
      period: '2024 — 至今',
      title: '内容创作与个人站点',
      org: '独立',
      desc: '持续写作读书笔记与长文，尝试音频、视频等多媒介表达；本站即是我用 AI 辅助设计与开发的第一个作品。',
    },
    {
      period: '2021 — 2024',
      title: '产品与增长（示例经历）',
      org: '某某公司',
      desc: '负责产品的内容生态与用户增长，主导过三次从 0 到 1 的项目。',
    },
    {
      period: '2017 — 2021',
      title: '大学 · 专业示例',
      org: '某某大学',
      desc: '开始写博客、做播客，养成了读书笔记的习惯。',
    },
  ],
  /** 技能/兴趣标签 */
  skills: ['写作', '读书笔记', '播客', '视频剪辑', 'AI 工具链', 'Astro', '前端设计'],
} as const;

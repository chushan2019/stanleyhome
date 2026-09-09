import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 作品集：图文 / 音频 / 视频，type 用英文 key，展示名在 UI 层映射 */
const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['text', 'audio', 'video']),
    year: z.number().optional(),
    cover: z.string().optional(),
    /** 音频/视频站外地址（B站、小宇宙、YouTube…），有则详情页给外链按钮 */
    external: z.string().url().optional(),
    duration: z.string().optional(),
    summary: z.string(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

/** 读书笔记：结构兼容 book-reading-notes skill 的产出（总结/金句/摘录） */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    book: z.string(),
    author: z.string(),
    status: z.enum(['done', 'reading']).default('done'),
    doneDate: z.string().optional(),
    cover: z.string().optional(),
    summary: z.string(),
    quotes: z.array(z.string()).default([]),
  }),
});

/** 博客长文 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { works, notes, posts };

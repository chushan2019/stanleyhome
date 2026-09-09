/**
 * 给站内路径加上部署 base 前缀（GitHub Pages 子路径必需）。
 * BASE_URL 形如 '/stanleyhome/'（本地为 '/'）。
 */
const base = import.meta.env.BASE_URL ?? '/';

export function withBase(path: string): string {
  const joined = (base + path).replace(/\/{2,}/g, '/');
  // 去掉末尾斜杠（首页保留 '/'）
  return joined.length > 1 ? joined.replace(/\/$/, '') : '/';
}

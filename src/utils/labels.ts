export const workTypeLabel: Record<'text' | 'audio' | 'video', string> = {
  text: '图文',
  audio: '音频',
  video: '视频',
};

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

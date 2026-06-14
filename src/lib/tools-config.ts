export type ToolType =
  | 'resize'
  | 'crop'
  | 'rotate'
  | 'effects'
  | 'speed'
  | 'reverse'
  | 'optimize'
  | 'cut'
  | 'split'
  | 'add-text'
  | 'make-gif'
  | 'video-to-gif'
  | 'convert'

export interface ToolConfig {
  id: ToolType
  name: string
  description: string
  icon: string
  acceptTypes: string
  color: string
}

export const tools: ToolConfig[] = [
  {
    id: 'make-gif',
    name: 'GIF Maker',
    description: 'Создание GIF из нескольких изображений',
    icon: '🖼️',
    acceptTypes: 'image/*',
    color: 'bg-emerald-500',
  },
  {
    id: 'video-to-gif',
    name: 'Video → GIF',
    description: 'Конвертация видео в GIF-анимацию',
    icon: '🎬',
    acceptTypes: 'video/*',
    color: 'bg-purple-500',
  },
  {
    id: 'resize',
    name: 'Ресайз',
    description: 'Изменение размера GIF-анимации',
    icon: '↔️',
    acceptTypes: 'image/gif',
    color: 'bg-sky-500',
  },
  {
    id: 'crop',
    name: 'Обрезка',
    description: 'Обрезка GIF по выбранной области',
    icon: '✂️',
    acceptTypes: 'image/gif',
    color: 'bg-amber-500',
  },
  {
    id: 'rotate',
    name: 'Поворот',
    description: 'Поворот GIF на любой угол',
    icon: '🔄',
    acceptTypes: 'image/gif',
    color: 'bg-rose-500',
  },
  {
    id: 'effects',
    name: 'Эффекты',
    description: 'Применение фильтров и эффектов к GIF',
    icon: '✨',
    acceptTypes: 'image/gif',
    color: 'bg-indigo-500',
  },
  {
    id: 'speed',
    name: 'Скорость',
    description: 'Изменение скорости GIF-анимации',
    icon: '⚡',
    acceptTypes: 'image/gif',
    color: 'bg-yellow-500',
  },
  {
    id: 'reverse',
    name: 'Реверс',
    description: 'Воспроизведение GIF в обратном порядке',
    icon: '⏪',
    acceptTypes: 'image/gif',
    color: 'bg-teal-500',
  },
  {
    id: 'optimize',
    name: 'Оптимизация',
    description: 'Уменьшение размера GIF-файла',
    icon: '📉',
    acceptTypes: 'image/gif',
    color: 'bg-green-500',
  },
  {
    id: 'cut',
    name: 'Нарезка',
    description: 'Обрезка GIF по кадрам (выбор диапазона)',
    icon: '🔪',
    acceptTypes: 'image/gif',
    color: 'bg-orange-500',
  },
  {
    id: 'split',
    name: 'Разделение',
    description: 'Разделение GIF на отдельные кадры (PNG)',
    icon: '📋',
    acceptTypes: 'image/gif',
    color: 'bg-cyan-500',
  },
  {
    id: 'add-text',
    name: 'Добавить текст',
    description: 'Наложение текста на GIF-анимацию',
    icon: '📝',
    acceptTypes: 'image/gif',
    color: 'bg-pink-500',
  },
  {
    id: 'convert',
    name: 'Конвертация',
    description: 'GIF → MP4/WebM, GIF → APNG, изображение → формат',
    icon: '🔀',
    acceptTypes: 'image/gif,image/png,image/jpeg,image/webp,image/bmp,video/mp4,video/webm',
    color: 'bg-violet-500',
  },
]

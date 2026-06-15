'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Download,
  Upload,
  Loader2,
  Image as ImageIcon,
  Film,
  Maximize2,
  Crop,
  RotateCw,
  Sparkles,
  Gauge,
  Rewind,
  TrendingDown,
  Scissors,
  LayoutGrid,
  Type,
  Zap,
  ArrowRightLeft,
  Eraser,
} from 'lucide-react'
import { tools, type ToolType, type ToolConfig } from '@/lib/tools-config'

// ==================== TOOL ICONS ====================
const toolIcons: Record<ToolType, React.ReactNode> = {
  'make-gif': <ImageIcon className="h-5 w-5" />,
  'video-to-gif': <Film className="h-5 w-5" />,
  'resize': <Maximize2 className="h-5 w-5" />,
  'crop': <Crop className="h-5 w-5" />,
  'rotate': <RotateCw className="h-5 w-5" />,
  'effects': <Sparkles className="h-5 w-5" />,
  'speed': <Gauge className="h-5 w-5" />,
  'reverse': <Rewind className="h-5 w-5" />,
  'optimize': <TrendingDown className="h-5 w-5" />,
  'cut': <Scissors className="h-5 w-5" />,
  'split': <LayoutGrid className="h-5 w-5" />,
  'add-text': <Type className="h-5 w-5" />,
  'convert': <ArrowRightLeft className="h-5 w-5" />,
  'remove-bg': <Eraser className="h-5 w-5" />,
}

const toolColors: Record<ToolType, string> = {
  'make-gif': 'from-emerald-500 to-emerald-600',
  'video-to-gif': 'from-purple-500 to-purple-600',
  'resize': 'from-sky-500 to-sky-600',
  'crop': 'from-amber-500 to-amber-600',
  'rotate': 'from-rose-500 to-rose-600',
  'effects': 'from-indigo-500 to-indigo-600',
  'speed': 'from-yellow-500 to-yellow-600',
  'reverse': 'from-teal-500 to-teal-600',
  'optimize': 'from-green-500 to-green-600',
  'cut': 'from-orange-500 to-orange-600',
  'split': 'from-cyan-500 to-cyan-600',
  'add-text': 'from-pink-500 to-pink-600',
  'convert': 'from-violet-500 to-violet-600',
  'remove-bg': 'from-fuchsia-500 to-fuchsia-600',
}

// ==================== TEXT PREVIEW SVG ====================
function textSvg(width: number, height: number, text: string, fontSize: number, color: string, x: number, y: number, stroke: string, sw: number): string {
  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<svg width="${width}" height="${height}"><text x="${x}" y="${y + fontSize}" font-size="${fontSize}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" font-family="Arial, Helvetica, sans-serif">${safeText}</text></svg>`
}

// ==================== FILE SIZE FORMATTER ====================
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ==================== MAIN PAGE ====================
export default function Home() {
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadMeta, setUploadMeta] = useState<any>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [outputSize, setOutputSize] = useState<number>(0)
  const [outputFilename, setOutputFilename] = useState<string>('result.gif')
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Multi-file state for GIF Maker
  const [makeGifFiles, setMakeGifFiles] = useState<File[]>([])
  const [makeGifPreviews, setMakeGifPreviews] = useState<string[]>([])
  const makeGifInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/gif/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
        return
      }
      setUploadMeta(data)
    } catch (err: any) {
      toast({ title: 'Ошибка загрузки', description: err.message, variant: 'destructive' })
    }
  }

  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file)
    setOutputUrl(null)
    setOutputSize(0)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    uploadFile(file)
  }, [uploadFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const processGif = async (endpoint: string, body: any) => {
    setProcessing(true)
    setOutputUrl(null)
    try {
      const res = await fetch(`/api/gif/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Ошибка обработки' }))
        throw new Error(data.error || 'Ошибка обработки')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setOutputUrl(url)
      setOutputSize(Number(res.headers.get('X-Output-Size') || blob.size))
      const cd = res.headers.get('Content-Disposition')
      if (cd) {
        const match = cd.match(/filename="?(.+?)"?$/)
        if (match) setOutputFilename(match[1])
      }
      const outputPath = res.headers.get('X-Output-Path')
      if (outputPath) {
        setUploadMeta(prev => prev && { ...prev, inputPath: outputPath })
      }
      toast({ title: 'Готово!', description: 'GIF успешно обработан' })
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const processWithFormData = async (endpoint: string, formData: FormData) => {
    setProcessing(true)
    setOutputUrl(null)
    try {
      const res = await fetch(`/api/gif/${endpoint}`, {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Ошибка обработки' }))
        throw new Error(data.error || 'Ошибка обработки')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setOutputUrl(url)
      setOutputSize(Number(res.headers.get('X-Output-Size') || blob.size))
      const cd = res.headers.get('Content-Disposition')
      if (cd) {
        const match = cd.match(/filename="?(.+?)"?$/)
        if (match) setOutputFilename(match[1])
      }
      const outputPath = res.headers.get('X-Output-Path')
      if (outputPath) {
        setUploadMeta(prev => prev && { ...prev, inputPath: outputPath })
      }
      toast({ title: 'Готово!', description: 'GIF успешно создан' })
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const downloadResult = () => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = outputFilename
    a.click()
  }

  const resetAll = () => {
    setSelectedTool(null)
    setUploadedFile(null)
    setPreviewUrl(null)
    setUploadMeta(null)
    setOutputUrl(null)
    setOutputSize(0)
    setProcessing(false)
    setMakeGifFiles([])
    setMakeGifPreviews([])
  }

  const goBack = () => {
    setSelectedTool(null)
    setUploadedFile(null)
    setPreviewUrl(null)
    setUploadMeta(null)
    setOutputUrl(null)
    setOutputSize(0)
    setMakeGifFiles([])
    setMakeGifPreviews([])
  }

  const acceptTypes = selectedTool ? tools.find(t => t.id === selectedTool)?.acceptTypes || 'image/gif' : 'image/gif'
  const currentTool = tools.find(t => t.id === selectedTool)

  // ==================== RENDER: HOME PAGE ====================
  if (!selectedTool) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo-gif.png" alt="GIF Tools" className="h-8 w-8 rounded-lg" />
              <h1 className="text-2xl font-bold tracking-tight">GIF Tools</h1>
            </div>
            <Badge variant="secondary" className="ml-2">14 инструментов</Badge>
            <div className="ml-auto text-sm text-muted-foreground hidden sm:block">
Бесплатный редактор GIF
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Редактор GIF-анимаций</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
Создавайте, редактируйте и оптимизируйте GIF-анимации. 
               Загрузите файл и выберите нужный инструмент.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tools.map((tool) => (
              <Card
                key={tool.id}
                className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/30"
                onClick={() => setSelectedTool(tool.id)}
              >
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${toolColors[tool.id]} flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform`}>
                    {toolIcons[tool.id]}
                  </div>
                  <CardTitle className="text-lg">{tool.name}</CardTitle>
                  <CardDescription className="text-sm">{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </main>

        <footer className="border-t bg-background mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
            GIF Tools — Бесплатный редактор GIF-анимаций
          </div>
        </footer>
      </div>
    )
  }

  // ==================== RENDER: GIF MAKER ====================
  if (selectedTool === 'make-gif') {
    return (
      <MakeGifView
        files={makeGifFiles}
        previews={makeGifPreviews}
        inputRef={makeGifInputRef}
        setFiles={setMakeGifFiles}
        setPreviews={setMakeGifPreviews}
        processing={processing}
        outputUrl={outputUrl}
        outputSize={outputSize}
        onProcess={processWithFormData}
        onDownload={downloadResult}
        onBack={goBack}
      />
    )
  }

  // ==================== RENDER: VIDEO TO GIF ====================
  if (selectedTool === 'video-to-gif') {
    return (
      <VideoToGifView
        processing={processing}
        outputUrl={outputUrl}
        outputSize={outputSize}
        onProcess={processWithFormData}
        onDownload={downloadResult}
        onBack={goBack}
      />
    )
  }

  // ==================== RENDER: CONVERT ====================
  if (selectedTool === 'convert') {
    return (
      <ConvertView
        processing={processing}
        outputUrl={outputUrl}
        outputSize={outputSize}
        onProcess={processWithFormData}
        onDownload={downloadResult}
        onBack={goBack}
      />
    )
  }

  // ==================== RENDER: REMOVE BG ====================
  if (selectedTool === 'remove-bg') {
    return (
      <RemoveBgView
        processing={processing}
        outputUrl={outputUrl}
        outputSize={outputSize}
        onProcess={processWithFormData}
        onDownload={downloadResult}
        onBack={goBack}
      />
    )
  }

  // ==================== RENDER: SPLIT TOOL ====================
  if (selectedTool === 'split') {
    return (
      <SplitView
        file={uploadedFile}
        previewUrl={previewUrl}
        uploadMeta={uploadMeta}
        processing={processing}
        onFileSelect={handleFileSelect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        dragOver={dragOver}
        fileInputRef={fileInputRef}
        acceptTypes={acceptTypes}
        onProcess={processGif}
        onBack={goBack}
      />
    )
  }

  // ==================== RENDER: STANDARD TOOL ====================
  return (
    <StandardToolView
      tool={currentTool!}
      file={uploadedFile}
      previewUrl={previewUrl}
      uploadMeta={uploadMeta}
      processing={processing}
      outputUrl={outputUrl}
      outputSize={outputSize}
      showOriginal={showOriginal}
      onShowOriginalChange={setShowOriginal}
      onFileSelect={handleFileSelect}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      dragOver={dragOver}
      fileInputRef={fileInputRef}
      acceptTypes={acceptTypes}
      onProcess={processGif}
      onProcessFormData={processWithFormData}
      onResetOutput={() => { setOutputUrl(null); setOutputSize(0); setOutputFilename('result.gif') }}
      onDownload={downloadResult}
      onBack={goBack}
    />
  )
}

// ==================== UPLOAD AREA COMPONENT ====================
function UploadArea({
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  dragOver,
  fileInputRef,
  acceptTypes,
  currentFile,
}: {
  onFileSelect: (file: File) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  dragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  acceptTypes: string
  currentFile?: File | null
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
        ${dragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
        }}
      />
      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-lg font-medium mb-1">
        {currentFile ? currentFile.name : 'Перетащите файл сюда или нажмите для выбора'}
      </p>
      <p className="text-sm text-muted-foreground">
        Поддерживаются GIF, PNG, JPG, MP4, WebM
      </p>
    </div>
  )
}

// ==================== STANDARD TOOL VIEW ====================
function StandardToolView({
  tool,
  file,
  previewUrl,
  uploadMeta,
  processing,
  outputUrl,
  outputSize,
  showOriginal,
  onShowOriginalChange,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  dragOver,
  fileInputRef,
  acceptTypes,
  onProcess,
  onProcessFormData,
  onResetOutput,
  onDownload,
  onBack,
}: {
  tool: ToolConfig
  file: File | null
  previewUrl: string | null
  uploadMeta: any
  processing: boolean
  outputUrl: string | null
  outputSize: number
  showOriginal: boolean
  onShowOriginalChange: (v: boolean) => void
  onFileSelect: (file: File) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  dragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  acceptTypes: string
  onProcess: (endpoint: string, body: any) => void
  onProcessFormData: (endpoint: string, formData: FormData) => void
  onResetOutput: () => void
  onDownload: () => void
  onBack: () => void
}) {
  const [resizeWidth, setResizeWidth] = useState(200)
  const [resizeHeight, setResizeHeight] = useState(0)
  const [maintainAspect, setMaintainAspect] = useState(true)
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [cropW, setCropW] = useState(0)
  const [cropH, setCropH] = useState(0)
  const [cropShape, setCropShape] = useState<'free' | 'square'>('free')
  const [cropHasSelection, setCropHasSelection] = useState(false)
  const [cropVisible, setCropVisible] = useState(false)
  const cropDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; mode: string } | null>(null)
  const previewImgRef = useRef<HTMLImageElement>(null)
  const [rotateAngle, setRotateAngle] = useState(90)
  const [effect, setEffect] = useState('grayscale')
  const [speedMultiplier, setSpeedMultiplier] = useState(2)
  const [optimizeColors, setOptimizeColors] = useState(128)
  const [cutStart, setCutStart] = useState(0)
  const [cutEnd, setCutEnd] = useState(0)
  const [addText, setAddTextText] = useState('')
  const [addTextFontSize, setAddTextFontSize] = useState(32)
  const [addTextColor, setAddTextColor] = useState('#ffffff')
  const [addTextX, setAddTextX] = useState(10)
  const [addTextY, setAddTextY] = useState(30)
  const [addTextStroke, setAddTextStroke] = useState('#000000')
  const [textPlaced, setTextPlaced] = useState(false)
  const textDragRef = useRef<{ mode: string; startX: number; startY: number; origX: number; origY: number; origSize: number } | null>(null)

  const handleTextImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (tool?.id !== 'add-text') return
    const img = e.currentTarget
    const rect = img.getBoundingClientRect()
    const sx = (img.naturalWidth || 1) / rect.width
    const sy = (img.naturalHeight || 1) / rect.height
    const mx = (e.clientX - rect.left) * sx
    const my = (e.clientY - rect.top) * sy
    setAddTextX(Math.round(mx))
    setAddTextY(Math.round(my))
    if (addText) setTextPlaced(true)
  }

  const handleTextMouseDown = (e: React.MouseEvent) => {
    if (!textPlaced || !addText) return
    e.preventDefault()
    e.stopPropagation()
    textDragRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, origX: addTextX, origY: addTextY, origSize: addTextFontSize }
    const onMove = (ev: globalThis.MouseEvent) => {
      if (!textDragRef.current) return
      const dx = (ev.clientX - textDragRef.current.startX) / ((previewImgRef.current?.getBoundingClientRect().width || 1) / (previewImgRef.current?.naturalWidth || 1))
      const dy = (ev.clientY - textDragRef.current.startY) / ((previewImgRef.current?.getBoundingClientRect().height || 1) / (previewImgRef.current?.naturalHeight || 1))
      setAddTextX(Math.round(Math.max(0, textDragRef.current.origX + dx)))
      setAddTextY(Math.round(Math.max(0, textDragRef.current.origY + dy)))
    }
    const onUp = () => {
      textDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleTextCornerDown = (e: React.MouseEvent, corner: string) => {
    if (!textPlaced || !addText) return
    e.preventDefault()
    e.stopPropagation()
    textDragRef.current = { mode: corner, startX: e.clientX, startY: e.clientY, origX: addTextX, origY: addTextY, origSize: addTextFontSize }
    const onMove = (ev: globalThis.MouseEvent) => {
      if (!textDragRef.current) return
      const img = previewImgRef.current
      if (!img) return
      const rect = img.getBoundingClientRect()
      const sx = (img.naturalWidth || 1) / rect.width
      const dx = (ev.clientX - textDragRef.current.startX) * sx
      const newSize = Math.max(8, Math.min(200, textDragRef.current.origSize + dx))
      setAddTextFontSize(Math.round(newSize))
    }
    const onUp = () => {
      textDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const [textScale, setTextScale] = useState(1)
  const textContainerRef = useRef<HTMLDivElement>(null)

  const recalcTextScale = useCallback(() => {
    const img = previewImgRef.current
    if (img) {
      setTextScale(img.getBoundingClientRect().width / (img.naturalWidth || 1))
    }
  }, [])

  useEffect(() => { recalcTextScale() }, [recalcTextScale])
  useEffect(() => {
    if (tool?.id !== 'add-text') return
    const onResize = () => recalcTextScale()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tool?.id, recalcTextScale])

  const resetCropToFull = () => {
    setCropX(0); setCropY(0); setCropW(0); setCropH(0)
    setCropHasSelection(false)
    setCropVisible(false)
  }

  const [cropOverlayStyle, setCropOverlayStyle] = useState<React.CSSProperties>({ display: 'none' })

  const updateCropOverlay = useCallback(() => {
    if (!cropVisible || !cropW || !cropH || !previewImgRef.current) {
      setCropOverlayStyle({ display: 'none' })
      return
    }
    const img = previewImgRef.current
    const rect = img.getBoundingClientRect()
    const sx = rect.width / (img.naturalWidth || 1)
    const sy = rect.height / (img.naturalHeight || 1)
    setCropOverlayStyle({
      display: 'block',
      position: 'absolute',
      left: `${cropX * sx}px`,
      top: `${cropY * sy}px`,
      width: `${cropW * sx}px`,
      height: `${cropH * sy}px`,
    })
  }, [cropVisible, cropX, cropY, cropW, cropH])

  useEffect(() => { updateCropOverlay() }, [updateCropOverlay])

  useEffect(() => {
    if (tool?.id !== 'crop') return
    const onResize = () => updateCropOverlay()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tool?.id, updateCropOverlay])

  const handleCropMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (tool?.id !== 'crop') return
    const img = previewImgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const sx = (img.naturalWidth || 1) / rect.width
    const sy = (img.naturalHeight || 1) / rect.height
    const mx = (e.clientX - rect.left) * sx
    const my = (e.clientY - rect.top) * sy

    if (cropHasSelection && cropW > 0 && cropH > 0) {
      const dx = e.clientX - rect.left
      const dy = e.clientY - rect.top
      const corners = [
        { id: 'tl', x: cropX / sx, y: cropY / sy },
        { id: 'tr', x: (cropX + cropW) / sx, y: cropY / sy },
        { id: 'bl', x: cropX / sx, y: (cropY + cropH) / sy },
        { id: 'br', x: (cropX + cropW) / sx, y: (cropY + cropH) / sy },
      ]
      for (const c of corners) {
        if (Math.abs(dx - c.x) < 14 && Math.abs(dy - c.y) < 14) {
          cropDragRef.current = { startX: mx, startY: my, origX: cropX, origY: cropY, origW: cropW, origH: cropH, mode: c.id }
          e.preventDefault()
          return
        }
      }
      if (dx >= cropX / sx && dx <= (cropX + cropW) / sx && dy >= cropY / sy && dy <= (cropY + cropH) / sy) {
        cropDragRef.current = { startX: mx, startY: my, origX: cropX, origY: cropY, origW: cropW, origH: cropH, mode: 'move' }
        e.preventDefault()
        return
      }
    }

    const ix = Math.round(mx)
    const iy = Math.round(my)
    setCropX(ix)
    setCropY(iy)
    setCropW(0)
    setCropH(0)
    setCropHasSelection(false)
    setCropVisible(true)
    cropDragRef.current = { startX: mx, startY: my, origX: ix, origY: iy, origW: 0, origH: 0, mode: 'create' }
    e.preventDefault()
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const drag = cropDragRef.current
    const img = previewImgRef.current
    if (!drag || !img) return
    const rect = img.getBoundingClientRect()
    const sx = (img.naturalWidth || 1) / rect.width
    const sy = (img.naturalHeight || 1) / rect.height
    const mx = (e.clientX - rect.left) * sx
    const my = (e.clientY - rect.top) * sy
    const maxW = uploadMeta?.width || (img.naturalWidth || 9999)
    const maxH = uploadMeta?.height || (img.naturalHeight || 9999)

    if (drag.mode === 'create') {
      let x1 = Math.max(0, Math.min(drag.startX, mx))
      let y1 = Math.max(0, Math.min(drag.startY, my))
      let w = Math.abs(mx - drag.startX)
      let h = Math.abs(my - drag.startY)
      if (cropShape === 'square') { const s = Math.max(w, h); w = s; h = s; if (mx < drag.startX) x1 = drag.startX - s; if (my < drag.startY) y1 = drag.startY - s }
      x1 = Math.max(0, x1); y1 = Math.max(0, y1)
      w = Math.min(w, maxW - x1); h = Math.min(h, maxH - y1)
      setCropX(Math.round(x1)); setCropY(Math.round(y1)); setCropW(Math.round(w)); setCropH(Math.round(h))
    } else if (drag.mode === 'move') {
      const dx = mx - drag.startX
      const dy = my - drag.startY
      let nx = Math.max(0, Math.min(maxW - drag.origW, drag.origX + dx))
      let ny = Math.max(0, Math.min(maxH - drag.origH, drag.origY + dy))
      setCropX(Math.round(nx)); setCropY(Math.round(ny))
    } else {
      const dx = mx - drag.startX
      const dy = my - drag.startY
      let nx = drag.origX, ny = drag.origY, nw = drag.origW, nh = drag.origH
      if (drag.mode === 'br') { nw = Math.max(20, drag.origW + dx); nh = Math.max(20, drag.origH + dy) }
      else if (drag.mode === 'tr') { nw = Math.max(20, drag.origW + dx); nh = Math.max(20, drag.origH - dy); ny = drag.origY + drag.origH - nh }
      else if (drag.mode === 'bl') { nw = Math.max(20, drag.origW - dx); nh = Math.max(20, drag.origH + dy); nx = drag.origX + drag.origW - nw }
      else if (drag.mode === 'tl') { nw = Math.max(20, drag.origW - dx); nh = Math.max(20, drag.origH - dy); nx = drag.origX + drag.origW - nw; ny = drag.origY + drag.origH - nh }
      if (cropShape === 'square') { const s = Math.max(nw, nh); nw = s; nh = s }
      nx = Math.max(0, nx); ny = Math.max(0, ny)
      nw = Math.min(nw, maxW - nx); nh = Math.min(nh, maxH - ny)
      setCropX(Math.round(nx)); setCropY(Math.round(ny)); setCropW(Math.round(nw)); setCropH(Math.round(nh))
    }
  }

  const handleCropMouseUp = () => {
    if (cropDragRef.current) {
      cropDragRef.current = null
      setCropHasSelection(cropW > 0 && cropH > 0)
    }
  }

  const handleProcess = () => {
    if (!uploadMeta?.inputPath) return

    switch (tool.id) {
      case 'resize':
        onProcess('resize', {
          inputPath: uploadMeta.inputPath,
          width: resizeWidth,
          height: resizeHeight || undefined,
          maintainAspect,
        })
        break
      case 'crop':
        onProcess('crop', {
          inputPath: uploadMeta.inputPath,
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH,
        })
        break
      case 'rotate':
        onProcess('rotate', {
          inputPath: uploadMeta.inputPath,
          angle: rotateAngle,
        })
        break
      case 'effects':
        onProcess('effects', {
          inputPath: uploadMeta.inputPath,
          effect,
        })
        break
      case 'speed':
        onProcess('speed', {
          inputPath: uploadMeta.inputPath,
          speedMultiplier,
        })
        break
      case 'reverse':
        onProcess('reverse', {
          inputPath: uploadMeta.inputPath,
        })
        break
      case 'optimize':
        onProcess('optimize', {
          inputPath: uploadMeta.inputPath,
          colors: optimizeColors,
        })
        break
      case 'cut':
        onProcess('cut', {
          inputPath: uploadMeta.inputPath,
          startFrame: cutStart,
          endFrame: cutEnd,
        })
        break
      case 'add-text':
        onProcess('add-text', {
          inputPath: uploadMeta.inputPath,
          text: addText,
          fontSize: addTextFontSize,
          fontColor: addTextColor,
          positionX: addTextX,
          positionY: addTextY,
          strokeColor: addTextStroke,
          strokeWidth: 2,
        })
        break
    }
  }

  // Initialize cut end to last frame
  if (tool.id === 'cut' && uploadMeta && cutEnd === 0) {
    setCutEnd(uploadMeta.pages - 1)
  }

  // Initialize crop/resize dimensions from upload metadata
  if (uploadMeta && resizeWidth === 200 && uploadMeta.width) {
    setResizeWidth(uploadMeta.width)
    setResizeHeight(uploadMeta.height)
    setCropW(uploadMeta.width)
    setCropH(uploadMeta.height)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${toolColors[tool.id]} flex items-center justify-center text-white`}>
            {toolIcons[tool.id]}
          </div>
          <h1 className="text-lg font-semibold">{tool.name}</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        {!file ? (
          <UploadArea
            onFileSelect={onFileSelect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            dragOver={dragOver}
            fileInputRef={fileInputRef}
            acceptTypes={acceptTypes}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Options */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Исходный файл</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Файл:</span>
                    <span className="font-medium truncate ml-2">{file.name}</span>
                  </div>
                  {uploadMeta && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Размер:</span>
                        <span className="font-medium">{uploadMeta.width}×{uploadMeta.height}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Кадры:</span>
                        <span className="font-medium">{uploadMeta.pages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Объём:</span>
                        <span className="font-medium">{formatFileSize(uploadMeta.inputSize)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Настройки</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* RESIZE OPTIONS */}
                  {tool.id === 'resize' && (
                    <>
                      <div className="space-y-2">
                        <Label>Ширина (px)</Label>
                        <Input type="number" value={resizeWidth} onChange={e => setResizeWidth(Number(e.target.value))} min={1} max={5000} />
                      </div>
                      <div className="space-y-2">
                        <Label>Высота (px)</Label>
                        <Input type="number" value={resizeHeight} onChange={e => setResizeHeight(Number(e.target.value))} min={1} max={5000} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={maintainAspect} onCheckedChange={setMaintainAspect} />
                        <Label>Сохранить пропорции</Label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[50, 75, 125, 150, 200].map(pct => (
                          <Button key={pct} variant="outline" size="sm" onClick={() => {
                            if (uploadMeta) {
                              setResizeWidth(Math.round(uploadMeta.width * pct / 100))
                              setResizeHeight(Math.round(uploadMeta.height * pct / 100))
                            }
                          }}>
                            {pct}%
                          </Button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* CROP OPTIONS */}
                  {tool.id === 'crop' && (
                    <>
                      <div className="space-y-2">
                        <Label>Форма обрезки</Label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCropShape('free')}
                            className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-colors ${cropShape === 'free' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                          >
                            Прямоугольная
                          </button>
                          <button
                            onClick={() => setCropShape('square')}
                            className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-colors ${cropShape === 'square' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                          >
                            Квадрат
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cropHasSelection ? 'Перетаскивайте область или тяните за уголки' : 'Нажмите и тяните на превью чтобы выбрать область'}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>X (px)</Label>
                          <Input type="number" value={cropX} onChange={e => setCropX(Math.max(0, Number(e.target.value)))} min={0} />
                        </div>
                        <div className="space-y-2">
                          <Label>Y (px)</Label>
                          <Input type="number" value={cropY} onChange={e => setCropY(Math.max(0, Number(e.target.value)))} min={0} />
                        </div>
                        <div className="space-y-2">
                          <Label>Ширина (px)</Label>
                          <Input type="number" value={cropW} onChange={e => setCropW(Math.max(1, Number(e.target.value)))} min={1} />
                        </div>
                        <div className="space-y-2">
                          <Label>Высота (px)</Label>
                          <Input type="number" value={cropH} onChange={e => setCropH(Math.max(1, Number(e.target.value)))} min={1} />
                        </div>
                      </div>
                      {uploadMeta && (
                        <p className="text-xs text-muted-foreground">
                          Изображение: {uploadMeta.width}×{uploadMeta.height}px
                        </p>
                      )}
                    </>
                  )}

                  {/* ROTATE OPTIONS */}
                  {tool.id === 'rotate' && (
                    <div className="space-y-3">
                      <Label>Угол поворота</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {[90, 180, 270].map(angle => (
                          <Button
                            key={angle}
                            variant={rotateAngle === angle ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setRotateAngle(angle)}
                          >
                            {angle}°
                          </Button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <Label>Произвольный угол</Label>
                        <Input
                          type="number"
                          value={rotateAngle}
                          onChange={e => setRotateAngle(Number(e.target.value))}
                          min={0}
                          max={360}
                        />
                      </div>
                    </div>
                  )}

                  {/* EFFECTS OPTIONS */}
                  {tool.id === 'effects' && (
                    <div className="space-y-3">
                      <Label>Выберите эффект</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'grayscale', label: 'Ч/Б' },
                          { id: 'sepia', label: 'Сепия' },
                          { id: 'blur', label: 'Размытие' },
                          { id: 'sharpen', label: 'Резкость' },
                          { id: 'negate', label: 'Негатив' },
                          { id: 'normalize', label: 'Нормализация' },
                          { id: 'brightness', label: 'Яркость +' },
                          { id: 'darken', label: 'Темнее' },
                          { id: 'saturate', label: 'Насыщеннее' },
                          { id: 'desaturate', label: 'Блеклее' },
                          { id: 'contrast', label: 'Контраст' },
                          { id: 'vintage', label: 'Винтаж' },
                          { id: 'cool', label: 'Холодный' },
                          { id: 'warm', label: 'Тёплый' },
                        ].map(eff => (
                          <Button
                            key={eff.id}
                            variant={effect === eff.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEffect(eff.id)}
                          >
                            {eff.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SPEED OPTIONS */}
                  {tool.id === 'speed' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Множитель скорости</Label>
                          <span className="text-sm font-medium">{speedMultiplier}x</span>
                        </div>
                        <Slider
                          value={[speedMultiplier]}
                          onValueChange={([v]) => setSpeedMultiplier(v)}
                          min={0.25}
                          max={5}
                          step={0.25}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[0.5, 1.5, 2, 3].map(sp => (
                          <Button
                            key={sp}
                            variant={speedMultiplier === sp ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSpeedMultiplier(sp)}
                          >
                            {sp}x
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {speedMultiplier > 1 ? 'Ускорение' : speedMultiplier < 1 ? 'Замедление' : 'Без изменения'} анимации
                      </p>
                    </div>
                  )}

                  {/* REVERSE - no options needed */}
                  {tool.id === 'reverse' && (
                    <p className="text-sm text-muted-foreground">
                      Реверс воспроизведёт GIF-анимацию в обратном порядке. 
                      Первый кадр станет последним, а последний — первым.
                    </p>
                  )}

                  {/* OPTIMIZE OPTIONS */}
                  {tool.id === 'optimize' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Количество цветов</Label>
                          <span className="text-sm font-medium">{optimizeColors}</span>
                        </div>
                        <Slider
                          value={[optimizeColors]}
                          onValueChange={([v]) => setOptimizeColors(v)}
                          min={8}
                          max={256}
                          step={8}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[32, 64, 128, 192, 256].map(c => (
                          <Button
                            key={c}
                            variant={optimizeColors === c ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setOptimizeColors(c)}
                          >
                            {c}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Меньше цветов = меньше размер файла, но хуже качество
                      </p>
                    </div>
                  )}

                  {/* CUT OPTIONS */}
                  {tool.id === 'cut' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Начальный кадр</Label>
                          <span className="text-sm font-medium">{cutStart}</span>
                        </div>
                        <Slider
                          value={[cutStart]}
                          onValueChange={([v]) => setCutStart(v)}
                          min={0}
                          max={uploadMeta?.pages - 1 || 50}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Конечный кадр</Label>
                          <span className="text-sm font-medium">{cutEnd}</span>
                        </div>
                        <Slider
                          value={[cutEnd]}
                          onValueChange={([v]) => setCutEnd(v)}
                          min={0}
                          max={uploadMeta?.pages - 1 || 50}
                          step={1}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Выберите диапазон кадров для сохранения ({cutEnd - cutStart + 1} кадров)
                      </p>
                    </div>
                  )}

                  {/* ADD TEXT OPTIONS */}
                  {tool.id === 'add-text' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Текст</Label>
                        <Input
                          value={addText}
                          onChange={e => { setAddTextText(e.target.value); setTextPlaced(false) }}
                          placeholder="Введите текст..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Размер шрифта</Label>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={addTextFontSize} onChange={e => setAddTextFontSize(Number(e.target.value))} min={8} max={200} className="w-20" />
                          <Slider
                            value={[addTextFontSize]}
                            onValueChange={([v]) => setAddTextFontSize(v)}
                            min={8}
                            max={200}
                            step={2}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Цвет текста</Label>
                          <div className="flex gap-2">
                            <input type="color" value={addTextColor} onChange={e => setAddTextColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                            <Input value={addTextColor} onChange={e => setAddTextColor(e.target.value)} className="flex-1" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Обводка</Label>
                          <div className="flex gap-2">
                            <input type="color" value={addTextStroke} onChange={e => setAddTextStroke(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                            <Input value={addTextStroke} onChange={e => setAddTextStroke(e.target.value)} className="flex-1" />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                        Нажмите на изображение чтобы разместить текст. Перетаскивайте текст мышью для перемещения, тяните за уголки для изменения размера.
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full mt-2"
                    onClick={handleProcess}
                    disabled={processing || (tool.id === 'add-text' && !addText)}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Обработка...
                      </>
                    ) : (
                      'Применить'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {showOriginal && outputUrl ? 'Оригинал' : outputUrl ? 'Результат' : 'Предпросмотр'}
                    </CardTitle>
                    {outputUrl && (
                      <div className="flex gap-1">
                        <Button
                          variant={showOriginal ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onShowOriginalChange(true)}
                        >
                          Оригинал
                        </Button>
                        <Button
                          variant={!showOriginal ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onShowOriginalChange(false)}
                        >
                          Результат
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                    {previewUrl && !outputUrl && (
                      <div className="relative inline-block select-none">
                        <img
                          ref={previewImgRef}
                          src={previewUrl}
                          alt="Исходный"
                          className="max-w-full max-h-[500px] rounded-lg shadow-sm"
                          style={
                            tool?.id === 'crop' ? { cursor: 'crosshair' } :
                            tool?.id === 'add-text' && addText ? { cursor: 'crosshair' } :
                            undefined
                          }
                          onMouseDown={tool?.id === 'crop' ? handleCropMouseDown : tool?.id === 'add-text' ? handleTextImageClick : undefined}
                          onMouseMove={tool?.id === 'crop' ? handleCropMouseMove : undefined}
                          onMouseUp={tool?.id === 'crop' ? handleCropMouseUp : undefined}
                          onMouseLeave={tool?.id === 'crop' ? handleCropMouseUp : undefined}
                        />
                        {/* CROP OVERLAY */}
                        {tool?.id === 'crop' && (
                          <div
                            className="absolute border-2 border-white pointer-events-none"
                            style={{ ...cropOverlayStyle, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
                          >
                            <div className="absolute inset-0 border border-dashed border-white/60" />
                            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full shadow cursor-nwse-resize" />
                            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full shadow cursor-nesw-resize" />
                            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full shadow cursor-nesw-resize" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full shadow cursor-nwse-resize" />
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-black/80 text-white px-2 py-1 rounded-md whitespace-nowrap font-mono">{cropW} × {cropH}</div>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
                              <button onClick={resetCropToFull} className="px-3 py-1.5 text-xs bg-white/90 hover:bg-white text-black rounded-md shadow font-medium transition-colors">
                                Сбросить
                              </button>
                              <button
                                onClick={handleProcess}
                                disabled={processing}
                                className="px-4 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scissors className="h-3 w-3" />}
                                Вырезать
                              </button>
                            </div>
                          </div>
                        )}
                        {tool?.id === 'crop' && !cropHasSelection && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-md">
                              Нажмите и тяните для выделения области
                            </div>
                          </div>
                        )}
                        {/* TEXT OVERLAY */}
                        {tool?.id === 'add-text' && addText && (
                          <div
                            className="absolute"
                            style={{
                              left: `${addTextX * textScale}px`,
                              top: `${addTextY * textScale}px`,
                              cursor: textPlaced ? 'move' : 'default',
                            }}
                            onMouseDown={handleTextMouseDown}
                          >
                            <svg
                              width="1"
                              height={addTextFontSize + 4}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                overflow: 'visible',
                                width: `${addText.length * addTextFontSize * 0.7}px`,
                                height: `${addTextFontSize + 4}px`,
                              }}
                            >
                              <text
                                x="0"
                                y={addTextFontSize}
                                fontSize={addTextFontSize}
                                fill={addTextColor}
                                stroke={addTextStroke}
                                strokeWidth={2}
                                fontFamily="Arial, Helvetica, sans-serif"
                              >
                                {addText}
                              </text>
                            </svg>
                            {/* Resize handles */}
                            {textPlaced && (
                              <>
                                <div
                                  className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-10"
                                  onMouseDown={(e) => handleTextCornerDown(e, 'tl')}
                                  style={{ transform: `scale(${1/textScale})` }}
                                />
                                <div
                                  className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-10"
                                  onMouseDown={(e) => handleTextCornerDown(e, 'tr')}
                                  style={{ transform: `scale(${1/textScale})` }}
                                />
                                <div
                                  className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-10"
                                  onMouseDown={(e) => handleTextCornerDown(e, 'bl')}
                                  style={{ transform: `scale(${1/textScale})` }}
                                />
                                <div
                                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-10"
                                  onMouseDown={(e) => handleTextCornerDown(e, 'br')}
                                  style={{ transform: `scale(${1/textScale})` }}
                                />
                              </>
                            )}
                          </div>
                        )}
                        {tool?.id === 'add-text' && !addText && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-md">
                              Введите текст и нажмите на изображение
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {outputUrl && showOriginal && previewUrl && (
                      <img src={previewUrl} alt="Оригинал" className="max-w-full max-h-[500px] rounded-lg shadow-sm" />
                    )}
                    {outputUrl && !showOriginal && (
                      <img src={outputUrl} alt="Результат" className="max-w-full max-h-[500px] rounded-lg shadow-sm" />
                    )}
                    {!previewUrl && (
                      <p className="text-muted-foreground">Загрузите GIF-файл</p>
                    )}
                  </div>
                  {outputUrl && tool?.id === 'crop' && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          onResetOutput()
                          resetCropToFull()
                        }}
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Обрезать заново
                      </Button>
                      <Button className="flex-1" onClick={onDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Скачать
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {outputUrl && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Результат</CardTitle>
                      <Badge variant="secondary">
                        {formatFileSize(outputSize)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {uploadMeta && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Исходный: {formatFileSize(uploadMeta.inputSize)}</span>
                        <span>→</span>
                        <span className="font-medium">Результат: {formatFileSize(outputSize)}</span>
                        {outputSize < uploadMeta.inputSize && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            -{Math.round((1 - outputSize / uploadMeta.inputSize) * 100)}%
                          </Badge>
                        )}
                      </div>
                    )}
                    <Button onClick={onDownload} className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Скачать результат
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ==================== MAKE GIF VIEW ====================
function MakeGifView({
  files,
  previews,
  inputRef,
  setFiles,
  setPreviews,
  processing,
  outputUrl,
  outputSize,
  onProcess,
  onDownload,
  onBack,
}: {
  files: File[]
  previews: string[]
  inputRef: React.RefObject<HTMLInputElement>
  setFiles: React.Dispatch<React.SetStateAction<File[]>>
  setPreviews: React.Dispatch<React.SetStateAction<string[]>>
  processing: boolean
  outputUrl: string | null
  outputSize: number
  onProcess: (endpoint: string, formData: FormData) => void
  onDownload: () => void
  onBack: () => void
}) {
  const [delay, setDelay] = useState(200)

  const handleAddFiles = (newFiles: FileList) => {
    const arr = Array.from(newFiles)
    const newPreviews = arr.map(f => URL.createObjectURL(f))
    setFiles(prev => [...prev, ...arr])
    setPreviews(prev => [...prev, ...newPreviews])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const moveFile = (from: number, to: number) => {
    setFiles(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setPreviews(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const handleCreate = () => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    formData.append('delay', String(delay))
    onProcess('make-gif', formData)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
            <ImageIcon className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">GIF Maker</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Настройки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Задержка между кадрами (мс)</Label>
                    <span className="text-sm font-medium">{delay}мс</span>
                  </div>
                  <Slider
                    value={[delay]}
                    onValueChange={([v]) => setDelay(v)}
                    min={20}
                    max={2000}
                    step={10}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Добавить изображения
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) handleAddFiles(e.target.files)
                  }}
                />

                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={processing || files.length < 2}
                >
                  {processing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Создание...</>
                  ) : (
                    'Создать GIF'
                  )}
                </Button>
                {files.length < 2 && (
                  <p className="text-xs text-muted-foreground text-center">Добавьте минимум 2 изображения</p>
                )}
              </CardContent>
            </Card>

            {/* File list */}
            {files.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Кадры ({files.length})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <img src={previews[index]} alt="" className="w-10 h-10 object-cover rounded" />
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <div className="flex gap-1">
                        {index > 0 && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveFile(index, index - 1)}>←</Button>
                        )}
                        {index < files.length - 1 && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveFile(index, index + 1)}>→</Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeFile(index)}>✕</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {outputUrl ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Результат</CardTitle>
                    <Badge variant="secondary">{formatFileSize(outputSize)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center">
                    <img src={outputUrl} alt="Созданный GIF" className="max-w-full max-h-[500px] rounded-lg" />
                  </div>
                  <Button onClick={onDownload} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Скачать GIF
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    Добавьте изображения и нажмите «Создать GIF»
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ==================== VIDEO TO GIF VIEW ====================
function VideoToGifView({
  processing,
  outputUrl,
  outputSize,
  onProcess,
  onDownload,
  onBack,
}: {
  processing: boolean
  outputUrl: string | null
  outputSize: number
  onProcess: (endpoint: string, formData: FormData) => void
  onDownload: () => void
  onBack: () => void
}) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [startTime, setStartTime] = useState('0')
  const [duration, setDuration] = useState('5')
  const [fps, setFps] = useState(10)
  const [width, setWidth] = useState(480)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleConvert = () => {
    if (!videoFile) return
    const formData = new FormData()
    formData.append('file', videoFile)
    formData.append('startTime', startTime)
    formData.append('duration', duration)
    formData.append('fps', String(fps))
    formData.append('width', String(width))
    onProcess('video-to-gif', formData)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
            <Film className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">Video → GIF</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Загрузить видео</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Film className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm">{videoFile ? videoFile.name : 'Выберите видео файл'}</p>
                </div>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) setVideoFile(f)
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Настройки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Начало (сек)</Label>
                    <Input type="number" value={startTime} onChange={e => setStartTime(e.target.value)} min={0} step={0.1} />
                  </div>
                  <div className="space-y-2">
                    <Label>Длительность (сек)</Label>
                    <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={0.5} max={30} step={0.5} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>FPS (кадров/сек)</Label>
                  <Select value={String(fps)} onValueChange={v => setFps(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 fps</SelectItem>
                      <SelectItem value="8">8 fps</SelectItem>
                      <SelectItem value="10">10 fps</SelectItem>
                      <SelectItem value="12">12 fps</SelectItem>
                      <SelectItem value="15">15 fps</SelectItem>
                      <SelectItem value="20">20 fps</SelectItem>
                      <SelectItem value="24">24 fps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ширина (px)</Label>
                  <Select value={String(width)} onValueChange={v => setWidth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="320">320px</SelectItem>
                      <SelectItem value="480">480px</SelectItem>
                      <SelectItem value="640">640px</SelectItem>
                      <SelectItem value="800">800px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleConvert}
                  disabled={processing || !videoFile}
                >
                  {processing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Конвертация...</>
                  ) : (
                    'Конвертировать в GIF'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {outputUrl ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Результат</CardTitle>
                    <Badge variant="secondary">{formatFileSize(outputSize)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center">
                    <img src={outputUrl} alt="Конвертированный GIF" className="max-w-full max-h-[500px] rounded-lg" />
                  </div>
                  <Button onClick={onDownload} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Скачать GIF
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Film className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Загрузите видео и настройте параметры конвертации</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ==================== SPLIT VIEW ====================
function SplitView({
  file,
  previewUrl,
  uploadMeta,
  processing,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  dragOver,
  fileInputRef,
  acceptTypes,
  onProcess,
  onBack,
}: {
  file: File | null
  previewUrl: string | null
  uploadMeta: any
  processing: boolean
  onFileSelect: (file: File) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  dragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  acceptTypes: string
  onProcess: (endpoint: string, body: any) => void
  onBack: () => void
}) {
  const [splitFrames, setSplitFrames] = useState<{ name: string; data: string; size: number }[]>([])
  const [splitting, setSplitting] = useState(false)

  const handleSplit = () => {
    if (!uploadMeta?.inputPath) return
    setSplitting(true)
    fetch('/api/gif/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputPath: uploadMeta.inputPath }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setSplitFrames(data.frames)
      })
      .catch(err => {
        // toast handled elsewhere
      })
      .finally(() => setSplitting(false))
  }

  const downloadFrame = (frame: { name: string; data: string }) => {
    const a = document.createElement('a')
    a.href = frame.data
    a.download = frame.name
    a.click()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">Разделение GIF на кадры</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        {!file ? (
          <UploadArea
            onFileSelect={onFileSelect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            dragOver={dragOver}
            fileInputRef={fileInputRef}
            acceptTypes={acceptTypes}
          />
        ) : splitFrames.length === 0 ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-4">
                  <img src={previewUrl!} alt="GIF" className="max-w-[200px] max-h-[200px] rounded" />
                  <div className="space-y-2">
                    <p className="font-medium">{file.name}</p>
                    {uploadMeta && (
                      <p className="text-sm text-muted-foreground">
                        {uploadMeta.width}×{uploadMeta.height}px • {uploadMeta.pages} кадров • {formatFileSize(uploadMeta.inputSize)}
                      </p>
                    )}
                    <Button onClick={handleSplit} disabled={splitting}>
                      {splitting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Разделение...</>
                      ) : (
                        'Разделить на кадры'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Извлечённые кадры ({splitFrames.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSplitFrames([])}>
                  Сбросить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto">
                {splitFrames.map((frame, index) => (
                  <div key={index} className="group relative border rounded-lg overflow-hidden bg-muted/30 hover:shadow-md transition-shadow">
                    <img src={frame.data} alt={`Кадр ${index + 1}`} className="w-full h-auto" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="sm" variant="secondary" onClick={() => downloadFrame(frame)}>
                        <Download className="h-3 w-3 mr-1" />
                        {frame.name}
                      </Button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-1">
                      Кадр {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

// ==================== CONVERT VIEW ====================
function ConvertView({
  processing,
  outputUrl,
  outputSize,
  onProcess,
  onDownload,
  onBack,
}: {
  processing: boolean
  outputUrl: string | null
  outputSize: number
  onProcess: (endpoint: string, formData: FormData) => void
  onDownload: () => void
  onBack: () => void
}) {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [targetFormat, setTargetFormat] = useState<string>('mp4')
  const [quality, setQuality] = useState(75)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    setSourceFile(file)
    setSourcePreview(URL.createObjectURL(file))
    const mime = file.type || ''
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (mime.includes('gif') || ext === 'gif') {
      setTargetFormat('mp4')
    } else if (mime.includes('video') || ['mp4', 'webm', 'avi'].includes(ext)) {
      setTargetFormat('gif')
    } else {
      setTargetFormat('png')
    }
  }

  const handleConvert = () => {
    if (!sourceFile) return
    const formData = new FormData()
    formData.append('file', sourceFile)
    formData.append('targetFormat', targetFormat)
    formData.append('quality', String(quality))
    onProcess('convert', formData)
  }

  const getSourceType = () => {
    if (!sourceFile) return 'unknown'
    const mime = sourceFile.type || ''
    const ext = sourceFile.name.split('.').pop()?.toLowerCase() || ''
    if (mime.includes('gif') || ext === 'gif') return 'gif'
    if (mime.includes('video') || ['mp4', 'webm', 'avi', 'mov'].includes(ext)) return 'video'
    return 'image'
  }

  const sourceType = getSourceType()

  const outputFormats: Record<string, { value: string; label: string; desc: string }[]> = {
    gif: [
      { value: 'mp4', label: 'MP4', desc: 'Видео H.264 — маленький размер, широкая поддержка' },
      { value: 'webm', label: 'WebM', desc: 'Видео VP9 — открытый формат, хорошее сжатие' },
      { value: 'apng', label: 'APNG', desc: 'Анимированный PNG — лучшее качество, большой размер' },
      { value: 'webp', label: 'WebP', desc: 'Анимированный WebP — современный формат, малый размер' },
    ],
    video: [
      { value: 'gif', label: 'GIF', desc: 'Анимированный GIF — универсальный формат' },
      { value: 'mp4', label: 'MP4', desc: 'Перекодировать в MP4' },
      { value: 'webm', label: 'WebM', desc: 'Перекодировать в WebM' },
    ],
    image: [
      { value: 'png', label: 'PNG', desc: 'Без потерь качества, прозрачность' },
      { value: 'jpg', label: 'JPG', desc: 'Маленький размер, нет прозрачности' },
      { value: 'webp', label: 'WebP', desc: 'Современный формат, малый размер' },
      { value: 'gif', label: 'GIF', desc: 'Формат GIF (один кадр)' },
      { value: 'bmp', label: 'BMP', desc: 'Без сжатия, максимальный размер' },
      { value: 'tiff', label: 'TIFF', desc: 'Профессиональный формат, поддержка слоёв' },
    ],
    unknown: [],
  }

  const formatInfo = outputFormats[sourceType]?.find(f => f.value === targetFormat)

  const getOutputContentType = () => {
    if (['mp4', 'webm'].includes(targetFormat)) return 'video'
    return 'image'
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">Конвертация</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Исходный файл</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {sourcePreview ? (
                    <div className="space-y-2">
                      {getSourceType() === 'video' ? (
                        <video src={sourcePreview} className="max-h-[120px] mx-auto rounded" muted />
                      ) : (
                        <img src={sourcePreview} alt="Превью" className="max-h-[120px] mx-auto rounded" />
                      )}
                      <p className="text-sm font-medium truncate">{sourceFile?.name}</p>
                    </div>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm">Выберите файл для конвертации</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/gif,image/png,image/jpeg,image/webp,image/bmp,video/mp4,video/webm"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelect(f)
                  }}
                />
              </CardContent>
            </Card>

            {/* Target format */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Целевой формат</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceFile ? (
                  <>
                    {/* Source → Target visual */}
                    <div className="flex items-center justify-center gap-3 py-2">
                      <Badge variant="outline" className="text-sm px-3 py-1">
                        {sourceFile.name.split('.').pop()?.toUpperCase()}
                      </Badge>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      <Badge className="text-sm px-3 py-1 bg-violet-600">
                        {targetFormat.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Format selection */}
                    <div className="space-y-2">
                      <Label>Выберите формат</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {outputFormats[sourceType]?.map(fmt => (
                          <Button
                            key={fmt.value}
                            variant={targetFormat === fmt.value ? 'default' : 'outline'}
                            size="sm"
                            className={targetFormat === fmt.value ? 'bg-violet-600 hover:bg-violet-700' : ''}
                            onClick={() => setTargetFormat(fmt.value)}
                          >
                            {fmt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {formatInfo && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                        {formatInfo.desc}
                      </p>
                    )}

                    {/* Quality slider */}
                    {!['apng', 'bmp', 'gif'].includes(targetFormat) && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Качество</Label>
                          <span className="text-sm font-medium">{quality}%</span>
                        </div>
                        <Slider
                          value={[quality]}
                          onValueChange={([v]) => setQuality(v)}
                          min={10}
                          max={100}
                          step={5}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Малый размер</span>
                          <span>Высокое качество</span>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700"
                      onClick={handleConvert}
                      disabled={processing || !sourceFile}
                    >
                      {processing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Конвертация...</>
                      ) : (
                        <>
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          Конвертировать в {targetFormat.toUpperCase()}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Сначала загрузите файл
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Supported conversions info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Поддерживаемые конвертации</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-4 w-4 mt-0.5 text-pink-500" />
                    <div>
                      <p className="font-medium">GIF → Видео</p>
                      <p className="text-muted-foreground">MP4, WebM — уменьшение размера в 5-10 раз</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-4 w-4 mt-0.5 text-emerald-500" />
                    <div>
                      <p className="font-medium">GIF → APNG</p>
                      <p className="text-muted-foreground">Лучшее качество, поддержка прозрачности</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-4 w-4 mt-0.5 text-sky-500" />
                    <div>
                      <p className="font-medium">GIF → WebP</p>
                      <p className="text-muted-foreground">Современный формат, малый размер</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Film className="h-4 w-4 mt-0.5 text-purple-500" />
                    <div>
                      <p className="font-medium">Видео → GIF</p>
                      <p className="text-muted-foreground">MP4/WebM → GIF анимация</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-4 w-4 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-medium">Изображение → Формат</p>
                      <p className="text-muted-foreground">PNG, JPG, WebP, GIF, BMP, TIFF</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview & Result */}
          <div className="lg:col-span-2 space-y-4">
            {outputUrl ? (
              <Card className="border-violet-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Результат конвертации</CardTitle>
                    <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                      {targetFormat.toUpperCase()} • {formatFileSize(outputSize)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                    {getOutputContentType() === 'video' ? (
                      <video
                        src={outputUrl}
                        controls
                        autoPlay
                        loop
                        className="max-w-full max-h-[500px] rounded-lg"
                      />
                    ) : (
                      <img
                        src={outputUrl}
                        alt="Результат конвертации"
                        className="max-w-full max-h-[500px] rounded-lg"
                      />
                    )}
                  </div>

                  {/* Conversion summary */}
                  {sourceFile && (
                    <div className="flex items-center justify-center gap-4 text-sm bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground">
                        {sourceFile.name.split('.').pop()?.toUpperCase()} ({formatFileSize(sourceFile.size)})
                      </span>
                      <ArrowRightLeft className="h-4 w-4 text-violet-500" />
                      <span className="font-medium">
                        {targetFormat.toUpperCase()} ({formatFileSize(outputSize)})
                      </span>
                      {outputSize < sourceFile.size && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          -{Math.round((1 - outputSize / sourceFile.size) * 100)}%
                        </Badge>
                      )}
                      {outputSize > sourceFile.size && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          +{Math.round((outputSize / sourceFile.size - 1) * 100)}%
                        </Badge>
                      )}
                    </div>
                  )}

                  <Button onClick={onDownload} className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
                    <Download className="h-4 w-4" />
                    Скачать {targetFormat.toUpperCase()}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <ArrowRightLeft className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                  <h3 className="text-lg font-medium mb-2">Конвертация форматов</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Загрузите GIF, видео или изображение и выберите целевой формат. 
                    Поддерживаются конвертации GIF → MP4/WebM/APNG/WebP, видео → GIF, 
                    а также преобразование между форматами изображений.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Comparison: source vs output */}
            {outputUrl && sourcePreview && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Сравнение</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-center text-muted-foreground">Оригинал</p>
                      <div className="bg-muted/30 rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                        {getSourceType() === 'video' ? (
                          <video src={sourcePreview} className="max-w-full max-h-[200px] rounded" muted loop autoPlay />
                        ) : (
                          <img src={sourcePreview} alt="Оригинал" className="max-w-full max-h-[200px] rounded" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-center text-muted-foreground">Результат</p>
                      <div className="bg-muted/30 rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                        {getOutputContentType() === 'video' ? (
                          <video src={outputUrl} className="max-w-full max-h-[200px] rounded" muted loop autoPlay />
                        ) : (
                          <img src={outputUrl} alt="Результат" className="max-w-full max-h-[200px] rounded" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ==================== REMOVE BG VIEW ====================
function RemoveBgView({
  processing,
  outputUrl,
  outputSize,
  onProcess,
  onDownload,
  onBack,
}: {
  processing: boolean
  outputUrl: string | null
  outputSize: number
  onProcess: (endpoint: string, formData: FormData) => void
  onDownload: () => void
  onBack: () => void
}) {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [tolerance, setTolerance] = useState(30)
  const [mode, setMode] = useState<'ai' | 'flood' | 'global' | 'exact'>('ai')
  const [pickColor, setPickColor] = useState(false)
  const [sourceMeta, setSourceMeta] = useState<{ width: number; height: number; size: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const { toast } = useToast()

  const handleFileSelect = (file: File) => {
    setSourceFile(file)
    const url = URL.createObjectURL(file)
    setSourcePreview(url)
    setSourceMeta({ width: 0, height: 0, size: file.size })

    // Get image dimensions
    const img = new Image()
    img.onload = () => {
      setSourceMeta({ width: img.width, height: img.height, size: file.size })
      imgRef.current = img
    }
    img.src = url
  }

  const handlePickColor = () => {
    setPickColor(true)
    toast({ title: 'Пипетка активирована', description: 'Нажмите на изображение, чтобы выбрать цвет фона' })
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!pickColor) return
    setPickColor(false)

    const img = e.currentTarget
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)

    const rect = img.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / rect.width * img.naturalWidth)
    const y = Math.floor((e.clientY - rect.top) / rect.height * img.naturalHeight)

    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('')
    setBgColor(hex)
    toast({ title: 'Цвет выбран', description: `Цвет фона: ${hex}` })
  }

  const handleRemoveBg = () => {
    if (!sourceFile) return
    const formData = new FormData()
    formData.append('file', sourceFile)
    formData.append('bgColor', bgColor)
    formData.append('tolerance', String(tolerance))
    formData.append('mode', mode)
    onProcess('remove-bg', formData)
  }

  // Checkerboard pattern for transparency preview
  const checkerboardStyle = {
    backgroundImage: 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 flex items-center justify-center text-white">
            <Eraser className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">Удалить фон</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Исходный файл</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {sourcePreview ? (
                    <div className="space-y-2">
                      <img src={sourcePreview} alt="Превью" className="max-h-[120px] mx-auto rounded" />
                      <p className="text-sm font-medium truncate">{sourceFile?.name}</p>
                      {sourceMeta && (
                        <p className="text-xs text-muted-foreground">
                          {sourceMeta.width}×{sourceMeta.height}px • {formatFileSize(sourceMeta.size)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <Eraser className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm">Загрузите GIF или изображение</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/gif,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelect(f)
                  }}
                />
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Настройки удаления</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceFile ? (
                  <>
                    {/* Mode - AI first */}
                    <div className="space-y-2">
                      <Label>Режим удаления</Label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setMode('ai')}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${mode === 'ai' ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-border hover:border-fuchsia-200'}`}
                        >
                          <p className="font-medium text-sm flex items-center gap-2">
                            <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">AI</span>
                            Умное удаление
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Нейросеть автоматически определяет объект и удаляет фон. Лучшее качество</p>
                        </button>
                        <button
                          onClick={() => setMode('flood')}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${mode === 'flood' ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-border hover:border-fuchsia-200'}`}
                        >
                          <p className="font-medium text-sm">Заливка от краёв</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Удаляет только соединённый фон от краёв изображения</p>
                        </button>
                        <button
                          onClick={() => setMode('global')}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${mode === 'global' ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-border hover:border-fuchsia-200'}`}
                        >
                          <p className="font-medium text-sm">Глобальный</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Удаляет все пиксели выбранного цвета по всему изображению</p>
                        </button>
                        <button
                          onClick={() => setMode('exact')}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${mode === 'exact' ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-border hover:border-fuchsia-200'}`}
                        >
                          <p className="font-medium text-sm">Точное совпадение</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Удаляет только пиксели с точным совпадением цвета (без толерантности)</p>
                        </button>
                      </div>
                    </div>

                    {/* Color settings - hidden in AI mode */}
                    {mode !== 'ai' && (
                      <>
                        <div className="space-y-2">
                          <Label>Цвет фона для удаления</Label>
                          <div className="flex gap-2 items-center">
                            <div className="relative">
                              <input
                                type="color"
                                value={bgColor}
                                onChange={e => setBgColor(e.target.value)}
                                className="w-12 h-10 rounded-lg border-2 cursor-pointer"
                              />
                            </div>
                            <Input
                              value={bgColor}
                              onChange={e => setBgColor(e.target.value)}
                              className="flex-1 font-mono"
                              placeholder="#ffffff"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handlePickColor}
                              className={pickColor ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' : ''}
                            >
                              Пипетка
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Выберите цвет, который нужно сделать прозрачным, или используйте пипетку
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Быстрый выбор</Label>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { color: '#ffffff', label: 'Белый', border: 'border-gray-300' },
                              { color: '#000000', label: 'Чёрный', border: 'border-gray-600' },
                              { color: '#00ff00', label: 'Зелёный', border: 'border-green-300' },
                              { color: '#0000ff', label: 'Синий', border: 'border-blue-300' },
                              { color: '#ff0000', label: 'Красный', border: 'border-red-300' },
                              { color: '#ffff00', label: 'Жёлтый', border: 'border-yellow-300' },
                            ].map(preset => (
                              <button
                                key={preset.color}
                                onClick={() => setBgColor(preset.color)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${preset.border} hover:shadow-sm transition-shadow ${bgColor === preset.color ? 'ring-2 ring-fuchsia-400' : ''}`}
                              >
                                <span
                                  className="w-3 h-3 rounded-sm inline-block"
                                  style={{ backgroundColor: preset.color, border: preset.color === '#ffffff' ? '1px solid #ccc' : 'none' }}
                                />
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Tolerance - always visible */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>{mode === 'ai' ? 'Чувствительность' : 'Толерантность'}</Label>
                        <span className="text-sm font-medium">{tolerance}</span>
                      </div>
                      <Slider
                        value={[tolerance]}
                        onValueChange={([v]) => setTolerance(v)}
                        min={0}
                        max={150}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{mode === 'ai' ? 'Менее агрессивно' : 'Точное совпадение'}</span>
                        <span>{mode === 'ai' ? 'Более агрессивно' : 'Широкий диапазон'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {mode === 'ai'
                          ? 'Чем выше — тем больше фона удаляется, но выше риск зацепить объект'
                          : 'Чем выше значение, тем больше похожих оттенков будет удалено'
                        }
                      </p>
                    </div>

                    <Button
                      className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
                      onClick={handleRemoveBg}
                      disabled={processing || !sourceFile}
                    >
                      {processing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Удаление фона...</>
                      ) : (
                        <>
                          <Eraser className="mr-2 h-4 w-4" />
                          Удалить фон
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Сначала загрузите файл
                  </p>
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Как это работает</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="bg-fuchsia-100 text-fuchsia-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                    <p>Загрузите GIF или изображение</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-fuchsia-100 text-fuchsia-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                    <p><strong>AI</strong> — нейросеть сама определит объект и удалит фон. Для однотонного фона используйте режимы по цвету</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-fuchsia-100 text-fuchsia-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                    <p>В ручных режимах: выберите цвет и настройте толерантность</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview & Result */}
          <div className="lg:col-span-2 space-y-4">
            {/* Source preview with color picker support */}
            {sourcePreview && !outputUrl && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {pickColor ? '🎯 Нажмите на изображение для выбора цвета' : 'Предпросмотр'}
                    </CardTitle>
                    {bgColor && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Цвет фона:</span>
                        <div className="w-6 h-6 rounded border" style={{ backgroundColor: bgColor, border: bgColor === '#ffffff' ? '1px solid #ccc' : 'none' }} />
                        <span className="text-xs font-mono">{bgColor}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="rounded-lg p-4 flex items-center justify-center min-h-[300px]"
                    style={checkerboardStyle}
                  >
                    <img
                      src={sourcePreview}
                      alt="Исходное изображение"
                      className={`max-w-full max-h-[500px] rounded-lg shadow-sm ${pickColor ? 'cursor-crosshair ring-2 ring-fuchsia-400' : ''}`}
                      onClick={handleCanvasClick}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Result */}
            {outputUrl ? (
              <Card className="border-fuchsia-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Результат</CardTitle>
                    <Badge variant="secondary" className="bg-fuchsia-100 text-fuchsia-700">
                      Фон удалён • {formatFileSize(outputSize)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="rounded-lg p-4 flex items-center justify-center min-h-[300px]"
                    style={checkerboardStyle}
                  >
                    <img
                      src={outputUrl}
                      alt="Результат"
                      className="max-w-full max-h-[500px] rounded-lg shadow-sm"
                    />
                  </div>

                  {/* Size comparison */}
                  {sourceFile && (
                    <div className="flex items-center justify-center gap-4 text-sm bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground">
                        Исходный: {formatFileSize(sourceFile.size)}
                      </span>
                      <span>→</span>
                      <span className="font-medium">
                        Результат: {formatFileSize(outputSize)}
                      </span>
                    </div>
                  )}

                  <Button onClick={onDownload} className="w-full gap-2 bg-fuchsia-600 hover:bg-fuchsia-700">
                    <Download className="h-4 w-4" />
                    Скачать результат
                  </Button>
                </CardContent>
              </Card>
            ) : !sourcePreview ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Eraser className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                  <h3 className="text-lg font-medium mb-2">Удаление фона</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Загрузите GIF или изображение, выберите цвет фона для удаления 
                    и настройте толерантность. Прозрачные области будут показаны 
                    на шахматном фоне.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Comparison after processing */}
            {outputUrl && sourcePreview && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Сравнение</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-center text-muted-foreground">Оригинал</p>
                      <div className="bg-muted/30 rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                        <img src={sourcePreview} alt="Оригинал" className="max-w-full max-h-[200px] rounded" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-center text-muted-foreground">Без фона</p>
                      <div
                        className="rounded-lg p-2 flex items-center justify-center min-h-[200px]"
                        style={checkerboardStyle}
                      >
                        <img src={outputUrl} alt="Без фона" className="max-w-full max-h-[200px] rounded" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

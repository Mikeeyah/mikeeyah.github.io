import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Image as ImageIcon, 
  Download, 
  RefreshCw, 
  Maximize2, 
  Zap,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Trash2,
  Plus,
  ChevronRight,
  Loader2,
  Type,
  Move,
  AlignCenter,
  Maximize2 as FocusIcon,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Brain,
  Sliders,
  Palette,
  Layers,
  Crop,
  Sun,
  Contrast as ContrastIcon,
  Wind,
  Droplets,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import gifshot from 'gifshot';
import { removeBackground } from '@imgly/background-removal';
import { cn, formatBytes } from './lib/utils';

// Google AdSense Component
const GoogleAd = ({ className, slot, format = 'auto', responsive = 'true' }: { className?: string, slot?: string, format?: string, responsive?: string }) => {
  const rawClient = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT;
  const client = rawClient ? (rawClient.startsWith('ca-') ? rawClient : `ca-${rawClient}`) : null;
  
  useEffect(() => {
    if (client && typeof window !== 'undefined') {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('Adsbygoogle error:', e);
      }
    }
  }, [client]);

  if (!client) {
    return (
      <div className={cn("bg-white/5 border border-dashed border-white/10 rounded-2xl flex items-center justify-center p-4 min-h-[100px]", className)}>
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ad Slot</p>
          <p className="text-[8px] text-slate-700 italic">Configure VITE_GOOGLE_ADSENSE_CLIENT to activate</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl", className)}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};

interface ProcessingOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  customWidth: number | null;
  customHeight: number | null;
  useWebWorker: boolean;
  fileType: string;
  removeBackground: boolean;
  aiModel: 'isnet' | 'isnet_fp16';
  gifAnimationStyle: 'zoom' | 'pan' | 'pulse' | 'glitch' | 'spin' | 'shake' | 'float' | 'bounce' | 'pivot' | 'bloom' | 'rainbow' | 'shimmer' | 'heartbeat' | 'ticking' | 'celebrate' | 'ghost';
  gifFrameCount: number;
  gifInterval: number;
  isSticker: boolean;
  stickerBorderSize: number;
  stickerBorderColor: string;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  sepia: number;
  blur: number;
  grayscale: boolean;
  invert: boolean;
  rotate: number;
  flipX: boolean;
  flipY: boolean;
  textOverlay: {
    enabled: boolean;
    content: string;
    fontSize: number;
    color: string;
    x: number;
    y: number;
    font: string;
  };
}

interface ImageJob {
  id: string;
  file: File;
  originalSize: number;
  originalUrl: string;
  processedSize: number | null;
  processedUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'finishing';
  savedPercentage: number | null;
  originalWidth?: number;
  originalHeight?: number;
  progress?: number;
}

export default function App() {
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ImageJob | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDeepForgingAll, setIsDeepForgingAll] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'optim' | 'edit' | 'intel'>('optim');
  const [view, setView] = useState<'main' | 'privacy' | 'about' | 'contact'>('main');

  // Derived Stats
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const totalOriginalSize = completedJobs.reduce((acc, j) => acc + j.originalSize, 0);
  const totalProcessedSize = completedJobs.reduce((acc, j) => acc + (j.processedSize || 0), 0);
  const totalSaved = totalOriginalSize - totalProcessedSize;
  const avgSavedPercent = totalOriginalSize > 0 ? (totalSaved / totalOriginalSize) * 100 : 0;
  const totalQueueWeight = jobs.reduce((acc, j) => acc + j.originalSize, 0);
  
  const [options, setOptions] = useState<ProcessingOptions>({
    maxSizeMB: 0.5, // High-fidelity baseline
    maxWidthOrHeight: 16384, // Default to original dimensions
    customWidth: null,
    customHeight: null,
    useWebWorker: true,
    fileType: 'original', // Default to source format
    removeBackground: false,
    aiModel: 'isnet_fp16',
    gifAnimationStyle: 'zoom',
    gifFrameCount: 12,
    gifInterval: 0.1,
    isSticker: false,
    stickerBorderSize: 12,
    stickerBorderColor: '#ffffff',
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    sepia: 0,
    blur: 0,
    grayscale: false,
    invert: false,
    rotate: 0,
    flipX: false,
    flipY: false,
    textOverlay: {
      enabled: false,
      content: '',
      fontSize: 24,
      color: '#ffffff',
      x: 50,
      y: 50,
      font: 'Inter'
    }
  });

  const [activeVisualSubTab, setActiveVisualSubTab] = useState<'filters' | 'adjust' | 'text' | 'transform'>('filters');

  const PRESETS = [
    { name: 'Original', icon: '✨', filters: { brightness: 100, contrast: 100, saturation: 100, sepia: 0, grayscale: false, invert: false, hue: 0, blur: 0 } },
    { name: 'Cyberpunk', icon: '🌃', filters: { brightness: 115, contrast: 130, saturation: 180, sepia: 0, grayscale: false, invert: false, hue: 280, blur: 0 } },
    { name: 'Retro', icon: '📸', filters: { brightness: 105, contrast: 95, saturation: 70, sepia: 40, grayscale: false, invert: false, hue: 0, blur: 0.5 } },
    { name: 'Emerald', icon: '🌲', filters: { brightness: 100, contrast: 110, saturation: 110, sepia: 20, grayscale: false, invert: false, hue: 140, blur: 0 } },
    { name: 'Golden Hour', icon: '🌅', filters: { brightness: 110, contrast: 105, saturation: 130, sepia: 30, grayscale: false, invert: false, hue: 35, blur: 0 } },
    { name: 'Vivid', icon: '🌈', filters: { brightness: 110, contrast: 120, saturation: 140, sepia: 0, grayscale: false, invert: false, hue: 0, blur: 0 } },
    { name: 'Mono', icon: '🎞️', filters: { brightness: 100, contrast: 130, saturation: 0, sepia: 0, grayscale: true, invert: false, hue: 0, blur: 0 } },
    { name: 'Vintage', icon: '🕯️', filters: { brightness: 90, contrast: 90, saturation: 80, sepia: 60, grayscale: false, invert: false, hue: 0, blur: 0 } },
    { name: 'Drama', icon: '🎭', filters: { brightness: 80, contrast: 150, saturation: 120, sepia: 0, grayscale: false, invert: false, hue: 0, blur: 0 } },
    { name: 'Ethereal', icon: '☁️', filters: { brightness: 120, contrast: 80, saturation: 90, sepia: 0, grayscale: false, invert: false, hue: 0, blur: 2 } },
  ];

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setOptions(prev => ({
      ...prev,
      ...preset.filters
    }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global AdSense script injection
  useEffect(() => {
    const rawClient = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT;
    const client = rawClient ? (rawClient.startsWith('ca-') ? rawClient : `ca-${rawClient}`) : null;
    
    if (client) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
      return () => {
        document.head.removeChild(script);
      };
    }
  }, []);

  // Cleanup URLs ONLY on component unmount
  useEffect(() => {
    const currentJobs = jobs;
    return () => {
      currentJobs.forEach(job => {
        if (job.originalUrl) URL.revokeObjectURL(job.originalUrl);
        if (job.processedUrl) URL.revokeObjectURL(job.processedUrl);
      });
    };
  }, []); // EMPTY dependency array to prevent revoking on every update

  const handleNewFiles = async (files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    // Process files sequentially to detect dimensions accurately without blocking UI
    const newJobs: ImageJob[] = await Promise.all(fileArray.map(async (file) => {
      const url = URL.createObjectURL(file);
      let width = 0;
      let height = 0;

      try {
        const img = new Image();
        const imgReady = new Promise<{w: number, h: number}>((resolve) => {
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 0, h: 0 });
        });
        img.src = url;
        const dims = await imgReady;
        width = dims.w;
        height = dims.h;
      } catch (e) {
        console.warn('Metadata ingestion failed for:', file.name);
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        originalSize: file.size,
        originalUrl: url,
        originalWidth: width,
        originalHeight: height,
        processedSize: null,
        processedUrl: null,
        status: 'pending' as const,
        savedPercentage: null
      };
    }));

    if (newJobs.length === 0) {
      setError('Please upload valid image files.');
      return;
    }

    setError(null);
    setJobs(prev => [...prev, ...newJobs]);
  };

  const processJob = async (job: ImageJob, currentOptions: ProcessingOptions, useProcessedSource = false) => {
    try {
      let sourceFile: File | Blob = job.file;
      let targetOptions = { ...currentOptions };

      // If chaining, fetch the current processed result to use as the new source
      if (useProcessedSource && job.processedUrl) {
        const response = await fetch(job.processedUrl);
        const blob = await response.blob();
        // Wrap blob in File to preserve name and help library logic
        sourceFile = new File([blob], job.file.name, { type: blob.type });
        
        // POWER UP: For Deep Forge, we aggressively target 85% of the CURRENT processed size
        // instead of just sticking to the global setting, allowing repeated compression.
        const currentSizeMB = blob.size / (1024 * 1024);
        targetOptions.maxSizeMB = Math.min(currentOptions.maxSizeMB, currentSizeMB * 0.85); // Increased to 0.85 for better quality retention
      }

      // Cleanup previous processed URL if it exists (but after potentially fetching it)
      if (job.status === 'completed' && job.processedUrl) {
        URL.revokeObjectURL(job.processedUrl);
      }

      setJobs(prev => prev.map(j => j.id === job.id ? { 
        ...j, 
        status: 'processing' as const,
        processedUrl: null,
        processedSize: null
      } : j));
      
      // STAGE 1: AI Background Removal (Skip if chaining as it's already removed)
      if (targetOptions.removeBackground && !useProcessedSource) {
        try {
          // AUTO-FIX: Force transparency-supporting format if removing background
          if (targetOptions.fileType === 'original' && job.file.type === 'image/jpeg') {
            targetOptions.fileType = 'image/png';
          }

          const removedBgBlob = await removeBackground(sourceFile, {
            // Use GPU for maximum performance
            device: 'gpu', 
            model: targetOptions.aiModel,
            debug: false,
            fetchArgs: { cache: 'force-cache' },
            progress: (model: string, done: number, total: number) => {
              const progressVal = total ? Math.round((done / total) * 100) : 0;
              setJobs(prev => prev.map(j => j.id === job.id ? { 
                ...j, 
                status: 'processing' as const,
                progress: progressVal,
              } : j));
            }
          });
          sourceFile = new File([removedBgBlob], job.file.name.replace(/\.[^/.]+$/, "") + ".png", { type: "image/png" });
        } catch (bgError) {
          console.error('BG Removal failed, continuing with original:', bgError);
          setError("Background removal engine encountered a bottleneck. Retrying with original...");
        }
      }

      // STAGE 2: Compression & Primary Resizing
      const effectiveFileType = targetOptions.fileType === 'original' ? job.file.type : targetOptions.fileType;
      
      // ANCHOR DIMENSIONS: Force the engine to respect hardware coordinate limits
      let dimensionCeiling = targetOptions.customWidth || targetOptions.customHeight || targetOptions.maxWidthOrHeight;
      
      if (targetOptions.maxWidthOrHeight === 16384 && !targetOptions.customWidth) {
        // Always lock to original ingestion metadata to prevent chaining decay
        dimensionCeiling = Math.max(job.originalWidth || 0, job.originalHeight || 0) || 16384;
      }

      const initialQuality = targetOptions.maxSizeMB <= 0.05 ? 0.85 : 
                            targetOptions.maxSizeMB <= 0.1 ? 0.9 : 
                            targetOptions.maxSizeMB <= 0.3 ? 0.92 : 0.95;

      const compressionOptions = {
        maxSizeMB: targetOptions.maxSizeMB,
        maxWidthOrHeight: dimensionCeiling,
        useWebWorker: targetOptions.useWebWorker,
        fileType: effectiveFileType,
        initialQuality: initialQuality,
        alwaysKeepResolution: !targetOptions.customWidth && !targetOptions.customHeight && targetOptions.maxWidthOrHeight >= 16384,
        preserveExif: true,
      };

      let processedFile = await imageCompression(sourceFile as File, compressionOptions);
      
      // Update filename for stickers
      if (targetOptions.isSticker) {
        processedFile = new File([processedFile], job.file.name.replace(/\.[^/.]+$/, "") + "-sticker.png", { type: "image/png" });
      }
      
      // STAGE 3: Advanced Visual Alchemy & Structural Transmutation
      const hasStructuralChanges = targetOptions.rotate !== 0 || targetOptions.flipX || targetOptions.flipY || (targetOptions.customWidth && targetOptions.customHeight);
      const hasFilterChanges = targetOptions.brightness !== 100 || targetOptions.contrast !== 100 || 
                             targetOptions.saturation !== 100 || targetOptions.hue !== 0 || 
                             targetOptions.sepia !== 0 || targetOptions.blur !== 0 || 
                             targetOptions.grayscale || targetOptions.invert;

      if (hasStructuralChanges || hasFilterChanges) {
        try {
          const imgCanvas = await imageCompression.drawFileInCanvas(processedFile as File);
          const sourceCanvas = (Array.isArray(imgCanvas) ? imgCanvas[0] : imgCanvas) as unknown as HTMLCanvasElement;
          
          const finalCanvas = document.createElement('canvas');
          let targetWidth = targetOptions.customWidth || sourceCanvas.width;
          let targetHeight = targetOptions.customHeight || sourceCanvas.height;

          // Swap dimensions for 90/270deg rotation
          if (targetOptions.rotate % 180 !== 0) {
            [targetWidth, targetHeight] = [targetHeight, targetWidth];
          }

          finalCanvas.width = targetWidth;
          finalCanvas.height = targetHeight;
          const ctx = finalCanvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            ctx.save();
            
            // 1. Structural Transform
            ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
            ctx.rotate((targetOptions.rotate * Math.PI) / 180);
            ctx.scale(targetOptions.flipX ? -1 : 1, targetOptions.flipY ? -1 : 1);
            
            // 2. Visual Alchemy (Filters)
            const filters = [
              `brightness(${targetOptions.brightness}%)`,
              `contrast(${targetOptions.contrast}%)`,
              `saturate(${targetOptions.saturation}%)`,
              `hue-rotate(${targetOptions.hue}deg)`,
              `sepia(${targetOptions.sepia}%)`,
              `blur(${targetOptions.blur}px)`,
              targetOptions.grayscale ? 'grayscale(100%)' : '',
              targetOptions.invert ? 'invert(100%)' : ''
            ].filter(Boolean).join(' ');
            
            ctx.filter = filters;
            
            // 3. Render
            if (targetOptions.isSticker) {
              // Sticker Logic: Draw the subject with a stroke/shadow
              ctx.shadowColor = 'rgba(0,0,0,0.3)';
              ctx.shadowBlur = 15;
              ctx.shadowOffsetX = 5;
              ctx.shadowOffsetY = 5;

              // Draw border by drawing the image slightly offset in all directions or using a stroke
              // Simple stroke hack for canvas:
              const d = targetOptions.stickerBorderSize;
              ctx.save();
              ctx.globalCompositeOperation = 'source-over';
              // Draw "halo"
              for (let angle = 0; angle < 360; angle += 15) {
                const rad = angle * Math.PI / 180;
                ctx.drawImage(sourceCanvas, (-sourceCanvas.width / 2) + Math.cos(rad) * d, (-sourceCanvas.height / 2) + Math.sin(rad) * d, sourceCanvas.width, sourceCanvas.height);
              }
              // Fill halo with sticker color
              ctx.globalCompositeOperation = 'source-in';
              ctx.fillStyle = targetOptions.stickerBorderColor;
              ctx.fillRect(-sourceCanvas.width, -sourceCanvas.height, sourceCanvas.width * 2, sourceCanvas.height * 2);
              ctx.restore();
            }

            ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2, sourceCanvas.width, sourceCanvas.height);
            
            // 4. Typography Casting
            if (targetOptions.textOverlay.enabled && targetOptions.textOverlay.content) {
              ctx.restore(); // Exit the structural transform state to draw text globally or relative to final canvas
              ctx.save();
              
              const { content, fontSize, color, x, y, font } = targetOptions.textOverlay;
              ctx.font = `bold ${fontSize}px ${font}, sans-serif`;
              ctx.fillStyle = color;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              // Shadow for readability
              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = 10;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
              
              const posX = (finalCanvas.width * x) / 100;
              const posY = (finalCanvas.height * y) / 100;
              
              ctx.fillText(content, posX, posY);
            }

            ctx.restore();

            processedFile = await imageCompression.canvasToFile(
              finalCanvas, 
              effectiveFileType as any, 
              job.file.name, 
              job.file.lastModified
            ) as File;
          }
        } catch (canvasErr) {
          console.error('Advanced processing failed:', canvasErr);
        }
      }

      // STAGE 4: Cinematic Animation Engine (Optional GIF Output)
      if (effectiveFileType === 'image/gif') {
        const frames = [];
        const frameCount = targetOptions.gifFrameCount;
        const img = new Image();
        img.src = URL.createObjectURL(processedFile as Blob);
        await new Promise(r => img.onload = r);

        for (let i = 0; i < frameCount; i++) {
          const fCanvas = document.createElement('canvas');
          fCanvas.width = img.width;
          fCanvas.height = img.height;
          const fCtx = fCanvas.getContext('2d');
          if (fCtx) {
            const progress = i / (frameCount - 1);
            fCtx.save();
            
            if (targetOptions.gifAnimationStyle === 'zoom') {
              const zoom = 1 + (progress * 0.1); 
              const zWidth = img.width * zoom;
              const zHeight = img.height * zoom;
              fCtx.drawImage(img, -(zWidth - img.width) / 2, -(zHeight - img.height) / 2, zWidth, zHeight);
            } else if (targetOptions.gifAnimationStyle === 'pan') {
              const offset = (progress - 0.5) * 40; // Pan 40px
              fCtx.drawImage(img, offset, 0, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'pulse') {
              const opacity = 0.7 + Math.sin(progress * Math.PI) * 0.3;
              fCtx.globalAlpha = opacity;
              fCtx.drawImage(img, 0, 0, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'glitch') {
              const shift = Math.random() > 0.8 ? (Math.random() - 0.5) * 10 : 0;
              fCtx.drawImage(img, shift, 0, img.width, img.height);
              if (Math.random() > 0.9) {
                fCtx.fillStyle = 'rgba(255,0,0,0.1)';
                fCtx.fillRect(0, 0, img.width, img.height);
              }
            } else if (targetOptions.gifAnimationStyle === 'spin') {
              fCtx.translate(img.width / 2, img.height / 2);
              fCtx.rotate(progress * Math.PI * 2);
              fCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'shake') {
              const sX = (Math.random() - 0.5) * 15;
              const sY = (Math.random() - 0.5) * 15;
              fCtx.drawImage(img, sX, sY, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'float') {
              const fY = Math.sin(progress * Math.PI * 2) * 20;
              fCtx.drawImage(img, 0, fY, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'bounce') {
              const bY = Math.abs(Math.sin(progress * Math.PI * 2)) * -40;
              fCtx.drawImage(img, 0, bY, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'pivot') {
              fCtx.translate(img.width / 2, img.height);
              fCtx.rotate(Math.sin(progress * Math.PI * 2) * 0.15);
              fCtx.drawImage(img, -img.width / 2, -img.height, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'bloom') {
              const bloomScale = 1 + Math.sin(progress * Math.PI) * 0.05;
              fCtx.translate(img.width / 2, img.height / 2);
              fCtx.scale(bloomScale, bloomScale);
              fCtx.globalAlpha = 0.8 + Math.sin(progress * Math.PI) * 0.2;
              fCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'rainbow') {
              fCtx.drawImage(img, 0, 0, img.width, img.height);
              fCtx.globalCompositeOperation = 'source-atop';
              fCtx.fillStyle = `hsla(${progress * 360}, 80%, 60%, 0.4)`;
              fCtx.fillRect(0, 0, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'shimmer') {
              fCtx.drawImage(img, 0, 0, img.width, img.height);
              fCtx.globalCompositeOperation = 'source-atop';
              // Sweep across the whole image including padding
              const sweep = (progress * 2) - 0.5; 
              const gradient = fCtx.createLinearGradient(0, 0, img.width, img.height);
              gradient.addColorStop(Math.max(0, Math.min(1, sweep - 0.1)), 'rgba(255,255,255,0)');
              gradient.addColorStop(Math.max(0, Math.min(1, sweep)), 'rgba(255,255,255,0.9)');
              gradient.addColorStop(Math.max(0, Math.min(1, sweep + 0.1)), 'rgba(255,255,255,0)');
              fCtx.fillStyle = gradient;
              fCtx.fillRect(0, 0, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'heartbeat') {
              const hbScale = 1 + (Math.sin(progress * Math.PI * 2) > 0.5 ? 0.05 : 0) + (Math.sin(progress * Math.PI * 4) > 0.8 ? 0.03 : 0);
              fCtx.translate(img.width / 2, img.height / 2);
              fCtx.scale(hbScale, hbScale);
              fCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'ticking') {
              const tickRot = Math.floor(progress * 12) * (Math.PI / 6); // 12 steps
              const tickScale = 1 + (Math.sin(progress * Math.PI * 12) * 0.02);
              fCtx.translate(img.width / 2, img.height / 2);
              fCtx.rotate(tickRot);
              fCtx.scale(tickScale, tickScale);
              fCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
            } else if (targetOptions.gifAnimationStyle === 'celebrate') {
              fCtx.drawImage(img, 0, 0, img.width, img.height);
              // Draw "confetti" particles
              const particleCount = 20;
              for (let j = 0; j < particleCount; j++) {
                const px = (j * 17 + progress * 500) % img.width;
                const py = (j * 23 + progress * 800) % img.height;
                fCtx.fillStyle = `hsla(${(j * 30 + progress * 360) % 360}, 70%, 50%, 0.8)`;
                fCtx.beginPath();
                fCtx.arc(px, py, 2 + Math.sin(progress * 10 + j) * 1, 0, Math.PI * 2);
                fCtx.fill();
              }
            } else if (targetOptions.gifAnimationStyle === 'ghost') {
              fCtx.globalAlpha = 0.3;
              fCtx.drawImage(img, -5 + Math.sin(progress * 10) * 5, 0, img.width, img.height);
              fCtx.globalAlpha = 1.0;
              fCtx.drawImage(img, 0, 0, img.width, img.height);
            }
            
            fCtx.restore();
            frames.push(fCanvas.toDataURL('image/png'));
          }
        }

        const gifResult = await new Promise<string>((resolve, reject) => {
          gifshot.createGIF({
            images: frames,
            gifWidth: img.width > 800 ? 800 : img.width, 
            gifHeight: img.height > 600 ? 600 : img.height,
            interval: targetOptions.gifInterval,
            numFrames: frameCount,
            transparent: 0x000000, // Use index 0 for transparency (common in GIF encoding)
            sampleInterval: 10,
          }, (obj: any) => {
            if (!obj.error) resolve(obj.image);
            else reject(obj.error);
          });
        });

        const gifResponse = await fetch(gifResult);
        const gifBlob = await gifResponse.blob();
        processedFile = new File([gifBlob], job.file.name.replace(/\.[^/.]+$/, "") + ".gif", { type: "image/gif" });
      }

      const url = URL.createObjectURL(processedFile);
      const saved = ((job.originalSize - processedFile.size) / job.originalSize) * 100;

      setJobs(prev => prev.map(j => j.id === job.id ? { 
        ...j, 
        processedSize: processedFile.size, 
        processedUrl: url, 
        status: 'completed' as const,
        savedPercentage: Math.max(0, saved)
      } : j));
    } catch (e) {
      console.error('Forge Master Error:', e);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error' as const } : j));
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    // Process sequentially to avoid browser crash on too many parallel compressions
    for (const job of jobs) {
      if (job.status === 'pending' || job.status === 'error') {
        await processJob(job, options);
      }
    }
    setIsProcessingAll(false);
  };

  const deepForgeAll = async () => {
    if (completedJobs.length === 0) return;
    setIsDeepForgingAll(true);
    // Process sequentially to preserve quality and avoid browser hardware contention
    for (const job of jobs) {
      if (job.status === 'completed') {
        await processJob(job, options, true);
      }
    }
    setIsDeepForgingAll(false);
  };

  const harvestAllAsZip = async () => {
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.processedUrl);
    if (completedJobs.length === 0) return;

    setIsDownloadingZip(true);
    const zip = new JSZip();

    try {
      for (const job of completedJobs) {
        const response = await fetch(job.processedUrl!);
        const blob = await response.blob();
        
        // Resolve correct extension: use options if specific, otherwise use source's extension
        let extension = options.fileType === 'original' 
          ? job.file.name.split('.').pop() 
          : options.fileType.split('/')[1];
        
        const baseName = job.file.name.split('.')[0];
        const finaleName = options.isSticker ? `${baseName}-sticker.png` : `${baseName}-optimized.${extension}`;
        zip.file(finaleName, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brightlypix-optimized-${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to create ZIP package.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const removeJob = (id: string) => {
    setJobs(prev => {
      const job = prev.find(j => j.id === id);
      if (job?.originalUrl) URL.revokeObjectURL(job.originalUrl);
      if (job?.processedUrl) URL.revokeObjectURL(job.processedUrl);
      return prev.filter(j => j.id !== id);
    });
  };

  const clearAll = () => {
    jobs.forEach(j => {
      URL.revokeObjectURL(j.originalUrl);
      if (j.processedUrl) URL.revokeObjectURL(j.processedUrl);
    });
    setJobs([]);
  };

  const downloadJob = (job: ImageJob) => {
    if (!job.processedUrl) return;
    const link = document.createElement('a');
    link.href = job.processedUrl;
    
    const extension = options.fileType === 'original' 
      ? job.file.name.split('.').pop() 
      : options.fileType.split('/')[1];
      
    const baseName = job.file.name.split('.')[0];
    link.download = options.isSticker ? `${baseName}-sticker.png` : `${baseName}-optimized.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (view !== 'main') {
    const PageHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
      <header className="max-w-4xl mx-auto mb-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('main')}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all group"
          >
            <Plus className="w-6 h-6 rotate-45" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white italic tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] font-sans">BrightlyPix Legal Kernel</div>
      </header>
    );

    return (
      <div className="min-h-screen p-6 md:p-12 lg:p-24 font-sans selection:bg-blue-500/30">
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[#020617]" />
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
        </div>

        {view === 'privacy' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <PageHeader title="Privacy Policy" icon={CheckCircle2} />
            <div className="glass-panel rounded-[3rem] p-8 md:p-16 space-y-12 text-slate-300 leading-relaxed">
              <section className="space-y-4">
                <h2 className="text-2xl font-black text-white italic">01. Privacy Commitment</h2>
                <p>At BrightlyPix, we treat your data with extreme mechanical isolation. Unlike traditional cloud optimizers, our engine operates purely within your browser's private kernel. This means your images are processed locally and are never uploaded to our servers.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-white italic">02. Google AdSense & Cookies</h2>
                <p>We use Google AdSense to serve advertisements on our site. Google uses cookies to serve ads based on a user's prior visits to our website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to our users based on their visit to our sites and/or other sites on the Internet.</p>
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 italic text-sm">
                  Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" className="text-blue-400 underline" target="_blank">Ads Settings</a>.
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-white italic">03. Local Storage & Web Workers</h2>
                <p>We utilize the browser's IndexedDB and Web Workers to perform heavy computational tasks. This data remains on your physical device and is purged once you clear your browser cache or close the active forge session.</p>
              </section>

              <section className="space-y-4 pt-12 border-t border-white/5">
                <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest text-center">Last Updated: May 2026</p>
              </section>
            </div>
          </motion.div>
        )}

        {view === 'about' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto text-center">
            <PageHeader title="About BrightlyPix" icon={Zap} />
            <div className="glass-panel rounded-[3rem] p-16 space-y-8">
              <div className="w-24 h-24 rounded-3xl bg-linear-to-br from-blue-500 to-indigo-600 mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-8">
                <Zap className="w-12 h-12 text-white fill-white/20" />
              </div>
              <h2 className="text-4xl font-black text-white italic tracking-tighter">Decentralized Image Intelligence</h2>
              <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto">
                BrightlyPix was built with a singular mission: to provide the world's most powerful image optimization engine without the privacy cost of cloud computing.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                <div className="space-y-2">
                  <span className="text-4xl font-black text-blue-500/20 block">100%</span>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Client-Side</p>
                </div>
                <div className="space-y-2">
                  <span className="text-4xl font-black text-blue-500/20 block">0ms</span>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Server Latency</p>
                </div>
                <div className="space-y-2">
                  <span className="text-4xl font-black text-blue-500/20 block">∞</span>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Private Processing</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'contact' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <PageHeader title="Forge Support" icon={AlertCircle} />
            <div className="glass-panel rounded-[3rem] p-16 grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-8">
                <h2 className="text-3xl font-black text-white italic">Get in Touch</h2>
                <p className="text-slate-400">Encountering an error in the Forge? Our technical stewards are ready to assist with kernel-level troubleshooting.</p>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                      <CheckCircle2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Support</p>
                      <p className="font-bold text-white">support@brightlypix.engine</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transmitting From</label>
                  <p className="text-sm font-bold text-blue-400">{window.location.hostname}</p>
                </div>
                <div className="pt-4 space-y-4">
                   <p className="text-xs text-slate-500 italic">For security reasons, we only respond to inquiries regarding BrightlyPix technical specifications and AdSense partnership compliance.</p>
                   <button onClick={() => setView('main')} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all">Back to Dashboard</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <footer className="max-w-4xl mx-auto mt-24 py-12 border-t border-white/5 flex justify-center gap-12 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <button onClick={() => setView('privacy')} className="hover:text-blue-400 transition-colors">Privacy Policy</button>
            <button onClick={() => setView('about')} className="hover:text-blue-400 transition-colors">About Us</button>
            <button onClick={() => setView('contact')} className="hover:text-blue-400 transition-colors">Contact</button>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-12 font-sans overflow-x-hidden selection:bg-blue-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <header className="max-w-6xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <Zap className="w-8 h-8 text-white fill-white/20" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight gradient-text">BrightlyPix</h1>
            <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">Next-Gen Batch Engine</p>
          </div>
        </motion.div>

        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden sm:flex items-center gap-4 text-xs font-bold text-slate-500 bg-white/5 px-4 py-2 rounded-full border border-white/10"
          >
            <span className="flex items-center gap-1.5 uppercase font-black"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> GPU-Accelerated</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="flex items-center gap-1.5 uppercase font-black"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Secure</span>
          </motion.div>
          {jobs.length > 0 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={clearAll}
              className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
              title="Clear all"
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Workspace */}
        <section className="lg:col-span-8 space-y-6">
          {/* Upload Zone */}
          {jobs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-[2.5rem] p-12 border-dashed border-2 border-white/10 hover:border-blue-500/50 cursor-pointer transition-all duration-500 group relative"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleNewFiles(e.dataTransfer.files); }}
            >
              <div className="flex flex-col items-center justify-center py-16 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                  <div className="relative p-6 rounded-3xl bg-linear-to-br from-blue-500/10 to-indigo-500/10 border border-white/10 group-hover:scale-110 transition-transform">
                    <Upload className="w-16 h-16 text-blue-400" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-bold text-slate-100 italic tracking-tighter">Ignite the Forge</h3>
                  <p className="text-slate-500 font-medium">Drop multiples images or click to browse</p>
                </div>
                <div className="flex gap-4 pt-4">
                  {['JPG', 'PNG', 'WEBP', 'AVIF'].map(ext => (
                    <span key={ext} className="px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px] font-black text-slate-400 tracking-widest">{ext}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Forge Analytics Dashboard */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-3 gap-4 p-6 rounded-3xl bg-linear-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20"
              >
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Input Load</p>
                  <p className="text-2xl font-black text-slate-200 tabular-nums">{formatBytes(totalQueueWeight)}</p>
                </div>
                <div className="space-y-1 border-x border-white/5 px-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Bandwidth Saved</p>
                  <p className={cn(
                    "text-2xl font-black tabular-nums transition-colors",
                    totalSaved > 0 ? "text-emerald-400" : totalSaved < 0 ? "text-amber-400" : "text-slate-400"
                  )}>
                    {formatBytes(totalSaved)}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Efficiency</p>
                  <p className={cn(
                    "text-2xl font-black tabular-nums transition-colors",
                    avgSavedPercent > 0 ? "text-blue-400" : avgSavedPercent < 0 ? "text-red-400" : "text-slate-400"
                  )}>
                    {avgSavedPercent.toFixed(0)}%
                  </p>
                </div>
              </motion.div>

              <div className="flex items-center justify-between px-4">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Queue — {jobs.length} Assets
                </h3>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 px-3 py-1.5 bg-blue-400/10 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add More
                </button>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {jobs.map((job) => (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => job.status === 'completed' && setSelectedJob(job)}
                      className={cn(
                        "glass-panel rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group transition-all",
                        job.status === 'completed' && "cursor-zoom-in hover:border-blue-500/30 hover:bg-white/10"
                      )}
                    >
                      {/* Thumbnail Placeholder */}
                      <div className="w-16 h-16 rounded-xl bg-black/40 flex-shrink-0 flex items-center justify-center border border-white/5 relative overflow-hidden">
                        <img 
                          src={job.processedUrl || job.originalUrl} 
                          alt="Thumbnail preview" 
                          className={cn(
                            "w-full h-full object-cover transition-opacity duration-300",
                            job.status === 'processing' && "opacity-40"
                          )} 
                        />
                        {job.status === 'processing' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          </div>
                        )}
                        {job.status === 'error' && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-200 truncate pr-4">{job.file.name}</p>
                          <div className="flex items-center gap-2">
                            {job.savedPercentage !== null && (
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                                job.savedPercentage > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-slate-500"
                              )}>
                                {job.savedPercentage.toFixed(0)}% Saved
                              </span>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeJob(job.id); }}
                              className="p-1.5 md:opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all z-10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Progress / Status Bar */}
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                            {job.status === 'completed' && (
                              <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: '100%' }} 
                                className="h-full bg-linear-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                              />
                            )}
                            {job.status === 'processing' && (
                              <motion.div 
                                animate={{ left: ['-100%', '100%'] }} 
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute top-0 bottom-0 w-1/3 bg-linear-to-r from-blue-500 to-indigo-500" 
                              />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs font-medium shrink-0">
                            <span className="text-slate-500">{formatBytes(job.originalSize)}</span>
                            {job.processedSize && (
                              <>
                                <ChevronRight className="w-3 h-3 text-slate-700 font-bold" />
                                <span className="text-blue-400 font-bold">{formatBytes(job.processedSize)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Download & Re-process Individual */}
                      <AnimatePresence>
                        {job.status === 'completed' && (
                          <motion.div
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="flex items-center gap-2 ml-2"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); processJob(job, options); }}
                              className="p-2.5 bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-xl transition-all"
                              title="Re-forge from Original"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); processJob(job, options, true); }}
                              className="p-2.5 bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all border border-blue-500/20"
                              title="Deep Forge (Chain output back into input)"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadJob(job); }}
                              className="p-2.5 bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded-xl transition-all"
                              title="Download asset"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleNewFiles(e.target.files)} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </section>

        {/* Sidebar Controls */}
        <aside className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel rounded-[2rem] p-6 space-y-6 sticky top-8"
          >
            {/* Sidebar Tabs */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              {[
                { id: 'optim', label: 'Forge', icon: Zap },
                { id: 'edit', label: 'Visuals', icon: Sliders },
                { id: 'intel', label: 'Neural', icon: Brain }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === tab.id 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-6 min-h-[320px]">
              {activeTab === 'optim' && (
                <motion.div 
                  initial={{ opacity: 0, x: 5 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Compression Intensity</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Standard', mb: 0.5, q: '0.85', desc: 'Web Ready' },
                        { label: 'Extreme', mb: 0.08, q: '0.6', desc: 'Binary Crush' },
                        { label: 'Tiny', mb: 0.02, q: '0.4', desc: 'Ultra Minimal' }
                      ].map((tier) => (
                        <button
                          key={tier.label}
                          onClick={() => {
                            setOptions(prev => ({ 
                              ...prev, 
                              maxSizeMB: tier.mb,
                            }));
                          }}
                          className={cn(
                            "py-3 rounded-xl border flex flex-col items-center gap-1 transition-all",
                            options.maxSizeMB === tier.mb
                              ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                              : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10"
                          )}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">{tier.label}</span>
                          <span className="text-[8px] opacity-60 tabular-nums">{tier.mb}MB</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-600 italic px-1 font-medium leading-relaxed">Values below 0.1MB (~100KB) trigger aggressive neural optimization. "Extreme" and "Tiny" modes use lower quality coefficients to match Resize.com binary footprints.</p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dimension Ceiling</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[1080, 1920, 3840, 16384].map((size) => (
                        <button
                          key={size}
                          onClick={() => setOptions(prev => ({ ...prev, maxWidthOrHeight: size, customWidth: null, customHeight: null }))}
                          className={cn(
                            "py-3 text-[10px] font-black rounded-xl border transition-all uppercase tracking-widest",
                            options.maxWidthOrHeight === size && !options.customWidth
                              ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                              : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10"
                          )}
                        >
                          {size === 16384 ? 'Original' : size === 3840 ? '4K' : size === 1920 ? 'Desktop' : 'Web'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Custom Resolution</label>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <input 
                          type="number" 
                          placeholder="Width"
                          value={options.customWidth || ''}
                          onChange={(e) => setOptions(prev => ({ ...prev, customWidth: parseInt(e.target.value) || null }))}
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-blue-500/50 outline-none transition-all"
                        />
                      </div>
                      <div className="flex items-center text-slate-700">×</div>
                      <div className="flex-1 space-y-1">
                        <input 
                          type="number" 
                          placeholder="Height"
                          value={options.customHeight || ''}
                          onChange={(e) => setOptions(prev => ({ ...prev, customHeight: parseInt(e.target.value) || null }))}
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-blue-500/50 outline-none transition-all"
                        />
                      </div>
                    </div>
                    {(options.customWidth || options.customHeight) && (
                      <p className="text-[9px] text-blue-400/60 italic font-medium px-1">Exact crop-resize applied on output</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Alloy</label>
                    <div className="flex flex-wrap gap-2">
                      {['original', 'image/jpeg', 'image/webp', 'image/png', 'image/gif'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setOptions(prev => ({ ...prev, fileType: type }))}
                          className={cn(
                            "flex-1 py-3 px-2 text-[10px] font-black rounded-xl border transition-all uppercase tracking-tighter whitespace-nowrap min-w-[70px]",
                            options.fileType === type 
                              ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" 
                              : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10"
                          )}
                        >
                          {type === 'original' ? 'Original' : type === 'image/gif' ? 'Cinematic GIF' : type.split('/')[1]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {options.fileType === 'image/gif' && !options.isSticker && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <Zap className="w-3 h-3" /> Kinetic Motion Studio
                        </label>
                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                           Frames: {options.gifFrameCount}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'zoom', label: 'Zoom', icon: '🔍' },
                          { id: 'pan', label: 'Pan', icon: '↔️' },
                          { id: 'pulse', label: 'Pulse', icon: '💓' },
                          { id: 'glitch', label: 'Glitch', icon: '👾' },
                          { id: 'spin', label: 'Spin', icon: '🌀' },
                          { id: 'shake', label: 'Shake', icon: '📳' },
                          { id: 'float', label: 'Float', icon: '🎈' },
                          { id: 'bounce', label: 'Bounce', icon: '⚽' },
                          { id: 'pivot', label: 'Pivot', icon: '⚖️' },
                          { id: 'bloom', label: 'Bloom', icon: '🌸' },
                          { id: 'rainbow', label: 'Prism', icon: '🌈' },
                          { id: 'shimmer', label: 'Shine', icon: '✨' },
                          { id: 'heartbeat', label: 'Love', icon: '❤️' },
                          { id: 'ticking', label: 'Tick', icon: '⏰' },
                          { id: 'celebrate', label: 'Party', icon: '🎊' },
                          { id: 'ghost', label: 'Spirit', icon: '👻' }
                        ].map(style => (
                          <button
                            key={style.id}
                            onClick={() => setOptions(prev => ({ ...prev, gifAnimationStyle: style.id as any }))}
                            className={cn(
                              "py-2 px-3 rounded-xl border flex items-center justify-between transition-all",
                              options.gifAnimationStyle === style.id 
                                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" 
                                : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase">{style.label}</span>
                            <span className="text-xs">{style.icon}</span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Fluidity (Speed)</label>
                          <input 
                            type="range" min="0.05" max="0.5" step="0.05"
                            value={options.gifInterval}
                            onChange={(e) => setOptions(prev => ({ ...prev, gifInterval: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Density (Frames)</label>
                          <input 
                            type="range" min="5" max="30" step="1"
                            value={options.gifFrameCount}
                            onChange={(e) => setOptions(prev => ({ ...prev, gifFrameCount: parseInt(e.target.value) }))}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Sticker Creator Engine */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-200 uppercase tracking-widest block">Neural Sticker Mode</label>
                        <p className="text-[8px] text-slate-500 italic">Auto-isolate & add die-cut border</p>
                      </div>
                      <button 
                        onClick={() => setOptions(prev => ({ 
                          ...prev, 
                          isSticker: !prev.isSticker,
                          removeBackground: !prev.isSticker ? true : prev.removeBackground, // Auto-enable bg removal for stickers
                          fileType: !prev.isSticker ? 'image/png' : prev.fileType
                        }))}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative flex items-center px-1",
                          options.isSticker ? "bg-emerald-600" : "bg-white/10"
                        )}
                      >
                        <motion.div 
                          animate={{ x: options.isSticker ? 20 : 0 }}
                          className="w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    {options.isSticker && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4 pt-4 border-t border-white/5"
                      >
                        {/* Integrated Kinetic Motion Studio for Live Stickers */}
                        <div className="space-y-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                              <Zap className="w-3 h-3" /> Live Animation (GIF)
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={options.fileType === 'image/gif'}
                                onChange={(e) => setOptions(prev => ({ ...prev, fileType: e.target.checked ? 'image/gif' : 'image/png' }))}
                                className="hidden"
                              />
                              <div className={cn(
                                "text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest transition-all",
                                options.fileType === 'image/gif' ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-500"
                              )}>
                                {options.fileType === 'image/gif' ? 'Active' : 'Static'}
                              </div>
                            </label>
                          </div>

                          {options.fileType === 'image/gif' && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { id: 'zoom', label: 'Zoom', icon: '🔍' },
                                  { id: 'pan', label: 'Pan', icon: '↔️' },
                                  { id: 'pulse', label: 'Pulse', icon: '💓' },
                                  { id: 'glitch', label: 'Glitch', icon: '👾' },
                                  { id: 'spin', label: 'Spin', icon: '🌀' },
                                  { id: 'shake', label: 'Shake', icon: '📳' },
                                  { id: 'float', label: 'Float', icon: '🎈' },
                                  { id: 'bounce', label: 'Bounce', icon: '⚽' },
                                  { id: 'pivot', label: 'Pivot', icon: '⚖️' },
                                  { id: 'bloom', label: 'Bloom', icon: '🌸' },
                                  { id: 'rainbow', label: 'Prism', icon: '🌈' },
                                  { id: 'shimmer', label: 'Shine', icon: '✨' },
                                  { id: 'heartbeat', label: 'Heart', icon: '❤️' },
                                  { id: 'ticking', label: 'Clock', icon: '⏰' },
                                  { id: 'celebrate', label: 'Birth', icon: '🎂' },
                                  { id: 'ghost', label: 'Echo', icon: '🌪️' }
                                ].map(style => (
                                  <button
                                    key={style.id}
                                    onClick={() => setOptions(prev => ({ ...prev, gifAnimationStyle: style.id as any }))}
                                    className={cn(
                                      "py-2 px-3 rounded-xl border flex items-center justify-between transition-all",
                                      options.gifAnimationStyle === style.id 
                                        ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" 
                                        : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10"
                                    )}
                                  >
                                    <span className="text-[10px] font-bold uppercase">{style.label}</span>
                                    <span className="text-xs">{style.icon}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Speed</label>
                                  <input 
                                    type="range" min="0.05" max="0.5" step="0.05"
                                    value={options.gifInterval}
                                    onChange={(e) => setOptions(prev => ({ ...prev, gifInterval: parseFloat(e.target.value) }))}
                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Quality (Frames)</label>
                                  <input 
                                    type="range" min="5" max="30" step="1"
                                    value={options.gifFrameCount}
                                    onChange={(e) => setOptions(prev => ({ ...prev, gifFrameCount: parseInt(e.target.value) }))}
                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Border Width ({options.stickerBorderSize}px)</label>
                            <input 
                              type="range" min="4" max="40"
                              value={options.stickerBorderSize}
                              onChange={(e) => setOptions(prev => ({ ...prev, stickerBorderSize: parseInt(e.target.value) }))}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Die-Cut Color</label>
                             <div className="flex flex-wrap gap-2">
                               {[
                                 '#ffffff', '#000000', '#fbbf24', '#f43f5e', 
                                 '#8b5cf6', '#3b82f6', '#10b981', '#f97316',
                                 '#ec4899', '#06b6d4', '#eab308'
                               ].map(c => (
                                 <button 
                                   key={c}
                                   onClick={() => setOptions(prev => ({ ...prev, stickerBorderColor: c }))}
                                   className={cn(
                                     "w-5 h-5 rounded-md border transition-all",
                                     options.stickerBorderColor === c ? "border-white scale-110" : "border-white/20"
                                   )}
                                   style={{ backgroundColor: c }}
                                 />
                               ))}
                             </div>
                           </div>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex gap-3">
                           <Scissors className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                           <p className="text-[8px] text-slate-400 leading-relaxed italic">
                             Engine will isolated the central subject using neural networks and apply a vector-style bleed border. Enable "Live" above to export as an animated decal.
                           </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'edit' && (
                <motion.div 
                  initial={{ opacity: 0, x: 5 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="space-y-4"
                >
                  {/* Live Vision Preview */}
                  <div className="relative aspect-video bg-black/60 rounded-2xl border border-white/10 overflow-hidden group shadow-inner bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                    {jobs.length > 0 ? (
                      <div 
                        className={cn(
                          "w-full h-full bg-center bg-contain bg-no-repeat transition-all duration-300",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'zoom' && "animate-preview-zoom",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'pan' && "animate-preview-pan",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'pulse' && "animate-preview-pulse",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'glitch' && "animate-preview-glitch",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'spin' && "animate-preview-spin",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'shake' && "animate-preview-shake",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'float' && "animate-preview-float",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'bounce' && "animate-preview-bounce",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'pivot' && "animate-preview-pivot",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'bloom' && "animate-preview-bloom",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'rainbow' && "animate-preview-rainbow",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'shimmer' && "animate-preview-shimmer",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'heartbeat' && "animate-preview-heartbeat",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'ticking' && "animate-preview-ticking",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'celebrate' && "animate-preview-celebrate",
                          options.fileType === 'image/gif' && options.gifAnimationStyle === 'ghost' && "animate-preview-ghost"
                        )}
                        style={{ 
                          backgroundImage: `url(${jobs[0].processedUrl || jobs[0].originalUrl})`,
                          padding: options.isSticker ? `${options.stickerBorderSize / 4}px` : '0px',
                          boxShadow: options.isSticker ? `0 0 0 ${options.stickerBorderSize / 8}px ${options.stickerBorderColor}, 0 10px 20px rgba(0,0,0,0.3)` : 'none',
                          filter: [
                            `brightness(${options.brightness}%)`,
                            `contrast(${options.contrast}%)`,
                            `saturate(${options.saturation}%)`,
                            `sepia(${options.sepia}%)`,
                            `blur(${options.blur}px)`,
                            options.grayscale ? 'grayscale(100%)' : '',
                            options.invert ? 'invert(100%)' : ''
                          ].filter(Boolean).join(' '),
                          transform: `rotate(${options.rotate}deg) scale(${options.flipX ? -1 : 1}, ${options.flipY ? -1 : 1})`
                        }}
                      >
                        {options.textOverlay.enabled && options.textOverlay.content && (
                          <div 
                            className="absolute pointer-events-none font-bold text-center drop-shadow-md whitespace-pre-wrap px-2 select-none"
                            style={{ 
                              top: `${options.textOverlay.y}%`, 
                              left: `${options.textOverlay.x}%`,
                              color: options.textOverlay.color,
                              fontSize: `clamp(8px, ${options.textOverlay.fontSize * 0.18}px, 5vw)`,
                              transform: 'translate(-50%, -50%)',
                              fontFamily: options.textOverlay.font,
                              textShadow: '1px 1px 3px rgba(0,0,0,0.4)'
                            }}
                          >
                            {options.textOverlay.content}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-700 italic">
                        <FocusIcon className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Subject</p>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                       <span className="text-[8px] font-black text-white uppercase tracking-tighter">Live Refraction</span>
                    </div>
                  </div>

                  {/* Category Switcher */}
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    {[
                      { id: 'filters', label: 'Presets', icon: Palette },
                      { id: 'adjust', label: 'Adjust', icon: Sliders },
                      { id: 'text', label: 'Type', icon: Type },
                      { id: 'transform', label: 'Cast', icon: Crop }
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setActiveVisualSubTab(st.id as any)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all",
                          activeVisualSubTab === st.id 
                            ? "bg-white/10 text-white shadow-sm" 
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        <st.icon className="w-2.5 h-2.5" />
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {activeVisualSubTab === 'filters' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3 pb-4">
                        {PRESETS.map((p) => (
                          <button key={p.name} onClick={() => applyPreset(p)} className="group relative flex flex-col items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all text-center">
                            <span className="text-2xl group-hover:scale-110 transition-transform">{p.icon}</span>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">{p.name}</p>
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {activeVisualSubTab === 'adjust' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-4">
                        {[
                          { label: 'Brightness', key: 'brightness', icon: Sun },
                          { label: 'Contrast', key: 'contrast', icon: ContrastIcon },
                          { label: 'Saturation', key: 'saturation', icon: Droplets }
                        ].map(f => (
                          <div key={f.key} className="space-y-3">
                            <div className="flex justify-between items-center text-[9px] font-bold">
                              <span className="text-slate-500 uppercase tracking-widest flex items-center gap-2"><f.icon className="w-3 h-3" />{f.label}</span>
                              <span className="text-slate-300 tabular-nums">{(options as any)[f.key]}%</span>
                            </div>
                            <input type="range" min="0" max="200" value={(options as any)[f.key]} onChange={(e) => setOptions(prev => ({ ...prev, [f.key]: parseInt(e.target.value) }))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {activeVisualSubTab === 'text' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                         <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Active Overlay</span>
                            <p className="text-[8px] text-slate-500 italic">Render typography layer</p>
                          </div>
                          <button 
                            onClick={() => setOptions(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, enabled: !prev.textOverlay.enabled } }))}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative flex items-center px-1",
                              options.textOverlay.enabled ? "bg-blue-600" : "bg-white/10"
                            )}
                          >
                            <motion.div 
                              animate={{ x: options.textOverlay.enabled ? 20 : 0 }}
                              className="w-3 h-3 bg-white rounded-full shadow-sm"
                            />
                          </button>
                        </div>

                        <div className={cn("space-y-6 transition-all", !options.textOverlay.enabled && "opacity-20 pointer-events-none grayscale")}>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Message Content</label>
                             <input 
                               type="text" 
                               value={options.textOverlay.content}
                               onChange={(e) => setOptions(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, content: e.target.value } }))}
                               placeholder="Enter caption..."
                               className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-slate-200 focus:border-blue-500/50 outline-none transition-all"
                             />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Size ({options.textOverlay.fontSize}px)</label>
                              <input 
                                type="range" min="10" max="200"
                                value={options.textOverlay.fontSize}
                                onChange={(e) => setOptions(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, fontSize: parseInt(e.target.value) } }))}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Color Shade</label>
                               <div className="flex gap-2">
                                 {['#ffffff', '#000000', '#3b82f6', '#ef4444', '#10b981'].map(c => (
                                   <button 
                                     key={c}
                                     onClick={() => setOptions(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, color: c } }))}
                                     className={cn(
                                       "w-6 h-6 rounded-full border-2 transition-all",
                                       options.textOverlay.color === c ? "border-white scale-110 shadow-lg" : "border-transparent"
                                     )}
                                     style={{ backgroundColor: c }}
                                   />
                                 ))}
                               </div>
                            </div>
                          </div>

                          <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                              <Move className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coordinant Precision</span>
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-[8px] font-bold text-slate-500">
                                   <span>Horizontal</span>
                                   <span>{options.textOverlay.x}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="100"
                                  value={options.textOverlay.x}
                                  onChange={(e) => setOptions(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, x: parseInt(e.target.value) } }))}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-slate-400"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-[8px] font-bold text-slate-500">
                                   <span>Vertical</span>
                                   <span>{options.textOverlay.y}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="100"
                                  value={options.textOverlay.y}
                                  onChange={(e) => setOptions(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, y: parseInt(e.target.value) } }))}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-slate-400"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {activeVisualSubTab === 'transform' && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2 pb-4">
                         <button onClick={() => setOptions(prev => ({ ...prev, rotate: (prev.rotate + 90) % 360 }))} className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all group font-sans">
                           <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                           <span className="text-[10px] font-bold text-slate-500">Rotate</span>
                         </button>
                         <button onClick={() => setOptions(prev => ({ ...prev, flipX: !prev.flipX }))} className={cn("flex flex-col items-center gap-2 p-4 border rounded-xl transition-all font-sans", options.flipX ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-white/5 border-white/5 text-slate-500")}>
                           <FlipHorizontal className="w-4 h-4" />
                           <span className="text-[10px] font-bold">Flip X</span>
                         </button>
                       </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'intel' && (
                <motion.div 
                  initial={{ opacity: 0, x: 5 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="space-y-6"
                >
                  <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <ImageIcon className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Neural Subject Extraction</h4>
                        <p className="text-[10px] text-slate-500 italic">Edge-based processing</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'isnet_fp16', label: 'Fast', desc: 'Lower precision' },
                        { id: 'isnet', label: 'Balanced', desc: 'Highly Intelligent' }
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setOptions(prev => ({ ...prev, aiModel: m.id as any }))}
                          className={cn(
                            "p-3 rounded-xl border flex flex-col items-center gap-1 transition-all",
                            options.aiModel === m.id 
                              ? "bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20" 
                              : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                          )}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                          <span className="text-[8px] opacity-70 font-medium">{m.desc}</span>
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => setOptions(prev => ({ ...prev, removeBackground: !prev.removeBackground }))}
                      className={cn(
                        "w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                        options.removeBackground 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" 
                          : "bg-white/5 text-slate-500 hover:bg-white/10 border border-white/5"
                      )}
                    >
                      {options.removeBackground ? 'Background Removal Active' : 'Enable Neural Removal'}
                    </button>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-indigo-400">Mechanical Privacy</p>
                    <p className="text-[9px] text-slate-600 leading-relaxed font-medium italic">
                      Neural removal models are downloaded to your browser and run locally. No API keys or cloud relays are used. Your hardware does the heavy lifting.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={processAll}
                disabled={jobs.length === 0 || isProcessingAll || isDeepForgingAll}
                className={cn(
                  "w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] flex items-center justify-center gap-3 transition-all relative overflow-hidden shadow-2xl disabled:grayscale",
                  jobs.length === 0 || isProcessingAll || isDeepForgingAll
                    ? "bg-white/5 text-slate-700" 
                    : "bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-blue-500/40"
                )}
              >
                {isProcessingAll && (
                  <motion.div 
                    className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  />
                )}
                <div className="relative flex items-center gap-3">
                  {isProcessingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white/20" />}
                  {isProcessingAll ? 'Engaging Core Forge...' : 'Melt & Cast Batch'}
                </div>
              </motion.button>

              {completedJobs.length > 0 && (
                <button
                  onClick={deepForgeAll}
                  disabled={isProcessingAll || isDeepForgingAll}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 transition-all active:scale-95 border",
                    isDeepForgingAll 
                      ? "bg-white/5 border-white/5 text-slate-600" 
                      : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 shadow-lg shadow-blue-500/5"
                  )}
                >
                  {isDeepForgingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deep Forging All...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Mass Deep Forge Chain
                    </>
                  )}
                </button>
              )}

              <button
                onClick={harvestAllAsZip}
                disabled={!jobs.some(j => j.status === 'completed') || isDownloadingZip}
                className="w-full py-4 text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-2 group transition-all disabled:opacity-50"
              >
                {isDownloadingZip ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                )}
                {isDownloadingZip ? 'Archiving...' : 'Harvest All (ZIP)'}
              </button>
            </div>

            {/* Sidebar Ad Unit */}
            <GoogleAd className="mt-4" />
          </motion.div>
        </aside>
      </main>

      {/* Mid-Page Display Ad */}
      <div className="max-w-6xl mx-auto mt-12 bg-white/5 p-2 rounded-[2rem] border border-white/5">
        <GoogleAd format="horizontal" className="min-h-[90px]" />
      </div>

      {/* Powerful Documentation Section */}
      <section className="max-w-6xl mx-auto mt-32 space-y-24 pb-24 border-t border-white/5 pt-24">
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4"
          >
            Technical Manifest
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter">Forge Operations Manual</h2>
          <p className="text-slate-500 max-w-2xl mx-auto font-medium">
            BrightlyPix isn't just a compressor. It's a localized image laboratory running neural networks and hardware-accelerated synthesis directly in your browser.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: "Deep Forge™ Chaining",
              desc: "The core innovation. Unlike static optimizers, BrightlyPix allows you to feed output back into input recursively. Click the Zap icon to compress again and again for extreme size reduction.",
              icon: Zap,
              color: "text-blue-400",
              bgColor: "bg-blue-400/10"
            },
            {
              title: "Neural Extraction",
              desc: "Leverage AI-driven background removal. Using dedicated neural models that download once and run locally, you can isolate subjects without sending data to a server.",
              icon: Maximize2,
              color: "text-indigo-400",
              bgColor: "bg-indigo-400/10"
            },
            {
              title: "Multi-Alloy Synthesis",
              desc: "Convert assets to WEBP, PNG, or JPEG on the fly. Set your 'Target Alloy' in the sidebar to normalize entire batches into a single high-efficiency format.",
              icon: RefreshCw,
              color: "text-emerald-400",
              bgColor: "bg-emerald-400/10"
            },
            {
              title: "Atomic Resizing",
              desc: "From 4K ceilings to exact pixel-perfect crops. The engine performs hard-canvas resizing to ensure your output matches your exact architectural requirements.",
              icon: ImageIcon,
              color: "text-amber-400",
              bgColor: "bg-amber-400/10"
            },
            {
              title: "Privacy Shield",
              desc: "BrightlyPix is 100% decentralized. Processing happens in your browser's WebWorkers. Your images, your data, and your privacy never leave your local machine.",
              icon: CheckCircle2,
              color: "text-purple-400",
              bgColor: "bg-purple-400/10"
            },
            {
              title: "Batch Propulsion",
              desc: "Engineered for scale. Drop hundreds of images and watch the sequence processor churn through them using your GPU's specialized compute kernels.",
              icon: FileDown,
              color: "text-rose-400",
              bgColor: "bg-rose-400/10"
            }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-panel p-8 rounded-[2rem] border border-white/5 space-y-4 hover:border-blue-500/20 transition-all group"
            >
              <div className={cn("p-4 rounded-2xl inline-block", feature.bgColor)}>
                <feature.icon className={cn("w-6 h-6", feature.color)} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* How it Works / Steps */}
        <div className="glass-panel p-12 rounded-[3rem] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none" />
          
          <div className="relative space-y-12">
            <h3 className="text-3xl font-black text-white italic">The Forging Process</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              {[
                { step: "01", title: "Ingestion", desc: "Files are parsed and previewed as Blob URLs." },
                { step: "02", title: "Transformation", desc: "Neural processing or canvas filters are applied." },
                { step: "03", title: "Casting", desc: "Binary compression reduces density while preserving detail." },
                { step: "04", title: "Harvest", desc: "Export as individual files or a unified ZIP archive." }
              ].map((step, idx) => (
                <div key={idx} className="space-y-4">
                  <span className="text-4xl font-black text-white/5 tracking-tighter block">{step.step}</span>
                  <h4 className="text-lg font-bold text-blue-400 uppercase tracking-widest break-words">{step.title}</h4>
                  <p className="text-sm text-slate-500 font-medium leading-snug">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Multiplex Ad Unit - High Revenue Potential */}
        <div className="pt-12">
          <div className="text-center mb-8">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">Sponsored Content</p>
          </div>
          <GoogleAd format="autorelaxed" className="min-h-[400px]" />
        </div>
      </section>

      <footer className="max-w-6xl mx-auto mt-24 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 hover:opacity-100 transition-all">
        <div className="text-[10px] font-black text-slate-500 flex items-center gap-4 uppercase tracking-[0.2em]">
          <span>Forge Kernel v2.8</span>
          <span className="w-1 h-1 rounded-full bg-slate-800" />
          <span>Local Stack Compression</span>
        </div>
        <div className="flex gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <button onClick={() => setView('about')} className="hover:text-blue-400 transition-colors">About Us</button>
          <button onClick={() => setView('privacy')} className="hover:text-blue-400 transition-colors">Privacy Policy</button>
          <button onClick={() => setView('contact')} className="hover:text-blue-400 transition-colors">Contact</button>
        </div>
      </footer>

      {/* Toast Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 p-4 px-6 rounded-2xl bg-red-500 text-white shadow-2xl flex items-center gap-3 z-50 font-bold text-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedJob(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-6xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-blue-400" /> Image Inspector
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs md:max-w-md">{selectedJob.file.name}</p>
                </div>
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-black/20">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Original State</span>
                      <span className="text-[9px] text-slate-600 font-bold uppercase tabular-nums" id={`orig-resol-${selectedJob.id}`}>Loading dimensions...</span>
                    </div>
                    <span className="text-sm font-bold text-slate-300">{formatBytes(selectedJob.originalSize)}</span>
                  </div>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-white/5 shadow-2xl relative">
                    <img 
                      src={selectedJob.originalUrl} 
                      className="w-full h-full object-contain" 
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const el = document.getElementById(`orig-resol-${selectedJob.id}`);
                        if (el) el.innerText = `${img.naturalWidth} × ${img.naturalHeight} PX`;
                      }}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">Optimized Output</span>
                      <span className="text-[9px] text-blue-500/50 font-bold uppercase tabular-nums" id={`proc-resol-${selectedJob.id}`}>—</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-400">{selectedJob.processedSize ? formatBytes(selectedJob.processedSize) : 'Processing...'}</span>
                      <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">-{selectedJob.savedPercentage?.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-blue-500/20 shadow-2xl relative">
                    {selectedJob.processedUrl ? (
                      <img 
                        src={selectedJob.processedUrl} 
                        className="w-full h-full object-contain" 
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          const el = document.getElementById(`proc-resol-${selectedJob.id}`);
                          if (el) el.innerText = `${img.naturalWidth} × ${img.naturalHeight} PX`;
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-4">
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="px-6 py-3 font-bold text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Close Inspector
                </button>
                {selectedJob.status === 'completed' && (
                  <button 
                    onClick={() => downloadJob(selectedJob)}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20"
                  >
                    Download This Asset
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

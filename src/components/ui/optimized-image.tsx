import React, { useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  fill?: boolean
}

export function OptimizedImage({ src, alt, className, fallbackClassName, objectFit = 'cover', fill, ...props }: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const shouldFill = fill ?? (!props.width && !props.height)

  if (!src || error) {
    return (
      <div className={cn("w-full h-full bg-slate-900 flex items-center justify-center", fallbackClassName)}>
        <ImageIcon className="w-8 h-8 text-slate-700" />
      </div>
    )
  }

  const isValidUrl = typeof src === 'string' && (src.startsWith('/') || src.startsWith('http') || src.startsWith('//') || src.startsWith('blob:'))

  if (!src || error || !isValidUrl) {
    return (
      <div className={cn("w-full h-full bg-slate-900 flex items-center justify-center", fallbackClassName)}>
        <ImageIcon className="w-8 h-8 text-slate-700" />
      </div>
    )
  }

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-10 transition-opacity duration-300">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      )}
      <img
        src={typeof src === 'string' ? src : undefined}
        alt={alt || "Asset preview"}
        className={cn(
          "transition-all duration-300",
          objectFit === 'cover' ? "object-cover" : 
          objectFit === 'contain' ? "object-contain" : 
          objectFit === 'fill' ? "object-fill" : 
          objectFit === 'none' ? "object-none" : "object-scale-down",
          isLoading ? "scale-105" : "scale-100"
        )}
        style={shouldFill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : undefined}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setError(true)
        }}
        {...props}
      />
    </div>
  )
}

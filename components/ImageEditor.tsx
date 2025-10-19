
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Icon } from './Icon';

interface ImageEditorProps {
  imageSrc: string;
}

export interface ImageEditorRef {
  getMaskAsBase64: () => string;
}

export const ImageEditor = forwardRef<ImageEditorRef, ImageEditorProps>(({ imageSrc }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(40);

  const drawOnCanvas = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let currentX, currentY;
    if ('touches' in e.nativeEvent) {
      currentX = (e.nativeEvent.touches[0].clientX - rect.left) * scaleX;
      currentY = (e.nativeEvent.touches[0].clientY - rect.top) * scaleY;
    } else {
      currentX = (e.nativeEvent.offsetX) * scaleX;
      currentY = (e.nativeEvent.offsetY) * scaleY;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (lastPointRef.current) {
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
    }
    // Draw a circle at the current point to fill gaps
    ctx.beginPath();
    ctx.arc(currentX, currentY, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    lastPointRef.current = { x: currentX, y: currentY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    lastPointRef.current = null; // Reset last point
    drawOnCanvas(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };
  
  const handleDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    drawOnCanvas(e);
  };

  useEffect(() => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      imageRef.current = image;
      const canvases = [imageCanvasRef.current, drawingCanvasRef.current];
      canvases.forEach(canvas => {
        if (canvas) {
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
        }
      });
      const imageCtx = imageCanvasRef.current?.getContext('2d');
      if (imageCtx) {
        imageCtx.drawImage(image, 0, 0);
      }
    };
  }, [imageSrc]);

  const clearMask = () => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    getMaskAsBase64: () => {
      const drawingCanvas = drawingCanvasRef.current;
      if (!drawingCanvas) return '';

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = drawingCanvas.width;
      maskCanvas.height = drawingCanvas.height;
      const maskCtx = maskCanvas.getContext('2d');

      if (maskCtx) {
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.drawImage(drawingCanvas, 0, 0);
        
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.strokeStyle = '#FFFFFF';
        maskCtx.fillStyle = '#FFFFFF';
        const drawingCtx = drawingCanvas.getContext('2d');
        if (drawingCtx) {
            // Re-draw with solid white color on the mask
            const originalCompositeOp = drawingCtx.globalCompositeOperation;
            const originalStroke = drawingCtx.strokeStyle;
            const originalFill = drawingCtx.fillStyle;
            
            drawingCtx.globalCompositeOperation = 'source-atop';
            drawingCtx.strokeStyle = 'white';
            drawingCtx.fillStyle = 'white';
            
            maskCtx.drawImage(drawingCanvas, 0, 0);

            drawingCtx.globalCompositeOperation = originalCompositeOp;
            drawingCtx.strokeStyle = originalStroke;
            drawingCtx.fillStyle = originalFill;
        }
      }
      return maskCanvas.toDataURL('image/png');
    },
  }));
  
  return (
    <div className="w-full flex flex-col items-center">
      <div ref={containerRef} className="relative w-full max-w-3xl aspect-[4/3] mx-auto rounded-lg overflow-hidden shadow-lg bg-gray-700">
        <canvas ref={imageCanvasRef} className="absolute top-0 left-0 w-full h-full" />
        <canvas
          ref={drawingCanvasRef}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={handleDrawing}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={handleDrawing}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="mt-6 p-4 bg-gray-800 rounded-lg shadow-inner w-full max-w-3xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <Icon icon="brush" className="w-6 h-6 text-indigo-400" />
            <label htmlFor="brushSize" className="text-sm font-medium text-gray-300">Brush Size</label>
            <input
            id="brushSize"
            type="range"
            min="5"
            max="150"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-48 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
        <button
          onClick={clearMask}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
        >
          <Icon icon="trash" className="w-5 h-5" />
          Clear Mask
        </button>
      </div>
    </div>
  );
});

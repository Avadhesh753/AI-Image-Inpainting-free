
import React, { useState, useRef, useCallback } from 'react';
import { AppState } from './types';
import { ImageEditor, ImageEditorRef } from './components/ImageEditor';
import { Spinner } from './components/Spinner';
import { editImageWithMask } from './services/geminiService';
import { Icon } from './components/Icon';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOADING);
  const [originalImage, setOriginalImage] = useState<{ file: File; url: string } | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const imageEditorRef = useRef<ImageEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      setOriginalImage({ file, url: imageUrl });
      setAppState(AppState.EDITING);
      setError(null);
    } else {
      setError('Please upload a valid image file (PNG, JPG, etc.).');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-indigo-400');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-indigo-400');
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-indigo-400');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description of the edit you want to make.');
      return;
    }
    if (!originalImage || !imageEditorRef.current) return;

    setAppState(AppState.GENERATING);
    setError(null);

    try {
      const maskDataUrl = imageEditorRef.current.getMaskAsBase64();
      if (!maskDataUrl.includes('data:image/png;base64,')) { // Check if mask is empty
        setError('Please select an area on the image to edit by drawing on it.');
        setAppState(AppState.EDITING);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(originalImage.file);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const resultUrl = await editImageWithMask(
          { data: base64data, mimeType: originalImage.file.type },
          { data: maskDataUrl, mimeType: 'image/png' },
          prompt
        );
        setEditedImageUrl(resultUrl);
        setAppState(AppState.DISPLAYING_RESULT);
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Generation failed: ${errorMessage}`);
      setAppState(AppState.ERROR);
    }
  };

  const startOver = () => {
    setAppState(AppState.UPLOADING);
    setOriginalImage(null);
    setEditedImageUrl(null);
    setPrompt('');
    setError(null);
    if(originalImage) URL.revokeObjectURL(originalImage.url);
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.UPLOADING:
        return (
          <div
            className="w-full h-96 border-4 border-dashed border-gray-600 rounded-2xl flex flex-col justify-center items-center text-center p-8 cursor-pointer transition-colors duration-300 hover:border-indigo-500 bg-gray-800/50"
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <Icon icon="upload" className="w-16 h-16 text-gray-500 mb-4" />
            <h2 className="text-2xl font-bold text-white">Drag & drop your image here</h2>
            <p className="text-gray-400 mt-2">or click to browse</p>
            <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
            {error && <p className="text-red-400 mt-4">{error}</p>}
          </div>
        );
      case AppState.EDITING:
      case AppState.ERROR:
        return (
          <div className="w-full">
            {originalImage && <ImageEditor ref={imageEditorRef} imageSrc={originalImage.url} />}
            <div className="mt-6 w-full max-w-3xl mx-auto flex flex-col md:flex-row gap-4 items-center">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g., "Change the shirt color to red"'
                className="flex-grow w-full md:w-auto p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                rows={2}
              />
              <button
                onClick={handleGenerate}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-transform duration-200 transform hover:scale-105 shadow-lg"
              >
                <Icon icon="wand" className="w-6 h-6" />
                Generate
              </button>
            </div>
             {error && (
                <div className="mt-4 text-center p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg max-w-3xl mx-auto">
                    <p>{error}</p>
                    {appState === AppState.ERROR && 
                    <button onClick={() => setAppState(AppState.EDITING)} className="mt-2 text-sm font-semibold underline hover:text-white">
                        Try again
                    </button>}
                </div>
            )}
          </div>
        );
      case AppState.GENERATING:
        return (
          <div className="flex flex-col items-center justify-center h-96">
            <Spinner />
            <p className="text-indigo-300 text-lg mt-6 animate-pulse">AI is creating magic...</p>
          </div>
        );
      case AppState.DISPLAYING_RESULT:
        return (
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-center mb-4 text-gray-300">Original</h3>
                <img src={originalImage?.url} alt="Original" className="rounded-lg shadow-lg w-full" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-center mb-4 text-indigo-300">Edited</h3>
                <img src={editedImageUrl!} alt="Edited" className="rounded-lg shadow-lg w-full" />
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-center items-center gap-4">
              <button
                onClick={startOver}
                className="flex items-center gap-2 px-6 py-3 text-lg font-bold text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Icon icon="back" className="w-6 h-6" />
                Start Over
              </button>
              <a
                href={editedImageUrl!}
                download="edited-image.png"
                className="flex items-center gap-2 px-6 py-3 text-lg font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <Icon icon="download" className="w-6 h-6" />
                Download
              </a>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <main className="w-full max-w-5xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            AI Image Inpainting
          </h1>
          <p className="mt-3 text-lg text-gray-400 max-w-2xl mx-auto">
            Upload an image, mask the area you want to change, and let AI bring your vision to life.
          </p>
        </header>
        {renderContent()}
      </main>
      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Powered by Gemini Nano Banana Model</p>
      </footer>
    </div>
  );
};

export default App;

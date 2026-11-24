import React, { useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  calculateItemPricing,
  calculateOrderPricing,
  CAMPUS_COUNTER,
  ColorMode,
  DEFAULT_PRINT_SETTINGS,
  formatCurrency,
  formatFileSize,
  PaperSize,
  PrintableFileSpec,
  PrintSettings,
  SidesMode,
} from '../shared/catalog';
import {
  createSampleImageFile,
  createSamplePdfFile,
  detectPdfPageCount,
} from '../utils/pdfAndFiles';

export interface QueuedPrintFile extends PrintableFileSpec {
  previewUrl: string | null;
}

interface PrintStudioProps {
  files: QueuedPrintFile[];
  onFilesChange: React.Dispatch<React.SetStateAction<QueuedPrintFile[]>>;
  savedDefaults: PrintSettings | null;
  onProceedToCheckout: () => void;
  isSignedIn: boolean;
  onOpenAccount: () => void;
}

export const PrintStudio: React.FC<PrintStudioProps> = ({
  files,
  onFilesChange,
  savedDefaults,
  onProceedToCheckout,
  isSignedIn,
  onOpenAccount,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const activeDefaults = savedDefaults || DEFAULT_PRINT_SETTINGS;
  const orderTotals = calculateOrderPricing(files);

  const ingestFiles = async (incomingList: FileList | File[]) => {
    setUploadError(null);
    const list = Array.from(incomingList);
    if (list.length === 0) return;

    const accepted: File[] = [];
    const rejectedNames: string[] = [];

    for (const file of list) {
      const lower = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
      const isImage =
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower);

      if (isPdf || isImage) {
        accepted.push(file);
      } else {
        rejectedNames.push(file.name);
      }
    }

    if (rejectedNames.length > 0) {
      setUploadError(
        `Unsupported format for ${rejectedNames.join(', ')}. Upload PDF, PNG, JPG, or WEBP files.`
      );
    }
    if (accepted.length === 0) return;

    setIsProcessingFiles(true);
    try {
      const created: QueuedPrintFile[] = await Promise.all(
        accepted.map(async (file) => {
          const isImage = file.type.startsWith('image/');
          const pages = isImage ? 1 : await detectPdfPageCount(file);
          const previewUrl = isImage ? URL.createObjectURL(file) : null;
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || (isImage ? 'image/png' : 'application/pdf'),
            pages,
            colorMode: activeDefaults.colorMode,
            sides: activeDefaults.sides,
            paperSize: activeDefaults.paperSize,
            copies: activeDefaults.copies,
            previewUrl,
          };
        })
      );
      onFilesChange((prev) => [...prev, ...created]);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await ingestFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    onFilesChange((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateFile = (id: string, patch: Partial<QueuedPrintFile>) => {
    onFilesChange((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const applySavedDefaultsToAll = () => {
    onFilesChange((prev) =>
      prev.map((item) => ({
        ...item,
        colorMode: activeDefaults.colorMode,
        sides: activeDefaults.sides,
        paperSize: activeDefaults.paperSize,
        copies: activeDefaults.copies,
      }))
    );
  };

  const handleAddSamplePdf = async () => {
    const file = await createSamplePdfFile();
    await ingestFiles([file]);
  };

  const handleAddSampleImage = async () => {
    const file = await createSampleImageFile();
    await ingestFiles([file]);
  };

  return (
    <section id="print-studio" className="bg-white py-14 pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500">
              printEase Print Studio &amp; Configurator
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Upload documents &amp; set print options
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {isSignedIn && savedDefaults ? (
              <button
                type="button"
                onClick={applySavedDefaultsToAll}
                disabled={files.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-800" aria-hidden="true" />
                Apply Saved Defaults
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAccount}
                className="text-xs font-medium text-blue-800 hover:underline underline-offset-4 whitespace-nowrap"
              >
                Sign in to save default print settings
              </button>
            )}
          </div>
        </div>

        {/* Step 1: Drag-and-Drop Document Upload */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              01. Upload Documents (PDF or Images)
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleAddSamplePdf}
                className="font-medium text-slate-600 hover:text-blue-800 hover:underline underline-offset-4 whitespace-nowrap"
              >
                + Add sample PDF (4 pg)
              </button>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={handleAddSampleImage}
                className="font-medium text-slate-600 hover:text-blue-800 hover:underline underline-offset-4 whitespace-nowrap"
              >
                + Add sample poster image
              </button>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload PDF or image documents by dragging and dropping or browsing"
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging
                ? 'border-blue-800 bg-blue-50/60'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  void ingestFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-800">
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 font-display text-sm font-semibold text-slate-900">
              {isProcessingFiles
                ? 'Analyzing document pages...'
                : 'Drag and drop PDF or image files here, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Supports multiple files per order · PDF, PNG, JPG, WEBP · Automatic PDF page detection
            </p>
          </div>

          {uploadError && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {uploadError}
            </p>
          )}
        </div>

        {/* Step 2: Uploaded Files & Per-File Print Configuration */}
        {files.length > 0 ? (
          <div className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-slate-900">
                02. Configure Print Options ({files.length}{' '}
                {files.length === 1 ? 'file' : 'files'})
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                B&amp;W ₹2/pg · Color ₹10/pg · A3 2× · Double-sided 10% off (2+ pgs)
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {files.map((item) => {
                const calc = calculateItemPricing(item);
                const isImage = item.mimeType.startsWith('image/');

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      {/* File Identity & Thumbnail */}
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                          {isImage && item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={`Preview of ${item.fileName}`}
                              className="h-full w-full object-cover"
                            />
                          ) : isImage ? (
                            <ImageIcon className="h-6 w-6 text-slate-500" aria-hidden="true" />
                          ) : (
                            <div className="flex flex-col items-center">
                              <FileText className="h-6 w-6 text-blue-800" aria-hidden="true" />
                              <span className="mt-0.5 font-mono text-[10px] font-semibold text-slate-500">
                                PDF
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-semibold text-slate-900">
                            {item.fileName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                            <span>{formatFileSize(item.fileSize)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{isImage ? 'Image' : 'PDF Document'}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {calc.totalSheetsUsed}{' '}
                              {calc.totalSheetsUsed === 1 ? 'sheet' : 'sheets'}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-600">
                            <label htmlFor={`pages-${item.id}`} className="font-medium">
                              Pages:
                            </label>
                            <input
                              id={`pages-${item.id}`}
                              type="number"
                              min={1}
                              max={500}
                              value={item.pages}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  Math.min(500, parseInt(e.target.value, 10) || 1)
                                );
                                updateFile(item.id, { pages: val });
                              }}
                              className="w-16 rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-800 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Price & Remove */}
                      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0 md:text-right">
                        <div>
                          <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(calc.lineSubtotal)}
                          </p>
                          <p className="font-mono text-xs text-slate-500 tabular-nums">
                            ₹{calc.unitPageRate}/pg · {calc.totalPagesPrinted} pg total
                            {calc.duplexDiscount > 0
                              ? ` · saved ${formatCurrency(calc.duplexDiscount)}`
                              : ''}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          aria-label={`Remove ${item.fileName}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Option Controls */}
                    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <span className="block text-xs font-medium text-slate-600">
                          Color Mode
                        </span>
                        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                          {(['bw', 'color'] as ColorMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => updateFile(item.id, { colorMode: mode })}
                              className={`rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                                item.colorMode === mode
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {mode === 'bw' ? 'B&W (₹2/pg)' : 'Color (₹10/pg)'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-600">
                          Sidedness
                        </span>
                        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                          {(['single', 'double'] as SidesMode[]).map((side) => (
                            <button
                              key={side}
                              type="button"
                              onClick={() => updateFile(item.id, { sides: side })}
                              className={`rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                                item.sides === side
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {side === 'single' ? 'Single-Sided' : 'Double-Sided'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-600">
                          Paper Size
                        </span>
                        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                          {(['A4', 'A3', 'Letter'] as PaperSize[]).map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => updateFile(item.id, { paperSize: size })}
                              className={`rounded-md px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                                item.paperSize === size
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-600">
                          Copies
                        </span>
                        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-1.5 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateFile(item.id, { copies: Math.max(1, item.copies - 1) })
                            }
                            aria-label={`Decrease copies for ${item.fileName}`}
                            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            aria-label={`Number of copies for ${item.fileName}`}
                            value={item.copies}
                            onChange={(e) => {
                              const next = Math.max(
                                1,
                                Math.min(500, parseInt(e.target.value, 10) || 1)
                              );
                              updateFile(item.id, { copies: next });
                            }}
                            className="w-14 text-center font-mono text-sm font-semibold text-slate-900 tabular-nums focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateFile(item.id, { copies: Math.min(500, item.copies + 1) })
                            }
                            aria-label={`Increase copies for ${item.fileName}`}
                            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No documents queued yet. Drop PDFs or images above, or add a sample file to
              preview live Rupee pricing.
            </p>
          </div>
        )}

        {/* Campus Pickup Info Banner (single campus counter, notified when ready) */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">
                Pickup at {CAMPUS_COUNTER.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {CAMPUS_COUNTER.location} · {CAMPUS_COUNTER.hoursLabel}
              </p>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-700">
            No time slot needed — we notify your device the moment prints are ready.
          </p>
        </div>
      </div>

      {/* Running Order Total Sticky Bottom Bar */}
      {files.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate font-medium text-slate-800">
                  {CAMPUS_COUNTER.name}
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline font-mono tabular-nums">
                  {files.length} {files.length === 1 ? 'file' : 'files'} ·{' '}
                  {orderTotals.totalSheets} sheets
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-500">Order Total:</span>
                <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {formatCurrency(orderTotals.total)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
            >
              Pay via UPI &amp; Checkout
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

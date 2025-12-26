import { useEffect } from 'react';
import { AlertCircle, RotateCcw, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { useImagePaste } from '../../../hooks/useImagePaste';
import { cn } from '../../../lib/utils';
import type { ImageAttachment } from '../../../../shared/types';

interface QAFeedbackSectionProps {
  feedback: string;
  isSubmitting: boolean;
  onFeedbackChange: (value: string) => void;
  onReject: () => void;
  images: ImageAttachment[];
  onImagesChange: (images: ImageAttachment[]) => void;
  imageError: string | null;
  onImageError: (error: string | null) => void;
}

/**
 * Displays the QA feedback section where users can request changes
 */
export function QAFeedbackSection({
  feedback,
  isSubmitting,
  onFeedbackChange,
  onReject,
  images,
  onImagesChange,
  imageError,
  onImageError
}: QAFeedbackSectionProps) {
  // Use shared image paste/drop hook
  // The hook manages its own state - we sync to parent for persistence but render hook's images directly
  const {
    images: localImages,
    setImages: setLocalImages,
    error: localError,
    isDragOver,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeImage
  } = useImagePaste({
    initialImages: images,
    disabled: isSubmitting
  });

  // Sync hook images to parent state (for persistence when submitting)
  useEffect(() => {
    // Only update parent if images actually changed
    if (JSON.stringify(localImages) !== JSON.stringify(images)) {
      onImagesChange(localImages);
    }
  }, [localImages, images, onImagesChange]);

  // Sync parent images to hook when parent changes externally (e.g., on clear)
  useEffect(() => {
    // Only sync if parent has fewer images (deletion from parent) or is empty (reset)
    if (images.length < localImages.length || (images.length === 0 && localImages.length > 0)) {
      setLocalImages(images);
    }
  }, [images, localImages, setLocalImages]);

  // Sync error state with parent
  useEffect(() => {
    if (localError !== imageError) {
      onImageError(localError);
    }
  }, [localError, imageError, onImageError]);

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
      <h3 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-warning" />
        Request Changes
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Found issues? Describe what needs to be fixed and the AI will continue working on it.
      </p>
      <Textarea
        placeholder="Describe the issues or changes needed..."
        value={feedback}
        onChange={(e) => onFeedbackChange(e.target.value)}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          // Visual feedback when dragging over textarea
          isDragOver && !isSubmitting && "border-primary bg-primary/5 ring-2 ring-primary/20"
        )}
        rows={3}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Screenshots can be copy/pasted or dragged & dropped into the feedback.
      </p>

      {/* Image Thumbnails - displayed inline below textarea */}
      {localImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 mb-3">
          {localImages.map((image) => (
            <div
              key={image.id}
              className="relative group rounded-md border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
              style={{ width: '64px', height: '64px' }}
              title={image.filename}
            >
              {image.thumbnail ? (
                <img
                  src={image.thumbnail}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              {/* Remove button */}
              {!isSubmitting && (
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(image.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image error display */}
      {imageError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive mb-3">
          <X className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{imageError}</span>
        </div>
      )}

      {/* Spacing when no images */}
      {localImages.length === 0 && !imageError && <div className="mb-3" />}

      <Button
        variant="warning"
        onClick={onReject}
        disabled={isSubmitting || !feedback.trim()}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <RotateCcw className="mr-2 h-4 w-4" />
            Request Changes
          </>
        )}
      </Button>
    </div>
  );
}

import { FileText, Copy, Save, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface PreviewPanelProps {
  generatedChangelog: string;
  saveSuccess: boolean;
  copySuccess: boolean;
  canSave: boolean;
  isDragOver: boolean;
  imageError: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSave: () => void;
  onCopy: () => void;
  onChangelogEdit: (content: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function PreviewPanel({
  generatedChangelog,
  saveSuccess,
  copySuccess,
  canSave,
  isDragOver,
  imageError,
  textareaRef,
  onSave,
  onCopy,
  onChangelogEdit,
  onPaste,
  onDragOver,
  onDragLeave,
  onDrop
}: PreviewPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h2 className="font-medium">Preview</h2>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopy}
                disabled={!canSave}
              >
                {copySuccess ? (
                  <CheckCircle className="mr-2 h-4 w-4 text-success" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copySuccess ? 'Copied!' : 'Copy'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onSave}
                disabled={!canSave}
              >
                {saveSuccess ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saveSuccess ? 'Saved!' : 'Save to CHANGELOG.md'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Prepend to CHANGELOG.md in project root
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Preview Content */}
      <div
        className={`flex-1 overflow-hidden p-6 ${isDragOver ? 'bg-muted/50' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {generatedChangelog ? (
          <>
            {isDragOver && (
              <div className="mb-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-primary/50" />
                <p className="mt-2 text-sm text-primary/70">Drop images here to add to changelog</p>
              </div>
            )}
            {imageError && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {imageError}
              </div>
            )}
            <Textarea
              ref={textareaRef}
              className="h-full w-full resize-none font-mono text-sm"
              value={generatedChangelog}
              onChange={(e) => onChangelogEdit(e.target.value)}
              onPaste={onPaste}
              placeholder="Generated changelog will appear here... (Drag & drop or paste images to add)"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm text-muted-foreground">
                Click "Generate Changelog" to create release notes.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                You can drag & drop or paste images (Ctrl+V / Cmd+V) after generating
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

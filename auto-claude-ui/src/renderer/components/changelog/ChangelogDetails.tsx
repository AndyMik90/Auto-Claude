import { useState, useCallback, useRef, type DragEvent, type ClipboardEvent } from 'react';
import { ArrowLeft, FileText, GitCommit, Sparkles, RefreshCw, AlertCircle, ChevronUp, ChevronDown, Copy, Save, CheckCircle, PartyPopper, Github, Archive, ExternalLink, Check, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  CHANGELOG_FORMAT_LABELS,
  CHANGELOG_FORMAT_DESCRIPTIONS,
  CHANGELOG_AUDIENCE_LABELS,
  CHANGELOG_AUDIENCE_DESCRIPTIONS,
  CHANGELOG_EMOJI_LEVEL_LABELS,
  CHANGELOG_EMOJI_LEVEL_DESCRIPTIONS,
  CHANGELOG_STAGE_LABELS,
  ALLOWED_IMAGE_TYPES_DISPLAY
} from '../../../shared/constants';
import { blobToBase64, isValidImageMimeType, resolveFilename } from '../ImageUpload';
import { useProjectStore } from '../../stores/project-store';
import type {
  ChangelogFormat,
  ChangelogAudience,
  ChangelogEmojiLevel,
  ChangelogTask,
  ChangelogSourceMode,
  GitCommit as GitCommitType
} from '../../../shared/types';

interface Step2ConfigureGenerateProps {
  sourceMode: ChangelogSourceMode;
  selectedTaskIds: string[];
  doneTasks: ChangelogTask[];
  previewCommits: GitCommitType[];
  existingChangelog: { lastVersion?: string } | null;
  version: string;
  versionReason: string | null;
  date: string;
  format: ChangelogFormat;
  audience: ChangelogAudience;
  emojiLevel: ChangelogEmojiLevel;
  customInstructions: string;
  generationProgress: { stage: string; progress: number; message?: string; error?: string } | null;
  generatedChangelog: string;
  isGenerating: boolean;
  error: string | null;
  showAdvanced: boolean;
  saveSuccess: boolean;
  copySuccess: boolean;
  canGenerate: boolean;
  canSave: boolean;
  onBack: () => void;
  onVersionChange: (v: string) => void;
  onDateChange: (d: string) => void;
  onFormatChange: (f: ChangelogFormat) => void;
  onAudienceChange: (a: ChangelogAudience) => void;
  onEmojiLevelChange: (l: ChangelogEmojiLevel) => void;
  onCustomInstructionsChange: (i: string) => void;
  onShowAdvancedChange: (show: boolean) => void;
  onGenerate: () => void;
  onSave: () => void;
  onCopy: () => void;
  onChangelogEdit: (content: string) => void;
}

export function Step2ConfigureGenerate({
  sourceMode,
  selectedTaskIds,
  doneTasks,
  previewCommits,
  existingChangelog,
  version,
  versionReason,
  date,
  format,
  audience,
  emojiLevel,
  customInstructions,
  generationProgress,
  generatedChangelog,
  isGenerating,
  error,
  showAdvanced,
  saveSuccess,
  copySuccess,
  canGenerate,
  canSave,
  onBack,
  onVersionChange,
  onDateChange,
  onFormatChange,
  onAudienceChange,
  onEmojiLevelChange,
  onCustomInstructionsChange,
  onShowAdvancedChange,
  onGenerate,
  onSave,
  onCopy,
  onChangelogEdit
}: Step2ConfigureGenerateProps) {
  const selectedTasks = doneTasks.filter((t) => selectedTaskIds.includes(t.id));
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle image paste
  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!selectedProjectId) return;

    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault();
    setImageError(null);

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      if (!isValidImageMimeType(file.type)) {
        setImageError(`Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES_DISPLAY}`);
        continue;
      }

      try {
        const dataUrl = await blobToBase64(file);
        const extension = file.type.split('/')[1] || 'png';
        const timestamp = Date.now();
        const baseFilename = `changelog-${timestamp}.${extension}`;
        const filename = resolveFilename(baseFilename, []);

        const result = await window.electronAPI.saveChangelogImage(
          selectedProjectId,
          dataUrl,
          filename
        );

        if (result.success && result.data) {
          // Insert markdown image at cursor position
          const textarea = textareaRef.current;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const textBefore = generatedChangelog.substring(0, cursorPos);
            const textAfter = generatedChangelog.substring(cursorPos);
            const imageMarkdown = `\n![${filename}](${result.data.relativePath})\n`;
            onChangelogEdit(textBefore + imageMarkdown + textAfter);
            
            // Set cursor position after inserted image
            setTimeout(() => {
              const newPos = cursorPos + imageMarkdown.length;
              textarea.setSelectionRange(newPos, newPos);
              textarea.focus();
            }, 0);
          }
        } else {
          setImageError(result.error || 'Failed to save image');
        }
      } catch (err) {
        setImageError('Failed to process pasted image');
      }
    }
  }, [selectedProjectId, generatedChangelog, onChangelogEdit]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!selectedProjectId) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    setImageError(null);

    for (const file of imageFiles) {
      if (!isValidImageMimeType(file.type)) {
        setImageError(`Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES_DISPLAY}`);
        continue;
      }

      try {
        const dataUrl = await blobToBase64(file);
        const extension = file.name.split('.').pop() || file.type.split('/')[1] || 'png';
        const timestamp = Date.now();
        const baseFilename = `changelog-${timestamp}.${extension}`;
        const filename = resolveFilename(baseFilename, []);

        const result = await window.electronAPI.saveChangelogImage(
          selectedProjectId,
          dataUrl,
          filename
        );

        if (result.success && result.data) {
          // Insert markdown image at cursor position or end
          const textarea = textareaRef.current;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const textBefore = generatedChangelog.substring(0, cursorPos);
            const textAfter = generatedChangelog.substring(cursorPos);
            const imageMarkdown = `\n![${filename}](${result.data.relativePath})\n`;
            onChangelogEdit(textBefore + imageMarkdown + textAfter);
            
            // Set cursor position after inserted image
            setTimeout(() => {
              const newPos = cursorPos + imageMarkdown.length;
              textarea.setSelectionRange(newPos, newPos);
              textarea.focus();
            }, 0);
          }
        } else {
          setImageError(result.error || 'Failed to save image');
        }
      } catch (err) {
        setImageError('Failed to process dropped image');
      }
    }
  }, [selectedProjectId, generatedChangelog, onChangelogEdit]);

  // Get summary info based on source mode
  const getSummaryInfo = () => {
    switch (sourceMode) {
      case 'tasks':
        return {
          count: selectedTaskIds.length,
          label: 'task',
          details: selectedTasks.slice(0, 3).map((t) => t.title).join(', ') +
            (selectedTasks.length > 3 ? ` +${selectedTasks.length - 3} more` : '')
        };
      case 'git-history':
      case 'branch-diff':
        return {
          count: previewCommits.length,
          label: 'commit',
          details: previewCommits.slice(0, 3).map((c) => c.subject.substring(0, 40)).join(', ') +
            (previewCommits.length > 3 ? ` +${previewCommits.length - 3} more` : '')
        };
      default:
        return { count: 0, label: 'item', details: '' };
    }
  };

  const summaryInfo = getSummaryInfo();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel - Configuration */}
      <div className="w-80 flex-shrink-0 border-r border-border overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Back button and task summary */}
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Selection
            </Button>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {sourceMode === 'tasks' ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <GitCommit className="h-4 w-4" />
                )}
                Including {summaryInfo.count} {summaryInfo.label}{summaryInfo.count !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {summaryInfo.details}
              </div>
            </div>
          </div>

          {/* Version & Date */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Release Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={version}
                  onChange={(e) => onVersionChange(e.target.value)}
                  placeholder="1.0.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                />
              </div>
              {(existingChangelog?.lastVersion || versionReason) && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {existingChangelog?.lastVersion && (
                    <p>Previous: {existingChangelog.lastVersion}</p>
                  )}
                  {versionReason && (
                    <p className="text-primary/70">
                      {versionReason === 'breaking'
                        ? 'Major version bump (breaking changes detected)'
                        : versionReason === 'feature'
                          ? 'Minor version bump (new features detected)'
                          : 'Patch version bump (fixes/improvements)'}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Format & Audience */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Output Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={format}
                  onValueChange={(value) => onFormatChange(value as ChangelogFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANGELOG_FORMAT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div>
                          <div>{label}</div>
                          <div className="text-xs text-muted-foreground">
                            {CHANGELOG_FORMAT_DESCRIPTIONS[value]}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={audience}
                  onValueChange={(value) => onAudienceChange(value as ChangelogAudience)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANGELOG_AUDIENCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div>
                          <div>{label}</div>
                          <div className="text-xs text-muted-foreground">
                            {CHANGELOG_AUDIENCE_DESCRIPTIONS[value]}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Emojis</Label>
                <Select
                  value={emojiLevel}
                  onValueChange={(value) => onEmojiLevelChange(value as ChangelogEmojiLevel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANGELOG_EMOJI_LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div>
                          <div>{label}</div>
                          <div className="text-xs text-muted-foreground">
                            {CHANGELOG_EMOJI_LEVEL_DESCRIPTIONS[value]}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={onShowAdvancedChange}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                Advanced Options
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="instructions">Custom Instructions</Label>
                    <Textarea
                      id="instructions"
                      value={customInstructions}
                      onChange={(e) => onCustomInstructionsChange(e.target.value)}
                      placeholder="Add any special instructions for the AI..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Guide the AI on tone, specific details to include, etc.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Generate Button */}
          <Button
            className="w-full"
            onClick={onGenerate}
            disabled={!canGenerate}
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Changelog
              </>
            )}
          </Button>

          {/* Progress */}
          {generationProgress && isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{CHANGELOG_STAGE_LABELS[generationProgress.stage]}</span>
                <span>{generationProgress.progress}%</span>
              </div>
              <Progress value={generationProgress.progress} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{error}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview */}
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
                onPaste={handlePaste}
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
    </div>
  );
}

interface Step3ReleaseArchiveProps {
  projectId: string;
  version: string;
  selectedTaskIds: string[];
  doneTasks: ChangelogTask[];
  generatedChangelog: string;
  onDone: () => void;
}

export function Step3ReleaseArchive({
  projectId,
  version,
  selectedTaskIds,
  doneTasks,
  generatedChangelog,
  onDone
}: Step3ReleaseArchiveProps) {
  const [isCreatingRelease, setIsCreatingRelease] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const selectedTasks = doneTasks.filter((t) => selectedTaskIds.includes(t.id));
  const tag = version.startsWith('v') ? version : `v${version}`;

  const handleCreateRelease = async () => {
    setIsCreatingRelease(true);
    setReleaseError(null);
    try {
      const result = await window.electronAPI.createGitHubRelease(
        projectId,
        version,
        generatedChangelog
      );
      if (result.success && result.data) {
        setReleaseUrl(result.data.url);
      } else {
        setReleaseError(result.error || 'Failed to create release');
      }
    } catch (err) {
      setReleaseError(err instanceof Error ? err.message : 'Failed to create release');
    } finally {
      setIsCreatingRelease(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    setArchiveError(null);
    try {
      const result = await window.electronAPI.archiveTasks(projectId, selectedTaskIds, version);
      if (result.success) {
        setArchiveSuccess(true);
      } else {
        setArchiveError(result.error || 'Failed to archive tasks');
      }
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive tasks');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Success Message */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
            <PartyPopper className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-2xl font-semibold">Changelog Saved!</h2>
          <p className="text-muted-foreground mt-2">
            Version {tag} has been added to CHANGELOG.md
          </p>
        </div>

        {/* Action Cards */}
        <div className="space-y-4">
          {/* GitHub Release */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                <CardTitle className="text-base">Create GitHub Release</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {releaseUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Release created successfully!</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(releaseUrl, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Release on GitHub
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Create a new release {tag} on GitHub with the changelog as release notes.
                  </p>
                  {releaseError && (
                    <div className="flex items-start gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{releaseError}</span>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleCreateRelease}
                    disabled={isCreatingRelease}
                  >
                    {isCreatingRelease ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Creating Release...
                      </>
                    ) : (
                      <>
                        <Github className="mr-2 h-4 w-4" />
                        Create Release {tag}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Archive Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                <CardTitle className="text-base">Archive Completed Tasks</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {archiveSuccess ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} archived!
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Archive {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} to
                    clean up your Kanban board. Archived tasks can be viewed using the "Show
                    Archived" toggle.
                  </p>
                  {archiveError && (
                    <div className="flex items-start gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{archiveError}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleArchive}
                    disabled={isArchiving}
                  >
                    {isArchiving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Archiving...
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive {selectedTasks.length} Task{selectedTasks.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Done Button */}
        <div className="pt-4">
          <Button className="w-full" size="lg" onClick={onDone}>
            <Check className="mr-2 h-4 w-4" />
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

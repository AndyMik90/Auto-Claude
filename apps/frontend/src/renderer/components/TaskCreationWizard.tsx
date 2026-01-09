import { useState, useEffect, useCallback, useRef, useMemo, type ClipboardEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronDown, ChevronUp, Image as ImageIcon, X, RotateCcw, FolderTree, GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  generateImageId,
  blobToBase64,
  createThumbnail,
  isValidImageMimeType,
  resolveFilename
} from './ImageUpload';
import { TaskFileExplorerDrawer } from './TaskFileExplorerDrawer';
import { AgentProfileSelector } from './AgentProfileSelector';
import { FileAutocomplete } from './FileAutocomplete';
import { createTask, saveDraft, loadDraft, clearDraft, isDraftEmpty } from '../stores/task-store';
import { useProjectStore } from '../stores/project-store';
import { cn } from '../lib/utils';
import type { TaskCategory, TaskPriority, TaskComplexity, TaskImpact, TaskMetadata, ImageAttachment, TaskDraft, ModelType, ThinkingLevel, ReferencedFile } from '../../shared/types';
import type { PhaseModelConfig, PhaseThinkingConfig } from '../../shared/types/settings';
import {
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_COMPLEXITY_LABELS,
  TASK_IMPACT_LABELS,
  MAX_IMAGES_PER_TASK,
  ALLOWED_IMAGE_TYPES_DISPLAY,
  DEFAULT_AGENT_PROFILES,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING
} from '../../shared/constants';
import { useSettingsStore } from '../stores/settings-store';

interface TaskCreationWizardProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreationWizard({
  projectId,
  open,
  onOpenChange
}: TaskCreationWizardProps) {
  const { t } = useTranslation('tasks');
  // 从设置中获取选定的代理配置
  const { settings } = useSettingsStore();
  const selectedProfile = DEFAULT_AGENT_PROFILES.find(
    p => p.id === settings.selectedAgentProfile
  ) || DEFAULT_AGENT_PROFILES.find(p => p.id === 'auto')!;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showGitOptions, setShowGitOptions] = useState(false);

  // Git 选项状态
  // 使用特殊值表示"使用项目默认值"，因为 Radix UI Select 不允许空字符串值
  const PROJECT_DEFAULT_BRANCH = '__project_default__';
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [baseBranch, setBaseBranch] = useState<string>(PROJECT_DEFAULT_BRANCH);
  const [projectDefaultBranch, setProjectDefaultBranch] = useState<string>('');
  // 工作树隔离 - 默认为 true 以确保安全
  const [useWorktree, setUseWorktree] = useState(true);

  // 从项目存储中获取项目路径
  const projects = useProjectStore((state) => state.projects);
  const projectPath = useMemo(() => {
    const project = projects.find((p) => p.id === projectId);
    return project?.path ?? null;
  }, [projects, projectId]);

  // 元数据字段
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
  const [impact, setImpact] = useState<TaskImpact | ''>('');

  // 模型配置（从选定的代理配置初始化）
  const [profileId, setProfileId] = useState<string>(settings.selectedAgentProfile || 'auto');
  const [model, setModel] = useState<ModelType | ''>(selectedProfile.model);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | ''>(selectedProfile.thinkingLevel);
  // 自动配置 - 每阶段配置
  // 优先使用应用设置中的自定义设置，否则回退到默认值
  const [phaseModels, setPhaseModels] = useState<PhaseModelConfig | undefined>(
    settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS
  );
  const [phaseThinking, setPhaseThinking] = useState<PhaseThinkingConfig | undefined>(
    settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING
  );

  // 图片附件
  const [images, setImages] = useState<ImageAttachment[]>([]);

  // 从文件浏览器引用的文件
  const [referencedFiles, setReferencedFiles] = useState<ReferencedFile[]>([]);

  // 审查设置
  const [requireReviewBeforeCoding, setRequireReviewBeforeCoding] = useState(false);

  // 草稿状态
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // 用于处理粘贴事件的文本区域引用
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // 表单滚动容器引用（用于拖拽自动滚动）
  const formContainerRef = useRef<HTMLDivElement>(null);

  // 文本区域上的图片拖放状态
  const [isDragOverTextarea, setIsDragOverTextarea] = useState(false);

  // @ 自动完成状态
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    query: string;
    startPos: number;
    position: { top: number; left: number };
  } | null>(null);

  // 当对话框打开时加载草稿，或从选定的配置初始化
  useEffect(() => {
    if (open && projectId) {
      const draft = loadDraft(projectId);
      if (draft && !isDraftEmpty(draft)) {
        setTitle(draft.title);
        setDescription(draft.description);
        setCategory(draft.category);
        setPriority(draft.priority);
        setComplexity(draft.complexity);
        setImpact(draft.impact);
        // Load model/thinkingLevel/profileId from draft if present, otherwise use profile defaults
        setProfileId(draft.profileId || settings.selectedAgentProfile || 'auto');
        setModel(draft.model || selectedProfile.model);
        setThinkingLevel(draft.thinkingLevel || selectedProfile.thinkingLevel);
        setPhaseModels(draft.phaseModels || settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(draft.phaseThinking || settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
        setImages(draft.images);
        setReferencedFiles(draft.referencedFiles ?? []);
        setRequireReviewBeforeCoding(draft.requireReviewBeforeCoding ?? false);
        setIsDraftRestored(true);

        // 如果有内容，则展开相应部分
        if (draft.category || draft.priority || draft.complexity || draft.impact) {
          setShowAdvanced(true);
        }
      } else {
        // 无草稿 - 从选定的配置和自定义设置初始化
        setProfileId(settings.selectedAgentProfile || 'auto');
        setModel(selectedProfile.model);
        setThinkingLevel(selectedProfile.thinkingLevel);
        setPhaseModels(settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
      }
    }
  }, [open, projectId, settings.selectedAgentProfile, settings.customPhaseModels, settings.customPhaseThinking, selectedProfile.model, selectedProfile.thinkingLevel, selectedProfile.phaseModels, selectedProfile.phaseThinking]);

  // 当对话框打开时获取分支和项目默认分支
  useEffect(() => {
    if (open && projectPath) {
      fetchBranches();
      fetchProjectDefaultBranch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectPath]);

  const fetchBranches = async () => {
    if (!projectPath) return;

    setIsLoadingBranches(true);
    try {
      const result = await window.electronAPI.getGitBranches(projectPath);
      if (result.success && result.data) {
        setBranches(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const fetchProjectDefaultBranch = async () => {
    if (!projectId) return;

    try {
      // Get env config to check if there's a configured default branch
      const result = await window.electronAPI.getProjectEnv(projectId);
      if (result.success && result.data?.defaultBranch) {
        setProjectDefaultBranch(result.data.defaultBranch);
      } else if (projectPath) {
        // Fall back to auto-detect
        const detectResult = await window.electronAPI.detectMainBranch(projectPath);
        if (detectResult.success && detectResult.data) {
          setProjectDefaultBranch(detectResult.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch project default branch:', err);
    }
  };

  /**
   * Get current form state as a draft
   */
  const getCurrentDraft = useCallback((): TaskDraft => ({
    projectId,
    title,
    description,
    category,
    priority,
    complexity,
    impact,
    profileId,
    model,
    thinkingLevel,
    phaseModels,
    phaseThinking,
    images,
    referencedFiles,
    requireReviewBeforeCoding,
    savedAt: new Date()
  }), [projectId, title, description, category, priority, complexity, impact, profileId, model, thinkingLevel, phaseModels, phaseThinking, images, referencedFiles, requireReviewBeforeCoding]);
  /**
   * Handle paste event for screenshot support
   */
  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    // Find image items in clipboard
    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.startsWith('image/')) {
        imageItems.push(item);
      }
    }

    // 如果没有图片，允许正常的粘贴行为
    if (imageItems.length === 0) return;

    // 当有图片时阻止默认粘贴
    e.preventDefault();

    // 检查是否可以添加更多图片
    const remainingSlots = MAX_IMAGES_PER_TASK - images.length;
    if (remainingSlots <= 0) {
      setError(t('wizard.errors.maxImages', { max: MAX_IMAGES_PER_TASK }));
      return;
    }

    setError(null);

    // 处理图片项
    const newImages: ImageAttachment[] = [];
    const existingFilenames = images.map(img => img.filename);

    for (const item of imageItems.slice(0, remainingSlots)) {
      const file = item.getAsFile();
      if (!file) continue;

      // 验证图片类型
      if (!isValidImageMimeType(file.type)) {
        setError(t('wizard.errors.invalidImageType', { types: ALLOWED_IMAGE_TYPES_DISPLAY }));
        continue;
      }

      try {
        const dataUrl = await blobToBase64(file);
        const thumbnail = await createThumbnail(dataUrl);

        // 为粘贴的图片生成文件名（screenshot-时间戳.扩展名）
        const extension = file.type.split('/')[1] || 'png';
        const baseFilename = `screenshot-${Date.now()}.${extension}`;
        const resolvedFilename = resolveFilename(baseFilename, [
          ...existingFilenames,
          ...newImages.map(img => img.filename)
        ]);

        newImages.push({
          id: generateImageId(),
          filename: resolvedFilename,
          mimeType: file.type,
          size: file.size,
          data: dataUrl.split(',')[1], // Store base64 without data URL prefix
          thumbnail
        });
      } catch {
        setError(t('wizard.errors.failedPasteImage'));
      }
    }

    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
      // 显示成功反馈
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 2000);
    }
  }, [images, t]);

  /**
   * 检测正在输入的 @ 提及并显示自动完成
   */
  const detectAtMention = useCallback((text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos);
    // 匹配 @ 后跟可选路径字符（字母、数字、点、短横线、斜杠）
    const match = beforeCursor.match(/@([\w\-./\\]*)$/);

    if (match) {
      return {
        query: match[1],
        startPos: cursorPos - match[0].length
      };
    }
    return null;
  }, []);

  /**
   * Handle description change and check for @ mentions
   */
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setDescription(newValue);

    // 检查光标处的 @ 提及
    const mention = detectAtMention(newValue, cursorPos);

    if (mention) {
      // 根据光标计算弹出位置
      const textarea = descriptionRef.current;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        const textareaStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(textareaStyle.lineHeight) || 20;
        const paddingTop = parseFloat(textareaStyle.paddingTop) || 8;
        const paddingLeft = parseFloat(textareaStyle.paddingLeft) || 12;

        // 估算光标位置（简化版 - 假设等宽字体）
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLineIndex = lines.length - 1;
        const currentLineLength = lines[currentLineIndex].length;

        // 计算相对于文本区域的位置
        const charWidth = 8; // 近似字符宽度
        const top = paddingTop + (currentLineIndex + 1) * lineHeight + 4;
        const left = paddingLeft + Math.min(currentLineLength * charWidth, rect.width - 300);

        setAutocomplete({
          show: true,
          query: mention.query,
          startPos: mention.startPos,
          position: { top, left: Math.max(0, left) }
        });
      }
    } else {
      // 光标处没有 @ 提及，关闭自动完成
      if (autocomplete?.show) {
        setAutocomplete(null);
      }
    }
  }, [detectAtMention, autocomplete?.show]);

  /**
   * Handle autocomplete selection
   */
  const handleAutocompleteSelect = useCallback((filename: string) => {
    if (!autocomplete) return;

    const textarea = descriptionRef.current;
    if (!textarea) return;

    // 将 @查询 替换为 @文件名
    const beforeMention = description.slice(0, autocomplete.startPos);
    const afterMention = description.slice(autocomplete.startPos + 1 + autocomplete.query.length);
    const newDescription = beforeMention + '@' + filename + afterMention;

    setDescription(newDescription);
    setAutocomplete(null);

    // 将光标设置在插入的提及之后
    setTimeout(() => {
      const newCursorPos = autocomplete.startPos + 1 + filename.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [autocomplete, description]);

  /**
   * Close autocomplete
   */
  const handleAutocompleteClose = useCallback(() => {
    setAutocomplete(null);
  }, []);

  /**
   * Handle drag over the form container to auto-scroll when dragging near edges
   */
  const handleContainerDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    const container = formContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edgeThreshold = 60; // 距离边缘触发滚动的像素值
    const scrollSpeed = 8;

    // 在顶部或底部边缘附近拖拽时自动滚动
    if (e.clientY < rect.top + edgeThreshold) {
      container.scrollTop -= scrollSpeed;
    } else if (e.clientY > rect.bottom - edgeThreshold) {
      container.scrollTop += scrollSpeed;
    }
  }, []);

  /**
   * Handle drag over textarea for image drops
   */
  const handleTextareaDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTextarea(true);
  }, []);

  /**
   * Handle drag leave from textarea
   */
  const handleTextareaDragLeave = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTextarea(false);
  }, []);

  /**
   * Handle drop on textarea for file references and images
   */
  const handleTextareaDrop = useCallback(
    async (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTextarea(false);

      if (isCreating) return;

      // 首先检查文件引用拖放（来自文件浏览器）
      const jsonData = e.dataTransfer?.getData('application/json');
      if (jsonData) {
        try {
          const data = JSON.parse(jsonData);
          if (data.type === 'file-reference' && data.name) {
            // 在文本区域的光标位置插入 @提及
            const textarea = descriptionRef.current;
            if (textarea) {
              const cursorPos = textarea.selectionStart || 0;
              const textBefore = description.substring(0, cursorPos);
              const textAfter = description.substring(cursorPos);

              // 在光标位置插入 @提及
              const mention = `@${data.name}`;
              const newDescription = textBefore + mention + textAfter;
              setDescription(newDescription);

              // 将光标设置在插入的提及之后
              setTimeout(() => {
                textarea.focus();
                const newCursorPos = cursorPos + mention.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
              }, 0);

              return; // 不作为图片处理
            }
          }
        } catch {
          // 不是有效的 JSON，继续处理图片
        }
      }

      // 回退到图片文件处理
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // 筛选图片文件
      const imageFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      // Check if we can add more images
      const remainingSlots = MAX_IMAGES_PER_TASK - images.length;
      if (remainingSlots <= 0) {
        setError(t('wizard.errors.maxImages', { max: MAX_IMAGES_PER_TASK }));
        return;
      }

      setError(null);

      // 处理图片文件
      const newImages: ImageAttachment[] = [];
      const existingFilenames = images.map(img => img.filename);

      for (const file of imageFiles.slice(0, remainingSlots)) {
        // 验证图片类型
        if (!isValidImageMimeType(file.type)) {
          setError(t('wizard.errors.invalidImageType', { types: ALLOWED_IMAGE_TYPES_DISPLAY }));
          continue;
        }

        try {
          const dataUrl = await blobToBase64(file);
          const thumbnail = await createThumbnail(dataUrl);

          // 使用原始文件名或生成一个
          const baseFilename = file.name || `dropped-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
          const resolvedFilename = resolveFilename(baseFilename, [
            ...existingFilenames,
            ...newImages.map(img => img.filename)
          ]);

          newImages.push({
            id: generateImageId(),
            filename: resolvedFilename,
            mimeType: file.type,
            size: file.size,
            data: dataUrl.split(',')[1], // 存储不含 data URL 前缀的 base64
            thumbnail
          });
        } catch {
          setError(t('wizard.errors.failedDropImage'));
        }
      }

      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
        // 显示成功反馈
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    },
    [images, isCreating, description, t]
  );

  /**
   * 从描述中解析 @提及 并创建 ReferencedFile 条目
   * 与现有的 referencedFiles 合并，避免重复
   */
  const parseFileMentions = useCallback((text: string, existingFiles: ReferencedFile[]): ReferencedFile[] => {
    // 匹配 @文件名 模式（支持包含点、短横线、下划线和路径分隔符的文件名）
    const mentionRegex = /@([\w\-./\\]+\.\w+)/g;
    const matches = Array.from(text.matchAll(mentionRegex));

    if (matches.length === 0) return existingFiles;

    // 创建现有文件名的集合以快速查找
    const existingNames = new Set(existingFiles.map(f => f.name));

    // 解析不在列表中的提及文件
    const newFiles: ReferencedFile[] = [];
    matches.forEach(match => {
      const fileName = match[1];
      if (!existingNames.has(fileName)) {
        newFiles.push({
          id: crypto.randomUUID(),
          path: fileName, // 存储来自 @提及的相对路径
          name: fileName,
          isDirectory: false,
          addedAt: new Date()
        });
        existingNames.add(fileName); // 防止提及中出现重复
      }
    });

    return [...existingFiles, ...newFiles];
  }, []);

  const handleCreate = async () => {
    if (!description.trim()) {
      setError(t('wizard.errors.descriptionRequired'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 从描述中解析 @提及并与引用文件合并
      const allReferencedFiles = parseFileMentions(description, referencedFiles);

      // 根据选择的值构建元数据
      const metadata: TaskMetadata = {
        sourceType: 'manual'
      };

      if (category) metadata.category = category;
      if (priority) metadata.priority = priority;
      if (complexity) metadata.complexity = complexity;
      if (impact) metadata.impact = impact;
      if (model) metadata.model = model;
      if (thinkingLevel) metadata.thinkingLevel = thinkingLevel;
      // 所有配置现在都支持每阶段配置
      // isAutoProfile 表示任务使用特定阶段的模型/思考
      if (phaseModels && phaseThinking) {
        metadata.isAutoProfile = true;
        metadata.phaseModels = phaseModels;
        metadata.phaseThinking = phaseThinking;
      }
      if (images.length > 0) metadata.attachedImages = images;
      if (allReferencedFiles.length > 0) metadata.referencedFiles = allReferencedFiles;
      if (requireReviewBeforeCoding) metadata.requireReviewBeforeCoding = true;
      // 仅当 baseBranch 不是项目默认占位符时才包含它
      if (baseBranch && baseBranch !== PROJECT_DEFAULT_BRANCH) metadata.baseBranch = baseBranch;
      // 传递工作树偏好 - false 表示使用 --direct 模式
      if (!useWorktree) metadata.useWorktree = false;

      // 标题是可选的 - 如果为空，将由后端自动生成
      const task = await createTask(projectId, title.trim(), description.trim(), metadata);
      if (task) {
        // Clear draft on successful creation
        clearDraft(projectId);
        // Reset form and close
        resetForm();
        onOpenChange(false);
      } else {
        setError(t('wizard.errors.createFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wizard.errors.unknownError'));
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setPriority('');
    setComplexity('');
    setImpact('');
    // 重置为选定的配置默认值和自定义设置
    setProfileId(settings.selectedAgentProfile || 'auto');
    setModel(selectedProfile.model);
    setThinkingLevel(selectedProfile.thinkingLevel);
    setPhaseModels(settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
    setPhaseThinking(settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
    setImages([]);
    setReferencedFiles([]);
    setRequireReviewBeforeCoding(false);
    setBaseBranch(PROJECT_DEFAULT_BRANCH);
    setUseWorktree(true);
    setError(null);
    setShowAdvanced(false);
    setShowFileExplorer(false);
    setShowGitOptions(false);
    setIsDraftRestored(false);
    setPasteSuccess(false);
  };

  /**
   * 处理对话框关闭 - 如果有内容则保存草稿
   */
  const handleClose = () => {
    if (isCreating) return;

    const draft = getCurrentDraft();

    // 如果有任何内容，则保存草稿
    if (!isDraftEmpty(draft)) {
      saveDraft(draft);
    } else {
      // 如果表单为空，则清除任何现有草稿
      clearDraft(projectId);
    }

    resetForm();
    onOpenChange(false);
  };

  /**
   * 丢弃草稿并重新开始
   */
  const handleDiscardDraft = () => {
    clearDraft(projectId);
    resetForm();
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-h-[90vh] p-0 overflow-hidden transition-all duration-300 ease-out",
          showFileExplorer ? "sm:max-w-[900px]" : "sm:max-w-[550px]"
        )}
        hideCloseButton={showFileExplorer}
      >
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* 表单内容 */}
          <div
            ref={formContainerRef}
            onDragOver={handleContainerDragOver}
            className="flex-1 flex flex-col p-6 min-w-0 min-h-0 overflow-y-auto relative"
          >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground">{t('wizard.title')}</DialogTitle>
            {isDraftRestored && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-info/10 text-info px-2 py-1 rounded-md">
                  {t('wizard.draftRestored')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleDiscardDraft}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('wizard.startFresh')}
                </Button>
              </div>
            )}
          </div>
          <DialogDescription>
            {t('wizard.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Description (Primary - Required) */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">
              {t('wizard.descriptionLabel')} <span className="text-destructive">*</span>
            </Label>
            {/* Wrap textarea for file @mentions */}
            <div className="relative">
              {/* Syntax highlight overlay for @mentions */}
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden rounded-md border border-transparent"
                style={{
                  padding: '0.5rem 0.75rem',
                  font: 'inherit',
                  lineHeight: '1.5',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  color: 'transparent'
                }}
              >
                {description.split(/(@[\w\-./\\]+\.\w+)/g).map((part, i) => {
                  // 检查这部分是否是 @提及
                  if (part.match(/^@[\w\-./\\]+\.\w+$/)) {
                    return (
                      <span
                        key={i}
                        className="bg-info/20 text-info-foreground rounded px-0.5"
                        style={{ color: 'hsl(var(--info))' }}
                      >
                        {part}
                      </span>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
              </div>
              <Textarea
                ref={descriptionRef}
                id="description"
                placeholder={t('wizard.descriptionPlaceholder')}
                value={description}
                onChange={handleDescriptionChange}
                onPaste={handlePaste}
                onDragOver={handleTextareaDragOver}
                onDragLeave={handleTextareaDragLeave}
                onDrop={handleTextareaDrop}
                rows={5}
                disabled={isCreating}
                aria-required="true"
                aria-describedby="description-help"
                className={cn(
                  "resize-y min-h-[120px] max-h-[400px] relative bg-transparent",
                  // 在文本区域上拖拽时的视觉反馈
                  isDragOverTextarea && !isCreating && "border-primary bg-primary/5 ring-2 ring-primary/20"
                )}
                style={{ caretColor: 'auto' }}
              />
              {/* 文件自动完成弹出框 */}
              {autocomplete?.show && projectPath && (
                <FileAutocomplete
                  query={autocomplete.query}
                  projectPath={projectPath}
                  position={autocomplete.position}
                  onSelect={handleAutocompleteSelect}
                  onClose={handleAutocompleteClose}
                />
              )}
            </div>
            <p id="description-help" className="text-xs text-muted-foreground">
              {t('wizard.descriptionHint')}
            </p>

            {/* 图片缩略图 - 在描述下方内联显示 */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="relative group rounded-md border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                    style={{ width: '64px', height: '64px' }}
                    onClick={() => {
                      // 可以在此处添加在新窗口/模态框中打开完整尺寸图片的功能
                    }}
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
                    {/* 移除按钮 */}
                    {!isCreating && (
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages(prev => prev.filter(img => img.id !== image.id));
                        }}
                        aria-label={t('images.removeImageAriaLabel', { filename: image.filename })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 标题（可选 - 如果为空则自动生成） */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-foreground">
              {t('wizard.titleLabel')} <span className="text-muted-foreground font-normal">{t('wizard.optional')}</span>
            </Label>
            <Input
              id="title"
              placeholder={t('wizard.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              {t('wizard.titleHint')}
            </p>
          </div>

          {/* Agent Profile Selection */}
          <AgentProfileSelector
            profileId={profileId}
            model={model}
            thinkingLevel={thinkingLevel}
            phaseModels={phaseModels}
            phaseThinking={phaseThinking}
            onProfileChange={(newProfileId, newModel, newThinkingLevel) => {
              setProfileId(newProfileId);
              setModel(newModel);
              setThinkingLevel(newThinkingLevel);
            }}
            onModelChange={setModel}
            onThinkingLevelChange={setThinkingLevel}
            onPhaseModelsChange={setPhaseModels}
            onPhaseThinkingChange={setPhaseThinking}
            disabled={isCreating}
          />

          {/* Paste Success Indicator */}
          {pasteSuccess && (
            <div className="flex items-center gap-2 text-sm text-success animate-in fade-in slide-in-from-top-1 duration-200">
              <ImageIcon className="h-4 w-4" />
              {t('wizard.imageAdded')}
            </div>
          )}

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors',
              'w-full justify-between py-2 px-3 rounded-md hover:bg-muted/50'
            )}
            disabled={isCreating}
            aria-expanded={showAdvanced}
            aria-controls="advanced-options-section"
          >
            <span>{t('wizard.classificationLabel')} {t('wizard.optional')}</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div id="advanced-options-section" className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-medium text-muted-foreground">
                    {t('wizard.categoryLabel')}
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value as TaskCategory)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="category" className="h-9">
                      <SelectValue placeholder={t('wizard.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-xs font-medium text-muted-foreground">
                    {t('wizard.priorityLabel')}
                  </Label>
                  <Select
                    value={priority}
                    onValueChange={(value) => setPriority(value as TaskPriority)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="priority" className="h-9">
                      <SelectValue placeholder={t('wizard.selectPriority')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Complexity */}
                <div className="space-y-2">
                  <Label htmlFor="complexity" className="text-xs font-medium text-muted-foreground">
                    {t('wizard.complexityLabel')}
                  </Label>
                  <Select
                    value={complexity}
                    onValueChange={(value) => setComplexity(value as TaskComplexity)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="complexity" className="h-9">
                      <SelectValue placeholder={t('wizard.selectComplexity')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_COMPLEXITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Impact */}
                <div className="space-y-2">
                  <Label htmlFor="impact" className="text-xs font-medium text-muted-foreground">
                    {t('wizard.impactLabel')}
                  </Label>
                  <Select
                    value={impact}
                    onValueChange={(value) => setImpact(value as TaskImpact)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="impact" className="h-9">
                      <SelectValue placeholder={t('wizard.selectImpact')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_IMPACT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t('wizard.classificationHint')}
              </p>
            </div>
          )}

          {/* Review Requirement Toggle */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="require-review"
              checked={requireReviewBeforeCoding}
              onCheckedChange={(checked) => setRequireReviewBeforeCoding(checked === true)}
              disabled={isCreating}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="require-review"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                {t('wizard.requireReviewLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('wizard.requireReviewHint')}
              </p>
            </div>
          </div>

          {/* Git Options Toggle */}
          <button
            type="button"
            onClick={() => setShowGitOptions(!showGitOptions)}
            className={cn(
              'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors',
              'w-full justify-between py-2 px-3 rounded-md hover:bg-muted/50'
            )}
            disabled={isCreating}
            aria-expanded={showGitOptions}
            aria-controls="git-options-section"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              {t('wizard.gitOptionsLabel')} {t('wizard.optional')}
              {baseBranch && baseBranch !== PROJECT_DEFAULT_BRANCH && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {baseBranch}
                </span>
              )}
            </span>
            {showGitOptions ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Git Options */}
          {showGitOptions && (
            <div id="git-options-section" className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="base-branch" className="text-sm font-medium text-foreground">
                  {t('wizard.baseBranchLabel')} {t('wizard.optional')}
                </Label>
                <Select
                  value={baseBranch}
                  onValueChange={setBaseBranch}
                  disabled={isCreating || isLoadingBranches}
                >
                  <SelectTrigger id="base-branch" className="h-9">
                    <SelectValue placeholder={t('wizard.useProjectDefault', { branch: projectDefaultBranch ? ` (${projectDefaultBranch})` : '' })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROJECT_DEFAULT_BRANCH}>
                      {t('wizard.useProjectDefault', { branch: projectDefaultBranch ? ` (${projectDefaultBranch})` : '' })}
                    </SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('wizard.baseBranchHint')}
                </p>
              </div>

              {/* Workspace Isolation Toggle */}
              <div className="flex items-start space-x-3 pt-2 border-t border-border/50">
                <Checkbox
                  id="use-worktree"
                  checked={useWorktree}
                  onCheckedChange={(checked) => setUseWorktree(checked === true)}
                  disabled={isCreating}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="use-worktree"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('wizard.gitOptions.useWorktreeLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('wizard.gitOptions.useWorktreeDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive" role="alert">
              <X className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2">
            {/* File Explorer Toggle Button */}
            {projectPath && (
              <Button
                type="button"
                variant={showFileExplorer ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFileExplorer(!showFileExplorer)}
                disabled={isCreating}
                className="gap-1.5"
              >
                <FolderTree className="h-4 w-4" />
                {showFileExplorer ? t('wizard.hideFiles') : t('wizard.browseFiles')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              {t('wizard.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !description.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('wizard.creating')}
                </>
              ) : (
                t('wizard.createTask')
              )}
            </Button>
          </div>
        </DialogFooter>
          </div>

          {/* File Explorer Drawer */}
          {projectPath && (
            <TaskFileExplorerDrawer
              isOpen={showFileExplorer}
              onClose={() => setShowFileExplorer(false)}
              projectPath={projectPath}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

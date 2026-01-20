import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { PromptInspectionModal } from './PromptInspectionModal';

export type PromptContext = 'roadmap' | 'kanban';

export interface InspectPromptsButtonProps {
  /** The context determines which prompts are shown */
  context: PromptContext;
  /** Optional custom button variant */
  variant?: 'outline' | 'ghost' | 'secondary';
  /** Optional custom button size */
  size?: 'sm' | 'default' | 'icon';
}

/**
 * A reusable button component that opens a modal to inspect agent prompts.
 * Shows context-appropriate prompts based on the current view (roadmap or kanban).
 */
export function InspectPromptsButton({
  context,
  variant = 'outline',
  size = 'sm'
}: InspectPromptsButtonProps) {
  const { t } = useTranslation('dialogs');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={() => setIsModalOpen(true)}
            aria-label={t('promptInspection.buttonLabel', { defaultValue: 'Inspect Prompts' })}
          >
            <FileText className="h-4 w-4 mr-1" />
            {t('promptInspection.buttonLabel', { defaultValue: 'Inspect Prompts' })}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('promptInspection.tooltipContent', { defaultValue: 'View agent prompts used in this context' })}
        </TooltipContent>
      </Tooltip>

      <PromptInspectionModal
        context={context}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

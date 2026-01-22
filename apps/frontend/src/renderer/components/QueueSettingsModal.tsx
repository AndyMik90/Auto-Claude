import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';

interface QueueSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentMaxParallel?: number;
  onSave: (maxParallel: number) => void;
}

export function QueueSettingsModal({
  open,
  onOpenChange,
  projectId,
  currentMaxParallel = 3,
  onSave
}: QueueSettingsModalProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const [maxParallel, setMaxParallel] = useState(currentMaxParallel);
  const [error, setError] = useState<string | null>(null);

  // Reset to current value when modal opens
  useEffect(() => {
    if (open) {
      setMaxParallel(currentMaxParallel);
      setError(null);
    }
  }, [open, currentMaxParallel]);

  const handleSave = () => {
    // Validate the input
    if (maxParallel < 1) {
      setError(t('tasks:queue.settings.minValueError'));
      return;
    }
    if (maxParallel > 10) {
      setError(t('tasks:queue.settings.maxValueError'));
      return;
    }

    onSave(maxParallel);
    onOpenChange(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Handle empty input - allow clearing the field
    if (inputValue === '') {
      setMaxParallel(0); // Reset to 0 (will fail validation, but allows re-entry)
      setError(null);
      return;
    }

    const value = parseInt(inputValue, 10);
    if (!isNaN(value)) {
      setMaxParallel(value);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tasks:queue.settings.title')}</DialogTitle>
          <DialogDescription>
            {t('tasks:queue.settings.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="maxParallel">
              {t('tasks:queue.settings.maxParallelLabel')}
            </Label>
            <Input
              id="maxParallel"
              type="number"
              min={1}
              max={10}
              value={maxParallel}
              onChange={handleInputChange}
              className="w-full"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {t('tasks:queue.settings.hint')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:buttons.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('common:buttons.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

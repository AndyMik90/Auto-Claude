/**
 * Human Input Dialog Component
 *
 * A dialog that allows users to respond to questions from AI agents
 * during task execution. Supports choice, multi-choice, text, and confirm question types.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Clock, AlertCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';

import type { HumanInputRequest, HumanInputOption } from '../../../shared/types/human-input';

interface HumanInputDialogProps {
  request: HumanInputRequest;
  onAnswer: (answer: string | string[] | boolean) => void;
  onSkip: () => void;
  open: boolean;
}

export function HumanInputDialog({ request, onAnswer, onSkip, open }: HumanInputDialogProps) {
  const { t } = useTranslation(['tasks', 'common']);

  // State for different question types
  const [selected, setSelected] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(request.timeout_seconds || 300);

  // Reset state when request changes
  useEffect(() => {
    setSelected(null);
    setMultiSelected([]);
    setTextAnswer('');
    setTimeLeft(request.timeout_seconds || 300);
  }, [request.id, request.timeout_seconds]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Handle multi-select toggle
  const handleMultiSelectToggle = useCallback((optionId: string) => {
    setMultiSelected((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    switch (request.type) {
      case 'choice':
        if (selected) {
          onAnswer(selected);
        }
        break;
      case 'multi_choice':
        if (multiSelected.length > 0) {
          onAnswer(multiSelected);
        }
        break;
      case 'text':
        if (textAnswer.trim()) {
          onAnswer(textAnswer.trim());
        }
        break;
      case 'confirm':
        if (selected !== null) {
          onAnswer(selected === 'yes');
        }
        break;
    }
  }, [request.type, selected, multiSelected, textAnswer, onAnswer]);

  // Determine if submit is disabled
  const isSubmitDisabled = () => {
    switch (request.type) {
      case 'choice':
      case 'confirm':
        return !selected;
      case 'multi_choice':
        return multiSelected.length === 0;
      case 'text':
        return !textAnswer.trim();
      default:
        return true;
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <DialogTitle>{request.question.title}</DialogTitle>
          </div>
          <DialogDescription className="mt-2">
            {request.question.description}
          </DialogDescription>
        </DialogHeader>

        {/* Context info */}
        {request.question.context && (
          <div className="bg-muted/50 p-3 rounded-md text-sm my-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">{request.question.context}</p>
            </div>
          </div>
        )}

        {/* Choice options */}
        {request.type === 'choice' && request.options && (
          <RadioGroup
            value={selected || ''}
            onValueChange={setSelected}
            className="space-y-3 my-4"
          >
            {request.options.map((option: HumanInputOption) => (
              <div
                key={option.id}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${selected === option.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                  }
                `}
                onClick={() => setSelected(option.id)}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor={option.id} className="cursor-pointer font-medium">
                    {option.label}
                    {option.recommended && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {t('tasks:humanInput.recommended')}
                      </Badge>
                    )}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        )}

        {/* Multi-choice options */}
        {request.type === 'multi_choice' && request.options && (
          <div className="space-y-3 my-4">
            {request.options.map((option: HumanInputOption) => (
              <div
                key={option.id}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${multiSelected.includes(option.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                  }
                `}
                onClick={() => handleMultiSelectToggle(option.id)}
              >
                <Checkbox
                  id={option.id}
                  checked={multiSelected.includes(option.id)}
                  onCheckedChange={() => handleMultiSelectToggle(option.id)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor={option.id} className="cursor-pointer font-medium">
                    {option.label}
                    {option.recommended && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {t('tasks:humanInput.recommended')}
                      </Badge>
                    )}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Text input */}
        {request.type === 'text' && (
          <div className="my-4">
            <Textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder={request.placeholder || t('tasks:humanInput.textPlaceholder')}
              className="min-h-[100px]"
              maxLength={request.max_length}
            />
            {request.max_length && (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {textAnswer.length}/{request.max_length}
              </p>
            )}
          </div>
        )}

        {/* Confirm buttons */}
        {request.type === 'confirm' && (
          <div className="flex gap-3 my-4">
            <Button
              variant={selected === 'yes' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setSelected('yes')}
            >
              {t('common:buttons.yes')}
            </Button>
            <Button
              variant={selected === 'no' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setSelected('no')}
            >
              {t('common:buttons.no')}
            </Button>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          {/* Timeout indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={timeLeft < 60 ? 'text-warning' : ''}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onSkip}>
              {t('tasks:humanInput.skip')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled()}
            >
              {t('tasks:humanInput.submit')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

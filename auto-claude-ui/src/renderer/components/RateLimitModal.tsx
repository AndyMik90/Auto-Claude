import { AlertCircle, ExternalLink, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { useRateLimitStore } from '../stores/rate-limit-store';

const CLAUDE_PRICING_URL = 'https://claude.ai/settings/plans';

export function RateLimitModal() {
  const { isModalOpen, rateLimitInfo, hideRateLimitModal } = useRateLimitStore();

  const handleUpgrade = () => {
    window.open(CLAUDE_PRICING_URL, '_blank');
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && hideRateLimitModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            Claude Code Usage Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've reached your Claude Code usage limit for this period.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Reset time info */}
          {rateLimitInfo?.resetTime && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Resets {rateLimitInfo.resetTime}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your usage will be restored at this time
                </p>
              </div>
            </div>
          )}

          {/* Upgrade prompt */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Need more usage?
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Upgrade your Claude subscription to get more usage or add additional funds to your account.
            </p>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={handleUpgrade}
            >
              <ExternalLink className="h-4 w-4" />
              View Plans & Pricing
            </Button>
          </div>

          {/* Tips */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Tips to manage usage:</p>
            <ul className="list-disc list-inside ml-2 space-y-0.5">
              <li>Use smaller tasks that require fewer messages</li>
              <li>Break complex tasks into smaller chunks</li>
              <li>Review and plan before running automated tasks</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={hideRateLimitModal}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

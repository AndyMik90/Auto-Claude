import { useTranslation } from 'react-i18next';
import { Search, Globe, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from './ui/alert-dialog';

interface CompetitorAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}

export function CompetitorAnalysisDialog({
  open,
  onOpenChange,
  onAccept,
  onDecline,
}: CompetitorAnalysisDialogProps) {
  const { t } = useTranslation(['roadmap']);

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('roadmap:competitorAnalysis.dialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {t('roadmap:competitorAnalysis.dialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-4">
          {/* What it does */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              {t('roadmap:competitorAnalysis.dialog.whatItDoes')}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <Search className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{t('roadmap:competitorAnalysis.dialog.identifyCompetitors')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Globe className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{t('roadmap:competitorAnalysis.dialog.searchFeedback')}</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{t('roadmap:competitorAnalysis.dialog.suggestFeatures')}</span>
              </li>
            </ul>
          </div>

          {/* Privacy notice */}
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">
                  {t('roadmap:competitorAnalysis.dialog.privacyTitle')}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('roadmap:competitorAnalysis.dialog.privacyDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Optional info */}
          <p className="text-xs text-muted-foreground">
            {t('roadmap:competitorAnalysis.dialog.optionalInfo')}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDecline}>
            {t('roadmap:competitorAnalysis.dialog.decline')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleAccept}>
            {t('roadmap:competitorAnalysis.dialog.accept')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

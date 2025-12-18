import { TrendingUp, ExternalLink, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type { CompetitorAnalysis } from '../../shared/types';

interface CompetitorAnalysisViewerProps {
  analysis: CompetitorAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompetitorAnalysisViewer({
  analysis,
  open,
  onOpenChange,
}: CompetitorAnalysisViewerProps) {
  if (!analysis) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Competitor Analysis Results
          </DialogTitle>
          <DialogDescription>
            Analyzed {analysis.competitors.length} competitors to identify market gaps and opportunities
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-4" style={{ maxHeight: 'calc(85vh - 120px)' }}>
          <div className="space-y-6 pb-4">
            {analysis.competitors.map((competitor) => (
              <div
                key={competitor.id}
                className="rounded-lg border border-border p-4 space-y-3"
              >
                {/* Competitor Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold">{competitor.name}</h3>
                      {competitor.marketPosition && (
                        <Badge variant="secondary" className="text-xs">
                          {competitor.marketPosition}
                        </Badge>
                      )}
                    </div>
                    {competitor.description && (
                      <p className="text-sm text-muted-foreground">
                        {competitor.description}
                      </p>
                    )}
                  </div>
                  {competitor.url && (
                    <a
                      href={competitor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-sm ml-4"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visit
                    </a>
                  )}
                </div>

                {/* Pain Points */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    Identified Pain Points ({competitor.painPoints.length})
                  </h4>
                  <div className="space-y-2">
                    {competitor.painPoints.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No pain points identified
                      </p>
                    ) : (
                      competitor.painPoints.map((painPoint) => (
                        <div
                          key={painPoint.id}
                          className="rounded bg-muted/50 p-3 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <Badge
                              variant={
                                painPoint.severity === 'high'
                                  ? 'destructive'
                                  : painPoint.severity === 'medium'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="mt-0.5"
                            >
                              {painPoint.severity}
                            </Badge>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {painPoint.description}
                              </p>
                              {painPoint.userQuotes && painPoint.userQuotes.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {painPoint.userQuotes.map((quote, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2"
                                    >
                                      "{quote}"
                                    </p>
                                  ))}
                                </div>
                              )}
                              {painPoint.opportunityScore !== undefined && (
                                <div className="mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    Opportunity Score:{' '}
                                    <span className="font-medium text-foreground">
                                      {painPoint.opportunityScore}/10
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Summary */}
            {analysis.summary && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <h4 className="text-sm font-semibold mb-2">Market Summary</h4>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

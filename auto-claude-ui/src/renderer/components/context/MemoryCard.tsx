import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import type { MemoryEpisode } from '../../../shared/types';
import { memoryTypeIcons } from './constants';
import { formatDate } from './utils';

interface MemoryCardProps {
  memory: MemoryEpisode;
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const Icon = memoryTypeIcons[memory.type] || memoryTypeIcons.session_insight;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">
                  {memory.type.replace('_', ' ')}
                </Badge>
                {memory.session_number && (
                  <span className="text-xs text-muted-foreground">
                    Session #{memory.session_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                {formatDate(memory.timestamp)}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
        {expanded && (
          <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono p-3 bg-background rounded-md max-h-64 overflow-auto">
            {memory.content}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Play, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface CommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function RunnerTester() {
  const { t } = useTranslation(['debug']);
  const [command, setCommand] = useState('gh pr list');
  const [args, setArgs] = useState('{}');
  const [output, setOutput] = useState<CommandOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    setOutput(null);

    try {
      // Parse arguments
      const parsedArgs = JSON.parse(args);

      // Simulate command execution (will be replaced with actual runner when handlers are ready)
      await new Promise((resolve) => setTimeout(resolve, 800));

      setOutput({
        stdout: `Simulated output for command: ${command}\nArguments: ${JSON.stringify(parsedArgs, null, 2)}\n\nRunner handlers not yet implemented.`,
        stderr: '',
        exitCode: 0,
      });
    } catch (error) {
      setOutput({
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setOutput(null);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Input Section */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="runner-command" className="mb-2">
            {t('runner.commandLabel')}
          </Label>
          <Input
            id="runner-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t('runner.commandPlaceholder')}
            className="font-mono"
          />
        </div>

        <div>
          <Label htmlFor="runner-args" className="mb-2">
            {t('runner.argsLabel')}
          </Label>
          <Textarea
            id="runner-args"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder={t('runner.argsPlaceholder')}
            className="font-mono min-h-[100px]"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleExecute} disabled={isLoading}>
            <Play className="mr-2 h-4 w-4" />
            {t('runner.executeButton')}
          </Button>
          <Button variant="outline" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('runner.clearButton')}
          </Button>
        </div>
      </div>

      {/* Output Section */}
      <div className="flex-1 flex flex-col">
        <Label className="mb-2">{t('runner.outputTitle')}</Label>
        <div className="flex-1 rounded-lg border bg-muted/50 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              {!output ? (
                <p className="text-sm text-muted-foreground">{t('runner.noOutput')}</p>
              ) : (
                <Tabs defaultValue="stdout" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="stdout">{t('runner.stdoutLabel')}</TabsTrigger>
                    <TabsTrigger value="stderr">{t('runner.stderrLabel')}</TabsTrigger>
                    <TabsTrigger value="exitcode">{t('runner.exitCodeLabel')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="stdout">
                    <pre className="text-sm font-mono bg-background rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                      {output.stdout || '<empty>'}
                    </pre>
                  </TabsContent>

                  <TabsContent value="stderr">
                    <pre className="text-sm font-mono bg-background rounded-lg p-4 overflow-x-auto whitespace-pre-wrap text-red-500">
                      {output.stderr || '<empty>'}
                    </pre>
                  </TabsContent>

                  <TabsContent value="exitcode">
                    <div className="text-sm font-mono bg-background rounded-lg p-4">
                      <span className={output.exitCode === 0 ? 'text-green-500' : 'text-red-500'}>
                        {output.exitCode !== null ? output.exitCode : 'N/A'}
                      </span>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

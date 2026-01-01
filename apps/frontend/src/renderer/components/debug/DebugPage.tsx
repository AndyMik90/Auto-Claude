import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ConfigInspector } from './ConfigInspector';
import { LogViewer } from './LogViewer';
import { IPCTester } from './IPCTester';
import { RunnerTester } from './RunnerTester';

export function DebugPage() {
  const { t } = useTranslation(['debug']);
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Debug & Testing</h1>
        <p className="text-muted-foreground">
          Diagnostic tools for IPC, backend runners, logs, and configuration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">{t('tabs.config')}</TabsTrigger>
          <TabsTrigger value="ipc">{t('tabs.ipc')}</TabsTrigger>
          <TabsTrigger value="runner">{t('tabs.runner')}</TabsTrigger>
          <TabsTrigger value="logs">{t('tabs.logs')}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="flex-1 mt-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('config.title')}</CardTitle>
              <CardDescription>{t('config.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigInspector />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ipc" className="flex-1 mt-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('ipc.title')}</CardTitle>
              <CardDescription>{t('ipc.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <IPCTester />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runner" className="flex-1 mt-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('runner.title')}</CardTitle>
              <CardDescription>{t('runner.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <RunnerTester />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="flex-1 mt-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('logs.title')}</CardTitle>
              <CardDescription>{t('logs.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <LogViewer />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

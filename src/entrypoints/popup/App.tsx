import { useLiveQuery } from 'dexie-react-hooks';
import { Settings } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Button } from '@/components/ui/button';
import { ToastProvider } from '@/components/ui/toast';
import { db } from '@/db';
import { HotNewsView } from '@/features/hotNews/components/HotNewsView';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { RecordingsView } from '@/features/recorder/components/RecordingsView';
import { useTheme } from '@/hooks/useTheme';

export function App() {
  useTheme();

  const jenkinsToken = useLiveQuery(async () => {
    const setting = await db.settings.get('jenkins_token');
    return setting?.value as string | undefined;
  });

  const featureToggles = useLiveQuery(async () => {
    const hotNews = await db.settings.get('feature_hotnews_enabled');
    const links = await db.settings.get('feature_links_enabled');
    return {
      hotNews: hotNews?.value !== false,
      links: links?.value !== false,
    };
  }) ?? { hotNews: true, links: true };

  const serverUrl = useLiveQuery(async () => {
    const setting = await db.settings.get('custom_server_url');
    return setting?.value as string | undefined;
  });

  const showSyncButton = !!serverUrl;
  const hasJenkins = !!jenkinsToken;

  const [activeTab, setActiveTab] = useState<'links' | 'jenkins' | 'hotNews' | 'recorder'>('links');

  useEffect(() => {
    if (hasJenkins) {
      setActiveTab('jenkins');
    } else if (featureToggles.links) {
      setActiveTab('links');
    } else if (featureToggles.hotNews) {
      setActiveTab('hotNews');
    }
  }, [hasJenkins, featureToggles.links, featureToggles.hotNews]);

  const openSettings = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  };

  return (
    <ToastProvider>
      <div className="flex flex-col h-full bg-background text-foreground">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold">DPP</h1>
          <div className="flex items-center gap-1">
            {showSyncButton && <GlobalSyncButton />}
            <Button variant="ghost" size="icon" onClick={openSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b">
          {hasJenkins && (
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'jenkins' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('jenkins')}
            >
              Jenkins
            </button>
          )}
          {featureToggles.links && (
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'links' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('links')}
            >
              链接
            </button>
          )}
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'recorder' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('recorder')}
          >
            录制
          </button>
          {featureToggles.hotNews && (
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'hotNews' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('hotNews')}
            >
              热点
            </button>
          )}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-hidden p-2">
          {activeTab === 'links' && featureToggles.links && <LinksView />}
          {activeTab === 'jenkins' && hasJenkins && <JenkinsView />}
          {activeTab === 'recorder' && <RecordingsView />}
          {activeTab === 'hotNews' && featureToggles.hotNews && <HotNewsView />}
        </main>
      </div>
    </ToastProvider>
  );
}

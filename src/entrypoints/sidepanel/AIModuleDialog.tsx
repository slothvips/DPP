import { Lightbulb, X } from 'lucide-react';
import { lazy, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BlackboardView } from '@/features/blackboard/components/BlackboardView';
import { HotNewsView } from '@/features/hotNews/components/HotNewsView';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { KeepAliveTabPanel } from './KeepAliveTabPanel';
import { LazyTabPanel } from './LazyTabPanel';
import { TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, ModuleTabId } from './sidepanelTypes';

const RecordingsView = lazy(() =>
  import('@/features/recorder/components/RecordingsView').then((module) => ({
    default: module.RecordingsView,
  }))
);
const ToolboxView = lazy(() =>
  import('@/features/toolbox/components/ToolboxView').then((module) => ({
    default: module.ToolboxView,
  }))
);
const TotpView = lazy(() =>
  import('@/features/totp/components/TotpView').then((module) => ({
    default: module.TotpView,
  }))
);

interface AIModuleDialogProps {
  activeModule: ModuleTabId | null;
  featureToggles: FeatureToggles;
  onClose: () => void;
}

function ModuleLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        正在打开模块
      </div>
    </div>
  );
}

export function AIModuleDialog({ activeModule, featureToggles, onClose }: AIModuleDialogProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const moduleConfig = activeModule ? TAB_CONFIG[activeModule] : TAB_CONFIG.aiAssistant;
  const isOpen = activeModule !== null && moduleConfig.getVisible({ featureToggles });

  useEffect(() => {
    if (!activeModule) setGuideOpen(false);
  }, [activeModule]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        forceMount
        hideCloseButton
        className="inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 data-[state=closed]:hidden sm:rounded-none"
      >
        <DialogHeader className="relative shrink-0 border-b border-border/60 bg-background px-4 py-3 pr-14 text-left shadow-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {moduleConfig.icon}
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <DialogTitle className="truncate text-sm font-semibold">
                  {moduleConfig.label}
                </DialogTitle>
                {activeModule && (
                  <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:!translate-y-0 active:!translate-y-0 hover:text-foreground"
                      aria-label={`${moduleConfig.label}使用说明`}
                      title={`${moduleConfig.label}使用说明`}
                      onClick={() => setGuideOpen(true)}
                    >
                      <Lightbulb className="h-4 w-4" />
                    </Button>
                    <DialogContent className="max-h-[82vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{moduleConfig.label}使用说明</DialogTitle>
                        <DialogDescription>{moduleConfig.usageGuide.summary}</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-3">
                        {moduleConfig.usageGuide.sections.map((section) => (
                          <section key={section.title} className="grid gap-2">
                            <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                            <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground">
                              {section.items.map((item) => (
                                <li key={item} className="flex gap-2">
                                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <DialogDescription className="truncate text-xs">
                {moduleConfig.description}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg text-muted-foreground hover:!-translate-y-1/2 active:!-translate-y-1/2 hover:text-foreground"
                aria-label="关闭模块"
                title="关闭模块"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          <KeepAliveTabPanel active={activeModule === 'links'} visible={featureToggles.links}>
            <ErrorBoundary moduleName={TAB_CONFIG.links.label} className="h-full">
              <LinksView />
            </ErrorBoundary>
          </KeepAliveTabPanel>
          <KeepAliveTabPanel active={activeModule === 'jenkins'} visible={featureToggles.jenkins}>
            <ErrorBoundary moduleName={TAB_CONFIG.jenkins.label} className="h-full">
              <JenkinsView />
            </ErrorBoundary>
          </KeepAliveTabPanel>
          <LazyTabPanel
            active={activeModule === 'recorder'}
            visible={featureToggles.recorder}
            fallback={<ModuleLoadingFallback />}
          >
            <ErrorBoundary moduleName={TAB_CONFIG.recorder.label} className="h-full">
              <RecordingsView />
            </ErrorBoundary>
          </LazyTabPanel>
          <LazyTabPanel
            active={activeModule === 'blackboard'}
            visible={featureToggles.blackboard}
            fallback={<ModuleLoadingFallback />}
          >
            <ErrorBoundary moduleName={TAB_CONFIG.blackboard.label} className="h-full">
              <BlackboardView />
            </ErrorBoundary>
          </LazyTabPanel>
          <LazyTabPanel
            active={activeModule === 'hotNews'}
            visible={featureToggles.hotNews}
            fallback={<ModuleLoadingFallback />}
          >
            <ErrorBoundary moduleName={TAB_CONFIG.hotNews.label} className="h-full">
              <HotNewsView />
            </ErrorBoundary>
          </LazyTabPanel>
          <LazyTabPanel
            active={activeModule === 'playground'}
            visible={featureToggles.playground}
            fallback={<ModuleLoadingFallback />}
          >
            <ErrorBoundary moduleName={TAB_CONFIG.playground.label} className="h-full">
              <ToolboxView />
            </ErrorBoundary>
          </LazyTabPanel>
          <LazyTabPanel
            active={activeModule === 'totp'}
            visible={featureToggles.totp}
            fallback={<ModuleLoadingFallback />}
          >
            <ErrorBoundary moduleName={TAB_CONFIG.totp.label} className="h-full">
              <TotpView isActive={activeModule === 'totp'} />
            </ErrorBoundary>
          </LazyTabPanel>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/toast';
import { useTheme } from '@/hooks/useTheme';
import { ConfirmDialogProvider } from '@/utils/confirm-dialog';
import '@unocss/reset/tailwind.css';
import { AppearanceSection } from './AppearanceSection';
import { DangerZoneSection } from './DangerZoneSection';
import { DataManagementSection } from './DataManagementSection';
import { ExportSettingsDialog } from './ExportSettingsDialog';
import { FeatureTogglesSection } from './FeatureTogglesSection';
import { FooterLinks } from './FooterLinks';
import { JenkinsSection } from './JenkinsSection';
import { SyncSettingsSection } from './SyncSettingsSection';
import { useOptionsPage } from './useOptionsPage';

function OptionsApp() {
  useTheme();

  const {
    accessToken,
    autoSync,
    clearData,
    customConfig,
    featureToggles,
    handleExport,
    handleSelectFile,
    lastSyncTime,
    rebuildLocalData,
    saveDataSourceConfig,
    selectedCategories,
    setAccessToken,
    setAutoSync,
    setCustomConfig,
    setSelectedCategories,
    setShowExportDialog,
    showExportDialog,
    toggleFeature,
  } = useOptionsPage();

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="options-page">
      <div className="container mx-auto p-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold" data-testid="options-title">
            DPP 设置
          </h1>
          {import.meta.env.MODE === 'development' && (
            <span className="px-1.5 py-0.5 text-xs font-bold text-destructive-foreground bg-destructive rounded">
              DEV
            </span>
          )}
        </div>

        <div className="space-y-8">
          <AppearanceSection />

          <FeatureTogglesSection featureToggles={featureToggles} onToggle={toggleFeature} />

          <JenkinsSection />

          <SyncSettingsSection
            accessToken={accessToken}
            autoSync={autoSync}
            customConfig={customConfig}
            lastSyncTime={lastSyncTime}
            onAccessTokenChange={setAccessToken}
            onAutoSyncChange={setAutoSync}
            onCustomConfigChange={setCustomConfig}
            onSave={saveDataSourceConfig}
          />

          <DataManagementSection
            onExport={() => setShowExportDialog(true)}
            onImport={handleSelectFile}
            onRebuild={rebuildLocalData}
          />

          <DangerZoneSection onClearData={clearData} />

          <ExportSettingsDialog
            open={showExportDialog}
            selectedCategories={selectedCategories}
            onConfirm={handleExport}
            onOpenChange={setShowExportDialog}
            onSelectedCategoriesChange={setSelectedCategories}
          />

          <FooterLinks />
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ConfirmDialogProvider>
          <ErrorBoundary>
            <OptionsApp />
          </ErrorBoundary>
        </ConfirmDialogProvider>
      </ToastProvider>
    </React.StrictMode>
  );
}

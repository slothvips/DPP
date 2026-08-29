import { useOptionsDataManagement } from './useOptionsDataManagement';
import { useOptionsSettings } from './useOptionsSettings';

export function useOptionsPage() {
  const {
    accessToken,
    autoSync,
    customConfig,
    featureToggles,
    featureToggleSaving,
    lastSyncTime,
    saveDataSourceConfig,
    settingsLoading,
    settingsSaving,
    selectedCategories,
    setAccessToken,
    setAutoSync,
    setCustomConfig,
    setSelectedCategories,
    setShowExportDialog,
    showExportDialog,
    toggleFeature,
  } = useOptionsSettings();

  const {
    clearData,
    handleExport,
    handleImport,
    handleSelectFile,
    rebuildPhase,
    rebuildLocalData,
    selectedImportCategories,
    setSelectedImportCategories,
    setShowImportDialog,
    showImportDialog,
  } = useOptionsDataManagement({ selectedCategories, setShowExportDialog });

  return {
    accessToken,
    autoSync,
    clearData,
    customConfig,
    featureToggles,
    featureToggleSaving,
    handleExport,
    handleImport,
    handleSelectFile,
    lastSyncTime,
    rebuildPhase,
    rebuildLocalData,
    saveDataSourceConfig,
    settingsLoading,
    settingsSaving,
    selectedCategories,
    setAccessToken,
    setAutoSync,
    setCustomConfig,
    setSelectedCategories,
    setShowExportDialog,
    selectedImportCategories,
    setSelectedImportCategories,
    setShowImportDialog,
    showImportDialog,
    showExportDialog,
    toggleFeature,
  };
}

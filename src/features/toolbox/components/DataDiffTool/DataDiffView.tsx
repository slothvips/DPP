import { DataDiffHeader } from './DataDiffHeader';
import { DataDiffInputPanel } from './DataDiffInputPanel';
import { DataDiffResultPanel } from './DataDiffResultPanel';
import { DataDiffUpdateModal } from './DataDiffUpdateModal';
import type { DataDiffViewProps } from './dataDiffTypes';
import { useDataDiffView } from './useDataDiffView';

export function DataDiffView({ onBack }: DataDiffViewProps) {
  const {
    closeModal,
    counts,
    currentFields,
    dataA,
    dataB,
    error,
    handleBackToInput,
    handleClear,
    handleCompare,
    handleUpdateClick,
    setDataA,
    setDataB,
    setShowDiffOnly,
    showDiffOnly,
    showModal,
    showResult,
    treeData,
    updateDetails,
  } = useDataDiffView();

  if (!showResult) {
    return (
      <div className="flex flex-col h-full" data-testid="data-diff-view">
        <DataDiffHeader
          onBack={onBack}
          title="树形数据对比"
          subtitle="输入两组树形/扁平数据，自动检测层级关系并对比差异"
        />
        <DataDiffInputPanel
          dataA={dataA}
          dataB={dataB}
          error={error}
          onChangeDataA={setDataA}
          onChangeDataB={setDataB}
          onClear={handleClear}
          onCompare={handleCompare}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="data-diff-view">
      <DataDiffHeader
        onBack={handleBackToInput}
        title="差异对比结果"
        subtitle="完整展示数据层级结构，差异项已用标签标记"
      />
      <DataDiffResultPanel
        counts={counts}
        currentFields={currentFields}
        onShowDiffOnlyChange={setShowDiffOnly}
        onUpdateClick={handleUpdateClick}
        showDiffOnly={showDiffOnly}
        treeData={treeData}
      />
      {showModal && <DataDiffUpdateModal details={updateDetails} onClose={closeModal} />}
    </div>
  );
}

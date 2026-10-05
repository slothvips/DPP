import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DecryptedTestCaseMaterial } from '@/features/aiAssistant/materials/testCaseTypes';
import { DetailSection, formatDate } from './materialLibraryShared';

export function TestCaseDetail({
  material,
  embedded = false,
  onBack,
  onEdit,
}: {
  material: DecryptedTestCaseMaterial;
  embedded?: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { definition } = material.content;

  return (
    <div className={embedded ? 'p-4' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <Pencil className="h-3.5 w-3.5" />
          编辑
        </Button>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-words text-base font-semibold text-foreground">
              {material.title}
            </h2>
            <span className="shrink-0 text-xs text-muted-foreground">v{material.version}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground">{definition.goal}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            更新于 {formatDate(material.updatedAt)}
          </p>
        </div>

        <DetailSection title="目标网页">
          <ol className="space-y-2">
            {definition.targets.map((target) => (
              <li key={target.id} className="rounded-lg bg-muted/35 px-3 py-2 text-xs">
                <div className="font-medium text-foreground">
                  {target.order}. {target.name || target.id}
                </div>
                <div className="mt-1 break-all text-muted-foreground">{target.url}</div>
              </li>
            ))}
          </ol>
        </DetailSection>

        {definition.preconditions.length > 0 && (
          <DetailSection title="前置条件">
            <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
              {definition.preconditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </DetailSection>
        )}

        {definition.testData.length > 0 && (
          <DetailSection title="测试数据">
            <div className="space-y-2">
              {definition.testData.map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 text-xs"
                >
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="break-all text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="测试步骤">
          <ol className="space-y-2">
            {definition.steps.map((step) => (
              <li key={step.id} className="rounded-lg border border-border/50 px-3 py-2 text-xs">
                <div className="font-medium text-foreground">
                  {step.order}. {step.action}
                </div>
                <div className="mt-1 text-muted-foreground">目标：{step.targetId}</div>
                {step.expectedResult && (
                  <div className="mt-1 text-muted-foreground">预期：{step.expectedResult}</div>
                )}
              </li>
            ))}
          </ol>
        </DetailSection>

        {definition.overallExpectedResult && (
          <DetailSection title="整体预期结果">
            <p className="text-xs leading-5 text-muted-foreground">
              {definition.overallExpectedResult}
            </p>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface DataDiffInputPanelProps {
  dataA: string;
  dataB: string;
  error: string | null;
  onChangeDataA: (value: string) => void;
  onChangeDataB: (value: string) => void;
  onClear: () => void;
  onCompare: () => void;
}

export function DataDiffInputPanel({
  dataA,
  dataB,
  error,
  onChangeDataA,
  onChangeDataB,
  onClear,
  onCompare,
}: DataDiffInputPanelProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>数据源 A（旧）</Label>
          <Textarea
            value={dataA}
            onChange={(event) => onChangeDataA(event.target.value)}
            placeholder='扁平数据: [{"id":"1","name":"节点1","pid":"0",...}]&#10;&#10;树形数据: [{"id":"1","name":"节点1","children":[...]}]'
            className="font-mono text-xs min-h-[280px]"
          />
        </div>
        <div className="space-y-2">
          <Label>数据源 B（新）</Label>
          <Textarea
            value={dataB}
            onChange={(event) => onChangeDataB(event.target.value)}
            placeholder='扁平数据: [{"id":"1","name":"节点1","pid":"0",...}]&#10;&#10;树形数据: [{"id":"1","name":"节点1","children":[...]}]'
            className="font-mono text-xs min-h-[280px]"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClear}>
          清空
        </Button>
        <Button onClick={onCompare}>开始对比</Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

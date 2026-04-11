import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SETTINGS_CATEGORIES } from './optionsShared';

interface ExportSettingsDialogProps {
  open: boolean;
  selectedCategories: string[];
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSelectedCategoriesChange: (categories: string[]) => void;
}

export function ExportSettingsDialog({
  open,
  selectedCategories,
  onConfirm,
  onOpenChange,
  onSelectedCategoriesChange,
}: ExportSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出应用设置</DialogTitle>
          <DialogDescription>选择要导出的设置类型</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {SETTINGS_CATEGORIES.map((category) => (
            <div key={category.key} className="flex items-center space-x-3">
              <Checkbox
                id={`export-${category.key}`}
                checked={selectedCategories.includes(category.key)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelectedCategoriesChange([...selectedCategories, category.key]);
                    return;
                  }

                  onSelectedCategoriesChange(
                    selectedCategories.filter((key) => key !== category.key)
                  );
                }}
              />
              <Label
                htmlFor={`export-${category.key}`}
                className="text-sm font-medium cursor-pointer"
              >
                {category.label}
                <span className="text-muted-foreground text-xs ml-2">{category.description}</span>
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>导出</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

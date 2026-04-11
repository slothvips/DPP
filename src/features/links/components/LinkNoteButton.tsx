import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface LinkNoteButtonProps {
  note: string;
}

export function LinkNoteButton({ note }: LinkNoteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(event) => {
            event.stopPropagation();
          }}
          title="查看备注"
        >
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
          </div>
          <div className="p-3 text-sm whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
            {note}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

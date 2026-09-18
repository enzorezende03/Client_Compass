import { useState } from 'react';
import { Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SlaCatalogPanel } from '@/components/SlaCatalogPanel';

export function SlaCatalogSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Prazos" onClick={() => setOpen(true)}>
            <Timer className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Prazos das demandas</TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Prazos</SheetTitle>
            <SheetDescription>Prazos acordados (SLA) por tipo de demanda.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 mt-3">
            <SlaCatalogPanel compact />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

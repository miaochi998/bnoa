'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoneConfigPanel } from './ZoneConfigPanel';
import { PriceMatrixPanel } from './PriceMatrixPanel';
import { SurchargePanel } from './SurchargePanel';
import { CostCalculator } from './CostCalculator';
import { MapPin, DollarSign, AlertCircle, Calculator } from 'lucide-react';

interface PriceManageDialogProps {
  companyId: string;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceManageDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
}: PriceManageDialogProps) {
  const [activeTab, setActiveTab] = useState('zones');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit min-w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>价格管理 - {companyName}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="zones" className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              区域配置
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              价格矩阵
            </TabsTrigger>
            <TabsTrigger value="surcharges" className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              附加费
            </TabsTrigger>
            <TabsTrigger value="calculator" className="flex items-center gap-1">
              <Calculator className="w-4 h-4" />
              成本计算
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="mt-4">
            <ZoneConfigPanel companyId={companyId} />
          </TabsContent>

          <TabsContent value="prices" className="mt-4">
            <PriceMatrixPanel
              companyId={companyId}
              companyName={companyName}
            />
          </TabsContent>

          <TabsContent value="surcharges" className="mt-4">
            <SurchargePanel companyId={companyId} />
          </TabsContent>

          <TabsContent value="calculator" className="mt-4">
            <CostCalculator />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * @fileoverview ConfirmationDialog - حوار تأكيد التصنيف
 * 
 * @description
 * مكون حوار (Dialog) بيظهر لما يكون التصنيف الذكي مش متأكد 100% من نوع السطر.
 * بيسمح للمستخدم يؤكد أو يعدل التصنيف المقترح للأسطر اللي confidence بتاعها منخفض.
 * 
 * @usage
 * بيستخدم داخل EditorArea عشان يطلب تأكيد من المستخدم لما HybridClassifier
 * يرجع confidence < threshold معين.
 * 
 * @example
 * <ClassificationConfirmationDialog
 *   open={confirmationState.open}
 *   line={confirmationState.line}
 *   suggestedType={confirmationState.suggestedType}
 *   confidence={confirmationState.confidence}
 *   onConfirm={handleConfirmClassification}
 *   onCancel={handleCancelConfirmation}
 * />
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { classificationTypeOptions } from "@/constants/formats";

interface ClassificationConfirmationDialogProps {
  open: boolean;
  line: string;
  suggestedType: string;
  confidence: number;
  onConfirm: (finalType: string) => void;
  onCancel: () => void;
}

export const ClassificationConfirmationDialog: React.FC<
  ClassificationConfirmationDialogProps
> = ({ open, line, suggestedType, confidence, onConfirm, onCancel }) => {
  const [selectedType, setSelectedType] = useState(suggestedType);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تأكيد التصنيف</DialogTitle>
          <DialogDescription>
            الثقة في التصنيف منخفضة ({Math.round(confidence)}%). يرجى تأكيد نوع
            هذا السطر:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="mb-2 text-sm font-medium">السطر:</p>
            <p className="rounded-md border bg-muted p-3 text-sm" dir="rtl">
              {line}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">النوع:</p>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              dir="rtl"
            >
              {classificationTypeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button variant="outline" onClick={onCancel}>
            إلغاء
          </Button>
          <Button onClick={() => onConfirm(selectedType)}>تأكيد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassificationConfirmationDialog;

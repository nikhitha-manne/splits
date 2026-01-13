import { useEffect } from 'react';
import { computeTotals } from '../../../services/billService';

interface UseItemBasedTotalsParams {
  billUploadId: string | null;
  billItems: { id: string }[];
  itemAssignments: Record<string, unknown[]>;
  splitType: string;
  setItemTotals: (totals: Map<string, number>) => void;
}

/**
 * Hook to compute item totals when items or assignments change
 */
export function useItemBasedTotals({
  billUploadId,
  billItems,
  itemAssignments,
  splitType,
  setItemTotals,
}: UseItemBasedTotalsParams) {
  useEffect(() => {
    const computeTotalsAsync = async () => {
      if (!billUploadId || billItems.length === 0 || splitType !== 'ITEM_BASED') {
        setItemTotals(new Map());
        return;
      }

      try {
        const totals = await computeTotals(billUploadId);
        setItemTotals(totals);
      } catch (err) {
        console.error('Failed to compute totals:', err);
        setItemTotals(new Map());
      }
    };

    computeTotalsAsync();
  }, [billItems, itemAssignments, splitType, billUploadId, setItemTotals]);
}

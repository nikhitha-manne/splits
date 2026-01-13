import { type BillItem, type ItemAssignment } from '../../../services/billService';
import { type ContainerType } from '../types';
import { AssignmentModal } from './AssignmentModal';
import { ItemEditModal } from './ItemEditModal';

interface ItemBasedSectionProps {
  billUploadId: string | null;
  billImageUrl: string | null;
  uploadingImage: boolean;
  billItems: BillItem[];
  itemAssignments: Record<string, ItemAssignment[]>;
  currency: string;
  currentUserId: string;
  containerType: ContainerType;
  directOtherUserName?: string;
  participants: string[];
  onBillImageUpload: (file: File) => Promise<void>;
  onRemoveBillImage: () => void;
  onAddItem: () => void;
  onEditItem: (item: BillItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAssignItem: (item: BillItem) => void;
  onSaveItemAssignments: (itemId: string, assignments: ItemAssignment[]) => Promise<void>;
  onSaveItem: (item: { id: string; name: string; price: number; orderIndex: number }) => Promise<void>;
  editingItem: BillItem | null;
  selectedItemForAssignment: BillItem | null;
  onCloseEditModal: () => void;
  onCloseAssignmentModal: () => void;
}

export function ItemBasedSection({
  billUploadId,
  billImageUrl,
  uploadingImage,
  billItems,
  itemAssignments,
  currency,
  currentUserId,
  containerType,
  directOtherUserName,
  participants,
  onBillImageUpload,
  onRemoveBillImage,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAssignItem,
  onSaveItemAssignments,
  onSaveItem,
  editingItem,
  selectedItemForAssignment,
  onCloseEditModal,
  onCloseAssignmentModal,
}: ItemBasedSectionProps) {
  const formatCurrency = (amount: number, currencyCode: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Bill Upload Section */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Bill Photo <span className="text-red-500">*</span>
          </label>
          {billImageUrl ? (
            <div className="space-y-2">
              <img
                src={billImageUrl}
                alt="Bill"
                className="w-full max-h-64 object-contain border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={onRemoveBillImage}
                className="text-sm text-red-600 underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onBillImageUpload(file);
                  }
                }}
                className="hidden"
                id="bill-upload"
                disabled={uploadingImage}
              />
              <label
                htmlFor="bill-upload"
                className={`block w-full border-2 border-dashed border-gray-300 rounded px-4 py-8 text-center cursor-pointer hover:border-blue-500 ${
                  uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploadingImage ? (
                  <span className="text-sm text-gray-600">Uploading...</span>
                ) : (
                  <span className="text-sm text-gray-600">Click to upload bill photo</span>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Items List Section */}
        {billUploadId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Items</label>
              <button
                type="button"
                onClick={onAddItem}
                className="text-sm text-blue-600 underline"
              >
                + Add Item
              </button>
            </div>

            {billItems.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No items yet. Add items manually.</p>
            ) : (
              <div className="space-y-2">
                {billItems.map((item) => {
                  const assignments = itemAssignments[item.id] || [];
                  const assignedSum = assignments.reduce((sum, a) => sum + a.share, 0);
                  const isFullyAssigned = Math.abs(assignedSum - item.price) < 0.01;

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(item.price, currency)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onAssignItem(item)}
                            className={`text-xs px-2 py-1 rounded ${
                              isFullyAssigned
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {isFullyAssigned ? 'Assigned' : 'Assign'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="text-xs text-blue-600 underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item.id)}
                            className="text-xs text-red-600 underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {!isFullyAssigned && (
                        <p className="text-xs text-red-600 mt-1">
                          Not fully assigned: {formatCurrency(assignedSum, currency)} /{' '}
                          {formatCurrency(item.price, currency)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Item Edit Modal */}
      {editingItem !== null && (
        <ItemEditModal
          item={editingItem}
          onSave={async (item) => {
            await onSaveItem(item);
            onCloseEditModal();
          }}
          onClose={onCloseEditModal}
        />
      )}

      {/* Item Assignment Modal */}
      {selectedItemForAssignment && (
        <AssignmentModal
          item={selectedItemForAssignment}
          participants={participants}
          currency={currency}
          assignments={itemAssignments[selectedItemForAssignment.id] || []}
          onSave={async (assignments) => {
            await onSaveItemAssignments(selectedItemForAssignment.id, assignments);
          }}
          onClose={onCloseAssignmentModal}
          currentUserId={currentUserId}
          containerType={containerType}
          directOtherUserName={directOtherUserName}
        />
      )}
    </>
  );
}

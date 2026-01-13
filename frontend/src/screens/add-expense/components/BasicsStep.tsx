import { type Currency } from '../../../services/currencyService';

interface BasicsStepProps {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  amount: string;
  setAmount: (amount: string) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

export function BasicsStep({
  title,
  setTitle,
  description,
  setDescription,
  amount,
  setAmount,
  currency,
  setCurrency,
}: BasicsStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Dinner at restaurant"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">Description (optional)</label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Amount <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Currency <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
        >
          <option value="USD">USD</option>
          <option value="INR">INR</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="CAD">CAD</option>
          <option value="AUD">AUD</option>
        </select>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Save, X, DollarSign, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ClientBudget } from '../lib/types';
import { useAppContext } from '../lib/AppContext';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';

interface ClientBudgetFormProps {
  clientId: string;
  onSave: () => void;
  onCancel: () => void;
  initialMonth?: Date;
  existingBudget?: ClientBudget;
}

export function ClientBudgetForm({ 
  clientId, 
  onSave, 
  onCancel, 
  initialMonth = new Date(),
  existingBudget
}: ClientBudgetFormProps) {
  const { systemSettings } = useAppContext();
  const [month, setMonth] = useState(format(startOfMonth(initialMonth), 'yyyy-MM'));
  const [hoursBudget, setHoursBudget] = useState(existingBudget?.hours_budget?.toString() || '0');
  const [costBudget, setCostBudget] = useState(existingBudget?.cost_budget?.toString() || '0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    if (existingBudget) {
      setMonth(existingBudget.month);
      setHoursBudget(existingBudget.hours_budget.toString());
      setCostBudget(existingBudget.cost_budget.toString());
    } else {
      setMonth(format(startOfMonth(initialMonth), 'yyyy-MM'));
    }
  }, [existingBudget, initialMonth]);

  const handlePreviousMonth = () => {
    const currentDate = new Date(`${month}-01`);
    setMonth(format(subMonths(currentDate, 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const currentDate = new Date(`${month}-01`);
    setMonth(format(addMonths(currentDate, 1), 'yyyy-MM'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const hours = parseFloat(hoursBudget);
      const cost = parseFloat(costBudget);

      if (isNaN(hours) || isNaN(cost)) {
        throw new Error('Hours and cost must be valid numbers');
      }

      if (hours < 0 || cost < 0) {
        throw new Error('Hours and cost cannot be negative');
      }

      const budgetData = {
        client_id: clientId,
        month,
        hours_budget: hours,
        cost_budget: cost
      };

      if (existingBudget) {
        // Update existing budget
        const { error: updateError } = await supabase
          .from('client_budgets')
          .update(budgetData)
          .eq('id', existingBudget.id);

        if (updateError) throw updateError;
      } else {
        // Create new budget
        const { error: insertError } = await supabase
          .from('client_budgets')
          .insert([budgetData])
          .select();

        if (insertError) throw insertError;
      }

      onSave();
    } catch (err) {
      console.error('Error saving budget:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {existingBudget ? 'Edit Budget' : 'Set Monthly Budget'}
      </h3>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Month</label>
          <div className="mt-1 flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePreviousMonth}
              className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              &larr;
            </button>
            <div className="flex-1 text-center font-medium">
              {formatMonth(month)}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              &rarr;
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="hours_budget" className="block text-sm font-medium text-gray-700">
            Hours Budget
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="number"
              id="hours_budget"
              min="0"
              step="0.5"
              value={hoursBudget}
              onChange={(e) => setHoursBudget(e.target.value)}
              className="block w-full pl-10 pr-12 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">hours</span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="cost_budget" className="block text-sm font-medium text-gray-700">
            Cost Budget
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="number"
              id="cost_budget"
              min="0"
              step="0.01"
              value={costBudget}
              onChange={(e) => setCostBudget(e.target.value)}
              className="block w-full pl-10 pr-12 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">USD</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            <X className="h-4 w-4 inline-block mr-1" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 inline-block mr-1" />
                Save Budget
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
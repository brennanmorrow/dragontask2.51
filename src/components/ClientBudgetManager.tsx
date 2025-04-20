import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClientBudget } from '../lib/types';
import { ClientBudgetForm } from './ClientBudgetForm';
import { Plus, Pencil, Calendar, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAppContext } from '../lib/AppContext';

interface ClientBudgetManagerProps {
  clientId: string;
}

export function ClientBudgetManager({ clientId }: ClientBudgetManagerProps) {
  const { systemSettings } = useAppContext();
  const [budgets, setBudgets] = useState<ClientBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ClientBudget | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchBudgets();
  }, [clientId]);

  const fetchBudgets = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('client_budgets')
        .select('*')
        .eq('client_id', clientId)
        .order('month', { ascending: false });

      if (fetchError) throw fetchError;
      setBudgets(data || []);
    } catch (err) {
      console.error('Error fetching budgets:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    fetchBudgets();
    setIsCreating(false);
    setEditingBudget(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingBudget(null);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (isCreating || editingBudget) {
    return (
      <ClientBudgetForm
        clientId={clientId}
        onSave={handleSave}
        onCancel={handleCancel}
        existingBudget={editingBudget || undefined}
        initialMonth={editingBudget ? new Date(`${editingBudget.month}-01`) : new Date()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Monthly Budgets</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No budgets set</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a monthly budget for this client.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add First Budget
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours Budget
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost Budget
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {budgets.map((budget) => (
                <tr key={budget.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatMonth(budget.month)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-gray-400" />
                      {budget.hours_budget.toFixed(1)}h
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                      ${budget.cost_budget.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(budget.updated_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingBudget(budget)}
                      className="text-blue-600 hover:text-blue-900"
                      style={{ color: primaryColor }}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
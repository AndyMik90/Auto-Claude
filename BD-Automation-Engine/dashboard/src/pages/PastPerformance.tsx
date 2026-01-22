/**
 * Past Performance Dashboard
 * Shows historical performance data from Bullhorn ETL
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  TrendingUp,
  DollarSign,
  Building2,
  Users,
  Calendar,
  Shield,
  ChevronUp,
  ChevronDown,
  Search,
} from 'lucide-react';
import type { PastPerformance as PastPerformanceType } from '../types';

interface PastPerformanceProps {
  loading?: boolean;
}

type SortField = 'prime_contractor' | 'total_placements' | 'avg_bill_rate' | 'avg_margin' | 'estimated_annual_revenue';
type SortDirection = 'asc' | 'desc';

export function PastPerformance({ loading = false }: PastPerformanceProps) {
  const [data, setData] = useState<PastPerformanceType[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('estimated_annual_revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterDefenseOnly, setFilterDefenseOnly] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/past_performance.json');
        if (!response.ok) throw new Error('Failed to load past performance data');
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.prime_contractor.toLowerCase().includes(term)
      );
    }

    // Filter by defense primes only
    if (filterDefenseOnly) {
      result = result.filter(item => item.is_defense_prime);
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortField, sortDirection, filterDefenseOnly]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="h-4 w-4" /> :
      <ChevronDown className="h-4 w-4" />;
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const defensePrimes = data.filter(d => d.is_defense_prime);
    return {
      totalPrimes: data.length,
      defensePrimes: defensePrimes.length,
      totalPlacements: data.reduce((sum, d) => sum + d.total_placements, 0),
      totalRevenue: data.reduce((sum, d) => sum + d.estimated_annual_revenue, 0),
      avgMargin: data.length > 0 ?
        data.reduce((sum, d) => sum + (d.avg_margin || 0), 0) / data.length : 0,
    };
  }, [data]);

  const getRelationshipColor = (strength: string) => {
    switch (strength) {
      case 'Strategic': return 'bg-purple-100 text-purple-800';
      case 'Key Account': return 'bg-blue-100 text-blue-800';
      case 'Established': return 'bg-green-100 text-green-800';
      case 'Growing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (loading || dataLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Error loading past performance data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" />
            Past Performance
          </h1>
          <p className="text-slate-500 mt-1">
            Historical performance metrics from Bullhorn CRM data
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Primes</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.totalPrimes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Defense Primes</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.defensePrimes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Placements</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.totalPlacements.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Est. Revenue</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(summaryStats.totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Margin</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.avgMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search prime contractors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterDefenseOnly}
              onChange={(e) => setFilterDefenseOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Defense Primes Only</span>
          </label>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('prime_contractor')}
                >
                  <div className="flex items-center gap-1">
                    Prime Contractor
                    <SortIcon field="prime_contractor" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('total_placements')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Placements
                    <SortIcon field="total_placements" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('avg_bill_rate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Avg Bill Rate
                    <SortIcon field="avg_bill_rate" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('avg_margin')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Avg Margin
                    <SortIcon field="avg_margin" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('estimated_annual_revenue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Est. Revenue
                    <SortIcon field="estimated_annual_revenue" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">
                  Relationship
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">
                  Date Range
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.is_defense_prime && (
                        <Shield className="h-4 w-4 text-purple-500" />
                      )}
                      <span className="font-medium text-slate-800">{item.prime_contractor}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.total_placements.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    ${item.avg_bill_rate?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${item.avg_margin >= 30 ? 'text-green-600' : item.avg_margin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {item.avg_margin?.toFixed(1) || '0.0'}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(item.estimated_annual_revenue)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRelationshipColor(item.relationship_strength)}`}>
                      {item.relationship_strength}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-500">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.first_job_date?.substring(0, 4) || '?'} - {item.last_job_date?.substring(0, 4) || 'Present'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedData.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No past performance data found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}

export default PastPerformance;

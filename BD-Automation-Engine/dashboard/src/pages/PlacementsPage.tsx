/**
 * Placements Dashboard
 * Shows all placements from Bullhorn with filtering and analytics
 */

import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  DollarSign,
  User,
  Building2,
  Calendar,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { Placement } from '../types';

interface PlacementsPageProps {
  loading?: boolean;
}

type SortField = 'prime_contractor' | 'job_title' | 'candidate' | 'start_date' | 'bill_rate' | 'margin_percent';
type SortDirection = 'asc' | 'desc';

export function PlacementsPage({ loading = false }: PlacementsPageProps) {
  const [data, setData] = useState<Placement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('start_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterPrime, setFilterPrime] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/placements.json');
        if (!response.ok) throw new Error('Failed to load placements data');
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

  // Get unique primes and statuses for filters
  const uniquePrimes = useMemo(() => {
    const primes = new Set(data.map(p => p.prime_contractor).filter(Boolean));
    return Array.from(primes).sort();
  }, [data]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(data.map(p => p.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        (item.prime_contractor || '').toLowerCase().includes(term) ||
        (item.job_title || '').toLowerCase().includes(term) ||
        (item.candidate || '').toLowerCase().includes(term)
      );
    }

    // Filter by prime
    if (filterPrime) {
      result = result.filter(item => item.prime_contractor === filterPrime);
    }

    // Filter by status
    if (filterStatus) {
      result = result.filter(item => item.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null = a[sortField];
      let bVal: string | number | null = b[sortField];

      // Handle nulls
      if (aVal === null) aVal = sortDirection === 'asc' ? '' : '';
      if (bVal === null) bVal = sortDirection === 'asc' ? '' : '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortField, sortDirection, filterPrime, filterStatus]);

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
    const validBillRates = data.filter(p => p.bill_rate && p.bill_rate > 0 && p.bill_rate < 500);
    const validMargins = data.filter(p => p.margin_percent && p.margin_percent > 0);

    return {
      totalPlacements: data.length,
      uniquePrimes: new Set(data.map(p => p.prime_contractor).filter(Boolean)).size,
      avgBillRate: validBillRates.length > 0 ?
        validBillRates.reduce((sum, p) => sum + p.bill_rate, 0) / validBillRates.length : 0,
      avgMargin: validMargins.length > 0 ?
        validMargins.reduce((sum, p) => sum + p.margin_percent, 0) / validMargins.length : 0,
      totalRevenue: validBillRates.reduce((sum, p) => sum + (p.bill_rate * 2080), 0),
    };
  }, [data]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-green-600';
    if (margin >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('active') || s.includes('approved')) return 'bg-green-100 text-green-800';
    if (s.includes('pending') || s.includes('submitted')) return 'bg-yellow-100 text-yellow-800';
    if (s.includes('terminated') || s.includes('cancelled')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
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
          Error loading placements data: {error}
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
            <FileSpreadsheet className="h-7 w-7 text-indigo-500" />
            Placements
          </h1>
          <p className="text-slate-500 mt-1">
            {data.length.toLocaleString()} placements from Bullhorn CRM
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Placements</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.totalPlacements.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Prime Contractors</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.uniquePrimes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Bill Rate</p>
              <p className="text-xl font-bold text-slate-800">${summaryStats.avgBillRate.toFixed(2)}/hr</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Margin</p>
              <p className="text-xl font-bold text-slate-800">{summaryStats.avgMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Est. Revenue</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(summaryStats.totalRevenue)}</p>
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
              placeholder="Search by contractor, job title, or candidate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterPrime}
              onChange={(e) => setFilterPrime(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Primes</option>
              {uniquePrimes.map(prime => (
                <option key={prime} value={prime}>{prime}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
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
                    <Building2 className="h-4 w-4" />
                    Prime Contractor
                    <SortIcon field="prime_contractor" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('job_title')}
                >
                  <div className="flex items-center gap-1">
                    Job Title
                    <SortIcon field="job_title" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('candidate')}
                >
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Candidate
                    <SortIcon field="candidate" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">
                  Status
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('bill_rate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Bill Rate
                    <SortIcon field="bill_rate" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
                  Pay Rate
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('margin_percent')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Margin
                    <SortIcon field="margin_percent" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('start_date')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Start Date
                    <SortIcon field="start_date" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedData.slice(0, 100).map((item, idx) => (
                <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{item.prime_contractor || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.job_title}>
                    {item.job_title || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.candidate || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.status && (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {item.bill_rate > 0 ? `$${item.bill_rate.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.pay_rate > 0 ? `$${item.pay_rate.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.margin_percent > 0 ? (
                      <span className={`flex items-center justify-end gap-1 font-medium ${getMarginColor(item.margin_percent)}`}>
                        {item.margin_percent >= 25 ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {item.margin_percent.toFixed(1)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-500">
                    {item.start_date || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedData.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No placements found matching your filters.
          </div>
        )}

        {filteredAndSortedData.length > 100 && (
          <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-500">
            Showing 100 of {filteredAndSortedData.length.toLocaleString()} placements
          </div>
        )}
      </div>
    </div>
  );
}

export default PlacementsPage;

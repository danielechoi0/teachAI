import React, { useState, useEffect } from 'react';
import { supabase } from "../utils/supabaseClient";
import {
  History,
  Phone,
  Clock,
  User,
  FileText,
  Download,
  Play,
  ChevronDown,
  ChevronRight,
  Calendar,
  Search,
  Filter,
  Eye,
  EyeOff,
  CheckCircle,
  Circle,
  Bell,
  BellOff,
  AlertCircle
} from 'lucide-react';

const CallHistoryPage = ({ user, showStatus, BACKEND_URL }) => {
  const [callHistory, setCallHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState(new Set(['unviewed']));
  const [selectedCall, setSelectedCall] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewedFilter, setViewedFilter] = useState('all');
  const [updatingViewed, setUpdatingViewed] = useState(new Set());
  const [groupingMode, setGroupingMode] = useState('viewed');

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);

      const { data: sessionData, error } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.warn("No access token available");
        showStatus("Not authenticated. Please log in again.", "error");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/teacher-calls`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const callRows = await response.json();

      const processedCalls = callRows.map(call => ({
        id: call.id,
        userName: call.student_name || 'Anonymous Student',
        assistantName: call.assistant?.assistant_name || 'Unknown Assistant',
        summary: call.summary || 'No summary available',
        transcript: call.transcript || 'No transcript available',
        duration: formatSecondsToMMSS(call.duration_sec || 0),
        recordingUrl: call.recording_url,
        startTime: call.started_at,
        endTime: call.started_at,
        viewed: call.viewed || false
      }));

      const groupedCalls = groupCalls(processedCalls, groupingMode);
      setCallHistory(groupedCalls);
    } catch (error) {
      console.error('Error fetching call history:', error);
      showStatus('Failed to load call history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const groupCalls = (calls, mode) => {
    const grouped = {};
    
    if (mode === 'viewed') {
      const unviewedCalls = calls.filter(call => !call.viewed);
      const viewedCalls = calls.filter(call => call.viewed);
      
      if (unviewedCalls.length > 0) {
        grouped['Unviewed Calls'] = unviewedCalls;
      }
      if (viewedCalls.length > 0) {
        grouped['Viewed Calls'] = viewedCalls;
      }
    } else {
      calls.forEach(call => {
        const assistantName = call.assistantName;
        if (!grouped[assistantName]) {
          grouped[assistantName] = [];
        }
        grouped[assistantName].push(call);
      });
    }
    
    return grouped;
  };

  const handleGroupingModeChange = (newMode) => {
    setGroupingMode(newMode);
    const allCalls = Object.values(callHistory).flat();
    const regroupedCalls = groupCalls(allCalls, newMode);
    setCallHistory(regroupedCalls);
    
    if (newMode === 'viewed') {
      setExpandedSections(new Set(['Unviewed Calls']));
    } else {
      setExpandedSections(new Set());
    }
  };

  const markCallViewed = async (callId, viewed = true) => {
    try {
      setUpdatingViewed(prev => new Set([...prev, callId]));

      const { data: sessionData, error } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showStatus("Not authenticated. Please log in again.", "error");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/mark-call-viewed/${callId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ viewed })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setCallHistory(prevHistory => {
        // Get all calls and update the specific one
        const allCalls = Object.values(prevHistory).flat();
        const updatedCalls = allCalls.map(call => 
          call.id === callId ? { ...call, viewed } : call
        );
        
        return groupCalls(updatedCalls, groupingMode);
      });

      // Update selected call if it's currently open
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall(prev => ({ ...prev, viewed }));
      }

      showStatus(viewed ? 'Call marked as viewed' : 'Call marked as unviewed', 'success');
    } catch (error) {
      console.error('Error updating call viewed status:', error);
      showStatus('Failed to update call status', 'error');
    } finally {
      setUpdatingViewed(prev => {
        const newSet = new Set(prev);
        newSet.delete(callId);
        return newSet;
      });
    }
  };

  const markAllCallsInGroupViewed = async (groupName, viewed = true) => {
    const calls = callHistory[groupName] || [];
    const callsToUpdate = calls.filter(call => call.viewed !== viewed);
    
    if (callsToUpdate.length === 0) return;

    try {
      // Add all calls being updated to the updating set
      setUpdatingViewed(prev => new Set([...prev, ...callsToUpdate.map(call => call.id)]));

      const { data: sessionData, error } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showStatus("Not authenticated. Please log in again.", "error");
        return;
      }

      // Update all calls in parallel
      const updatePromises = callsToUpdate.map(call => 
        fetch(`${BACKEND_URL}/mark-call-viewed/${call.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ viewed })
        })
      );

      const responses = await Promise.all(updatePromises);
      
      // Check if all requests succeeded
      const allSuccessful = responses.every(response => response.ok);
      
      if (!allSuccessful) {
        throw new Error('Some calls failed to update');
      }

      // Update local state
      setCallHistory(prevHistory => {
        const allCalls = Object.values(prevHistory).flat();
        const updatedCalls = allCalls.map(call => 
          callsToUpdate.some(updateCall => updateCall.id === call.id) 
            ? { ...call, viewed } 
            : call
        );
        
        return groupCalls(updatedCalls, groupingMode);
      });

      showStatus(
        `${callsToUpdate.length} calls marked as ${viewed ? 'viewed' : 'unviewed'}`, 
        'success'
      );
    } catch (error) {
      console.error('Error updating multiple calls:', error);
      showStatus('Failed to update some calls', 'error');
    } finally {
      // Remove all calls from updating set
      setUpdatingViewed(prev => {
        const newSet = new Set(prev);
        callsToUpdate.forEach(call => newSet.delete(call.id));
        return newSet;
      });
    }
  };

  const formatSecondsToMMSS = (seconds) => {
    if (!seconds || seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleSectionExpansion = (sectionName) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (duration) => {
    return duration;
  };

  const getTotalCallsCount = () => {
    return Object.values(callHistory).reduce((total, calls) => total + calls.length, 0);
  };

  const getUnviewedCallsCount = () => {
    return Object.values(callHistory).reduce((total, calls) => 
      total + calls.filter(call => !call.viewed).length, 0
    );
  };

  const getTotalDuration = () => {
    let totalSeconds = 0;
    Object.values(callHistory).forEach(calls => {
      calls.forEach(call => {
        const durationParts = call.duration.split(':');
        if (durationParts.length === 2) {
          const [minutes, seconds] = durationParts.map(Number);
          totalSeconds += minutes * 60 + seconds;
        }
      });
    });
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const filteredCallHistory = () => {
    if (!searchTerm && dateFilter === 'all' && viewedFilter === 'all') return callHistory;
    
    const filtered = {};
    Object.entries(callHistory).forEach(([groupName, calls]) => {
      const filteredCalls = calls.filter(call => {
        const matchesSearch = !searchTerm || 
          call.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          call.assistantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          call.summary.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesDate = dateFilter === 'all' || (() => {
          const callDate = new Date(call.startTime);
          const now = new Date();
          const daysDiff = (now - callDate) / (1000 * 60 * 60 * 24);
          
          switch (dateFilter) {
            case 'today': return daysDiff < 1;
            case 'week': return daysDiff < 7;
            case 'month': return daysDiff < 30;
            default: return true;
          }
        })();

        const matchesViewed = viewedFilter === 'all' || 
          (viewedFilter === 'viewed' && call.viewed) ||
          (viewedFilter === 'unviewed' && !call.viewed);
        
        return matchesSearch && matchesDate && matchesViewed;
      });
      
      if (filteredCalls.length > 0) {
        filtered[groupName] = filteredCalls;
      }
    });
    
    return filtered;
  };

  const getGroupIcon = (groupName) => {
    if (groupingMode === 'viewed') {
      return groupName === 'Unviewed Calls' ? <AlertCircle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
    return <User className="w-5 h-5 text-zinc-400" />;
  };

  const getGroupColor = (groupName) => {
    if (groupingMode === 'viewed') {
      return groupName === 'Unviewed Calls' ? 'text-red-400' : 'text-emerald-400';
    }
    return 'text-zinc-400';
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <History className="w-12 h-12 animate-pulse text-zinc-400 mx-auto mb-4" />
              <p className="text-zinc-400">Loading call history...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filtered = filteredCallHistory();

  return (
    <div className="flex-1 p-6 bg-zinc-900/95 backdrop-blur-xl rounded-2xl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-zinc-200 mb-2">Call History</h2>
            <p className="text-zinc-400">View and manage all previous student conversations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-zinc-700 px-4 py-2 rounded-full text-sm font-semibold text-zinc-200">
              {getTotalCallsCount()} Total Calls • {getTotalDuration()} Total Time
            </div>
            {getUnviewedCallsCount() > 0 && (
              <div className="bg-red-100 px-4 py-2 rounded-full text-sm font-semibold text-red-700">
                {getUnviewedCallsCount()} Unviewed
              </div>
            )}
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <History className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Grouping Toggle and Filters */}
        <div className="bg-zinc-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-zinc-700">
            <span className="text-sm font-medium text-zinc-400">Group by:</span>
            <div className="flex bg-zinc-700 rounded-lg p-1">
              <button
                onClick={() => handleGroupingModeChange('viewed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  groupingMode === 'viewed'
                    ? 'bg-zinc-600 text-zinc-200 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-2" />
                Viewed Status
              </button>
              <button
                onClick={() => handleGroupingModeChange('assistant')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  groupingMode === 'assistant'
                    ? 'bg-zinc-600 text-zinc-200 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Assistant
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by student name, assistant, or summary..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-zinc-200 placeholder-zinc-400"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-zinc-200"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="sm:w-48">
              <select
                value={viewedFilter}
                onChange={(e) => setViewedFilter(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-zinc-200"
              >
                <option value="all">All Calls</option>
                <option value="viewed">Viewed Only</option>
                <option value="unviewed">Unviewed Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Call History Groups */}
        {Object.keys(filtered).length === 0 ? (
          <div className="bg-zinc-800 rounded-2xl shadow-lg p-12 text-center">
            <History className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-400 mb-2">No calls found</h3>
            <p className="text-zinc-500">
              {searchTerm || dateFilter !== 'all' || viewedFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Call history will appear here once students start using your assistants'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(filtered).map(([groupName, calls]) => (
              <div key={groupName} className="bg-zinc-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between hover:bg-zinc-700 transition-colors">
                  <button
                    onClick={() => toggleSectionExpansion(groupName)}
                    className="flex items-center gap-3 flex-1"
                  >
                    {expandedSections.has(groupName) ? (
                      <ChevronDown className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    )}
                    <div className={`${getGroupColor(groupName)}`}>
                      {getGroupIcon(groupName)}
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-semibold text-zinc-200">{groupName}</h3>
                      <p className="text-sm text-zinc-400">
                        {calls.length} calls
                        {groupingMode === 'assistant' && calls.filter(call => !call.viewed).length > 0 && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            {calls.filter(call => !call.viewed).length} unviewed
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {/* Bulk actions for groups */}
                    {groupingMode === 'viewed' ? (
                      <button
                        onClick={() => markAllCallsInGroupViewed(
                          groupName, 
                          groupName === 'Unviewed Calls' ? true : false
                        )}
                        disabled={calls.some(call => updatingViewed.has(call.id))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          groupName === 'Unviewed Calls' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                        } ${calls.some(call => updatingViewed.has(call.id)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {groupName === 'Unviewed Calls' ? 'Mark All Viewed' : 'Mark All Unviewed'}
                      </button>
                    ) : calls.filter(call => !call.viewed).length > 0 && (
                      <button
                        onClick={() => markAllCallsInGroupViewed(groupName, true)}
                        disabled={calls.some(call => updatingViewed.has(call.id))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors ${
                          calls.some(call => updatingViewed.has(call.id)) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Mark All Viewed
                      </button>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Phone className="w-4 h-4" />
                      <span>{calls.length}</span>
                    </div>
                  </div>
                </div>

                {expandedSections.has(groupName) && (
                  <div className="border-t border-zinc-700">
                    {calls.map((call) => (
                      <div key={call.id} className={`border-b border-zinc-600 last:border-b-0 ${!call.viewed ? 'bg-zinc-700' : 'bg-zinc-800'}`}>
                        <div className="p-6 hover:bg-zinc-700 transition-colors">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <User className="w-5 h-5 text-zinc-400" />
                                <h4 className="text-lg font-semibold text-zinc-200">{call.userName}</h4>
                                {groupingMode === 'viewed' && (
                                  <span className="text-sm text-zinc-500">• {call.assistantName}</span>
                                )}
                                <div className="flex items-center gap-1 text-sm text-zinc-500">
                                  <Calendar className="w-4 h-4" />
                                  <span>{formatDate(call.startTime)}</span>
                                </div>
                                {!call.viewed && (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="text-zinc-500 mb-3">{call.summary}</p>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <div className="flex items-center gap-1 text-sm text-zinc-500">
                                <Clock className="w-4 h-4" />
                                <span>{formatDuration(call.duration)}</span>
                              </div>
                              <button
                                onClick={() => markCallViewed(call.id, !call.viewed)}
                                disabled={updatingViewed.has(call.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  call.viewed 
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                    : 'bg-zinc-700 text-zinc-500 hover:bg-zinc-600'
                                } ${updatingViewed.has(call.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={call.viewed ? 'Mark as unviewed' : 'Mark as viewed'}
                              >
                                {updatingViewed.has(call.id) ? (
                                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : call.viewed ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => {
                                setSelectedCall(call);
                                if (!call.viewed) {
                                  markCallViewed(call.id, true);
                                }
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-zinc-600 text-zinc-200 rounded-lg hover:bg-zinc-500 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              View Transcript
                            </button>
                            {call.recordingUrl && (
                              <button
                                onClick={() => {
                                  window.open(call.recordingUrl, '_blank');
                                  if (!call.viewed) {
                                    markCallViewed(call.id, true);
                                  }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                              >
                                <Play className="w-4 h-4" />
                                Play Recording
                              </button>
                            )}
                            {call.recordingUrl && (
                              <a
                                href={call.recordingUrl}
                                download
                                onClick={() => {
                                  if (!call.viewed) {
                                    markCallViewed(call.id, true);
                                  }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-600 text-zinc-200 rounded-lg hover:bg-zinc-500 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div
            className="absolute left-1/2 max-w-6xl w-full px-4"
            style={{
              top: `${window.scrollY + window.innerHeight / 2}px`,
              transform: 'translateX(-50%) translateY(-50%)'
            }}
          >
            <div className="bg-zinc-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-zinc-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-zinc-200">Call Transcript</h3>
                      {!selectedCall.viewed && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500">{selectedCall.userName} • {selectedCall.assistantName} • {formatDate(selectedCall.startTime)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => markCallViewed(selectedCall.id, !selectedCall.viewed)}
                      disabled={updatingViewed.has(selectedCall.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        selectedCall.viewed 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                          : 'bg-zinc-700 text-zinc-500 hover:bg-zinc-600'
                      } ${updatingViewed.has(selectedCall.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={selectedCall.viewed ? 'Mark as unviewed' : 'Mark as viewed'}
                    >
                      {updatingViewed.has(selectedCall.id) ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : selectedCall.viewed ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      <span className="text-sm">{selectedCall.viewed ? 'Viewed' : 'Mark as Viewed'}</span>
                    </button>
                    <button
                      onClick={() => setSelectedCall(null)}
                      className="text-zinc-400 hover:text-zinc-200 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="bg-zinc-700 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-zinc-200 mb-2">Summary</h4>
                  <p className="text-zinc-500">{selectedCall.summary}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-200 mb-3">Full Transcript</h4>
                  <div className="space-y-3">
                    {selectedCall.transcript && selectedCall.transcript !== 'No transcript available' ? (
                      selectedCall.transcript.split('\n').filter(line => line.trim()).map((line, index) => (
                        <div key={index} className="flex gap-3">
                          <div className={`px-3 py-2 rounded-lg max-w-[80%] ${
                            line.toLowerCase().includes('student') || line.toLowerCase().includes('user')
                              ? 'bg-zinc-600 text-zinc-200 ml-auto' 
                              : 'bg-zinc-700 text-zinc-500'
                          }`}>
                            <p className="text-sm font-medium mb-1">
                              {line.toLowerCase().includes('student') || line.toLowerCase().includes('user') ? 'Student' : 'Assistant'}
                            </p>
                            <p>{line.replace(/^(Student:|Assistant:|User:)\s*/i, '')}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-zinc-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                        <p>No transcript available for this call</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-zinc-700 bg-zinc-700">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-zinc-500">
                    Duration: {formatDuration(selectedCall.duration)}
                  </div>
                  <div className="flex gap-3">
                    {selectedCall.recordingUrl && (
                      <>
                        <button
                          onClick={() => window.open(selectedCall.recordingUrl, '_blank')}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Play Recording
                        </button>
                        <a
                          href={selectedCall.recordingUrl}
                          download
                          className="flex items-center gap-2 px-4 py-2 bg-zinc-600 text-zinc-200 rounded-lg hover:bg-zinc-500 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallHistoryPage;
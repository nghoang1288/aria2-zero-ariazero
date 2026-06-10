import { useState } from 'react';
import { 
  ArrowDown, 
  ArrowUp, 
  Clock, 
  CheckCircle, 
  Trash2, 
  Play, 
  Pause, 
  Plus, 
  Search, 
  Server, 
  Settings, 
  Folder, 
  Activity, 
  Check, 
  AlertCircle,
  X
} from 'lucide-react';
import { 
  useAria2, 
  getTaskName, 
  formatSpeed, 
  formatBytes, 
  formatETA 
} from './useAria2';
import type { Aria2Task } from './useAria2';

function App() {
  const {
    status,
    globalStat,
    activeTasks,
    waitingTasks,
    stoppedTasks,
    addUri,
    pauseTask,
    resumeTask,
    removeTask,
    clearStopped
  } = useAria2();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'downloads' | 'settings'>('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUris, setNewUris] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUris.trim()) return;
    
    // Support adding multiple links separated by newlines
    const uris = newUris.split('\n').map(u => u.trim()).filter(u => u);
    uris.forEach(uri => addUri(uri));
    
    setNewUris('');
    setShowAddModal(false);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
            Connecting...
          </span>
        );
      case 'disconnected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            Disconnected
          </span>
        );
    }
  };

  const filteredTasks = (tasks: Aria2Task[]) => {
    if (!searchQuery) return tasks;
    return tasks.filter(t => getTaskName(t).toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const allActiveAndWaiting = [...activeTasks, ...waitingTasks];
  const displayDownloads = filteredTasks(allActiveAndWaiting);
  const displayStopped = filteredTasks(stoppedTasks);

  return (
    <div className="flex h-screen bg-[#0e111b] text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#151926] border-r border-[#1e293b] flex flex-col">
        <div className="p-6 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-cyan-500/15 p-1.5 rounded-lg border border-cyan-500/30">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              AriaZero
            </span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-cyan-500/8 text-cyan-400 border-l-2 border-cyan-400' 
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border-l-2 border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('downloads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'downloads' 
                ? 'bg-cyan-500/8 text-cyan-400 border-l-2 border-cyan-400' 
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border-l-2 border-transparent'
            }`}
          >
            <ArrowDown className="w-4 h-4" />
            Downloads
            {allActiveAndWaiting.length > 0 && (
              <span className="ml-auto bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 text-xs px-2 py-0.5 rounded-full">
                {allActiveAndWaiting.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'settings' 
                ? 'bg-cyan-500/8 text-cyan-400 border-l-2 border-cyan-400' 
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border-l-2 border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0e111b]/30">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Samba Share</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono break-all bg-slate-950/40 p-2 rounded border border-[#1e293b]">
            \\192.168.50.226\downloads
            <div className="mt-1 text-[9px] text-slate-600">User: admin | Pass: 123456</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-[#151926] border-b border-[#1e293b] flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-medium text-slate-200 capitalize">{activeTab}</h1>
            {getStatusBadge()}
          </div>
          
          {/* Action Buttons & Search */}
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Search downloads..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0e111b] border border-[#1e293b] rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Download
            </button>
          </div>
        </header>

        {/* Page Container */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {activeTab === 'dashboard' && (
            <>
              {/* Stat Grid */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-[#151926] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block mb-1">Active Downloads</span>
                    <span className="text-2xl font-bold text-slate-200">{globalStat.numActive}</span>
                  </div>
                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-lg text-cyan-400">
                    <ArrowDown className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#151926] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block mb-1">Completed Files</span>
                    <span className="text-2xl font-bold text-slate-200">{globalStat.numStopped}</span>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#151926] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block mb-1">Queue / Paused</span>
                    <span className="text-2xl font-bold text-slate-200">{globalStat.numWaiting}</span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Downloads list inside Dashboard */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">Active Downloads</h2>
                </div>
                {displayDownloads.length === 0 ? (
                  <div className="bg-[#151926] border border-[#1e293b] border-dashed rounded-xl p-10 text-center text-slate-500 text-xs">
                    No active or waiting download tasks.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayDownloads.map((task) => (
                      <TaskCard key={task.gid} task={task} onPause={pauseTask} onResume={resumeTask} onRemove={removeTask} />
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Completions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                  <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">Recent Completions</h2>
                  {displayStopped.length > 0 && (
                    <button 
                      onClick={clearStopped}
                      className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1 transition-colors"
                    >
                      Clear stopped tasks
                    </button>
                  )}
                </div>
                {displayStopped.length === 0 ? (
                  <div className="bg-[#151926] border border-[#1e293b] border-dashed rounded-xl p-10 text-center text-slate-500 text-xs">
                    No completed or stopped tasks in history.
                  </div>
                ) : (
                  <div className="bg-[#151926] border border-[#1e293b] rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1e293b] bg-slate-950/20 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="py-3 px-5">File Name</th>
                          <th className="py-3 px-5 w-32">File Size</th>
                          <th className="py-3 px-5 w-32">Status</th>
                          <th className="py-3 px-5 w-24 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayStopped.map((task) => {
                          const isError = task.status === 'error';
                          return (
                            <tr key={task.gid} className="border-b border-[#1e293b] hover:bg-slate-900/10 text-xs text-slate-300">
                              <td className="py-3 px-5 font-medium max-w-md truncate" title={getTaskName(task)}>
                                {getTaskName(task)}
                              </td>
                              <td className="py-3 px-5 text-slate-400">{formatBytes(task.totalLength)}</td>
                              <td className="py-3 px-5">
                                {isError ? (
                                  <span className="text-rose-400 flex items-center gap-1.5 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Error
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                                    <Check className="w-3.5 h-3.5" />
                                    Completed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-5 text-right">
                                <button 
                                  onClick={() => removeTask(task.gid, task.status)}
                                  className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors"
                                  title="Delete task from history"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'downloads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">Downloads List</h2>
              </div>
              {displayDownloads.length === 0 ? (
                <div className="bg-[#151926] border border-[#1e293b] border-dashed rounded-xl p-10 text-center text-slate-500 text-xs">
                  No active or waiting download tasks.
                </div>
              ) : (
                <div className="space-y-3">
                  {displayDownloads.map((task) => (
                    <TaskCard key={task.gid} task={task} onPause={pauseTask} onResume={resumeTask} onRemove={removeTask} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-[#151926] border border-[#1e293b] rounded-xl p-6 max-w-2xl space-y-6">
              <h2 className="text-md font-semibold text-slate-200 border-b border-[#1e293b] pb-3 flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                Connection Information
              </h2>
              
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Aria2 server host</label>
                  <div className="bg-[#0e111b] border border-[#1e293b] rounded-lg px-4 py-2 text-slate-300 font-mono">
                    {location.hostname}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Aria2 server port</label>
                  <div className="bg-[#0e111b] border border-[#1e293b] rounded-lg px-4 py-2 text-slate-300 font-mono">
                    {location.port || (location.protocol === 'https:' ? '443' : '80')}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Protocol</label>
                  <div className="bg-[#0e111b] border border-[#1e293b] rounded-lg px-4 py-2 text-slate-300 font-mono">
                    {location.protocol === 'https:' ? 'wss' : 'ws'}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">RPC path</label>
                  <div className="bg-[#0e111b] border border-[#1e293b] rounded-lg px-4 py-2 text-slate-300 font-mono">
                    /jsonrpc
                  </div>
                </div>
              </div>

              <div className="border-t border-[#1e293b] pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  Storage & Downloads
                </h3>
                
                <div className="text-xs text-slate-400 space-y-2">
                  <p>All downloads are saved inside the container at: <code className="bg-[#0e111b] text-slate-300 px-1.5 py-0.5 rounded border border-[#1e293b]">/downloads</code></p>
                  <p>This folder is mapped to the host machine and shared via Samba (SMB):</p>
                  <div className="bg-[#0e111b] border border-[#1e293b] p-3 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
                    <div>SMB path: \\192.168.50.226\downloads</div>
                    <div>User: admin</div>
                    <div>Password: 123456</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Global speed indicator at bottom */}
        <footer className="h-12 bg-[#151926] border-t border-[#1e293b] flex items-center justify-between px-8 text-xs text-slate-400">
          <div>
            AriaZero v1.0.0 (Nordic Frost Theme)
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Down: {formatSpeed(globalStat.downloadSpeed)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Up: {formatSpeed(globalStat.uploadSpeed)}</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Modal Add Uri */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151926] border border-[#1e293b] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#1e293b] flex items-center justify-between">
              <h3 className="text-md font-semibold text-slate-200">Start New Download</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddTask}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">URLs to download</label>
                  <textarea 
                    rows={4}
                    placeholder="Paste HTTP/HTTPS/FTP or Magnet links here (one per line)..."
                    value={newUris}
                    onChange={(e) => setNewUris(e.target.value)}
                    className="w-full bg-[#0e111b] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  Tasks will start immediately and save to the shared downloads directory.
                </div>
              </div>

              <div className="px-5 py-4 border-t border-[#1e293b] bg-slate-950/20 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-800/40 transition-colors text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Start Download
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub Component TaskCard
interface TaskCardProps {
  task: Aria2Task;
  onPause: (gid: string) => void;
  onResume: (gid: string) => void;
  onRemove: (gid: string, status: string) => void;
}

function TaskCard({ task, onPause, onResume, onRemove }: TaskCardProps) {
  const isActive = task.status === 'active';
  const isPaused = task.status === 'paused' || task.status === 'waiting';
  const total = Number(task.totalLength);
  const completed = Number(task.completedLength);
  const progressPercent = total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;
  
  const speed = formatSpeed(task.downloadSpeed);
  const eta = formatETA(task.completedLength, task.totalLength, task.downloadSpeed);

  return (
    <div className="bg-[#151926] border border-[#1e293b] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-semibold text-xs text-slate-200 truncate block max-w-lg" title={getTaskName(task)}>
            {getTaskName(task)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {formatBytes(task.totalLength)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-950/40 rounded-full h-1.5 overflow-hidden">
            <div 
              style={{ width: `${progressPercent}%` }} 
              className={`h-full rounded-full transition-all duration-300 ${
                isActive ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-slate-700'
              }`}
            ></div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{progressPercent}%</span>
        </div>
      </div>

      {/* Speed & ETA */}
      <div className="flex items-center gap-6 justify-between md:justify-end">
        {isActive && (
          <div className="flex gap-4 text-xs font-mono">
            <div className="text-cyan-400">
              <span className="text-slate-500 text-[10px] block uppercase font-medium tracking-wide">Speed</span>
              {speed}
            </div>
            <div className="text-slate-300">
              <span className="text-slate-500 text-[10px] block uppercase font-medium tracking-wide">ETA</span>
              {eta}
            </div>
          </div>
        )}
        
        {isPaused && (
          <div className="text-amber-500 text-xs font-mono">
            <span className="text-slate-500 text-[10px] block uppercase font-medium tracking-wide">Status</span>
            Paused
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 border-l border-[#1e293b] pl-4">
          {isActive ? (
            <button 
              onClick={() => onPause(task.gid)}
              className="text-slate-400 hover:text-cyan-400 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
              title="Pause download"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button 
              onClick={() => onResume(task.gid)}
              className="text-slate-400 hover:text-cyan-400 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
              title="Resume download"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button 
            onClick={() => onRemove(task.gid, task.status)}
            className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
            title="Cancel/Delete download"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

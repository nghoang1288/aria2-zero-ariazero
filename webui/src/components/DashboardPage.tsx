import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, Clock, AlertCircle, Trash2, Pause, Play, Check } from 'lucide-react';
import { formatBytes, formatSpeed } from '../useAria2';
import type { Aria2Task } from '../useAria2';
import { 
  isTorrentCompleted, 
  isTaskSeeding, 
  getTaskName, 
  isMetadataTask, 
  filterTaskByCategory 
} from '../utils/taskUtils';
import TaskCard from './TaskCard';

interface DashboardPageProps {
  activeTasks: Aria2Task[];
  waitingTasks: Aria2Task[];
  stoppedTasks: Aria2Task[];
  searchQuery: string;
  selectedCategory: string;
  pauseTask: (gid: string) => void;
  resumeTask: (gid: string) => void;
  handleInitiateRemove: (task: Aria2Task) => void;
  setSelectedGid: (gid: string | null) => void;
  selectedGid: string | null;
  retryTask: (task: Aria2Task) => void;
  setShowClearAllConfirm: (show: boolean) => void;
  setDeleteClearAllFiles: (del: boolean) => void;
  speedHistory?: { down: number[]; up: number[] };
}

export default function DashboardPage({
  activeTasks,
  waitingTasks,
  stoppedTasks,
  searchQuery,
  selectedCategory,
  pauseTask,
  resumeTask,
  handleInitiateRemove,
  setSelectedGid,
  selectedGid,
  retryTask,
  setShowClearAllConfirm,
  setDeleteClearAllFiles,
  speedHistory,
}: DashboardPageProps) {

  const lowercaseQuery = useMemo(() => searchQuery.toLowerCase().trim(), [searchQuery]);

  const allActiveAndWaiting = useMemo(() => [...activeTasks, ...waitingTasks], [activeTasks, waitingTasks]);

  const displayDownloads = useMemo(() => {
    if (!lowercaseQuery) return allActiveAndWaiting;
    return allActiveAndWaiting.filter(t => getTaskName(t).toLowerCase().includes(lowercaseQuery));
  }, [allActiveAndWaiting, lowercaseQuery]);

  const displayStopped = useMemo(() => {
    if (!lowercaseQuery) return stoppedTasks;
    return stoppedTasks.filter(t => getTaskName(t).toLowerCase().includes(lowercaseQuery));
  }, [stoppedTasks, lowercaseQuery]);

  const activeCount = useMemo(() => {
    return allActiveAndWaiting.filter((t: Aria2Task) => t.status === 'active' && !isTorrentCompleted(t) && !isMetadataTask(t)).length;
  }, [allActiveAndWaiting]);

  const completedCount = useMemo(() => {
    const stoppedComplete = stoppedTasks.filter((t: Aria2Task) => t.status === 'complete' && !isMetadataTask(t)).length;
    const activeTorrentComplete = allActiveAndWaiting.filter((t: Aria2Task) => isTorrentCompleted(t) && !isMetadataTask(t)).length;
    return stoppedComplete + activeTorrentComplete;
  }, [stoppedTasks, allActiveAndWaiting]);

  const queuePausedCount = useMemo(() => {
    return allActiveAndWaiting.filter((t: Aria2Task) => (t.status === 'paused' || t.status === 'waiting') && !isTorrentCompleted(t) && !isMetadataTask(t)).length;
  }, [allActiveAndWaiting]);

  const downloads = useMemo(() => {
    return displayDownloads.filter((t: Aria2Task) => !isTorrentCompleted(t) && !isMetadataTask(t));
  }, [displayDownloads]);

  const completedAndStopped = useMemo(() => {
    const stoppedClean = displayStopped.filter((t: Aria2Task) => !isMetadataTask(t));
    const downloadsTorrentComplete = displayDownloads.filter((t: Aria2Task) => isTorrentCompleted(t) && !isMetadataTask(t));
    return [...stoppedClean, ...downloadsTorrentComplete];
  }, [displayStopped, displayDownloads]);

  const filteredDownloads = useMemo(() => {
    return downloads.filter(t => filterTaskByCategory(t, selectedCategory));
  }, [downloads, selectedCategory]);

  const filteredStopped = useMemo(() => {
    return completedAndStopped.filter(t => filterTaskByCategory(t, selectedCategory));
  }, [completedAndStopped, selectedCategory]);

  return (
    <>
      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-card-bg border border-border-main rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-text-dim font-medium block mb-1">Active Downloads</span>
            <span className="text-2xl font-bold text-text-main">{activeCount}</span>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-lg text-cyan-400">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card-bg border border-border-main rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-text-dim font-medium block mb-1">Completed Files</span>
            <span className="text-2xl font-bold text-text-main">{completedCount}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card-bg border border-border-main rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-text-dim font-medium block mb-1">Queue / Paused</span>
            <span className="text-2xl font-bold text-text-main">{queuePausedCount}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Large SVG Speed Chart */}
      <SpeedChart speedHistory={speedHistory} />

      {/* Downloads list inside Dashboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-text-dim">Active Downloads</h2>
        </div>
        {filteredDownloads.length === 0 ? (
          <div className="bg-card-bg border border-border-main border-dashed rounded-xl p-10 text-center text-text-dim text-xs">
            No matching active or waiting download tasks.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDownloads.map((task: Aria2Task) => (
              <TaskCard 
                key={task.gid} 
                task={task} 
                onPause={pauseTask} 
                onResume={resumeTask} 
                onRemove={handleInitiateRemove}
                onSelect={setSelectedGid}
                isSelected={selectedGid === task.gid}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Completions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-main pb-2">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-text-dim">Recent Completions</h2>
          {filteredStopped.length > 0 && (
            <button 
              onClick={() => {
                setShowClearAllConfirm(true);
                setDeleteClearAllFiles(false);
              }}
              className="text-xs text-text-dim hover:text-text-main flex items-center gap-1 transition-colors cursor-pointer"
            >
              Clear stopped tasks
            </button>
          )}
        </div>
        {filteredStopped.length === 0 ? (
          <div className="bg-card-bg border border-border-main border-dashed rounded-xl p-10 text-center text-text-dim text-xs">
            No matching completed or stopped tasks in history.
          </div>
        ) : (
          <div className="bg-card-bg border border-border-main rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[550px] md:min-w-0">
                <thead>
                  <tr className="border-b border-border-main bg-page-bg/40 text-text-dim text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-5">File Name</th>
                    <th className="py-3 px-5 w-32">File Size</th>
                    <th className="py-3 px-5 w-32">Status</th>
                    <th className="py-3 px-5 w-24 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStopped.map((task: Aria2Task) => {
                    const isError = task.status === 'error';
                    const isSeeding = isTaskSeeding(task);
                    return (
                      <tr 
                        key={task.gid} 
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          setSelectedGid(task.gid);
                        }}
                        className={`border-b border-border-main hover:bg-page-bg/25 text-xs text-text-main cursor-pointer transition-colors ${
                          selectedGid === task.gid ? 'bg-cyan-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-5 font-medium max-w-md truncate" title={getTaskName(task)}>
                          {getTaskName(task)}
                        </td>
                        <td className="py-3 px-5 text-text-dim">{formatBytes(task.totalLength)}</td>
                        <td className="py-3 px-5 relative group/status">
                          {isError ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-rose-400 flex items-center gap-1.5 font-medium cursor-help">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Error
                              </span>
                              <button 
                                onClick={() => retryTask(task)}
                                className="px-1.5 py-0.5 text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-md hover:bg-cyan-500 hover:text-white transition-all cursor-pointer font-medium"
                                title="Retry download"
                              >
                                Retry
                              </button>
                              
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/status:block z-50 bg-slate-900 border border-slate-700 text-slate-100 text-[10px] p-2.5 rounded-lg shadow-xl max-w-xs w-64 pointer-events-none break-words font-mono text-left leading-relaxed">
                                <div className="text-rose-400 font-semibold mb-1">Aria2 Error (Code {task.errorCode || 'Unknown'}):</div>
                                <div>{task.errorMessage || 'No detailed error message available.'}</div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                              </div>
                            </div>
                          ) : isSeeding ? (
                            <span className="text-emerald-400 flex items-center gap-1.5 font-medium animate-pulse">
                              <ArrowUp className="w-3.5 h-3.5" />
                              Seeding ({formatSpeed(task.uploadSpeed)})
                            </span>
                          ) : isTorrentCompleted(task) && (task.status === 'paused' || task.status === 'waiting') ? (
                            <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                              <Pause className="w-3.5 h-3.5" />
                              Seeding Paused
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                              <Check className="w-3.5 h-3.5" />
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right flex items-center justify-end gap-1.5">
                          {isTorrentCompleted(task) && task.status !== 'complete' && (
                            task.status === 'active' ? (
                              <button 
                                onClick={() => pauseTask(task.gid)}
                                className="text-text-dim hover:text-cyan-400 p-1.5 rounded transition-colors cursor-pointer"
                                title="Pause Seeding"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => resumeTask(task.gid)}
                                className="text-text-dim hover:text-emerald-400 p-1.5 rounded transition-colors cursor-pointer"
                                title="Resume Seeding"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )
                          )}
                          <button 
                            onClick={() => handleInitiateRemove(task)}
                            className="text-text-dim hover:text-rose-400 p-1.5 rounded transition-colors cursor-pointer"
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
          </div>
        )}
      </div>
    </>
  );
}

function SpeedChart({ speedHistory }: { speedHistory?: { down: number[]; up: number[] } }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  
  const downData = speedHistory?.down || [];
  const upData = speedHistory?.up || [];
  
  const maxVal = Math.max(
    ...downData,
    ...upData,
    102400
  );

  const pointsCount = 60;
  const downPoints = [...Array(Math.max(0, pointsCount - downData.length)).fill(0), ...downData].slice(-pointsCount);
  const upPoints = [...Array(Math.max(0, pointsCount - upData.length)).fill(0), ...upData].slice(-pointsCount);

  const width = 600;
  const height = 180;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getCoords = (index: number, val: number) => {
    const x = paddingLeft + (index / (pointsCount - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    return { x, y };
  };

  let downPath = '';
  let downAreaPath = '';
  let upPath = '';
  let upAreaPath = '';

  if (downPoints.length > 0) {
    const startCoords = getCoords(0, downPoints[0]);
    downPath = `M ${startCoords.x} ${startCoords.y}`;
    downAreaPath = `M ${startCoords.x} ${paddingTop + chartHeight} L ${startCoords.x} ${startCoords.y}`;
    
    for (let i = 1; i < downPoints.length; i++) {
      const c = getCoords(i, downPoints[i]);
      downPath += ` L ${c.x} ${c.y}`;
      downAreaPath += ` L ${c.x} ${c.y}`;
    }
    const endCoords = getCoords(downPoints.length - 1, downPoints[downPoints.length - 1]);
    downAreaPath += ` L ${endCoords.x} ${paddingTop + chartHeight} Z`;
  }

  if (upPoints.length > 0) {
    const startCoords = getCoords(0, upPoints[0]);
    upPath = `M ${startCoords.x} ${startCoords.y}`;
    upAreaPath = `M ${startCoords.x} ${paddingTop + chartHeight} L ${startCoords.x} ${startCoords.y}`;
    
    for (let i = 1; i < upPoints.length; i++) {
      const c = getCoords(i, upPoints[i]);
      upPath += ` L ${c.x} ${c.y}`;
      upAreaPath += ` L ${c.x} ${c.y}`;
    }
    const endCoords = getCoords(upPoints.length - 1, upPoints[upPoints.length - 1]);
    upAreaPath += ` L ${endCoords.x} ${paddingTop + chartHeight} Z`;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const svgX = (x / rect.width) * width;
    
    if (svgX >= paddingLeft && svgX <= width - paddingRight) {
      const index = Math.round(((svgX - paddingLeft) / chartWidth) * (pointsCount - 1));
      if (index >= 0 && index < pointsCount) {
        setHoverIdx(index);
      }
    } else {
      setHoverIdx(null);
    }
  };

  const hoveredDownSpeed = hoverIdx !== null ? downPoints[hoverIdx] : null;
  const hoveredUpSpeed = hoverIdx !== null ? upPoints[hoverIdx] : null;

  return (
    <div className="bg-card-bg border border-border-main rounded-xl p-5 space-y-3 shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">Network Speed (Last 60s)</h3>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="text-text-main">
              Down: {hoveredDownSpeed !== null ? formatSpeed(hoveredDownSpeed) : formatSpeed(downData[downData.length - 1] || 0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-text-main">
              Up: {hoveredUpSpeed !== null ? formatSpeed(hoveredUpSpeed) : formatSpeed(upData[upData.length - 1] || 0)}
            </span>
          </div>
          {hoverIdx !== null && (
            <span className="text-[10px] text-text-dim font-mono bg-slate-800/40 px-1.5 py-0.5 rounded border border-border-main/50">
              {60 - hoverIdx}s ago
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-axis Labels */}
          {yTicks.map((tick, i) => {
            const val = tick * maxVal;
            const y = paddingTop + chartHeight - tick * chartHeight;
            return (
              <g key={i} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#475569"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  className="font-mono text-[9px] font-semibold"
                >
                  {formatSpeed(val)}
                </text>
              </g>
            );
          })}

          {/* X axis labels (60s ago, 30s ago, Now) */}
          <g className="opacity-40">
            <text x={paddingLeft} y={height - 8} textAnchor="start" fill="#94a3b8" className="font-mono text-[9px]">60s ago</text>
            <text x={paddingLeft + chartWidth / 2} y={height - 8} textAnchor="middle" fill="#94a3b8" className="font-mono text-[9px]">30s ago</text>
            <text x={width - paddingRight} y={height - 8} textAnchor="end" fill="#94a3b8" className="font-mono text-[9px]">Now</text>
          </g>

          {/* Paths for Download */}
          {downPath && (
            <>
              <path d={downAreaPath} fill="url(#downGrad)" />
              <path d={downPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Paths for Upload */}
          {upPath && (
            <>
              <path d={upAreaPath} fill="url(#upGrad)" />
              <path d={upPath} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Hover tracker line */}
          {hoverIdx !== null && (
            <g>
              <line
                x1={paddingLeft + (hoverIdx / (pointsCount - 1)) * chartWidth}
                y1={paddingTop}
                x2={paddingLeft + (hoverIdx / (pointsCount - 1)) * chartWidth}
                y2={paddingTop + chartHeight}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {/* Down point indicator */}
              <circle
                cx={paddingLeft + (hoverIdx / (pointsCount - 1)) * chartWidth}
                cy={paddingTop + chartHeight - (downPoints[hoverIdx] / maxVal) * chartHeight}
                r="3.5"
                fill="#22d3ee"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {/* Up point indicator */}
              <circle
                cx={paddingLeft + (hoverIdx / (pointsCount - 1)) * chartWidth}
                cy={paddingTop + chartHeight - (upPoints[hoverIdx] / maxVal) * chartHeight}
                r="3.5"
                fill="#34d399"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}


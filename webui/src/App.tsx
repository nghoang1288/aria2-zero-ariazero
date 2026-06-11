import { useState, useEffect, useCallback } from 'react';
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
  Settings, 
  Activity, 
  Check, 
  AlertCircle,
  X,
  Link,
  Sun,
  Moon,
  Folder,
  Share2,
  Film,
  Music,
  FileText,
  Box,
  Upload,
  Menu
} from 'lucide-react';
import { 
  useAria2, 
  getTaskName, 
  formatSpeed, 
  formatBytes, 
  formatETA 
} from './useAria2';
import type { Aria2Task } from './useAria2';
import SettingsPanel from './SettingsPanel';
import { SmartDownloadProvider, useSmartDownload } from './SmartDownload';
import { useToast } from './Toast';

function App() {
  const {
    status,
    globalStat,
    activeTasks,
    waitingTasks,
    stoppedTasks,
    globalOptions,
    events,
    selectedGid,
    taskPeers,
    taskServers,
    speedHistory,
    setSelectedGid,
    addUri,
    addTorrent,
    pauseTask,
    resumeTask,
    removeTask,
    clearStopped,
    fetchGlobalOptions,
    updateGlobalOptions,
    acknowledgeEvent
  } = useAria2();

  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'downloads' | 'settings'>('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUris, setNewUris] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ariazero_theme') as 'dark' | 'light') || 'dark';
  });
  const [addMode, setAddMode] = useState<'link' | 'torrent'>('link');
  const [torrentFile, setTorrentFile] = useState<{ name: string; base64: string } | null>(null);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ariazero_theme', next);
  };



  // Smart download handler: when a link is detected from clipboard/magnet/drag
  const handleLinkDetected = useCallback((url: string, source?: 'url_param' | 'clipboard' | 'drag') => {
    if (source === 'url_param') {
      setNewUris(url);
      setAddMode('link');
      setShowAddModal(true);
      showToast({
        type: 'info',
        title: 'Magnet Link Detected',
        message: 'Opened download popup',
        duration: 3000,
      });
    } else {
      showToast({
        type: 'info',
        title: 'Link Detected',
        message: url.length > 60 ? url.slice(0, 60) + '…' : url,
        action: {
          label: 'Download Now',
          onClick: () => {
            addUri(url);
            showToast({
              type: 'success',
              title: 'Download Started',
              message: 'Task added to queue',
            });
          },
        },
        duration: 8000,
      });
    }
  }, [addUri, showToast]);

  const handleTorrentDetected = useCallback((base64: string, filename: string) => {
    showToast({
      type: 'info',
      title: 'Torrent File Detected',
      message: filename,
      action: {
        label: 'Download Now',
        onClick: () => {
          addTorrent(base64);
          showToast({
            type: 'success',
            title: 'Torrent Download Started',
            message: 'Adding torrent to queue',
          });
        },
      },
      duration: 8000,
    });
  }, [addTorrent, showToast]);

  // Bandwidth Scheduler execution
  useEffect(() => {
    const checkScheduler = () => {
      const enabled = localStorage.getItem('ariazero_scheduler_enabled') === 'true';
      if (!enabled) return;

      const start = localStorage.getItem('ariazero_scheduler_start') || '08:00';
      const end = localStorage.getItem('ariazero_scheduler_end') || '18:00';
      const dlLimit = localStorage.getItem('ariazero_scheduler_dl_limit') || '500K';
      const ulLimit = localStorage.getItem('ariazero_scheduler_ul_limit') || '50K';
      const dlNormal = localStorage.getItem('ariazero_scheduler_dl_normal') || '0';
      const ulNormal = localStorage.getItem('ariazero_scheduler_ul_normal') || '0';

      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      let isInside = false;
      if (start <= end) {
        isInside = current >= start && current < end;
      } else {
        isInside = current >= start || current < end;
      }

      const targetDl = isInside ? dlLimit : dlNormal;
      const targetUl = isInside ? ulLimit : ulNormal;

      const currentDl = globalOptions['max-overall-download-limit'];
      const currentUl = globalOptions['max-overall-upload-limit'];

      // Only update if there's a difference and options are loaded
      if (Object.keys(globalOptions).length > 0 && (currentDl !== targetDl || currentUl !== targetUl)) {
        updateGlobalOptions({
          'max-overall-download-limit': targetDl,
          'max-overall-upload-limit': targetUl
        });
        showToast({
          type: 'info',
          title: 'Scheduler Limit Applied',
          message: `DL: ${targetDl === '0' ? 'Unlimited' : targetDl} | UL: ${targetUl === '0' ? 'Unlimited' : targetUl}`,
        });
      }
    };

    // Run immediately and every 10s
    checkScheduler();
    const timer = setInterval(checkScheduler, 10000);

    // Listen for scheduler change events from the SettingsPanel
    window.addEventListener('ariazero_scheduler_changed', checkScheduler);

    return () => {
      clearInterval(timer);
      window.removeEventListener('ariazero_scheduler_changed', checkScheduler);
    };
  }, [globalOptions, updateGlobalOptions, showToast]);

  // Process aria2 events (download complete, error, etc.)
  useEffect(() => {
    if (events.length === 0) return;

    for (const event of events) {
      if (event.type === 'complete') {
        showToast({
          type: 'success',
          title: 'Download Complete',
          message: `Task ${event.gid} finished successfully`,
        });
        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification('AriaZero — Download Complete', {
            body: `Task ${event.gid} finished`,
            icon: '/favicon.ico',
          });
        }
      } else if (event.type === 'error') {
        showToast({
          type: 'error',
          title: 'Download Error',
          message: `Task ${event.gid} encountered an error`,
        });
      }
      acknowledgeEvent(event.id);
    }
  }, [events, acknowledgeEvent, showToast]);

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
    <SmartDownloadProvider onLinkDetected={handleLinkDetected} onTorrentDetected={handleTorrentDetected}>
      <AppContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        newUris={newUris}
        setNewUris={setNewUris}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        getStatusBadge={getStatusBadge}
        globalStat={globalStat}
        displayDownloads={displayDownloads}
        displayStopped={displayStopped}
        allActiveAndWaiting={allActiveAndWaiting}
        stoppedTasks={stoppedTasks}
        status={status}
        globalOptions={globalOptions}
        pauseTask={pauseTask}
        resumeTask={resumeTask}
        removeTask={removeTask}
        clearStopped={clearStopped}
        fetchGlobalOptions={fetchGlobalOptions}
        updateGlobalOptions={updateGlobalOptions}
        addUri={addUri}
        addTorrent={addTorrent}
        selectedGid={selectedGid}
        taskPeers={taskPeers}
        taskServers={taskServers}
        speedHistory={speedHistory}
        setSelectedGid={setSelectedGid}
        theme={theme}
        toggleTheme={toggleTheme}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        addMode={addMode}
        setAddMode={setAddMode}
        torrentFile={torrentFile}
        setTorrentFile={setTorrentFile}
      />
    </SmartDownloadProvider>
  );
}

// Separate inner component to use useSmartDownload (needs to be inside SmartDownloadProvider)
function AppContent({
  activeTab, setActiveTab, showAddModal, setShowAddModal,
  newUris, setNewUris, searchQuery, setSearchQuery,
  getStatusBadge, globalStat,
  displayDownloads, displayStopped, allActiveAndWaiting, stoppedTasks,
  status, globalOptions, pauseTask, resumeTask, removeTask, clearStopped,
  fetchGlobalOptions, updateGlobalOptions, addUri, addTorrent,
  selectedGid, taskPeers, taskServers, speedHistory, setSelectedGid,
  theme, toggleTheme, selectedCategory, setSelectedCategory,
  addMode, setAddMode, torrentFile, setTorrentFile,
}: any) {
  const { isDragging } = useSmartDownload();
  const [drawerTab, setDrawerTab] = useState<'files' | 'peers' | 'trackers'>('files');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const { showToast } = useToast();

  // Disk Space State
  interface DiskSpaceInfo {
    total: number;
    used: number;
    free: number;
  }
  const [diskSpace, setDiskSpace] = useState<DiskSpaceInfo | null>(null);

  // Fetch disk space from `/api/disk`
  const fetchDiskSpace = useCallback(async () => {
    try {
      const devHost = '192.168.50.226';
      const devPort = '16980';
      const host = location.port === '5173' ? devHost : location.hostname;
      const port = location.port === '5173' ? devPort : (location.port || (location.protocol === 'https:' ? '443' : '80'));
      const protocol = location.protocol === 'https:' ? 'https' : 'http';
      const url = `${protocol}://${host}:${port}/api/disk`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDiskSpace(data);
      }
    } catch (e) {
      console.error('Failed to fetch disk space:', e);
    }
  }, []);

  useEffect(() => {
    fetchDiskSpace();
    const interval = setInterval(fetchDiskSpace, 15000);
    return () => clearInterval(interval);
  }, [fetchDiskSpace]);

  // Task Removal States
  const [taskToRemove, setTaskToRemove] = useState<Aria2Task | null>(null);
  const [deleteFilesOnDisk, setDeleteFilesOnDisk] = useState(false);
  const [isDeletingFiles, setIsDeletingFiles] = useState(false);

  // Bulk Clear States
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [deleteClearAllFiles, setDeleteClearAllFiles] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Helper to resolve paths to delete for a task
  const getPathsToDelete = useCallback((task: Aria2Task): string[] => {
    if (!task.files || task.files.length === 0) return [];
    
    const paths = task.files
      .map(f => f.path)
      .filter(p => p && p.startsWith('/downloads/'));
      
    if (paths.length === 0) return [];
    
    const itemsToDelete = new Set<string>();
    
    for (const path of paths) {
      const relative = path.substring('/downloads/'.length);
      const firstPart = relative.split(/[/\\]/)[0];
      if (firstPart) {
        const topLevelPath = `/downloads/${firstPart}`;
        itemsToDelete.add(topLevelPath);
        itemsToDelete.add(`${topLevelPath}.aria2`);
      }
    }
    
    return Array.from(itemsToDelete);
  }, []);

  const handleInitiateRemove = (task: Aria2Task) => {
    setTaskToRemove(task);
    setDeleteFilesOnDisk(false);
  };

  const handleConfirmRemove = async () => {
    if (!taskToRemove) return;
    
    setIsDeletingFiles(true);
    try {
      if (deleteFilesOnDisk) {
        const paths = getPathsToDelete(taskToRemove);
        if (paths.length > 0) {
          const devHost = '192.168.50.226';
          const devPort = '16980';
          const host = location.port === '5173' ? devHost : location.hostname;
          const port = location.port === '5173' ? devPort : (location.port || (location.protocol === 'https:' ? '443' : '80'));
          const protocol = location.protocol === 'https:' ? 'https' : 'http';
          const url = `${protocol}://${host}:${port}/api/delete-files`;

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: paths })
          });
          
          if (!res.ok) {
            console.error('Failed to delete files on disk');
          } else {
            const data = await res.json();
            if (data.errors && data.errors.length > 0) {
              showToast({
                type: 'warning',
                title: 'Partial file deletion',
                message: data.errors.join(', ')
              });
            } else {
              showToast({
                type: 'success',
                title: 'Files deleted',
                message: 'Successfully deleted downloaded files from disk.'
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error during file deletion:', e);
      showToast({
        type: 'error',
        title: 'Error deleting files',
        message: 'An error occurred while trying to delete files from disk.'
      });
    } finally {
      removeTask(taskToRemove.gid, taskToRemove.status);
      setTaskToRemove(null);
      setIsDeletingFiles(false);
      setTimeout(fetchDiskSpace, 1000);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsClearingAll(true);
    try {
      if (deleteClearAllFiles) {
        const allPaths: string[] = [];
        for (const task of stoppedTasks) {
          allPaths.push(...getPathsToDelete(task));
        }
        
        if (allPaths.length > 0) {
          const devHost = '192.168.50.226';
          const devPort = '16980';
          const host = location.port === '5173' ? devHost : location.hostname;
          const port = location.port === '5173' ? devPort : (location.port || (location.protocol === 'https:' ? '443' : '80'));
          const protocol = location.protocol === 'https:' ? 'https' : 'http';
          const url = `${protocol}://${host}:${port}/api/delete-files`;

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: allPaths })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.errors && data.errors.length > 0) {
              showToast({
                type: 'warning',
                title: 'Partial file deletion',
                message: 'Some files could not be deleted.'
              });
            } else {
              showToast({
                type: 'success',
                title: 'Files deleted',
                message: 'Successfully deleted files for all stopped tasks.'
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error clearing all files:', e);
    } finally {
      clearStopped();
      setShowClearAllConfirm(false);
      setIsClearingAll(false);
      setTimeout(fetchDiskSpace, 1000);
    }
  };

  // Retry logic
  const retryTask = useCallback(async (task: Aria2Task) => {
    const url = task.infoHash 
      ? `magnet:?xt=urn:btih:${task.infoHash}` 
      : (task.files?.[0]?.uris?.[0]?.uri || null);
      
    if (url) {
      // Deleting the corrupted .aria2 control file on disk first
      const aria2Paths = getPathsToDelete(task).filter(p => p.endsWith('.aria2'));
      if (aria2Paths.length > 0) {
        try {
          const devHost = '192.168.50.226';
          const devPort = '16980';
          const host = location.port === '5173' ? devHost : location.hostname;
          const port = location.port === '5173' ? devPort : (location.port || (location.protocol === 'https:' ? '443' : '80'));
          const protocol = location.protocol === 'https:' ? 'https' : 'http';
          const apiUrl = `${protocol}://${host}:${port}/api/delete-files`;

          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: aria2Paths })
          });
        } catch (e) {
          console.error('Failed to clean up .aria2 control file before retry:', e);
        }
      }

      addUri(url);
      removeTask(task.gid, task.status);
      showToast({
        type: 'success',
        title: 'Retrying Download',
        message: `Started retrying task: ${getTaskName(task)}`
      });
      setTimeout(fetchDiskSpace, 1000);
    } else {
      showToast({
        type: 'error',
        title: 'Retry Failed',
        message: 'Could not retrieve original download link for this task.'
      });
    }
  }, [addUri, removeTask, showToast, getPathsToDelete, fetchDiskSpace]);

  // Helper category detection
  const getFileExtension = (task: Aria2Task): string => {
    const name = getTaskName(task).toLowerCase();
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  const isVideo = (task: Aria2Task) => ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm'].includes(getFileExtension(task));
  const isAudio = (task: Aria2Task) => ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].includes(getFileExtension(task));
  const isDoc = (task: Aria2Task) => ['pdf', 'docx', 'doc', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'epub'].includes(getFileExtension(task));
  const isSoftware = (task: Aria2Task) => ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'zip', 'rar', '7z', 'tar', 'gz'].includes(getFileExtension(task));
  const isTorrent = (task: Aria2Task) => !!task.bittorrent;

  // A task is seeding if it is active, is a torrent, and completedLength >= totalLength
  const isTaskSeeding = (task: Aria2Task) => {
    return task.status === 'active' && 
      !!task.bittorrent && 
      Number(task.totalLength) > 0 && 
      Number(task.completedLength) >= Number(task.totalLength);
  };

  // Identify completed metadata tasks to hide them
  const isMetadataTask = (task: Aria2Task) => {
    const name = getTaskName(task).toLowerCase();
    return name.includes('[metadata]') || 
           name.includes('metadata') ||
           (task as any).followedBy !== undefined ||
           (!!task.bittorrent && !task.bittorrent.info);
  };

  const allTasks = [...allActiveAndWaiting, ...stoppedTasks].filter((t: Aria2Task) => !isMetadataTask(t));
  const activeCount = allActiveAndWaiting.filter((t: Aria2Task) => t.status === 'active' && !isTaskSeeding(t) && !isMetadataTask(t)).length;
  const completedCount = stoppedTasks.filter((t: Aria2Task) => t.status === 'complete' && !isMetadataTask(t)).length + allActiveAndWaiting.filter((t: Aria2Task) => isTaskSeeding(t) && !isMetadataTask(t)).length;
  const torrentCount = allTasks.filter(isTorrent).length;
  const videoCount = allTasks.filter(isVideo).length;
  const audioCount = allTasks.filter(isAudio).length;
  const docCount = allTasks.filter(isDoc).length;
  const softwareCount = allTasks.filter(isSoftware).length;

  const categories = [
    { id: 'all', label: 'All Tasks', icon: Folder, count: allTasks.length },
    { id: 'active', label: 'Active', icon: Activity, count: activeCount },
    { id: 'completed', label: 'Completed', icon: CheckCircle, count: completedCount },
    { id: 'torrents', label: 'Torrents', icon: Share2, count: torrentCount },
    { id: 'video', label: 'Video', icon: Film, count: videoCount },
    { id: 'audio', label: 'Audio', icon: Music, count: audioCount },
    { id: 'documents', label: 'Documents', icon: FileText, count: docCount },
    { id: 'software', label: 'Software / Zip', icon: Box, count: softwareCount },
  ];

  const filterTaskByCategory = (task: Aria2Task) => {
    switch (selectedCategory) {
      case 'active':
        return (task.status === 'active' || task.status === 'waiting') && !isTaskSeeding(task) && !isMetadataTask(task);
      case 'completed':
        return (task.status === 'complete' || isTaskSeeding(task)) && !isMetadataTask(task);
      case 'torrents':
        return isTorrent(task) && !isMetadataTask(task);
      case 'video':
        return isVideo(task) && !isMetadataTask(task);
      case 'audio':
        return isAudio(task) && !isMetadataTask(task);
      case 'documents':
        return isDoc(task) && !isMetadataTask(task);
      case 'software':
        return isSoftware(task) && !isMetadataTask(task);
      case 'all':
      default:
        return !isMetadataTask(task);
    }
  };

  const downloads = displayDownloads.filter((t: Aria2Task) => !isTaskSeeding(t) && !isMetadataTask(t));
  const completedAndStopped = [
    ...displayStopped.filter((t: Aria2Task) => !isMetadataTask(t)), 
    ...displayDownloads.filter((t: Aria2Task) => isTaskSeeding(t) && !isMetadataTask(t))
  ];

  const filteredDownloads = downloads.filter(filterTaskByCategory);
  const filteredStopped = completedAndStopped.filter(filterTaskByCategory);

  const selectedTask = [...allActiveAndWaiting, ...stoppedTasks].find(t => t.gid === selectedGid);

  const renderSidebarContent = (isMobile = false) => {
    return (
      <>
        <div className="p-5 border-b border-border-main flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-cyan-500/15 p-1.5 rounded-lg border border-cyan-500/30">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              AriaZero
            </span>
          </div>
          {isMobile && (
            <button 
              onClick={() => setShowMobileSidebar(false)}
              className="text-text-dim hover:text-text-main p-1 rounded-lg transition-colors md:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Navigation Tabs */}
        <nav className="px-4 py-4 space-y-1">
          <button 
            onClick={() => {
              setActiveTab('dashboard');
              if (isMobile) setShowMobileSidebar(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-cyan-500/8 text-cyan-400 border-l-2 border-cyan-400' 
                : 'text-text-dim hover:bg-page-bg/40 hover:text-text-main border-l-2 border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            Dashboard
          </button>
          
          <button 
            onClick={() => {
              setActiveTab('downloads');
              if (isMobile) setShowMobileSidebar(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'downloads' 
                ? 'bg-cyan-500/8 text-cyan-400 border-l-2 border-cyan-400' 
                : 'text-text-dim hover:bg-page-bg/40 hover:text-text-main border-l-2 border-transparent'
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
            onClick={() => {
              setActiveTab('settings');
              if (isMobile) setShowMobileSidebar(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-cyan-500/8 text-cyan-400 border-l-2 border-cyan-400' 
                : 'text-text-dim hover:bg-page-bg/40 hover:text-text-main border-l-2 border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>

        {/* Categories Section */}
        <div className="px-4 py-2 border-t border-border-main flex-1 overflow-y-auto">
          <span className="text-[10px] text-text-dim uppercase tracking-wider font-bold block mb-2 px-2">Categories</span>
          <div className="space-y-1">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (isMobile) setShowMobileSidebar(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-500/10 text-cyan-400 font-semibold'
                      : 'text-text-dim hover:bg-page-bg/40 hover:text-text-main'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  {cat.count > 0 && (
                    <span className="ml-auto text-[9px] bg-border-main border border-border-main/20 text-text-dim px-1.5 py-0.5 rounded-full">
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border-main bg-page-bg/30 shrink-0">
          {diskSpace && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-text-dim mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-cyan-400" />
                  Disk Storage
                </span>
                <span className="font-mono text-[10px] text-text-main font-semibold">
                  {formatBytes(diskSpace.free)} free
                </span>
              </div>
              <div className="bg-page-bg/40 border border-border-main/20 rounded-full h-1.5 overflow-hidden mb-1">
                <div 
                  style={{ width: `${Math.round((diskSpace.used / diskSpace.total) * 100)}%` }} 
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-text-dim/80 font-mono">
                <span>Used: {formatBytes(diskSpace.used)}</span>
                <span>Total: {formatBytes(diskSpace.total)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-text-dim mb-2">
            <span>Samba Share</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
          <div className="text-[11px] text-text-dim font-mono break-all bg-page-bg/60 p-2 rounded border border-border-main">
            \\192.168.50.226\downloads
            <div className="mt-1 text-[9px] text-text-dim/80">User: admin | Pass: 123456</div>
          </div>
        </div>
      </>
    );
  };

  // Form submission handler
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === 'link') {
      if (!newUris.trim()) return;
      const uris = newUris.split('\n').map((u: string) => u.trim()).filter((u: string) => u);
      uris.forEach((uri: string) => addUri(uri));
      setNewUris('');
    } else {
      if (!torrentFile) return;
      addTorrent(torrentFile.base64);
      setTorrentFile(null);
    }
    setShowAddModal(false);
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans relative ${theme === 'light' ? 'theme-light bg-page-bg text-text-main' : 'bg-page-bg text-text-main'}`}>

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-page-bg/85 backdrop-blur-md flex items-center justify-center">
          <div className="border-2 border-dashed border-cyan-500/50 rounded-2xl p-16 flex flex-col items-center gap-4 animate-pulse">
            <Link className="w-12 h-12 text-cyan-400" />
            <span className="text-lg font-semibold text-cyan-400">Drop links or .torrent files here to download</span>
            <span className="text-xs text-text-dim">Release to add download task</span>
          </div>
        </div>
      )}
      
      {/* Mobile Sidebar backdrop */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-[60] md:hidden backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}
      
      {/* Mobile Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-sidebar-bg border-r border-border-main z-[70] flex flex-col md:hidden transition-transform duration-300 transform ${
          showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar-bg border-r border-border-main flex flex-col shrink-0">
        {renderSidebarContent(false)}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-page-bg">
        
        {/* Top Header */}
        <header className="h-16 bg-sidebar-bg border-b border-border-main flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="p-1.5 rounded-lg bg-input-bg border border-border-main text-text-dim hover:text-text-main md:hidden transition-colors cursor-pointer"
              title="Menu"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            <h1 className="text-md md:text-lg font-semibold text-text-main capitalize">{activeTab}</h1>
            <div className="hidden sm:block">
              {getStatusBadge()}
            </div>
            {diskSpace && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] bg-slate-800/40 border border-slate-700/30 text-slate-300 px-2.5 py-1 rounded-full font-mono font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>{formatBytes(diskSpace.free)} / {formatBytes(diskSpace.total)} free</span>
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="hidden sm:inline-block text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-medium capitalize">
                {selectedCategory}
              </span>
            )}
          </div>
          
          {/* Action Buttons, Theme Toggle, & Search */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative w-28 sm:w-48 md:w-64">
              <Search className="w-3.5 h-3.5 text-text-dim absolute left-2.5 top-2.5" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-input-bg border border-border-main rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-text-main placeholder-text-dim/60 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-1.5 md:p-2 rounded-lg bg-input-bg border border-border-main text-text-dim hover:text-text-main transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
            </button>
            
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/10 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Download</span>
            </button>
          </div>
        </header>

        {/* Page Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8">
          
          {activeTab === 'dashboard' && (
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
                    <span className="text-2xl font-bold text-text-main">{allActiveAndWaiting.filter((t: Aria2Task) => (t.status === 'paused' || t.status === 'waiting') && !isMetadataTask(t)).length}</span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

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
                                ) : (
                                  <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                                    <Check className="w-3.5 h-3.5" />
                                    Completed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-5 text-right">
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
          )}

          {activeTab === 'downloads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-text-dim">Downloads List</h2>
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
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              globalOptions={globalOptions}
              updateGlobalOptions={updateGlobalOptions}
              fetchGlobalOptions={fetchGlobalOptions}
              connectionStatus={status}
            />
          )}

        </div>

        {/* Global speed indicator at bottom */}
        <footer className="h-12 bg-sidebar-bg border-t border-border-main flex items-center justify-between px-4 md:px-8 text-xs text-text-dim shrink-0">
          <div className="flex items-center gap-3">
            <span>AriaZero v1.2.0</span>
            <span className="hidden lg:inline text-[10px] text-text-dim/60 font-mono">Real-time Graphs • Task details drawer • Bandwidth scheduler</span>
          </div>
          
          {/* Sparklines */}
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-1.5 md:gap-2">
              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Down: {formatSpeed(globalStat.downloadSpeed)}</span>
              <div className="hidden sm:block ml-1 shrink-0 opacity-80 border border-border-main/40 rounded p-0.5 bg-page-bg/40">
                <Sparkline data={speedHistory?.down || []} color="#22d3ee" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Up: {formatSpeed(globalStat.uploadSpeed)}</span>
              <div className="hidden sm:block ml-1 shrink-0 opacity-80 border border-border-main/40 rounded p-0.5 bg-page-bg/40">
                <Sparkline data={speedHistory?.up || []} color="#34d399" />
              </div>
            </div>
          </div>
        </footer>

        {/* Sliding Task Details Drawer */}
        {selectedTask && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[420px] bg-sidebar-bg border-l border-border-main shadow-2xl z-[80] flex flex-col transition-all duration-300 transform translate-x-0">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border-main flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] text-text-dim font-mono tracking-wider block mb-1">TASK DETAILS ({selectedTask.gid})</span>
                <h3 className="text-xs font-semibold text-text-main truncate pr-4" title={getTaskName(selectedTask)}>
                  {getTaskName(selectedTask)}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedGid(null)}
                className="text-text-dim hover:text-text-main p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-border-main bg-page-bg/20 text-xs">
              <button 
                onClick={() => setDrawerTab('files')}
                className={`flex-1 py-3 text-center font-medium border-b-2 transition-all cursor-pointer ${
                  drawerTab === 'files' ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-text-dim hover:text-text-main'
                }`}
              >
                Files ({selectedTask.files?.length || 0})
              </button>
              <button 
                onClick={() => setDrawerTab('peers')}
                className={`flex-1 py-3 text-center font-medium border-b-2 transition-all cursor-pointer ${
                  drawerTab === 'peers' ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-text-dim hover:text-text-main'
                }`}
              >
                Connections
              </button>
              <button 
                onClick={() => setDrawerTab('trackers')}
                className={`flex-1 py-3 text-center font-medium border-b-2 transition-all cursor-pointer ${
                  drawerTab === 'trackers' ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-text-dim hover:text-text-main'
                }`}
              >
                Metadata
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedTask.status === 'error' && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs space-y-3 animate-in slide-in-from-top duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-rose-400">Download Error</h4>
                      <p className="text-text-dim mt-1 font-mono text-[11px] break-words">
                        Code {selectedTask.errorCode || 'Unknown'}: {selectedTask.errorMessage || 'No details available.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => retryTask(selectedTask)}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white font-medium text-[11px] px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Retry Download
                    </button>
                  </div>
                </div>
              )}

              {drawerTab === 'files' && (
                <div className="space-y-3">
                  {selectedTask.files?.map((file: any, i: number) => {
                    const fLength = Number(file.length);
                    const fCompleted = Number(file.completedLength);
                    const fProgress = fLength > 0 ? Math.min(Math.round((fCompleted / fLength) * 100), 100) : 0;
                    const parts = file.path.split(/[/\\]/);
                    const fName = parts[parts.length - 1] || file.uris?.[0]?.uri || `File ${i + 1}`;

                    return (
                      <div key={i} className="bg-page-bg border border-border-main rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-text-main break-all select-all">{fName}</span>
                          <span className="text-[10px] text-text-dim shrink-0 font-mono">{formatBytes(file.length)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-page-bg/40 border border-border-main/20 rounded-full h-1.5 overflow-hidden">
                            <div style={{ width: `${fProgress}%` }} className="h-full rounded-full bg-cyan-500" />
                          </div>
                          <span className="text-[9px] font-mono text-text-dim">{fProgress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {drawerTab === 'peers' && (
                <div className="space-y-3">
                  {selectedTask.bittorrent ? (
                    <>
                      <div className="flex items-center justify-between text-[10px] text-text-dim font-mono uppercase font-bold tracking-wider px-2">
                        <span>Peer IP / Client</span>
                        <span>Speed (Down / Up)</span>
                      </div>
                      {taskPeers.length === 0 ? (
                        <div className="text-center text-text-dim text-xs py-10 bg-page-bg border border-border-main border-dashed rounded-lg">
                          No active peer connections
                        </div>
                      ) : (
                        taskPeers.map((peer: any, i: number) => (
                          <div key={i} className="bg-page-bg border border-border-main rounded-lg p-3 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-mono text-text-main block">{peer.ip}:{peer.port}</span>
                              <span className="text-[10px] text-text-dim">{peer.seeding === 'true' ? 'Seeding' : 'Leeching'}</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-cyan-400 block">↓ {formatSpeed(peer.downloadSpeed)}</span>
                              <span className="text-emerald-400 text-[10px] block">↑ {formatSpeed(peer.uploadSpeed)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[10px] text-text-dim font-mono uppercase font-bold tracking-wider px-2">
                        <span>Server Connection</span>
                        <span>Active</span>
                      </div>
                      {taskServers.length === 0 ? (
                        <div className="text-center text-text-dim text-xs py-10 bg-page-bg border border-border-main border-dashed rounded-lg">
                          No active server connection stats
                        </div>
                      ) : (
                        taskServers.map((server: any, i: number) => (
                          <div key={i} className="bg-page-bg border border-border-main rounded-lg p-3 text-xs space-y-1">
                            <div className="font-mono text-text-main break-all">{server.uri}</div>
                            <div className="flex justify-between text-[10px] text-text-dim font-mono">
                              <span>Conns: {server.currentConnections || 1}</span>
                              <span className="text-cyan-400">Active</span>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              )}

              {drawerTab === 'trackers' && (
                <div className="space-y-4 text-xs">
                  {selectedTask.bittorrent ? (
                    <div className="space-y-4">
                      <div className="bg-page-bg border border-border-main rounded-lg p-3 space-y-2">
                        <div>
                          <span className="text-[10px] text-text-dim uppercase tracking-wider block">Info Hash</span>
                          <span className="font-mono text-text-main break-all select-all">{selectedTask.bittorrent.infoHash || '—'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <span className="text-[10px] text-text-dim uppercase tracking-wider block">Mode</span>
                            <span className="text-text-main capitalize">{selectedTask.bittorrent.mode || 'Single File'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-text-dim uppercase tracking-wider block">Seeders</span>
                            <span className="text-text-main">{selectedTask.numSeeders || '0'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-text-dim font-mono uppercase font-bold tracking-wider px-2">Announce Trackers</span>
                        <div className="bg-page-bg border border-border-main rounded-lg divide-y divide-border-main max-h-60 overflow-y-auto">
                          {selectedTask.bittorrent.announceList?.map((list: any[], i: number) => (
                            <div key={i} className="p-2.5 font-mono text-[10px] text-text-dim break-all hover:bg-page-bg/25">
                              {list[0]}
                            </div>
                          )) || (
                            <div className="p-4 text-center text-text-dim italic">No trackers listed</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-page-bg border border-border-main rounded-lg p-3 space-y-3">
                      <div>
                        <span className="text-[10px] text-text-dim uppercase tracking-wider block">GID</span>
                        <span className="font-mono text-text-main select-all">{selectedTask.gid}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-dim uppercase tracking-wider block">Connections</span>
                        <span className="font-mono text-text-main">{selectedTask.connections || '1'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-dim uppercase tracking-wider block">Status</span>
                        <span className="text-text-main capitalize">{selectedTask.status}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Task Removal Confirmation Modal */}
      {taskToRemove && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-sidebar-bg border border-border-main rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-border-main flex items-center justify-between">
              <h3 className="text-md font-semibold text-text-main flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Remove Download
              </h3>
              <button 
                onClick={() => setTaskToRemove(null)}
                disabled={isDeletingFiles}
                className="text-text-dim hover:text-text-main p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="text-xs text-text-dim">
                Are you sure you want to remove this download task from the list?
                <div className="mt-2 p-2.5 bg-page-bg/50 border border-border-main/50 rounded-lg text-text-main font-semibold truncate" title={getTaskName(taskToRemove)}>
                  {getTaskName(taskToRemove)}
                </div>
              </div>
              
              {getPathsToDelete(taskToRemove).length > 0 && (
                <div className="bg-page-bg/40 border border-border-main/30 rounded-lg p-3.5 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={deleteFilesOnDisk}
                      onChange={(e) => setDeleteFilesOnDisk(e.target.checked)}
                      disabled={isDeletingFiles}
                      className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/30 w-4 h-4 cursor-pointer bg-slate-800"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-text-main">Also delete downloaded files from disk</span>
                      <p className="text-[10px] text-text-dim mt-0.5">
                        Permanently removes files inside <code className="bg-slate-800/80 px-1 rounded text-cyan-400">/downloads/</code>
                      </p>
                    </div>
                  </label>
                  
                  {deleteFilesOnDisk && (
                    <div className="text-[10px] text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded p-2 flex items-start gap-1.5 font-medium animate-in slide-in-from-top-1 duration-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Warning: This will permanently delete the downloaded files on your server's storage. This action cannot be undone.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-border-main bg-page-bg/25 flex justify-end gap-3">
              <button 
                onClick={() => setTaskToRemove(null)}
                disabled={isDeletingFiles}
                className="px-3.5 py-2 text-xs font-medium bg-input-bg border border-border-main rounded-lg text-text-dim hover:text-text-main transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmRemove}
                disabled={isDeletingFiles}
                className="px-3.5 py-2 text-xs font-medium bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/10 cursor-pointer disabled:opacity-50"
              >
                {isDeletingFiles ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Confirm Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Bulk Clear Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-sidebar-bg border border-border-main rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-border-main flex items-center justify-between">
              <h3 className="text-md font-semibold text-text-main flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Clear History
              </h3>
              <button 
                onClick={() => setShowClearAllConfirm(false)}
                disabled={isClearingAll}
                className="text-text-dim hover:text-text-main p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="text-xs text-text-dim">
                Are you sure you want to clear all stopped and completed tasks from history?
              </div>
              
              <div className="bg-page-bg/40 border border-border-main/30 rounded-lg p-3.5 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={deleteClearAllFiles}
                    onChange={(e) => setDeleteClearAllFiles(e.target.checked)}
                    disabled={isClearingAll}
                    className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/30 w-4 h-4 cursor-pointer bg-slate-800"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-text-main">Also delete files for these tasks from disk</span>
                    <p className="text-[10px] text-text-dim mt-0.5">
                      Permanently removes files inside <code className="bg-slate-800/80 px-1 rounded text-cyan-400">/downloads/</code>
                    </p>
                  </div>
                </label>
                
                {deleteClearAllFiles && (
                  <div className="text-[10px] text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded p-2 flex items-start gap-1.5 font-medium animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Warning: This will permanently delete files for ALL history tasks. This action cannot be undone.</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-5 border-t border-border-main bg-page-bg/25 flex justify-end gap-3">
              <button 
                onClick={() => setShowClearAllConfirm(false)}
                disabled={isClearingAll}
                className="px-3.5 py-2 text-xs font-medium bg-input-bg border border-border-main rounded-lg text-text-dim hover:text-text-main transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmClearAll}
                disabled={isClearingAll}
                className="px-3.5 py-2 text-xs font-medium bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/10 cursor-pointer disabled:opacity-50"
              >
                {isClearingAll ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Confirm Clear'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Uri */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-sidebar-bg border border-border-main rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border-main flex items-center justify-between">
              <h3 className="text-md font-semibold text-text-main">Start New Download</h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setTorrentFile(null);
                }}
                className="text-text-dim hover:text-text-main transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-border-main text-xs font-semibold bg-page-bg/20">
              <button 
                type="button"
                onClick={() => setAddMode('link')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
                  addMode === 'link' ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-text-dim hover:text-text-main'
                }`}
              >
                Links (HTTP/FTP/Magnet)
              </button>
              <button 
                type="button"
                onClick={() => setAddMode('torrent')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
                  addMode === 'torrent' ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-text-dim hover:text-text-main'
                }`}
              >
                Torrent File (.torrent)
              </button>
            </div>
            
            <form onSubmit={handleModalSubmit}>
              <div className="p-5 space-y-4">
                {addMode === 'link' ? (
                  <div>
                    <label className="text-xs text-text-dim block mb-1.5">URLs to download</label>
                    <textarea 
                      rows={4}
                      placeholder="Paste HTTP/HTTPS/FTP or Magnet links here (one per line)..."
                      value={newUris}
                      onChange={(e) => setNewUris(e.target.value)}
                      className="w-full bg-input-bg border border-border-main rounded-lg px-3 py-2 text-xs text-text-main placeholder-text-dim/60 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs text-text-dim block mb-1.5">Upload .torrent file</label>
                    <div 
                      className="border border-dashed border-border-main rounded-xl p-8 flex flex-col items-center justify-center gap-2.5 bg-page-bg/40 hover:bg-page-bg/85 hover:border-cyan-500/50 cursor-pointer transition-colors relative"
                      onClick={() => document.getElementById('torrent-input-picker')?.click()}
                    >
                      <input 
                        id="torrent-input-picker"
                        type="file"
                        accept=".torrent"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              if (result) {
                                const base64 = result.split(',')[1];
                                if (base64) {
                                  setTorrentFile({ name: file.name, base64 });
                                }
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Upload className="w-8 h-8 text-text-dim" />
                      {torrentFile ? (
                        <div className="text-center">
                          <span className="text-xs font-semibold text-emerald-400 block max-w-[280px] truncate">{torrentFile.name}</span>
                          <span className="text-[10px] text-text-dim block mt-0.5">Click to choose another file</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-xs font-semibold text-text-main block">Click to select torrent file</span>
                          <span className="text-[10px] text-text-dim block mt-0.5">Supports .torrent files</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="text-[11px] text-text-dim">
                  Tasks will start immediately and save to the shared downloads directory.
                </div>
              </div>

              <div className="px-5 py-4 border-t border-border-main bg-page-bg/20 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setTorrentFile(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-page-bg/40 transition-colors text-text-dim cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={addMode === 'torrent' && !torrentFile}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
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
  onRemove: (task: Aria2Task) => void;
  onSelect: (gid: string) => void;
  isSelected: boolean;
}

function TaskCard({ task, onPause, onResume, onRemove, onSelect, isSelected }: TaskCardProps) {
  const isActive = task.status === 'active';
  const isPaused = task.status === 'paused' || task.status === 'waiting';
  const total = Number(task.totalLength);
  const completed = Number(task.completedLength);
  const progressPercent = total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;
  
  const speed = formatSpeed(task.downloadSpeed);
  const eta = formatETA(task.completedLength, task.totalLength, task.downloadSpeed);

  return (
    <div 
      onClick={(e) => {
        // Prevent trigger if clicking buttons or actions
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect(task.gid);
      }}
      className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all cursor-pointer ${
        isSelected 
          ? 'bg-card-bg border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/30' 
          : 'bg-card-bg border-border-main hover:border-cyan-500/40 text-text-main'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-semibold text-xs text-text-main truncate block max-w-[70vw] sm:max-w-lg" title={getTaskName(task)}>
            {getTaskName(task)}
          </span>
          <span className="text-[10px] text-text-dim font-mono">
            {formatBytes(task.totalLength)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-page-bg/40 border border-border-main/20 rounded-full h-1.5 overflow-hidden">
            <div 
              style={{ width: `${progressPercent}%` }} 
              className={`h-full rounded-full transition-all duration-300 ${
                isActive ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-slate-700'
              }`}
            ></div>
          </div>
          <span className="text-[10px] font-mono text-text-dim w-8 text-right">{progressPercent}%</span>
        </div>
      </div>

      {/* Speed & ETA */}
      <div className="flex items-center gap-6 justify-between md:justify-end shrink-0">
        {isActive && (
          <div className="flex gap-4 text-xs font-mono">
            <div className="text-cyan-400">
              <span className="text-text-dim text-[10px] block uppercase font-medium tracking-wide">Speed</span>
              {Number(task.uploadSpeed) > 0 ? `↓ ${speed} | ↑ ${formatSpeed(task.uploadSpeed)}` : speed}
            </div>
            <div className="text-text-main">
              <span className="text-text-dim text-[10px] block uppercase font-medium tracking-wide">ETA</span>
              {eta}
            </div>
          </div>
        )}
        
        {isPaused && (
          <div className="text-amber-500 text-xs font-mono">
            <span className="text-text-dim text-[10px] block uppercase font-medium tracking-wide">Status</span>
            Paused
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 md:border-l md:border-border-main md:pl-4 pl-0 border-l-0">
          {isActive ? (
            <button 
              onClick={() => onPause(task.gid)}
              className="text-text-dim hover:text-cyan-400 p-2 rounded-lg hover:bg-page-bg/40 transition-colors cursor-pointer"
              title="Pause download"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button 
              onClick={() => onResume(task.gid)}
              className="text-text-dim hover:text-cyan-400 p-2 rounded-lg hover:bg-page-bg/40 transition-colors cursor-pointer"
              title="Resume download"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button 
            onClick={() => onRemove(task)}
            className="text-text-dim hover:text-rose-400 p-2 rounded-lg hover:bg-page-bg/40 transition-colors cursor-pointer"
            title="Cancel/Delete download"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Sparkline Mini Chart
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) {
    return <div className="w-16 h-5 flex items-center justify-center text-[9px] text-text-dim/40 font-mono">- - -</div>;
  }
  const max = Math.max(...data, 1024); // Min ceiling 1KB/s
  const min = 0;
  const width = 64;
  const height = 14;
  const points = data
    .map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((val - min) / (max - min)) * height;
      return `${x},${y}`;
    })
    .join(' ');

  // SVG Unique gradient ID to avoid collisions
  const gradId = `spark-grad-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon
        fill={`url(#${gradId})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}

export default App;


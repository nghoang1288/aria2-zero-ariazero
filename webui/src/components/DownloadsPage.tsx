import { useMemo } from 'react';
import type { Aria2Task } from '../useAria2';
import { 
  isTorrentCompleted, 
  getTaskName, 
  isMetadataTask, 
  filterTaskByCategory 
} from '../utils/taskUtils';
import TaskCard from './TaskCard';

interface DownloadsPageProps {
  activeTasks: Aria2Task[];
  waitingTasks: Aria2Task[];
  searchQuery: string;
  selectedCategory: string;
  pauseTask: (gid: string) => void;
  resumeTask: (gid: string) => void;
  handleInitiateRemove: (task: Aria2Task) => void;
  setSelectedGid: (gid: string | null) => void;
  selectedGid: string | null;
}

export default function DownloadsPage({
  activeTasks,
  waitingTasks,
  searchQuery,
  selectedCategory,
  pauseTask,
  resumeTask,
  handleInitiateRemove,
  setSelectedGid,
  selectedGid,
}: DownloadsPageProps) {

  const lowercaseQuery = useMemo(() => searchQuery.toLowerCase().trim(), [searchQuery]);

  const allActiveAndWaiting = useMemo(() => [...activeTasks, ...waitingTasks], [activeTasks, waitingTasks]);

  const displayDownloads = useMemo(() => {
    if (!lowercaseQuery) return allActiveAndWaiting;
    return allActiveAndWaiting.filter(t => getTaskName(t).toLowerCase().includes(lowercaseQuery));
  }, [allActiveAndWaiting, lowercaseQuery]);

  const downloads = useMemo(() => {
    return displayDownloads.filter((t: Aria2Task) => !isTorrentCompleted(t) && !isMetadataTask(t));
  }, [displayDownloads]);

  const filteredDownloads = useMemo(() => {
    return downloads.filter(t => filterTaskByCategory(t, selectedCategory));
  }, [downloads, selectedCategory]);

  return (
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
  );
}

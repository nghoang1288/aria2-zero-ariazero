import { useEffect, useRef, useState, useCallback } from 'react';

export interface Aria2File {
  path: string;
  length: string;
  completedLength: string;
  uris?: { uri: string; status: string }[];
}

export interface Aria2Task {
  gid: string;
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';
  totalLength: string;
  completedLength: string;
  downloadSpeed: string;
  uploadSpeed: string;
  files: Aria2File[];
  bittorrent?: {
    info?: {
      name?: string;
    };
  };
  connections?: string;
  numSeeders?: string;
}

export interface Aria2GlobalStat {
  downloadSpeed: string;
  uploadSpeed: string;
  numActive: string;
  numWaiting: string;
  numStopped: string;
}

export function getTaskName(task: Aria2Task): string {
  if (task.bittorrent?.info?.name) {
    return task.bittorrent.info.name;
  }
  const filePath = task.files?.[0]?.path;
  if (filePath) {
    const parts = filePath.split(/[/\\]/);
    const name = parts[parts.length - 1];
    if (name) return name;
  }
  const uri = task.files?.[0]?.uris?.[0]?.uri;
  if (uri) {
    const parts = uri.split('/');
    const name = parts[parts.length - 1].split('?')[0];
    if (name) return decodeURIComponent(name);
  }
  return 'Downloading Task...';
}

export function formatSpeed(bytesPerSec: number | string): string {
  const bytes = Number(bytesPerSec);
  if (isNaN(bytes) || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatBytes(bytes: number | string): string {
  const b = Number(bytes);
  if (isNaN(b) || b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatETA(completed: string, total: string, speed: string): string {
  const c = Number(completed);
  const t = Number(total);
  const s = Number(speed);
  if (isNaN(c) || isNaN(t) || isNaN(s) || s <= 0 || c >= t) return '--';
  const remainingBytes = t - c;
  const seconds = Math.ceil(remainingBytes / s);
  
  if (seconds >= 3600 * 24) {
    const days = Math.floor(seconds / (3600 * 24));
    return `${days}d`;
  }
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

declare global {
  interface Window {
    AriaZeroServerConfig?: {
      rpcSecret?: string;
    };
  }
}

// Wait for config.js to load (it is injected dynamically)
function getRpcSecret(): string {
  return window.AriaZeroServerConfig?.rpcSecret || '';
}

export interface Aria2Event {
  id: string;
  type: 'complete' | 'error' | 'start' | 'pause' | 'stop';
  gid: string;
  timestamp: number;
}

export function useAria2() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [globalStat, setGlobalStat] = useState<Aria2GlobalStat>({
    downloadSpeed: '0',
    uploadSpeed: '0',
    numActive: '0',
    numWaiting: '0',
    numStopped: '0'
  });
  const [activeTasks, setActiveTasks] = useState<Aria2Task[]>([]);
  const [waitingTasks, setWaitingTasks] = useState<Aria2Task[]>([]);
  const [stoppedTasks, setStoppedTasks] = useState<Aria2Task[]>([]);
  const [globalOptions, setGlobalOptions] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Aria2Event[]>([]);

  // Task details and speed history states
  const [selectedGid, setSelectedGid] = useState<string | null>(null);
  const [taskPeers, setTaskPeers] = useState<any[]>([]);
  const [taskServers, setTaskServers] = useState<any[]>([]);
  const [speedHistory, setSpeedHistory] = useState<{ down: number[]; up: number[] }>({ down: [], up: [] });

  const selectedGidRef = useRef<string | null>(null);

  useEffect(() => {
    selectedGidRef.current = selectedGid;
    if (!selectedGid) {
      setTaskPeers([]);
      setTaskServers([]);
    }
  }, [selectedGid]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Use refs for callbacks to avoid stale closures in setInterval
  const sendRpcRef = useRef<(method: string, params: any[], id: string) => void>(() => {});
  const sendBatchRpcRef = useRef<(requests: { method: string; params?: any[]; id: string }[]) => void>(() => {});

  // Always read rpcSecret fresh to avoid stale closure from async config.js load
  const sendRpc = useCallback((method: string, params: any[] = [], id: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const secret = getRpcSecret();
      const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params: secret ? [`token:${secret}`, ...params] : params
      };
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendBatchRpc = useCallback((requests: { method: string; params?: any[]; id: string }[]) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const secret = getRpcSecret();
      const payload = requests.map(r => ({
        jsonrpc: '2.0',
        id: r.id,
        method: r.method,
        params: secret ? [`token:${secret}`, ...(r.params || [])] : (r.params || [])
      }));
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Keep refs updated
  sendRpcRef.current = sendRpc;
  sendBatchRpcRef.current = sendBatchRpc;


  const fetchGlobalOptions = useCallback(() => {
    sendRpcRef.current('aria2.getGlobalOption', [], 'getGlobalOption');
  }, []);

  const updateGlobalOptions = useCallback((options: Record<string, string>) => {
    sendRpcRef.current('aria2.changeGlobalOption', [options], 'changeGlobalOption');
    // Refresh options after a short delay
    setTimeout(() => sendRpcRef.current('aria2.getGlobalOption', [], 'getGlobalOption'), 500);
  }, []);

  const handleSingleResponse = useCallback((res: any) => {
    if (res.error) {
      console.error('RPC Error:', res.error);
      return;
    }
    const id = res.id;
    const result = res.result;

    if (id === 'globalStat') {
      setGlobalStat(result);
      const dl = Number(result.downloadSpeed) || 0;
      const ul = Number(result.uploadSpeed) || 0;
      setSpeedHistory(prev => ({
        down: [...prev.down, dl].slice(-30),
        up: [...prev.up, ul].slice(-30)
      }));
    } else if (id === 'active') {
      setActiveTasks(result || []);
    } else if (id === 'waiting') {
      setWaitingTasks(result || []);
    } else if (id === 'stopped') {
      setStoppedTasks(result || []);
    } else if (id === 'getGlobalOption') {
      setGlobalOptions(result || {});
    } else if (id === 'getPeers') {
      setTaskPeers(result || []);
    } else if (id === 'getServers') {
      setTaskServers(result || []);
    }
  }, []);


  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    setStatus('connecting');

    // Build URL: fallback to .226 if running in Vite dev port 5173
    const devHost = '192.168.50.226';
    const devPort = '16980';
    const host = location.port === '5173' ? devHost : location.hostname;
    const port = location.port === '5173' ? devPort : (location.port || (location.protocol === 'https:' ? '443' : '80'));
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${host}:${port}/jsonrpc`;

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('connected');
        // Start polling immediately using refs (avoids stale closures)
        const reqs: { method: string; id: string; params?: any[] }[] = [
          { method: 'aria2.getGlobalStat', id: 'globalStat' },
          { method: 'aria2.tellActive', id: 'active' },
          { method: 'aria2.tellWaiting', params: [0, 1000], id: 'waiting' },
          { method: 'aria2.tellStopped', params: [0, 1000], id: 'stopped' }
        ];
        if (selectedGidRef.current) {
          reqs.push({ method: 'aria2.getPeers', params: [selectedGidRef.current], id: 'getPeers' });
          reqs.push({ method: 'aria2.getServers', params: [selectedGidRef.current], id: 'getServers' });
        }
        sendBatchRpcRef.current(reqs);
        sendRpcRef.current('aria2.getGlobalOption', [], 'getGlobalOption');
        // Use ref-based poll for interval to always get fresh rpcSecret
        pollIntervalRef.current = setInterval(() => {
          const pollReqs: { method: string; id: string; params?: any[] }[] = [
            { method: 'aria2.getGlobalStat', id: 'globalStat' },
            { method: 'aria2.tellActive', id: 'active' },
            { method: 'aria2.tellWaiting', params: [0, 1000], id: 'waiting' },
            { method: 'aria2.tellStopped', params: [0, 1000], id: 'stopped' }
          ];
          if (selectedGidRef.current) {
            pollReqs.push({ method: 'aria2.getPeers', params: [selectedGidRef.current], id: 'getPeers' });
            pollReqs.push({ method: 'aria2.getServers', params: [selectedGidRef.current], id: 'getServers' });
          }
          sendBatchRpcRef.current(pollReqs);
        }, 1000) as unknown as number;
      };

      socket.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          // Handle both batch and single responses, and aria2 notifications
          if (Array.isArray(res)) {
            res.forEach(r => handleSingleResponse(r));
          } else if (res.method) {
            // aria2 server-sent notification
            handleAria2Notification(res);
          } else if (res.id) {
            handleSingleResponse(res);
          }
        } catch (e) {
          console.error('Failed to parse RPC response:', e);
        }
      };

      socket.onclose = () => {
        setStatus('disconnected');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000) as unknown as number;
      };

      socket.onerror = (e) => {
        console.error('WebSocket error:', e);
        socket.close();
      };
    } catch (e) {
      console.error('Failed to initiate WebSocket:', e);
      setStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(() => connect(), 3000) as unknown as number;
    }
  }, [cleanup, handleSingleResponse]);

  useEffect(() => {
    connect();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User Actions
  const addUri = useCallback((uri: string) => {
    sendRpcRef.current('aria2.addUri', [[uri]], 'addUri');
  }, []);

  const addTorrent = useCallback((base64: string) => {
    sendRpcRef.current('aria2.addTorrent', [base64], 'addTorrent');
  }, []);

  const pauseTask = useCallback((gid: string) => {
    sendRpcRef.current('aria2.pause', [gid], 'pause');
  }, []);

  const resumeTask = useCallback((gid: string) => {
    sendRpcRef.current('aria2.unpause', [gid], 'unpause');
  }, []);

  const removeTask = useCallback((gid: string, status: string) => {
    if (status === 'active' || status === 'waiting' || status === 'paused') {
      sendRpcRef.current('aria2.forceRemove', [gid], 'remove');
    } else {
      sendRpcRef.current('aria2.removeDownloadResult', [gid], 'removeResult');
    }
  }, []);

  const clearStopped = useCallback(() => {
    sendRpcRef.current('aria2.purgeDownloadResult', [], 'purge');
  }, []);

  const handleAria2Notification = useCallback((msg: any) => {
    const method = msg.method as string;
    const gid = msg.params?.[0]?.gid as string;
    if (!gid) return;

    const typeMap: Record<string, Aria2Event['type']> = {
      'aria2.onDownloadComplete': 'complete',
      'aria2.onDownloadError': 'error',
      'aria2.onDownloadStart': 'start',
      'aria2.onDownloadPause': 'pause',
      'aria2.onDownloadStop': 'stop',
      'aria2.onBtDownloadComplete': 'complete',
    };

    const eventType = typeMap[method];
    if (eventType) {
      const event: Aria2Event = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        type: eventType,
        gid,
        timestamp: Date.now(),
      };
      setEvents(prev => [...prev, event]);
    }
  }, []);

  const acknowledgeEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
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
    acknowledgeEvent,
    clearEvents
  };
}

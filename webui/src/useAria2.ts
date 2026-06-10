import { useEffect, useRef, useState } from 'react';

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
    AriaNgServerConfig?: {
      rpcSecret?: string;
    };
  }
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

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Retrieve secret from injected config
  const rpcSecret = window.AriaNgServerConfig ? window.AriaNgServerConfig.rpcSecret : '';

  useEffect(() => {
    connect();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
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
  };

  const connect = () => {
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
        // Start polling immediately
        poll();
        pollIntervalRef.current = setInterval(poll, 1000) as unknown as number;
      };

      socket.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          handleRpcMessage(res);
        } catch (e) {
          console.error('Failed to parse RPC response:', e);
        }
      };

      socket.onclose = () => {
        setStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(connect, 3000) as unknown as number;
      };

      socket.onerror = (e) => {
        console.error('WebSocket error:', e);
        socket.close();
      };
    } catch (e) {
      console.error('Failed to initiate WebSocket:', e);
      setStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(connect, 3000) as unknown as number;
    }
  };

  const sendRpc = (method: string, params: any[] = [], id: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params: rpcSecret ? [`token:${rpcSecret}`, ...params] : params
      };
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  const sendBatchRpc = (requests: { method: string; params?: any[]; id: string }[]) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = requests.map(r => ({
        jsonrpc: '2.0',
        id: r.id,
        method: r.method,
        params: rpcSecret ? [`token:${rpcSecret}`, ...(r.params || [])] : (r.params || [])
      }));
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  const poll = () => {
    sendBatchRpc([
      { method: 'aria2.getGlobalStat', id: 'globalStat' },
      { method: 'aria2.tellActive', id: 'active' },
      { method: 'aria2.tellWaiting', params: [0, 1000], id: 'waiting' },
      { method: 'aria2.tellStopped', params: [0, 1000], id: 'stopped' }
    ]);
  };

  const handleRpcMessage = (message: any) => {
    if (Array.isArray(message)) {
      // Handle batch responses
      message.forEach(res => handleSingleResponse(res));
    } else {
      handleSingleResponse(message);
    }
  };

  const handleSingleResponse = (res: any) => {
    if (res.error) {
      console.error('RPC Error:', res.error);
      return;
    }
    const id = res.id;
    const result = res.result;

    if (id === 'globalStat') {
      setGlobalStat(result);
    } else if (id === 'active') {
      setActiveTasks(result || []);
    } else if (id === 'waiting') {
      setWaitingTasks(result || []);
    } else if (id === 'stopped') {
      setStoppedTasks(result || []);
    }
  };

  // User Actions
  const addUri = (uri: string) => {
    sendRpc('aria2.addUri', [[uri]], 'addUri');
  };

  const pauseTask = (gid: string) => {
    sendRpc('aria2.pause', [gid], 'pause');
  };

  const resumeTask = (gid: string) => {
    sendRpc('aria2.unpause', [gid], 'unpause');
  };

  const removeTask = (gid: string, status: string) => {
    if (status === 'active' || status === 'waiting' || status === 'paused') {
      sendRpc('aria2.forceRemove', [gid], 'remove');
    } else {
      sendRpc('aria2.removeDownloadResult', [gid], 'removeResult');
    }
  };

  const clearStopped = () => {
    sendRpc('aria2.purgeDownloadResult', [], 'purge');
  };

  return {
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
  };
}

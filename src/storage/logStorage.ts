import type { WorkoutLog } from '../types';

const STORAGE_KEY = 'vwl_logs';

export const getAllLogs = (): WorkoutLog[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as WorkoutLog[];
  } catch (error) {
    console.error('Failed to load logs:', error);
    return [];
  }
};

export const saveLog = (log: WorkoutLog): void => {
  try {
    const logs = getAllLogs();
    const existingIndex = logs.findIndex((l) => l.id === log.id);

    if (existingIndex >= 0) {
      logs[existingIndex] = log;
    } else {
      logs.push(log);
    }

    logs.sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save log:', error);
    throw new Error('저장에 실패했습니다.');
  }
};

export const deleteLog = (id: string): void => {
  try {
    const logs = getAllLogs();
    const filtered = logs.filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete log:', error);
    throw new Error('삭제에 실패했습니다.');
  }
};

export const getLogById = (id: string): WorkoutLog | null => {
  const logs = getAllLogs();
  return logs.find((l) => l.id === id) || null;
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const formatDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

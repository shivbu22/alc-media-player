/// <reference types="vite/client" />

export interface ScannedFile {
  name: string
  path: string
  size: number
  extension: string
}

export interface ElectronAPI {
  isElectron: boolean
  openFolderDialog: () => Promise<ScannedFile[]>
  readDirectory: (dirPath: string) => Promise<ScannedFile[]>
  downloadUrl: (url: string, filename?: string) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}


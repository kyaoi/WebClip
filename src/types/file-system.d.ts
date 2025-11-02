export {};

declare global {
  interface FileSystemHandle {
    queryPermission?: (
      descriptor?: FileSystemPermissionDescriptor,
    ) => Promise<PermissionState>;
    requestPermission?: (
      descriptor?: FileSystemPermissionDescriptor,
    ) => Promise<PermissionState>;
  }

  interface FileSystemDirectoryHandle {
    values?: () => AsyncIterableIterator<FileSystemHandle>;
  }
}

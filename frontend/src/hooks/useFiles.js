import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useFiles() {
  return useQuery({
    queryKey: ['files'],
    queryFn: () => api.get('/files', { params: { is_deleted: false } }).then((r) => r.data),
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/files/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useIndexedFolders() {
  return useQuery({
    queryKey: ['indexed-folders'],
    queryFn: () => api.get('/indexed_folders').then((r) => r.data),
  });
}

export function useAddIndexedFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folder) => api.post('/indexed_folders', folder).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indexed-folders'] }),
  });
}

export function useDeleteIndexedFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/indexed_folders/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indexed-folders'] }),
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/files/upload', formData).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useRegisterFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderName, files }) =>
      api.post('/files/register-folder', { folder_name: folderName, files }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] });
      qc.invalidateQueries({ queryKey: ['indexed-folders'] });
    },
  });
}

export function useDeleteAllFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/files/delete-all').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useCascadeDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/indexed_folders/${id}/cascade`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] });
      qc.invalidateQueries({ queryKey: ['indexed-folders'] });
    },
  });
}

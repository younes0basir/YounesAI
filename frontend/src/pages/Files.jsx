import { useState, useRef, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFiles, useDeleteFile, useIndexedFolders, useUploadFile, useRegisterFolder, useDeleteAllFiles, useCascadeDeleteFolder } from '../hooks/useFiles'
import { useAuth } from '../stores/useAuth'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import ConfirmModal from '../components/ui/ConfirmModal'
import { File, Trash2, FileText, Image, Music, Film, Archive, FolderPlus, Folder, RefreshCw, Upload, Search, ArrowUpDown, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const extIcons = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, csv: FileText,
  jpg: Image, jpeg: Image, png: Image, gif: Image, svg: Image, webp: Image,
  mp3: Music, wav: Music, flac: Music,
  mp4: Film, mov: Film, avi: Film,
  zip: Archive, rar: Archive, '7z': Archive, tar: Archive, gz: Archive,
}

const extTones = {
  pdf: 'bg-rose-50 text-rose-600', doc: 'bg-blue-50 text-blue-600', docx: 'bg-blue-50 text-blue-600', txt: 'bg-slate-100 text-slate-600', csv: 'bg-emerald-50 text-emerald-600',
  jpg: 'bg-violet-50 text-violet-600', jpeg: 'bg-violet-50 text-violet-600', png: 'bg-violet-50 text-violet-600',
  mp3: 'bg-amber-50 text-amber-600', mp4: 'bg-indigo-50 text-indigo-600',
  zip: 'bg-orange-50 text-orange-600',
}

function getFileIcon(ext) {
  const Icon = extIcons[ext?.toLowerCase()]
  return Icon || File
}

function formatSize(bytes) {
  const num = Number(bytes)
  if (!num || num <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = num
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

export default function Files() {
  const user = useAuth((s) => s.user)
  const userId = user?.id
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useFiles()
  const del = useDeleteFile()

  const { data: folders, isLoading: foldersLoading, isError: foldersError, refetch: refetchFolders } = useIndexedFolders()
  const deleteFolder = useCascadeDeleteFolder()
  const deleteAllFiles = useDeleteAllFiles()

  const [syncFolderId, setSyncFolderId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [isImportingFolder, setIsImportingFolder] = useState(false)
  const [expandedFolderId, setExpandedFolderId] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [folderOp, setFolderOp] = useState({ active: false, step: '', message: '' })
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState(null)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const dropRef = useRef(null)

  const uploadFile = useUploadFile()
  const registerFolder = useRegisterFolder()
  const [isUploading, setIsUploading] = useState(false)

  const files = Array.isArray(data) ? data : []
  const watchedFolders = Array.isArray(folders) ? folders : []

  const filesByFolder = useMemo(() => {
    const map = {}
    for (const f of files) {
      let key = null
      for (const wf of watchedFolders) {
        if (wf.folder_path.startsWith('web://')) {
          const name = wf.folder_path.replace('web://', '')
          if (f.path?.startsWith(name + '/')) { key = wf.id; break }
        } else if (f.path?.startsWith(wf.folder_path)) {
          key = wf.id; break
        }
      }
      if (!key) key = '_ungrouped'
      if (!map[key]) map[key] = []
      map[key].push(f)
    }
    return map
  }, [files, watchedFolders])

  const ungroupedFiles = filesByFolder['_ungrouped'] || []

  const filterChips = [
    { key: '', label: 'All', icon: File },
    { key: 'pdf', label: 'PDF', icon: FileText },
    { key: 'doc,docx', label: 'Doc', icon: FileText },
    { key: 'txt,csv', label: 'Text', icon: FileText },
    { key: 'jpg,jpeg,png,gif,svg,webp', label: 'Image', icon: Image },
    { key: 'mp3,wav,flac', label: 'Audio', icon: Music },
    { key: 'mp4,mov,avi', label: 'Video', icon: Film },
    { key: 'zip,rar,7z,tar,gz', label: 'Archive', icon: Archive },
  ]

  function matchFilter(ext, filterKey) {
    if (!filterKey) return true
    return filterKey.split(',').includes(ext?.toLowerCase())
  }

  const processedFiles = useMemo(() => {
    let list = searchQuery.trim()
      ? files.filter(f => f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.path?.toLowerCase().includes(searchQuery.toLowerCase()))
      : ungroupedFiles

    if (typeFilter) {
      list = list.filter(f => matchFilter(f.extension || f.name?.split('.').pop(), typeFilter))
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'size') return (Number(b.size_bytes) || 0) - (Number(a.size_bytes) || 0)
      if (sortBy === 'date') return new Date(b.indexed_at || 0) - new Date(a.indexed_at || 0)
      return 0
    })
  }, [files, ungroupedFiles, searchQuery, typeFilter, sortBy])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = e.dataTransfer?.files
    if (!droppedFiles || droppedFiles.length === 0) return

    setIsUploading(true)
    let count = 0
    for (const f of droppedFiles) {
      try {
        await uploadFile.mutateAsync(f)
        count++
      } catch { /* skip individual failure */ }
    }
    if (count > 0) toast.success(`Uploaded ${count} file(s).`)
    setIsUploading(false)
  }, [uploadFile])

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e) => { if (!dropRef.current?.contains(e.relatedTarget)) setIsDragOver(false) }

  const handleSelectFolder = async () => {
    if (window.electron) {
      let pickedPath = null
      try {
        setFolderOp({ active: true, step: 'selecting', message: 'Opening folder picker...' })
        const selectResult = await window.electron.selectFolder()
        if (selectResult.cancelled || !selectResult.folderPath) {
          setFolderOp({ active: false, step: '', message: '' })
          return
        }
        pickedPath = selectResult.folderPath

        setFolderOp({ active: true, step: 'scanning', message: 'Scanning folder contents...' })
        setSyncFolderId('new')

        const scanResult = await window.electron.scanFolder({ folderPath: pickedPath, userId })
        if (!scanResult.success) {
          throw new Error(scanResult.error)
        }

        queryClient.invalidateQueries({ queryKey: ['files'] })
        queryClient.invalidateQueries({ queryKey: ['indexed-folders'] })
        toast.success(`Folder indexed and monitored. ${scanResult.filesCount} file(s) processed.`)
      } catch (err) {
        console.error(err)
        toast.error(`Folder selection failed: ${err.message}`)
      } finally {
        setSyncFolderId(null)
        setFolderOp({ active: false, step: '', message: '' })
      }
    } else {
      folderInputRef.current?.click()
    }
  }

  const handleWebFolderSelect = async (e) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    setIsImportingFolder(true)
    setFolderOp({ active: true, step: 'registering', message: `Preparing ${fileList.length} file(s) from folder...` })
    try {
      const firstPath = fileList[0].webkitRelativePath || ''
      const folderName = firstPath.split('/')[0] || `folder-${Date.now()}`

      const meta = Array.from(fileList).map((f) => ({
        name: f.name,
        path: f.webkitRelativePath || f.name,
        mime_type: f.type || null,
        size_bytes: f.size,
        extension: f.name.split('.').pop() || null,
      }))

      const result = await registerFolder.mutateAsync({ folderName, files: meta })
      setExpandedFolderId(result.folder.id)
      toast.success(`Registered folder "${folderName}" with ${result.registered} file(s).`)
      e.target.value = ''
    } catch (err) {
      toast.error(`Folder import failed: ${err.message}`)
    } finally {
      setIsImportingFolder(false)
      setFolderOp({ active: false, step: '', message: '' })
    }
  }

  const handleSyncFolder = async (folder) => {
    if (!window.electron) return
    setSyncFolderId(folder.id)
    try {
      const scanResult = await window.electron.scanFolder({ folderPath: folder.folder_path, userId })
      if (!scanResult.success) throw new Error(scanResult.error)
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['indexed-folders'] })
      toast.success(`Rescanned folder. Indexed ${scanResult.filesCount} files.`)
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`)
    } finally {
      setSyncFolderId(null)
    }
  }

  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    setIsUploading(true)
    let count = 0
    for (const f of selectedFiles) {
      try {
        await uploadFile.mutateAsync(f)
        count++
      } catch { /* skip */ }
    }
    if (count > 0) toast.success(`Uploaded ${count} file(s).`)
    setIsUploading(false)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Files & Documents" description="Manage local and indexed workspace documents." />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSelectFolder}
            disabled={folderOp.active || syncFolderId === 'new' || isImportingFolder}
            className="btn btn-primary flex items-center gap-2"
          >
            {folderOp.active || syncFolderId === 'new' || isImportingFolder ? <RefreshCw className="animate-spin" size={16} /> : <FolderPlus size={16} />}
            <span>{isImportingFolder ? 'Importing...' : folderOp.active ? folderOp.step === 'scanning' ? 'Scanning...' : folderOp.step === 'registering' ? 'Registering...' : 'Please wait...' : 'Select Folder'}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-secondary flex items-center gap-2"
          >
            {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
            <span>Upload File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            webkitdirectory=""
            onChange={handleWebFolderSelect}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search files by name or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200/70 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 bg-white/80 backdrop-blur-sm"
          />
        </div>
        <div className="relative">
          <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none pl-8 pr-8 py-2 rounded-xl border border-slate-200/70 text-sm bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
          >
            <option value="name">Name</option>
            <option value="date">Newest</option>
            <option value="size">Largest</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setTypeFilter(typeFilter === chip.key ? '' : chip.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              typeFilter === chip.key
                ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md'
                : 'bg-white/70 text-slate-500 hover:bg-white hover:text-violet-700 ring-1 ring-slate-200/70'
            }`}
          >
            <chip.icon size={12} />
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Files List */}
        <div className="lg:col-span-2 space-y-4"
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" />
            <span>Indexed Documents</span>
            {!isLoading && files.length > 0 && (
              <span className="badge badge-muted text-xs">{files.length}</span>
            )}
            {!isLoading && files.length > 0 && (
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="ml-auto text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1"
              >
                <Trash2 size={12} />
                Delete All
              </button>
            )}
          </h3>

          {isDragOver && (
            <div className="border-2 border-dashed border-violet-300 bg-violet-50/50 rounded-2xl p-10 text-center">
              <Upload size={32} className="mx-auto text-violet-400 mb-2" />
              <p className="text-sm font-medium text-violet-600">Drop files to upload</p>
            </div>
          )}

          {isError ? (
            <ErrorState title="Could not load files" onRetry={refetch} />
          ) : isLoading ? (
            <LoadingState message="Loading indexed files..." />
          ) : processedFiles.length === 0 && !isDragOver ? (
            <EmptyState icon={File} title={searchQuery || typeFilter ? 'No matches' : 'No files yet'} description={searchQuery || typeFilter ? 'Try adjusting filters.' : 'Select a local folder or upload a file to get started.'} />
          ) : !isDragOver && (
            <div className="surface divide-y divide-slate-100 overflow-hidden">
              {processedFiles.map((f) => {
                const ext = f.extension || (f.name?.split('.').pop())
                const Icon = getFileIcon(ext)
                const tone = extTones[ext?.toLowerCase()] || 'bg-slate-100 text-slate-600'
                return (
                  <div key={f.id} className="flex items-center gap-4 px-4 py-3.5 group hover:bg-violet-50/40 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                      <Icon size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{f.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {ext ? <span className="badge badge-muted uppercase">{ext}</span> : null}
                        {f.size_bytes != null ? <span>{formatSize(f.size_bytes)}</span> : null}
                        {f.indexed_at ? <span className="hidden sm:inline-flex items-center gap-1"><Clock size={11} />{new Date(f.indexed_at).toLocaleDateString()}</span> : null}
                        {f.path && !searchQuery ? <span className="hidden sm:inline truncate text-slate-400 max-w-xs">{f.path}</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { del.mutate(f.id); toast.success(`Removed "${f.name}"`) }}
                      className="btn-icon hover:text-rose-500 shrink-0"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right 1 Column: Monitored Folders */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Folder size={18} className="text-amber-500" />
            <span>Monitored Folders</span>
            {!foldersLoading && watchedFolders.length > 0 && (
              <span className="badge badge-muted text-xs">{watchedFolders.length}</span>
            )}
          </h3>

          {foldersError ? (
            <ErrorState bare title="Could not load folders" onRetry={refetchFolders} />
          ) : foldersLoading ? (
            <LoadingState message="Loading folders..." />
          ) : watchedFolders.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-sm">
              No local folders are currently indexed or monitored.
            </div>
          ) : (
            <div className="space-y-3">
              {watchedFolders.map((folder) => {
                const folderFiles = filesByFolder[folder.id] || []
                const isExpanded = expandedFolderId === folder.id
                const isWeb = folder.folder_path.startsWith('web://')
                const displayName = folder.folder_path.split(/[\\/]/).pop() || folder.folder_path
                return (
                  <div key={folder.id} className="surface overflow-hidden">
                    <button
                      onClick={() => setExpandedFolderId(isExpanded ? null : folder.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-violet-50/40 transition-colors text-left"
                    >
                      <div className={`text-xs font-bold ${isExpanded ? 'text-indigo-500' : 'text-slate-400'} transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 truncate">{displayName}</div>
                        <div className="text-xs text-slate-400 truncate">{folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}</div>
                      </div>
                      <span className="badge badge-success shrink-0">Live</span>
                    </button>

                    {isExpanded && folderFiles.length > 0 && (
                      <div className="divide-y divide-slate-50 border-t border-slate-100">
                        {folderFiles.map((f) => {
                          const ext = f.extension || (f.name?.split('.').pop())
                          const Icon = getFileIcon(ext)
                          const tone = extTones[ext?.toLowerCase()] || 'bg-slate-100 text-slate-600'
                          return (
                            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-violet-50/40 transition-colors">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                                <Icon size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-800 truncate">{f.name}</div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  {ext ? <span className="uppercase">{ext}</span> : null}
                                  {f.size_bytes != null ? <span>{formatSize(f.size_bytes)}</span> : null}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); del.mutate(f.id); toast.success(`Removed "${f.name}"`) }}
                                className="btn-icon hover:text-rose-500 shrink-0"
                                aria-label={`Remove ${f.name}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isExpanded && folderFiles.length === 0 && (
                      <div className="px-4 pb-3 text-xs text-slate-400">No files in this folder.</div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-50 px-4 py-2.5">
                      {isWeb ? (
                        <span className="text-xs text-slate-400">Web import</span>
                      ) : (
                        <button
                          onClick={() => handleSyncFolder(folder)}
                          disabled={syncFolderId === folder.id}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={syncFolderId === folder.id ? 'animate-spin' : ''} />
                          {syncFolderId === folder.id ? 'Syncing...' : 'Sync Now'}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteFolderConfirm(folder)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {folderOp.active && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-lg text-center">
            <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-medium text-slate-800 mb-1">
              {folderOp.step === 'selecting' && 'Selecting folder...'}
              {folderOp.step === 'scanning' && 'Scanning folder...'}
              {folderOp.step === 'registering' && 'Registering files...'}
            </p>
            <p className="text-xs text-slate-500">{folderOp.message}</p>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showDeleteAllConfirm}
        title="Delete all files?"
        description={`This will permanently delete all ${files.length} indexed file(s), including those inside folders. This action cannot be undone.`}
        confirmLabel="Delete all"
        onConfirm={() => {
          setShowDeleteAllConfirm(false)
          deleteAllFiles.mutate(undefined, {
            onSuccess: () => toast.success('All files deleted'),
          })
        }}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />

      <ConfirmModal
        open={!!deleteFolderConfirm}
        title={`Remove "${deleteFolderConfirm?.folder_path?.split(/[\\/]/).pop() || 'this folder'}"?`}
        description="This will permanently remove the monitored folder and all files inside it. This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => {
          const folder = deleteFolderConfirm
          setDeleteFolderConfirm(null)
          deleteFolder.mutate(folder.id, {
            onSuccess: (res) => toast.success(`Removed "${folder.folder_path.split(/[\\/]/).pop()}" and ${res.deletedFiles} file(s)`),
            onError: () => toast.error('Failed to remove folder'),
          })
        }}
        onCancel={() => setDeleteFolderConfirm(null)}
      />
    </div>
  )
}


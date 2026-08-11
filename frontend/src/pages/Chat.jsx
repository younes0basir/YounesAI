import { useState, useEffect, useRef } from 'react'
import { Send, Loader, Bot, User, Trash2, AlertTriangle, Folder, X } from 'lucide-react'
import { useConversations, useSendMessage } from '../hooks/useChat'
import { useIndexedFolders } from '../hooks/useFiles'
import api from '../lib/api'
import toast from 'react-hot-toast'

const agentColors = {
  task: 'bg-emerald-100 text-emerald-700',
  event: 'bg-blue-100 text-blue-700',
  place: 'bg-rose-100 text-rose-700',
  file: 'bg-slate-100 text-slate-700',
  memory: 'bg-amber-100 text-amber-700',
  general: 'bg-gray-100 text-gray-700',
}

export default function Chat() {
  const { data: serverMessages, isLoading, isError, refetch } = useConversations()
  const sendMessage = useSendMessage()
  const { data: folders } = useIndexedFolders()
  const [input, setInput] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [folderSelectorOpen, setFolderSelectorOpen] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const folderRef = useRef(null)

  const messages = (serverMessages || []).slice().reverse()
  const isStreaming = sendMessage.isPending
  const watchedFolders = Array.isArray(folders) ? folders : []
  const activeFolder = selectedFolderId ? watchedFolders.find(f => f.id === selectedFolderId) : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isStreaming])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (folderRef.current && !folderRef.current.contains(e.target)) {
        setFolderSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    const msg = input
    setInput('')

    try {
      await sendMessage.mutateAsync({ message: msg, folderId: selectedFolderId || undefined })
    } catch (err) {
      setInput(msg)
      toast.error(err?.response?.data?.error || 'Failed to send message. Please try again.')
    }
  }

  const handleClearAll = async () => {
    try {
      await api.delete('/agents/conversations')
      setShowClearConfirm(false)
      refetch()
      toast.success('Conversations cleared')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to clear conversations.')
    }
  }

  function displayFolderName(f) {
    if (f.folder_path.startsWith('web://')) {
      return f.folder_path.replace('web://', '')
    }
    return f.folder_path.split(/[\\/]/).pop() || f.folder_path
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="w-56 shrink-0 space-y-2 overflow-y-auto">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-medium text-slate-600">Chat History</span>
          {messages.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
        <div className="text-xs text-slate-400 text-center py-4">
          {isLoading ? 'Loading...' : isError ? (
            <button type="button" onClick={() => refetch()} className="text-primary-600 hover:underline">Could not load history — retry</button>
          ) : messages.length === 0 ? 'No messages yet' : `${messages.length} messages`}
        </div>
      </div>

      <div className="flex-1 flex flex-col surface overflow-hidden">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Bot size={48} className="text-violet-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-1">Talk to your AI Assistant</h2>
            <p className="text-sm text-slate-400 max-w-md">
              Ask me to create tasks, schedule events, find places, analyze files, or search your memories.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                'Create a task to review the project docs',
                'Schedule a meeting for tomorrow at 3pm',
                'Find documents that mention budget',
                'Add a reminder to buy groceries',
                'What does my document about pricing say?',
                'List all indexed folders and files',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isUser ? 'bg-primary-100 text-primary-700' : 'bg-violet-100 text-violet-700'}`}>
                    {isUser ? <User size={15} /> : <Bot size={15} />}
                  </div>
                  <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'bg-primary-500 text-white rounded-tr-md' : 'bg-slate-100 text-slate-800 rounded-tl-md'}`}>
                      {msg.content}
                    </div>
                    {msg.intent && !isUser && (
                      <div className="flex gap-1 mt-1 ml-1">
                        {msg.intent.split(',').map((a) => (
                          <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded-full ${agentColors[a.trim()] || 'bg-gray-100 text-gray-600'}`}>
                            {a.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`text-[10px] text-slate-400 mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}

            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-violet-100 text-violet-700">
                  <Bot size={15} />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        <div className="border-t border-slate-100">
          {activeFolder && (
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Folder size={10} />
                {displayFolderName(activeFolder)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600"
                aria-label="Clear folder scope"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 pt-2">
            <div className="relative" ref={folderRef}>
              <button
                type="button"
                onClick={() => setFolderSelectorOpen(!folderSelectorOpen)}
                className={`btn-icon text-xs ${selectedFolderId ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
                aria-label="Scope chat to a folder"
                aria-expanded={folderSelectorOpen}
              >
                <Folder size={16} />
              </button>

              {folderSelectorOpen && (
                <div className="absolute bottom-full mb-1 left-0 w-64 bg-white rounded-xl shadow-md border border-slate-200 py-1 max-h-60 overflow-y-auto z-10">
                  {watchedFolders.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">No indexed folders</div>
                  ) : (
                    watchedFolders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => { setSelectedFolderId(f.id); setFolderSelectorOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${selectedFolderId === f.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}
                      >
                        <Folder size={14} className="shrink-0 text-amber-500" />
                        <span className="truncate">{displayFolderName(f)}</span>
                      </button>
                    ))
                  )}
                  {selectedFolderId && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button
                        onClick={() => { setSelectedFolderId(null); setFolderSelectorOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <X size={14} />
                        Clear folder scope
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="flex gap-2 flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeFolder ? `Ask about "${displayFolderName(activeFolder)}"...` : 'Type a message...'}
                className="input flex-1"
                disabled={isStreaming}
              />
              <button type="submit" disabled={!input.trim() || isStreaming} className="btn btn-primary" aria-label="Send message">
                {isStreaming ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Clear all conversations?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete all your conversations. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
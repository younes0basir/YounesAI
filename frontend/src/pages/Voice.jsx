import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Play, Loader, AlertCircle, CheckCircle, Cpu, Send, MessageSquare } from 'lucide-react'
import { useVoiceProcess } from '../hooks/useVoice'
import { useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import PageHeader from '../components/ui/PageHeader'

const agentColors = {
  task: 'bg-emerald-100 text-emerald-700',
  event: 'bg-blue-100 text-blue-700',
  place: 'bg-rose-100 text-rose-700',
  file: 'bg-slate-100 text-slate-700',
  memory: 'bg-amber-100 text-amber-700',
  general: 'bg-gray-100 text-gray-700',
}

function AgentBadge({ name }) {
  const color = agentColors[name] || 'bg-gray-100 text-gray-700'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{name}</span>
}

export default function Voice() {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState(null)
  const mediaRecorder = useRef(null)
  const chunks = useRef([])

  const voiceProcess = useVoiceProcess()

  const textProcess = useMutation({
    mutationFn: async (message) => {
      const res = await api.post('/agents/chat', { message })
      return res.data
    },
    onSuccess: (data) => setResult(data),
  })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start()
      setRecording(true)
    } catch {
      alert('Microphone access is required for voice input.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      setRecording(false)
    }
  }, [])

  const handleVoiceProcess = async () => {
    if (!audioBlob) return
    const data = await voiceProcess.mutateAsync({ audioBlob })
    setResult(data.agentResponse)
  }

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (!textInput.trim()) return
    await textProcess.mutateAsync(textInput)
    setTextInput('')
  }

  const isPending = voiceProcess.isPending || textProcess.isPending

  return (
    <div className="space-y-5">
      <PageHeader title="Voice & Text Agent" description="Speak or type — the orchestrator routes to specialized agents in parallel" />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="surface p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Mic size={16} className="text-pink-500" /> Voice Input
          </h3>
          <div className="flex flex-col items-center gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${recording ? 'bg-red-100 scale-110 animate-pulse' : 'bg-pink-100'}`}>
              {recording ? (
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse" style={{ height: `${12 + i * 4}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              ) : (
                <Mic size={32} className="text-pink-600" />
              )}
            </div>

            <div className="flex items-center gap-3">
              {!recording ? (
                <button onClick={startRecording} className="btn btn-primary">
                  <Mic size={16} /> Record
                </button>
              ) : (
                <button onClick={stopRecording} className="btn bg-red-500 text-white hover:bg-red-600">
                  <Square size={16} /> Stop
                </button>
              )}
            </div>

            {audioUrl && (
              <div className="w-full space-y-3">
                <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-xl p-3 flex items-center gap-3">
                  <Play size={16} className="text-slate-400" />
                  <audio src={audioUrl} controls className="flex-1 h-8" />
                </div>
                <button onClick={handleVoiceProcess} disabled={voiceProcess.isPending} className="btn btn-primary w-full">
                  {voiceProcess.isPending ? <Loader size={16} className="animate-spin" /> : <Cpu size={16} />}
                  {voiceProcess.isPending ? 'Processing...' : 'Process'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="surface p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-violet-500" /> Text Input
          </h3>
          <form onSubmit={handleTextSubmit} className="flex flex-col gap-3">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message like: Create a task to buy groceries and check my files..."
              rows={4}
              className="input resize-none"
            />
            <button type="submit" disabled={textProcess.isPending || !textInput.trim()} className="btn btn-primary self-end">
              {textProcess.isPending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
              {textProcess.isPending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {isPending && (
        <div className="surface p-6 flex items-center justify-center gap-3 text-slate-500">
          <Loader size={20} className="animate-spin text-violet-500" />
          <span>Orchestrating agents in parallel...</span>
        </div>
      )}

      {result && (
        <div className="surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-violet-600">
            <Cpu size={18} />
            <span className="font-semibold">Response</span>
          </div>

          {result.agents && result.agents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Agents used:</span>
              {result.agents.map((name) => <AgentBadge key={name} name={name} />)}
            </div>
          )}

          <div className="bg-violet-50 rounded-xl p-4 text-slate-800 leading-relaxed whitespace-pre-wrap">
            {result.response || result.message || 'No response'}
          </div>
        </div>
      )}

      {(voiceProcess.isError || textProcess.isError) && (
        <div className="surface p-4 flex items-center gap-3 text-red-600">
          <AlertCircle size={18} />
          <span>{(voiceProcess.error || textProcess.error)?.message || 'Processing failed'}</span>
        </div>
      )}
    </div>
  )
}

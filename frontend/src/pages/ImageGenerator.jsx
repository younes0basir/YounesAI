import { useState } from 'react'
import { ImagePlus, Sparkles } from 'lucide-react'
import api from '../lib/api'

const sizePresets = [
  { label: 'Square 1024', width: 1024, height: 1024 },
  { label: 'Portrait 768 × 1344', width: 768, height: 1344 },
  { label: 'Landscape 1344 × 768', width: 1344, height: 768 },
]

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('a wolf in evernight')
  const [width, setWidth] = useState(768)
  const [height, setHeight] = useState(1344)
  const [steps, setSteps] = useState(4)
  const [seed, setSeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [statusLog, setStatusLog] = useState([
    'Ready. Enter a prompt and generate a concept image.',
  ])

  const addLog = (message) => {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setStatusLog((prev) => [...prev.slice(-5), `${stamp} • ${message}`])
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!prompt.trim()) {
      setError('Please enter a prompt.')
      return
    }

    setError('')
    setResult(null)
    setLoading(true)
    setStatusLog(['Queued. Preparing image request...'])

    try {
      addLog('Validating prompt and generation settings.')
      addLog('Sending request to NVIDIA image service...')

      const { data } = await api.post('/image/generate', {
        prompt,
        width,
        height,
        steps,
        seed,
      })

      addLog('Image received successfully from the provider.')
      setResult(data)
      addLog('Rendering preview...')
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Image generation failed.'
      addLog(`Generation failed: ${message}`)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const onPresetChange = (e) => {
    const preset = sizePresets[Number(e.target.value)]
    if (!preset) return
    setWidth(preset.width)
    setHeight(preset.height)
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="page-header">
        <div className="page-header-copy">
          <span className="page-header-kicker">Creative tools</span>
          <h1>Image generator</h1>
          <p>Create concept art and visual prompts with NVIDIA FLUX.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <form onSubmit={handleGenerate} className="surface p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="textarea min-h-[120px]"
              placeholder="Describe the image you want to generate..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Preset</label>
              <select className="select" onChange={onPresetChange} defaultValue="1">
                {sizePresets.map((preset, index) => (
                  <option key={preset.label} value={index}>{preset.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Width</label>
              <input className="input" type="number" min="256" max="1536" value={width} onChange={(e) => setWidth(Number(e.target.value) || 768)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Height</label>
              <input className="input" type="number" min="256" max="1536" value={height} onChange={(e) => setHeight(Number(e.target.value) || 1344)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Steps</label>
              <input className="input" type="number" min="1" max="12" value={steps} onChange={(e) => setSteps(Number(e.target.value) || 4)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Seed</label>
              <input className="input" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)} />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>Generation status</span>
              {loading && <span className="text-violet-600">Working...</span>}
            </div>

            <div className="space-y-2">
              {statusLog.map((entry, index) => (
                <div
                  key={`${entry}-${index}`}
                  className={`rounded-lg border px-2.5 py-2 text-xs ${
                    loading && index === statusLog.length - 1
                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {entry}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Generating...' : 'Generate image'}
            <Sparkles size={16} />
          </button>
        </form>

        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="nav-icon bg-cyan-50 text-cyan-600">
              <ImagePlus size={16} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Preview</h3>
          </div>

          {result?.image ? (
            <div className="space-y-3">
              <img
                src={result.image}
                alt={prompt}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 object-cover shadow-sm"
                style={{ aspectRatio: `${width} / ${height}` }}
              />
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                {result.width} × {result.height} • seed {result.seed} • {result.steps} steps
              </div>
            </div>
          ) : (
            <div className="empty-state-bare surface border-dashed border-slate-200 bg-white/40">
              <div className="empty-state-icon">
                <ImagePlus size={28} />
              </div>
              <p className="empty-state-title">No image yet</p>
              <p className="empty-state-description">Generate a concept image to preview it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

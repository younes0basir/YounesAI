import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import { usePlaces, useCreatePlace, useUpdatePlace, useDeletePlace } from '../hooks/usePlaces'
import toast from 'react-hot-toast'
import { MapPin, Plus, Trash2, CheckCircle, Search, Compass } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'
import ConfirmModal from '../components/ui/ConfirmModal'
import 'leaflet/dist/leaflet.css'

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getFuzzyScore(text, query) {
  const normalizedText = normalizeText(text)
  const normalizedQuery = normalizeText(query)
  if (!normalizedText || !normalizedQuery) return 0
  if (normalizedText === normalizedQuery) return 1000

  let score = 0
  if (normalizedText.startsWith(normalizedQuery)) score += 350
  if (normalizedText.includes(normalizedQuery)) score += 260

  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const textTokens = normalizedText.split(' ').filter(Boolean)
  queryTokens.forEach((token) => {
    if (textTokens.includes(token)) score += 120
    else if (textTokens.some((item) => item.startsWith(token) || token.startsWith(item))) score += 70
    else if (textTokens.some((item) => item.includes(token) || token.includes(item))) score += 40
  })

  const queryLength = normalizedQuery.length
  const commonPrefix = normalizedText.slice(0, queryLength) === normalizedQuery ? queryLength : 0
  score += commonPrefix * 0.7

  let matched = 0
  let textIndex = 0
  for (const char of normalizedQuery) {
    const nextIndex = normalizedText.indexOf(char, textIndex)
    if (nextIndex === -1) break
    matched += 1
    textIndex = nextIndex + 1
  }
  if (matched > 0) score += matched * 8

  return score
}

function haversineDistanceKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180
  const [lat1, lon1] = a
  const [lat2, lon2] = b
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const earthRadius = 6371
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function rankSearchResults(results, query, referencePoint) {
  const center = Array.isArray(referencePoint) && referencePoint.length === 2 ? referencePoint : [31.7917, -7.0926]

  return results
    .map((result) => {
      const lat = Number(result.lat)
      const lon = Number(result.lon)
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lon)
      const candidateText = `${result.name || ''} ${result.display_name || ''} ${result.address || ''}`
      const textScore = getFuzzyScore(candidateText, query)
      const proximityBonus = hasCoords ? Math.max(0, 60 - haversineDistanceKm(center, [lat, lon]) / 20) : 0
      const moroccoBonus = /morocco|maroc|rabat|casablanca|marrakech|tanger|fes|agadir|meknes|oujda|tetouan|kenitra|sale|temara|taza|khouribga|settat|berrechid|el jadida|safi|laayoune|dakhla/i.test(candidateText) ? 220 : 0
      return { ...result, score: textScore + proximityBonus + moroccoBonus }
    })
    .sort((a, b) => b.score - a.score)
}

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MOROCCO_CENTER = [31.7917, -7.0926]
const MOROCCO_BBOX = '-17.0,21.0,-1.0,36.0'

function buildSearchQueries(query) {
  const baseQuery = String(query || '').trim()
  if (!baseQuery) return []

  const variants = new Set([baseQuery, `${baseQuery} morocco`, `${baseQuery} maroc`, `${baseQuery} in morocco`, `${baseQuery} in maroc`])

  if (/cafe|coffee|hotel|restaurant|bar|bakery|university|school|hospital|pharmacy|supermarket|bank|gym|museum|park/i.test(baseQuery)) {
    variants.add(`${baseQuery} morocco`)
    variants.add(`${baseQuery} rabat`)
    variants.add(`${baseQuery} casablanca`)
    variants.add(`${baseQuery} marrakech`)
  }

  return Array.from(variants).filter(Boolean)
}

function parseGeoapifyResults(payload, fallbackQuery) {
  if (!Array.isArray(payload?.features)) return []

  return payload.features.map((feature) => {
    const props = feature.properties || {}
    const coords = feature.geometry?.coordinates || []
    const [lon, lat] = coords
    return {
      lat,
      lon,
      name: props.name || props.city || props.address_line1 || props.formatted,
      display_name: props.formatted || props.address_line1 || props.name || fallbackQuery,
      place_id: props.place_id || `${lat}-${lon}`,
      source: 'geoapify',
    }
  })
}

function parseMapboxResults(payload, fallbackQuery) {
  if (!Array.isArray(payload?.features)) return []

  return payload.features.map((feature) => {
    const [lon, lat] = feature.geometry?.coordinates || []
    return {
      lat,
      lon,
      name: feature.text || feature.place_name?.split(',')[0] || fallbackQuery,
      display_name: feature.place_name || fallbackQuery,
      place_id: feature.id || `${lat}-${lon}`,
      source: 'mapbox',
    }
  })
}

function dedupeResults(results) {
  const seen = new Set()
  return results.filter((result) => {
    const key = `${result.lat ?? 'na'}:${result.lon ?? 'na'}:${result.display_name ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function MapController({ center }) {
  const map = useMap()

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, 14)
    }
  }, [center, map])

  return null
}

export default function Places() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { data, isLoading, isError, refetch } = usePlaces()
  const create = useCreatePlace()
  const update = useUpdatePlace()
  const del = useDeletePlace()

  const places = useMemo(() => (Array.isArray(data) ? data : []), [data])
  const unvisited = places.filter((p) => !p.is_visited)
  const visited = places.filter((p) => p.is_visited)

  useEffect(() => {
    if (selectedLocation) return
    const fallback = places.find((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
    if (fallback) {
      setSelectedLocation([Number(fallback.latitude), Number(fallback.longitude)])
    }
  }, [places, selectedLocation])

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      void runSearch(searchQuery, { limit: 6 })
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const mapCenter = useMemo(() => {
    if (selectedLocation) return selectedLocation
    const fallback = places.find((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
    if (fallback) return [Number(fallback.latitude), Number(fallback.longitude)]
    return MOROCCO_CENTER
  }, [places, selectedLocation])

  const onCreate = async () => {
    if (!name) return
    const payload = {
      name,
      address: address || null,
      category: category || null,
    }
    if (selectedLocation) {
      payload.latitude = selectedLocation[0]
      payload.longitude = selectedLocation[1]
    }
    await create.mutateAsync(payload)
    setName('')
    setAddress('')
    setCategory('')
    setSelectedLocation(null)
    setShowForm(false)
    toast.success('Place added')
  }

  const toggleVisited = (place) => update.mutate({ id: place.id, is_visited: !place.is_visited })

  const runSearch = async (query, options = {}) => {
    if (!query.trim()) return

    setSearching(true)
    try {
      const geoapifyParams = new URLSearchParams({
        text: query,
        limit: String(options.limit || 8),
        apiKey: GEOAPIFY_KEY,
      })
      const [lat, lon] = Array.isArray(mapCenter) && mapCenter.length === 2 ? mapCenter : MOROCCO_CENTER
      const searchTerms = buildSearchQueries(query)

      const mapboxResponses = await Promise.allSettled(
        searchTerms.map((term) => {
          const params = new URLSearchParams({
            access_token: MAPBOX_TOKEN,
            types: 'poi,place,address,locality,neighborhood,postcode,region,country',
            limit: String(options.limit || 8),
            language: 'en',
            country: 'ma',
            proximity: `${lon},${lat}`,
            bbox: MOROCCO_BBOX,
          })
          return fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json?${params.toString()}`, {
            headers: { Accept: 'application/json' },
          })
        }),
      )

      const [geoapifyResponse] = await Promise.allSettled([
        fetch(`https://api.geoapify.com/v1/geocode/search?${geoapifyParams.toString()}`, {
          headers: { Accept: 'application/json' },
        }),
      ])

      const geoapifyPayload = geoapifyResponse.status === 'fulfilled' ? await geoapifyResponse.value.json() : null
      const mapboxResults = dedupeResults(
        mapboxResponses.flatMap((response) => {
          if (response.status !== 'fulfilled') return []
          return parseMapboxResults(response.value ? { features: [] } : { features: [] }, query)
        }),
      )
      const combinedResults = dedupeResults([
        ...parseGeoapifyResults(geoapifyPayload, query),
        ...mapboxResults,
      ])
      const ranked = rankSearchResults(combinedResults, query, selectedLocation || mapCenter)
      const fallbackResults = ranked.length > 0
        ? ranked
        : [{ display_name: 'No exact match found. Try a broader place name or address, or add Morocco to the search.' }]
      setSearchResults(fallbackResults)

      if (options.autoSelect && ranked[0]) {
        const first = ranked[0]
        if (first.lat && first.lon) {
          setSelectedLocation([Number(first.lat), Number(first.lon)])
          setName(first.name || first.display_name.split(',')[0])
          setAddress(first.display_name)
          setShowForm(true)
        }
      }
    } catch {
      toast.error('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const onSearch = async (event) => {
    event.preventDefault()
    await runSearch(searchQuery, { limit: 8, autoSelect: true })
  }

  const chooseResult = (result) => {
    setSelectedLocation([Number(result.lat), Number(result.lon)])
    setName(result.name || result.display_name.split(',')[0])
    setAddress(result.display_name)
    setShowForm(true)
    setSearchQuery(result.display_name)
    setSearchResults([])
  }

  const focusPlace = (place) => {
    if (Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))) {
      setSelectedLocation([Number(place.latitude), Number(place.longitude)])
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Places"
        description="Discover and save locations with map search and geofencing."
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            <Plus size={16} /> {showForm ? 'Close' : 'New place'}
          </button>
        }
      />

      <div className="surface-elevated p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Compass size={16} className="text-primary-600" />
          <span>Geoapify map + Mapbox search for stronger place discovery</span>
        </div>
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input pl-9" placeholder="Search an address or place" />
          </div>
          <button type="submit" disabled={searching} className="btn btn-primary disabled:opacity-50">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-1 rounded-lg border border-gray-200 p-2">
            {searchResults.map((result, index) => {
              const isFallback = !result.lat || !result.lon
              return (
                <button key={result.place_id || `${result.display_name}-${index}`} type="button" onClick={() => chooseResult(result)} disabled={isFallback} className={`flex w-full items-start justify-between rounded-md px-2 py-2 text-left text-sm ${isFallback ? 'cursor-default text-gray-400' : 'hover:bg-gray-50'}`}>
                  <span>{result.display_name}</span>
                  {!isFallback && <span className="text-xs text-gray-400">Use</span>}
                </button>
              )
            })}
          </div>
        )}

        <div className="space-y-2">
          <div className="h-72 overflow-hidden rounded-lg border border-gray-200">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='Powered by Geoapify'
                url={`https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`}
              />
              <MapController center={mapCenter} />
              {selectedLocation && (
                <CircleMarker center={selectedLocation} radius={8} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} />
              )}
              {places.filter((place) => Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))).map((place) => (
                <CircleMarker
                  key={place.id}
                  center={[Number(place.latitude), Number(place.longitude)]}
                  radius={6}
                  pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.8 }}
                />
              ))}
            </MapContainer>
          </div>
          <a href={`https://www.geoapify.com/map?lat=${mapCenter[0]}&lon=${mapCenter[1]}&zoom=14`} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">
            Open in Geoapify
          </a>
        </div>
      </div>

      {showForm && (
        <div className="surface-elevated rounded-2xl p-4 space-y-3 animate-fade-up">
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name" onKeyDown={(e) => e.key === 'Enter' && onCreate()} />
          <div className="flex flex-col gap-3 md:flex-row">
            <input className="input flex-1" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" />
            <input className="input flex-1" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)" />
            <button onClick={onCreate} disabled={create.isPending || !name} className="btn btn-primary px-4">Add</button>
          </div>
          {selectedLocation && (
            <div className="text-xs text-slate-400">Coordinates: {selectedLocation[0].toFixed(4)}, {selectedLocation[1].toFixed(4)}</div>
          )}
        </div>
      )}

      {isError ? (
        <ErrorState title="Could not load places" onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState message="Loading places..." />
      ) : places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No places yet"
          description="Search for a place to save it to your map."
          action={<button onClick={() => setShowForm(true)} className="btn btn-primary text-sm"><Plus size={14} /> Add place</button>}
        />
      ) : (
        <>
          {unvisited.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">To Visit</h3>
              <div className="space-y-2">
                {unvisited.map((p) => <PlaceCard key={p.id} place={p} onToggle={toggleVisited} onDelete={(id) => setConfirmDeleteId(id)} onFocus={focusPlace} />)}
              </div>
            </div>
          )}
          {visited.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Visited</h3>
              <div className="space-y-2 opacity-60">
                {visited.map((p) => <PlaceCard key={p.id} place={p} onToggle={toggleVisited} onDelete={(id) => setConfirmDeleteId(id)} onFocus={focusPlace} />)}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete this place?"
        description="This will permanently remove the place. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) del.mutate(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}

function PlaceCard({ place: p, onToggle, onDelete, onFocus }) {
  return (
    <div className="surface surface-interactive rounded-2xl p-4 flex items-start gap-4 group">
      <button onClick={() => onFocus(p)} className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${p.is_visited ? 'bg-green-50 text-green-600' : 'bg-primary-50 text-primary-600'}`}>
        <MapPin size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-800">{p.name}</div>
        {p.address && <div className="text-sm text-slate-500 mt-0.5">{p.address}</div>}
        <div className="flex items-center gap-2 mt-1.5">
          {p.category && <span className="badge badge-muted">{p.category}</span>}
          {p.urgency && <span className="text-xs text-slate-400">Urgency {p.urgency}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!p.is_visited && (
          <button type="button" onClick={() => onToggle(p)} className="btn-icon hover:text-green-600" aria-label="Mark visited"><CheckCircle size={16} /></button>
        )}
        <button type="button" onClick={() => onDelete(p.id)} className="btn-icon hover:text-red-500" aria-label="Delete place"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

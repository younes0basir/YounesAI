import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Reminders from './pages/Reminders'
import Events from './pages/Events'
import Places from './pages/Places'
import Files from './pages/Files'
import Notifications from './pages/Notifications'
import Search from './pages/Search'
import Projects from './pages/Projects'
import Login from './pages/Login'
import Register from './pages/Register'
import Agents from './pages/Agents'
import Voice from './pages/Voice'
import Chat from './pages/Chat'
import ImageGenerator from './pages/ImageGenerator'
import Inbox from './pages/Inbox'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="events" element={<Events />} />
          <Route path="places" element={<Places />} />
          <Route path="files" element={<Files />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="search" element={<Search />} />
          <Route path="projects" element={<Projects />} />
          <Route path="agents" element={<Agents />} />
          <Route path="voice" element={<Voice />} />
          <Route path="chat" element={<Chat />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="image-generator" element={<ImageGenerator />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/auth">
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AdminIncidentDetailPage from './pages/AdminIncidentDetailPage'
import AdminIncidentsPage from './pages/AdminIncidentsPage'
import AdminAuditPage from './pages/AdminAuditPage'
import PublicIncidentPage from './pages/PublicIncidentPage'
import PublicStatusPage from './pages/PublicStatusPage'
import { ToastProvider } from './components/ToastProvider'
import { ThemeProvider } from './components/ThemeProvider'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/status" replace />} />
            <Route path="/admin/incidents" element={<AdminIncidentsPage />} />
            <Route path="/admin/incidents/:id" element={<AdminIncidentDetailPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route path="/status" element={<PublicStatusPage />} />
            <Route path="/status/incidents/:id" element={<PublicIncidentPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App

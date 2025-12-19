import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AdminIncidentDetailPage from './pages/AdminIncidentDetailPage'
import AdminIncidentsPage from './pages/AdminIncidentsPage'
import AdminAuditPage from './pages/AdminAuditPage'
import AdminMetricsPage from './pages/AdminMetricsPage'
import PublicIncidentPage from './pages/PublicIncidentPage'
import PublicStatusPage from './pages/PublicStatusPage'
import PublicHistoryPage from './pages/PublicHistoryPage'
import SplashPage from './pages/SplashPage'
import { ToastProvider } from './components/ToastProvider'
import { ThemeProvider } from './components/ThemeProvider'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/admin/incidents" element={<AdminIncidentsPage />} />
            <Route path="/admin/incidents/:id" element={<AdminIncidentDetailPage />} />
            <Route path="/admin/metrics" element={<AdminMetricsPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route path="/status" element={<PublicStatusPage />} />
            <Route path="/status/history" element={<PublicHistoryPage />} />
            <Route path="/status/incidents/:id" element={<PublicIncidentPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App

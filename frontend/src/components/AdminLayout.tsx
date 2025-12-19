import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useTheme } from './ThemeProvider'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  onSearch?: (value: string) => void
  searchValue?: string
  searchPlaceholder?: string
}

const AdminLayout = ({
  children,
  title = 'Incident Console',
  subtitle,
  actions,
  onSearch,
  searchValue = '',
  searchPlaceholder = 'Search incidents…',
}: AdminLayoutProps) => {
  const { theme, setTheme } = useTheme()
  const getClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link'
  const renderIcon = (type: 'sun' | 'moon') => (
    <span className={`theme-icon theme-icon-${type}`} aria-hidden="true">
      {type === 'sun' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </span>
  )
  const renderThemeTab = (value: 'light' | 'dark', label: string, icon: 'sun' | 'moon') => (
    <button
      type="button"
      className={theme === value ? 'theme-tab active' : 'theme-tab'}
      onClick={() => setTheme(value)}
      role="tab"
      aria-selected={theme === value}
    >
      {renderIcon(icon)}
      <span className="sr-only">{label}</span>
    </button>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Admin">
        <div className="sidebar-brand">
          <div className="sidebar-logo" aria-hidden="true">
            IM
          </div>
          <div>
            <p className="sidebar-title">Incident HQ</p>
            <small>Command Center</small>
          </div>
        </div>
        <nav aria-label="Primary">
          <NavLink to="/admin/incidents" className={getClass}>
            Incidents
          </NavLink>
          <NavLink to="/admin/metrics" className={getClass}>
            Metrics
          </NavLink>
          <NavLink to="/admin/audit" className={getClass}>
            Audit Log
          </NavLink>
        </nav>
        <div className="theme-toggle-tabs" role="tablist" aria-label="Color theme">
          {renderThemeTab('light', 'Switch to light mode', 'sun')}
          {renderThemeTab('dark', 'Switch to dark mode', 'moon')}
        </div>
      </aside>
      <div className="layout-main">
        <header className="top-bar" role="banner">
          <div className="top-bar-copy">
            <p className="eyebrow">Operations</p>
            <h1>{title}</h1>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
          <div className="top-bar-tools">
            {onSearch && (
              <div className="search" role="search">
                <label className="sr-only" htmlFor="admin-search">
                  Search incidents
                </label>
                <input
                  id="admin-search"
                  type="search"
                  value={searchValue}
                  placeholder={searchPlaceholder}
                  onChange={(event) => onSearch(event.target.value)}
                />
              </div>
            )}
            {actions}
          </div>
        </header>
        <main role="main">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout

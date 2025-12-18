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
  const { theme, toggleTheme } = useTheme()
  const getClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link'

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
          <NavLink to="/admin/audit" className={getClass}>
            Audit Log
          </NavLink>
        </nav>
        <button className="ghost-button theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
        </button>
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

import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useTheme } from './ThemeProvider'

interface PublicLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  footerContent?: ReactNode
}

const PublicLayout = ({
  children,
  title = 'Status & Trust Center',
  description = 'Live transparency for customers and stakeholders.',
  footerContent,
}: PublicLayoutProps) => {
  const getClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link'
  const { theme, setTheme } = useTheme()
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

  const defaultFooter = (
    <>
      <p>Need help? Email support@example.com or follow @incident-hq for updates.</p>
      <small>© {new Date().getFullYear()} Incident Management Platform</small>
    </>
  )

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Customer Trust</p>
          <h1>{title}</h1>
          <p className="subtitle">{description}</p>
        </div>
        <div className="public-hero-meta">
          <nav aria-label="Public navigation">
            <NavLink to="/status" className={getClass} end>
              Status
            </NavLink>
            <NavLink to="/status/history" className={getClass}>
              History
            </NavLink>
          </nav>
          <div className="theme-toggle-tabs" role="tablist" aria-label="Color theme">
            {renderThemeTab('light', 'Switch to light mode', 'sun')}
            {renderThemeTab('dark', 'Switch to dark mode', 'moon')}
          </div>
        </div>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">{footerContent ?? defaultFooter}</footer>
    </div>
  )
}

export default PublicLayout

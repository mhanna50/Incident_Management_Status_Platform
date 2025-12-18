import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useTheme } from './ThemeProvider'

interface PublicLayoutProps {
  children: ReactNode
  title?: string
  description?: string
}

const PublicLayout = ({
  children,
  title = 'Status & Trust Center',
  description = 'Live transparency for customers and stakeholders.',
}: PublicLayoutProps) => {
  const getClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link'
  const { theme, toggleTheme } = useTheme()

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
            <NavLink to="/status" className={getClass}>
              Status
            </NavLink>
            <span className="nav-link disabled" aria-disabled="true">
              History (soon)
            </span>
          </nav>
          <button className="ghost-button" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>
      <main className="public-main">{children}</main>
    </div>
  )
}

export default PublicLayout

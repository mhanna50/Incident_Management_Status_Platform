import { createPortal } from 'react-dom'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

const Modal = ({ open, title, onClose, children }: ModalProps) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  const canUseDom = typeof document !== 'undefined'
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!canUseDom) return
    const target = document.getElementById('modal-root')
    setPortalElement(target)
  }, [canUseDom])

  useEffect(() => {
    if (!canUseDom) return
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open, canUseDom])

  useEffect(() => {
    if (!open || !canUseDom) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const firstInput = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstInput?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, canUseDom])

  const handleClose = () => {
    onCloseRef.current?.()
  }

  if (!open || !portalElement) {
    return null
  }

  const modalTree = (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleClose}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="document"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="ghost-button" onClick={handleClose} aria-label="Close modal">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )

  return createPortal(modalTree, portalElement)
}

export default Modal

import React, { type ReactNode, type ReactElement } from 'react'

export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose?: () => void
  title?: string
  closeLabel?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}): ReactElement | null {
  if (!open) return null
  return (
    <dialog
      open
      className={`dsh-modal-mock btw-selection-dialog ${className ?? ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="dsh-modal-header">
        <h2>{title}</h2>
        <button type="button" aria-label={closeLabel} onClick={onClose}>×</button>
      </div>
      <div className="dsh-modal-body">{children}</div>
      {footer && <div className="dsh-modal-footer">{footer}</div>}
    </dialog>
  )
}

export function Button({
  variant,
  disabled,
  onClick,
  children,
  className,
  type = 'button',
}: {
  variant?: string
  disabled?: boolean
  onClick?: () => void
  children?: ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}): ReactElement {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`dsh-button-mock ${variant ?? ''} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "./Button"
import { Input } from "./Input"

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  confirmValue?: string // If set, user must type this to confirm
  confirmPlaceholder?: string
  variant?: "danger" | "warning"
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmer",
  confirmValue,
  confirmPlaceholder = "Tapez pour confirmer",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const canConfirm = !confirmValue || inputValue === confirmValue

  // Reset input when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputValue("")
      // Focus input after a short delay for animation
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, loading, onClose])

  // Handle click outside
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }

  async function handleConfirm() {
    if (!canConfirm || loading) return
    await onConfirm()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                variant === "danger" ? "bg-red-50 border-2 border-icc-rouge/20" : "bg-amber-50 border-2 border-amber-200"
              }`}
            >
              <svg
                className={`w-6 h-6 ${
                  variant === "danger" ? "text-icc-rouge" : "text-amber-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2
                id="modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
              <p className="text-sm text-gray-700 mt-1">{message}</p>
            </div>
          </div>
        </div>

        {/* Confirmation input */}
        {confirmValue && (
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Tapez <span className="font-mono bg-icc-violet-light text-icc-violet px-2 py-0.5 rounded">{confirmValue}</span> pour confirmer
            </label>
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmPlaceholder}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) {
                  handleConfirm()
                }
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 bg-icc-violet-light/30 flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}

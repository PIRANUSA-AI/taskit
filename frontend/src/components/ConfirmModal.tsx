import { motion, AnimatePresence } from 'framer-motion'
import { WarningCircle, X } from '@phosphor-icons/react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Ya', cancelLabel = 'Batal', danger, onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
          >
            <div className="flex items-start gap-4">
              <div className={`grid place-items-center w-10 h-10 rounded-full flex-shrink-0 ${danger ? 'bg-red-100 text-red-600' : 'bg-navy/10 text-navy'}`}>
                <WarningCircle size={20} weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-[15px]">{title}</p>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">{message}</p>
              </div>
              <button onClick={onCancel} className="grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100 flex-shrink-0">
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={onCancel} className="btn-ghost !text-xs !py-2 !px-4">
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`!text-xs !py-2 !px-4 rounded-full font-semibold text-white transition-colors ${
                  danger ? 'bg-red-600 hover:bg-red-700' : 'bg-navy hover:bg-navy-soft'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUiStore, type ToastTone } from '../store/useUiStore'

const TONE_ICON: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}

export function ToastViewport() {
  const { toasts, dismissToast } = useUiStore()
  if (!toasts.length) return null

  return (
    <div className="toast-viewport" role="region" aria-label="系统通知">
      {toasts.map((toast) => {
        const Icon = TONE_ICON[toast.tone]
        return (
          <div key={toast.id} className={`toast-card tone-${toast.tone}`} role="status">
            <span className="toast-icon">
              <Icon size={17} />
            </span>
            <div className="toast-body">
              <strong>{toast.title}</strong>
              {toast.message && <small>{toast.message}</small>}
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="关闭提示"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

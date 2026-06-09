import Modal from './Modal.jsx'

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = '确认',
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-primary project-delete-confirm' : 'btn-primary'}`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? '处理中…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  )
}

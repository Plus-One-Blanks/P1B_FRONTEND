import {createPortal} from 'react-dom';
import {FolderOpen, Upload, X} from 'lucide-react';

/**
 * @param {{
 *   open: boolean;
 *   elevated?: boolean;
 *   onClose: () => void;
 *   onBrowse: () => void;
 *   onDropFiles: (files: FileList | File[]) => void;
 * }} props
 */
export function AddImagesModal({
  open,
  elevated = false,
  onClose,
  onBrowse,
  onDropFiles,
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`dtf-modal-root${elevated ? ' dtf-modal-root--elevated' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dtf-add-images-title"
      onClick={onClose}
    >
      <div
        className="dtf-modal dtf-modal--add"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dtf-modal-header">
          <h2 id="dtf-add-images-title">Add Images</h2>
          <button
            type="button"
            className="dtf-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </header>

        <div className="dtf-modal-tabs" role="tablist" aria-label="Image source">
          <button type="button" className="is-active" role="tab" aria-selected>
            <Upload size={14} strokeWidth={2.25} />
            Upload
          </button>
          <button type="button" role="tab" disabled title="Coming soon">
            Templates
          </button>
        </div>

        <div
          className="dtf-modal-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('is-dragover');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('is-dragover');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('is-dragover');
            if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files);
          }}
        >
          <div className="dtf-modal-dropzone-icon" aria-hidden>
            <Upload size={28} strokeWidth={2} />
          </div>
          <p className="dtf-modal-dropzone-title">Drag &amp; drop images here</p>
          <p className="dtf-modal-dropzone-or">or</p>
          <button
            type="button"
            className="dtf-modal-primary"
            onClick={onBrowse}
          >
            <FolderOpen size={16} strokeWidth={2.25} />
            Browse Files
          </button>
          <p className="dtf-modal-dropzone-hint">
            PNG, JPG, WEBP · transparent PNG recommended
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

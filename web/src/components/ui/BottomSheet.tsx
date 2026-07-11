import React, { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

type SheetState = 'closed' | 'peek' | 'expanded';

interface BottomSheetProps {
  isOpen: boolean;
  state?: SheetState;
  onClose: () => void;
  onStateChange?: (state: SheetState) => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * iOS-style slide-up bottom sheet.
 * Renders via React Portal into document.body at z-index: 10000.
 * Supports three snap states: closed | peek (40vh) | expanded (85vh).
 * Drag handle allows drag-to-dismiss.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  state = 'peek',
  onClose,
  onStateChange,
  title,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = delta;
    if (delta > 0 && panelRef.current) {
      panelRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (panelRef.current) {
      panelRef.current.style.transition = '';
      panelRef.current.style.transform = '';
    }
    const dismissThreshold = 80;
    if (dragCurrentY.current > dismissThreshold) {
      if (state === 'expanded' && onStateChange) {
        onStateChange('peek');
      } else {
        onClose();
      }
    } else if (dragCurrentY.current < -dismissThreshold) {
      if (state === 'peek' && onStateChange) {
        onStateChange('expanded');
      }
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [state, onClose, onStateChange]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="bottom-sheet-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`bottom-sheet-panel ${isOpen ? state : 'closed'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Bottom sheet'}
      >
        {/* Drag Handle */}
        <div
          className="bottom-sheet-handle-bar"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Optional title */}
        {title && (
          <div style={{
            padding: '0 16px 12px',
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-main)',
            fontFamily: 'Inter, sans-serif',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '4px',
          }}>
            {title}
          </div>
        )}

        {/* Scrollable content */}
        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
};

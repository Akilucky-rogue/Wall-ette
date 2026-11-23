import React from 'react';
import type { ReleaseNote } from '../services/releaseNotes';

interface WhatsNewSheetProps {
  notes: ReleaseNote[];
  onClose: () => void;
}

/** Bottom sheet listing release notes, newest first (services/releaseNotes.ts). */
const WhatsNewSheet: React.FC<WhatsNewSheetProps> = ({ notes, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
            <span className="material-symbols-outlined text-sage text-[22px]">auto_awesome</span>
          </div>
          <h3 id="whats-new-title" className="text-lg font-serif font-semibold text-premium-charcoal">What's new</h3>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-label="Close">
          <span className="material-symbols-outlined text-muted-taupe">close</span>
        </button>
      </div>

      <div className="space-y-5">
        {notes.map(note => (
          <section key={note.versionCode}>
            <p className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-2.5">Version {note.version}</p>
            <ul className="space-y-2.5">
              {note.items.map(item => (
                <li key={item} className="flex gap-3 text-[13px] text-premium-charcoal leading-relaxed">
                  <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-sage shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <button
        onClick={onClose}
        className="mt-7 w-full bg-sage text-white py-3.5 rounded-2xl font-serif font-medium shadow-soft active:scale-[0.98] transition-all"
      >
        Got it
      </button>
    </div>
  </div>
);

export default WhatsNewSheet;

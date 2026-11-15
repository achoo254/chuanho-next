/**
 * The shared frame of every HTML panel (journal, gentle words, radio, room, fortune): the mode bar with the way back
 * at the bottom, and one glass card over the 3D yard with a title, a scrolling body and an optional footer of
 * actions. A new feature screen only fills the body; the look, the focus order and the phone layout stay the same.
 */
import type { ReactNode } from 'react';
import { ModeBar } from '../modes/mode-chrome';
import './panel.css';

interface PanelFrameProps {
  readonly title: string;
  readonly onBack: () => void;
  /** Extra chips or buttons next to the back button in the bottom bar. */
  readonly bar?: ReactNode;
  readonly dataId: string;
  /** Buttons pinned under the scrolling body. */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export function PanelFrame({ title, onBack, bar, dataId, footer, children }: PanelFrameProps): ReactNode {
  return (
    <>
      <ModeBar onBack={onBack}>{bar}</ModeBar>
      <section className="panel-card" aria-labelledby={`${dataId}-title`} data-id={dataId}>
        <h2 className="panel-title" id={`${dataId}-title`}>
          {title}
        </h2>
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-footer">{footer}</div>}
      </section>
    </>
  );
}

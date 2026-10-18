import type { ReactNode } from 'react';
import './NoticeScreen.css';

export interface NoticeScreenProps {
  title: string;
  line: string;
  /** A building picture from /icons, for the card. */
  picture: string;
  children?: ReactNode;
}

/** A calm full-screen card with one heading and one line, for states with nothing to play yet (style A). */
export function NoticeScreen({ title, line, picture, children }: NoticeScreenProps) {
  return (
    <main className="notice-screen">
      <section className="notice-card">
        <img className="notice-picture" src={picture} alt="" width="256" height="256" />
        <h1 className="notice-title">{title}</h1>
        <p className="notice-line">{line}</p>
        {children}
      </section>
    </main>
  );
}

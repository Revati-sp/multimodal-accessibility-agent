import { useEffect, useRef, type ReactNode } from 'react';

interface ErrorNoticeProps {
  title: string;
  message: string;
  id?: string;
  /** Move focus here when shown (use for errors that block the user's next step). */
  focusOnMount?: boolean;
  children?: ReactNode;
}

export function ErrorNotice({ title, message, id, focusOnMount = false, children }: ErrorNoticeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount, title, message]);
  return (
    <div className="notice notice-error" role="alert" id={id} ref={ref} tabIndex={-1}>
      <p className="notice-title">
        <span aria-hidden="true">✕ </span>
        {title}
      </p>
      <p>{message}</p>
      {children}
    </div>
  );
}

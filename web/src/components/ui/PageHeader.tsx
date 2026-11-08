import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './IconButton';
export function PageHeader({
  title,
  back,
  trailing,
  inline = false,
}: {
  title: string;
  back?: string | true;
  trailing?: ReactNode;
  inline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (inline) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 60),
      {
        rootMargin: '-60px 0px 0px 0px',
      },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inline]);
  if (inline)
    return (
      <div className="ui-page-nav ui-page-nav-inline">
        <h1 className="text-title1">{title}</h1>
        <div>{trailing}</div>
      </div>
    );
  return (
    <>
      <div className={`ui-page-nav ${collapsed ? 'ui-page-nav-collapsed' : ''}`}>
        <span>
          {back === true ? (
            <IconButton aria-label="Back" onClick={() => navigate(-1)}>
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          ) : back ? (
            <Link className="ui-icon-button" to={back} aria-label="Back">
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : null}
        </span>
        <span
          className="ui-page-compact text-headline"
          style={{ opacity: collapsed ? 1 : 0 }}
          aria-hidden="true"
        >
          {title}
        </span>
        <span>{trailing}</span>
      </div>
      <h1 className="ui-large-title text-large-title">{title}</h1>
      <div ref={ref} className="ui-header-sentinel" aria-hidden="true" />
    </>
  );
}

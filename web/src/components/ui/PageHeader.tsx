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
  const actions = useRef<HTMLSpanElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [actionsWidth, setActionsWidth] = useState(0);
  const root = !back && !inline;
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
  // Top-level screens share one row between the large title and the header actions, so the
  // title keeps clear of however many actions the screen shows.
  useEffect(() => {
    const node = actions.current;
    if (!root || !node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setActionsWidth(node.offsetWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);
  if (inline)
    return (
      <div className="ui-page-nav ui-page-nav-inline">
        <h1 className="text-title1">{title}</h1>
        <div>{trailing}</div>
      </div>
    );
  return (
    <>
      <div
        className={`ui-page-nav ${root ? 'ui-page-nav-root' : ''} ${collapsed ? 'ui-page-nav-collapsed' : ''}`}
      >
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
        <span ref={actions}>{trailing}</span>
      </div>
      <h1
        className={`ui-large-title text-large-title ${root ? 'ui-large-title-root' : ''}`}
        style={root && actionsWidth ? { paddingRight: actionsWidth + 28 } : undefined}
      >
        {title}
      </h1>
      <div ref={ref} className="ui-header-sentinel" aria-hidden="true" />
    </>
  );
}

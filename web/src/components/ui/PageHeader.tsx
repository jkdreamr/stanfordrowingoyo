import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './IconButton';
export function PageHeader({
  title,
  back,
  trailing,
}: {
  title: string;
  back?: string | true;
  trailing?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: '-60px 0px 0px 0px',
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div className={`ui-page-nav ${collapsed ? 'ui-page-nav-collapsed' : ''}`}>
        <span>
          {back === true ? (
            <IconButton aria-label="Back" onClick={() => navigate(-1)}>
              <ChevronLeft size={20} strokeWidth={1.75} />
            </IconButton>
          ) : back ? (
            <Link className="ui-icon-button" to={back} aria-label="Back">
              <ChevronLeft size={20} strokeWidth={1.75} />
            </Link>
          ) : null}
        </span>
        <span className="text-headline" aria-hidden="true">
          {collapsed ? title : ''}
        </span>
        <span>{trailing}</span>
      </div>
      <h1 ref={ref} className="ui-large-title text-large-title">
        {title}
      </h1>
    </>
  );
}

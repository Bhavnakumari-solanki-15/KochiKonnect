import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { GoArrowUpRight } from 'react-icons/go';
import './CardNav.css';

type NavItem = {
  label: string;
  bgColor: string;
  textColor: string;
  links?: { label: string; ariaLabel?: string; href?: string }[];
  href?: string; // optional: navigate when clicking the whole card
};

interface Props {
  logo: string;
  logoAlt?: string;
  items: NavItem[];
  className?: string;
  ease?: string;
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  ctaHref?: string;
  ctaLabel?: string;
}

const CardNav = ({
  logo,
  logoAlt = 'Logo',
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#fff',
  menuColor,
  buttonBgColor = '#111',
  buttonTextColor = '#fff',
  ctaHref,
  ctaLabel,
}: Props) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const navigate = useNavigate();
  const animatingRef = useRef<boolean>(false);
  const expandedHeightRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current as HTMLDivElement | null;
    if (!navEl) return 260;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content') as HTMLDivElement | null;
      if (contentEl) {
        const was = {
          visibility: contentEl.style.visibility,
          pointerEvents: contentEl.style.pointerEvents,
          position: contentEl.style.position,
          height: contentEl.style.height,
        };
        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';
        contentEl.offsetHeight; // force reflow
        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;
        contentEl.style.visibility = was.visibility;
        contentEl.style.pointerEvents = was.pointerEvents;
        contentEl.style.position = was.position;
        contentEl.style.height = was.height;
        return topBar + contentHeight + padding;
      }
    }
    return 260;
  };

  useLayoutEffect(() => {
    const navEl = navRef.current;
    if (navEl) gsap.set(navEl, { height: 60, overflow: 'hidden' });
  }, []);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        expandedHeightRef.current = null; // recalc on next open
        if (isExpanded) {
          const h = calculateHeight();
          expandedHeightRef.current = h;
          gsap.set(navRef.current, { height: h });
        }
      }, 120);
    };
    window.addEventListener('resize', handleResize, { passive: true } as any);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  const toggleMenu = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      const h = expandedHeightRef.current ?? calculateHeight();
      expandedHeightRef.current = h;
      gsap.to(navRef.current, { height: h, duration: 0.3, ease, onComplete: () => {
        setIsExpanded(true);
        // fade-in cards quickly for a snappy feel
        try { gsap.fromTo(cardsRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, stagger: 0.05, ease }); } catch {}
        animatingRef.current = false;
      }});
    } else {
      setIsHamburgerOpen(false);
      gsap.to(navRef.current, { height: 60, duration: 0.25, ease, onComplete: () => {
        setIsExpanded(false);
        animatingRef.current = false;
      }});
    }
  };

  // Close menu helper (used when navigating)
  const closeMenu = () => {
    if (!isExpanded || animatingRef.current) return;
    animatingRef.current = true;
    setIsHamburgerOpen(false);
    gsap.to(navRef.current, { height: 60, duration: 0.2, ease, onComplete: () => {
      setIsExpanded(false);
      animatingRef.current = false;
    }});
  };

  // Close automatically on route change
  const location = useLocation();
  useEffect(() => {
    closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav ref={navRef} className={`card-nav ${isExpanded ? 'open' : ''}`} style={{ backgroundColor: baseColor }}>
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            tabIndex={0}
            style={{ color: menuColor || '#000' }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div
            className="logo-container"
            role="link"
            aria-label="Go to home"
            tabIndex={0}
            onClick={() => { navigate('/'); closeMenu(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/'); closeMenu(); } }}
          >
            <img src={logo} alt={logoAlt} className="logo" />
            <span className="logo-text">KochiKonnect</span>
          </div>

          <button
            type="button"
            className="card-nav-cta-button"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            onClick={() => { if (ctaHref) { navigate(ctaHref); } closeMenu(); }}
          >
            {ctaLabel || 'Get Started'}
          </button>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor, cursor: item.href ? 'pointer' : 'default' }}
              onClick={() => {
                if (item.href) {
                  if (item.href.startsWith('http')) {
                    window.open(item.href, '_blank');
                    closeMenu();
                  } else {
                    navigate(item.href);
                    closeMenu();
                  }
                }
              }}
            >
              <div className="nav-card-label">{item.label}</div>
              {item.links && item.links.length > 0 && (
                <div className="nav-card-links">
                  {item.links?.map((lnk, i) => (
                    <a key={`${lnk.label}-${i}`} className="nav-card-link" href={lnk.href} aria-label={lnk.ariaLabel}>
                      <GoArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
                      {lnk.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { fetchPublishedVideos, fetchAppSettings, VideoRecord } from './lib/db.ts';
import { getPaymentUrlForPrice } from './lib/paymentLinks.ts';

const DEFAULT_TELEGRAM_URL = 'https://t.me/Acess_OMEGLE2';
const ITEMS_PER_PAGE = 20;

// Gradient cover presets for videos without a thumbnail
const COVER_PRESETS = [
  'cover-studio',
  'cover-travel',
  'cover-design',
];

// Randomize / shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to safely access sessionStorage without crashing in restricted iframes
function getSafeSessionStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch (err) {
    console.warn('Storage read unavailable:', err);
  }
  return null;
}

function setSafeSessionStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn('Storage write unavailable:', err);
  }
}

interface PaidItemState {
  title: string;
  price: number;
  priceFormatted: string;
  paymentUrl: string;
}

export default function App() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [activePreviewVideo, setActivePreviewVideo] = useState<VideoRecord | null>(null);
  const [postPaymentItem, setPostPaymentItem] = useState<PaidItemState | null>(null);

  // Dynamic Telegram URL from database app_settings
  const [telegramUrl, setTelegramUrl] = useState<string>(DEFAULT_TELEGRAM_URL);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);

  // Age verification state
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState<boolean>(() => {
    return getSafeSessionStorage('studioVaultAgeVerified') !== 'yes';
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 3500);
  };

  // Fetch videos from Neon database
  const fetchVideos = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPublishedVideos();
      if (data && data.length > 0) {
        setVideos(shuffleArray(data));
      } else {
        setVideos([]);
      }
    } catch (err: any) {
      console.error('Error fetching videos from Neon:', err);
      setLoadError(err.message || 'Failed to load videos from database');
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch telegram_group_url dynamically from Neon app_settings
  const loadAppSettings = async () => {
    try {
      const data = await fetchAppSettings();
      if (data?.telegram_group_url && data.telegram_group_url.trim()) {
        setTelegramUrl(data.telegram_group_url.trim());
      }
    } catch (err) {
      console.warn('Could not fetch app_settings from Neon:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
    loadAppSettings();
  }, []);

  const handleAgeConfirm = () => {
    setSafeSessionStorage('studioVaultAgeVerified', 'yes');
    setShowAgeModal(false);
    setIsAccessDenied(false);
  };

  const handleAgeDecline = () => {
    setShowAgeModal(false);
    setIsAccessDenied(true);
    showToast('You must be 18 or older to enter this website.');
  };

  const toggleSearch = () => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  const toggleTheme = () => {
    document.body.classList.toggle('dark');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const openPreview = (video: VideoRecord) => {
    setActivePreviewVideo(video);
  };

  const closePreview = () => {
    setActivePreviewVideo(null);
  };

  /**
   * DIRECT PAYMENT FLOW:
   * 1. Clicks pay -> Opens TryWalled checkout page directly with zero extra steps.
   * 2. Sets postPaymentItem to show the user the Telegram receipt link to receive their video.
   */
  const handleDirectPayment = (title: string, rawPrice: number) => {
    const paymentUrl = getPaymentUrlForPrice(rawPrice);
    const priceFormatted = `$${Number(rawPrice).toFixed(2)}`;

    // Open checkout page directly in a new tab
    try {
      window.open(paymentUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Could not open tab automatically:', e);
    }

    // Set post payment state to display Telegram receipt confirmation instructions
    setPostPaymentItem({
      title,
      price: rawPrice,
      priceFormatted,
      paymentUrl,
    });

    showToast(`Opening checkout (${priceFormatted}). Send receipt on Telegram after paying!`);
  };

  const getTelegramReceiptLink = (item: PaidItemState) => {
    const msg = `Hello! I just completed the payment of ${item.priceFormatted} for "${item.title}". Here is my proof of payment:`;
    const separator = telegramUrl.includes('?') ? '&' : '?';
    return `${telegramUrl}${separator}text=${encodeURIComponent(msg)}`;
  };

  // Filtered videos based on search
  const filteredVideos = videos.filter((video) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const titleMatch = (video.title || '').toLowerCase().includes(q);
    const descMatch = (video.description || '').toLowerCase().includes(q);
    const catMatch = (video.category || '').toLowerCase().includes(q);
    const priceMatch = (video.price?.toString() || '').includes(q);
    return titleMatch || descMatch || catMatch || priceMatch;
  });

  // Dynamic stats calculated directly from database
  const validPrices = videos.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p > 0);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 5;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 200;
  const avgPrice =
    validPrices.length > 0
      ? validPrices.reduce((acc, p) => acc + p, 0) / validPrices.length
      : 0;

  // Pagination calculation (20 items per page)
  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Helper to split title into two lines for cover
  const formatCoverTitle = (title: string): [string, string] => {
    const parts = title.trim().split(' ');
    if (parts.length <= 1) {
      return [title, ''];
    }
    const mid = Math.ceil(parts.length / 2);
    return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
  };

  // Format views
  const formatViews = (views: number | null) => {
    if (!views) return '0 views';
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  return (
    <div className="site-wrapper min-h-screen">
      {!isAccessDenied && (
        <header className="site-header">
          <nav className="navigation" aria-label="Main navigation">
            <a className="brand brand-desktop-only" href="#home" aria-label="DIGITAL SELLER home">
              <span className="brand-mark" aria-hidden="true">
                D
              </span>
              <span className="brand-name">
                digital<span>seller</span>
              </span>
            </a>
            <div className="nav-links">
              <a className="nav-link active" href="#catalog">
                Digital Seller
              </a>
              <span className="age-tag">18+</span>
              <a className="nav-link" href="#home">
                Home
              </a>
              <a className="nav-link" href="#videos">
                Videos
              </a>
              <a
                className="nav-link nav-link-desktop"
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Join our Telegram"
              >
                Telegram
              </a>
            </div>
            <div className="nav-actions">
              <button
                className="icon-button"
                id="search-toggle"
                type="button"
                aria-label="Search"
                aria-expanded={isSearchOpen}
                onClick={toggleSearch}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.8" cy="10.8" r="6.8" />
                  <path d="m16 16 5 5" />
                </svg>
              </button>
              <button
                className="icon-button"
                id="theme-toggle"
                type="button"
                aria-label="Switch color theme"
                onClick={toggleTheme}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z" />
                  <path d="m16.7 2 .6 2.1L19.4 5l-2.1.7-.6 2.1-.7-2.1-2.1-.7 2.1-.9.7-2.1Z" />
                </svg>
              </button>
            </div>
          </nav>
          <form
            className="search-bar"
            id="search-form"
            role="search"
            hidden={!isSearchOpen}
            onSubmit={handleSearchSubmit}
          >
            <label className="visually-hidden" htmlFor="search-input">
              Search collections
            </label>
            <input
              ref={searchInputRef}
              id="search-input"
              type="search"
              placeholder="Search collections and videos"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            <button className="search-submit" type="submit">
              Search
            </button>
          </form>
        </header>
      )}

      {isAccessDenied ? (
        <div className="access-denied-box">
          <h2>Access Restricted</h2>
          <p>You must be 18 years or older to access DIGITAL SELLER content.</p>
          <button
            className="button button-primary"
            onClick={() => {
              setIsAccessDenied(false);
              setShowAgeModal(true);
            }}
          >
            Verify Age Again
          </button>
        </div>
      ) : (
        <main id="home">
          {/* SPECIAL OFFER $200 SECTION */}
          <section className="offer-panel" aria-labelledby="offer-title">
            <div className="offer-copy">
              <p className="eyebrow">A little more to explore</p>
              <h1 id="offer-title">
                <span aria-hidden="true">✦</span> Special Offer — All Content{' '}
                <span className="offer-price">$200</span>
              </h1>
              <p className="offer-description">
                Complete collection • Instant delivery • Secure payment
              </p>
              <div className="offer-actions">
                <a
                  className="button button-outline"
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="telegram-icon" aria-hidden="true">
                    ➤
                  </span>{' '}
                  Telegram
                </a>
                <button
                  className="button button-primary"
                  type="button"
                  data-action="checkout"
                  data-item="All Content"
                  data-price="$200"
                  onClick={() => handleDirectPayment('Special Offer — All Content', 200)}
                >
                  Pay $200 Now
                </button>
              </div>
            </div>
            <ul className="offer-benefits">
              <li>
                <span aria-hidden="true">✓</span> Full access
              </li>
              <li>
                <span aria-hidden="true">✓</span> Auto delivery
              </li>
              <li>
                <span aria-hidden="true">✓</span> One-time payment
              </li>
            </ul>
          </section>

          <div className="section-divider" aria-hidden="true">
            <span>↓</span>
          </div>

          {/* CATALOG SECTION WITH SUPABASE VIDEOS */}
          <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
            <div className="catalog-intro">
              <p className="eyebrow">Curated for you</p>
              <h2 id="catalog-title">Available Videos</h2>
              <div className="stats" aria-label="Store statistics">
                <span>
                  Total: <strong>{videos.length}</strong> {videos.length === 1 ? 'Video' : 'Videos'}
                </span>
                {validPrices.length > 0 && (
                  <>
                    <span>
                      From <strong>${minPrice.toFixed(2)}</strong>
                    </span>
                    <span>
                      Up to <strong>${maxPrice.toFixed(2)}</strong>
                    </span>
                    <span>
                      Avg: <strong>${avgPrice.toFixed(2)}</strong>
                    </span>
                  </>
                )}
              </div>
              <a
                className="button button-outline view-all"
                href="#videos"
              >
                View All Videos <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="product-grid" id="videos" aria-live="polite">
              {isLoading && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  Loading collections from database...
                </div>
              )}

              {loadError && (
                <div style={{ gridColumn: '1 / -1', padding: '20px', borderRadius: '12px', background: '#ffebee', color: '#c62828' }}>
                  Database connection notice: {loadError}
                </div>
              )}

              {!isLoading &&
                paginatedVideos.map((video, index) => {
                  const coverStyle = COVER_PRESETS[index % COVER_PRESETS.length];
                  const [titleL1, titleL2] = formatCoverTitle(video.title);
                  const priceNum = Number(video.price);
                  const priceText = `$${priceNum.toFixed(2)}`;
                  const rawPrice = `$${priceNum}`;

                  return (
                    <article
                      key={video.id}
                      className="product-card"
                      data-search={`${video.title} ${video.category || ''} ${video.description || ''}`}
                    >
                      <div
                        className={`cover ${video.thumbnail_url ? '' : coverStyle}`}
                        role="img"
                        aria-label={video.title}
                        style={{ position: 'relative' }}
                      >
                        {video.thumbnail_url && (
                          <>
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="cover-img-bg"
                              loading="lazy"
                            />
                            <div className="cover-overlay" />
                          </>
                        )}
                        <span className="cover-kicker">
                          {video.category || 'STUDIO COLLECTION'}
                        </span>
                        <span className="cover-title">
                          {titleL1}
                          {titleL2 && (
                            <>
                              <br />
                              {titleL2}
                            </>
                          )}
                        </span>
                        <span className="price-badge">{priceText}</span>
                        <span className="duration-badge">
                          ◷ {video.duration || '05:00'}
                        </span>
                      </div>
                      <div className="card-body">
                        <h3>{video.title}</h3>
                        <div className="card-meta">
                          <span>◉ &nbsp;{formatViews(video.views_count)}</span>
                          <span>
                            {new Date(video.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="card-actions">
                          <div className="card-actions-row">
                            <button
                              className="button button-primary card-btn-preview"
                              type="button"
                              data-action="preview"
                              data-item={video.title}
                              onClick={() => openPreview(video)}
                            >
                              <span className="btn-icon" aria-hidden="true">◉</span>
                              <span>Preview</span>
                            </button>
                            <a
                              className="button button-outline card-btn-telegram"
                              href={telegramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="telegram-icon" aria-hidden="true">➤</span>
                              <span>Telegram</span>
                            </a>
                          </div>
                          {/* DIRECT PAYMENT: Clicks to pay -> directly opens payment link */}
                          <button
                            className="button button-primary card-btn-pay"
                            type="button"
                            data-action="checkout"
                            data-item={video.title}
                            data-price={rawPrice}
                            onClick={() => handleDirectPayment(video.title, priceNum)}
                          >
                            <span className="btn-icon" aria-hidden="true">▣</span>
                            <span>Pay {rawPrice}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

              {/* PAGINATION (BREAK AFTER 20 VIDEOS) */}
              {!isLoading && filteredVideos.length > 0 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing <strong>{startIndex + 1}</strong>–
                    <strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredVideos.length)}</strong> of{' '}
                    <strong>{filteredVideos.length}</strong> videos (20 per page)
                  </div>

                  {totalPages > 1 && (
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn"
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => {
                          setCurrentPage((p) => Math.max(1, p - 1));
                          document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        ← Prev
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                          type="button"
                          onClick={() => {
                            setCurrentPage(page);
                            document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        className="pagination-btn"
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => {
                          setCurrentPage((p) => Math.min(totalPages, p + 1));
                          document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isLoading && filteredVideos.length === 0 && (
              <div
                style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid var(--line)',
                  margin: '16px 0',
                }}
              >
                <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                  {searchQuery ? 'No videos found matching your search.' : 'Nenhum vídeo cadastrado no banco de dados.'}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 auto', maxWidth: '440px' }}>
                  {searchQuery
                    ? 'Try another search term.'
                    : 'Os vídeos são carregados em tempo real diretamente do banco de dados.'}
                </p>
              </div>
            )}
          </section>

          {/* FOOTER */}
          <footer className="site-footer" id="community">
            <a className="brand footer-brand" href="#home" aria-label="DIGITAL SELLER home">
              <span className="brand-mark" aria-hidden="true">
                D
              </span>
              <span className="brand-name">
                digital<span>seller</span>
              </span>
            </a>
            <p>
              Original work from independent creators. Send proof to{' '}
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--blue)', fontWeight: 700 }}
              >
                Telegram Link
              </a>
              .
            </p>
            <span>© 2026 DIGITAL SELLER</span>
          </footer>
        </main>
      )}

      {/* VIDEO PREVIEW MODAL */}
      {activePreviewVideo && (
        <div
          className="video-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-preview-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className="video-modal-box">
            <div className="video-modal-header">
              <h3 id="video-preview-title">{activePreviewVideo.title}</h3>
              <button
                className="close-btn"
                type="button"
                aria-label="Close preview"
                onClick={closePreview}
              >
                ✕
              </button>
            </div>

            <div className="video-player-container">
              <video
                src={activePreviewVideo.video_url}
                poster={activePreviewVideo.thumbnail_url || undefined}
                controls
                autoPlay
                playsInline
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="video-modal-body">
              <div className="video-modal-meta">
                <span className="meta-tag">{activePreviewVideo.category || 'Collection'}</span>
                <span>◷ {activePreviewVideo.duration || 'Short Preview'}</span>
                <span>◉ {formatViews(activePreviewVideo.views_count)}</span>
                <span style={{ fontWeight: 800, color: 'var(--blue)', marginLeft: 'auto', fontSize: '16px' }}>
                  ${Number(activePreviewVideo.price).toFixed(2)}
                </span>
              </div>

              {activePreviewVideo.description && (
                <p className="video-modal-desc">{activePreviewVideo.description}</p>
              )}

              <div className="video-modal-actions">
                <button
                  className="button button-primary"
                  type="button"
                  style={{ flex: 1 }}
                  onClick={() => {
                    closePreview();
                    handleDirectPayment(activePreviewVideo.title, Number(activePreviewVideo.price));
                  }}
                >
                  ▣ &nbsp; Pay ${Number(activePreviewVideo.price).toFixed(2)}
                </button>

                <a
                  className="button button-outline"
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="telegram-icon" aria-hidden="true">
                    ➤
                  </span>{' '}
                  Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POST-PAYMENT MODAL: AFTER CLICKING PAYMENT, DIRECT TELEGRAM LINK TO SEND PROOF AND GET VIDEOS */}
      {postPaymentItem && (
        <div
          className="checkout-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPostPaymentItem(null);
            }
          }}
        >
          <div className="checkout-modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="eyebrow" style={{ margin: 0, color: '#2b9c69' }}>
                ✓ Checkout Opened
              </div>
              <button
                className="close-btn"
                type="button"
                aria-label="Close"
                onClick={() => setPostPaymentItem(null)}
              >
                ✕
              </button>
            </div>

            <h2 id="checkout-title" style={{ margin: 0, fontFamily: 'Manrope, sans-serif', fontSize: '24px' }}>
              Finalize & Receive Your Videos
            </h2>

            <div className="checkout-summary-card">
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>
                  {postPaymentItem.title}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Instant digital release on confirmation
                </div>
              </div>
              <div className="checkout-price">{postPaymentItem.priceFormatted}</div>
            </div>

            <div className="telegram-instructions-box">
              <p style={{ margin: '0 0 8px 0', fontWeight: 800 }}>
                💬 Send proof to get your video links:
              </p>
              <ol style={{ margin: 0, paddingLeft: '18px' }}>
                <li>Complete your payment in the TryWalled checkout page.</li>
                <li>After completing payment, click the green button below.</li>
                <li>Send your payment receipt/proof directly on Telegram.</li>
                <li>Our team will release your video links immediately!</li>
              </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                className="button button-success"
                href={getTelegramReceiptLink(postPaymentItem)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ minHeight: '52px', fontSize: '15px', textDecoration: 'none' }}
              >
                <span className="telegram-icon" aria-hidden="true">
                  ➤
                </span>{' '}
                Send Receipt on Telegram
              </a>

              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  window.open(postPaymentItem.paymentUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                Reopen Payment Link ({postPaymentItem.priceFormatted})
              </button>

              <button
                className="button"
                type="button"
                style={{ background: 'transparent', color: 'var(--muted)', border: 'none', padding: '6px' }}
                onClick={() => setPostPaymentItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGE VERIFICATION MODAL OVERLAY */}
      {showAgeModal && (
        <div
          className="age-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              showToast('Please confirm your age to continue.');
            }
          }}
        >
          <div className="age-dialog" id="age-dialog">
            <div className="age-symbol" aria-hidden="true">
              !
            </div>
            <p className="eyebrow">Before you enter</p>
            <h2 id="age-title">Age verification</h2>
            <p className="age-notice">This website is intended for adults aged 18 and over.</p>
            <div className="dialog-actions">
              <button
                className="button button-success"
                id="age-confirm"
                type="button"
                onClick={handleAgeConfirm}
              >
                ✓ &nbsp; Yes, I am 18+
              </button>
              <button
                className="button button-outline"
                id="age-decline"
                type="button"
                onClick={handleAgeDecline}
              >
                ✕ &nbsp; I am under 18
              </button>
            </div>
            <p className="age-footnote">Please confirm your age to continue.</p>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      <div
        className={`toast ${isToastVisible ? 'visible' : ''}`}
        id="toast"
        role="status"
        aria-live="polite"
      >
        {toastMessage}
      </div>
    </div>
  );
}

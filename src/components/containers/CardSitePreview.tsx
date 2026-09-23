"use client";

import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { PORTAL_SERVICE_URL } from "@/config";
import styles from "./CardSitePreview.module.css";

const LIVE_PREVIEW_HOVER_DELAY_MILLISECONDS = 350;

/**
 * Card thumbnail for a client site: a cached screenshot served by
 * portal-service, upgraded to a live scaled iframe while hovered.
 * Screenshots keep card view cheap — mounting every client as a live
 * iframe booted all their SPAs at once and dragged the whole page down.
 */
export default function CardSitePreview({ domain }: { domain: string }) {
  const [liveActive, setLiveActive] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLivePreview = () => {
    if (hoverTimerRef.current || liveActive) return;
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      setLiveActive(true);
    }, LIVE_PREVIEW_HOVER_DELAY_MILLISECONDS);
  };

  const stopLivePreview = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setLiveActive(false);
    setLiveReady(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return (
    <div
      className={styles['container']}
      onMouseEnter={startLivePreview}
      onMouseLeave={stopLivePreview}
    >
      {imageFailed ? (
        <div className={styles['fallback']}>
          <Globe size={14} strokeWidth={2.2} />
          <span>{domain}</span>
        </div>
      ) : (
        <img
          src={`${PORTAL_SERVICE_URL}/containers/previews/${encodeURIComponent(domain)}`}
          alt={`Preview of ${domain}`}
          className={styles['image']}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}
      {liveActive && (
        <iframe
          src={`https://${domain}`}
          className={`${styles['iframe']} ${liveReady ? styles['iframe-ready'] : ""}`}
          title={`Live preview of ${domain}`}
          tabIndex={-1}
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => setLiveReady(true)}
        />
      )}
      <div className={styles['overlay']} />
    </div>
  );
}

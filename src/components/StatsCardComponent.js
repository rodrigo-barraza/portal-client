"use client";

import { useEffect, useRef } from "react";
import styles from "./StatsCardComponent.module.css";

export default function StatsCardComponent({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  delay = 0,
}) {
  const valueRef = useRef(null);

  useEffect(() => {
    if (valueRef.current) {
      valueRef.current.style.animationDelay = `${delay}ms`;
    }
  }, [delay]);

  return (
    <div className={styles.card} style={{ "--card-accent": color }}>
      <div className={styles.cardHeader}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <div className={styles.iconWrap}>
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value} ref={valueRef}>
          {value}
        </span>
      </div>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      <div className={styles.glowBar} />
    </div>
  );
}

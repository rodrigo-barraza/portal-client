"use client";

import { useMemo } from "react";
import { AlertTriangle, HardDrive, Search, SearchX } from "lucide-react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import type { StorageSearchResult } from "../../types/portal";
import { activationProps } from "./keyboardActivation";
import { formatDate, getFileIcon, groupResultsByBucket, splitObjectKey, staggerDelay } from "./storageFiles";
import styles from "../StorageComponent.module.css";

export function GlobalSearchResults({
  query,
  results,
  isLoading,
  error,
  totalScanned,
  truncated,
  onResultClick,
}: {
  query: string;
  results: StorageSearchResult[];
  isLoading: boolean;
  error: string | null;
  totalScanned: number;
  truncated: boolean;
  onResultClick: (result: StorageSearchResult) => void;
}) {
  const groups = useMemo(() => groupResultsByBucket(results), [results]);

  if (isLoading) {
    return (
      <div className={styles["global-search-results-container"]}>
        <LoadingIndicatorComponent
          size="small"
          label="Searching across all stores…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles["global-search-results-container"]}>
        <div className={styles["global-search-empty-state"]} role="alert">
          <AlertTriangle size={36} />
          <span>Search failed</span>
          <span className={styles["global-search-empty-subtext"]}>{error}</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={styles["global-search-results-container"]}>
        <div className={styles["global-search-empty-state"]}>
          <SearchX size={36} />
          <span>No files matching &ldquo;{query}&rdquo;</span>
          <span className={styles["global-search-empty-subtext"]}>
            Searched {totalScanned.toLocaleString()} objects across all stores
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["global-search-results-container"]}>
      <div className={styles["global-search-results-header"]}>
        <span className={styles["global-search-results-title"]}>
          <Search size={14} />
          {results.length.toLocaleString()} results
          {truncated && "+"} for &ldquo;{query}&rdquo;
        </span>
        <span className={styles["global-search-results-meta"]}>
          {totalScanned.toLocaleString()} objects scanned
          {truncated && " · results truncated"}
        </span>
      </div>

      {groups.map(({ bucket, results: bucketResults }) => (
        <div key={bucket} className={styles["global-search-bucket-group"]}>
          <div className={styles["global-search-bucket-label"]}>
            <HardDrive size={13} strokeWidth={2} />
            <span>{bucket}</span>
            <span className={styles["global-search-bucket-count"]}>{bucketResults.length}</span>
          </div>

          {bucketResults.map((result, index) => {
            const FileIcon = getFileIcon(result.name);
            const { fileName, folderPath } = splitObjectKey(result.name);
            return (
              <div
                key={result.name}
                className={styles["global-search-result-row"]}
                style={{ animationDelay: staggerDelay(index, 20) }}
                {...activationProps(() => onResultClick(result))}
              >
                <div className={styles["global-search-result-name"]}>
                  <FileIcon size={15} className={styles["global-search-file-icon"]} />
                  <span className={styles["global-search-file-name"]}>{fileName}</span>
                  {folderPath && <span className={styles["global-search-file-path"]}>{folderPath}</span>}
                </div>
                <span className={styles["object-size"]}>{formatBytes(result.size)}</span>
                <span className={styles["object-date"]}>{formatDate(result.lastModified)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

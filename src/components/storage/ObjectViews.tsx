"use client";

import { Download, Eye, Folder, Trash } from "lucide-react";
import { IconButtonComponent, SearchInputComponent } from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import type { StorageObject } from "../../types/portal";
import { activationProps } from "./keyboardActivation";
import {
  displayName,
  folderLabel,
  formatDate,
  getFileIcon,
  isImage,
  isPreviewable,
  staggerDelay,
} from "./storageFiles";
import styles from "../StorageComponent.module.css";

export interface ObjectViewProps {
  bucket: string;
  prefix: string;
  objects: StorageObject[];
  prefixes: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFolder: (folderPrefix: string) => void;
  onPreview: (object: StorageObject) => void;
  onDelete: (object: StorageObject) => void;
}

/**
 * Trigger a browser download via a transient anchor — keeps `<a download>`
 * semantics for a button-driven action.
 */
function triggerDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", "");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadObject(bucket: string, object: StorageObject) {
  triggerDownload(ApiService.buildStorageDownloadUrl(bucket, object.name));
}

function thumbnailUrl(bucket: string, object: StorageObject) {
  return ApiService.buildStorageDownloadUrl(bucket, object.name, { inline: true });
}

function ListingHeader({
  prefix,
  itemCount,
  search,
  onSearchChange,
  className,
}: {
  prefix: string;
  itemCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  className: string;
}) {
  return (
    <div className={className}>
      <span className={styles["object-list-title"]}>{prefix || "Root"}</span>
      <div className={styles["listing-header-tools"]}>
        <span className={styles["total-size"]}>{itemCount.toLocaleString()} items</span>
        <SearchInputComponent
          value={search}
          onChange={onSearchChange}
          placeholder="Filter objects…"
          compact
        />
      </div>
    </div>
  );
}

function EmptyListing({ search, spanGrid }: { search: string; spanGrid?: boolean }) {
  return (
    <div className={`${styles["empty-state"]}${spanGrid ? ` ${styles["empty-state-grid"]}` : ""}`}>
      <Folder size={36} />
      <span>{search ? "No matches found" : "This folder is empty"}</span>
    </div>
  );
}

export function ObjectTableView({
  bucket,
  prefix,
  objects,
  prefixes,
  search,
  onSearchChange,
  onOpenFolder,
  onPreview,
  onDelete,
}: ObjectViewProps) {
  return (
    <div className={styles["object-list-container"]}>
      <ListingHeader
        className={styles["object-list-header"]}
        prefix={prefix}
        itemCount={prefixes.length + objects.length}
        search={search}
        onSearchChange={onSearchChange}
      />

      <div className={styles["column-header"]}>
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span className={styles["column-header-actions"]}>Actions</span>
      </div>

      {prefixes.map((folder) => (
        <div
          key={folder}
          className={`${styles["object-row"]} ${styles["folder-row"]}`}
          {...activationProps(() => onOpenFolder(folder))}
        >
          <div className={styles["object-name"]}>
            <Folder size={16} className={styles["object-icon"]} />
            <span className={styles["object-name-text"]}>{folderLabel(folder, prefix)}</span>
          </div>
          <span className={styles["object-size"]}>—</span>
          <span className={styles["object-date"]}>—</span>
          <div className={styles["object-actions"]} />
        </div>
      ))}

      {objects.map((object, index) => {
        const FileIcon = getFileIcon(object.name);
        const name = displayName(object.name, prefix);
        return (
          <div
            key={object.name}
            className={styles["object-row"]}
            style={{ animationDelay: staggerDelay(index, 20) }}
          >
            <div className={styles["object-name"]}>
              {isImage(object.name) ? (
                <img
                  className={styles["table-thumb"]}
                  src={thumbnailUrl(bucket, object)}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <FileIcon size={16} className={styles["object-icon"]} />
              )}
              <span className={styles["object-name-text"]} title={name}>
                {name}
              </span>
            </div>
            <span className={styles["object-size"]}>{formatBytes(object.size)}</span>
            <span className={styles["object-date"]}>{formatDate(object.lastModified, true)}</span>
            <div className={styles["object-actions"]}>
              {isPreviewable(object.name) && (
                <IconButtonComponent
                  icon={<Eye size={15} />}
                  tooltip="Preview"
                  aria-label={`Preview ${name}`}
                  onClick={() => onPreview(object)}
                />
              )}
              <IconButtonComponent
                icon={<Download size={15} />}
                tooltip="Download"
                aria-label={`Download ${name}`}
                onClick={() => downloadObject(bucket, object)}
              />
              <IconButtonComponent
                icon={<Trash size={15} />}
                tooltip="Delete"
                aria-label={`Delete ${name}`}
                variant="destructive"
                onClick={() => onDelete(object)}
              />
            </div>
          </div>
        );
      })}

      {prefixes.length === 0 && objects.length === 0 && <EmptyListing search={search} />}
    </div>
  );
}

export function ObjectGridView({
  bucket,
  prefix,
  objects,
  prefixes,
  search,
  onSearchChange,
  onOpenFolder,
  onPreview,
  onDelete,
}: ObjectViewProps) {
  return (
    <>
      <ListingHeader
        className={styles["grid-header"]}
        prefix={prefix}
        itemCount={prefixes.length + objects.length}
        search={search}
        onSearchChange={onSearchChange}
      />

      <div className={styles["object-grid"]}>
        {prefixes.map((folder) => (
          <div
            key={folder}
            className={`${styles["grid-card"]} ${styles["grid-card-folder"]}`}
            {...activationProps(() => onOpenFolder(folder))}
          >
            <div className={styles["grid-card-thumb"]}>
              <Folder size={36} />
            </div>
            <div className={styles["grid-card-info"]}>
              <span className={styles["grid-card-name"]}>{folderLabel(folder, prefix)}</span>
            </div>
          </div>
        ))}

        {objects.map((object, index) => {
          const FileIcon = getFileIcon(object.name);
          const name = displayName(object.name, prefix);
          const thumbnail = isImage(object.name) ? (
            <img className={styles["grid-thumb-img"]} src={thumbnailUrl(bucket, object)} alt="" loading="lazy" />
          ) : (
            <FileIcon size={36} />
          );
          const canPreview = isPreviewable(object.name);
          return (
            // The whole card previews on click; the thumbnail is the real
            // button (keyboard / screen readers) and its click bubbles here,
            // so the card only widens its pointer target and has no role.
            <div
              key={object.name}
              role="presentation"
              className={`${styles["grid-card"]}${canPreview ? ` ${styles["grid-card-previewable"]}` : ""}`}
              style={{ animationDelay: staggerDelay(index, 30) }}
              onClick={canPreview ? () => onPreview(object) : undefined}
            >
              {canPreview ? (
                <button
                  type="button"
                  className={`${styles["grid-card-thumb"]} ${styles["grid-card-thumb-button"]}`}
                  aria-label={`Preview ${name}`}
                >
                  {thumbnail}
                </button>
              ) : (
                <div className={styles["grid-card-thumb"]}>{thumbnail}</div>
              )}
              <div className={styles["grid-card-info"]}>
                <span className={styles["grid-card-name"]} title={name}>
                  {name}
                </span>
                <span className={styles["grid-card-meta"]}>{formatBytes(object.size)}</span>
              </div>
              <div className={styles["grid-card-actions"]}>
                <IconButtonComponent
                  icon={<Download size={14} />}
                  tooltip="Download"
                  aria-label={`Download ${name}`}
                  className={styles["grid-action-button"]}
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadObject(bucket, object);
                  }}
                />
                <IconButtonComponent
                  icon={<Trash size={14} />}
                  tooltip="Delete"
                  aria-label={`Delete ${name}`}
                  variant="destructive"
                  className={`${styles["grid-action-button"]} ${styles["grid-action-button-danger"]}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(object);
                  }}
                />
              </div>
            </div>
          );
        })}

        {prefixes.length === 0 && objects.length === 0 && <EmptyListing search={search} spanGrid />}
      </div>
    </>
  );
}

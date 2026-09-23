"use client";

import { Download, File, Trash } from "lucide-react";
import {
  ButtonComponent,
  DialogComponent,
  ModalComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import type { StorageObject, StorageObjectStat } from "../../types/portal";
import { formatDate, getMediaType, splitObjectKey } from "./storageFiles";
import styles from "../StorageComponent.module.css";

export function PreviewModal({
  bucket,
  object,
  stat,
  onClose,
}: {
  bucket: string;
  object: StorageObject;
  /** Full metadata from a stat call; null until it arrives. */
  stat: StorageObjectStat | null;
  onClose: () => void;
}) {
  const mediaType = getMediaType(object.name);
  const inlineUrl = ApiService.buildStorageDownloadUrl(bucket, object.name, {
    inline: true,
  });
  const { fileName } = splitObjectKey(object.name);
  const lastModified = stat?.lastModified || object.lastModified;

  return (
    <ModalComponent
      title={fileName}
      onClose={onClose}
      size="xl"
      footer={
        <ButtonComponent
          variant="secondary"
          icon={Download}
          href={ApiService.buildStorageDownloadUrl(bucket, object.name)}
        >
          Download
        </ButtonComponent>
      }
    >
      <div className={styles["preview-body"]}>
        {mediaType === "image" && (
          <img
            className={styles["preview-image"]}
            src={inlineUrl}
            alt={fileName}
          />
        )}
        {mediaType === "audio" && (
          <audio className={styles["preview-audio"]} controls src={inlineUrl} />
        )}
        {mediaType === "video" && (
          <video
            className={styles["preview-video"]}
            controls
            playsInline
            preload="metadata"
            src={inlineUrl}
          />
        )}
        {!mediaType && (
          <div className={styles["preview-fallback"]}>
            <File size={48} />
            <span>No preview available for this file type</span>
          </div>
        )}

        <dl className={styles["preview-meta"]}>
          <dt className={styles["preview-meta-label"]}>Key</dt>
          <dd className={styles["preview-meta-value"]}>{object.name}</dd>
          <dt className={styles["preview-meta-label"]}>Size</dt>
          <dd className={styles["preview-meta-value"]}>
            {formatBytes(stat?.size ?? object.size)}
          </dd>
          {stat?.contentType && (
            <>
              <dt className={styles["preview-meta-label"]}>Type</dt>
              <dd className={styles["preview-meta-value"]}>
                {stat.contentType}
              </dd>
            </>
          )}
          {stat?.etag && (
            <>
              <dt className={styles["preview-meta-label"]}>ETag</dt>
              <dd className={styles["preview-meta-value"]}>{stat.etag}</dd>
            </>
          )}
          {lastModified && (
            <>
              <dt className={styles["preview-meta-label"]}>Modified</dt>
              <dd className={styles["preview-meta-value"]}>
                {formatDate(lastModified, true)}
              </dd>
            </>
          )}
        </dl>
      </div>
    </ModalComponent>
  );
}

export function DeleteObjectDialog({
  bucket,
  object,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: {
  bucket: string;
  object: StorageObject | null;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <DialogComponent
      open={object !== null}
      onClose={onClose}
      icon={<Trash size={22} />}
      headline="Delete object?"
      onConfirm={onConfirm}
      confirmLabel={isDeleting ? "Deleting…" : "Delete"}
      confirmVariant="destructive"
      confirmDisabled={isDeleting}
      dismissible={!isDeleting}
    >
      {object && (
        <>
          <span className={styles["delete-dialog-key"]}>{object.name}</span>{" "}
          will be permanently removed from <strong>{bucket}</strong>.
          {error && (
            <span className={styles["delete-dialog-error"]} role="alert">
              {error}
            </span>
          )}
        </>
      )}
    </DialogComponent>
  );
}

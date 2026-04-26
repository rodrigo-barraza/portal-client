"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Github, Mail, MapPin } from "lucide-react";
import PageHeaderComponent from "./PageHeaderComponent";
import PortalApiService from "../services/PortalApiService";
import styles from "./PortfolioComponent.module.css";

export default function PortfolioComponent() {
  const [content, setContent] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  async function loadPortfolio() {
    try {
      const res = await PortalApiService.getPortfolio();
      setContent(res.content || {});
      setProjects(res.projects || []);
    } catch (err) {
      console.error("Portfolio fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadPortfolio();
  }, []);

  if (loading) {
    return (
      <div className={styles.portfolio}>
        <PageHeaderComponent title="Portfolio" subtitle="Loading…" />
        <div className={styles.loadingState}>
          <div className={styles.loadingDot} />
        </div>
      </div>
    );
  }

  const hasContent = content?.name || content?.bio;

  return (
    <div className={styles.portfolio}>
      <PageHeaderComponent title="Portfolio" subtitle="Projects & about" />

      <div className={styles.bioCard}>
        <div className={styles.bioHeader}>
          <div className={styles.avatar}>
            {(content?.name || "P").charAt(0).toUpperCase()}
          </div>
          <div className={styles.bioInfo}>
            <h2 className={styles.bioName}>
              {content?.name || "Set up your portfolio"}
            </h2>
            {content?.title && (
              <p className={styles.bioTitle}>{content.title}</p>
            )}
            <div className={styles.bioMeta}>
              {content?.location && (
                <span className={styles.metaItem}>
                  <MapPin size={13} /> {content.location}
                </span>
              )}
              {content?.email && (
                <span className={styles.metaItem}>
                  <Mail size={13} /> {content.email}
                </span>
              )}
            </div>
          </div>
        </div>
        {content?.bio && <p className={styles.bioText}>{content.bio}</p>}
        {!hasContent && (
          <p className={styles.emptyBio}>
            No portfolio content yet. Use the API to add your bio and
            projects via PUT /portfolio/content.
          </p>
        )}

        {content?.skills?.length > 0 && (
          <div className={styles.skills}>
            {content.skills.map((skill, i) => (
              <span key={i} className={styles.skillTag}>{skill}</span>
            ))}
          </div>
        )}

        {content?.socialLinks?.length > 0 && (
          <div className={styles.socialLinks}>
            {content.socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
              >
                {link.platform === "github" ? (
                  <Github size={15} />
                ) : (
                  <ExternalLink size={15} />
                )}
                {link.label || link.platform}
              </a>
            ))}
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Projects</h2>
          <div className={styles.projectsGrid}>
            {projects.map((project) => (
              <div key={project.id} className={styles.projectCard}>
                <div className={styles.projectHeader}>
                  <h3 className={styles.projectName}>{project.name}</h3>
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.projectLink}
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                {project.description && (
                  <p className={styles.projectDescription}>
                    {project.description}
                  </p>
                )}
                {project.tags?.length > 0 && (
                  <div className={styles.projectTags}>
                    {project.tags.map((tag, i) => (
                      <span key={i} className={styles.projectTag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

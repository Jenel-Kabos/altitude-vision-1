"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MotionImageReveal, MotionReveal, MotionStagger, MotionStaggerItem } from "./public/PublicMotion";
import styles from "./FacebookFeed.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://altitude-vision.onrender.com/api";
const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61558493665509";
const INSTAGRAM_URL = "https://www.instagram.com/immoaltitudevision/";
const MAX_POSTS = 3;
const REQUEST_TIMEOUT_MS = 5000;

const UNIVERSES = [
  { name: "Altimmo", description: "Immobilier & hébergement", tone: "altimmo" },
  { name: "Altcom", description: "Communication & création", tone: "altcom" },
  { name: "Mila Events", description: "Événementiel & expériences", tone: "mila" },
];

const isPublicPost = (post) => {
  const status = String(post?.status || "").toLowerCase();
  const visibility = String(post?.visibility || "").toLowerCase();
  return !["draft", "private", "unpublished", "rejected"].includes(status)
    && !["private", "tenant", "admin"].includes(visibility);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

const excerpt = (text, max = 170) => {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
};

function EditorialHeader() {
  return (
    <MotionReveal className={styles.header} testId="motion-publications">
      <p className={styles.eyebrow}>Altitude Vision — En mouvement</p>
      <h2 id="publications-title">En ce moment chez Altitude Vision.</h2>
      <p className={styles.lede}>Projets, coulisses, conseils et actualités&nbsp;: suivez ce qui anime nos trois univers.</p>
    </MotionReveal>
  );
}

function EditorialFallback() {
  return (
    <MotionReveal className={styles.fallback} testId="publications-fallback">
      <p className={styles.fallbackCopy}>Retrouvez nos actualités, nos coulisses et les projets de nos trois univers sur nos réseaux.</p>
      <div className={styles.universes}>
        {UNIVERSES.map((universe) => (
          <div className={`${styles.universe} ${styles[universe.tone]}`} key={universe.name}>
            <strong>{universe.name}</strong>
            <span>{universe.description}</span>
          </div>
        ))}
      </div>
      <div className={styles.fallbackActions}>
        <Link className={styles.primaryLink} href="/actualites">Découvrir nos actualités <ArrowRight aria-hidden="true" size={16} /></Link>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer">Nous suivre sur Facebook <ExternalLink aria-hidden="true" size={14} /></a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Nous suivre sur Instagram <ExternalLink aria-hidden="true" size={14} /></a>
      </div>
    </MotionReveal>
  );
}

function PublicationCard({ post }) {
  const message = excerpt(post.message);
  const date = formatDate(post.date_publication);
  const label = post.page_name || "Altitude Vision";

  return (
    <MotionStaggerItem as="article" className={styles.card} data-testid="publication-card">
      {post.image ? (
        <MotionImageReveal className={styles.media}>
          <Image src={post.image} alt={message || `Publication de ${label}`} fill sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw" className={styles.image} />
        </MotionImageReveal>
      ) : (
        <div className={styles.mediaFallback} data-testid="publication-image-fallback" aria-hidden="true"><span>Altitude Vision</span></div>
      )}
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          {post.page_name && <span>{post.page_name}</span>}
          {date && <time dateTime={post.date_publication}>{date}</time>}
        </div>
        {message && <p>{message}</p>}
        {post.permalink && <a href={post.permalink} target="_blank" rel="noopener noreferrer">Voir la publication <ExternalLink aria-hidden="true" size={14} /></a>}
      </div>
    </MotionStaggerItem>
  );
}

const FacebookFeed = () => {
  const [state, setState] = useState("loading");
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const fetchPosts = async () => {
      try {
        const response = await fetch(`${API_URL}/facebook-posts/recent`, { signal: controller.signal });
        if (!response.ok) throw new Error("Publications request failed");
        const payload = await response.json();
        if (!payload?.success || !Array.isArray(payload.data)) throw new Error("Invalid publications response");
        const publicPosts = payload.data.filter(isPublicPost).slice(0, MAX_POSTS);
        setPosts(publicPosts);
        setState(publicPosts.length ? "success" : "fallback");
      } catch {
        setState("fallback");
      } finally {
        window.clearTimeout(timeoutId);
      }
    };
    fetchPosts();
    return () => { window.clearTimeout(timeoutId); controller.abort(); };
  }, []);

  return (
    <section aria-labelledby="publications-title" className={styles.section} data-testid="publications-editorial">
      <div className={styles.container}>
        <EditorialHeader />
        {state === "loading" && <div className={styles.loading} role="status" aria-label="Chargement des publications"><span /><span /><span /></div>}
        {state === "success" && (
          <>
            <MotionStagger className={styles.grid}>{posts.map((post) => <PublicationCard key={post._id || post.facebook_id} post={post} />)}</MotionStagger>
            <MotionReveal className={styles.newsAction}><Link href="/actualites">Découvrir toutes nos actualités <ArrowRight aria-hidden="true" size={16} /></Link></MotionReveal>
          </>
        )}
        {state === "fallback" && <EditorialFallback />}
      </div>
    </section>
  );
};

export default FacebookFeed;

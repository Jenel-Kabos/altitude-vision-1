"use client";

import React, { useEffect, useState } from "react";
import Image from 'next/image';
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2, Newspaper, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://altitude-vision.onrender.com/api";

const FacebookFeed = () => {
  const [posts,     setPosts]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError,  setHasError]  = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res  = await fetch(`${API_URL}/facebook-posts/recent`);
        const data = await res.json();
        if (data.success) setPosts(data.data);
        else setHasError(true);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

  const truncate = (text, max = 120) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  };

  return (
    <section
      className="py-16 sm:py-20 relative"
      style={{ background: '#0D1117' }}
    >
      {/* Ligne séparation */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.2), transparent)' }}
      />

      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

        {/* En-tête */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: '#C8960C', fontFamily: "'DM Sans', sans-serif" }}
            >
              Actualités
            </p>
            <h2
              className="mb-3"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize:   'clamp(1.8rem, 4vw, 3.5rem)',
                fontWeight: 300,
                lineHeight: 1.12,
                color:      '#E8E4DC',
              }}
            >
              Nos Dernières Publications
            </h2>
            <div
              className="h-px w-20 mx-auto rounded-full"
              style={{ background: 'linear-gradient(to right, transparent, #C8960C, transparent)' }}
            />
          </motion.div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8960C' }} />
          </div>
        )}

        {/* Erreur */}
        {!isLoading && hasError && (
          <div
            className="text-center py-12 rounded-2xl border border-dashed"
            style={{ borderColor: 'rgba(232,228,220,0.08)', background: 'rgba(232,228,220,0.02)' }}
          >
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(232,228,220,0.2)' }} />
            <p className="text-sm" style={{ color: 'rgba(232,228,220,0.3)', fontFamily: "'DM Sans', sans-serif" }}>
              Publications temporairement indisponibles
            </p>
          </div>
        )}

        {/* Grille de posts */}
        {!isLoading && !hasError && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {posts.slice(0, 6).map((post, index) => (
                <motion.div
                  key={post._id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="group overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background:   'rgba(17,20,24,0.8)',
                    borderColor:  'rgba(232,228,220,0.06)',
                    boxShadow:    '0 1px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Image */}
                  {post.image && (
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={post.image}
                        alt={post.message?.substring(0, 80) || 'Publication Facebook'}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(10,12,15,0.5) 0%, transparent 60%)' }}
                      />
                    </div>
                  )}

                  {/* Contenu */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      {/* Badge Facebook */}
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">f</span>
                      </div>
                      <span
                        className="text-xs font-medium truncate"
                        style={{ color: 'rgba(232,228,220,0.5)', fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {post.page_name}
                      </span>
                      <span
                        className="text-xs ml-auto whitespace-nowrap"
                        style={{ color: 'rgba(232,228,220,0.28)', fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {formatDate(post.date_publication)}
                      </span>
                    </div>

                    <p
                      className="text-sm leading-relaxed mb-4"
                      style={{ color: 'rgba(232,228,220,0.65)', fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {truncate(post.message)}
                    </p>

                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                        style={{ color: '#C8960C', fontFamily: "'DM Sans', sans-serif" }}
                      >
                        Voir sur Facebook
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mt-10"
            >
              <Link
                href="/actualites"
                className="inline-flex items-center gap-2 font-semibold px-8 py-3.5 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background:  'linear-gradient(135deg, #C8960C, #E5A84B)',
                  color:       '#0A0C0F',
                  boxShadow:   '0 4px 20px rgba(200,135,42,0.3)',
                  fontFamily:  "'DM Sans', sans-serif",
                  fontSize:    '0.85rem',
                }}
              >
                Voir toutes les actualités
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </>
        )}

        {/* Aucun post */}
        {!isLoading && !hasError && posts.length === 0 && (
          <div
            className="text-center py-16 rounded-2xl border border-dashed"
            style={{ borderColor: 'rgba(200,135,42,0.14)', background: 'rgba(200,135,42,0.03)' }}
          >
            <Newspaper className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(232,228,220,0.2)' }} />
            <p
              className="font-medium mb-1"
              style={{ color: 'rgba(232,228,220,0.5)', fontFamily: "'DM Sans', sans-serif" }}
            >
              Aucune actualité disponible
            </p>
            <p
              className="text-sm"
              style={{ color: 'rgba(232,228,220,0.25)', fontFamily: "'DM Sans', sans-serif" }}
            >
              Les publications apparaîtront ici automatiquement
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default FacebookFeed;

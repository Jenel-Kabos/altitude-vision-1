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
    <section className="py-16 sm:py-20 relative bg-surface">

      {/* Ligne séparation */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(46,123,181,0.15), transparent)' }} />

      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

        {/* En-tête */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2 text-gold font-body">
              Actualités
            </p>
            <h2 className="font-display-alt font-light text-ink text-[clamp(1.8rem,4vw,3.5rem)] leading-tight mb-3">
              Nos Dernières Publications
            </h2>
            <div className="h-px w-20 mx-auto rounded-full"
              style={{ background: 'linear-gradient(to right, transparent, #C8960C, transparent)' }} />
          </motion.div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        )}

        {/* Erreur */}
        {!isLoading && hasError && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-gray-200 bg-white">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-ink-soft font-body">
              Publications temporairement indisponibles
            </p>
          </div>
        )}

        {/* Grille de posts */}
        {!isLoading && !hasError && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {posts.slice(0, 6).map((post, index) => (
                <motion.article
                  key={post._id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200"
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                  )}

                  {/* Contenu */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      {/* Badge Facebook */}
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                        <span className="text-white text-xs font-bold">f</span>
                      </div>
                      <span className="text-xs font-medium truncate text-ink-soft font-body">
                        {post.page_name}
                      </span>
                      <span className="text-xs ml-auto whitespace-nowrap text-ink-faint font-body">
                        {formatDate(post.date_publication)}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed mb-4 text-ink-mid font-body">
                      {truncate(post.message)}
                    </p>

                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-dark transition-colors font-body"
                        aria-label={`Voir la publication de ${post.page_name} sur Facebook`}
                      >
                        Voir sur Facebook
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </motion.article>
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
                className="inline-flex items-center gap-2 font-semibold px-8 py-3.5 rounded-full bg-gold hover:bg-gold-light text-dark transition-all duration-300 hover:-translate-y-0.5 font-body text-sm"
                style={{ boxShadow: '0 4px 20px rgba(200,150,12,0.22)' }}
              >
                Voir toutes les actualités
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </motion.div>
          </>
        )}

        {/* Aucun post */}
        {!isLoading && !hasError && posts.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-gold/20 bg-gold-subtle">
            <Newspaper className="w-10 h-10 mx-auto mb-3 text-gold/30" />
            <p className="font-medium text-ink-soft mb-1 font-body">
              Aucune actualité disponible
            </p>
            <p className="text-sm text-ink-faint font-body">
              Les publications apparaîtront ici automatiquement
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default FacebookFeed;

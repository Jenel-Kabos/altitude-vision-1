import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Loader2, Newspaper } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://altitude-vision.onrender.com/api";

const FacebookFeed = () => {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${API_URL}/facebook-posts/recent`);
        const data = await res.json();
        if (data.success) setPosts(data.data);
      } catch (error) {
        console.error("❌ Erreur chargement posts Facebook:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const truncate = (text, max = 120) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  };

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">
              Actualités
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
              Nos Dernières Publications
            </h2>
            <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-24 mx-auto rounded-full"></div>
          </motion.div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Posts Grid - 6 premiers seulement */}
        {!isLoading && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {posts.slice(0, 6).map((post, index) => (
                <motion.div
                  key={post._id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
                >
                  {/* Image */}
                  {post.image && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={post.image}
                        alt="Publication"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}

                  {/* Contenu */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">f</span>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 truncate">{post.page_name}</span>
                      <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{formatDate(post.date_publication)}</span>
                    </div>

                    <p className="text-gray-700 text-sm leading-relaxed mb-4">
                      {truncate(post.message)}
                    </p>

                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Voir sur Facebook
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Lien vers page actualités */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mt-10"
            >
              <Link
                to="/actualites"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                Voir toutes les actualités
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </>
        )}

        {/* Aucun post */}
        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-blue-200">
            <Newspaper className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-700">Aucune actualité disponible</p>
            <p className="text-sm text-gray-500">Les publications apparaîtront ici automatiquement</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default FacebookFeed;
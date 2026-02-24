import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, Newspaper, Calendar, RefreshCw } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://altitude-vision.onrender.com/api";

const ActualitesPage = () => {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/facebook-posts/actus`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("❌ Erreur chargement actualités:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatHeure = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Newspaper className="w-4 h-4" />
              <span className="text-sm font-semibold">Publications Facebook</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              Actualités
            </h1>
            <p className="text-blue-200 text-lg sm:text-xl max-w-2xl mx-auto">
              Retrouvez toutes nos publications des 5 derniers jours
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contenu */}
      <section className="py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">

          {/* Barre info + refresh */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>
                {posts.length > 0
                  ? `${posts.length} publication${posts.length > 1 ? "s" : ""} sur 5 jours`
                  : "Aucune publication"}
              </span>
            </div>
            <button
              onClick={fetchPosts}
              disabled={isLoading}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
          )}

          {/* Liste des posts - style fil d'actualité */}
          {!isLoading && posts.length > 0 && (
            <div className="space-y-6">
              {posts.map((post, index) => (
                <motion.article
                  key={post._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.06 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    {post.image && (
                      <div className="sm:w-64 h-52 sm:h-auto flex-shrink-0 overflow-hidden">
                        <img
                          src={post.image}
                          alt="Publication"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Contenu */}
                    <div className="flex-1 p-6">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">f</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{post.page_name}</p>
                          <p className="text-xs text-gray-400">
                            {formatDate(post.date_publication)} à {formatHeure(post.date_publication)}
                          </p>
                        </div>
                      </div>

                      {/* Message complet */}
                      <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-5 whitespace-pre-line">
                        {post.message}
                      </p>

                      {/* Lien Facebook */}
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-sm px-4 py-2 rounded-full transition-colors"
                        >
                          <span>Voir la publication originale</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}

          {/* Aucun post */}
          {!isLoading && posts.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 bg-white rounded-3xl border border-dashed border-blue-200"
            >
              <Newspaper className="w-14 h-14 text-gray-300 mx-auto mb-4" />
              <p className="text-xl font-bold text-gray-700 mb-2">Aucune actualité récente</p>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Aucune publication n'a été trouvée dans les 5 derniers jours. Revenez bientôt !
              </p>
            </motion.div>
          )}

          {/* Dernière mise à jour */}
          {lastUpdated && (
            <p className="text-center text-xs text-gray-400 mt-8">
              Dernière mise à jour : {lastUpdated.toLocaleTimeString("fr-FR")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default ActualitesPage;
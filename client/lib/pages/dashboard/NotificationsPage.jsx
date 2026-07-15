'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Bell, CheckCheck, Trash2, Home, Calendar, ArrowLeftRight,
    MessageSquare, FileText, CreditCard, FileSignature, Shield,
    AlertCircle, RefreshCw,
} from 'lucide-react';
import {
    getNotifications, markRead, markAllRead, clearRead, deleteNotification,
} from '../../services/notificationService';

// ─── Config icônes par type ───────────────────────────────────────────────────

const TYPE_CONFIG = {
    new_message:           { icon: MessageSquare,   color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Message'      },
    new_staff_message:     { icon: MessageSquare,   color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Message'      },
    visite_new:            { icon: Home,            color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Visite'      },
    visite_status:         { icon: Calendar,        color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Visite'      },
    visite_cancelled:      { icon: Calendar,        color: 'text-red-500',    bg: 'bg-red-50',    label: 'Visite'       },
    transaction_created:   { icon: ArrowLeftRight,  color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Transaction'  },
    transaction_finalized: { icon: ArrowLeftRight,  color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Transaction' },
    quote_received:        { icon: FileText,        color: 'text-purple-500', bg: 'bg-purple-50', label: 'Devis'        },
    quote_status:          { icon: FileText,        color: 'text-purple-500', bg: 'bg-purple-50', label: 'Devis'        },
    quote_response:        { icon: FileText,        color: 'text-purple-500', bg: 'bg-purple-50', label: 'Devis'        },
    payment_success:       { icon: CreditCard,      color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Paiement'   },
    payment_failed:        { icon: AlertCircle,     color: 'text-red-500',    bg: 'bg-red-50',    label: 'Paiement'     },
    contrat_new:           { icon: FileSignature,   color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Contrat'      },
    contrat_updated:       { icon: FileSignature,   color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Contrat'      },
    loyer_paye:            { icon: CreditCard,      color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Loyer'      },
    loyer_en_retard:       { icon: AlertCircle,     color: 'text-red-500',    bg: 'bg-red-50',    label: 'Loyer'        },
    account_verified:      { icon: Shield,          color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Compte'     },
    account_suspended:     { icon: AlertCircle,     color: 'text-red-500',    bg: 'bg-red-50',    label: 'Compte'       },
};

const DEFAULT_CONFIG = { icon: Bell, color: 'text-gold', bg: 'bg-amber-50', label: 'Notification' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const diff  = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (mins  <  1) return "À l'instant";
    if (mins  < 60) return `Il y a ${mins} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days  <  7) return `Il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTERS = [
    { key: 'all',    label: 'Toutes'   },
    { key: 'unread', label: 'Non lues' },
];

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState(null);
    const [filter,        setFilter]        = useState('all');
    const [page,          setPage]          = useState(1);
    const [hasMore,       setHasMore]       = useState(false);

    const load = useCallback(async (reset = false) => {
        const p = reset ? 1 : page;
        setLoading(reset);
        try {
            const data = await getNotifications(p, filter);
            const list = data?.notifications || [];
            if (reset) {
                setNotifications(list);
                setPage(2);
            } else {
                setNotifications((prev) => [...prev, ...list]);
                setPage((prev) => prev + 1);
            }
            setUnreadCount(data?.unreadCount ?? 0);
            setHasMore(p < (data?.pagination?.pages ?? 1));
            setError(null);
        } catch {
            setError('Impossible de charger les notifications. Réessayez dans quelques instants.');
        }
        finally { setLoading(false); }
    }, [filter, page]);

    useEffect(() => {
        setPage(1);
        load(true);
    }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleMarkRead = async (notif) => {
        if (notif.read) return;
        try {
            await markRead(notif._id);
            setNotifications((prev) => prev.map((n) => n._id === notif._id ? { ...n, read: true } : n));
            setUnreadCount((c) => Math.max(0, c - 1));
            window.dispatchEvent(new CustomEvent('altitude:notifications:changed'));
        } catch {
            setError('Impossible de marquer cette notification comme lue.');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
            window.dispatchEvent(new CustomEvent('altitude:notifications:changed'));
        } catch {
            setError('Impossible de marquer toutes les notifications comme lues.');
        }
    };

    const handleDelete = async (id) => {
        const notif = notifications.find((n) => n._id === id);
        try {
            await deleteNotification(id);
            setNotifications((prev) => prev.filter((n) => n._id !== id));
            if (notif && !notif.read) setUnreadCount((c) => Math.max(0, c - 1));
            window.dispatchEvent(new CustomEvent('altitude:notifications:changed'));
        } catch {
            setError('Impossible de supprimer cette notification.');
        }
    };

    const handleClearRead = async () => {
        try {
            await clearRead();
            setNotifications((prev) => prev.filter((n) => !n.read));
            window.dispatchEvent(new CustomEvent('altitude:notifications:changed'));
        } catch {
            setError('Impossible de supprimer les notifications lues.');
        }
    };

    const hasRead = notifications.some((n) => n.read);

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Tout lire
                        </button>
                    )}
                    {hasRead && (
                        <button
                            onClick={handleClearRead}
                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
                        >
                            <Trash2 className="w-4 h-4" />
                            Nettoyer
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Filtres ─── */}
            <div className="flex gap-2 mb-6">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            filter === f.key
                                ? 'bg-amber-100 border-amber-300 text-amber-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                        {f.label}
                        {f.key === 'unread' && unreadCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {error && (
                <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>
            )}

            {/* ─── Liste ─── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                </div>
            ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <Bell className="w-7 h-7 text-amber-400" />
                    </div>
                    <p className="font-medium text-gray-700">
                        {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                    </p>
                    <p className="text-sm text-gray-400 max-w-xs">
                        {filter === 'unread'
                            ? 'Vous êtes à jour !'
                            : 'Vos alertes de visites, transactions et messages apparaîtront ici.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    {notifications.map((notif) => {
                        const cfg = TYPE_CONFIG[notif.type] || DEFAULT_CONFIG;
                        const Icon = cfg.icon;
                        return (
                            <div
                                key={notif._id}
                                className={`relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer group transition-colors ${
                                    notif.read
                                        ? 'bg-white border-gray-100 hover:border-gray-200'
                                        : 'bg-amber-50/40 border-amber-100 hover:border-amber-200'
                                }`}
                                onClick={() => handleMarkRead(notif)}
                            >
                                {!notif.read && (
                                    <span className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-amber-400" />
                                )}

                                {/* Icône */}
                                <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                                </div>

                                {/* Contenu */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                                            {cfg.label}
                                        </span>
                                        <span className="text-xs text-gray-400 flex-shrink-0">
                                            {formatRelativeTime(notif.createdAt)}
                                        </span>
                                    </div>
                                    <p className={`text-sm truncate ${notif.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                        {notif.title}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>
                                </div>

                                {/* Supprimer */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(notif._id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-all flex-shrink-0"
                                    aria-label="Supprimer"
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                            </div>
                        );
                    })}

                    {/* Charger plus */}
                    {hasMore && (
                        <button
                            onClick={() => load(false)}
                            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Charger plus
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

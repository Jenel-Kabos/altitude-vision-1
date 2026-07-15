'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, BellOff, CheckCheck, Trash2,
  Home, Calendar, ArrowLeftRight, MessageSquare,
  FileText, CreditCard, Shield, AlertCircle,
  Calculator, Mail, CheckCircle2, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { clearRead } from '../../services/notificationService';

const GOLD = '#C8960C';

const TYPE_CONFIG = {
  new_message:           { Icon: MessageSquare,  color: '#3B82F6', route: '/dashboard/conversations' },
  new_staff_message:     { Icon: MessageSquare,  color: '#3B82F6', route: '/dashboard/conversations' },
  visite_new:            { Icon: Home,           color: GOLD,      route: '/dashboard/visites'       },
  visite_status:         { Icon: Calendar,       color: '#10B981', route: '/dashboard/visites'       },
  visite_cancelled:      { Icon: Calendar,       color: '#EF4444', route: '/dashboard/visites'       },
  transaction_created:   { Icon: ArrowLeftRight, color: GOLD,      route: '/dashboard/transactions'  },
  transaction_finalized: { Icon: ArrowLeftRight, color: '#10B981', route: '/dashboard/transactions'  },
  quote_received:        { Icon: FileText,       color: '#8B5CF6', route: '/dashboard/quotes'        },
  quote_status:          { Icon: FileText,       color: '#8B5CF6', route: '/dashboard/quotes'        },
  quote_response:        { Icon: FileText,       color: '#8B5CF6', route: '/dashboard/quotes'        },
  payment_success:       { Icon: CreditCard,     color: '#10B981', route: '/dashboard/transactions'  },
  payment_failed:        { Icon: AlertCircle,    color: '#EF4444', route: '/dashboard/transactions'  },
  contrat_new:           { Icon: FileText,       color: GOLD,      route: '/dashboard/gestion-locative' },
  contrat_updated:       { Icon: FileText,       color: GOLD,      route: '/dashboard/gestion-locative' },
  account_verified:      { Icon: Shield,         color: '#10B981', route: '/dashboard'               },
  account_suspended:     { Icon: AlertCircle,    color: '#EF4444', route: '/dashboard'               },
  estimation_received:        { Icon: Calculator,   color: GOLD,      route: '/dashboard/estimations' },
  devis_received:              { Icon: FileText,     color: '#0D9488', route: '/dashboard/devis' },
  contact_received:            { Icon: Mail,         color: GOLD,      route: '/dashboard/contact-messages' },
  property_pending_moderation: { Icon: CheckCircle2, color: '#7C3AED', route: '/dashboard/moderation/properties' },
  bien_valide:            { Icon: CheckCircle,   color: '#10B981', route: '/immobilier/annonces' },
  bien_rejete:            { Icon: XCircle,       color: '#EF4444', route: '/profile'             },
  visite_sur_mon_bien:    { Icon: Home,          color: GOLD,      route: '/mes-visites'          },
  message_staff:          { Icon: MessageSquare, color: '#3B82F6', route: '/messages'             },
  paiement_confirme:      { Icon: CheckCircle,   color: '#10B981', route: '/mes-paiements'        },
  paiement_echoue:        { Icon: XCircle,       color: '#EF4444', route: '/mes-paiements'        },
  nouveau_signalement:    { Icon: AlertTriangle, color: '#EF4444', route: '/dashboard/litiges'    },
  visite_payee:           { Icon: CreditCard,    color: '#10B981', route: '/dashboard/paiements'  },
};

const DEFAULT_CONFIG = { Icon: Bell, color: GOLD, route: '/dashboard/notifications' };

function fmtTime(dateStr) {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "À l'instant";
  if (mins  < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days  <  7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ isAuthenticated }) {
  const router  = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } =
    useNotifications(isAuthenticated);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) fetchNotifications();
      return !prev;
    });
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onClickOut = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOut);
    return () => document.removeEventListener('mousedown', onClickOut);
  }, [open]);

  const handleNotifClick = useCallback(async (notif) => {
    if (!notif.read) markRead(notif._id);
    setOpen(false);
    const cfg = TYPE_CONFIG[notif.type] || DEFAULT_CONFIG;
    router.push(cfg.route);
  }, [markRead, router]);

  const handleClearRead = useCallback(async () => {
    clearRead().catch(() => {});
    fetchNotifications();
  }, [fetchNotifications]);

  if (!isAuthenticated) return null;

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* ─── Cloche ─── */}
      <button
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} non lues` : ''}`}
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', padding: 6, borderRadius: 8,
          color: open ? GOLD : 'inherit', display: 'flex',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#DC2626', color: '#fff',
            fontSize: 10, fontWeight: 700, borderRadius: 10,
            minWidth: 16, height: 16, padding: '0 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ─── Dropdown ─── */}
      {open && (
        <div style={{
          position: 'absolute', top: '115%', right: 0,
          width: 360, maxHeight: 460,
          background: '#111418',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
          zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E8E4DC' }}>
              Notifications{' '}
              {unreadCount > 0 && <span style={{ color: GOLD }}>({unreadCount})</span>}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Tout marquer comme lu"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}
                >
                  <CheckCheck size={15} />
                </button>
              )}
              <button
                onClick={handleClearRead}
                title="Supprimer les lues"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13, margin: 0 }}>
                Chargement…
              </p>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
                <BellOff size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p style={{ fontSize: 12, margin: 0 }}>Aucune notification</p>
              </div>
            ) : notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || DEFAULT_CONFIG;
              const { Icon } = cfg;
              return (
                <button
                  key={notif._id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    display: 'flex', gap: 10, width: '100%',
                    padding: '11px 16px', textAlign: 'left',
                    background: notif.read ? 'transparent' : 'rgba(200,150,12,0.07)',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Icône */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: `${cfg.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} color={cfg.color} />
                  </div>
                  {/* Texte */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 12,
                      fontWeight: notif.read ? 400 : 600,
                      color: '#E8E4DC', lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {notif.title}
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {notif.body}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: '#6b7280' }}>
                      {fmtTime(notif.createdAt)}
                    </p>
                  </div>
                  {/* Dot non-lu */}
                  {!notif.read && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: GOLD, flexShrink: 0, marginTop: 5,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer → page complète */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { setOpen(false); router.push('/dashboard/notifications'); }}
              style={{
                width: '100%', padding: '10px 16px', background: 'none',
                border: 'none', cursor: 'pointer', fontSize: 12,
                color: GOLD, textAlign: 'center',
              }}
            >
              Voir toutes les notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

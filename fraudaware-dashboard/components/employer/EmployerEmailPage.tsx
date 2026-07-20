'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import EmployerShell from '@/components/employer/EmployerShell';
import EmailDetailPane from '@/components/employer/email/EmailDetailPane';
import EmailFolderNav from '@/components/employer/email/EmailFolderNav';
import EmailMessageRow from '@/components/employer/email/EmailMessageRow';
import InboxComposeModal from '@/components/employer/email/InboxComposeModal';
import {
  ensureFwdSubject,
  ensureReSubject,
  participantLabel,
} from '@/components/employer/email/emailFormat';
import {
  getEmailMessage,
  getEmailStatus,
  listEmailFolders,
  listEmailMessages,
  type EmailFolder,
  type EmailMessageDetail,
  type EmailMessageSummary,
  type EmailStatus,
} from '@/lib/api/emailApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const DEFAULT_FOLDERS: EmailFolder[] = [
  { key: 'inbox', id: null, name: 'Inbox', totalCount: null, unreadCount: null },
  { key: 'sent', id: null, name: 'Sent', totalCount: null, unreadCount: null },
  { key: 'drafts', id: null, name: 'Draft', totalCount: null, unreadCount: null },
  { key: 'spam', id: null, name: 'Spam', totalCount: null, unreadCount: null },
  { key: 'trash', id: null, name: 'Trash', totalCount: null, unreadCount: null },
];

type ComposeState = {
  title: string;
  to: string;
  subject: string;
  body: string;
} | null;

export default function EmployerEmailPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const basePath = portalConfigs[portal].basePath;
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [folders, setFolders] = useState<EmailFolder[]>(DEFAULT_FOLDERS);
  const [folderKey, setFolderKey] = useState('inbox');
  const [messages, setMessages] = useState<EmailMessageSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailMessageDetail | null>(null);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(null);

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.key === folderKey) ?? folders[0],
    [folderKey, folders]
  );

  const loadStatus = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingStatus(true);
    try {
      const next = await getEmailStatus(token);
      setStatus(next);
      setError(null);
    } catch (requestError: unknown) {
      setStatus({ connected: false, email: null, connectedAt: null });
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load mailbox status.'
      );
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const next = await listEmailFolders(token);
      if (next.length > 0) setFolders(next);
    } catch {
      setFolders(DEFAULT_FOLDERS);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const token = getStoredToken();
    if (!token || !status?.connected) return;
    setLoadingList(true);
    setError(null);
    try {
      const result = await listEmailMessages(token, {
        folderKey,
        folderId: activeFolder?.id || undefined,
        q: query || undefined,
        limit: 50,
      });
      setMessages(result.messages);
      setSelectedId((current) => {
        if (current && result.messages.some((message) => message.id === current)) {
          return current;
        }
        return result.messages[0]?.id ?? null;
      });
    } catch (requestError: unknown) {
      setMessages([]);
      setSelectedId(null);
      setDetail(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load messages.'
      );
    } finally {
      setLoadingList(false);
    }
  }, [activeFolder?.id, folderKey, query, status?.connected]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    void loadFolders();
  }, [loadFolders, status?.connected]);

  useEffect(() => {
    if (!status?.connected) return;
    void loadMessages();
  }, [loadMessages, status?.connected]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !selectedId || !status?.connected) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    getEmailMessage(token, selectedId)
      .then((message) => {
        if (!cancelled) {
          setDetail(message);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load message.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, status?.connected]);

  const openCompose = () => {
    setCompose({
      title: 'Compose email',
      to: '',
      subject: '',
      body: '',
    });
  };

  const openReply = () => {
    if (!detail) return;
    const to = detail.from[0]?.email || '';
    setCompose({
      title: 'Reply',
      to,
      subject: ensureReSubject(detail.subject),
      body: `\n\n---\nOn ${participantLabel(detail.from)} wrote:\n`,
    });
  };

  const openForward = () => {
    if (!detail) return;
    setCompose({
      title: 'Forward',
      to: '',
      subject: ensureFwdSubject(detail.subject),
      body: `\n\n---------- Forwarded message ----------\nFrom: ${participantLabel(detail.from)}\nSubject: ${detail.subject}\n\n`,
    });
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

  return (
    <EmployerShell portal={portal} fullBleed>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:m-4 lg:rounded-xl lg:border lg:border-[#EEF0F8] lg:bg-white lg:shadow-sm">
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b border-[#EEF0F8] px-5 py-4"
          style={{ background: 'linear-gradient(90deg, #EEF2FF 0%, #F7F8FE 55%, #E8EBFA 100%)' }}
        >
          <div>
            <h1
              className="text-xl font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Email
            </h1>
            <p
              className="mt-0.5 text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              {status?.connected
                ? `Look at ${activeFolder?.name || 'Inbox'}${
                    status.email ? ` · ${status.email}` : ''
                  }`
                : 'Connect a mailbox to view your inbox'}
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="flex flex-1 items-center justify-center bg-white">
            <p style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}>
              Loading mailbox...
            </p>
          </div>
        ) : !status?.connected ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 text-center">
            <p
              className="text-lg font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              No mailbox connected
            </p>
            <p
              className="mt-2 max-w-md text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Connect Gmail or Outlook on your profile to read and send email in FraudAware.
            </p>
            <Link
              href={`${basePath}/profile`}
              className="mt-5 rounded-xl bg-[#202871] px-5 py-2.5 text-sm font-semibold text-white"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Connect mailbox
            </Link>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="hidden lg:flex">
              <EmailFolderNav
                folders={folders}
                activeKey={folderKey}
                onSelect={(key) => {
                  setFolderKey(key);
                  setSelectedId(null);
                  setDetail(null);
                }}
                onCompose={openCompose}
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
              <div className="flex min-h-0 w-full flex-col border-r border-[#EEF0F8] bg-white lg:w-[340px] lg:shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto border-b border-[#EEF0F8] px-3 py-2 lg:hidden">
                  <button
                    type="button"
                    onClick={openCompose}
                    className="shrink-0 rounded-full bg-[#202871] px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    Compose
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.key}
                      type="button"
                      onClick={() => {
                        setFolderKey(folder.key);
                        setSelectedId(null);
                        setDetail(null);
                      }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                        folder.key === folderKey
                          ? 'bg-[#EEF0F8] text-[#202871]'
                          : 'text-[#42498A]'
                      }`}
                      style={{ fontFamily: 'var(--font-poppins)' }}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSearchSubmit} className="border-b border-[#EEF0F8] p-3">
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search emails"
                    className="h-10 w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 text-sm outline-none focus:border-[#202871]"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  />
                </form>

                {error ? (
                  <p
                    className="border-b border-[#EEF0F8] px-4 py-2 text-xs text-red-600"
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    {error}
                  </p>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {loadingList ? (
                    <p
                      className="px-4 py-6 text-sm"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      Loading messages...
                    </p>
                  ) : messages.length === 0 ? (
                    <p
                      className="px-4 py-6 text-sm"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      No messages in this folder.
                    </p>
                  ) : (
                    messages.map((message) => (
                      <EmailMessageRow
                        key={message.id}
                        message={message}
                        selected={message.id === selectedId}
                        onSelect={() => setSelectedId(message.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="hidden min-h-0 min-w-0 flex-1 lg:block">
                <EmailDetailPane
                  message={detail}
                  loading={loadingDetail}
                  onReply={openReply}
                  onForward={openForward}
                />
              </div>

              {selectedId && detail ? (
                <div className="fixed inset-0 z-40 bg-white lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="border-b border-[#EEF0F8] px-4 py-3 text-sm font-medium text-[#202871]"
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    Back to list
                  </button>
                  <div className="h-[calc(100%-49px)]">
                    <EmailDetailPane
                      message={detail}
                      loading={loadingDetail}
                      onReply={openReply}
                      onForward={openForward}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {compose ? (
        <InboxComposeModal
          title={compose.title}
          initialTo={compose.to}
          initialSubject={compose.subject}
          initialBody={compose.body}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null);
            void loadMessages();
          }}
        />
      ) : null}
    </EmployerShell>
  );
}

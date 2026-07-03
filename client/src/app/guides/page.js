'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached } from '../../utils/api';

const CATEGORY_LABELS = {
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
};

const WIKI_SECTIONS = [
  {
    id: 'start',
    title: '처음 시작',
    tag: 'Start',
    summary: '캐릭터 설정, 목표 장비, 전술 스킬을 먼저 확인하고 시뮬레이션을 돌립니다.',
    links: [
      { href: '/characters', label: '캐릭터 설정' },
      { href: '/simulation', label: '게임 시작' },
      { href: '/help', label: '기본 도움말' },
    ],
  },
  {
    id: 'build',
    title: '빌드와 파밍',
    tag: 'Build',
    summary: '목표 장비 티어, 루트 파밍, 드론 호출, 키오스크 교환 흐름을 점검합니다.',
    links: [
      { href: '/details', label: '상세 설정' },
      { href: '/modifiers', label: '보정치' },
      { href: '/board?category=guide', label: '공략 글' },
    ],
  },
  {
    id: 'records',
    title: '전적 분석',
    tag: 'Records',
    summary: '캐릭터별·팀별 전적, 승률, KDA를 보고 밸런스와 조합을 비교합니다.',
    links: [
      { href: '/records', label: '기록소' },
      { href: '/board?category=simulation', label: '시뮬레이션 글' },
    ],
  },
  {
    id: 'community',
    title: '커뮤니티 플레이',
    tag: 'Community',
    summary: '게시판으로 공략과 버그를 모으고, 스무고개로 같이 맞히는 게임을 엽니다.',
    links: [
      { href: '/board', label: '게시판' },
      { href: '/twenty-questions', label: '스무고개' },
    ],
  },
];

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    featuredGuides: normalizeList(src.featuredGuides),
    recentGuides: normalizeList(src.recentGuides),
    recentDiscussions: normalizeList(src.recentDiscussions),
    categories: normalizeList(src.categories),
  };
}

function GuidePostList({ posts, empty }) {
  if (!posts.length) return <div className="guides-empty">{empty}</div>;

  return (
    <div className="guides-post-list">
      {posts.map((post) => (
        <Link href={`/board/${post._id}`} key={post._id || post.title}>
          <span>{CATEGORY_LABELS[post.category] || post.category || '글'}</span>
          <strong>{safeText(post.title, '제목 없음')}</strong>
          <p>{safeText(post.contentPreview, '미리보기가 없습니다.')}</p>
          <small>
            {safeText(post.authorName, '익명')} · 댓글 {Number(post.commentCount || 0).toLocaleString('ko-KR')} · {formatDate(post.createdAt)}
          </small>
        </Link>
      ))}
    </div>
  );
}

export default function GuidesPage() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [loading, setLoading] = useState(true);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetCached('/public/guides', {
        ttlMs: 60000,
        timeoutMs: 15000,
        storage: 'session',
      });
      setPayload(normalizePayload(data));
    } catch (err) {
      setPayload(normalizePayload(null));
      showToast({ tone: 'warning', message: err?.message || '가이드 정보를 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadGuides();
  }, [loadGuides]);

  const categoryMap = useMemo(() => new Map(payload.categories.map((row) => [row.category, row])), [payload.categories]);
  const featured = payload.featuredGuides.length ? payload.featuredGuides : payload.recentGuides.slice(0, 3);

  return (
    <main className="guides-page-shell">
      <SiteHeader />
      <section className="guides-page">
        <section className="guides-hero">
          <div>
            <p className="guides-kicker">Guides</p>
            <h1>가이드 허브</h1>
            <p>처음 시작, 빌드, 전적 분석, 커뮤니티 플레이로 이어지는 핵심 정보를 모았습니다.</p>
          </div>
          <Link href="/board?category=guide">공략 글 보기</Link>
        </section>

        <section className="guides-stats" aria-label="가이드 분류">
          {['guide', 'simulation', 'game', 'feedback', 'bug'].map((category) => {
            const row = categoryMap.get(category) || {};
            return (
              <Link href={`/board?category=${category}`} key={category}>
                <span>{CATEGORY_LABELS[category] || category}</span>
                <strong>{Number(row.count || 0).toLocaleString('ko-KR')}</strong>
                <small>{row.latestAt ? `${formatDate(row.latestAt)} 업데이트` : '게시글 없음'}</small>
              </Link>
            );
          })}
        </section>

        <section className="guides-wiki-grid" aria-label="위키 섹션">
          {WIKI_SECTIONS.map((section) => (
            <article className="guides-wiki-card" key={section.id}>
              <span>{section.tag}</span>
              <h2>{section.title}</h2>
              <p>{section.summary}</p>
              <div>
                {section.links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
              </div>
            </article>
          ))}
        </section>

        <div className="guides-content-grid">
          <section className="guides-panel">
            <div className="guides-panel-title">
              <h2>추천 공략</h2>
              <Link href="/board?category=guide">더 보기</Link>
            </div>
            {loading ? <div className="guides-empty">가이드 글을 불러오는 중입니다.</div> : (
              <GuidePostList posts={featured} empty="아직 추천 공략이 없습니다." />
            )}
          </section>

          <section className="guides-panel">
            <div className="guides-panel-title">
              <h2>최근 토론</h2>
              <Link href="/board">게시판</Link>
            </div>
            {loading ? <div className="guides-empty">최근 글을 불러오는 중입니다.</div> : (
              <GuidePostList posts={payload.recentDiscussions} empty="아직 토론 글이 없습니다." />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

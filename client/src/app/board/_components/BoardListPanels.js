import Link from 'next/link';

import {
  BOARD_CATEGORIES,
  BOARD_SORTS,
  categoryLabelFor,
  formatShortDate,
  gameLabelForSlug,
  getUserDisplayName,
  normalizeGameSlug,
  normalizeIdValue,
  normalizePostId,
  safeText,
} from '../_lib/boardListUtils';

export function BoardListToolbar(props) {
  const {
    categoryFilter,
    gameFilter,
    gameOptions,
    query,
    setCategoryFilter,
    setGameFilter,
    setPage,
    setQuery,
    setSortOrder,
    sortOrder,
  } = props;

  const pickCategory = (value) => {
    setCategoryFilter(value);
    setPage(1);
  };

  return (
    <div className="bd-toolbar">
      <div className="ui-tabs bd-cats" role="group" aria-label="분류">
        <button type="button" aria-pressed={!categoryFilter} onClick={() => pickCategory('')}>전체</button>
        {BOARD_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category.value}
            aria-pressed={categoryFilter === category.value}
            onClick={() => pickCategory(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div className="bd-filters">
        <input
          type="search"
          className="ui-input bd-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="제목, 내용, 작성자 검색"
          aria-label="게시글 검색"
        />
        <select
          className="ui-select"
          value={gameFilter}
          aria-label="게임"
          onChange={(event) => {
            setGameFilter(normalizeGameSlug(event.target.value));
            setPage(1);
          }}
        >
          <option value="">모든 게임</option>
          {gameFilter && !gameOptions.some((game) => game.value === gameFilter) ? (
            <option value={gameFilter}>{gameFilter}</option>
          ) : null}
          {gameOptions.map((game) => (
            <option key={game.value} value={game.value}>{game.label}</option>
          ))}
        </select>
        <select
          className="ui-select"
          value={sortOrder}
          aria-label="정렬"
          onChange={(event) => {
            setSortOrder(event.target.value);
            setPage(1);
          }}
        >
          {BOARD_SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>{sort.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function BoardWritePanel(props) {
  const {
    create,
    form,
    gameOptions,
    mounted,
    onCancel,
    setForm,
    submitting,
    token,
    user,
    writerOpen,
  } = props;

  if (!(mounted && token) || !writerOpen) return null;

  return (
    <section className="ui-panel bd-write" id="board-write-panel" aria-labelledby="bd-write-title">
      <div className="bd-write__head">
        <h2 id="bd-write-title">새 글</h2>
        {user ? <span>{getUserDisplayName(user)} 이름으로 올라갑니다</span> : null}
      </div>
      <div className="bd-write__selects">
        <select
          className="ui-select"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          aria-label="게시글 분류"
        >
          {BOARD_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
        <select
          className="ui-select"
          value={form.gameSlug}
          onChange={(event) => setForm({ ...form, gameSlug: normalizeGameSlug(event.target.value) })}
          aria-label="관련 게임"
        >
          <option value="">관련 게임 없음</option>
          {form.gameSlug && !gameOptions.some((game) => game.value === form.gameSlug) ? (
            <option value={form.gameSlug}>{form.gameSlug}</option>
          ) : null}
          {gameOptions.map((game) => (
            <option key={game.value} value={game.value}>{game.label}</option>
          ))}
        </select>
      </div>
      <input
        className="ui-input"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        placeholder="제목"
        aria-label="제목"
        maxLength={120}
      />
      <textarea
        className="ui-input bd-textarea"
        value={form.content}
        onChange={(event) => setForm({ ...form, content: event.target.value })}
        placeholder="내용"
        aria-label="내용"
        rows={6}
      />
      <div className="bd-write__actions">
        <button type="button" className="ui-button ui-button--quiet" onClick={onCancel}>취소</button>
        <button type="button" className="ui-button ui-button--primary" onClick={create} disabled={submitting}>
          {submitting ? '올리는 중...' : '글 올리기'}
        </button>
      </div>
    </section>
  );
}

export function BoardPostTable(props) {
  const {
    filteredPosts,
    gameOptions,
    loading,
    mounted,
    pagination,
    posts,
    isAdmin = false,
    remove,
    setPage,
    token,
    userId,
    hasFilters = false,
  } = props;

  return (
    <section className="ui-panel bd-list" aria-label="게시글 목록">
      {loading ? <p className="ui-empty">게시글을 불러오는 중입니다.</p> : null}

      {!loading && posts.length === 0 ? (
        <p className="ui-empty">{hasFilters ? '조건에 맞는 글이 없습니다. 검색어나 분류를 바꿔 보세요.' : '아직 작성된 글이 없습니다.'}</p>
      ) : null}

      {!loading && filteredPosts.length > 0 ? (
        <ul className="bd-rows">
          {filteredPosts.map((post) => {
            const id = post?._normalizedId || normalizePostId(post);
            const title = safeText(post?.title, '제목 없음');
            const preview = safeText(post?.contentPreview || post?.content, '');
            const canRemove = mounted && token && (
              isAdmin || (userId && normalizeIdValue(post?.authorId) === String(userId))
            );
            const gameLabel = gameLabelForSlug(gameOptions, post?.gameSlug);
            const authorName = safeText(post?.authorName, '익명');
            const comments = Number(post?.commentCount || 0);
            return (
              <li key={id || `${post?.title}-${post?.createdAt}`} className={`bd-row ${post?.isNotice ? 'is-notice' : ''}`}>
                <Link href={id ? `/board/${id}` : '/board'} className="bd-row__link">
                  <span className="bd-row__title">
                    {post?.isNotice ? <em className="ui-tag ui-tag--signal">공지</em> : null}
                    <em className="ui-tag">{safeText(post?.categoryLabel, categoryLabelFor(post?.category))}</em>
                    <span className="bd-row__text">{title}</span>
                    {comments > 0 ? <span className="bd-row__comments" aria-label={`댓글 ${comments}개`}>{comments}</span> : null}
                  </span>
                  {preview ? <span className="bd-row__preview">{preview}</span> : null}
                  <span className="bd-row__meta">
                    <span>{authorName}</span>
                    <span>{formatShortDate(post?.createdAt) || '날짜 없음'}</span>
                    <span>조회 {Number(post?.viewCount || 0)}</span>
                    <span>추천 {Number(post?.reactionCount || 0)}</span>
                    {gameLabel ? <span>{gameLabel}</span> : null}
                  </span>
                </Link>
                {canRemove ? (
                  <button type="button" className="bd-row__remove" onClick={() => remove(id)} aria-label={`${title} 삭제`}>
                    삭제
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && posts.length > 0 ? (
        <div className="bd-list__foot">
          <span>글 {pagination.total}개</span>
          {pagination.totalPages > 1 ? (
            <nav className="bd-pages" aria-label="게시판 페이지 이동">
              <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!pagination.hasPrev}>
                이전
              </button>
              <span className="ui-num">{pagination.page} / {pagination.totalPages}</span>
              <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={!pagination.hasNext}>
                다음
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

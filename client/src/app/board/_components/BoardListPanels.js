import Link from 'next/link';

import {
  BOARD_CATEGORIES,
  BOARD_PAGE_SIZE,
  BOARD_SORTS,
  formatDate,
  gameLabelForSlug,
  getUserDisplayName,
  normalizeGameSlug,
  normalizeIdValue,
  normalizePostId,
  safeText,
  userProfileHref,
} from '../_lib/boardListUtils';

export function BoardListToolbar(props) {
  const {
    categoryFilter,
    filteredCount,
    gameFilter,
    gameOptions,
    mounted,
    myPostCount,
    pagination,
    query,
    setCategoryFilter,
    setGameFilter,
    setPage,
    setQuery,
    setSortOrder,
    sortOrder,
    token,
  } = props;

  return (
    <div className="board-toolbar">
      <div className="board-counts">
        <span>전체 {pagination.total}</span>
        <span>현재 {filteredCount}</span>
        <span>{pagination.page}/{pagination.totalPages}페이지</span>
        {mounted && token ? <span>내 글 {myPostCount}</span> : null}
      </div>
      <label className="board-search">
        <span>검색</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="제목, 내용, 작성자"
        />
      </label>
      <label className="board-search board-category-filter">
        <span>분류</span>
        <select
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">전체</option>
          {BOARD_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
      </label>
      <label className="board-search board-game-filter">
        <span>게임</span>
        <select
          value={gameFilter}
          onChange={(event) => {
            setGameFilter(normalizeGameSlug(event.target.value));
            setPage(1);
          }}
        >
          <option value="">전체</option>
          {gameFilter && !gameOptions.some((game) => game.value === gameFilter) ? (
            <option value={gameFilter}>{gameFilter}</option>
          ) : null}
          {gameOptions.map((game) => (
            <option key={game.value} value={game.value}>{game.label}</option>
          ))}
        </select>
      </label>
      <label className="board-search board-sort-filter">
        <span>정렬</span>
        <select
          value={sortOrder}
          onChange={(event) => {
            setSortOrder(event.target.value);
            setPage(1);
          }}
        >
          {BOARD_SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>{sort.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function BoardWritePanel(props) {
  const {
    create,
    form,
    gameOptions,
    mounted,
    setForm,
    submitting,
    token,
    user,
    writerOpen,
  } = props;

  if (!(mounted && token && writerOpen)) {
    return <div className="board-login-note">로그인하면 글을 작성할 수 있습니다.</div>;
  }

  return (
    <div className="board-write-panel" id="board-write-panel">
      <div className="board-editor-title">
        글쓰기 {user ? <span>작성자 {getUserDisplayName(user)}</span> : null}
      </div>
      <div className="board-write-grid">
        <select
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          aria-label="게시글 분류"
        >
          {BOARD_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
        <select
          value={form.gameSlug}
          onChange={(event) => setForm({ ...form, gameSlug: normalizeGameSlug(event.target.value) })}
          aria-label="게임 선택"
        >
          <option value="">게임 선택 안함</option>
          {form.gameSlug && !gameOptions.some((game) => game.value === form.gameSlug) ? (
            <option value={form.gameSlug}>{form.gameSlug}</option>
          ) : null}
          {gameOptions.map((game) => (
            <option key={game.value} value={game.value}>{game.label}</option>
          ))}
        </select>
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="제목"
          maxLength={120}
        />
        <button type="button" onClick={create} disabled={submitting}>
          {submitting ? '작성 중...' : '등록'}
        </button>
      </div>
      <textarea
        value={form.content}
        onChange={(event) => setForm({ ...form, content: event.target.value })}
        placeholder="내용"
        rows={4}
      />
    </div>
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
    remove,
    setPage,
    token,
    userId,
  } = props;

  return (
    <div className="board-table-wrap">
      {loading ? <div className="board-empty">게시글을 불러오는 중입니다.</div> : null}

      {!loading && posts.length === 0 ? (
        <div className="board-empty">아직 작성된 글이 없습니다.</div>
      ) : null}

      {!loading && posts.length > 0 && filteredPosts.length === 0 ? (
        <div className="board-empty">검색 결과가 없습니다.</div>
      ) : null}

      {!loading && filteredPosts.length > 0 ? (
        <table className="board-table">
          <colgroup>
            <col className="board-col-no" />
            <col className="board-col-title" />
            <col className="board-col-author" />
            <col className="board-col-date" />
            <col className="board-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>번호</th>
              <th>제목</th>
              <th>작성자</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map((post, index) => {
              const id = post?._normalizedId || normalizePostId(post);
              const title = safeText(post?.title, '제목 없음');
              const preview = safeText(post?.contentPreview || post?.content, '');
              const canRemove = mounted && token && userId && normalizeIdValue(post?.authorId) === String(userId);
              const rowNo = Math.max(1, Number(pagination.total || filteredPosts.length) - ((Number(pagination.page || 1) - 1) * Number(pagination.limit || BOARD_PAGE_SIZE)) - index);
              const authorHref = userProfileHref(post?.authorId);
              const gameLabel = gameLabelForSlug(gameOptions, post?.gameSlug);
              const authorName = safeText(post?.authorName, '익명');
              return (
                <tr key={id || `${post?.title}-${post?.createdAt}`}>
                  <td className="board-cell-no" data-label="번호">{rowNo}</td>
                  <td className="board-cell-title" data-label="제목">
                    <Link href={id ? `/board/${id}` : '/board'} className={`board-row-title ${post?.isNotice ? 'is-notice' : ''}`}>
                      <span>{title}</span>
                      {gameLabel ? <small>{gameLabel}</small> : null}
                      <small>{preview ? `${preview}${preview.length >= 160 ? '...' : ''}` : '미리보기 없음'}</small>
                      <em>{post?.isNotice ? '공지 · ' : ''}조회 {Number(post?.viewCount || 0)} · 추천 {Number(post?.reactionCount || 0)} · 댓글 {Number(post?.commentCount || 0)}</em>
                    </Link>
                  </td>
                  <td data-label="작성자">
                    {authorHref ? <Link href={authorHref} className="profile-inline-link">{authorName}</Link> : authorName}
                  </td>
                  <td data-label="등록일">{formatDate(post?.createdAt)}</td>
                  <td className="board-cell-action" data-label="관리">
                    {canRemove ? (
                      <button type="button" className="board-danger board-danger-compact" onClick={() => remove(id)}>
                        삭제
                      </button>
                    ) : (
                      <span className="board-action-dash">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {!loading && pagination.totalPages > 1 ? (
        <div className="board-pagination" aria-label="게시판 페이지 이동">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!pagination.hasPrev}>
            이전
          </button>
          <span>{pagination.page} / {pagination.totalPages}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={!pagination.hasNext}>
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}

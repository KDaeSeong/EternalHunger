import Link from 'next/link';
import {
  BOARD_CATEGORIES,
  formatDate,
  normalizeGameSlug,
  safeText,
  userProfileHref,
} from '../_lib/boardUtils';

export default function BoardDetailPostView(props) {
  const {
    bookmarked,
    bookmarkLoading,
    bookmarkSaving,
    canEdit,
    canManageNotice,
    comments,
    editing,
    form,
    gameOptions,
    mounted,
    noticeSaving,
    openReport,
    post,
    postGameLabel,
    reacted,
    reactionLoading,
    reactionSaving,
    remove,
    save,
    saving,
    setEditing,
    setForm,
    token,
    toggleBookmark,
    toggleNotice,
    toggleReaction,
  } = props;

  return (
    <>
            {editing ? (
              <div className="board-editor board-editor-inline board-post-editor">
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
                  <option value="">게임 선택 안 함</option>
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
                <textarea
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="내용"
                  rows={10}
                />
                <div className="board-actions">
                  <button type="button" onClick={save} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button type="button" className="board-secondary" onClick={() => setEditing(false)}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="board-post-head">
                  <div className={`board-post-kicker ${post.isNotice ? 'is-notice' : ''}`}>
                    {post.isNotice ? `공지 · ${post.categoryLabel}` : post.categoryLabel}
                  </div>
                  <h2>{safeText(post.title, '제목 없음')}</h2>
                </div>
                {postGameLabel ? <div className="board-post-game">{postGameLabel}</div> : null}
                <dl className="board-post-meta">
                  <div>
                    <dt>작성자</dt>
                    <dd>
                      {userProfileHref(post.authorId) ? (
                        <Link href={userProfileHref(post.authorId)} className="profile-inline-link">
                          {safeText(post.authorName, '익명')}
                        </Link>
                      ) : safeText(post.authorName, '익명')}
                    </dd>
                  </div>
                  <div>
                    <dt>댓글</dt>
                    <dd>{Number(post.commentCount || comments.length)}</dd>
                  </div>
                  <div>
                    <dt>추천</dt>
                    <dd>{Number(post.reactionCount || 0)}</dd>
                  </div>
                  <div>
                    <dt>조회</dt>
                    <dd>{Number(post.viewCount || 0)}</dd>
                  </div>
                  <div>
                    <dt>등록일</dt>
                    <dd>{formatDate(post.createdAt)}</dd>
                  </div>
                  {post.updatedAt && post.updatedAt !== post.createdAt ? (
                    <div>
                      <dt>수정일</dt>
                      <dd>{formatDate(post.updatedAt)}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="board-detail-content">{safeText(post.content, '')}</p>
              </>
            )}

            {canEdit ? (
              <div className="board-actions">
                {!editing ? (
                  <button type="button" className="board-secondary" onClick={() => setEditing(true)}>
                    수정
                  </button>
                ) : null}
                <button type="button" className="board-danger" onClick={remove}>
                  삭제
                </button>
              </div>
            ) : null}

            {mounted && token && !editing ? (
              <div className="board-actions board-report-actions">
                <button
                  type="button"
                  className="board-secondary"
                  onClick={toggleReaction}
                  disabled={reactionSaving || reactionLoading}
                >
                  {reacted ? '추천됨' : '추천'}
                </button>
                <button
                  type="button"
                  className="board-secondary"
                  onClick={toggleBookmark}
                  disabled={bookmarkSaving || bookmarkLoading}
                >
                  {bookmarked ? '저장됨' : '저장'}
                </button>
                <button type="button" className="board-secondary" onClick={() => openReport({ targetType: 'post', label: '게시글' })}>
                  신고
                </button>
              </div>
            ) : null}

            {canManageNotice ? (
              <div className="board-actions board-admin-actions">
                <button
                  type="button"
                  className="board-secondary"
                  onClick={toggleNotice}
                  disabled={noticeSaving}
                >
                  {noticeSaving ? '저장 중...' : post.isNotice ? '공지 해제' : '공지 고정'}
                </button>
              </div>
            ) : null}

    </>
  );
}

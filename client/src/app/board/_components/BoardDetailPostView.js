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
    canDelete = canEdit,
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
              <div className="bd-write bd-post-editor">
                <h1 className="bd-post-editor__title">글 수정</h1>
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
                </div>
                <input
                  className="ui-input"
                  aria-label="제목"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="제목"
                  maxLength={120}
                />
                <textarea
                  className="ui-input bd-textarea"
                  aria-label="내용"
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="내용"
                  rows={10}
                />
                <div className="bd-write__actions">
                  <button type="button" className="ui-button ui-button--quiet" onClick={() => setEditing(false)}>
                    취소
                  </button>
                  <button type="button" className="ui-button ui-button--primary" onClick={save} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <header className="bd-post__head">
                  <p className="bd-post__tags">
                    {post.isNotice ? <em className="ui-tag ui-tag--signal">공지</em> : null}
                    <em className="ui-tag">{post.categoryLabel}</em>
                    {postGameLabel ? <em className="ui-tag ui-tag--blue">{postGameLabel}</em> : null}
                  </p>
                  <h1>{safeText(post.title, '제목 없음')}</h1>
                  <p className="bd-post__meta">
                    <span>
                      {userProfileHref(post.authorId) ? (
                        <Link href={userProfileHref(post.authorId)} className="bd-post__author">
                          {safeText(post.authorName, '익명')}
                        </Link>
                      ) : <strong className="bd-post__author">{safeText(post.authorName, '익명')}</strong>}
                    </span>
                    <span>{formatDate(post.createdAt)}</span>
                    {post.updatedAt && post.updatedAt !== post.createdAt ? <span>수정됨</span> : null}
                    <span>조회 {Number(post.viewCount || 0)}</span>
                    <span>추천 {Number(post.reactionCount || 0)}</span>
                    <span>댓글 {Number(post.commentCount || comments.length)}</span>
                  </p>
                </header>
                <div className="bd-post__body">{safeText(post.content, '')}</div>
              </>
            )}

            {!editing && ((mounted && token) || canEdit || canDelete || canManageNotice) ? (
              <div className="bd-post__actions">
                {mounted && token ? (
                  <div className="bd-post__actions-main">
                    <button
                      type="button"
                      className={`ui-button ${reacted ? 'ui-button--primary' : 'ui-button--quiet'}`}
                      onClick={toggleReaction}
                      disabled={reactionSaving || reactionLoading}
                      aria-pressed={reacted}
                    >
                      {reacted ? '추천함' : '추천'}
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--quiet"
                      onClick={toggleBookmark}
                      disabled={bookmarkSaving || bookmarkLoading}
                      aria-pressed={bookmarked}
                    >
                      {bookmarked ? '저장함' : '저장'}
                    </button>
                    <button type="button" className="bd-text-button" onClick={() => openReport({ targetType: 'post', label: '게시글' })}>
                      신고
                    </button>
                  </div>
                ) : <span />}
                {canEdit || canDelete || canManageNotice ? (
                  <div className="bd-post__actions-owner">
                    {canManageNotice ? (
                      <button type="button" className="bd-text-button" onClick={toggleNotice} disabled={noticeSaving}>
                        {noticeSaving ? '저장 중...' : post.isNotice ? '공지 해제' : '공지로 고정'}
                      </button>
                    ) : null}
                    {canEdit ? (
                      <button type="button" className="bd-text-button" onClick={() => setEditing(true)}>
                        수정
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="bd-text-button bd-text-button--danger" onClick={remove}>
                        삭제
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

    </>
  );
}

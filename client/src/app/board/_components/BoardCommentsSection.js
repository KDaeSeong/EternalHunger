import Link from 'next/link';
import {
  formatDate,
  normalizeIdValue,
  safeText,
  userProfileHref,
} from '../_lib/boardUtils';

export default function BoardCommentsSection(props) {
  const {
    cancelEditComment,
    commentSubmitting,
    commentText,
    comments,
    createComment,
    deletingCommentId,
    editingComment,
    editingCommentSaving,
    form,
    mounted,
    openReport,
    post,
    removeComment,
    setEditingComment,
    setCommentText,
    startEditComment,
    token,
    updateComment,
    userId,
    isAdmin = false,
  } = props;

  return (
    <>
            <section className="bd-comments" aria-labelledby="bd-comments-title">
              <h2 id="bd-comments-title">댓글 {comments.length}</h2>

              {mounted && token ? (
                <div className="bd-comment-form">
                  <textarea
                    className="ui-input bd-textarea"
                    aria-label="댓글"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="댓글을 입력하세요"
                    rows={3}
                    maxLength={1200}
                  />
                  <button type="button" className="ui-button ui-button--primary" onClick={createComment} disabled={commentSubmitting}>
                    {commentSubmitting ? '올리는 중...' : '댓글 달기'}
                  </button>
                </div>
              ) : (
                <p className="bd-comment-login"><Link href="/login">로그인</Link>하면 댓글을 달 수 있습니다.</p>
              )}

              <div className="bd-comment-list">
                {comments.length === 0 ? <p className="bd-comment-empty">아직 댓글이 없습니다.</p> : null}
                {comments.map((comment) => {
                  const commentId = comment?._normalizedId || normalizeIdValue(comment?._id || comment?.id);
                  const canRemoveComment = mounted && token && (isAdmin || (userId && (
                    normalizeIdValue(comment?.authorId) === String(userId) ||
                    normalizeIdValue(post?.authorId) === String(userId)
                  )));
                  const canEditComment = mounted && token && userId && normalizeIdValue(comment?.authorId) === String(userId);
                  const isEditingComment = editingComment.id === commentId;
                  return (
                    <article className="bd-comment" key={commentId || `${comment.authorName}-${comment.createdAt}`}>
                      <div className="bd-comment__head">
                        {userProfileHref(comment.authorId) ? (
                          <Link href={userProfileHref(comment.authorId)} className="profile-inline-link">
                            <strong>{safeText(comment.authorName, '익명')}</strong>
                          </Link>
                        ) : <strong>{safeText(comment.authorName, '익명')}</strong>}
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      {isEditingComment ? (
                        <div className="bd-comment__edit">
                          <textarea
                            className="ui-input bd-textarea"
                            aria-label="댓글 수정"
                            value={editingComment.content}
                            onChange={(event) => setEditingComment({ id: commentId, content: event.target.value })}
                            rows={3}
                            maxLength={1200}
                          />
                          <div className="bd-write__actions">
                            <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={cancelEditComment} disabled={editingCommentSaving}>
                              취소
                            </button>
                            <button type="button" className="ui-button ui-button--primary ui-button--small" onClick={updateComment} disabled={editingCommentSaving}>
                              {editingCommentSaving ? '저장 중...' : '저장'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="bd-comment__body">{safeText(comment.content, '')}</p>
                      )}
                      <div className="bd-comment__actions">
                        {mounted && token ? (
                          <button type="button" className="bd-text-button" onClick={() => openReport({ targetType: 'comment', commentId, label: '댓글' })}>
                            신고
                          </button>
                        ) : null}
                        {canEditComment && !isEditingComment ? (
                          <button type="button" className="bd-text-button" onClick={() => startEditComment(comment)}>
                            수정
                          </button>
                        ) : null}
                        {canRemoveComment ? (
                          <button
                            type="button"
                            className="bd-text-button bd-text-button--danger"
                            onClick={() => removeComment(commentId)}
                            disabled={deletingCommentId === commentId}
                          >
                            {deletingCommentId === commentId ? '삭제 중...' : '삭제'}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
    </>
  );
}

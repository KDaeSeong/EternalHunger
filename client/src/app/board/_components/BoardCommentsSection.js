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
  } = props;

  return (
    <>
            <section className="board-comments">
              <div className="board-comments-head">
                <h3>댓글 {comments.length}</h3>
              </div>

              {mounted && token ? (
                <div className="board-comment-form">
                  <textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="댓글을 입력하세요"
                    rows={3}
                    maxLength={1200}
                  />
                  <button type="button" onClick={createComment} disabled={commentSubmitting}>
                    {commentSubmitting ? '작성 중...' : '댓글 작성'}
                  </button>
                </div>
              ) : (
                <div className="board-login-note board-comment-login">로그인하면 댓글을 작성할 수 있습니다.</div>
              )}

              <div className="board-comment-list">
                {comments.length === 0 ? <div className="board-empty board-comment-empty">아직 댓글이 없습니다.</div> : null}
                {comments.map((comment) => {
                  const commentId = comment?._normalizedId || normalizeIdValue(comment?._id || comment?.id);
                  const canRemoveComment = mounted && token && userId && (
                    normalizeIdValue(comment?.authorId) === String(userId) ||
                    normalizeIdValue(post?.authorId) === String(userId)
                  );
                  const canEditComment = mounted && token && userId && normalizeIdValue(comment?.authorId) === String(userId);
                  const isEditingComment = editingComment.id === commentId;
                  return (
                    <article className="board-comment-item" key={commentId || `${comment.authorName}-${comment.createdAt}`}>
                      <div>
                        {userProfileHref(comment.authorId) ? (
                          <Link href={userProfileHref(comment.authorId)} className="profile-inline-link">
                            <strong>{safeText(comment.authorName, '익명')}</strong>
                          </Link>
                        ) : <strong>{safeText(comment.authorName, '익명')}</strong>}
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      {isEditingComment ? (
                        <div className="board-comment-edit">
                          <textarea
                            value={editingComment.content}
                            onChange={(event) => setEditingComment({ id: commentId, content: event.target.value })}
                            rows={3}
                            maxLength={1200}
                          />
                          <div className="board-comment-actions">
                            <button type="button" onClick={updateComment} disabled={editingCommentSaving}>
                              {editingCommentSaving ? '저장 중...' : '저장'}
                            </button>
                            <button type="button" className="board-secondary" onClick={cancelEditComment} disabled={editingCommentSaving}>
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p>{safeText(comment.content, '')}</p>
                      )}
                      <div className="board-comment-actions">
                        {mounted && token ? (
                          <button type="button" className="board-secondary board-danger-compact" onClick={() => openReport({ targetType: 'comment', commentId, label: '댓글' })}>
                            신고
                          </button>
                        ) : null}
                        {canEditComment && !isEditingComment ? (
                          <button type="button" className="board-secondary" onClick={() => startEditComment(comment)}>
                            수정
                          </button>
                        ) : null}
                        {canRemoveComment ? (
                          <button
                            type="button"
                            className="board-danger board-danger-compact"
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

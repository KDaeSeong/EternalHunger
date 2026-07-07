export default function BoardReportPanel(props) {
  const {
    comments,
    reportForm,
    reportSubmitting,
    reportTarget,
    setReportForm,
    setReportTarget,
    submitReport,
  } = props;

  return (
    <>
            {reportTarget ? (
              <section className="board-report-panel">
                <div className="board-comments-head">
                  <h3>{reportTarget.label} 신고</h3>
                </div>
                <div className="board-report-grid">
                  <select
                    value={reportForm.reason}
                    onChange={(event) => setReportForm({ ...reportForm, reason: event.target.value })}
                    aria-label="신고 사유"
                  >
                    <option value="spam">스팸</option>
                    <option value="abuse">욕설/비방</option>
                    <option value="spoiler">스포일러</option>
                    <option value="offtopic">주제 이탈</option>
                    <option value="other">기타</option>
                  </select>
                  <textarea
                    value={reportForm.detail}
                    onChange={(event) => setReportForm({ ...reportForm, detail: event.target.value })}
                    placeholder="상세 내용을 입력하세요"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="board-actions board-report-submit">
                    <button type="button" onClick={submitReport} disabled={reportSubmitting}>
                      {reportSubmitting ? '접수 중...' : '신고 접수'}
                    </button>
                    <button type="button" className="board-secondary" onClick={() => setReportTarget(null)} disabled={reportSubmitting}>
                      취소
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

    </>
  );
}

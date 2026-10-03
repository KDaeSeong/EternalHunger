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
              <section className="ui-panel bd-report" aria-labelledby="bd-report-title">
                <h2 id="bd-report-title">{reportTarget.label} 신고</h2>
                <div className="bd-report__grid">
                  <select
                    className="ui-select"
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
                    className="ui-input bd-textarea"
                    aria-label="신고 내용"
                    value={reportForm.detail}
                    onChange={(event) => setReportForm({ ...reportForm, detail: event.target.value })}
                    placeholder="어떤 점이 문제인지 적어 주세요"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="bd-write__actions">
                    <button type="button" className="ui-button ui-button--quiet" onClick={() => setReportTarget(null)} disabled={reportSubmitting}>
                      취소
                    </button>
                    <button type="button" className="ui-button ui-button--danger" onClick={submitReport} disabled={reportSubmitting}>
                      {reportSubmitting ? '접수 중...' : '신고 접수'}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

    </>
  );
}

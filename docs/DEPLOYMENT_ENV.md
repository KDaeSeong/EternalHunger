# 배포 환경변수

## 필수 구성

### Express 서버

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `MONGO_URI` | 예 | MongoDB 연결 문자열 |
| `MY_SECRET_KEY` | 예 | JWT 서명 키. 최소 32자 |
| `CORS_ORIGINS` | 운영 시 예 | 자격 증명 요청을 허용할 정확한 프런트엔드 Origin 목록 |
| `PORT` | 아니요 | 기본값 `5000` |
| `JSON_BODY_LIMIT` | 아니요 | 전역 요청 본문 제한. 기본값 `2mb` |
| `TRUST_PROXY_HOPS` | 아니요 | 신뢰할 프록시 hop 수. 기본값 `0`; 실제 reverse proxy 배포에서만 명시 |

서버는 MongoDB 연결과 기본 아이템 시드가 모두 성공한 뒤에만 포트를 열며, 실패 시 종료 코드 `1`을 설정합니다. `/api/public/ping`은 MongoDB가 연결되지 않았을 때 HTTP `503`을 반환합니다.

### Next 클라이언트

| 변수 | 환경 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | 로컬 선택 | 브라우저가 직접 호출할 Express 주소 |
| `BACKEND_BASE_URL` | 배포 필수 | Next의 `/api/proxy`가 전달할 Express 주소 |
| `AUTH_PROXY_CREDENTIAL_ORIGINS` | 인증 사용 시 필수 | 쿠키/Bearer 자격증명을 전달할 정확한 Express Origin allowlist |

운영 배포에서는 `BACKEND_BASE_URL`을 반드시 명시합니다. 하드코딩된 외부 fallback은 제거되었습니다. 루프백 외 서버에서 로그인 세션을 사용하려면 같은 Express Origin을 `AUTH_PROXY_CREDENTIAL_ORIGINS`에도 명시해야 하며, 두 값이 다르면 인증 프록시는 HTTP 503으로 닫힙니다.

## 보안 제한

- `CORS_ORIGINS`는 `*`가 아니라 쉼표로 구분한 정확한 Origin을 사용합니다.
- `MY_SECRET_KEY`와 외부 API 키는 클라이언트 공개 환경변수로 만들지 않습니다.
- JWT는 HttpOnly 쿠키에만 저장하며 변경 요청은 `eh_csrf` 쿠키와 `X-CSRF-Token` 헤더를 대조합니다.
- 운영 HTTPS에서는 서버의 `COOKIE_SECURE=true`를 사용합니다.
- 로그인·가입·비밀번호 복구·AI 분석 제한은 MongoDB 공유 버킷을 사용하므로 서버 인스턴스 수와 무관하게 적용됩니다.
- 클라이언트가 제출한 Eternal Hunger 경기 결과는 `trustedOutcome=false`인 미검증 기록이며 LP·크레딧·공개 전적을 지급하지 않습니다.

## AI 분석

`GOOGLE_API_KEY`가 없으면 `/api/analyze`는 HTTP `503`과 `AI_NOT_CONFIGURED`를 반환합니다. 상위 AI 서비스 실패나 비정상 JSON은 HTTP `502`와 `AI_UPSTREAM_FAILURE`를 반환하며 가짜 기본 능력치를 성공 응답으로 만들지 않습니다.

## 예시 파일

- 서버: `server/.env.example`
- 클라이언트: `client/.env.local.example`

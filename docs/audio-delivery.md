# 게임 음원 배포

게임 14종의 배경음 104곡은 공개 R2 버킷의 MP3를 사용한다. 기본 음원 루트는 `https://pub-38fd672431c94a81bb1c23804abd21da.r2.dev`다. 버킷 안의 경로는 `<게임>/<곡>.mp3`이며 `audio/` 접두사가 없다. 예를 들어 `ba-srpg/battle.mp3`를 사용한다.

음원 주소에는 공개 파일 위치만 포함한다. R2 계정 키나 업로드용 자격 증명은 웹 클라이언트에 넣지 않는다. 버킷은 운영 사이트 `https://eternal-hunger.vercel.app`과 허용한 로컬 개발 주소에 GET·HEAD를 허용하도록 CORS를 설정한다.

## 설정

환경 변수를 설정하지 않으면 위 R2 루트와 MP3 형식을 사용한다. 공개 설정은 Next.js 빌드 시 포함되므로 값을 바꾸면 다시 빌드해야 한다.

| 설정 | 의미 |
|---|---|
| `NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL` | 실제 음원 루트. 원격 루트 뒤에 `<게임>/<곡>.<형식>`을 붙이며 기존 경로 접두사는 보존한다. |
| `NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT` | `mp3` 또는 `wav`. 기본값은 `mp3`다. |
| `EH_RENDERED_AUDIO_ROOT` | 품질 검사에 사용할 원본 WAV 폴더의 절대 경로. 그 아래에 `<게임>/<곡>.wav`가 있어야 한다. 브라우저 재생 설정과 별개다. |

로컬 원본 재생은 두 공개 값을 함께 지정한다.

```dotenv
NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL=
NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT=wav
```

이 경우 `client/public/audio/<게임>/<곡>.wav`가 필요하다. 원격 루트를 선택하면 로컬 공개 재생 파일은 요구하지 않는다. 로컬 재생을 선택했는데 파일이 없으면 빌드 전 검사가 실패한다.

## 원본과 검사

`assetKey`는 원본을 식별하는 `audio/<게임>/<곡>.wav` 형식을 유지한다. 재생 주소만 MP3로 바꾼다. 기존 품질 검사 14종은 원본 WAV를 계속 검사하며 원본이 없으면 실패한다. MP3나 과거 검사 결과로 원본 검사를 대신하지 않는다.

- `npm run check:rendered-audio-assets`: 설정과 등록 음원 주소를 검사한다. 네트워크 요청은 하지 않는다.
- `npm run check:rendered-audio-delivery`: 현재 로컬/원격 재생 설정과 로컬 파일 존재를 검사한다. 원격 파일의 실제 응답을 보증하는 검사는 아니다.
- `node scripts/check-rendered-audio-delivery.test.mjs`: 임시 입력으로 누락 파일·잘못된 설정·원본 품질 검사 경로를 확인한다.
- `node scripts/check-<게임>-rendered-audio.mjs`: 보존한 원본의 길이·PCM·음량 등 기존 품질 조건을 검사한다.

공개 기본값과 파일 존재 검사는 `prebuild`에 포함된다. 배포 검사는 네트워크를 요구하지 않으며 새 저장소를 받은 환경에 원본 WAV가 없어도 원격 재생 설정으로 빌드할 수 있다. 품질 검사를 하려면 별도로 보존한 원본 경로를 준비해야 한다.

원본 WAV와 업로드한 MP3는 로컬에 보존한다. WAV를 현재 Git 추적에서 제외해도 과거 Git 이력의 파일이나 로컬 원본이 삭제되는 것은 아니다. 변경 후 GitHub의 현재 버전 소스 묶음과 이후 배포에는 WAV가 포함되지 않는다.

# blh-png — 블천 SVG → PNG 래스터 변환기

안드로이드 앱은 SVG를 렌더하지 못해 위젯이 백지·깨짐이 된다(부록 F-4).
`<img>`로 띄운 SVG는 브라우저 보안상 외부 폰트를 못 가져온다(F-5).
이 함수가 두 문제를 동시에 해결한다 — **PNG 변환이 곧 폰트 적용 수단**이다.

## 배포

1. GitHub에 새 저장소 `blh-png` 생성 (private 무관)
2. 이 폴더 전체를 업로드 → Commit
   ```
   api/png.js
   fontconfig/fonts.conf
   fonts/            ← 폰트 8종
   package.json
   vercel.json
   ```
3. Vercel → Add New Project → 그 저장소 Import → 설정 그대로 Deploy
4. 도메인을 `blh-png.vercel.app` 으로 지정 (Settings ▸ Domains)
5. 브라우저 테스트
   ```
   https://blh-png.vercel.app/api/png?u=https%3A%2F%2Fsj1.uk%2Fblh%2F%EA%B7%BC%EB%AC%B4%3Fa%3D4%26s%3D4
   ```
   근무 스트립 PNG가 한글로 나오면 성공.

## 폰트 매핑

| 경로 | serif (본문·제목) | sans (라벨·UI) |
|---|---|---|
| 근무 · 전표 · 주간 · 달력 | **Bookk Myungjo** | Pretendard |
| 편지에제리엘 · 일기에제리엘 | **Nanum DaeGwangYuRi** | Pretendard |
| 편지리에른 · 일기리에른 | **Nanum MaGoCe** | Pretendard |
| 편지테스리온 · 일기테스리온 | **Nanum YaGeunHaNeunGimJuIm** | Pretendard |
| 편지하르벨 · 일기하르벨 | **Nanum DarEuiGweDo** | Pretendard |
| 편지/일기 + {user} 이름 | Bookk Myungjo | Pretendard |
| 그 외 (폰 · 커뮤 · 동네 · 게시판) | Pretendard | Pretendard |

패밀리명은 `name` 테이블에서 실측한 값이다(F-5 — 추정 금지, 실측 검증 후 채택).
`에제`·`리에`·`테스`·`하르` 두 글자 약칭도 매칭된다.

## 워커 쪽 필수 수정

블천 워커의 폰트 상수를 바꿔야 필체가 실린다.

```js
// 현재
const FONT = `'Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
const HAND_FONT = `'Nanum Pen Script','Nanum Brush Script','Apple SD Gothic Neo','Malgun Gothic',sans-serif`;

// 수정
const FONT = `'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
const HAND_FONT = `'Nanum Pen Script','Apple SD Gothic Neo',serif`;   // ★ sans-serif → serif
const SERIF_FONT = `'Bookk Myungjo','Batang',serif`;                  // 공문서 제목용
```

**`HAND_FONT` 끝을 `sans-serif`에서 `serif`로 바꾸는 게 핵심이다.**
변환기의 `decide()`가 `sans-serif`가 보이면 산세리프로 분류하므로, 지금 상태로는
손글씨 자리가 전부 Pretendard로 떨어진다.

## 캐싱 (F-7)

`Cache-Control: max-age=600, s-maxage=3600`.
렌더가 바뀌었는데 옛 그림이 계속 나오면 **워커 쪽 `&v=1` 숫자를 올린다.**
긴 캐시는 고장 상태를 그대로 박제한다.

## 도메인 제한

```
^https://(sj1|s2gye)\.uk/(blh|mha)/
```

- `sj1.uk` — 위젯 본 도메인 (`/blh/근무` `/blh/전표` 등)
- `s2gye.uk` — 보조 도메인. 삽화 PNG를 R2에서 꺼내는 경로가 여기로 붙는다
- `blh` — 현행 접두어 / `mha` — 워커가 아직 받는 구 접두어. 옛 채팅 URL 보존용(F-2)

**경로까지 좁히는 게 중요하다.** `s2gye.uk`는 백야(`/wnf/`)도 쓰는 도메인이라
도메인만 열어두면 백야 위젯이 이 변환기를 타고 Vercel 캡을 함께 잡아먹는다.

**삽화 PNG는 변환 대상이 아니다.** 워커 프록시가 `/\.(png|webp|jpg|jpeg)$/` 를
먼저 걸러 `serveAsset()` 으로 넘기므로 이 함수까지 오지 않는다.
이미 PNG인 파일을 다시 PNG로 굽는 건 낭비이고, R2의 `immutable` 캐시도 깨진다.

## 실패 모드

| 증상 | 원인 | 조치 |
|---|---|---|
| `bad url` | `u=` 가 sj1.uk가 아님 | 워커의 `orig` 도메인 확인 |
| `origin 4xx/5xx` | 워커가 SVG를 안 줌 | `?svg=1` 붙여 직접 열어 확인 |
| 한글이 □□□ | fontconfig 색인 실패 | `vercel.json`의 `includeFiles` 확인, 재배포 |
| 필체가 전부 프리텐다드 | 워커 `HAND_FONT` 끝이 `sans-serif` | 위 워커 수정 적용 |
| 무한 루프 | 워커가 `svg=1` 없이 원본 요청 | 워커 프록시의 재귀 방지 확인 |

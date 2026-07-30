/* blh SVG → PNG 래스터 함수 (Vercel 무료 · sharp/libvips+pango)
 * /api/png?u=<sj1.uk SVG 위젯 URL>
 * pango+fontconfig가 fonts/ 폴더를 색인하므로 패밀리 매칭이 브라우저 수준으로 동작한다.
 * 폰트 선택 = 렌더 직전 SVG의 font-family를 정확한 패밀리명으로 리태깅. */
process.env.FONTCONFIG_PATH = require("path").join(process.cwd(), "fontconfig");
const sharp = require("sharp");

/* fc-list / name 테이블 실측 패밀리명 (추정 금지) */
const UI     = "Pretendard";          // Regular + Bold 동일 패밀리
const MYUNGJO = "Bookk Myungjo";      // Light + Bold 동일 패밀리
const HAND = {
  에제리엘: "Nanum DaeGwangYuRi",
  리에른:   "Nanum MaGoCe",
  테스리온: "Nanum YaGeunHaNeunGimJuIm",
  하르벨:   "Nanum DarEuiGweDo",
};
/* 워커가 font-family에 직접 박아 보낸 필체. 이게 보이면 그대로 존중한다.
 * 변환기가 URL을 다시 해석하는 경로는 이름이 없을 때만 쓰는 예비책이다. */
const KNOWN = [...Object.values(HAND), MYUNGJO, UI];

function pickFams(u) {
  let route = "", q = new URLSearchParams();
  try {
    const url = new URL(u);
    route = decodeURIComponent(url.pathname.split("/").pop() || "");
    q = url.searchParams;
  } catch (e) {}

  /* 일기·편지 = 작성자(발신인) 필체. 경로 뒤 이름으로 판정. */
  if (/일기|편지|diary|letter/i.test(route)) {
    const seg = route.replace(/^(일기|편지|diary|letter)/, "").trim();
    for (const [name, fam] of Object.entries(HAND)) {
      const short = name.slice(0, 2);                       // 에제·리에·테스·하르
      if (seg.includes(name) || seg.includes(short)) return { serif: fam, sans: UI };
    }
    /* 이름이 캐릭터가 아니면 {user} 본인 작성 → 명조(직접 쓴 손) */
    return { serif: MYUNGJO, sans: UI };
  }

  /* 공문서 계열 = 제목·본문 명조, 라벨 프리텐다드 */
  if (/근무|전표|주간|달력|duty|slip|week|calendar/i.test(route))
    return { serif: MYUNGJO, sans: UI };

  return { serif: UI, sans: UI };
}

/* 세리프 스택(Batang·Myungjo·serif)=본문 필체, 그 외=산세리프(UI) */
function retag(svg, fams) {
  /* 브라우저용 반응형 선언(style width:100%)은 래스터 크기 계산을 흐리므로 제거 */
  svg = svg.replace(/(<svg[^>]*?)\s+style="[^"]*"/, "$1");
  const decide = (v) => {
    const named = KNOWN.find((f) => v.indexOf(f) >= 0);
    if (named) return named;                                // 워커 지정 필체 우선
    return /batang|myungjo|pen script|brush|(^|[^-])serif/i.test(v) && !/sans-serif/i.test(v)
      ? fams.serif : fams.sans;
  };
  return svg
    .replace(/font-family\s*:\s*([^;}"<]+)/g, (m, v) => "font-family:'" + decide(v) + "'")
    .replace(/font-family\s*=\s*"([^"]*)"/g, (m, v) => 'font-family="' + decide(v).replace(/"/g, "") + '"');
}

module.exports = async (req, res) => {
  try {
    const u = req.query.u || "";
    /* sj1.uk = 위젯 본 도메인 / s2gye.uk = 보조(삽화 R2 경유).
     * 경로는 워커가 받는 접두어(/blh · 구 /mha)로 한정 — 도메인만 열면
     * s2gye.uk를 함께 쓰는 백야(/wnf) 위젯까지 이 변환기를 타 캡을 잡아먹는다. */
    if (!/^https:\/\/(sj1|s2gye)\.uk\/(blh|mha)\//.test(u)) { res.status(400).send("bad url"); return; }
    const r = await fetch(u, { headers: { "User-Agent": "blh-raster/1.0" } });
    if (!r.ok) { res.status(502).send("origin " + r.status); return; }
    const svg = retag(await r.text(), pickFams(u));
    /* 출력 폭을 픽셀로 직접 고정(density는 viewBox 물리크기에 좌우돼 들쭉날쭉).
     * 고해상도 렌더 후 정확한 폭으로 리사이즈. 원판 700px → 1680px = 2.4배 */
    const TARGET_W = 1680;
    const png = await sharp(Buffer.from(svg), { density: 384 })
      .resize({ width: TARGET_W })
      .png({ compressionLevel: 9 })
      .toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
    res.status(200).send(png);
  } catch (e) {
    res.status(500).send("render error: " + (e && e.message));
  }
};

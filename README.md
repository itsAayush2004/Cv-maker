# CV Forge — ATS-proof CV maker

Keep **one memory** of your whole career. Paste any job description. Get a **tailored, ATS-proof CV** in seconds, plus a score, the gaps, and fixes. It also exports a **portfolio website** from the same memory.

- **Works offline, no install, no account.** Open `index.html` in any modern browser. Your data stays in your browser.
- **Doesn't crash.** Every input is validated and repaired. Every action is error-guarded. Storage autosaves and keeps rolling snapshots, and recovers from corrupted data or blocked storage. Covered by unit tests and a browser end-to-end test that feeds it hostile input.
- **Honest by design.** It only uses facts from your memory. It never invents skills, titles, seniority, dates or numbers. Missing keywords are shown to you as gaps instead of being stuffed in.

## Quick start

1. Open `index.html` (double-click works). Or run `npm start` and go to http://localhost:8080.
2. **My Memory**: click **Paste existing CV**, or **More ▾ → Load Aayush starter draft**, then fill in the gaps. Add more than fits on one page: every role, project, bullet and skill.
3. **Target Job**: paste the full job post. You'll see the keywords sorted into must-have, important and nice-to-have, each checked against your memory.
4. **Tailored CV**: review the score, gaps and checks. Edit the headline or summary live. Download **PDF** or **Word (.docx)**.
5. **Save to Applications** to track every job you apply to.

> **Back up your memory:** use **Export backup** to download a JSON file. Import it on any device. JSON Resume files are accepted too.

## How it builds a CV for a job

| Step | What happens |
|---|---|
| Research the job | It splits the post into sections (requirements, responsibilities, nice-to-have, benefits, about). It pulls out the title, company, seniority, years and degree. It finds about 400 known skills plus their aliases (e.g. `k8s` → Kubernetes, `Postgres` → PostgreSQL), repeated domain phrases, and product names. Each keyword is weighted by where it appears: requirements > responsibilities > nice-to-have, and the title counts most. Benefits and the company blurb are ignored. |
| Match your memory | Every keyword is checked against everything you've stored, including the free-form "Extra memory" notes. |
| Tailor | Bullets are ranked by keyword relevance, numbers and action verbs. The top 5 are kept for your 2 most recent roles and 3 for older ones (you can change this). The most relevant projects are picked. Matched skills come first, **in the job post's own spelling**. The headline mirrors the job title only when your memory supports it, and seniority words ("Senior", "Lead") are dropped unless one of your own titles has them. A targeted summary is written from your own facts. |
| Score | **ATS score = 70% keyword coverage** (must-haves count more) **+ 30% format and content checks**. |
| Check | Contact details are in the body. Layout is a single column. Bullets are quantified, start with action verbs, avoid first-person pronouns and stay 1–2 lines. Length, dates, keyword stuffing, headline-to-title match, and years required vs. shown are all checked. |

### ATS rules every template follows
- Single column, with standard section names: Summary, Skills, Experience, Projects, Education, Certifications.
- Real text only: no tables, text boxes, icons, images, or contact details in headers or footers.
- A standard font (Calibri/Georgia), with dates in one format ("Mar 2022 – Present").
- **.docx** uses Word's built-in Title, Heading 1 and bullet-list styles. The **PDF** is text-based with embedded Unicode fonts. Both were checked by extracting their text: it comes out in clean reading order.
- File name is `Your_Name_CV_Company.docx/pdf`.

## Optional AI mode (Claude)

It's off by default; everything above works without it. In **Settings**, turn on AI mode and paste your Anthropic API key. It then:
1. **Researches the company and role on the web**: products, tech stack, what screeners look for, and culture language.
2. **Rewrites your CV** in the job's language. It is strictly told to use only facts from your memory. Its output is validated: any skill it adds that isn't in your memory is removed. If anything fails, you keep the offline CV.

The key is stored only in your browser and sent only to `api.anthropic.com`. The default model is Claude Opus 5.5; Sonnet 5.5 and Haiku 5.5 are cheaper options. Refusal fallbacks (`fallbacks: "default"`) are turned on.

## Files

```
index.html          the app (open this)
css/app.css         UI styles (light/dark)
js/util.js          helpers (escaping, dates, safe())
js/skills-db.js     skill/keyword knowledge base + matcher
js/profile.js       memory schema, repair/normalise, storage + snapshots
js/analyzer.js      job-description research
js/tailor.js        tailoring, scoring, ATS checks
js/render.js        CV HTML/PDF, Markdown, text, portfolio site
js/docx.js          dependency-free Word (.docx) writer
js/importer.js      paste-a-CV parser + memory merge
js/ai.js            optional Claude research + rewrite
js/app.js           UI controller
data/profiles.js    starter draft, example profile, example job
tests/              unit tests (node --test) + browser e2e (Playwright)
```

## Tests

```bash
npm test          # engine unit tests (Node 18+)
npm run e2e       # full browser run-through (needs Playwright + Chromium)
```

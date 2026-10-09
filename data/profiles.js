/* Built-in profiles you can load from My Memory.
 * - STARTER: Aayush Kumar's memory, built from Aayush's four role CVs (Game, Web, Animator, Social Media).
 *   Contact details are left out because this repo is public — import private/aayush-memory.json for the full version.
 * - EXAMPLE: a fictional person, handy for trying the app. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};

  CVM.STARTER_PROFILE = {
    "basics": {
      "name": "Aayush Kumar",
      "headline": "Game Developer",
      "email": "",
      "phone": "",
      "location": "Jaipur, Rajasthan, India",
      "links": [
        {
          "label": "Portfolio",
          "url": "https://arthis.land"
        },
        {
          "label": "GitHub",
          "url": "https://github.com/akversebusiness-beep"
        },
        {
          "label": "YouTube",
          "url": "https://youtube.com/@AKverseOfficial"
        },
        {
          "label": "Website",
          "url": "https://arthis.space"
        }
      ],
      "headlines": [
        "Website Developer · Backend Focused",
        "Animator · Motion Content Creator",
        "Social Media Manager · Content Creator",
        "Game Developer · Unity & Unreal"
      ]
    },
    "summary": "Game development student at MNIT Jaipur building gameplay systems, procedural content and custom editor tooling in Unity and Unreal Engine. Comfortable across the pipeline — C# gameplay code, 3D assets in Blender, and editor extensions that speed up level design. JEE Advanced All India Rank 8956.\n\nWeb developer at MNIT Jaipur focused on backend systems for interactive, data-driven websites. Builds React front-ends powered by Supabase and PostgreSQL with live data synchronisation, and has shipped two web projects as the backend developer. JEE Advanced All India Rank 8956.\n\nAnimator and motion content creator focused on 3D animation: rigs models from scratch and animates them, mostly in Blender, and built an automated pipeline that produces animated reels at scale. Runs the AKverse channels, publishing animation, papercraft and paper-model work. MNIT Jaipur student, JEE Advanced All India Rank 8956.\n\nContent creator and social media manager running AKverse, a multi-platform creative brand spanning YouTube and Instagram. Owns the complete content cycle — strategy, short-form video production, scripting, publishing and community growth — and combines a strong sense for engaging content with the technical skill to build automation tools that scale output. MNIT Jaipur student and JEE Advanced All India Rank 8956.",
    "skills": [
      "Unity",
      "C#",
      "Unreal Engine",
      "Blender",
      "Procedural Generation",
      "Gameplay Scripting",
      "Unity Editor Tooling",
      "Prefab & Asset Pipelines",
      "3D Math",
      "React",
      "JavaScript",
      "HTML",
      "CSS",
      "Supabase",
      "PostgreSQL",
      "Database Schema Design",
      "Realtime Data Sync",
      "REST APIs",
      "MCP",
      "C++",
      "Java",
      "Python",
      "React Native",
      "Git",
      "Browser DevTools",
      "Data Structures & Algorithms",
      "Object-Oriented Programming",
      "3D Animation",
      "Character Animation",
      "Rigging",
      "Motion Graphics",
      "3D Modeling",
      "Papercraft Design",
      "Short-form Video",
      "Content Strategy",
      "Scriptwriting",
      "Thumbnail Design",
      "Channel Branding",
      "Community Management",
      "Audience Growth",
      "Automation",
      "Visual Storytelling",
      "Content Creation",
      "Social Media Management",
      "Video Editing",
      "Game Development",
      "Full Stack Development"
    ],
    "experience": [
      {
        "role": "Founder & Creator",
        "company": "AKverse (YouTube @AKverseOfficial, Instagram)",
        "location": "Jaipur",
        "start": "",
        "end": "",
        "current": true,
        "tech": [
          "Blender",
          "Short-form Video",
          "Content Strategy",
          "Community Management",
          "Scriptwriting"
        ],
        "bullets": [
          "Run the AKverse creative brand end to end across YouTube (@AKverseOfficial) and Instagram — strategy, production, publishing and community management",
          "Plan, script and produce short-form video content, including papercraft, paper-model and creative builds, with consistent branding on every channel",
          "Create and animate 3D content in Blender for the channels, turning physical papercraft builds into short-form video",
          "Grew the AKverse audience through a regular posting schedule and active community engagement",
          "Maintain a consistent production and posting workflow across platforms, backed by an automated reel-generation pipeline"
        ]
      }
    ],
    "projects": [
      {
        "name": "Arthis.Land — Interactive Creative Showcase Platform",
        "role": "Backend Developer",
        "link": "https://arthis.land",
        "start": "",
        "end": "",
        "tech": [
          "React",
          "JavaScript",
          "Supabase",
          "PostgreSQL",
          "HTML",
          "CSS",
          "Unity WebGL"
        ],
        "bullets": [
          "Designed and built the Supabase (PostgreSQL) backend — a schema covering 750+ bricks plus a shared defaults table — for a website built around a live, explorable wall of games and creative work",
          "Re-architected the site to be fully backend-driven: every brick title, colour, image and metadata field now comes from the database instead of hard-coded front-end values",
          "Built a live-sync layer that merges database records into the React render in place, keyed on stable IDs, so an edit updates the exact brick with zero duplicates",
          "Implemented a colour-theming pipeline where a single hex value from the database drives each brick's fill, frame tint and outline",
          "Wired support for embedding playable Unity WebGL builds directly in the showcase wall"
        ]
      },
      {
        "name": "Hexagonal Tile Game",
        "role": "Game Developer (Unity, C#)",
        "link": "",
        "start": "",
        "end": "",
        "tech": [
          "Unity",
          "C#",
          "Procedural Generation",
          "Unity Editor Tooling",
          "Blender",
          "3D Math"
        ],
        "bullets": [
          "Built HexaBed, a procedural terrain generator in Unity (C#) that assembles 160+ hexagonal tiles into a coherent, height-varied playable world",
          "Engineered a procedural road generator that traces paths across the hex grid and auto-selects the correct asset — straight, turn, ramp or pit — from neighbouring tile heights and direction",
          "Created HexTileEditor, a custom Unity editor panel that lets designers author and regenerate the world visually with no code",
          "Solved asset-placement problems with pivot compensation, 60-degree rotation snapping on the hex grid and bounds-based alignment so prefabs sit flush on every tile",
          "Integrated and positioned 3D assets within the hex-tile world for real-time scenes"
        ]
      },
      {
        "name": "Hustiq — Automated Reel Animation Pipeline",
        "role": "Creator",
        "link": "",
        "start": "",
        "end": "",
        "tech": [
          "Automation",
          "Blender",
          "3D Animation",
          "Motion Graphics",
          "Scripting"
        ],
        "bullets": [
          "Built an automation pipeline that generates animated short-form videos from a reusable template, cutting the manual work of producing each reel",
          "Set it up so new reels come from the template without re-animating from scratch, supporting a consistent posting schedule",
          "Documented the workflow end to end and recorded a proof video showing the pipeline in action"
        ]
      },
      {
        "name": "3D Animation Showreel — Rigging & Character Work",
        "role": "3D Animator",
        "link": "",
        "start": "",
        "end": "",
        "tech": [
          "Blender",
          "Rigging",
          "Character Animation",
          "3D Animation"
        ],
        "bullets": [
          "Rigged 3D models from scratch in Blender and animated them with a focus on character movement, weight and timing",
          "Published the rigged models on Sketchfab and cut the results together into a showreel"
        ]
      },
      {
        "name": "Arthis.Space",
        "role": "Backend Developer",
        "link": "https://arthis.space",
        "start": "",
        "end": "",
        "tech": [],
        "bullets": [
          "Built the backend for Arthis.Space as the project's backend developer"
        ]
      }
    ],
    "education": [
      {
        "school": "Malaviya National Institute of Technology (MNIT), Jaipur",
        "degree": "B.Tech",
        "field": "Electronics & Communication Engineering (ECE)",
        "start": "2022",
        "end": "2026",
        "grade": "JEE Advanced — All India Rank 8956 · JEE Main — 98.9 percentile",
        "details": []
      },
      {
        "school": "Jayshree Periwal High School (JPHS), Jaipur",
        "degree": "Class XII",
        "field": "",
        "start": "",
        "end": "2022",
        "grade": "Class XII — 86.7% · Class X — 90.4%",
        "details": []
      }
    ],
    "certifications": [],
    "achievements": [
      "JEE Advanced 2022 — All India Rank 8956",
      "JEE Main — 98.9 percentile"
    ],
    "languages": [
      "English",
      "Hindi"
    ],
    "memoryNotes": "TODO: add your email and phone in Basics (left out of this public file on purpose).\nTODO: add start date for AKverse, plus subscriber / follower / view counts (numbers make the strongest bullets).\nTODO: add your Instagram handle, third platform, showreel, Sketchfab, proof-video and documentation links.\nTODO: describe Arthis.Space (what it is, what you built, the stack).\nTODO: list the tools you actually use for social media and editing (Canva? CapCut? Premiere Pro? After Effects?).\nTODO: confirm B.Tech status — completed in 2026 or still in progress?\nTODO (only if true): ARTHIS HTML5 multiplayer browser games, ARTHIS mobile app (Expo / React Native), custom Blender add-ons, Hustiq website link."
  };

  CVM.EXAMPLE_PROFILE = {
    basics: {
      name: 'Alex Morgan', headline: 'Software Engineer — Frontend & Full Stack', email: 'alex.morgan@example.com', phone: '+1 555 010 2030', location: 'Austin, TX',
      links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/example' }, { label: 'GitHub', url: 'https://github.com/example' }]
    },
    summary: 'Full stack engineer with a focus on React, Node.js and AWS. Ships product features end to end and cares about performance and reliability.',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'GitHub Actions', 'Jest', 'GraphQL', 'Python', 'Agile', 'System Design'].map(function (n) { return { name: n }; }),
    experience: [
      {
        role: 'Software Engineer II', company: 'Brightpath Health', location: 'Austin, TX', start: '2022-03', current: true,
        tech: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
        bullets: [
          'Led migration of the patient portal from a legacy jQuery app to React and TypeScript, cutting page load time by 48%',
          'Designed REST APIs in Node.js and Express serving 2M requests/day with 99.95% uptime',
          'Introduced GitHub Actions CI/CD with automated Jest tests, reducing release time from 2 days to 3 hours',
          'Mentored 3 junior engineers through code reviews and pairing sessions',
          'Worked on on-call rotation and incident reviews'
        ]
      },
      {
        role: 'Software Engineer', company: 'Cartly', location: 'Remote', start: '2019-06', end: '2022-02',
        tech: ['JavaScript', 'React', 'Python', 'Docker', 'Redis'],
        bullets: [
          'Built checkout features in React used by 120k monthly shoppers, lifting conversion 6%',
          'Containerised 9 services with Docker and cut cloud spend by $40k/year',
          'Added Redis caching to the product catalogue API, reducing p95 latency from 900ms to 180ms',
          'Responsible for maintaining internal admin tools'
        ]
      }
    ],
    projects: [
      { name: 'OpenBudget', role: 'Creator', link: 'https://github.com/example/openbudget', tech: ['GraphQL', 'React', 'PostgreSQL'], bullets: ['Built an open-source budgeting app with GraphQL and React; 1.2k GitHub stars'] }
    ],
    education: [{ school: 'University of Texas at Austin', degree: 'B.S.', field: 'Computer Science', start: '2015', end: '2019' }],
    certifications: [{ name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: '2023-05' }],
    achievements: ['Won company hackathon (2023) with an accessibility audit tool'],
    languages: ['English (Native)', 'Spanish (Professional)']
  };

  CVM.EXAMPLE_JOB = 'Senior Frontend Engineer at Northwind Labs\n\nAbout Northwind Labs:\nWe build analytics software for logistics teams.\n\n' +
    'What you will do:\n- Build and own customer-facing features in React and TypeScript\n- Partner with design to ship accessible, responsive UI\n- Improve performance and reliability of our web app\n- Mentor engineers and lead code reviews\n\n' +
    'Requirements:\n- 5+ years of professional software engineering experience\n- Expert in React, TypeScript and modern JavaScript\n- Experience with REST or GraphQL APIs and Node.js\n- Strong testing habits (Jest, Cypress or Playwright)\n- CI/CD experience (GitHub Actions)\n- Excellent communication and cross-functional collaboration\n\n' +
    'Nice to have:\n- AWS, Docker\n- Data visualization experience (D3)\n- Bachelor\'s degree in Computer Science or equivalent\n\nBenefits:\n- Remote-friendly, health insurance, learning budget';
})(typeof window !== 'undefined' ? window : globalThis);

/* Built-in profiles you can load from My Memory.
 * - STARTER: a draft of Aayush's memory from known projects. No dates or numbers are filled in —
 *   add the real ones (views, downloads, users, years) so the CV can quantify impact honestly.
 * - EXAMPLE: a fictional person, handy for trying the app. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};

  CVM.STARTER_PROFILE = {
    basics: {
      name: 'Aayush',
      headline: 'Creative Technologist — Game Developer, 3D Artist & Content Creator',
      email: '', phone: '', location: '',
      links: [{ label: 'Website', url: 'https://arthis.space' }]
    },
    summary: 'Creative technologist who designs, builds and ships games, mobile apps and 3D animated content end to end. Builds HTML5 multiplayer browser games, a React Native (Expo) app with Reanimated and Skia motion, and stylised low-poly Blender dioramas, and writes and produces Hinglish comedy series for the AKverse YouTube channel. Automates creative pipelines with custom Blender add-ons and AI tooling.',
    skills: [
      'JavaScript', 'TypeScript', 'HTML', 'CSS', 'React Native', 'Expo', 'Reanimated', 'Skia', 'Python', 'C#', 'Unity',
      'Blender', 'Eevee', '3D Modeling', 'Animation', 'Lighting', 'Rendering', 'Game Design', 'Game Development',
      'Motion Graphics', 'Scriptwriting', 'Storyboarding', 'Video Editing', 'Content Creation', 'Storytelling',
      'Generative AI', 'Prompt Engineering', 'MCP', 'Automation', 'Git'
    ].map(function (n) { return { name: n }; }),
    experience: [
      {
        role: 'Founder & Creator', company: 'AKverse (YouTube)', location: '', start: '', end: '', current: true,
        tech: ['Blender', 'Eevee', 'Scriptwriting', 'Video Editing'],
        bullets: [
          'Write, direct and produce Hinglish comedy series including Kaleshi Family mini-dramas, Dr Lodha reels and Friends On Stand-Up sets',
          'Produce Diorama Build shorts in which stylised Indian dioramas build themselves on screen, timed to narration',
          'Plan series continuity, cold opens, cliffhangers and SEO packs (titles, descriptions, tags) for every episode',
          'Built a reusable reel pipeline that turns a script into storyboard, Blender scenes and a finished vertical video'
        ]
      },
      {
        role: 'Founder & Game Developer', company: 'ARTHIS', location: '', start: '', end: '', current: true,
        tech: ['JavaScript', 'HTML', 'CSS', 'React Native', 'Expo', 'Reanimated', 'Skia', 'Unity', 'C#'],
        bullets: [
          'Design and ship HTML5 multiplayer browser games on ARTHIS.space across genres such as racing, sports, puzzle and party games',
          'Built a shared style kit and house standards for games: one cohesive rounded asset set, phone-first scaling tested at five screen sizes',
          'Develop the ARTHIS mobile app in Expo and React Native with Reanimated and Skia motion graphics at 60 fps',
          'Build Arthis.Land, a hex-based world game with voxel wild animals, habitats and a jungle ecology system'
        ]
      }
    ],
    projects: [
      {
        name: 'Blender Animation Add-ons', role: 'Creator', tech: ['Blender', 'Python', 'Animation', 'Automation'],
        bullets: [
          'Built custom Blender add-ons including Camera Animator Pro, Object Animator Pro, Animated Text, LipSync and a lighting toolkit',
          'Automated shot setup, camera moves and lip-sync so a full reel can be rendered headlessly from a script'
        ]
      },
      {
        name: 'AI-Driven 3D Diorama Pipeline', role: 'Creator', tech: ['Blender', 'MCP', 'Generative AI', '3D Modeling'],
        bullets: [
          'Drive Blender through MCP with AI agents to build low-poly buildings, vehicles, trees and props in a consistent house style',
          'Added automated QA: backups, floating-part and overlap checks, and staged Eevee check renders before each delivery'
        ]
      },
      {
        name: 'ARTHIS Low-Poly Vehicle & Asset Library', role: 'Creator', tech: ['Blender', '3D Modeling', 'Texturing'],
        bullets: [
          'Modelled a library of Indian trucks, pickups, autos, tractors, shops and props in a faceted low-poly style for reuse across dioramas and games'
        ]
      }
    ],
    education: [],
    certifications: [],
    achievements: [],
    languages: ['English', 'Hindi'],
    memoryNotes: 'TODO: add real numbers — subscribers, views, games shipped, players, app downloads — plus dates for each role and your education.'
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

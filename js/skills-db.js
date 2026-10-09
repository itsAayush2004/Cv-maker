/* Skill & keyword knowledge base used for job-description analysis.
 * Each entry: canonical name → aliases. Matching is case-insensitive and whole-word.
 * Categories drive weighting: hard skills/tools weigh more than soft skills. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};

  var RAW = {
    language: {
      'JavaScript': ['js', 'ecmascript', 'es6'], 'TypeScript': ['ts'], 'Python': [], 'Java': [], 'C++': ['cpp'],
      'C#': ['c sharp', 'csharp'], 'C': [], 'Go': ['golang'], 'Rust': [], 'Ruby': [], 'PHP': [], 'Swift': [],
      'Kotlin': [], 'Dart': [], 'Scala': [], 'R': [], 'MATLAB': [], 'SQL': [], 'Bash': ['shell scripting', 'shell'],
      'PowerShell': [], 'HTML': ['html5'], 'CSS': ['css3'], 'Sass': ['scss'], 'GDScript': [], 'Lua': [], 'Solidity': [],
      'GraphQL': [], 'Objective-C': [], 'Perl': [], 'Haskell': [], 'Elixir': [], 'VBA': []
    },
    framework: {
      'React': ['react.js', 'reactjs'], 'React Native': [], 'Next.js': ['nextjs'], 'Vue.js': ['vue', 'vuejs'],
      'Nuxt': [], 'Angular': [], 'Svelte': ['sveltekit'], 'Node.js': ['node', 'nodejs'], 'Express': ['express.js'],
      'NestJS': [], 'Django': [], 'Flask': [], 'FastAPI': [], 'Spring Boot': ['spring'], 'Ruby on Rails': ['rails'],
      'Laravel': [], '.NET': ['dotnet', 'asp.net', '.net core'], 'Flutter': [], 'Expo': [], 'Electron': [],
      'jQuery': [], 'Tailwind CSS': ['tailwind'], 'Bootstrap': [], 'Redux': [], 'Three.js': ['threejs'], 'D3.js': ['d3', 'd3js'],
      'Reanimated': [], 'Skia': [], 'WebGL': [], 'Phaser': [], 'Unity': ['unity3d'], 'Unreal Engine': ['unreal', 'ue5', 'ue4'],
      'Godot': [], 'TensorFlow': [], 'PyTorch': [], 'scikit-learn': ['sklearn'], 'Keras': [], 'Pandas': [], 'NumPy': [],
      'Hugging Face': ['transformers'], 'LangChain': [], 'Spark': ['apache spark', 'pyspark'], 'Hadoop': [], 'Kafka': ['apache kafka'],
      'Airflow': ['apache airflow'], 'dbt': [], 'Jest': [], 'Cypress': [], 'Playwright': [], 'Selenium': [], 'JUnit': [], 'pytest': [],
      'Socket.IO': ['socket.io', 'websockets', 'websocket'], 'REST': ['rest api', 'restful', 'rest apis', 'restful apis'], 'gRPC': []
    },
    tool: {
      'AWS': ['amazon web services'], 'Azure': ['microsoft azure'], 'GCP': ['google cloud', 'google cloud platform'],
      'Docker': [], 'Kubernetes': ['k8s'], 'Terraform': [], 'Ansible': [], 'Jenkins': [], 'GitHub Actions': [],
      'CI/CD': ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment'], 'Git': ['github', 'gitlab', 'bitbucket'],
      'Linux': ['unix'], 'Nginx': [], 'Firebase': [], 'Supabase': [], 'Vercel': [], 'Netlify': [], 'Heroku': [],
      'PostgreSQL': ['postgres'], 'MySQL': [], 'MongoDB': ['mongo'], 'Redis': [], 'SQLite': [], 'DynamoDB': [], 'Elasticsearch': [],
      'Snowflake': [], 'BigQuery': [], 'Tableau': [], 'Power BI': ['powerbi'], 'Looker': [], 'Excel': ['microsoft excel', 'spreadsheets'],
      'Google Analytics': ['ga4'], 'Jira': [], 'Confluence': [], 'Notion': [], 'Trello': [], 'Asana': [], 'Slack': [],
      'Figma': [], 'Adobe XD': [], 'Sketch': [], 'Photoshop': ['adobe photoshop'], 'Illustrator': ['adobe illustrator'],
      'After Effects': ['adobe after effects'], 'Premiere Pro': ['adobe premiere', 'premiere'], 'DaVinci Resolve': ['davinci'],
      'Final Cut Pro': [], 'CapCut': [], 'Canva': [], 'InDesign': ['adobe indesign'], 'Lightroom': [],
      'Blender': [], 'Maya': ['autodesk maya'], '3ds Max': [], 'Cinema 4D': ['c4d'], 'ZBrush': [], 'Substance Painter': ['substance'],
      'Houdini': [], 'Eevee': [], 'Cycles': [], 'Salesforce': [], 'HubSpot': [], 'SAP': [], 'QuickBooks': [], 'Tally': [],
      'Postman': [], 'Webpack': [], 'Vite': [], 'npm': [], 'Xcode': [], 'Android Studio': [], 'VS Code': ['visual studio code'],
      'OpenAI API': [], 'Claude API': ['anthropic api'], 'MCP': ['model context protocol'], 'Zapier': [], 'WordPress': [], 'Shopify': [],
      'Webflow': [], 'Mailchimp': [], 'SEMrush': [], 'Ahrefs': [], 'Google Ads': ['adwords'], 'Meta Ads': ['facebook ads'],
      'YouTube Studio': [], 'OBS': ['obs studio'], 'Roblox Studio': ['roblox'], 'n8n': [], 'Make.com': [], 'Looker Studio': ['data studio'], 'ChatGPT': [], 'Sketchfab': [], 'TextMeshPro': [], 'URP': [], 'DOTween': [], 'Addressables': ['unity addressables'], 'Mecanim': ['animator controller', 'blend trees']
    },
    concept: {
      'Machine Learning': ['ml'], 'Deep Learning': [], 'Artificial Intelligence': ['ai'], 'Generative AI': ['genai', 'gen ai'],
      'Large Language Models': ['llm', 'llms'], 'Prompt Engineering': [], 'Natural Language Processing': ['nlp'],
      'Computer Vision': [], 'Data Analysis': ['data analytics', 'analytics'], 'Data Visualization': ['data viz', 'dashboards', 'dashboarding'],
      'Data Engineering': [], 'ETL': ['elt', 'data pipelines', 'data pipeline'], 'Statistics': ['statistical analysis'], 'A/B Testing': ['ab testing', 'experimentation'],
      'Microservices': [], 'System Design': ['distributed systems'], 'API Design': ['api development', 'apis', 'API', 'api integration', 'api integrations'],
      'Authentication': ['auth', 'authentication systems', 'oauth'], 'Databases': ['database', 'database design', 'schema design', 'database schema design'],
      'Webhooks': ['webhook'], 'Design Patterns': ['software design patterns'],
      'Virtual Reality': ['VR'], 'Augmented Reality': ['AR'], 'Shaders': ['shader', 'shader programming', 'custom shaders', 'shaders and materials'],
      'Shader Graph': [], 'HLSL': [], 'VFX': ['visual effects'], 'Particle Systems': ['particle system'], 'Game Physics': ['physics', 'rigidbodies', 'colliders', 'raycasting'],
      'Procedural Generation': ['procedural', 'procedurally generated', 'procedural content'], 'Editor Tooling': ['editor tools', 'editor extensions', 'unity editor tooling', 'custom editor'],
      'Hard-Surface Modeling': ['hard-surface', 'hard surface'], 'Character Animation': [], 'Mechanical Animation': ['mechanical animations', 'mechanical sequences'],
      'Graphic Design': ['graphic designing', 'graphic designer', 'creatives'], 'Video Production': ['video content', 'produce videos'],
      'Influencer Marketing': ['influencers'], 'Trend Research': ['trending topics', 'social media trends', 'trend-savvy'], 'On-Camera Presentation': ['in front of the camera', 'on-camera'],
      'Content Calendar': ['content calendars', 'posting schedule', 'posting cadence'], 'Short-form Video': ['reels', 'short videos', 'short-form', 'shorts'], 'Object-Oriented Programming': ['oop'],
      'Data Structures': ['algorithms'], 'Unit Testing': ['tdd', 'test-driven development', 'automated testing', 'testing'],
      'DevOps': [], 'Cloud Computing': ['cloud'], 'Serverless': ['lambda', 'aws lambda'], 'Cybersecurity': ['security', 'infosec'],
      'Agile': ['scrum', 'kanban', 'sprint planning'], 'Performance Optimization': ['performance tuning', 'optimization'],
      'Responsive Design': ['mobile-first'], 'Accessibility': ['a11y', 'wcag'], 'UI Design': ['user interface design', 'visual design'],
      'UX Design': ['user experience', 'ux research', 'user research', 'usability testing'], 'Wireframing': ['prototyping', 'wireframes'],
      'Design Systems': [], 'Motion Graphics': ['motion design'], 'Animation': ['animating', 'keyframe animation', 'animations', 'animation principles'], '3D Modeling': ['3d modelling', 'low-poly', 'low poly'],
      'Texturing': [], 'Rigging': ['rig', 'rigs', 'rigged'], 'Lighting': ['lighting design'], 'Rendering': [], 'Video Editing': ['editing videos', 'video editor', 'video editing'], 'Color Grading': [],
      'Storyboarding': [], 'Scriptwriting': ['script writing', 'screenwriting'], 'Copywriting': [], 'Content Creation': ['content creator'],
      'Content Strategy': [], 'Social Media Management': ['social media', 'social media manager', 'smm', 'SMO', 'social media growth'], 'SEO': ['search engine optimization'], 'SEM': ['ppc', 'paid search'],
      'Digital Marketing': ['performance marketing', 'growth marketing'], 'Email Marketing': [], 'Brand Strategy': ['branding'],
      'Community Management': [], 'Game Design': ['level design', 'gameplay design'], 'Game Development': ['gamedev', 'game dev', 'game developer', 'game programming', 'game programmer'],
      'Mobile Development': ['mobile apps', 'ios development', 'android development'], 'Frontend Development': ['frontend', 'front-end', 'front end'], 'Backend Development': ['backend', 'back-end', 'back end'],
      'Full Stack Development': ['full stack', 'full-stack'], 'Web Development': ['web apps', 'web applications'],
      'Product Management': ['product roadmap', 'roadmapping'], 'Project Management': ['program management'], 'Stakeholder Management': [],
      'Requirements Gathering': ['business requirements'], 'Business Analysis': [], 'Financial Modeling': ['financial analysis'],
      'Budgeting': ['forecasting'], 'Sales': ['business development', 'lead generation'], 'Customer Success': ['customer support', 'customer service'],
      'CRM': [], 'Market Research': ['competitive analysis'], 'KPIs': ['okrs', 'metrics'], 'Automation': ['workflow automation', 'scripting'],
      'Technical Writing': ['documentation'], 'Recruiting': ['talent acquisition'], 'Operations': ['process improvement']
    },
    soft: {
      'Communication': ['communication skills', 'written communication', 'verbal communication'], 'Leadership': ['team leadership', 'led teams'],
      'Teamwork': ['collaboration', 'cross-functional', 'collaborative'], 'Problem Solving': ['problem-solving', 'troubleshooting', 'debugging'],
      'Attention to Detail': ['detail-oriented', 'detail oriented'], 'Time Management': ['prioritization', 'deadlines'],
      'Creativity': ['creative'], 'Adaptability': ['fast-paced', 'flexible'], 'Ownership': ['self-starter', 'self-motivated', 'proactive', 'autonomous'],
      'Mentoring': ['coaching', 'mentorship', 'mentor', 'mentored', 'mentoring'], 'Critical Thinking': ['analytical skills', 'analytical'], 'Presentation Skills': ['public speaking', 'presenting'],
      'Storytelling': [], 'Negotiation': [], 'Customer Focus': ['customer-centric', 'user-centric']
    }
  };

  var CATEGORY_WEIGHT = { language: 3, framework: 3, tool: 2.5, concept: 2, soft: 1, phrase: 1.5 };

  var entries = [];
  Object.keys(RAW).forEach(function (cat) {
    Object.keys(RAW[cat]).forEach(function (name) {
      entries.push({ name: name, category: cat, aliases: [name].concat(RAW[cat][name]) });
    });
  });

  // Ambiguous aliases only count when written with their usual capitalisation (so prose words like
  // "go", "express", "notion", "spring" or "slack" are not mistaken for technologies).
  var EXACT_CASE = ['Go', 'R', 'C', 'AI', 'TS', 'JS', 'ML', 'Node', 'Spring', 'Express', 'REST', 'SAP', 'Tally', 'Canva',
    'Git', 'OBS', 'Eevee', 'Vite', 'Skia', 'MCP', 'CRM', 'SEO', 'SEM', 'ETL', 'ELT', 'PPC', 'OOP', 'TDD', 'NLP', 'SMM',
    'LLM', 'LLMs', 'C4D', 'API', 'VR', 'AR', 'SMO', 'URP', 'HLSL', 'VFX', 'GA4', 'WCAG', 'OKRs', 'KPIs', 'APIs', 'Lambda', 'Cycles', 'Substance', 'Premiere', 'Expo', 'Unity',
    'Swift', 'Rust', 'Ruby', 'Dart', 'Spark', 'Slack', 'Notion', 'Maya', 'Cypress', 'Phaser', 'Godot', 'Houdini', 'Looker',
    'D3', 'Sketch', 'Excel', 'Flask', 'Electron', 'Ansible', 'Terraform', 'Docker', 'Kafka', 'Airflow', 'Hadoop', 'Redux', 'Keras',
    'Pandas', 'Asana', 'Trello', 'Jira', 'Postman', 'Shopify', 'Webflow', 'Vercel', 'Netlify', 'Heroku', 'Firebase', 'Supabase',
    'Svelte', 'Angular', 'Nuxt', 'Laravel', 'Django', 'Python', 'Java', 'Scala', 'Perl', 'Lua', 'Elixir', 'Haskell'];
  // Generic English aliases that only count in a skill context (or are mapped to EXACT_CASE above).
  var CONTEXT = {
    'shell': /(^|[^A-Za-z])[Ss]hell(?=\s+script)/g,
    'cloud': /(^|[^A-Za-z])[Cc]loud(?=\s+(platforms?|infrastructure|services|native|computing|environments?))/g,
    'security': /(^|[^A-Za-z])[Ss]ecurity(?=\s+(engineering|best practices|testing|audits?|reviews?))/g,
    'testing': /(^|[^A-Za-z])[Tt]esting(?=\s+(frameworks?|automation|practices))/g,
    'creative': /(^|[^A-Za-z])creative(?=\s+(thinking|problem|mindset|skills))/gi,
    'analytical': /(^|[^A-Za-z])analytical(?=\s+(mindset|thinking|skills))/gi,
    'deadlines': /(^|[^A-Za-z])(meet|meeting|tight)\s+deadlines/gi,
    'flexible': /(^|[^A-Za-z])flexible(?=\s+(mindset|approach))/gi,
    'metrics': /(^|[^A-Za-z])(define|track|tracking|own|owning)\s+metrics/gi,
    'optimization': /(^|[^A-Za-z])(code|query|app|application|web|site)\s+optimization/gi,
    'premiere': /(^|[^A-Za-z])Premiere(?=[^A-Za-z]|$)/g,
    'spreadsheets': /(^|[^A-Za-z])spreadsheets(?=[^A-Za-z]|$)/gi,
    'ai': /(^|[^A-Za-z0-9])AI(?=[^A-Za-z0-9]|$)/g,
    'ml': /(^|[^A-Za-z0-9])ML(?=[^A-Za-z0-9]|$)/g,
    'ts': /(^|[^A-Za-z0-9])TS(?=[^A-Za-z0-9]|$)/g,
    'js': /(^|[^A-Za-z0-9])JS(?=[^A-Za-z0-9]|$)/g,
    'node': /(^|[^A-Za-z0-9])Node(?=[^A-Za-z0-9.]|$)/g,
    'spring': /(^|[^A-Za-z0-9])Spring(?=[^A-Za-z0-9]|$)/g,
    'lambda': /(^|[^A-Za-z0-9])Lambda(?=[^A-Za-z0-9]|$)/g,
    'substance': /(^|[^A-Za-z0-9])Substance(?=[^A-Za-z0-9]|$)/g,
    'shell scripting': /(^|[^A-Za-z])shell scripting(?=[^A-Za-z]|$)/gi,
    'mongo': /(^|[^A-Za-z])Mongo(?=[^A-Za-z]|$)/g,
    'unix': /(^|[^A-Za-z])Unix(?=[^A-Za-z]|$)/g,
    'apis': /(^|[^A-Za-z])APIs(?=[^A-Za-z]|$)/g,
    'scripting': /(^|[^A-Za-z])scripting(?=[^A-Za-z]|$)/gi,
    'algorithms': /(^|[^A-Za-z])algorithms(?=[^A-Za-z]|$)/gi,
    'analytics': /(^|[^A-Za-z])analytics(?=[^A-Za-z]|$)/gi,
    // "Electronics & Communication Engineering" is a degree, not the soft skill.
    'Communication': /(^|[^A-Za-z])[Cc]ommunication(?!\s+(engineering|systems|technology|networks|protocols))(?=[^A-Za-z]|$)/gi,
    'physics': /(^|[^A-Za-z])(game|3d|unity)\s+physics(?=[^A-Za-z]|$)/gi,
    'procedural': /(^|[^A-Za-z])procedural(?=\s+(generation|terrain|content|road|world|levels?|map))/gi,
    'creatives': /(^|[^A-Za-z])creatives(?=[^A-Za-z]|$)/gi,
    'rig': /(^|[^A-Za-z])rig(?=\s+(controls?|and|hard|complex))/gi,
    'rigs': /(^|[^A-Za-z])rigs(?=[^A-Za-z]|$)/gi,
    'rigged': /(^|[^A-Za-z])rigged(?=[^A-Za-z]|$)/gi,
    'database': /(^|[^A-Za-z])database(?=\s+(design|schema|development|management|systems?))/gi,
    'auth': /(^|[^A-Za-z])auth(?=[^A-Za-z]|$)/gi,
    'reels': /(^|[^A-Za-z])reels?(?=[^A-Za-z]|$)/gi,
    'shorts': /(^|[^A-Za-z])Shorts(?=[^A-Za-z]|$)/g,
    'Make.com': /(^|[^A-Za-z])Make(?:\.com)?(?=[\s,]*(or|and|\/)?\s*(Zapier|n8n))/g
  };
  var EXACT = Object.create(null);
  EXACT_CASE.forEach(function (a) { EXACT[a] = true; });

  function aliasRegex(alias) {
    if (Object.prototype.hasOwnProperty.call(CONTEXT, alias)) {
      var r = CONTEXT[alias];
      return new RegExp(r.source, r.flags);
    }
    if (EXACT[alias]) {
      return new RegExp('(^|[^A-Za-z0-9+#])' + CVM.util.escapeRegex(alias) + '(?=$|[^A-Za-z0-9+#])', 'g');
    }
    return CVM.util.termRegex(alias);
  }

  /** Find every known skill in text. Returns [{name, category, count, matched}] (matched = spelling used in text).
   * Overlapping matches are resolved longest-first, so "GitHub Actions" is not also counted as "Git",
   * "React Native" not as "React", and "CI/CD" not as "CD". */
  var cache = new Map();
  function findSkills(text) {
    text = CVM.util.str(text);
    if (!text) return [];
    var hit = cache.get(text);
    if (hit) return hit.map(function (r) { return { name: r.name, category: r.category, count: r.count, matched: r.matched }; });
    var res = scan(text);
    if (cache.size > 800) cache.clear();
    cache.set(text, res);
    return res.map(function (r) { return { name: r.name, category: r.category, count: r.count, matched: r.matched }; });
  }

  function scan(text) {
    var spans = [];
    entries.forEach(function (e, ei) {
      e.aliases.forEach(function (alias) {
        var re = aliasRegex(alias), m, guard = 0;
        while ((m = re.exec(text)) && guard++ < 500) {
          var lead = m[1] ? m[1].length : 0;
          var start = m.index + lead, word = m[0].slice(lead);
          if (word) spans.push({ ei: ei, start: start, end: start + word.length, word: word });
          if (re.lastIndex === m.index) re.lastIndex++;
        }
      });
    });
    spans.sort(function (a, b) { return (b.end - b.start) - (a.end - a.start) || a.start - b.start; });
    var taken = [], byEntry = Object.create(null);
    spans.forEach(function (s) {
      for (var i = 0; i < taken.length; i++) if (s.start < taken[i].end && s.end > taken[i].start) return;
      taken.push(s);
      var r = byEntry[s.ei] || (byEntry[s.ei] = { name: entries[s.ei].name, category: entries[s.ei].category, count: 0, matched: s.word, first: s.start });
      r.count++;
      if (s.start < r.first) { r.first = s.start; r.matched = s.word; }
    });
    return Object.keys(byEntry).map(function (k) { return byEntry[k]; }).sort(function (a, b) { return a.first - b.first; })
      .map(function (r) { return { name: r.name, category: r.category, count: r.count, matched: r.matched }; });
  }

  /** Canonical skill name for a free-text skill (e.g. "reactjs" → "React"), or the input trimmed. */
  function canonical(term) {
    var t = CVM.util.str(term).trim().toLowerCase();
    if (!t) return '';
    for (var i = 0; i < entries.length; i++) {
      for (var j = 0; j < entries[i].aliases.length; j++) {
        if (entries[i].aliases[j].toLowerCase() === t) return entries[i].name;
      }
    }
    return CVM.util.str(term).trim();
  }

  function categoryOf(term) {
    var c = canonical(term);
    for (var i = 0; i < entries.length; i++) if (entries[i].name === c) return entries[i].category;
    return 'phrase';
  }

  function aliasesOf(term) {
    var c = canonical(term);
    for (var i = 0; i < entries.length; i++) if (entries[i].name === c) return entries[i].aliases.slice();
    return [CVM.util.str(term).trim()];
  }

  var ACTION_VERBS = ('accelerated achieved administered analyzed architected automated boosted built championed coached collaborated ' +
    'composed conceived consolidated coordinated created cut debugged delivered deployed designed developed directed drove ' +
    'edited eliminated enabled engineered established exceeded executed expanded facilitated forecasted founded generated grew ' +
    'guided headed implemented improved increased initiated innovated integrated introduced launched led maintained managed ' +
    'mentored migrated modeled modernized negotiated optimized orchestrated organized overhauled owned partnered pioneered ' +
    'planned produced programmed prototyped published raised redesigned reduced refactored released rendered researched ' +
    'resolved restructured revamped saved scaled scripted secured shipped simplified spearheaded standardized streamlined ' +
    'strengthened supervised trained transformed tripled doubled unified upgraded wrote animated modelled filmed directed ' +
    'storyboarded illustrated sculpted textured rigged lit composited grew monetized authored').split(/\s+/);

  var WEAK_STARTS = ['responsible for', 'worked on', 'helped', 'assisted', 'involved in', 'duties included', 'tasked with', 'participated in'];

  CVM.skillsDb = {
    entries: entries,
    CATEGORY_WEIGHT: CATEGORY_WEIGHT,
    findSkills: findSkills,
    canonical: canonical,
    categoryOf: categoryOf,
    aliasesOf: aliasesOf,
    ACTION_VERBS: ACTION_VERBS,
    WEAK_STARTS: WEAK_STARTS
  };
})(typeof window !== 'undefined' ? window : globalThis);

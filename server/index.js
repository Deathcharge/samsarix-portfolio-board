import express from 'express';
import cors from 'cors';
import { Octokit } from 'octokit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || 'public'
});

// Repository list
const REPOS = [
  'agent-consensus',
  'helix-chat-engine',
  'helix-integration',
  'helix-notifications',
  'helix-token-cost-manager',
  'neural-mesh',
  'policy-engine',
  'routine-engine',
  'unified-llm',
  'helix-discord-bot',
  'helix-agent-orchestration',
  'helix-sdk',
  'Helix-Collective-Web'
];

// API Routes
app.get('/api/repos', async (req, res) => {
  try {
    const repos = await Promise.all(
      REPOS.map(async (repo) => {
        try {
          const { data } = await octokit.rest.repos.get({
            owner: 'Deathcharge',
            repo: repo
          });
          return {
            name: data.name,
            description: data.description,
            url: data.html_url,
            stars: data.stargazers_count,
            forks: data.forks_count,
            language: data.language,
            updated_at: data.updated_at,
            status: 'healthy'
          };
        } catch (e) {
          return {
            name: repo,
            status: 'error',
            error: e.message
          };
        }
      })
    );
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repos/:repo/metrics', async (req, res) => {
  try {
    const { repo } = req.params;
    const { data } = await octokit.rest.repos.get({
      owner: 'Deathcharge',
      repo: repo
    });
    
    res.json({
      name: repo,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      open_issues: data.open_issues_count,
      language: data.language,
      created_at: data.created_at,
      updated_at: data.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    repos_monitored: REPOS.length
  });
});

// Serve static files
app.use(express.static(join(__dirname, '../client/dist')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Helix Dashboard running on http://localhost:${PORT}`);
});

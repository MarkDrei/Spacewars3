# CI/CD Services and Integrations

This document lists additional services and tools that can enhance your CI/CD pipeline. These services require separate registration but offer free tiers for open-source projects.

## Code Coverage Services

### Codecov
**Website**: https://codecov.io/

**What it provides**:
- Visual code coverage reports with line-by-line analysis
- Coverage trends over time
- PR comments showing coverage changes
- Coverage badges for README
- Free for public repositories

**Integration**:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/coverage-final.json
    fail_ci_if_error: false
```

**Badge**:
```markdown
[![codecov](https://codecov.io/gh/USERNAME/REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/USERNAME/REPO)
```

### Coveralls
**Website**: https://coveralls.io/

**What it provides**:
- Similar to Codecov with coverage visualization
- PR integration
- Coverage badges
- Free for open-source projects

**Integration**:
```yaml
- name: Upload coverage to Coveralls
  uses: coverallsapp/github-action@v2
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Visual Regression Testing

### Percy by BrowserStack
**Website**: https://percy.io/

**What it provides**:
- Automated visual regression testing
- Side-by-side diff comparisons
- Cross-browser screenshot comparison
- Free tier available for open-source

**Integration**:
```yaml
- name: Percy visual tests
  run: npx percy snapshot screenshots/
  env:
    PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

### Chromatic (Storybook)
**Website**: https://www.chromatic.com/

**What it provides**:
- Visual regression testing for Storybook components
- UI review workflow
- Free for open-source projects

**Integration**: Requires Storybook setup

### Happo
**Website**: https://happo.io/

**What it provides**:
- Cross-browser visual diffing
- Multiple viewport testing
- Free tier available

## Code Quality and Security

### SonarCloud
**Website**: https://sonarcloud.io/

**What it provides**:
- Code quality analysis
- Security vulnerability detection
- Code smell detection
- Technical debt tracking
- Free for public repositories

**Integration**:
```yaml
- name: SonarCloud Scan
  uses: SonarSource/sonarcloud-github-action@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### CodeQL (GitHub Advanced Security)
**Website**: Built into GitHub

**What it provides**:
- Security vulnerability scanning
- Code scanning for common vulnerabilities
- Free for public repositories

**Integration**:
```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: javascript, typescript

- name: Perform CodeQL Analysis
  uses: github/codeql-action/analyze@v3
```

### Snyk
**Website**: https://snyk.io/

**What it provides**:
- Dependency vulnerability scanning
- Container security
- Infrastructure as Code scanning
- Free for open-source projects

**Integration**:
```yaml
- name: Run Snyk to check for vulnerabilities
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

## Deployment Services

### Vercel
**Website**: https://vercel.com/

**What it provides**:
- Automatic deployments for Next.js apps
- Preview deployments for PRs
- Edge network CDN
- Free tier available

**Integration**: Automatic when you connect GitHub repo

### Netlify
**Website**: https://www.netlify.com/

**What it provides**:
- Automatic deployments
- Preview deployments
- Serverless functions
- Free tier available

**Integration**: Automatic when you connect GitHub repo

### Railway
**Website**: https://railway.app/

**What it provides**:
- Full-stack deployments
- Database hosting
- Environment management
- Free tier available

### Render
**Website**: https://render.com/

**What it provides**:
- Web services, databases, cron jobs
- Free tier for static sites and web services
- Automatic deployments from GitHub

## Dependency Management

### Dependabot
**Website**: Built into GitHub

**What it provides**:
- Automated dependency updates
- Security vulnerability alerts
- Automatic PR creation for updates
- Free for all GitHub repositories

**Setup**: Enable in repository settings → Security & analysis

### Renovate
**Website**: https://www.mend.io/renovate/

**What it provides**:
- More configurable than Dependabot
- Automatic dependency updates
- Monorepo support
- Free for open-source

**Integration**: Install GitHub App from marketplace

## Performance Monitoring

### Lighthouse CI
**Website**: https://github.com/GoogleChrome/lighthouse-ci

**What it provides**:
- Performance, accessibility, SEO audits
- Performance budget enforcement
- Free and open-source

**Integration**:
```yaml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun
```

### Bundle Analyzer
**What it provides**:
- JavaScript bundle size analysis
- Visualization of what's in your bundles
- Built into Next.js

**Integration**:
```yaml
- name: Analyze bundle
  run: |
    npm run build
    npx @next/bundle-analyzer
```

## Documentation

### GitHub Pages
**Website**: Built into GitHub

**What it provides**:
- Free static site hosting
- Automatic deployment from repository
- Custom domain support

**Integration**:
```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./out
```

## Notifications

### Slack Integration
**What it provides**:
- Build status notifications
- PR notifications
- Deployment notifications

**Integration**: Use Slack GitHub App or webhook actions

### Discord Integration
**What it provides**:
- Similar to Slack
- Build status notifications

**Integration**:
```yaml
- name: Discord notification
  uses: Ilshidur/action-discord@master
  env:
    DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
```

## Recommended Starter Services

For a Next.js project like Spacewars, we recommend starting with:

1. **Codecov** - For coverage tracking (easy setup, great visualization)
2. **Dependabot** - For dependency updates (built-in, no setup needed)
3. **Vercel** - For deployment (optimized for Next.js, automatic)
4. **CodeQL** - For security scanning (built-in to GitHub)

These provide excellent value with minimal configuration and are all free for public repositories.

## Notes

- Most services offer free tiers for open-source/public repositories
- Some services require creating an account and generating tokens
- Store sensitive tokens in GitHub Secrets (Settings → Secrets and variables → Actions)
- Always use the latest version of actions (check action documentation)

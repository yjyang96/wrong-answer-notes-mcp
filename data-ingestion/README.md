# Wrong Answer Notes - Data Ingestion Service

Git 커밋 메시지와 Diff를 자동으로 수집하는 서비스입니다.

## 기능

- **GitHub API 수집**: REST/GraphQL API를 통한 커밋 데이터 수집
- **Git CLI 수집**: 로컬 저장소에서 직접 데이터 수집
- **PyDriller 수집**: Python PyDriller 라이브러리를 통한 고급 Git 분석
- **멀티 브랜치 지원**: 모든 브랜치의 커밋 데이터 수집
- **메타데이터 보존**: 저장소, 브랜치, 날짜 등 메타데이터 보존
- **데이터 검증**: 수집된 데이터의 품질 검증 및 정제
- **병렬 처리**: 여러 저장소 동시 수집 지원

## 설치

### Node.js 의존성 설치

```bash
npm install
```

### Python 의존성 설치 (PyDriller 사용 시)

```bash
cd python
pip install -r requirements.txt
```

## 설정

### 환경 변수 설정

```bash
cp env.example .env
```

`.env` 파일을 편집하여 다음 설정을 구성하세요:

```env
# GitHub API 설정
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_BASE_URL=https://api.github.com

# 로깅 설정
LOG_LEVEL=info

# 수집 설정
DEFAULT_OUTPUT_DIR=./output
DEFAULT_MAX_CONCURRENCY=3
DEFAULT_LIMIT=1000

# PyDriller 설정
PYTHON_PATH=python3
```

### GitHub Personal Access Token 생성

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" 클릭
3. 필요한 권한 선택:
   - `repo` (전체 저장소 접근)
   - `read:org` (조직 저장소 접근 시)
4. 토큰을 `.env` 파일의 `GITHUB_TOKEN`에 설정

## 사용법

### CLI 사용법

#### 단일 저장소 수집

```bash
npm run dev -- owner/repository
```

#### 옵션과 함께 수집

```bash
npm run dev -- owner/repository \
  --branches main,develop \
  --limit 100 \
  --since 2024-01-01 \
  --until 2024-12-31 \
  --include "*.ts,*.tsx" \
  --exclude "*.md,*.json" \
  --source github-api \
  --output ./output/commits.json
```

#### 여러 저장소 수집

```bash
npm run dev -- --multi owner/repo1,owner/repo2,owner/repo3 \
  --branches main \
  --limit 50 \
  --output-dir ./output \
  --max-concurrency 2
```

#### 설정 파일 사용

```bash
npm run dev -- --config config/default.json
```

### 프로그래밍 방식 사용

```typescript
import { DataIngestionService } from './src/index';

const service = new DataIngestionService();

// 단일 저장소 수집
await service.collectFromRepository('owner/repository', {
  branches: ['main', 'develop'],
  limit: 100,
  since: new Date('2024-01-01'),
  source: 'github-api',
  outputFile: './output/commits.json'
});

// 여러 저장소 수집
await service.collectFromMultipleRepositories(
  ['owner/repo1', 'owner/repo2'],
  {
    branches: ['main'],
    limit: 50,
    outputDir: './output',
    maxConcurrency: 3
  }
);
```

## 수집 소스

### 1. GitHub API (기본값)

- **장점**: 빠른 수집, 레이트 리미팅 자동 처리
- **단점**: GitHub API 제한, 토큰 필요
- **사용 시기**: 공개 저장소, 빠른 수집이 필요한 경우

### 2. Git CLI

- **장점**: 로컬 저장소 직접 접근, 상세한 Diff 정보
- **단점**: 저장소 클론 필요, 느린 수집
- **사용 시기**: 로컬 저장소, 상세한 분석이 필요한 경우

### 3. PyDriller

- **장점**: 고급 Git 분석, 파일 변경 통계
- **단점**: Python 환경 필요, 느린 수집
- **사용 시기**: 상세한 코드 분석이 필요한 경우

## 데이터 형식

수집된 데이터는 다음 형식으로 저장됩니다:

```json
{
  "hash": "abc123def456",
  "message": "Fix bug in authentication",
  "author": {
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe"
  },
  "committer": {
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe"
  },
  "date": "2024-01-15T10:30:00Z",
  "diff": "--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -10,7 +10,7 @@\n-  const token = localStorage.getItem('token');\n+  const token = sessionStorage.getItem('token');",
  "files": [
    {
      "path": "src/auth.ts",
      "type": "modified",
      "additions": 1,
      "deletions": 1,
      "size": 2
    }
  ],
  "branch": "main",
  "repository": {
    "name": "my-app",
    "fullName": "owner/my-app",
    "url": "https://github.com/owner/my-app",
    "defaultBranch": "main",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "metadata": {
    "collectedAt": "2024-01-15T11:00:00Z",
    "source": "github-api",
    "version": "1.0.0",
    "config": {}
  }
}
```

## 테스트

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 실행
npm test -- --testNamePattern="GitHubApiCollector"

# 커버리지 리포트 생성
npm test -- --coverage
```

## 개발

### 빌드

```bash
npm run build
```

### 린팅

```bash
npm run lint
npm run lint:fix
```

### 개발 모드 실행

```bash
npm run dev
```

## 레이트 리미팅

GitHub API 사용 시 자동으로 레이트 리미팅을 처리합니다:

- **REST API**: 시간당 5,000 요청
- **GraphQL API**: 시간당 5,000 요청
- **자동 대기**: 레이트 리미트 도달 시 자동 대기

## 오류 처리

- **네트워크 오류**: 자동 재시도 (최대 3회)
- **API 오류**: 로그 기록 후 다음 커밋으로 진행
- **데이터 검증 오류**: 경고 로그 후 데이터 정제

## 로그

로그는 다음 위치에 저장됩니다:

- `logs/combined.log`: 모든 로그
- `logs/error.log`: 오류 로그만

로그 레벨은 환경 변수 `LOG_LEVEL`로 설정할 수 있습니다:
- `error`: 오류만
- `warn`: 경고 이상
- `info`: 정보 이상 (기본값)
- `debug`: 모든 로그

## 라이선스

MIT License


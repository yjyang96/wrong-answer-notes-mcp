# Story 1 통합 실행 가이드

## 🚀 Story 1 전체 파이프라인 자동 실행

Story 1의 모든 단계를 한 번에 실행할 수 있는 통합 스크립트입니다.

### 📋 포함된 스토리들

- **Story 1.1**: Git Commit Data Collection (GitHub API)
- **Story 1.2**: Commit Data Preprocessing & Labeling (LLM 분류)
- **Story 1.3**: Text Embedding Generation (Azure OpenAI)
- **Story 1.4**: Vector Database Setup & Storage (ChromaDB + BM25)

### 🛠️ 사전 준비

1. **환경 변수 설정**
   ```bash
   # 각 서비스 디렉토리에 .env 파일 생성
   cp data-ingestion/env.example data-ingestion/.env
   cp embedding-service/env.example embedding-service/.env
   cp vector-db-service/env.example vector-db-service/.env
   ```

2. **.env 파일에 API 키 설정**
   ```bash
   # data-ingestion/.env
   GITHUB_TOKEN=your_github_token
   
   # embedding-service/.env
   AZURE_OPENAI_API_KEY=your_azure_openai_key
   AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
   AZURE_OPENAI_DEPLOYMENT=text-embedding-3-large
   AZURE_OPENAI_API_VERSION=2025-01-01-preview
   
   # vector-db-service/.env
   AZURE_OPENAI_API_KEY=your_azure_openai_key
   AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
   AZURE_OPENAI_DEPLOYMENT=text-embedding-3-large
   AZURE_OPENAI_API_VERSION=2025-01-01-preview
   ```

### 🎯 사용법

```bash
# 기본 사용법
python run_story1.py <repository> <max_commits>

# 예시
python run_story1.py tensorflow/tensorflow 100
python run_story1.py microsoft/vscode 50
python run_story1.py facebook/react 200
```

### 📊 실행 과정

1. **환경 확인**: Node.js, Python, .env 파일 확인
2. **데이터 수집**: GitHub API로 커밋 데이터 수집
3. **전처리**: LLM으로 커밋 분류 및 라벨링
4. **임베딩 생성**: Azure OpenAI로 텍스트 임베딩 생성
5. **벡터 DB 구축**: ChromaDB에 데이터 저장 및 BM25 인덱스 구축

### 📁 출력 파일

```
output/
├── raw_<repository>_commits.json          # 원본 커밋 데이터
├── processed_<repository>_commits.json    # 전처리된 커밋 데이터
├── embeddings/                            # 임베딩 파일들
│   ├── emb_*.json
│   └── index.json
└── story1_summary_<timestamp>.json        # 실행 결과 요약
```

### 🔍 검색 테스트

벡터 DB 구축 완료 후 검색 기능 테스트:

```bash
# 하이브리드 검색 (BM25 + 벡터) - 기본 컬렉션 사용
cd vector-db-service
source venv/bin/activate
python -m src.main search --query "tensorflow version update" --hybrid

# 벡터 검색만 - 기본 컬렉션 사용
python -m src.main search --query "bug fix error"

# 가중치 조정 - 기본 컬렉션 사용
python -m src.main search --query "api changes" --hybrid --bm25-weight 0.6 --vector-weight 0.4

# 다른 컬렉션 사용 시
python -m src.main search --query "test query" --collection "custom_collection" --hybrid
```

### ⚡ 성능 예시

**5개 커밋 테스트 결과:**
- 총 실행 시간: ~15초
- 수집: 5개 커밋
- 전처리: 5개 커밋
- 임베딩: 5개 임베딩
- 벡터 DB: 5개 문서 저장

**100개 커밋 예상 시간:**
- 수집: ~30초
- 전처리: ~5분 (LLM API 호출)
- 임베딩: ~2분
- 벡터 DB: ~10초
- **총 예상 시간: ~8분**

### 🛠️ 문제 해결

1. **GitHub API 제한**
   - GitHub 토큰을 .env에 설정
   - Rate limit 확인

2. **Azure OpenAI 오류**
   - API 키와 엔드포인트 확인
   - text-embedding-3-large 모델 배포 확인

3. **의존성 오류**
   - Node.js 18+ 설치
   - Python 3.8+ 설치
   - npm install 실행

### 📈 확장 가능성

- **대용량 처리**: 배치 크기 조정
- **다중 저장소**: 여러 저장소 동시 처리
- **커스텀 분류**: LLM 프롬프트 수정
- **검색 최적화**: BM25/벡터 가중치 튜닝

### 🎉 완료 후

Story 1 파이프라인이 완료되면:
- ✅ ChromaDB에 벡터 데이터 저장
- ✅ BM25 텍스트 검색 인덱스 구축
- ✅ 하이브리드 검색 시스템 준비
- ✅ Story 3 (검색 서비스) 개발 준비 완료

---

**다음 단계**: Story 3 - 검색 서비스 API 개발

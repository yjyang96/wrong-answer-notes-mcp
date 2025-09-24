# Vector Database Service

ChromaDB 기반 벡터 데이터베이스 서비스로, 커밋 임베딩 데이터를 저장하고 검색하는 시스템입니다.

## 🚀 주요 기능

- **ChromaDB 로컬 구성**: 파일 기반 로컬 벡터 데이터베이스
- **3072차원 임베딩 지원**: Azure OpenAI text-embedding-3-large 모델 지원
- **하이브리드 검색**: 벡터 유사도 검색 + 메타데이터 필터링
- **데이터 마이그레이션**: embedding-service에서 ChromaDB로 데이터 이전
- **CLI 인터페이스**: 명령줄에서 쉬운 관리
- **성능 모니터링**: 검색 성능 및 저장소 상태 추적

## 📋 요구사항

- Python 3.9+
- ChromaDB 1.1.0+
- Azure OpenAI API (텍스트 검색용, 선택사항)

## 🛠️ 설치

### 1. 가상환경 설정
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 또는
venv\Scripts\activate     # Windows
```

### 2. 의존성 설치
```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정
```bash
# .env 파일 생성 (env.example 참고)
cp env.example .env

# 또는 CLI로 템플릿 생성
python -m src.main config env-template > .env

# .env 파일에서 Azure OpenAI 설정
# AZURE_OPENAI_API_KEY=your_api_key_here
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

## 🎯 사용법

### CLI 명령어

#### 데이터 마이그레이션
```bash
# 환경 변수 사용 (기본값)
python -m src.main migrate

# CLI 옵션으로 오버라이드
python -m src.main migrate --source ../embedding-service/output/embeddings --collection commit_embeddings --batch-size 50

# 기존 컬렉션 덮어쓰기
python -m src.main migrate --overwrite
```

#### 벡터 검색
```bash
# 벡터 검색 (임베딩 벡터 직접 사용)
python -c "
import json
from src.chroma.chroma_service import ChromaService
from src.models import ChromaConfig, SearchQuery

# 샘플 임베딩 로드
with open('../embedding-service/output/embeddings/emb_xxx.json', 'r') as f:
    sample_embedding = json.load(f)

config = ChromaConfig(persist_directory='./data/chroma_db')
service = ChromaService(config)

query = SearchQuery(
    query_embedding=sample_embedding['embedding_vector'],
    n_results=5
)

results = service.search('commit_embeddings', query)
print(f'검색 결과: {len(results.ids)}개')
"
```

#### 텍스트 검색 (Azure OpenAI API 필요)
```bash
# 텍스트를 임베딩으로 변환하여 검색
python -m src.main search --query "tensorflow error fix" --collection commit_embeddings --limit 5
```

#### 컬렉션 관리
```bash
# 컬렉션 정보 조회 (환경 변수 사용)
python -m src.main info

# 모든 컬렉션 목록
python -m src.main list-collections

# 시스템 상태 확인
python -m src.main health
```

#### 설정 관리
```bash
# 현재 설정 검증
python -m src.main config validate

# 설정 조회
python -m src.main config show

# .env 템플릿 생성
python -m src.main config env-template

# 환경 변수 설정 (현재 세션만)
python -m src.main config set-env --key LOG_LEVEL --value DEBUG
```

### Python API 사용

```python
from src.chroma.chroma_service import ChromaService
from src.models import ChromaConfig, SearchQuery

# ChromaDB 서비스 초기화
config = ChromaConfig(
    persist_directory="./data/chroma_db",
    collection_name="commit_embeddings"
)
service = ChromaService(config)

# 벡터 검색
query = SearchQuery(
    query_embedding=your_embedding_vector,
    n_results=10
)
results = service.search("commit_embeddings", query)

# 결과 처리
for doc_id, document, metadata, distance in zip(
    results.ids, results.documents, results.metadatas, results.distances
):
    print(f"ID: {doc_id}, 거리: {distance:.4f}")
    print(f"커밋: {metadata.get('commit_id', 'N/A')}")
    print(f"분류: {metadata.get('classification_type', 'N/A')}")
```

## 📊 데이터 구조

### ChromaDB 컬렉션 스키마
```python
{
    "id": "emb_3957c715_1758248512853_e620e87f",
    "embedding": [0.123, -0.456, ...],  # 3072차원 벡터
    "document": "커밋 메시지 + 분류 정보 + diff 내용",
    "metadata": {
        "commit_id": "3957c715",
        "embedding_id": "emb_3957c715_1758248512853_e620e87f",
        "quality_score": 0.95,
        "content_type": "mixed",
        "model_version": "text-embedding-3-large",
        "classification_type": "fix",
        "package_name": "tensorflow",
        "error_type": "TypeError",
        "repository": "tensorflow/tensorflow",
        "branch": "main",
        "author": "developer@example.com",
        "date": "2025-09-19T12:59:03Z"
    }
}
```

## 🔧 설정

### ChromaConfig
```python
ChromaConfig(
    persist_directory="./data/chroma_db",  # 데이터 저장 경로
    collection_name="commit_embeddings",   # 기본 컬렉션명
    distance_metric="cosine",              # 거리 메트릭
    hnsw_space="cosine",                   # HNSW 공간
    hnsw_construction_ef=200,              # HNSW 구성 파라미터
    hnsw_M=16                             # HNSW 연결 수
)
```

### 환경 변수
```bash
# ChromaDB 설정
CHROMA_PERSIST_DIRECTORY=./data/chroma_db
CHROMA_COLLECTION_NAME=commit_embeddings
CHROMA_DISTANCE_METRIC=cosine

# Azure OpenAI API (텍스트 검색용)
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# 마이그레이션 설정
MIGRATION_SOURCE_DIR=../embedding-service/output/embeddings
MIGRATION_BATCH_SIZE=100
MIGRATION_OVERWRITE_EXISTING=false

# 로깅 설정
LOG_LEVEL=INFO
LOG_FILE=logs/vector-db.log

# 성능 설정
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT_SECONDS=30
```

## 📈 성능

- **검색 속도**: 평균 30-50ms (로컬 환경)
- **저장소**: 70개 문서 기준 약 27MB
- **지원 차원**: 3072차원 (text-embedding-3-large)
- **동시 검색**: 제한 없음 (로컬 파일 기반)

## 🚨 제한사항

1. **텍스트 검색**: Azure OpenAI API 키가 필요
2. **차원 고정**: 3072차원 임베딩만 지원
3. **로컬 전용**: 분산 환경 미지원
4. **메모리**: 대용량 데이터셋 시 메모리 사용량 증가

## 🔍 문제 해결

### 차원 불일치 오류
```
Collection expecting embedding with dimension of 3072, got 384
```
**해결**: 컬렉션을 삭제하고 다시 생성
```bash
python -c "
from src.chroma.chroma_service import ChromaService
from src.models import ChromaConfig
config = ChromaConfig(persist_directory='./data/chroma_db')
service = ChromaService(config)
service.delete_collection('commit_embeddings')
"
```

### 텍스트 검색 실패
```
Azure OpenAI API 키가 설정되지 않음
```
**해결**: `.env` 파일에 Azure OpenAI 설정 추가

## 📁 프로젝트 구조

```
vector-db-service/
├── src/
│   ├── chroma/           # ChromaDB 서비스
│   ├── migration/        # 데이터 마이그레이션
│   ├── utils/           # 유틸리티 함수
│   ├── cli/             # CLI 인터페이스
│   └── models.py        # 데이터 모델
├── data/                # ChromaDB 데이터
├── logs/                # 로그 파일
├── tests/               # 테스트
└── requirements.txt     # 의존성
```

## 🤝 기여

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

MIT License

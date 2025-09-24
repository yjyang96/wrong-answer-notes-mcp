# Embedding Service

텍스트 임베딩 생성 서비스 - Azure OpenAI text-embedding-3-large 모델을 사용하여 커밋 데이터의 임베딩을 생성합니다.

## 기능

- **Azure OpenAI 통합**: text-embedding-3-large 모델 사용
- **배치 처리**: 효율적인 대량 임베딩 생성
- **비동기 처리**: 높은 성능과 동시성
- **품질 검증**: 임베딩 품질 자동 검증
- **저장소 관리**: 임베딩 데이터 저장 및 인덱싱
- **CLI 인터페이스**: 명령줄에서 쉽게 사용

## 설치

```bash
# 의존성 설치
pip install -r requirements.txt

# 또는 개발 모드로 설치
pip install -e .
```

## 환경 설정

`.env` 파일을 생성하고 다음 설정을 추가하세요:

```bash
# Azure OpenAI 설정
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# 임베딩 설정
EMBEDDING_BATCH_SIZE=100
EMBEDDING_MAX_CONCURRENT=5
EMBEDDING_DIMENSIONS=3072
```

## 사용법

### 1. 임베딩 생성

```bash
python -m src.main generate \
  --input ../data-ingestion/output/processed_tensorflow_commits.json \
  --output output/embeddings \
  --batch-size 50 \
  --max-concurrent 3
```

### 2. 임베딩 로딩

```bash
python -m src.main load --input output/embeddings/index.json
```

### 3. 커밋별 검색

```bash
python -m src.main search --commit-id abc123def --input output/embeddings
```

### 4. 저장소 검증

```bash
python -m src.main validate --input output/embeddings
```

### 5. 통계 조회

```bash
python -m src.main stats --input output/embeddings
```

## API 사용법

```python
import asyncio
from src import EmbeddingService, EmbeddingConfig, StorageConfig

async def main():
    # 설정
    config = EmbeddingConfig(
        model="text-embedding-3-large",
        dimensions=3072,
        batch_size=100,
        max_concurrent=5
    )
    
    storage_config = StorageConfig(
        output_dir="output/embeddings",
        create_index=True
    )
    
    # 서비스 초기화
    service = EmbeddingService(config, storage_config)
    
    # 임베딩 생성
    result = await service.generate_embeddings(commits)
    
    print(f"생성된 임베딩: {result.successful}개")

asyncio.run(main())
```

## 프로젝트 구조

```
embedding-service/
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── cli.py
│   ├── models.py
│   ├── azure_service.py
│   ├── batch_processor.py
│   ├── embedding_service.py
│   └── storage_service.py
├── config/
├── logs/
├── output/
├── tests/
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 개발

```bash
# 코드 포맷팅
black src/

# 린팅
flake8 src/

# 테스트
pytest tests/
```

## 라이선스

MIT

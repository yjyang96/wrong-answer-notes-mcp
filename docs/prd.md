# 오답노트 MCP Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- **개발자 디버깅 효율성 향상**: 반복되는 오류 해결 시간을 단축하여 평균 복구 시간을 50% 이상 감소
- **지식 자산화**: 흩어져 있는 디버깅 지식을 구조화하여 조직 차원의 자산으로 축적
- **사소한 오류까지 커버**: 문서화되지 않아 놓치던 작은 오류 사례도 AI가 제안·보완 가능
- **서비스 안정성 향상**: 보안 패치 및 버전업 과정에서 발생하는 장애를 신속히 대응
- **LLM 환각 방지**: 실제 커밋을 근거로 명시하여 신뢰할 수 있는 해결책 제시

### Background Context
KT 클라우드 내부 개발 환경에서는 주기적인 라이브러리 버전 업그레이드와 그에 따른 코드 수정이 빈번하게 발생합니다. 특히 보안 패치나 프레임워크 버전업 시기에는 여러 프로젝트에서 비슷한 오류가 동시다발적으로 발생하는 패턴이 나타납니다. 

현재 사내에서는 Confluence 위키를 통해 환경 설정이나 배포 절차를 문서화하고 있지만, 실제 코딩 과정에서 발생하는 런타임 오류는 위키보다 직접 디버깅이나 외부 검색에 의존하는 경우가 많습니다. 또한 버전업 과정에서 발생하는 단순하거나 사소한 오류는 문서화되지 않아 Confluence에도 남지 않으며, Cursor와 같은 AI 도구에 맡겨도 적절한 해결책을 제시하지 못하고 수정 루프에 빠지는 사례가 적지 않습니다.

이러한 오류를 해결한 흔적은 이미 커밋 이력에 남아 있음에도 불구하고, 현재는 체계적으로 활용되지 못하고 있습니다. 오답노트 MCP는 이러한 반복적으로 발생하는 오류에 대한 디버깅 프로세스를 개선하기 위해 과거 커밋 로그와 코드 수정 내역을 활용한 AI 디버깅 도우미를 제공합니다.

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-01-17 | v1.0 | 초기 PRD 작성 | John (PM) |

## Requirements

### Functional Requirements

**FR1**: 시스템은 GitHub 저장소의 커밋 메시지와 Diff를 자동으로 수집하고 전처리할 수 있어야 합니다.

**FR2**: 시스템은 수집된 커밋 데이터를 임베딩하여 벡터 데이터베이스에 저장할 수 있어야 합니다.

**FR3**: 시스템은 개발자의 질의를 기반으로 하이브리드 검색(BM25 + Vector)을 수행할 수 있어야 합니다.

**FR4**: 시스템은 최근 커밋에 가중치를 적용하여 관련성이 높은 사례를 우선 선별할 수 있어야 합니다.

**FR5**: 시스템은 검색된 커밋과 Diff를 LLM에 주입하여 근거와 함께 코드 패치 제안을 생성할 수 있어야 합니다.

**FR6**: 시스템은 MCP(Model Context Protocol) 서버로 구현되어 Cursor/VSCode 등 IDE에서 표준 연결을 지원해야 합니다.

**FR7**: 시스템은 쿼리 확장(에러토큰, API명) 기능을 제공해야 합니다.

**FR8**: 시스템은 검색 결과에 대한 신뢰도 점수를 제공해야 합니다.

### Non-Functional Requirements

**NFR1**: 시스템은 Azure 클라우드 환경에서 안정적으로 운영되어야 합니다.

**NFR2**: 시스템은 초기에는 App Service로 배포되며, 추후 AKS로 확장 가능해야 합니다.

**NFR3**: 시스템은 Azure Key Vault를 통한 보안 관리가 적용되어야 합니다.

**NFR4**: 시스템은 Application Insights를 통한 모니터링이 구현되어야 합니다.

**NFR5**: 시스템은 CI/CD 파이프라인을 통해 자동 배포되어야 합니다.

**NFR6**: 시스템은 검색 응답 시간이 3초 이내여야 합니다.

**NFR7**: 시스템은 99.9% 가용성을 유지해야 합니다.

**NFR8**: 시스템은 내부 데이터 사용 시 보안 및 프라이버시를 고려해야 합니다.

## User Interface Design Goals

### Overall UX Vision
오답노트 MCP는 개발자가 코딩 중 오류를 만났을 때 자연스럽게 질문하고, 신뢰할 수 있는 해결책을 즉시 받을 수 있는 "투명한 디버깅 어시스턴트"를 목표로 합니다. 개발 워크플로우에 방해가 되지 않으면서도 강력한 문제 해결 능력을 제공하는 것이 핵심입니다.

### Key Interaction Paradigms
- **IDE 통합**: Cursor, VSCode 등에서 자연스러운 채팅 인터페이스로 질의
- **컨텍스트 인식**: 현재 작업 중인 코드와 오류 메시지를 자동으로 인식
- **근거 기반 제안**: 검색된 커밋과 Diff를 명시하여 신뢰성 확보
- **점진적 개선**: 사용자 피드백을 통한 지속적인 학습과 개선

### Core Screens and Views
- **IDE 채팅 인터페이스**: 개발자가 오류에 대해 질문하는 메인 인터페이스
- **검색 결과 표시**: 관련 커밋과 Diff를 보여주는 결과 화면
- **해결책 제안**: 코드 패치와 설명을 포함한 제안 화면
- **피드백 수집**: 제안의 유용성을 평가하는 간단한 피드백 메커니즘

### Accessibility: None
현재 MVP 단계에서는 특별한 접근성 요구사항이 없습니다. 향후 확장 시 WCAG AA 수준을 고려할 수 있습니다.

### Branding
KT 클라우드의 기업 아이덴티티를 반영하되, 개발자 친화적인 미니멀한 디자인을 적용합니다. 기술적이고 신뢰할 수 있는 느낌을 주는 색상과 타이포그래피를 사용합니다.

### Target Device and Platforms: Cross-Platform
- **주요 플랫폼**: Cursor, VSCode, IntelliJ IDEA 등 주요 IDE
- **운영체제**: Windows, macOS, Linux 지원
- **브라우저**: 웹 기반 관리 인터페이스는 Chrome, Firefox, Safari 지원

## Technical Assumptions

### Repository Structure: Monorepo
- **선택 이유**: MCP 서버, 데이터 수집 서비스, 임베딩 서비스 등 여러 컴포넌트가 밀접하게 연관되어 있어 Monorepo 구조가 적합합니다.
- **장점**: 코드 공유, 의존성 관리, 통합 테스트가 용이합니다.

### Service Architecture: Microservices
- **구성 요소**:
  - **MCP Server**: TypeScript/Node.js 기반의 Model Context Protocol 서버
  - **Data Ingestion Service**: Git 커밋 수집 및 전처리 서비스
  - **Embedding Service**: 텍스트 임베딩 생성 서비스
  - **Search Service**: 하이브리드 검색 및 랭킹 서비스
  - **LLM Service**: 응답 생성 서비스
- **선택 이유**: 각 서비스가 독립적으로 확장 가능하고, 서로 다른 기술 스택을 사용할 수 있습니다.

### Testing Requirements: Unit + Integration
- **Unit Testing**: 각 서비스의 핵심 로직에 대한 단위 테스트
- **Integration Testing**: 서비스 간 통신 및 데이터 흐름 테스트
- **API Testing**: MCP 서버의 API 엔드포인트 테스트
- **선택 이유**: 마이크로서비스 아키텍처에서 서비스 간 통합이 중요하므로 Integration Testing이 필수입니다.

### Additional Technical Assumptions and Requests

**데이터베이스 및 스토리지:**
- Azure AI Search (Vector + BM25) 또는 pgvector(Postgres) 사용
- Chroma를 대안으로 고려
- 하이브리드 검색을 위한 벡터 인덱싱과 텍스트 검색 지원

**AI/ML 서비스:**
- Azure OpenAI GPT-4o 또는 GPT-4.1 사용
- Azure OpenAI text-embedding-3-large 또는 e5-large 사용
- 쿼리 확장을 위한 에러 토큰 및 API명 추출

**보안 및 인증:**
- Azure Key Vault를 통한 시크릿 관리
- Managed Identity 사용
- 내부 데이터 사용 시 보안 및 프라이버시 고려

**모니터링 및 로깅:**
- Application Insights 통합
- Azure Monitor를 통한 시스템 모니터링
- 검색 히트율, 제안 적용률 추적

**CI/CD:**
- GitHub Actions 사용
- ACR(Azure Container Registry)을 통한 이미지 관리
- 멀티태깅(sha, branch, latest) 지원

**배포 전략:**
- 초기: App Service 단일 앱 배포
- 확장: AKS 클러스터로 마이그레이션
- Blue-Green 배포 전략 고려

**성능 요구사항:**
- 검색 응답 시간: 3초 이내
- 가용성: 99.9%
- 동시 사용자: 초기 100명, 확장 시 1000명

## Epic List

**Epic 1: Foundation & Core Infrastructure**
프로젝트 기반 구조를 구축하고 핵심 인프라를 설정하여 MCP 서버의 기본 동작을 보장합니다.

**Epic 2: Data Collection & Processing**
Git 커밋 데이터 수집, 전처리, 임베딩 생성 및 저장소 구축을 통해 오답노트 데이터베이스를 구축합니다.

**Epic 3: Search & Retrieval Engine**
하이브리드 검색 시스템을 구현하여 개발자 질의에 대한 관련 커밋 사례를 효율적으로 검색합니다.

**Epic 4: AI Response Generation**
검색된 커밋을 기반으로 LLM이 근거와 함께 코드 수정 제안을 생성하는 시스템을 구축합니다.

**Epic 5: MCP Server & IDE Integration**
Model Context Protocol 서버를 구현하고 Cursor/VSCode 등 IDE와의 통합을 완성합니다.

**Epic 6: Monitoring & Operations**
시스템 모니터링, 로깅, 성능 추적 및 운영 도구를 구축하여 서비스 안정성을 확보합니다.

## Epic 1: Foundation & Core Infrastructure

프로젝트 기반 구조를 구축하고 핵심 인프라를 설정하여 MCP 서버의 기본 동작을 보장합니다. 이 Epic은 전체 시스템의 기반이 되는 인프라와 기본 서비스를 구축하여 후속 Epic들이 안정적으로 개발될 수 있는 환경을 제공합니다.

### Story 1.1: Project Setup & Repository Structure
As a **developer**,
I want **a well-structured monorepo with proper configuration**,
so that **I can efficiently develop and maintain the MCP server components**.

#### Acceptance Criteria
1. Monorepo 구조가 설정되어 MCP 서버, 데이터 수집 서비스, 임베딩 서비스 등이 적절히 분리되어 있습니다.
2. TypeScript, Node.js 개발 환경이 구성되어 있습니다.
3. ESLint, Prettier, Husky 등 코드 품질 도구가 설정되어 있습니다.
4. package.json과 의존성 관리가 각 서비스별로 구성되어 있습니다.
5. README.md와 개발 가이드가 작성되어 있습니다.

### Story 1.2: Azure Cloud Infrastructure Setup
As a **system administrator**,
I want **Azure 클라우드 인프라가 구성**,
so that **MCP 서버가 안정적으로 운영될 수 있습니다**.

#### Acceptance Criteria
1. Azure 리소스 그룹과 기본 네트워킹이 구성되어 있습니다.
2. Azure Key Vault가 설정되어 시크릿 관리가 가능합니다.
3. Azure Container Registry가 구성되어 이미지 저장이 가능합니다.
4. Application Insights가 설정되어 모니터링이 가능합니다.
5. Managed Identity가 구성되어 보안 인증이 가능합니다.

### Story 1.3: CI/CD Pipeline Foundation
As a **developer**,
I want **GitHub Actions 기반 CI/CD 파이프라인**,
so that **코드 변경사항이 자동으로 빌드, 테스트, 배포됩니다**.

#### Acceptance Criteria
1. GitHub Actions 워크플로우가 설정되어 있습니다.
2. 코드 커밋 시 자동 빌드와 테스트가 실행됩니다.
3. Docker 이미지 빌드 및 ACR 푸시가 자동화되어 있습니다.
4. 멀티태깅(sha, branch, latest)이 지원됩니다.
5. 배포 승인 프로세스가 구현되어 있습니다.

### Story 1.4: Basic MCP Server Framework
As a **developer**,
I want **기본 MCP 서버 프레임워크**,
so that **IDE와의 기본 통신이 가능합니다**.

#### Acceptance Criteria
1. Model Context Protocol 서버의 기본 구조가 구현되어 있습니다.
2. Cursor/VSCode와의 기본 연결이 가능합니다.
3. 간단한 헬스체크 엔드포인트가 구현되어 있습니다.
4. 로깅 시스템이 기본적으로 구성되어 있습니다.
5. 에러 핸들링이 기본적으로 구현되어 있습니다.

## Epic 2: Data Collection & Processing

Git 커밋 데이터 수집, 전처리, 임베딩 생성 및 저장소 구축을 통해 오답노트 데이터베이스를 구축합니다. 이 Epic은 기획문서의 핵심 기능인 "오답노트 (데이터 수집·전처리)"를 구현하여 시스템의 지식베이스 기반을 마련합니다.

### Story 2.1: Git Commit Data Collection Service
As a **data engineer**,
I want **Git 커밋 메시지와 Diff를 자동으로 수집하는 서비스**,
so that **오답노트 데이터베이스의 원시 데이터를 확보할 수 있습니다**.

#### Acceptance Criteria
1. GitHub REST/GraphQL API를 통한 커밋 데이터 수집이 구현되어 있습니다.
2. git CLI를 통한 로컬 저장소 데이터 수집이 지원됩니다.
3. PyDriller를 활용한 커밋 메시지와 Diff 추출이 구현되어 있습니다.
4. 모든 브랜치의 커밋 데이터를 수집할 수 있습니다.
5. 수집된 데이터의 메타데이터(저장소, 브랜치, 날짜 등)가 보존됩니다.

### Story 2.2: Commit Data Preprocessing & Labeling
As a **data engineer**,
I want **커밋 데이터를 전처리하고 라벨링하는 시스템**,
so that **검색 정밀도를 높일 수 있는 구조화된 데이터를 생성할 수 있습니다**.

#### Acceptance Criteria
1. 규칙 기반 1차 필터링으로 버전업/수정 관련 커밋을 선별합니다.
2. Azure OpenAI GPT-4o를 활용한 2차 LLM 분류가 구현되어 있습니다.
3. 패키지명, 버전, 에러타입, API 시그니처가 정형 필드로 추출됩니다.
4. JSON 형태로 구조화된 데이터가 생성됩니다.
5. 전처리 과정의 품질 검증 메커니즘이 구현되어 있습니다.

### Story 2.3: Text Embedding Generation
As a **data engineer**,
I want **커밋 메시지와 Diff를 임베딩으로 변환하는 서비스**,
so that **벡터 검색이 가능한 형태로 데이터를 저장할 수 있습니다**.

#### Acceptance Criteria
1. Azure OpenAI text-embedding-3-large 또는 e5-large를 사용합니다.
2. 코드와 텍스트 혼합 검색에 최적화된 임베딩이 생성됩니다.
3. 임베딩 생성 과정의 배치 처리가 지원됩니다.
4. 임베딩 메타데이터가 원본 커밋과 연결되어 저장됩니다.
5. 임베딩 품질 검증 메커니즘이 구현되어 있습니다.

### Story 2.4: Vector Database Setup & Storage
As a **data engineer**,
I want **벡터 데이터베이스에 임베딩을 저장하는 시스템**,
so that **효율적인 벡터 검색이 가능합니다**.

#### Acceptance Criteria
1. Azure AI Search 또는 pgvector(Postgres)가 구성되어 있습니다.
2. 하이브리드 검색(BM25+Vector)을 위한 인덱스가 생성됩니다.
3. 임베딩과 메타데이터가 효율적으로 저장됩니다.
4. 데이터 백업 및 복구 메커니즘이 구현되어 있습니다.
5. 저장소 성능 모니터링이 설정되어 있습니다.

## Epic 3: Search & Retrieval Engine

하이브리드 검색 시스템을 구현하여 개발자 질의에 대한 관련 커밋 사례를 효율적으로 검색합니다. 이 Epic은 기획문서의 "검색·랭킹" 기능을 구현하여 사용자 질의에 대한 정확한 답변을 제공하는 핵심 엔진을 구축합니다.

### Story 3.1: Hybrid Search Implementation
As a **search engineer**,
I want **BM25와 벡터 검색을 결합한 하이브리드 검색 시스템**,
so that **텍스트와 의미 기반 검색의 장점을 모두 활용할 수 있습니다**.

#### Acceptance Criteria
1. BM25 텍스트 검색이 구현되어 있습니다.
2. 벡터 유사도 검색이 구현되어 있습니다.
3. 두 검색 결과를 적절히 결합하는 알고리즘이 구현되어 있습니다.
4. 검색 성능이 3초 이내로 유지됩니다.
5. 검색 결과의 품질 메트릭이 측정됩니다.

### Story 3.2: Query Expansion & Enhancement
As a **search engineer**,
I want **사용자 질의를 확장하고 개선하는 시스템**,
so that **검색 정확도와 관련성을 높일 수 있습니다**.

#### Acceptance Criteria
1. 에러 토큰과 API명을 자동으로 추출합니다.
2. 동의어 및 관련 용어 확장이 구현되어 있습니다.
3. 컨텍스트 기반 쿼리 개선이 지원됩니다.
4. 검색 히스토리를 활용한 개인화가 구현되어 있습니다.
5. 쿼리 확장 과정의 투명성이 보장됩니다.

### Story 3.3: Time-Weighted Ranking System
As a **search engineer**,
I want **최근 커밋에 가중치를 적용하는 랭킹 시스템**,
so that **최신 환경 변화에 직결되는 오류를 우선적으로 제안할 수 있습니다**.

#### Acceptance Criteria
1. 커밋 날짜 기반 시간 가중치가 적용됩니다.
2. 보안 패치 및 버전업 시기의 커밋에 추가 가중치가 부여됩니다.
3. 랭킹 알고리즘의 투명성이 보장됩니다.
4. 랭킹 결과의 일관성이 검증됩니다.
5. 랭킹 파라미터 조정이 가능합니다.

### Story 3.4: Search Result Re-ranking
As a **search engineer**,
I want **검색 결과를 재정렬하는 시스템**,
so that **사용자 의도에 가장 적합한 결과를 우선 제시할 수 있습니다**.

#### Acceptance Criteria
1. Cohere 또는 Azure OpenAI Reranker를 활용합니다.
2. 사용자 피드백을 반영한 학습이 지원됩니다.
3. 재정렬 과정의 성능이 최적화되어 있습니다.
4. 재정렬 결과의 품질이 측정됩니다.
5. A/B 테스트를 통한 알고리즘 개선이 가능합니다.

## Epic 4: AI Response Generation

검색된 커밋을 기반으로 LLM이 근거와 함께 코드 수정 제안을 생성하는 시스템을 구축합니다. 이 Epic은 기획문서의 "응답 생성" 기능을 구현하여 사용자에게 신뢰할 수 있는 해결책을 제공합니다.

### Story 4.1: LLM Integration & Prompt Engineering
As a **AI engineer**,
I want **Azure OpenAI GPT-4o와의 통합 및 프롬프트 엔지니어링**,
so that **검색된 커밋을 기반으로 정확한 해결책을 생성할 수 있습니다**.

#### Acceptance Criteria
1. Azure OpenAI GPT-4o API 통합이 구현되어 있습니다.
2. 커밋 컨텍스트를 포함한 프롬프트 템플릿이 설계되어 있습니다.
3. LLM 환각을 방지하는 가드레일이 구현되어 있습니다.
4. 응답 생성 과정의 추적성이 보장됩니다.
5. 프롬프트 버전 관리가 지원됩니다.

### Story 4.2: Code Patch Generation
As a **AI engineer**,
I want **검색된 커밋을 참고하여 코드 패치를 생성하는 시스템**,
so that **사용자가 직접 적용할 수 있는 구체적인 수정안을 제공할 수 있습니다**.

#### Acceptance Criteria
1. Diff 형태의 코드 패치가 생성됩니다.
2. 수정 전후 코드의 차이점이 명확히 표시됩니다.
3. 패치 적용 방법과 주의사항이 포함됩니다.
4. 생성된 패치의 문법적 정확성이 검증됩니다.
5. 패치 생성 과정의 재현성이 보장됩니다.

### Story 4.3: Evidence-Based Response Formatting
As a **AI engineer**,
I want **근거와 함께 응답을 포맷팅하는 시스템**,
so that **사용자가 제안의 신뢰성을 평가할 수 있습니다**.

#### Acceptance Criteria
1. 참조된 커밋과 Diff가 명시적으로 표시됩니다.
2. 신뢰도 점수가 계산되어 제공됩니다.
3. 응답 형식이 일관되고 읽기 쉽게 구성됩니다.
4. 마크다운 형태로 포맷팅됩니다.
5. 응답 품질 메트릭이 측정됩니다.

### Story 4.4: Response Quality Validation
As a **AI engineer**,
I want **생성된 응답의 품질을 검증하는 시스템**,
so that **사용자에게 높은 품질의 해결책을 제공할 수 있습니다**.

#### Acceptance Criteria
1. 응답의 기술적 정확성이 검증됩니다.
2. 코드 패치의 실행 가능성이 확인됩니다.
3. 근거의 관련성이 평가됩니다.
4. 품질 검증 결과가 로깅됩니다.
5. 품질 기준 미달 시 재생성 메커니즘이 구현되어 있습니다.

## Epic 5: MCP Server & IDE Integration

Model Context Protocol 서버를 구현하고 Cursor/VSCode 등 IDE와의 통합을 완성합니다. 이 Epic은 기획문서의 핵심 목표인 IDE 통합을 통해 실제 사용자 경험을 제공합니다.

### Story 5.1: MCP Server Core Implementation
As a **backend developer**,
I want **완전한 MCP 서버 구현**,
so that **IDE와의 표준 통신이 가능합니다**.

#### Acceptance Criteria
1. Model Context Protocol 표준을 완전히 준수합니다.
2. Cursor, VSCode, IntelliJ IDEA와의 연결이 지원됩니다.
3. 실시간 통신이 안정적으로 작동합니다.
4. 에러 핸들링과 재연결 메커니즘이 구현되어 있습니다.
5. 서버 성능이 최적화되어 있습니다.

### Story 5.2: IDE Plugin Development
As a **frontend developer**,
I want **주요 IDE용 플러그인**,
so that **개발자가 자연스럽게 오답노트 MCP를 사용할 수 있습니다**.

#### Acceptance Criteria
1. Cursor용 플러그인이 개발되어 있습니다.
2. VSCode용 확장이 개발되어 있습니다.
3. 플러그인 설치 및 설정이 간단합니다.
4. IDE 내에서 자연스러운 채팅 인터페이스가 제공됩니다.
5. 플러그인 업데이트가 자동으로 이루어집니다.

### Story 5.3: Context-Aware Integration
As a **full-stack developer**,
I want **현재 작업 중인 코드 컨텍스트를 인식하는 시스템**,
so that **더 정확하고 관련성 높은 해결책을 제공할 수 있습니다**.

#### Acceptance Criteria
1. 현재 열린 파일의 코드를 자동으로 인식합니다.
2. 오류 메시지와 스택 트레이스를 파싱합니다.
3. 프로젝트의 기술 스택을 자동으로 감지합니다.
4. 컨텍스트 정보가 검색 쿼리에 반영됩니다.
5. 개인정보 보호가 보장됩니다.

### Story 5.4: User Feedback Collection
As a **product manager**,
I want **사용자 피드백을 수집하는 시스템**,
so that **서비스 품질을 지속적으로 개선할 수 있습니다**.

#### Acceptance Criteria
1. 제안의 유용성을 평가하는 피드백 메커니즘이 구현되어 있습니다.
2. 사용자 행동 패턴이 분석됩니다.
3. 피드백 데이터가 안전하게 저장됩니다.
4. 개인정보가 보호됩니다.
5. 피드백 기반 개선사항이 추적됩니다.

## Epic 6: Monitoring & Operations

시스템 모니터링, 로깅, 성능 추적 및 운영 도구를 구축하여 서비스 안정성을 확보합니다. 이 Epic은 기획문서의 "운영/배포/보안/관측" 요구사항을 구현합니다.

### Story 6.1: Application Monitoring Setup
As a **DevOps engineer**,
I want **Application Insights 기반 모니터링 시스템**,
so that **시스템 상태를 실시간으로 파악할 수 있습니다**.

#### Acceptance Criteria
1. Application Insights가 모든 서비스에 통합되어 있습니다.
2. 성능 메트릭이 실시간으로 수집됩니다.
3. 에러 및 예외가 자동으로 추적됩니다.
4. 사용자 행동 분석이 구현되어 있습니다.
5. 알림 시스템이 구성되어 있습니다.

### Story 6.2: Performance Tracking & Analytics
As a **data analyst**,
I want **검색 히트율과 제안 적용률을 추적하는 시스템**,
so that **서비스 효과를 정량적으로 측정할 수 있습니다**.

#### Acceptance Criteria
1. 검색 성공률이 측정됩니다.
2. 제안 적용률이 추적됩니다.
3. 사용자 만족도가 측정됩니다.
4. 성능 대시보드가 구축되어 있습니다.
5. 정기적인 리포트가 생성됩니다.

### Story 6.3: Security & Compliance
As a **security engineer**,
I want **보안 및 컴플라이언스 시스템**,
so that **내부 데이터 사용 시 보안이 보장됩니다**.

#### Acceptance Criteria
1. Azure Key Vault를 통한 시크릿 관리가 구현되어 있습니다.
2. 데이터 암호화가 적용되어 있습니다.
3. 접근 제어가 구현되어 있습니다.
4. 감사 로그가 기록됩니다.
5. 개인정보 보호 정책이 준수됩니다.

### Story 6.4: Automated Deployment & Scaling
As a **DevOps engineer**,
I want **자동화된 배포 및 스케일링 시스템**,
so that **서비스가 안정적으로 운영됩니다**.

#### Acceptance Criteria
1. Blue-Green 배포가 구현되어 있습니다.
2. 자동 스케일링이 설정되어 있습니다.
3. 롤백 메커니즘이 구현되어 있습니다.
4. 헬스체크가 자동화되어 있습니다.
5. 재해 복구 계획이 수립되어 있습니다.

## Checklist Results Report

### PM 체크리스트 실행 결과

**Executive Summary:**
- **전체 PRD 완성도**: 85%
- **MVP 범위 적절성**: 적절함 (Just Right)
- **아키텍처 단계 준비도**: 준비됨 (Ready)
- **주요 우려사항**: 사용자 연구 및 경쟁사 분석 부족

### Category Analysis Table

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PARTIAL | 사용자 연구 및 경쟁사 분석 부족 |
| 2. MVP Scope Definition          | PASS    | - |
| 3. User Experience Requirements  | PARTIAL | 사용자 여정 맵핑 부족 |
| 4. Functional Requirements       | PASS    | - |
| 5. Non-Functional Requirements   | PASS    | - |
| 6. Epic & Story Structure        | PASS    | - |
| 7. Technical Guidance            | PASS    | - |
| 8. Cross-Functional Requirements | PASS    | - |
| 9. Clarity & Communication       | PASS    | - |

### Top Issues by Priority

**HIGH (품질 개선 필요):**
- 사용자 페르소나 및 사용자 연구 부족
- 경쟁사 분석 및 시장 컨텍스트 부족
- 사용자 여정 맵핑 부족

**MEDIUM (명확성 개선):**
- 성공 지표의 구체적인 측정 방법 부족
- 사용자 피드백 수집 메커니즘 상세화 필요

**LOW (개선 권장):**
- 접근성 요구사항 상세화
- 다국어 지원 계획

### MVP Scope Assessment

**현재 범위 평가:**
- ✅ 핵심 기능이 적절히 정의됨
- ✅ Epic 순서가 논리적으로 구성됨
- ✅ 각 Story가 독립적으로 완료 가능
- ⚠️ 첫 번째 Epic에 프로젝트 설정이 포함되어 있음

**복잡도 우려사항:**
- 하이브리드 검색 시스템 구현의 복잡성
- LLM 통합 및 프롬프트 엔지니어링의 난이도

### Technical Readiness

**기술적 제약사항 명확성:**
- ✅ Azure 클라우드 환경 명시
- ✅ MCP 프로토콜 요구사항 명확
- ✅ 성능 요구사항 구체화

**식별된 기술적 위험:**
- 벡터 검색 성능 최적화
- LLM 환각 방지 메커니즘
- 대규모 데이터 처리 성능

### Recommendations

1. **사용자 연구 수행**: KT 클라우드 내부 개발자 대상 인터뷰 및 설문조사
2. **경쟁사 분석**: GitHub Copilot, Cursor AI 등과의 차별화 포인트 명확화
3. **사용자 여정 맵핑**: 오류 발생부터 해결까지의 전체 프로세스 시각화
4. **성공 지표 구체화**: 정량적 측정 방법 및 기준점 설정

## Next Steps

### UX Expert Prompt
```
오답노트 MCP 프로젝트의 PRD가 완성되었습니다. 
주요 요구사항: IDE 통합 채팅 인터페이스, 컨텍스트 인식 검색, 근거 기반 해결책 제안
다음 단계로 UX 설계를 진행해주세요.
```

### Architect Prompt
```
오답노트 MCP 프로젝트의 PRD가 완성되었습니다.
주요 기술 스택: Azure 클라우드, TypeScript/Node.js, MCP 서버, 하이브리드 검색
다음 단계로 시스템 아키텍처 설계를 진행해주세요.
```

## 기획문서 보완점 및 제안사항

### 1. 사용자 연구 부족
**현재 상태**: 문제 정의는 잘 되어 있으나, 실제 사용자(KT 클라우드 개발자)의 구체적인 니즈와 페인포인트에 대한 연구가 부족합니다.

**보완 제안**:
- KT 클라우드 내부 개발자 대상 인터뷰 및 설문조사 수행
- 현재 디버깅 프로세스의 구체적인 시간 소요 및 어려움 정량화
- 오답노트 MCP 사용 시나리오에 대한 사용자 검증

### 2. 경쟁사 분석 부족
**현재 상태**: GitHub Copilot, Cursor AI 등과의 차별화 포인트가 명시되어 있지만, 구체적인 경쟁사 분석이 부족합니다.

**보완 제안**:
- 주요 경쟁사( GitHub Copilot, Cursor AI, Tabnine 등)의 기능 비교 분석
- 오답노트 MCP만의 고유한 가치 제안 명확화
- 가격 정책 및 시장 진입 전략 수립

### 3. 성공 지표 구체화 부족
**현재 상태**: "평균 복구 시간 50% 감소" 등 목표는 있으나, 측정 방법과 기준점이 불명확합니다.

**보완 제안**:
- 현재 디버깅 시간의 베이스라인 측정
- 제안 정확도, 적용률, 재발률 등 구체적 KPI 정의
- A/B 테스트를 통한 효과 검증 방법 수립

### 4. 기술적 위험 요소 분석 부족
**현재 상태**: 기술 스택은 잘 정의되어 있으나, 구현 시 발생할 수 있는 위험 요소에 대한 분석이 부족합니다.

**보완 제안**:
- LLM 환각 방지 메커니즘의 구체적 구현 방안
- 대규모 데이터 처리 시 성능 최적화 전략
- 보안 및 프라이버시 보호 방안 상세화

### 5. 사용자 여정 맵핑 부족
**현재 상태**: 기능은 잘 정의되어 있으나, 사용자가 오류를 만났을 때부터 해결까지의 전체 프로세스가 시각화되지 않았습니다.

**보완 제안**:
- 오류 발생 → 질문 → 검색 → 해결책 제안 → 적용 → 피드백의 전체 여정 맵핑
- 각 단계별 사용자 경험 개선 포인트 식별
- 예외 상황 및 에러 케이스 처리 방안 수립

---

**전체적으로 기획문서는 매우 잘 작성되어 있으며, 핵심 아이디어와 기술적 접근 방식이 명확합니다. 위의 보완점들을 추가하면 더욱 완성도 높은 프로젝트가 될 것입니다.**


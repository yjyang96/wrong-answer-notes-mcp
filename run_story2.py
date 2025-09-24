#!/usr/bin/env python3
"""
Story 2 통합 실행 스크립트
- Story 2.1: Git Commit Data Collection
- Story 2.2: Commit Data Preprocessing & Labeling  
- Story 2.3: Text Embedding Generation
- Story 2.4: Vector Database Setup & Storage

사용법: python run_story2.py <repository> <max_commits>
예시: python run_story2.py tensorflow/tensorflow 100
"""

import os
import sys
import json
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Optional
import argparse


class Story2Runner:
    """Story 2 전체 파이프라인 실행기"""
    
    def __init__(self, repository: str, max_commits: int):
        self.repository = repository
        self.max_commits = max_commits
        self.project_root = Path(__file__).parent
        self.timestamp = int(time.time())
        
        # 출력 디렉토리 설정
        self.output_dir = self.project_root / "output"
        self.output_dir.mkdir(exist_ok=True)
        
        # 파일 경로 설정
        self.raw_commits_file = self.output_dir / f"raw_{repository.replace('/', '_')}_commits.json"
        self.processed_commits_file = self.output_dir / f"processed_{repository.replace('/', '_')}_commits.json"
        self.embeddings_dir = self.output_dir / "embeddings"
        
        print(f"🚀 Story 2 파이프라인 시작")
        print(f"📦 저장소: {repository}")
        print(f"📊 최대 커밋 수: {max_commits}")
        print(f"📁 출력 디렉토리: {self.output_dir}")
        print("=" * 60)
    
    def run_command(self, command: str, cwd: Optional[Path] = None, description: str = "") -> bool:
        """명령어 실행"""
        if description:
            print(f"\n🔄 {description}")
            print(f"💻 명령어: {command}")
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd or self.project_root,
                capture_output=True,
                text=True,
                check=True
            )
            
            if description:
                print(f"✅ {description} 완료")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ {description} 실패")
            print(f"오류: {e.stderr}")
            return False
    
    def check_environment(self) -> bool:
        """환경 설정 확인"""
        print("\n🔍 환경 설정 확인 중...")
        
        # Node.js 확인
        if not self.run_command("node --version", description="Node.js 확인"):
            print("❌ Node.js가 설치되지 않았습니다.")
            return False
        
        # Python 확인
        if not self.run_command("python3 --version", description="Python 확인"):
            print("❌ Python이 설치되지 않았습니다.")
            return False
        
        # .env 파일 확인
        env_files = [
            self.project_root / "data-ingestion" / ".env",
            self.project_root / "embedding-service" / ".env", 
            self.project_root / "vector-db-service" / ".env"
        ]
        
        missing_env = []
        for env_file in env_files:
            if not env_file.exists():
                missing_env.append(str(env_file))
        
        if missing_env:
            print("⚠️  다음 .env 파일들이 없습니다:")
            for env_file in missing_env:
                print(f"   - {env_file}")
            print("   env.example을 복사하여 .env 파일을 생성하세요.")
            return False
        
        print("✅ 환경 설정 확인 완료")
        return True
    
    def story_2_1_data_collection(self) -> bool:
        """Story 2.1: Git Commit Data Collection"""
        print(f"\n📥 Story 2.1: Git Commit Data Collection")
        print("-" * 40)
        
        # data-ingestion 디렉토리로 이동
        data_ingestion_dir = self.project_root / "data-ingestion"
        
        # 의존성 설치
        if not self.run_command("npm install", cwd=data_ingestion_dir, description="의존성 설치"):
            return False
        
        # GitHub API로 커밋 수집
        command = f"npx ts-node src/index.ts {self.repository} --limit {self.max_commits} --output {self.raw_commits_file}"
        
        if not self.run_command(command, cwd=data_ingestion_dir, description="GitHub API 커밋 수집"):
            return False
        
        # 파일 존재 확인
        if not self.raw_commits_file.exists():
            print(f"❌ 수집된 커밋 파일이 없습니다: {self.raw_commits_file}")
            return False
        
        # 수집된 커밋 수 확인
        with open(self.raw_commits_file, 'r') as f:
            commits = json.load(f)
        
        print(f"✅ {len(commits)}개 커밋 수집 완료")
        return True
    
    def story_2_2_preprocessing(self) -> bool:
        """Story 2.2: Commit Data Preprocessing & Labeling"""
        print(f"\n🔄 Story 2.2: Commit Data Preprocessing & Labeling")
        print("-" * 40)
        
        # data-ingestion 디렉토리로 이동
        data_ingestion_dir = self.project_root / "data-ingestion"
        
        # 전처리 실행
        command = f"npx ts-node src/cli/preprocessing-cli.ts preprocess --input {self.raw_commits_file} --output {self.processed_commits_file}"
        
        if not self.run_command(command, cwd=data_ingestion_dir, description="LLM 전처리 및 분류"):
            return False
        
        # 파일 존재 확인
        if not self.processed_commits_file.exists():
            print(f"❌ 전처리된 커밋 파일이 없습니다: {self.processed_commits_file}")
            return False
        
        # 전처리된 커밋 수 확인
        with open(self.processed_commits_file, 'r') as f:
            processed_commits = json.load(f)
        
        print(f"✅ {len(processed_commits)}개 커밋 전처리 완료")
        return True
    
    def story_2_3_embedding(self) -> bool:
        """Story 2.3: Text Embedding Generation"""
        print(f"\n🧠 Story 2.3: Text Embedding Generation")
        print("-" * 40)
        
        # embedding-service 디렉토리로 이동
        embedding_dir = self.project_root / "embedding-service"
        
        # Python 가상환경 활성화 및 의존성 설치
        venv_python = embedding_dir / "venv" / "bin" / "python"
        if not venv_python.exists():
            print("❌ embedding-service 가상환경이 없습니다.")
            return False
        
        # 임베딩 생성
        command = f"{venv_python} -m src.main generate --input {self.processed_commits_file} --output {self.embeddings_dir}"
        
        if not self.run_command(command, cwd=embedding_dir, description="임베딩 생성"):
            return False
        
        # 임베딩 파일 수 확인
        embedding_files = list(self.embeddings_dir.glob("emb_*.json"))
        print(f"✅ {len(embedding_files)}개 임베딩 생성 완료")
        return True
    
    def story_2_4_vector_db(self) -> bool:
        """Story 2.4: Vector Database Setup & Storage"""
        print(f"\n🗄️ Story 2.4: Vector Database Setup & Storage")
        print("-" * 40)
        
        # vector-db-service 디렉토리로 이동
        vector_db_dir = self.project_root / "vector-db-service"
        
        # Python 가상환경 활성화
        venv_python = vector_db_dir / "venv" / "bin" / "python"
        if not venv_python.exists():
            print("❌ vector-db-service 가상환경이 없습니다.")
            return False
        
        # 벡터 DB 마이그레이션
        command = f"{venv_python} -m src.main migrate --source {self.embeddings_dir} --overwrite"
        
        if not self.run_command(command, cwd=vector_db_dir, description="벡터 DB 마이그레이션"):
            return False
        
        # 컬렉션 정보 확인
        info_command = f"{venv_python} -m src.main info"
        if not self.run_command(info_command, cwd=vector_db_dir, description="벡터 DB 정보 확인"):
            return False
        
        print("✅ 벡터 DB 구축 완료")
        return True
    
    def generate_summary(self) -> None:
        """실행 결과 요약 생성"""
        print(f"\n📊 Story 2 실행 결과 요약")
        print("=" * 60)
        
        summary = {
            "repository": self.repository,
            "max_commits": self.max_commits,
            "timestamp": self.timestamp,
            "files": {
                "raw_commits": str(self.raw_commits_file),
                "processed_commits": str(self.processed_commits_file),
                "embeddings_dir": str(self.embeddings_dir)
            },
            "statistics": {}
        }
        
        # 통계 수집
        try:
            if self.raw_commits_file.exists():
                with open(self.raw_commits_file, 'r') as f:
                    raw_commits = json.load(f)
                summary["statistics"]["raw_commits"] = len(raw_commits)
        except:
            pass
        
        try:
            if self.processed_commits_file.exists():
                with open(self.processed_commits_file, 'r') as f:
                    processed_commits = json.load(f)
                summary["statistics"]["processed_commits"] = len(processed_commits)
        except:
            pass
        
        try:
            if self.embeddings_dir.exists():
                embedding_files = list(self.embeddings_dir.glob("emb_*.json"))
                summary["statistics"]["embeddings"] = len(embedding_files)
        except:
            pass
        
        # 요약 파일 저장
        summary_file = self.output_dir / f"story2_summary_{self.timestamp}.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"📁 요약 파일: {summary_file}")
        print(f"📊 통계:")
        for key, value in summary["statistics"].items():
            print(f"   - {key}: {value}")
        
        print(f"\n🎉 Story 2 파이프라인 완료!")
        print(f"🔍 검색 테스트: cd vector-db-service && source venv/bin/activate && python -m src.main search --query 'your query' --hybrid")
    
    def run(self) -> bool:
        """전체 파이프라인 실행"""
        start_time = time.time()
        
        try:
            # 환경 확인
            if not self.check_environment():
                return False
            
            # Story 2.1: 데이터 수집
            if not self.story_2_1_data_collection():
                return False
            
            # Story 2.2: 전처리
            if not self.story_2_2_preprocessing():
                return False
            
            # Story 2.3: 임베딩 생성
            if not self.story_2_3_embedding():
                return False
            
            # Story 2.4: 벡터 DB 구축
            if not self.story_2_4_vector_db():
                return False
            
            # 결과 요약
            self.generate_summary()
            
            total_time = time.time() - start_time
            print(f"\n⏱️  총 실행 시간: {total_time:.2f}초")
            
            return True
            
        except KeyboardInterrupt:
            print(f"\n⚠️  사용자에 의해 중단되었습니다.")
            return False
        except Exception as e:
            print(f"\n❌ 예상치 못한 오류: {e}")
            return False


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description="Story 2 통합 실행 스크립트")
    parser.add_argument("repository", help="GitHub 저장소 (예: tensorflow/tensorflow)")
    parser.add_argument("max_commits", type=int, help="수집할 최대 커밋 수")
    
    args = parser.parse_args()
    
    # 저장소 형식 검증
    if "/" not in args.repository:
        print("❌ 저장소 형식이 올바르지 않습니다. 'owner/repo' 형식을 사용하세요.")
        sys.exit(1)
    
    # Story 2 실행
    runner = Story2Runner(args.repository, args.max_commits)
    success = runner.run()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

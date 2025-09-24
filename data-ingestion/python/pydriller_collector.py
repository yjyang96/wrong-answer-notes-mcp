#!/usr/bin/env python3
"""
PyDriller를 사용한 Git 커밋 데이터 수집기
"""

import json
import sys
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path

try:
    from pydriller import Repository
    from pydriller.domain.commit import Commit
    from pydriller.domain.modification import Modification
except ImportError:
    print("PyDriller가 설치되지 않았습니다. pip install pydriller를 실행하세요.")
    sys.exit(1)


class PyDrillerCollector:
    """PyDriller를 사용한 Git 커밋 데이터 수집기"""
    
    def __init__(self, repo_path: str):
        """
        Args:
            repo_path: Git 저장소 경로
        """
        self.repo_path = repo_path
        if not os.path.exists(repo_path):
            raise ValueError(f"저장소 경로가 존재하지 않습니다: {repo_path}")
    
    def collect_commits(
        self,
        branches: Optional[List[str]] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: Optional[int] = None,
        include_patterns: Optional[List[str]] = None,
        exclude_patterns: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        커밋 데이터 수집
        
        Args:
            branches: 수집할 브랜치 목록 (None이면 모든 브랜치)
            since: 수집 시작 날짜
            until: 수집 종료 날짜
            limit: 수집할 커밋 수 제한
            include_patterns: 포함할 파일 패턴
            exclude_patterns: 제외할 파일 패턴
            
        Returns:
            수집된 커밋 데이터 목록
        """
        commits = []
        
        try:
            # PyDriller Repository 객체 생성
            repo = Repository(
                path_to_repo=self.repo_path,
                only_in_branch=branches,
                since=since,
                to=until,
                only_modifications_with_file_types=include_patterns,
                only_no_merge=False
            )
            
            count = 0
            for commit in repo.traverse_commits():
                if limit and count >= limit:
                    break
                
                try:
                    commit_data = self._extract_commit_data(commit)
                    
                    # 파일 패턴 필터링
                    if self._should_include_commit(commit_data, include_patterns, exclude_patterns):
                        commits.append(commit_data)
                        count += 1
                        
                except Exception as e:
                    print(f"커밋 {commit.hash} 처리 중 오류 발생: {e}", file=sys.stderr)
                    continue
            
        except Exception as e:
            print(f"저장소 {self.repo_path} 처리 중 오류 발생: {e}", file=sys.stderr)
            raise
        
        return commits
    
    def _extract_commit_data(self, commit: Commit) -> Dict[str, Any]:
        """커밋에서 데이터 추출"""
        
        # 변경된 파일 정보 추출
        files = []
        for modification in commit.modifications:
            file_data = {
                "path": modification.filename,
                "type": self._get_change_type(modification.change_type),
                "additions": modification.added,
                "deletions": modification.removed,
                "size": modification.nloc if hasattr(modification, 'nloc') else None,
                "previousPath": modification.old_path if modification.old_path != modification.filename else None
            }
            files.append(file_data)
        
        # 저장소 정보 추출
        repository_info = self._get_repository_info()
        
        return {
            "hash": commit.hash,
            "message": commit.msg,
            "author": {
                "name": commit.author.name,
                "email": commit.author.email,
                "username": None  # PyDriller에서는 GitHub 사용자명을 직접 제공하지 않음
            },
            "committer": {
                "name": commit.committer.name,
                "email": commit.committer.email,
                "username": None
            },
            "date": commit.author_date.isoformat(),
            "diff": self._get_commit_diff(commit),
            "files": files,
            "branch": commit.branches[0] if commit.branches else "unknown",
            "repository": repository_info,
            "metadata": {
                "collectedAt": datetime.now(timezone.utc).isoformat(),
                "source": "pydriller",
                "version": "1.0.0",
                "config": {}
            }
        }
    
    def _get_change_type(self, change_type: int) -> str:
        """변경 타입을 문자열로 변환"""
        type_map = {
            0: "added",      # ADD
            1: "modified",   # MODIFY
            2: "deleted",    # DELETE
            3: "renamed",    # RENAME
            4: "copied",     # COPY
            5: "renamed"     # RENAME (다른 값)
        }
        return type_map.get(change_type, "modified")
    
    def _get_commit_diff(self, commit: Commit) -> str:
        """커밋의 Diff 정보 추출"""
        diff_parts = []
        
        for modification in commit.modifications:
            if modification.diff:
                diff_parts.append(f"--- a/{modification.filename}")
                diff_parts.append(f"+++ b/{modification.filename}")
                diff_parts.append(modification.diff)
        
        return "\n".join(diff_parts)
    
    def _get_repository_info(self) -> Dict[str, Any]:
        """저장소 정보 추출"""
        repo_name = os.path.basename(self.repo_path)
        
        return {
            "name": repo_name,
            "fullName": repo_name,
            "url": "",  # PyDriller에서는 URL을 직접 제공하지 않음
            "description": None,
            "defaultBranch": "main",  # 기본값
            "language": None,
            "size": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
    
    def _should_include_commit(
        self,
        commit_data: Dict[str, Any],
        include_patterns: Optional[List[str]] = None,
        exclude_patterns: Optional[List[str]] = None
    ) -> bool:
        """커밋이 포함 패턴에 맞는지 확인"""
        
        # 포함 패턴 확인
        if include_patterns:
            has_matching_file = False
            for file_info in commit_data["files"]:
                file_path = file_info["path"]
                for pattern in include_patterns:
                    if self._matches_pattern(file_path, pattern):
                        has_matching_file = True
                        break
                if has_matching_file:
                    break
            
            if not has_matching_file:
                return False
        
        # 제외 패턴 확인
        if exclude_patterns:
            for file_info in commit_data["files"]:
                file_path = file_info["path"]
                for pattern in exclude_patterns:
                    if self._matches_pattern(file_path, pattern):
                        return False
        
        return True
    
    def _matches_pattern(self, file_path: str, pattern: str) -> bool:
        """파일 경로가 패턴과 일치하는지 확인"""
        import fnmatch
        return fnmatch.fnmatch(file_path, pattern)
    
    def get_branches(self) -> List[str]:
        """저장소의 모든 브랜치 조회"""
        try:
            from git import Repo
            repo = Repo(self.repo_path)
            branches = []
            
            for branch in repo.branches:
                branches.append(branch.name)
            
            for remote in repo.remotes:
                for branch in remote.refs:
                    branch_name = branch.name.replace(f"{remote.name}/", "")
                    if branch_name not in branches:
                        branches.append(branch_name)
            
            return branches
            
        except ImportError:
            print("GitPython이 설치되지 않았습니다. pip install gitpython을 실행하세요.")
            return []
        except Exception as e:
            print(f"브랜치 조회 중 오류 발생: {e}", file=sys.stderr)
            return []


def main():
    """메인 함수 - CLI 인터페이스"""
    import argparse
    
    parser = argparse.ArgumentParser(description="PyDriller를 사용한 Git 커밋 데이터 수집")
    parser.add_argument("repo_path", help="Git 저장소 경로")
    parser.add_argument("--branches", nargs="+", help="수집할 브랜치 목록")
    parser.add_argument("--since", help="수집 시작 날짜 (YYYY-MM-DD)")
    parser.add_argument("--until", help="수집 종료 날짜 (YYYY-MM-DD)")
    parser.add_argument("--limit", type=int, help="수집할 커밋 수 제한")
    parser.add_argument("--include", nargs="+", help="포함할 파일 패턴")
    parser.add_argument("--exclude", nargs="+", help="제외할 파일 패턴")
    parser.add_argument("--output", help="출력 파일 경로 (JSON)")
    
    args = parser.parse_args()
    
    # 날짜 파싱
    since = None
    until = None
    
    if args.since:
        since = datetime.strptime(args.since, "%Y-%m-%d")
    
    if args.until:
        until = datetime.strptime(args.until, "%Y-%m-%d")
    
    try:
        collector = PyDrillerCollector(args.repo_path)
        commits = collector.collect_commits(
            branches=args.branches,
            since=since,
            until=until,
            limit=args.limit,
            include_patterns=args.include,
            exclude_patterns=args.exclude
        )
        
        # 결과 출력
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(commits, f, ensure_ascii=False, indent=2)
            print(f"수집된 {len(commits)}개 커밋을 {args.output}에 저장했습니다.")
        else:
            print(json.dumps(commits, ensure_ascii=False, indent=2))
            
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


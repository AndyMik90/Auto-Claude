# Auto-Claude 한글화 가이드

## 개요

이 문서는 Auto-Claude 업데이트 후 다시 적용해야 하는 한글화 수정 사항들을 기록합니다.
공식 i18n JSON 파일은 PR #653으로 기여했지만, 일부 컴포넌트는 hardcoded 영어 텍스트를 사용하므로 개인적으로 수정해야 합니다.

## 수정해야 하는 파일들

### 1. CompetitorAnalysisDialog.tsx
- **경로**: `apps/frontend/src/renderer/components/CompetitorAnalysisDialog.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (로드맵 생성 시 표시)

### 2. AppUpdateNotification.tsx
- **경로**: `apps/frontend/src/renderer/components/AppUpdateNotification.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 중간 (업데이트 있을 때만 표시)

### 3. SDKRateLimitModal.tsx
- **경로**: `apps/frontend/src/renderer/components/SDKRateLimitModal.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (Rate limit 발생 시 표시)

### 4. GitHubSetupModal.tsx
- **경로**: `apps/frontend/src/renderer/components/GitHubSetupModal.tsx`
- **이유**: 일부 i18n 적용되었으나 많은 hardcoded 영어 텍스트 남아있음
- **우선순위**: 중간 (프로젝트 설정 시 한번만 표시)

### 5. Worktrees.tsx
- **경로**: `apps/frontend/src/renderer/components/Worktrees.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 중간 (워크트리 관리 화면)

### 6. TerminalGrid.tsx
- **경로**: `apps/frontend/src/renderer/components/TerminalGrid.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (에이전트 터미널 화면, 자주 사용)

### 7. Insights.tsx
- **경로**: `apps/frontend/src/renderer/components/Insights.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (인사이트 대화 화면, 자주 사용)

### 8. IdeationEmptyState.tsx
- **경로**: `apps/frontend/src/renderer/components/ideation/IdeationEmptyState.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 중간 (아이디어 생성 화면)

### 9. ProjectIndexTab.tsx
- **경로**: `apps/frontend/src/renderer/components/context/ProjectIndexTab.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 중간 (프로젝트 구조 화면)

### 10. ChangelogHeader.tsx
- **경로**: `apps/frontend/src/renderer/components/changelog/ChangelogHeader.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (변경 로그 생성 화면 헤더)

### 11. ChangelogList.tsx
- **경로**: `apps/frontend/src/renderer/components/changelog/ChangelogList.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (변경 로그 작업 목록)

### 12. ChangelogFilters.tsx
- **경로**: `apps/frontend/src/renderer/components/changelog/ChangelogFilters.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 높음 (변경 로그 소스 필터)

### 13. TaskCreationWizard.tsx
- **경로**: `apps/frontend/src/renderer/components/TaskCreationWizard.tsx`
- **이유**: i18n 미적용, hardcoded 영어 텍스트
- **우선순위**: 매우 높음 (작업 생성 다이얼로그, 가장 자주 사용)

### 14. models.ts (상수 파일)
- **경로**: `apps/frontend/src/shared/constants/models.ts`
- **이유**: Agent Profile 이름과 설명이 hardcoded
- **우선순위**: 높음 (작업 생성 시 프로필 선택에 표시)

## 빠른 적용 방법

업데이트 후 이 파일들을 한글로 번역한 버전으로 교체하면 됩니다.
번역된 파일들은 아래 섹션에 상세히 기록되어 있습니다.

---

## 번역 완료 현황

✅ 완료:
1. CompetitorAnalysisDialog.tsx
2. AppUpdateNotification.tsx
3. Worktrees.tsx
4. SDKRateLimitModal.tsx
5. TerminalGrid.tsx
6. Insights.tsx
7. IdeationEmptyState.tsx
8. ProjectIndexTab.tsx
9. ChangelogHeader.tsx
10. ChangelogList.tsx
11. ChangelogFilters.tsx
12. TaskCreationWizard.tsx
13. models.ts (상수 파일)

⏳ 추가 작업 가능:
- GitHubSetupModal.tsx (초기 설정 시에만 표시, 우선순위 낮음)

---

## 상세 번역 내용

### 1. CompetitorAnalysisDialog.tsx

**경로**: `apps/frontend/src/renderer/components/CompetitorAnalysisDialog.tsx`

**번역 항목**:
- 제목: "Enable Competitor Analysis?" → "경쟁사 분석을 활성화하시겠습니까?"
- 설명: "Enhance your roadmap..." → "경쟁 제품의 인사이트로 로드맵을 강화하세요"
- 섹션 제목들과 설명 텍스트 모두 한글화
- 버튼: "Yes, Enable Analysis" → "예, 분석 활성화", "No, Skip Analysis" → "아니오, 분석 건너뛰기"

### 2. AppUpdateNotification.tsx

**경로**: `apps/frontend/src/renderer/components/AppUpdateNotification.tsx`

**번역 항목**:
- 다이얼로그 제목: "App Update Available" → "앱 업데이트 사용 가능"
- "New Version" → "새 버전"
- "Released" → "출시일:"
- "Downloading..." → "다운로드 중..."
- "Update downloaded successfully..." → "업데이트 다운로드 완료! 설치를 클릭하여..."
- 버튼들: "Download Update" → "업데이트 다운로드", "Install and Restart" → "설치 후 재시작", etc.

### 3. Worktrees.tsx

**경로**: `apps/frontend/src/renderer/components/Worktrees.tsx`

**번역 항목**:
- 페이지 제목: "Worktrees" → "워크트리"
- 설명: "Manage isolated workspaces..." → "Auto Claude 작업을 위한 격리된 작업 공간 관리"
- "Refresh" → "새로고침"
- "No Worktrees" → "워크트리 없음"
- 통계 텍스트: "files changed" → "개 파일 변경됨", "commits ahead" → "개 커밋 앞서있음"
- 버튼: "Merge to {branch}" → "{branch}에 병합", "Copy Path" → "경로 복사", "Delete" → "삭제"
- 다이얼로그: "Merge Worktree" → "워크트리 병합"
- "Source Branch" → "소스 브랜치", "Target Branch" → "대상 브랜치"
- "Merge Successful" / "Merge Failed" → "병합 성공" / "병합 실패"
- "Delete Worktree?" → "워크트리를 삭제하시겠습니까?"

### 4. SDKRateLimitModal.tsx

**경로**: `apps/frontend/src/renderer/components/SDKRateLimitModal.tsx`

**번역 항목**:
- 소스 이름 함수: "Changelog Generation" → "변경 로그 생성", "Task Execution" → "작업 실행", etc.
- 제목: "Claude Code Rate Limit" → "Claude Code 사용 제한"
- 설명: "was interrupted due to usage limits" → "작업이 사용 제한으로 중단되었습니다"
- "Upgrade to Pro for Higher Limits" → "더 높은 한도를 위해 Pro로 업그레이드"
- "Resets" → "에 재설정"
- "Weekly limit" → "주간 제한", "Session limit" → "세션 제한"
- "Switch Account & Retry" → "계정 전환 및 재시도"
- "Select account..." → "계정 선택..."
- "Retrying..." → "재시도 중...", "Retry" → "재시도"
- "Auto-switch & retry on rate limit" → "사용 제한 시 자동 전환 및 재시도"
- "Account name (e.g., Work, Personal)" → "계정 이름 (예: 회사, 개인)"
- "Add" → "추가"
- "This will open Claude login..." → "새 계정을 인증하기 위해 Claude 로그인이 열립니다"
- "Upgrade for more usage" → "더 많은 사용량을 위한 업그레이드"

### 5. TerminalGrid.tsx

**경로**: `apps/frontend/src/renderer/components/TerminalGrid.tsx`

**번역 항목**:
- 페이지 제목: "Agent Terminals" → "에이전트 터미널"
- 설명: "Spawn multiple terminals to run Claude agents in parallel. Use Ctrl+T to create a new terminal." → "여러 터미널을 생성하여 Claude 에이전트를 병렬로 실행합니다. 새 터미널을 생성하려면 Ctrl+T를 사용하세요."
- 버튼: "New Terminal" → "새 터미널"
- 상태: "{count} / 12 terminals" → "{count} / 12 터미널"
- 드롭다운: "History" → "기록", "Restore sessions from..." → "세션 복원..."
- 세션 수: "{count} session(s)" → "{count}개 세션"
- "Invoke Claude All" → "모든 Claude 호출"
- "Files" → "파일"

### 6. Insights.tsx

**경로**: `apps/frontend/src/renderer/components/Insights.tsx`

**번역 항목**:
- 페이지 제목: "Insights" → "인사이트"
- 부제목: "Ask questions about your codebase" → "코드베이스에 대해 질문하세요"
- 버튼: "New Chat" → "새 대화"
- 빈 상태 제목: "Start a Conversation" → "대화 시작하기"
- 빈 상태 설명: "Ask questions about your codebase, get suggestions for improvements, or discuss features you'd like to implement." → "코드베이스에 대해 질문하고, 개선 제안을 받거나, 구현하고 싶은 기능을 논의하세요."
- 제안 프롬프트:
  - "What is the architecture of this project?" → "이 프로젝트의 아키텍처는 무엇인가요?"
  - "Suggest improvements for code quality" → "코드 품질 개선 제안"
  - "What features could I add next?" → "다음에 추가할 수 있는 기능은?"
  - "Are there any security concerns?" → "보안 문제가 있나요?"
- 입력 필드: placeholder "Ask about your codebase..." → "코드베이스에 대해 질문하세요..."
- 도움말: "Press Enter to send, Shift+Enter for new line" → "Enter로 전송, Shift+Enter로 줄 바꿈"
- 역할 표시: "You" → "나", "Assistant" → "어시스턴트"
- 제안된 작업: "Suggested Task" → "제안된 작업"
- 버튼: "Creating..." → "생성 중...", "Task Created" → "작업 생성됨", "Create Task" → "작업 생성"
- 상태: "Thinking..." → "생각하는 중..."
- 도구: "{count} tool(s) used" → "{count}개 도구 사용됨"
- 도구 라벨: "Reading file" → "파일 읽는 중", "Searching files" → "파일 검색 중", "Searching code" → "코드 검색 중"

### 7. IdeationEmptyState.tsx

**경로**: `apps/frontend/src/renderer/components/ideation/IdeationEmptyState.tsx`

**번역 항목**:
- 제목: "No Ideas Yet" → "아직 아이디어가 없습니다"
- 설명: "Generate AI-powered feature ideas based on your project's context, existing patterns, and target audience." → "프로젝트 컨텍스트, 기존 패턴, 대상 고객을 기반으로 AI 기반 기능 아이디어를 생성합니다."
- 설정 섹션: "Enabled Ideation Types" → "활성화된 아이디어 유형"
- 버튼: "Generate Ideas" → "아이디어 생성"
- 경고: "Claude token not configured. You'll be prompted to enter it when generating." → "Claude 토큰이 구성되지 않았습니다. 생성 시 입력하라는 메시지가 표시됩니다."

### 8. ProjectIndexTab.tsx

**경로**: `apps/frontend/src/renderer/components/context/ProjectIndexTab.tsx`

**번역 항목**:
- 페이지 제목: "Project Structure" → "프로젝트 구조"
- 부제목: "AI-discovered knowledge about your codebase" → "AI가 발견한 코드베이스 지식"
- 버튼: "Refresh" → "새로고침"
- 툴팁: "Re-analyze project structure" → "프로젝트 구조 재분석"
- 에러: "Failed to load project index" → "프로젝트 인덱스 로드 실패"
- 빈 상태: "No Project Index Found" → "프로젝트 인덱스를 찾을 수 없습니다"
- 설명: "Click the Refresh button to analyze your project structure and create an index." → "새로고침 버튼을 클릭하여 프로젝트 구조를 분석하고 인덱스를 생성하세요."
- 버튼: "Analyze Project" → "프로젝트 분석"
- 섹션: "Overview" → "개요", "Services" → "서비스", "Infrastructure" → "인프라", "Conventions" → "규칙"
- 카운트: "{count} service(s)" → "{count}개 서비스"
- 라벨: "Docker Services" → "Docker 서비스", "TypeScript" value → "활성화됨"

### 9. ChangelogHeader.tsx

**경로**: `apps/frontend/src/renderer/components/changelog/ChangelogHeader.tsx`

**번역 항목**:
- 페이지 제목: "Changelog Generator" → "변경 로그 생성기"
- 단계:
  - "Step 1: Select completed tasks to include" → "1단계: 포함할 완료된 작업 선택"
  - "Step 2: Configure and generate changelog" → "2단계: 변경 로그 구성 및 생성"
  - "Step 3: Release and archive tasks" → "3단계: 릴리스 및 작업 보관"
- 단계 라벨: "Select" → "선택", "Generate" → "생성", "Release" → "릴리스"
- 버튼: "Refresh" → "새로고침"

### 10. ChangelogList.tsx

**경로**: `apps/frontend/src/renderer/components/changelog/ChangelogList.tsx`

**번역 항목**:
- 상태: "{count} of {count} tasks selected" → "{count}개 작업 중 {count}개 선택됨"
- 버튼: "Select All" → "전체 선택", "Clear" → "선택 해제"
- 빈 상태: "No Completed Tasks" → "완료된 작업이 없습니다"
- 설명: "Complete tasks in the Kanban board and mark them as 'Done' to include them in your changelog." → "칸반 보드에서 작업을 완료하고 '완료'로 표시하면 변경 로그에 포함됩니다."
- 커밋: "{count} commit(s) found" → "{count}개 커밋 발견됨"
- 로딩: "Loading commits..." → "커밋 로드 중..."
- 빈 상태: "No Commits Found" → "커밋을 찾을 수 없습니다"
- 설명:
  - Git History: "Configure the history options and click 'Load Commits' to preview." → "기록 옵션을 구성하고 '커밋 로드'를 클릭하여 미리보기하세요."
  - Branch Diff: "Select both branches and click 'Load Commits' to see the changes." → "두 브랜치를 선택하고 '커밋 로드'를 클릭하여 변경 사항을 확인하세요."
- 버튼: "Continue" → "계속"
- 라벨: "task" → "작업", "commit" → "커밋", "item" → "항목"

### 11. ChangelogFilters.tsx

**경로**: `apps/frontend/src/renderer/components/changelog/ChangelogFilters.tsx`

**번역 항목**:
- 소스 라벨: "Changelog Source" → "변경 로그 소스"
- Git 기록 섹션: "Git History Options" → "Git 기록 옵션"
- 라벨: "History Type" → "기록 유형"
- 옵션:
  - "Since Version" → "버전 이후"
  - "Recent Commits" → "최근 커밋"
  - "Since Date" → "날짜 이후"
  - "Tag Range" → "태그 범위"
- 필드:
  - "Number of Commits" → "커밋 수"
  - "Since Date" → "시작 날짜"
  - "From Tag" → "시작 태그"
  - "To Tag (optional)" → "종료 태그 (선택사항)"
  - "Last Version" → "마지막 버전"
- 플레이스홀더:
  - "Select tag..." → "태그 선택..."
  - "Select version..." → "버전 선택..."
  - "HEAD (latest)" → "HEAD (최신)"
- 설명: "All commits since this version will be included" → "이 버전 이후의 모든 커밋이 포함됩니다"
- 체크박스: "Include merge commits" → "병합 커밋 포함"
- 버튼: "Loading..." → "로드 중...", "Load Commits" → "커밋 로드"
- 브랜치 비교: "Branch Comparison" → "브랜치 비교"
- 필드:
  - "Base Branch" → "베이스 브랜치"
  - "Compare Branch" → "비교 브랜치"
- 플레이스홀더:
  - "Select base branch..." → "베이스 브랜치 선택..."
  - "Select compare branch..." → "비교 브랜치 선택..."
- 배지: "default" → "기본", "current" → "현재"
- 설명:
  - "The branch you're merging into" → "병합할 대상 브랜치"
  - "The branch with your changes" → "변경 사항이 있는 브랜치"
- 에러: "Branches must be different" → "브랜치는 달라야 합니다"

### 12. TaskCreationWizard.tsx

**경로**: `apps/frontend/src/renderer/components/TaskCreationWizard.tsx`

**번역 항목**:
- 다이얼로그 제목: "Create New Task" → "새 작업 생성"
- 설명: "Describe what you want to build. The AI will analyze your request and create a detailed specification." → "구현하고 싶은 내용을 설명하세요. AI가 요청을 분석하여 상세한 명세를 생성합니다."
- 임시 저장: "Draft restored" → "임시 저장본 복원됨"
- 버튼: "Start Fresh" → "새로 시작"
- 필드 라벨:
  - "Description *" → "설명 *"
  - "Task Title (optional)" → "작업 제목 (선택사항)"
- 플레이스홀더:
  - "Describe the feature, bug fix, or improvement..." → "구현하고자 하는 기능, 버그 수정 또는 개선 사항을 설명하세요..."
  - "Leave empty to auto-generate from description" → "비워두면 설명에서 자동 생성됩니다"
- 도움말:
  - "Files and images can be copy/pasted or dragged & dropped into the description." → "파일과 이미지를 복사/붙여넣기하거나 설명란에 드래그 앤 드롭할 수 있습니다."
  - "A short, descriptive title will be generated automatically if left empty." → "비워두면 간결하고 설명적인 제목이 자동으로 생성됩니다."
- 상태: "Image added successfully!" → "이미지가 성공적으로 추가되었습니다!"
- 분류 섹션: "Classification (optional)" → "분류 (선택사항)"
- 필드:
  - "Category" → "카테고리"
  - "Priority" → "우선순위"
  - "Complexity" → "복잡도"
  - "Impact" → "영향도"
- 플레이스홀더:
  - "Select category" → "카테고리 선택"
  - "Select priority" → "우선순위 선택"
  - "Select complexity" → "복잡도 선택"
  - "Select impact" → "영향도 선택"
- 도움말: "These labels help organize and prioritize tasks..." → "이 레이블들은 작업을 정리하고 우선순위를 지정하는 데 도움이 됩니다..."
- 검토 옵션: "Require human review before coding" → "코딩 전 사람 검토 필요"
- 설명: "When enabled, you'll be prompted to review the spec..." → "활성화하면 코딩 단계가 시작되기 전에 명세와 구현 계획을 검토하라는 메시지가 표시됩니다..."
- Git 옵션: "Git Options (optional)" → "Git 옵션 (선택사항)"
- 필드: "Base Branch (optional)" → "베이스 브랜치 (선택사항)"
- 플레이스홀더: "Use project default" → "프로젝트 기본값 사용"
- 도움말: "Override the branch this task's worktree will be created from..." → "이 작업의 워크트리가 생성될 브랜치를 재정의합니다..."
- 버튼:
  - "Browse Files" / "Hide Files" → "파일 찾아보기" / "파일 숨기기"
  - "Cancel" → "취소"
  - "Create Task" → "작업 생성"
  - "Creating..." → "생성 중..."

### 13. models.ts (상수 파일)

**경로**: `apps/frontend/src/shared/constants/models.ts`

**번역 항목** (Agent Profiles):
1. **Auto (Optimized)**:
   - name: "Auto (Optimized)" → "자동 (최적화)"
   - description: "Uses Opus across all phases with optimized thinking levels" → "모든 단계에서 Opus를 사용하며 최적화된 사고 수준 적용"

2. **Complex Tasks**:
   - name: "Complex Tasks" → "복잡한 작업"
   - description: "For intricate, multi-step implementations requiring deep analysis" → "심층 분석이 필요한 복잡한 다단계 구현을 위한 프로필"

3. **Balanced**:
   - name: "Balanced" → "균형"
   - description: "Good balance of speed and quality for most tasks" → "대부분의 작업에 적합한 속도와 품질의 균형"

4. **Quick Edits**:
   - name: "Quick Edits" → "빠른 수정"
   - description: "Fast iterations for simple changes and quick fixes" → "간단한 변경과 빠른 수정을 위한 신속한 반복"

---

## 적용 방법

1. 파일 백업 (선택사항):
   ```bash
   cp apps/frontend/src/renderer/components/CompetitorAnalysisDialog.tsx apps/frontend/src/renderer/components/CompetitorAnalysisDialog.tsx.bak
   ```

2. 번역된 파일로 교체

3. 빌드:
   ```bash
   npm run build
   ```

4. 재시작하여 변경 사항 확인

---

## 주의사항

⚠️ **업데이트 후 적용 시**:
- 이 파일들은 업스트림 업데이트 시 덮어쓰여질 수 있습니다
- 업데이트 후 이 문서를 참고하여 다시 번역을 적용하세요
- Git으로 변경 사항을 추적하면 업데이트 후 쉽게 재적용할 수 있습니다

⚠️ **i18n vs Hardcoded**:
- 이 파일들은 i18n 시스템을 사용하지 않고 텍스트가 hardcoded되어 있습니다
- 공식 i18n JSON 파일 (PR #653)과는 별개로 관리됩니다
- 향후 개발자가 이 파일들에 i18n을 적용하면 이 번역은 불필요해질 수 있습니다


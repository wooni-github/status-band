# status-band

Claude Code 터미널용 상태 밴드(mod). 프롬프트 바로 위에 한 덩어리로 보여준다.

- 모델 · thinking · 입력/출력 토큰 · 출력 속도(tok/s)
- 5시간 세션 / 주간 / 주간 Fable 사용량 바 + 리셋 타이머
- 컨텍스트 % · 캐시 타이머 · 캐시 적중률 · 압축 횟수 · 세션 비용($, $/h)
- Git: 브랜치 · ⇡ahead ⇣behind · ●staged ✚unstaged …untracked · ✖충돌 · worktree 면 ⎇
- 활동: 실행 중 서브에이전트는 한 줄에 하나(종류 · 경과 시간 · 작업 설명), 3개 이상이면 `▸ 🤖 에이전트 N개` 로 접히고 눌러서 펼침.
- 서브에이전트 대화 보기: 에이전트 줄 앞 `↗` 를 누르면 사이드 패널에 그 에이전트의 대화(지시 · 응답 · 도구 호출과 결과)가 열립니다. 실행 중이면 계속 갱신되고, 끝난 뒤에도 패널은 남습니다. Esc 로 닫기
- 메모: `대화` 상자 아래 메모 칸에 메모(하나)의 첫 두 줄이 보입니다. 누르면 사이드 패널에 전체가 열리고, 줄을 누르면 그 줄을 수정합니다(비우고 Enter 면 그 줄 삭제). 맨 아래 칸에 쓰고 Enter 면 줄 추가. `/memo 내용` 으로 바로 한 줄 추가. 터미널(세션)마다 따로이고 `~/.claude/band-memo/<세션 id>.md` 에 저장되어 `--resume` 해도 남습니다. Claude 에게는 보내지 않습니다
  그 아래 한 줄에 10초 넘게 도는 도구 · Todo 진행(3/7) · 수정한 파일 · 도구/오류 수.
  Claude Code 가 이미 그리는 것(Todo 목록, 도구 로그, 스피너)은 다시 그리지 않고 요약만 한다
- GPU 메모리/사용률 · CPU · RAM 사용률(로컬 / ssh 호스트, 각각 켜고 끔, 열 정렬) · 최근 입력 3개(시각은 이 머신의 시간대, `date +%z`)
- 펫: Claude Code에서 사라진 `/buddy` 컴패니언을 리소스 패널 아래에 되살렸습니다. 기본값은 **내 buddy**입니다. Claude Code와 같은 방식(`~/.claude.json`의 계정 uuid → wyhash → mulberry32)으로 뽑으므로, 예전에 `/buddy`로 받았던 그 종·희귀도·눈·모자·스탯이 그대로 나옵니다. 몸은 희귀도 색이고 아래에 이름과 ★이 붙습니다. 원래와 같은 0.5초 간격 idle 루프(가만히 → 꼼지락 → 깜빡)로 움직입니다. 작업 중이면 쉬지 않고 꼼지락하고, 끝나면 ♥, 캐시가 식으면 `- -` 눈에 `zZ`, 컨텍스트 80% 이상이면 `× ×` 눈이 됩니다. `/band buddy`를 입력하면 스탯 카드가 나옵니다. 세로 공간이 모자라면 가장 먼저 빠지고 `대화` 옆 한 줄 얼굴로 돌아갑니다. 스프라이트와 뽑기 알고리즘 출처: [ramarivera/coding-buddy](https://github.com/ramarivera/coding-buddy) (MIT)

## 설치

Claude Code 안에서:

```
/plugin install status-band --marketplace wooni-github/status-band
```

일부 터미널에서만 쓰려면:

```sh
git clone https://github.com/wooni-github/status-band ~/.claude/status-band
~/.claude/status-band/install.sh        # ~/.local/bin/claude-band 생성
```

## 사용

```sh
claude-band            # 이 터미널만 밴드 켜서 실행 (claude 인자 그대로 전달)
claude                # 평소처럼, 밴드 없음
```

대화 칸의 `▸`: 짧은 입력은 칸 안에서 펼친다. 남은 높이를 넘는 입력은 밴드 왼쪽이 그 입력에 자리를 내준다(목표 칸·다른 입력·활동·메모가 잠시 빠지고 밴드 상한까지 커짐). 옆 패널은 쓰지 않아 밴드가 옆으로 밀리지 않는다. 그래도 넘치면 `… (ctrl+o …)`.

세션 안에서: `/band` 밴드 숨김/표시 · `/band lang ko|en` 표시 언어 전환(이 세션만).
설정: 밴드의 `⚙ 설정` 버튼(또는 `/band settings`)을 누르면 옆 패널에서 바로 바꿀 수 있다. `/config` → status-band 와 같은 항목:

| 항목 | 기본 | 뜻 |
| --- | --- | --- |
| Language | en | 밴드·토스트·명령 응답 언어. `ko` 한국어 / `en` English |
| Theme | contrast | 알약 글자색. `contrast` = 알약 색마다 더 잘 읽히는 흰/검정 자동(기본 파스텔은 전부 검정), `auto` = Claude Code 테마(dark → 흰, light → 검정), `dark`/`light` 고정. 바도 같은 색 |
| Show git | on | 브랜치/변경 수. 저장소 밖이면 칸 없음 |
| Git interval (s) | 10 | git status 주기. 파일 수정·Bash 뒤 1초에 한 번 더 읽음 |
| Show cost | on | 세션 비용, $/h, 출력 tok/s |
| Show activity | on | 에이전트 줄과 활동 요약 줄. 공간이 모자라면 에이전트 줄부터 접고, 그래도 모자라면 숨김 |
| Show goal & loop | on | 대화 칸 위의 별도 칸(목표나 루프가 있을 때만)에 `🎯 목표`(/goal 조건, 경과 시간)와 `🔁 루프`(/loop 내용, 주기, 다음 실행까지, 이유). `/goal clear` 나 루프 종료 시 사라짐 |
| Pet | buddy | `buddy` = 내 계정의 buddy, 종 이름(duck … chonk 18종) = 그 종으로 고정, `off` = 끄기(`대화` 옆 한 줄 얼굴) |
| Pet name | (빈칸) | 펫 아래 이름. 비우면 종 이름 |
| Pet place | auto | `auto` = 자원 패널 아래, 자리가 없으면 옆. `under`/`beside` = 그 자리만(자리 없으면 펫 숨김) |
| Resource columns | auto | `auto` = 자원 줄이 4개 넘고(GPU 8장 등) 폭이 되면 2열. `1`/`2` 고정 |
| Palette | #D0607A,#E8C07D,#A3BE8C,#5B80A8 | 4색(분홍·노랑·초록·파랑 역할): 알약, 테두리, 제목 |
| Pill text color | (빈칸) | 알약 글자색 #RRGGBB. 비우면 Theme 을 따름. 프리셋: 흰색·검은색. 흰 글자를 쓰려면 Palette 의 `진한 색` 프리셋과 함께 |
| Text color | (빈칸) | 최근 입력 줄 글자색 #RRGGBB. 비우면 터미널 기본 |
| Pet eyes / Pet hat | auto / auto | auto = 뽑힌 그대로. 눈 6종(`·✦×◉@°`), 모자 8종(crown, tophat, wizard…)으로 바꿀 수 있음 |
| Local GPU | on | 이 머신 GPU. macOS 는 `ioreg` 로 Apple GPU 사용률 + 사용 중 메모리/통합 메모리, Linux 는 `nvidia-smi` |
| SSH GPU | on | 아래 GPU hosts 를 ssh 로 폴링(`nvidia-smi`). 호스트당 접속 1회 |
| GPU hosts | (빈칸) | 쉼표 구분 ssh 호스트 |
| Show CPU | on | CPU 사용률 줄. 로컬(macOS `top`, Linux `/proc/stat`) + SSH GPU 가 켜져 있으면 각 호스트도 |
| Show RAM | on | 메모리 사용량. macOS `vm_stat`(활성 상태 보기 기준: 앱 + 와이어드 + 압축), Linux `/proc/meminfo`(MemTotal − MemAvailable) |
| Resource interval (s) | 15 | GPU/CPU/RAM 폴링 주기 |
| Prompt lines | 3 | 표시할 입력 줄 수 |

모두 끄면 자원 칸이 사라지고 아무것도 폴링하지 않는다. 자원 칸은 `이름 [바] 상세 값%` 고정 열이라 `[`, `]`, `%` 가 줄마다 같은 위치에 온다(GPU 줄의 바는 메모리, % 는 사용률).
바는 5칸(한 칸 20%)이고 바와 % 모두 50% 미만 녹색, 80% 미만 주황, 그 이상 빨강. 칸 폭은 내용에 딱 맞추고, 대화 칸 옆에 둘 자리가 없으면 아래로 내려간다(잘려서 `…` 이 되지 않음):

```
M4       [░░░░░]   0.6/16G  12%
CPU      [███░░]       10c  63%
RAM      [████░]    12/16G  72%
box1 0   [█████]  152/179G  95%
box1 CPU [███░░]      128c  50%
box1 RAM [█░░░░] 252/1008G  25%
```

## 조건

- Claude Code ≥ 2.1.289 (mods/function hooks 기본 켜짐).
  확인: `claude plugin test ~/.claude/status-band` → 전부 pass 면 OK.
- 터미널 폰트에 powerline 글리프(Nerd Font 등). 없으면 알약 모서리가 깨져 보임.
- Linux/ssh 호스트에 `nvidia-smi` 가 없으면 그 GPU 줄만 `n/a`. macOS 는 sudo 없이 동작.

## 개발

```sh
claude plugin validate ~/.claude/status-band
claude plugin test ~/.claude/status-band
```

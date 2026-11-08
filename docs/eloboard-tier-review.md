# ELOBOARD 선수 변경 검토·승인

정기 비교 → 승인한 변경만 검토 PR에 반영 → main 병합 승인 → 운영 배포 승인 순서다.
정기 비교와 PR 생성은 main 또는 운영 사이트의 선수 정보를 바꾸지 않는다.

## GitHub 화면에서 진행

1. **Actions → Review EloBoard tiers**의 최신 성공 실행을 연다. 변경이 없으면
   적용할 일이 없다. 실패·사이트 점검·프로필 조회 불가는 선수 변경의 근거가 아니다.
2. 실행 Summary 또는 `eloboard-tier-proposal`의 `review.md`에서 이름·티어·종족·ID
   전후 값과 상세 변경을 확인한다. `source.html`은 실행하지 말고 소스 데이터로 확인한다.
   동일 이름도 다른 ID라면 다른 선수다. 공식 티어표·선수 프로필을 대조한다.
3. **Actions → Prepare approved EloBoard changes → Run workflow**, 브랜치 **main**을
   선택한다. 검토 실행 URL의 숫자 실행 ID와 승인 키를 입력한다.
   예: `32:tier,100:race`. `all`, 빈 목록, 중복·존재하지 않는 키는 거절한다.
4. 워크플로가 검증·적용·전체 Node/워크플로/WebKit·화면 검사를 통과하면 별도 데이터 PR을
   만든다. PR의 실제 `players.json` diff를 다시 확인한다. 봇 PR에 대한 회귀검사는 별도
   workflow_dispatch로 명시적으로 실행한다. PR 생성만으로 검사 실행을 가정하지 않는다.
5. **main 병합은 별도 승인 후** 진행한다. 자동 병합은 없다.
6. 운영 반영도 별도 승인이다. 병합 후 **JavaScript regression tests → Run workflow**에서
   main을 선택하고 **deploy_sha에 승인한 현재 main 커밋 SHA 전체 40자리**를 입력한다.
   빈 값은 검사만 실행한다. push, PR, 봇 작업 완료는 배포하지 않는다.
   검사 후 배포 직전에도 같은 SHA가 최신 main인지 재확인한다.

승인 키는 `eloId:필드` 형식이다. `name`은 이전 이름 별칭 보존을, `tier`는 `tierLabel`을
포함한다. 신규 선수는 `eloId:add` 전체를 검토한다. ID가 없는 기존 선수의 공식 ID 연결은
`eloId:eloId`로 따로 승인한다. 기존 양수 ID를 다른 값으로 교체·병합하는 것은 허용하지 않는다.
승인하지 않은 필드는 유지한다. 명단에서 빠진 선수도 삭제하지 않으며 비활성화는 `active` 승인 시에만 한다.

## 검증과 보존

- 검토 소스·DB·제안 파일의 SHA-256을 각각 확인한다. 승인 목록·승인자·시각도 해시로 묶어
  PR 감사 기록 `docs/eloboard-reviews/<approval-run-id>.json`에 남긴다.
- 소스 실행은 같은 저장소의 지정된 비교 워크플로, 성공한 main 실행이어야 한다.
  실행 커밋과 승인 실행 커밋이 일치해야 한다. 아티팩트 ZIP 자체의 GitHub digest도 검증한다.
- 제안·아티팩트는 7일 내여야 한다. main/DB 변경, 만료, 출처·해시 불일치 시 새 비교와 재승인이 필요하다.
- 검토 때 확보한 이미지 파일·해시만 적용한다. 원격 URL의 이미지를 적용 중 재조회하지 않는다.
- 기존 ID, 종족 미정(null), SOOP 연결, 별칭, 신원 이력, 사용자 정의 필드와 개인 기록을 유지한다.
  알려진 종족을 소스 누락으로 지우지 않는다. 미정→확정 종족 변경도 별도 승인을 요구한다.
- 선수 배열 순서를 유지하며, 신규 선수만 뒤에 추가한다. 일부만 승인했을 때 전체 소스가
  반영됐다고 표시하지 않도록 `source`와 `updatedAt`은 유지한다. 최신 비교·적용 시각과
  출처 버전은 검토 보고서와 감사 기록에서 확인한다.
- 사용자 기기의 localStorage, 설정, 스폰 기록과 백업 형식은 변경하지 않는다.
- 예전 DB/임베드 마이그레이션 워크플로는 은퇴 처리해 자동 push 실행·main 쓰기를 제거한다.

## 권한과 운영 제한

승인 워크플로는 PR 생성용 contents/pull-requests write와 명시적 검사 실행용 actions write가
필요하다. 저장소 Settings → Actions에서 GitHub Actions의 PR 생성이 허용돼야 한다.
허용되지 않으면 작업은 실패하며 main 직접 쓰기로 우회하지 않는다. 봇 PR 생성 이후 검사
 dispatch만 실패했다면 main을 병합하지 말고 해당 PR 브랜치의 정확한 SHA로 검사만 다시 실행한다.

main 보호·필수 검사·리뷰 강제 설정은 별도 관리 설정이다. 이 코드만으로 관리자 직접 쓰기나
GitHub 화면의 수동 병합을 막지는 못한다. PR 검사를 필수로 설정하고 최신 상태 재검사를
요구하는 브랜치 보호를 권장한다. 이 기능은 보호 설정을 자동으로 바꾸지 않는다.

## 고급 수동 적용

반복 사용은 위 GitHub 화면을 사용한다. 로컬 적용이 필요한 경우에도 검토한 파일과 명시적
승인 키를 모두 전달해야 한다. 예전 소스 파일·두 해시만 전달하는 명령은 거절한다.

```sh
node scripts/sync-eloboard-tiers.mjs --apply \
  --source-file=source.html --proposal-file=proposal.json \
  --expected-sha256=<sourceSha256> --expected-db-sha256=<dbSha256> \
  --expected-proposal-sha256=<proposal-file-sha256> \
  --approved-changes=32:tier,100:race
```

실제 DB 적용 전 모든 항목을 검증하고 임시 파일을 통해 DB를 교체한다. 실패한 작업 디렉터리는
재사용하지 않고 새 checkout에서 실행한다. main이 바뀌면 새 제안으로 다시 검토한다.

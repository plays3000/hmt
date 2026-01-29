# hmt-gcp
## google-chrome hardward acceleration
1. google-chrome --js-flags="--max_old_space_size=300" --process-per-site --enable-features=TabFreeze,TabGroupsAutoCreate,AutomaticTabDiscarding --disable-site-isolation-trials --enable-webgl --ignore-gpu-blocklist --enable-accelerated-2d-canvas
  
## 현재 HMT 기능
1. 사람여부 실시간 객체 탐지
2. 사람 추적 실시간 시스템
3. 얼굴 실시간 감지 시스템

## 배포명령어
gcloud init
gcloud app deploy"# hmt" 

export const createVideoCanvasElements = (cameraIdx: string, src?: string) => {
  // video 엘레멘트 생성
  const video = document.createElement("video");
  video.id = `video${cameraIdx}`;
  video.controls = true;
  video.preload = "auto";
  video.width = 640;
  video.height = 480;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  if (src) video.src = src;

  // 첫 번째 캔버스 엘레멘트 생성
  const canvas = document.createElement("canvas");
  canvas.id = `canvas${cameraIdx}`;
  canvas.width = 640;
  canvas.height = 480;

  // 두 번째 캔버스 엘레멘트 생성 (캡처용)
  const canvasForCapture = document.createElement("canvas");
  canvasForCapture.id = `canvasForCapture${cameraIdx}`;
  canvasForCapture.width = 640;
  canvasForCapture.height = 480;
  canvasForCapture.style.display = "none";

  const divForInfo = document.createElement("div");
  divForInfo.id = "divForInfo";

  // body 태그에 엘레멘트 추가
  document.body.appendChild(video);
  document.body.appendChild(canvas);
  document.body.appendChild(canvasForCapture);
  document.body.appendChild(divForInfo);

  return { video, canvas, canvasForCapture };
};

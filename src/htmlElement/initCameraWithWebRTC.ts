import webRTC from "../webrtc/webrtc.js";
import { getCameras } from "../webrtc/webrtcUtil.js";
import { createVideoCanvasElements } from "./createHTMLElements.js";
import { setRenderElem } from "./setRenderElem.js";

export async function initCameraWithWebRTC() {
  const cameras = await getCameras();
  const renderElements = [];
  if (!cameras) return console.log("not found cameras");

  for (const [idx, camera] of cameras.entries()) {
    const cameraIdx = String(idx);
    const elements = createVideoCanvasElements(cameraIdx);
    renderElements.push(elements);
    webRTC(camera, cameraIdx);
    setRenderElem(elements, cameraIdx);
  }

  return renderElements;
}
